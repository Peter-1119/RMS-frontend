<template>
  <div class="block-container">
    <div v-if="tableDialog.show" class="modal-overlay">
      <div class="modal-content">
        <h3 style="margin-top: 0;">插入表格</h3>
        <div class="form-group">
          <label>列數 (Rows):</label>
          <input type="number" v-model="tableDialog.rows" min="1" class="process-title-input" style="width: 80px; text-align: center;"/>
        </div>
        <div class="form-group">
          <label>行數 (Columns):</label>
          <input type="number" v-model="tableDialog.cols" min="1" class="process-title-input" style="width: 80px; text-align: center;"/>
        </div>
        <div class="modal-actions">
          <button @click="cancelTableDialog" class="btn-cancel">取消</button>
          <button @click="confirmTableDialog" class="btn-confirm">確定</button>
        </div>
      </div>
    </div>

    <div v-for="(blockItem, blockIndex) in localBlockContents" :key="blockItem.id" class="block-item-wrapper" :class="{'child-block-container': blockIndex > 0}">
      <div class="block-header">
        <label>{{ props.step }}.{{ props.tier }}{{ blockIndex > 0 ? '.' + blockIndex : '' }}</label>
        
        <EditorContent :editor="titleEditor[blockIndex]" class="title-editor-content" />
        
        <div v-if="props.allowColor" class="menu color">
          <div class="font-color blue" @click="setGenericColor('blue')"></div>
          <div class="font-color black" @click="setGenericColor(null)"></div>
        </div>

        <div :class="`menu content-type-option-${props.step}-${props.tier}-${blockIndex}`">
          <label><input type="radio" v-model="blockItem.content_type" :value=0 @change="radioInputChange(blockIndex)">無</label>
          <label><input type="radio" v-model="blockItem.content_type" :value=1 @change="radioInputChange(blockIndex)">文字框 or 圖</label>
          <label><input type="radio" v-model="blockItem.content_type" :value=2 @change="radioInputChange(blockIndex)">表格</label>
          <label v-if="props.documentMode"><input type="radio" v-model="blockItem.content_type" :value=3 @change="radioInputChange(blockIndex)">插入文件</label>
        </div>

        <div class="action-buttons">
          <button v-if="blockIndex === 0" @click="emitAddBlock">新增同層</button>
          <button @click="addSmallBlock">{{ (blockIndex) === 0 ? "新增下一層" : "新增同層" }}</button>
          <button @click="(blockIndex === 0) ? emitDelete() : removeSmallBlock(blockIndex)">刪除</button> 
        </div>
      </div>

      <div class="editor-body">
        <div class="menu-bar" v-if="blockItem.content_type !== 0 && blockItem.content_type !== 3">
          <template v-if="blockItem.content_type === 2">
            <button @click="addRow(blockIndex)" class="menu-btn" title="表格：新增列">新增列</button>
            <button @click="addColumn(blockIndex)" class="menu-btn" title="表格：新增行">新增行</button>
            <button @click="deleteRow(blockIndex)" class="menu-btn" :disabled="!canDeleteRow(blockIndex)" title="表格：刪除列">刪除列</button>
            <button @click="deleteColumn(blockIndex)" class="menu-btn" :disabled="!canDeleteColumn(blockIndex)" title="表格：刪除行">刪除行</button>
            <button @click="mergeCells(blockIndex)" class="menu-btn" :disabled="!canMergeOrSplit(blockIndex)" title="表格：合併儲存格">合併儲存格</button>
            <button @click="unmergeCells(blockIndex)" class="menu-btn" :disabled="!canMergeOrSplit(blockIndex)" title="表格：解除合併">取消合併</button>

            <span style="border-right: 1px solid #ccc; margin: 0 5px;"></span>
          </template>

          <input type="file" :ref="el => fileInputRefs[blockItem.id] = el" @change="handleImageUpload($event, blockIndex)" accept="image/*" style="display: none;">
          <button @click="triggerFileInput(blockItem.id)" class="menu-btn" title="插入圖片">插入圖片</button>
        </div>
        
        <EditorContent v-if="blockItem.content_type === 2" :editor="tableEditor[blockIndex]" class="editor-content" />

        <div v-if="blockItem.content_type === 2" class="explain-label">💡 表格說明 (Explain)：</div>
        <EditorContent v-if="blockItem.content_type === 1 || blockItem.content_type === 2" :editor="contentEditor[blockIndex]" class="editor-content" />

        <div v-if="blockItem.content_type == 1 && blockItem.files?.length > 0" class="files-block">
          <ul class="preview-grid">
            <li v-for="(fileItem, index) in blockItem.files" :key="index" class="preview-item">
              <img :src="imgUrl(fileItem.path_to_save)" alt="圖片預覽" class="preview-thumbnail">
              <button @click="removeFile(blockIndex, index)" class="remove-btn">X</button>
              <div class="file-info">
                <span>{{ fileItem.name }}</span> 
                <span>({{ (fileItem.size / 1024 / 1024).toFixed(2) }} MB)</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { EditorContent, Editor } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Image } from '@tiptap/extension-image'
import { Focus } from '@tiptap/extensions'
import { History } from '@tiptap/extension-history'
import { range, getText, parseExcelClipboard, handleCopy, handlePaste, handleTextPaste, handleMousedown } from '@/utils/tiptapTableUtils.js'
const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
const STATIC_BASE_URL = import.meta.env.VITE_APP_STATIC_BASE_URL || '';

// ==========================================
// 1. Emit and props Function
// ==========================================
const props = defineProps({
  step: { type: Number, required: true },
  tier: { type: Number, required: true },
  blockContent: { type: Array, required: true },  // [{content_type, header_text, header_json, content_text, content_json, table_text, table_json, files:[]}, ...]
  allowColor: { type: Boolean, default: true },
  documentMode: { type: Boolean, default: false }
})
const emit = defineEmits(['add-block', 'update-block', 'delete-block', 'open-doc-search', 'invalid-check']);

// ==========================================
// 2. Editor Declare & Tiptap Extension Presets & Helper Function
// ==========================================
let uuid = 0;
const titleEditor = reactive([]);
const contentEditor = reactive([]);
const tableEditor = reactive([]);
const localBlockContents = reactive([]);

const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })];
const titleExt = [Document.extend({ content: 'paragraph' }), ...baseExt, Placeholder.configure({ placeholder: '請輸入標題' })];
const textExt  = [Document, ...baseExt, History, Placeholder.configure({ placeholder: '請輸入文字內容' }), Image.configure({ inline: true, allowBase64: true })];
const tableExt = [Document.extend({ content: 'table' }), ...baseExt, History, Focus.configure({ className: 'has-focus', mode: 'all' }), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Image.configure({ inline: true, allowBase64: true })];

const ExtMappingTable = { "title": titleExt, "content": textExt, "table": tableExt };
const updateFuncMappingTable = { "title": "header", "content": "content", "table": "table" };

const deepClone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
const imgUrl = p => (p ? `${STATIC_BASE_URL}/uploads/${p}` : '');

const initialDoc = (content = "") => ({ type: 'doc', content: [{ type: 'paragraph' }] })
const initialTableDoc = (rows = 3, cols = 4) => ({
  type: 'doc',
  content: [{
    type: 'table',
    content: Array.from({ length: rows }, (_, r) => ({
      type: 'tableRow',
      content: Array.from({ length: cols }, () => ({
        type: r === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph' }],
      })),
    })),
  }],
})

const activeEditor = ref(null);
const fileInputRefs = ref({});

// ==========================================
// 3. Dialog Declare and Button Trigger Function
// ==========================================
const tableDialog = reactive({ show: false, rows: 3, cols: 4, blockIndex: null });
const confirmTableDialog = () => {
  let r = parseInt(tableDialog.rows);
  let c = parseInt(tableDialog.cols);
  if (isNaN(r) || r < 1) r = 3;
  if (isNaN(c) || c < 1) c = 4;
  
  nextTick(() => initBlockEditor(tableDialog.blockIndex));
  tableDialog.show = false;
  scheduleEmitUpdate();
};
const cancelTableDialog = () => {
  // 取消的話，把 radio 退回「無」
  localBlockContents[tableDialog.blockIndex].content_type = 0;
  tableDialog.show = false;
};

// ==========================================
// 4. Editor Tools Function
// ==========================================
const setActiveEditor = ed => (activeEditor.value = ed);
const setGenericColor = color => activeEditor.value?.chain().focus().setColor(color || '#000').run();

const canMergeOrSplit = blockIndex => tableEditor[blockIndex]?.can().mergeCells() || tableEditor[blockIndex]?.can().splitCell();
const canDeleteRow = blockIndex => tableEditor[blockIndex]?.can().deleteRow();
const canDeleteColumn = blockIndex => tableEditor[blockIndex]?.can().deleteColumn();

const addRow = blockIndex => tableEditor[blockIndex]?.chain().focus().addRowAfter().run();
const addColumn = blockIndex => tableEditor[blockIndex]?.chain().focus().addColumnAfter().run();
const deleteRow = blockIndex => tableEditor[blockIndex]?.chain().focus().deleteRow().run();
const deleteColumn = blockIndex => tableEditor[blockIndex]?.chain().focus().deleteColumn().run();
const mergeCells = blockIndex => tableEditor[blockIndex]?.chain().focus().mergeCells().run();
const unmergeCells = blockIndex => tableEditor[blockIndex]?.chain().focus().splitCell().run();

const createEditor = (blockItem, contentType, content) => {
  const defaultContent = (contentType == "table") ? initialTableDoc(tableDialog.rows, tableDialog.cols) : initialDoc();
  const data = deepClone(content || defaultContent);

  let specificEditorProps = { attributes: { class: 'editor-content' } };
  if (contentType == 'content') specificEditorProps = { ...specificEditorProps, handlePaste: (view, event) => handleTextPaste(view, event) };
  else if (contentType == 'table') specificEditorProps = { ...specificEditorProps, handleDOMEvents: { drop: () => true, dragstart: () => true, copy: handleCopy, paste: handlePaste, mousedown: handleMousedown } };

  const ed = new Editor({
    content: deepClone(data),
    extensions: ExtMappingTable[contentType],
    editorProps: specificEditorProps,
    onFocus: ({ editor }) => setActiveEditor(editor), 
    onUpdate: ({ editor }) => { 
      blockItem[`${updateFuncMappingTable[contentType]}_json`] = editor.getJSON();
      if (contentType != 'table') {
        const text = editor.getText();
        blockItem[`${updateFuncMappingTable[contentType]}_text`] = (text.length > 0) ? text : null;
      }
      scheduleEmitUpdate();
    },
  });
  return ed;
}
const initTitleEditor = (blockIndex) => {
  titleEditor[blockIndex] = createEditor(localBlockContents[blockIndex], 'title', localBlockContents[blockIndex].header_json);
  if (localBlockContents[blockIndex].content_type === 3) titleEditor[blockIndex].setEditable(false);
}
const initBlockEditor = (blockIndex, force = false) => {
  let blockItem = localBlockContents[blockIndex];
  if ((force || !blockItem.content_json) && (blockItem.content_type === 1 || blockItem.content_type === 2)) {  // Create content editor
    contentEditor[blockIndex] = createEditor(blockItem, 'content', blockItem.content_json);
    blockItem.content_json = contentEditor[blockIndex].getJSON();
  }
  if ((force || !blockItem.table_json) && blockItem.content_type == 2) {  // Create table editor
    tableEditor[blockIndex] = createEditor(blockItem, 'table', blockItem.table_json);
    blockItem.table_json = tableEditor[blockIndex].getJSON();
  }
}

const resetAllEditor = () => {
  titleEditor.forEach(editor => editor?.destroy?.());
  contentEditor.forEach(editor => editor?.destroy?.());
  tableEditor.forEach(editor => editor?.destroy?.());
  titleEditor.length = 0;
  contentEditor.length = 0;
  tableEditor.length = 0;
}
// Load data from parent component (can use props.blockContent)
const loadBlockEditor = async () => {
  resetAllEditor();
  const source = deepClone(props.blockContent || []);
  
  localBlockContents.splice(0, localBlockContents.length, ...source);

  await nextTick();

  localBlockContents.forEach((blk, blkIndex) => {
    blk.id = ++uuid;
    initTitleEditor(blkIndex);
    if (blk.content_type == 1 || blk.content_type == 2) initBlockEditor(blkIndex, true);
  })
}
const hasContentInNode = (node) => {
  if (!node) return false;
  if (node.type === 'text' && node.text.trim()) return true;
  if (node.type === 'image') return true;
  if (Array.isArray(node.content)) { return node.content.some(child => hasContentInNode(child)); }
  
  return false;
};
const validationState = computed(() => {
  const messages = [];
  localBlockContents.forEach((blkInfo, subIndex) => {
    const prefix = `${props.step}.${props.tier}${subIndex > 0 ? '.' + subIndex : ''}`;
    if (!blkInfo.header_text || blkInfo.header_text.trim() === '') messages.push(`${prefix} 尚未填寫標題`);
    
    // 檢查內容 (如果是 option 1)
    if (blkInfo.content_type === 1) {
      const hasText = blkInfo.content_text && blkInfo.content_text.trim() !== '';
      const hasFiles = blkInfo.files && blkInfo.files.length > 0;
      if (!hasText && !hasFiles) messages.push(`${prefix} 尚未填寫內容或上傳圖片`);
    }
    
    // 如果是 option 2 (表格)，你可以依照需求加入更細的驗證
    if (blkInfo.content_type === 2) { 
      const tables = blkInfo.table_json.content.filter(n => n.type === 'table');
      const rows = tables[0].content || [];
      
      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r].content || [];
        
        // 檢查該列的每一個 cell，看有沒有任何內容 (利用剛剛寫的遞迴函式)
        const rowHasContent = cells.some(cell => hasContentInNode(cell));

        // 只要有一列「完全為空」，就寫入錯誤訊息並跳出該表格的檢查
        if (!rowHasContent) {
          messages.push(`${prefix} 表格有未填寫的列 (第 ${r + 1} 列不得全空)`);
          break; 
        }
      }
    }
  });
  return { isValid: messages.length === 0, message: messages };
});

// ==========================================
// 5. Block Button Function
// ==========================================
const addSmallBlock = () => {
  titleEditor.push(null);
  contentEditor.push(null);
  tableEditor.push(null);
  localBlockContents.push({ id: ++uuid, content_type: 0, files: [], header_text: null, header_json: null, content_text: null, content_json: null, table_text: null, table_json: null, metadata: {} });
  initTitleEditor(localBlockContents.length - 1);
  scheduleEmitUpdate();
}
const removeSmallBlock = (blockIndex) => {
  if (!confirm('確定要刪除此子區塊?')) return;

  titleEditor[blockIndex]?.destroy?.();
  contentEditor[blockIndex]?.destroy?.();
  tableEditor[blockIndex]?.destroy?.();

  titleEditor.splice(blockIndex, 1);
  contentEditor.splice(blockIndex, 1);
  tableEditor.splice(blockIndex, 1);

  localBlockContents.splice(blockIndex, 1);
  scheduleEmitUpdate();
}
const radioInputChange = (blockIndex) => {
  const opt = localBlockContents[blockIndex].content_type;

  if (opt === 3) {
    emit('open-doc-search');
    
    // When switch mode 3, then clear all editors in the block
    contentEditor[blockIndex]?.destroy?.();
    contentEditor[blockIndex] = null;
    localBlockContents[blockIndex].content_json = null;
    localBlockContents[blockIndex].content_text = null;

    tableEditor[blockIndex]?.destroy?.();
    tableEditor[blockIndex] = null;
    localBlockContents[blockIndex].table_json = null;
    localBlockContents[blockIndex].table_text = null;

    localBlockContents[blockIndex].files = [];
    titleEditor[blockIndex]?.setEditable(false); // 標題鎖定為唯讀
    
    scheduleEmitUpdate();
    return;
  }

  // Switch normal mode, then enable edit
  titleEditor[blockIndex]?.setEditable(true);

  if (opt != 2) {  // Remove table editor
    tableEditor[blockIndex] = null;
    localBlockContents[blockIndex].table_json = null;
  }

  if (opt == 0) {  // Remove content editor
    contentEditor[blockIndex] = null;
    localBlockContents[blockIndex].content_json = null;
  }

  // Remove all pictures
  console.log(" -- radioi input change");
  if (opt !== 1) localBlockContents[blockIndex].files.length = 0;

  if (opt === 2) {  // Open window let user set up table size
    tableDialog.blockIndex = blockIndex;
    tableDialog.show = true;
    return; // 👈 這裡很重要，return 掉，等使用者按確定再初始化 Editor
  }
  nextTick(() => initBlockEditor(blockIndex));
}
const emitAddBlock = () => emit('add-block');
const emitDelete = () => { if(confirm('確定要刪除此區塊?')) emit('delete-block'); }

let emitTimer = null;
const scheduleEmitUpdate = () => {
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => { emit('update-block', deepClone(localBlockContents)), emit('invalid-check', validationState.value); }, 500);
}
// ==========================================
// 6. Upload / Remove Image Function
// ==========================================
const triggerFileInput = id => { fileInputRefs.value[id].click(); }
const removeFile = (blockIndex, picIdx) => {
  localBlockContents[blockIndex].files.splice(picIdx, 1);
  scheduleEmitUpdate();
}
const handleImageUpload = async (evt, blockIndex) => {
  const file = evt.target.files?.[0];
  if (!file) return;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE_URL}/uploads/image`, { method: 'POST', body: fd });
    const result = await res.json();
    if (!result.success) throw new Error(result.message || 'upload failed');

    if (localBlockContents[blockIndex].content_type === 1) {
      localBlockContents[blockIndex].files.push({ name: file.name, size: file.size, path_to_save: result.path_to_save });
    } else if (localBlockContents[blockIndex].content_type === 2) {
      tableEditor[blockIndex].chain().focus().setImage({ src: API_BASE_URL + result.url }).run();
    }
    scheduleEmitUpdate();
  } catch (e) {
    console.error('上傳錯誤:', e);
    alert('圖片上傳失敗');
  } finally {
    evt.target.value = '';
  }
}
// ==========================================
// 7. Initialize & Destructor Function
// ==========================================
onMounted(() => { loadBlockEditor(); emit('invalid-check', validationState.value); })
onBeforeUnmount(() => { resetAllEditor(); })
defineExpose({ loadBlockEditor })
</script>

<style scoped>
/* 將您原本的樣式保持不變，並新增以下 wrapper 樣式 */
.block-item-wrapper { padding: 15px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9; }
.child-block-container { margin-left: 20px;  border: 1px dashed #aaa;  background-color: #fff; padding: 10px; margin-top: 15px; }
.block-header { display: flex; align-items: center; gap: 15px;  margin-bottom: 15px; }

/* 確保標題輸入框在子區塊中正確顯示 */
.process-title-input { flex-grow: 1;  padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 1em; }

/* 標籤樣式 */
.block-header label { font-weight: bold; font-size: 1.2em; color: #333; flex-shrink: 0; }

/* 確保標題編輯器可以正確 flex 伸展 */
.title-editor-content { flex-grow: 1;  background-color: #fff;  padding: 0px;  border: 1px solid #ddd;  border-radius: 4px;  }
.title-editor-content :deep(.ProseMirror) { padding: 10px; outline: none; }
.title-editor-content :deep(.ProseMirror p) { margin: 0px; font-size: 1em; }


/* 動作按鈕樣式 */
.action-buttons { display: flex; gap: 10px; flex-shrink: 0; }
.action-buttons button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  font-size: 0.9em;
  transition: background-color 0.2s ease;
}
.action-buttons button:hover { background-color: #0056b3; }


/* 顏色選單樣式 */
.menu.color { display: flex; align-items: center; margin: 0px 12px; flex-shrink: 0; }
.font-color { width: 20px; height: 20px; border-radius: 50%; margin: 0px 4px; cursor: pointer; border: 1px solid #ccc; }
.font-color.red { background-color: red; }
.font-color.blue { background-color: blue; }
.font-color.black { background-color: black; }


/* Radio 選項樣式 */
.menu[class^="content-type-option"] { display: flex; gap: 10px; flex-shrink: 0; }


/* 編輯器主體樣式 */
.editor-body { background-color: #f0f0f0; border: 1px solid #eee; padding: 10px; border-radius: 4px; }
.editor-content { border: 1px solid #ddd;  padding: 0px;  min-height: 80px;  line-height: 1.5;  background-color: white; }
.editor-content :deep(.ProseMirror) { padding: 10px; outline: none; line-height: 1.5; }
.editor-content :deep(p) { margin: 0px; }


/* TipTap Table 樣式 */
.editor-content :deep(table) { border-collapse: collapse; width: 100%; margin: 10px 0px; table-layout: fixed; }
.editor-content :deep(th) { position:sticky; top:35px; z-index:5; background-color: #ffffff; }
.editor-content :deep(th), .editor-content :deep(td) { border: 1px solid #ccc; padding: 8px; text-align: center; vertical-align: middle; }
.editor-content :deep(img) { max-width: 100%; height: auto; display: block; margin: 5px auto; cursor: pointer; border: 2px solid transparent; }
.editor-content :deep(img) { max-width: 100%; height: auto; display: block; margin: 5px 0; cursor: pointer; border: 2px solid transparent; }


/* TipTap Placeholder & Selection 樣式 (沿用您原本的樣式) */
.editor-content :deep(.ProseMirror) p.is-editor-empty::before { content: attr(data-placeholder); float: left; color: #adb5bd; height: 0; }
.editor-content :deep(.ProseMirror-focused td.selectedCell),
.editor-content :deep(.ProseMirror-focused th.selectedCell) { border: 2px solid #ccc; background-color: #cce7ff; box-shadow: 0 0 0 3px #4a90e2 inset; border-color: transparent; opacity: 1; }
.editor-content :deep(th.has-focus), .editor-content :deep(td.has-focus) { background-color:#fff7cc; box-shadow: inset 0 0 0 2px #ff9800; }

/* 工具列樣式 */
.menu-bar { margin-bottom: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; background-color: #f0f8ff; }
.menu-btn { padding: 5px 10px; border: 1px solid #007bff; background-color: white; color: #007bff; cursor: pointer; border-radius: 3px; }
.menu-btn:hover:not(:disabled) { background-color: #007bff; color: white; }
.menu-btn:disabled { cursor: not-allowed; opacity: 0.5; }

.image-block{ display: flex; justify-content: center; width: 100%; height: auto; gap: 10px; }
.preview-grid {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* 自動填充，最小100px寬 */
    gap: 15px; /* 項目間距 */
    max-height: 250px; /* 設定最大高度並允許滾動 */
    overflow-y: auto;
    border: 1px solid #f0f0f0;
    border-radius: 5px;
    background-color: #fff;
    padding: 10px;
}

.preview-item {
  position: relative;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  padding: 5px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  align-items: center;
  text-align: center;
}

.preview-thumbnail {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 5px;
}

.remove-btn {
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
}

/* ✅ 新增的彈窗樣式 */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; justify-content: center; align-items: center; }
.modal-content { background: white; padding: 20px 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 300px; }

.form-group { margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.btn-cancel { background: #f5f5f5; border: 1px solid #ddd; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-confirm { background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-confirm:hover { background: #0056b3; }

.remove-btn:hover { background-color: #c82333; transform: scale(1.1); }
</style>