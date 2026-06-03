<template>
  <div class="pfb">
    <!-- toolbar -->
    <div class="pfb-toolbar">
      <label>切換模式：</label>
      <button class="mode-btn" @click="setMode(mode_status[mode].to)">{{ mode_status[mode].text }}</button>
      <button v-if="mode === 'image'" class="mode-btn file-upload" @click="$refs.fileInput.click()">選擇檔案</button>
      <input ref="fileInput" type="file" accept=".drawio,image/*" @change="handleFile" style="display:none" />

      <span v-if="uploading" class="hint">上傳中...</span>
      <span v-else-if="file && file.download_url" class="hint">已選檔</span>

      <div v-if="props.allowColor" class="menu color">
        <div class="font-color blue"  @click="applyColor('blue')"></div>
        <div class="font-color black" @click="applyColor(null)"></div>
      </div>

      <a v-if="mode === 'image' && (file && file?.download_url)" :href="fullUrl(file.download_url)" download class="download-link-toolbar">下載檔案</a>
    </div>

    <!-- 標題 + 欄位操作 -->
    <div class="pfb-input-row" @mousedown="activeTarget='header'">
      <label>2.1</label>
      <EditorContent :editor="headerEditor" class="title-editor-content" />
      <div v-if="mode==='table'" class="step-ops">
        <button class="action-btn add-btn" @click="updateStep('add')">+</button>
        <button class="action-btn remove-btn" @click="updateStep('remove')">-</button>
      </div>
    </div>

    <!-- table -->
    <div v-if="mode==='table'" class="process-table-wrapper">
      <div class="pf-table-focusable" tabindex="0" @mousedown="activeTarget='contnet'" @focus="activeTarget='contnet'">
        <EditorContent :editor="tableEditor" class="pf-editor" />
      </div>
    </div>

    <!-- upload preview -->
    <div v-else-if="mode==='image'" class="upload-body">
      <div v-if="file && file?.url" class="preview">
        <img :src="fullUrl(file?.url)" alt="flow" class="preview-image" />
        <button class="pic-remove-btn" @click="removeImage">X</button>
      </div>
      <div v-else class="empty">尚未選擇檔案（支援 .drawio / 圖檔）</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { Focus } from '@tiptap/extensions'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { History } from '@tiptap/extension-history'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

// ==========================================
// 1. Emit and props function
// ==========================================
const emit = defineEmits(['update-block', 'invalid-check'])
const props = defineProps({
  blockContent: { type: Object, required: true },
  cols: { type: Number, default: 9 },
  documentToken: { type: String, default: '' },
  allowColor: {type: Boolean, default: true}
})

// ==========================================
// 2. Editor and variable declare & Tiptap extension presets & helper function
// ==========================================
const headerEditor = ref(null);
const tableEditor = ref(null);
const activeTarget = ref('header');
const steps = ref([]);
const uploading = ref(false);
const file = ref(null);

const mode_status = { table: { to: "image", text: "輸入模式" }, image: { to: "table", text: "上傳模式" } };
const mode = ref('table');
const setMode = (toMode) => mode.value = toMode;

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      contenteditable: {
        default: true,
        parseHTML: el => el.getAttribute('contenteditable') !== 'false',
        renderHTML: attrs => ({ contenteditable: attrs.contenteditable ? 'true' : 'false' }),
      },
    }
  },
});
const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      contenteditable: {
        default: true,
        parseHTML: el => el.getAttribute('contenteditable') !== 'false',
        renderHTML: attrs => ({ contenteditable: attrs.contenteditable ? 'true' : 'false' }),
      },
    }
  },
});
const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })];
const titleExt = [Document.extend({ content: 'paragraph' }), ...baseExt, Placeholder.configure({ placeholder: '請輸入標題' })];
const tableEditorExtensions = [Document, CustomTableHeader, CustomTableCell, History, ...baseExt, Table.configure({}), TableRow, Focus.configure({ className: 'has-focus', mode: 'all' })];

const tr = cells => ({ type: 'tableRow', content: cells });
const th = (text, editable = false) => ({ type: 'tableHeader', attrs: { contenteditable: editable }, content: [{ type: 'paragraph', content: p(text) }] });
const td = (text, editable = true) => ({ type: 'tableCell', attrs: { contenteditable: editable }, content: [{ type: 'paragraph', content: p(text) }] });
const p = text => (text ? [{ type: 'text', text: String(text) }] : []);
const docP = text => (text ? { type: 'doc', content: [{ type: 'paragraph', content: p(text) }] } : { type: 'doc', content: [{ type: 'paragraph' }] });
const getRowText = tableNode => tableNode.content.map(rowNode => rowNode.content.map(cellNode => cellNode.content.map(pNode => pNode.content?.[0]?.text || "").join("\n")));

// ==========================================
// 3. File handle function
// ==========================================
const fullUrl = u => u?.startsWith('http') ? u : `${API_BASE_URL}${u}`;
const removeImage = () => { file.value = null; exportData() }
const handleFile = async (event) => {
  const f = event.target.files?.[0];
  event.target.value = '';
  if (!f) return;
  uploading.value = true;
  try {
    const ext = f.name.split('.').pop().toLowerCase();
    const fd = new FormData();
    fd.append('file', f);

    const r = await axios.post(`${API_BASE_URL}/uploads/${ext === 'drawio' ? "drawio" : "image"}?token=${props.token}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (!r.data?.success) throw new Error(r.data?.message || 'upload failed');
    file.value = { url: r.data.url, path: r.data.path_to_save, download_url: r.data.download_url };
  } 
  catch (e) { console.error(e); alert('上傳失敗'); } 
  finally { uploading.value = false; }
  exportData();
}

// ==========================================
// 4. Editor trigger function
// ==========================================
const posFocusCheck = (state) => [state.selection.$anchor.path[4], state.selection.$anchor.path[7]];
const exportData = () => {
  const table = getRowText(tableEditor.value.getJSON().content[0]);
  
  const newSteps = [];
  for (let row = 0; row < table.length; row++) {
    for (let col = 1; row % 2 === 1 && table[row - 1][col] !== "" && col <= props.cols; col++) newSteps.push(table[row][col] || "");
  }

  steps.value = newSteps;
  const blk = { step_type: 0, tier_no: 1, data: [
    { content_type: mode.value == 'table' ? 2 : 1,  header_text: headerEditor.value.getText(), header_json: headerEditor.value.getJSON(), content_text: null, content_json: null, table_text: steps.value, table_json: tableEditor.value.getJSON(), files: file.value ? [file.value] : [], metadata: null}
  ]};
  emit('update-block', blk); 

  const valid = (mode.value = 'table') ? !newSteps.some(step => step == "") && newSteps.length != 0 : file.value != null;
  const message = (mode.value = 'table') ? "製造流程 表格內容尚未完成" : "製造流程 圖片內容尚未上傳";
  emit('invalid-check', { isValid: valid, message: (!valid) ? message : null });
}
const handleKeydown = (view, event) => {
  const { state } = view;
  const { $from } = state.selection;
  let inLockedCell = false;
  let pos = posFocusCheck(state);
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      if (node.attrs.contenteditable === false) inLockedCell = true;
      break;
    }
  }
  if (!inLockedCell) return false;
  const k = event.key;
  const allowNav = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown','Tab'].includes(k);
  const allowMeta = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
  if (allowNav || allowMeta) return false;
  event.preventDefault();
  return true;
}
const handlePaste = (view, event) => {
  const { state } = view;
  const { $from } = state.selection;
  let inLockedCell = false;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      if (node.attrs.contenteditable === false) inLockedCell = true;
      break
    }
  }
  if (!inLockedCell) return false;
  event.preventDefault();
  return true;
}
function selectStep(index) {
  if (index < 0) return;
  const doc = tableEditor.value.state.doc;
  const table = doc.firstChild;

  const targetRowIndex = Math.floor(index / props.cols) * 2 + 1;
  const targetColIndex = (index % props.cols) + 1;

  const rowNode = table.child(targetRowIndex);
  const cellNode = rowNode.child(targetColIndex);

  let pos = 1;
  for (let r = 0; r < targetRowIndex; r++) { pos += table.child(r).nodeSize; }
  for (let c = 0; c < targetColIndex; c++) { pos += rowNode.child(c).nodeSize; }

  tableEditor.value.commands.setTextSelection({ from: pos + 3, to: pos + cellNode.nodeSize - 1 });
  tableEditor.value.commands.focus();
}

// ==========================================
// 5. Editor build function
// ==========================================
const makeTableDoc = (steps = [], cols = props.cols) => {
  const rows = [];
  const groups = Math.max(1, Math.ceil(steps.length / cols));

  for (let row = 0; row < groups; row++) {
    const rowIndex = row * cols;
    const headerCells = [th('步驟', false)];
    const processCells = [th('流程', false)];

    for (let col = 0; col < cols; col++) {
      const index = rowIndex + col;
      headerCells.push(index < steps.length ? th(index + 1, false) : th('', false));
      processCells.push(index < steps.length ? td(steps[index] || '', true) : td('', false));
    }

    rows.push(tr(headerCells));
    rows.push(tr(processCells));
  }
  return { type: 'doc', content: [{ type: 'table', content: rows }] };
}
const initialTableDoc = (content) => {
  if (!content) return makeTableDoc([]);
  if (content && Array.isArray(content)) return makeTableDoc(content);
  return content;
}

const buildTitleEditor = (title) => headerEditor.value = new Editor({ extensions: titleExt, content: title == String ? docP(title) : title, onFocus: () => (activeTarget.value = 'header'), onUpdate: exportData });
const buildTableEditor = (content) => {
  if (tableEditor.value) tableEditor.value.destroy();
  tableEditor.value = null;
  tableEditor.value = new Editor({
    extensions: tableEditorExtensions, editable: true, content: initialTableDoc(content),
    onFocus: () => activeTarget.value = 'table', onUpdate: exportData,
    editorProps: { handleDOMEvents: { keydown: handleKeydown, paste: handlePaste } }
  });
  exportData();
}

// ==========================================
// 6. Button function
// ==========================================
const updateStep = (command) => {
  const { state } = tableEditor.value;
  const pos = posFocusCheck(state);

  const index = Math.floor(pos[0] / 2) * props.cols + (pos[1] - 1);
  while (steps.value.length <= index) { steps.value.push(''); }

  if (command === 'remove') { steps.value.splice(index, 1); }
  else if (command === 'add') { steps.value.splice(index + 1, 0, ''); }

  tableEditor.value.commands.setContent(makeTableDoc(steps.value), false);
  activeTarget.value = 'table';

  if (command === 'add') { selectStep(index + 1); }
  else if (command === 'remove') { selectStep(Math.min(index, Math.max(0, steps.value.length - 1))); }
}
const applyColor = (color) => {
  if (activeTarget.value === 'header') { headerEditor.value?.chain().focus().setColor(color || '#000').run(); return; }

  const pos = posFocusCheck(tableEditor.value.state);
  const index = Math.floor(pos[0] / 2) * props.cols + (pos[1] - 1);
  selectStep(index);
  tableEditor.value.chain().setColor(color || '#000').run();
}

// ==========================================
// 7. Constructor & destructor function
// ==========================================
const loadBlockContent = (blk) => {
  blk.content_type === 2 ? setMode('table') : setMode('image');
  file.value = (blk.files && blk.files.length > 0) ? blk.files[0] : null;
  buildTableEditor(blk.table_json);
}
onMounted(() => { 
  mode.value = props.blockContent.content_type == 2 ? 'table' : 'image';
  buildTitleEditor(props.blockContent.header_json);
  buildTableEditor(props.blockContent.table_json);
  file.value = props.blockContent.files[0];
})
onBeforeUnmount(() => { headerEditor.value.destroy(); headerEditor.value = null; tableEditor.value.destroy(); tableEditor.value = null; file.value = null; })
defineExpose({ loadBlockContent, buildTableEditor })
</script>

<style scoped>
.pfb{ display:grid; gap:12px; }

/* toolbar */
.pfb-toolbar{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.mode-btn{ background:#007bff; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; }
.mode-btn.active{ background:#0056b3; }
.file-upload{ background:#4c7bd9; }
.hint{ color:#555; margin-left:6px; }

.menu.color{ display:flex; align-items:center; gap:6px; }
.font-color{ width:18px; height:18px; border-radius:50%; border:1px solid #ccc; cursor:pointer; }
.font-color.blue{background:blue}
.font-color.black{background:black}

.download-link-toolbar{ margin-left:8px; font-size:14px; color:#1666C0; text-decoration:underline; cursor:pointer; }

/* header row */
.pfb-input-row{ display:flex; align-items:center; gap:10px; }
.title-editor-content :deep(.ProseMirror){
  min-height:36px; height:36px;
  display:flex; align-items:center;
  padding:0 10px; border:1px solid #ddd; border-radius:4px;
  min-width:12rem; max-width:28rem; box-sizing:border-box;
}
.title-editor-content :deep(.ProseMirror p.is-editor-empty::before){ content:attr(data-placeholder); pointer-events:none; height:0; float:left; color:#adb5bd; }
.step-ops{ display:flex; gap:6px; align-items:center; }
.action-btn{ width:30px; height:30px; border:none; border-radius:50%; color:#fff; cursor:pointer; font-size:18px; line-height:30px; padding:0; }
.add-btn{ background:#28a745; }
.remove-btn{ background:#dc3545; }

/* table */
.process-table-wrapper{ width:100%; }
.pf-table-focusable{ outline:none; }
.pf-table-focusable:focus-visible{ box-shadow:0 0 0 3px rgba(0,123,255,.25); border-radius:6px; }
.pf-editor :deep(table){ width:100%; border-collapse:collapse; table-layout:fixed; }
.pf-editor :deep(th), .pf-editor :deep(td){ border:1px solid #ddd; padding:8px; text-align:center; vertical-align:middle; word-wrap:break-word; }
.pf-editor :deep(th:first-child), .pf-editor :deep(td:first-child){ width:72px; background:#f7f9fc; font-weight:600; }
.pf-editor :deep(.ProseMirror){ outline:none; }
.pf-editor :deep(td.has-focus){ background-color:#fff7cc; box-shadow: inset 0 0 0 2px #ff9800; }

/* upload preview */
.upload-body{ display:flex; justify-content:center; padding:16px; }
.upload-body .preview{ position: relative; display: inline-block; }
.upload-body .preview img.preview-image{ max-width:100%; height:auto; display:block; border:1px solid #eee; border-radius:4px; }

/* ⭐ 右上角刪除按鈕 */
.pic-remove-btn {
  position: absolute;
  top: 0px;
  right: 0px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.2s ease;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 14px;
}

.pic-remove-btn:hover { background-color: #b52a36; transform: scale(1.05); }
.upload-body .empty{ padding:10px; color:#777; }
</style>