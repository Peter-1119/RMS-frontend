<template>
  <div class="node-wrapper" :class="{ 'is-child': depth > ROOT_DEPTH }">
    <!-- 插入表格尺寸彈窗 -->
    <div v-if="tableDialog.show" class="modal-overlay">
      <div class="modal-content">
        <h3 style="margin-top: 0;">插入表格</h3>
        <div class="form-group">
          <label>列數 (Rows):</label>
          <input type="number" v-model="tableDialog.rows" min="1" style="width: 80px; text-align: center;" />
        </div>
        <div class="form-group">
          <label>行數 (Columns):</label>
          <input type="number" v-model="tableDialog.cols" min="1" style="width: 80px; text-align: center;" />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="cancelTableDialog">取消</button>
          <button class="btn-confirm" @click="confirmTableDialog">確定</button>
        </div>
      </div>
    </div>

    <div class="node-header">
      <label class="node-label">{{ label }}</label>

      <EditorContent :editor="titleEditor" class="title-editor-content" />

      <div v-if="allowColor" class="menu color">
        <div class="font-color blue" @click="applyColor('blue')"></div>
        <div class="font-color black" @click="applyColor(null)"></div>
      </div>

      <div class="menu content-type-option">
        <label><input type="radio" v-model="node.content_type" :value="0" @change="onTypeChange">無</label>
        <label><input type="radio" v-model="node.content_type" :value="1" @change="onTypeChange">文字框 or 圖</label>
        <label><input type="radio" v-model="node.content_type" :value="2" @change="onTypeChange">表格</label>
        <label v-if="documentMode"><input type="radio" v-model="node.content_type" :value="3" @change="onTypeChange">插入文件</label>
      </div>

      <div class="action-buttons">
        <button @click="addSibling">新增同層</button>
        <button v-if="canAddChild(depth)" @click="addChild">新增子層</button>
        <button class="danger" @click="remove">刪除</button>
      </div>
    </div>

    <div class="editor-body" v-if="node.content_type !== 0">
      <div class="menu-bar" v-if="node.content_type === 1 || node.content_type === 2">
        <template v-if="node.content_type === 2">
          <button class="menu-btn" title="表格：新增列" @click="tableCmd('addRowAfter')">新增列</button>
          <button class="menu-btn" title="表格：新增行" @click="tableCmd('addColumnAfter')">新增行</button>
          <button class="menu-btn" title="表格：刪除列" :disabled="!can('deleteRow')" @click="tableCmd('deleteRow')">刪除列</button>
          <button class="menu-btn" title="表格：刪除行" :disabled="!can('deleteColumn')" @click="tableCmd('deleteColumn')">刪除行</button>
          <button class="menu-btn" title="表格：合併儲存格" :disabled="!canMergeOrSplit" @click="tableCmd('mergeCells')">合併儲存格</button>
          <button class="menu-btn" title="表格：解除合併" :disabled="!canMergeOrSplit" @click="tableCmd('splitCell')">取消合併</button>
          <span style="border-right: 1px solid #ccc; margin: 0 5px;"></span>
        </template>

        <input type="file" ref="fileInput" @change="handleImageUpload" accept="image/*" style="display: none;" />
        <button class="menu-btn" title="插入圖片" @click="triggerFileInput">插入圖片</button>
      </div>

      <EditorContent v-if="node.content_type === 2" :editor="tableEditor" class="editor-content" />

      <div v-if="node.content_type === 2" class="explain-label">💡 表格說明 (Explain)：</div>
      <EditorContent v-if="node.content_type === 1 || node.content_type === 2" :editor="contentEditor" class="editor-content" />

      <div v-if="node.content_type === 1 && node.files?.length" class="files-block">
        <ul class="preview-grid">
          <li v-for="(fileItem, i) in node.files" :key="i" class="preview-item">
            <img :src="imgUrl(fileItem.path_to_save)" alt="圖片預覽" class="preview-thumbnail" />
            <button class="remove-btn" @click="removeFile(i)">X</button>
            <div class="file-info">
              <span>{{ fileItem.name }}</span>
              <span>({{ (fileItem.size / 1024 / 1024).toFixed(2) }} MB)</span>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- 遞迴：子層 -->
    <div v-if="node.children && node.children.length" class="children">
      <DynamicEditorNode
        v-for="(child, ci) in node.children"
        :key="child.client_id"
        :node="child"
        :chapter="chapter"
        :depth="depth + 1"
        :path-indices="[...pathIndices, ci + 1]"
        :siblings="node.children"
        :index="ci"
        :allow-color="allowColor"
        :document-mode="documentMode"
        @open-doc-search="$emit('open-doc-search', $event)"
        @changed="$emit('changed')"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, inject } from 'vue';
import { EditorContent, Editor } from '@tiptap/vue-3';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Image } from '@tiptap/extension-image';
import { Focus } from '@tiptap/extensions';
import { History } from '@tiptap/extension-history';
import { handleCopy, handlePaste, handleTextPaste, handleMousedown } from '@/utils/tiptapTableUtils.js';
import { formatNodeLabel } from '@/utils/blockNumbering.js';
import { makeNode, canAddChild, ROOT_DEPTH } from '@/utils/blockTree.js';

defineOptions({ name: 'DynamicEditorNode' });

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
const STATIC_BASE_URL = import.meta.env.VITE_APP_STATIC_BASE_URL || '';

const props = defineProps({
  node: { type: Object, required: true },          // 反應式節點，直接 by-ref 修改
  chapter: { type: Number, required: true },        // L1 章節號
  depth: { type: Number, required: true },          // 2..8
  pathIndices: { type: Array, required: true },     // L2..本層 1-based
  siblings: { type: Array, required: true },        // 本節點所在陣列
  index: { type: Number, required: true },          // 本節點在 siblings 的位置
  allowColor: { type: Boolean, default: true },
  documentMode: { type: Boolean, default: false },
});
const emit = defineEmits(['open-doc-search', 'changed']);

// 由容器 DynamicEditorTree 注入：追蹤目前焦點編輯器 + 套色
const editorCtx = inject('blockEditorCtx', { setActive: () => {}, applyColor: () => {} });
const applyColor = (c) => editorCtx.applyColor(c);

const label = computed(() => formatNodeLabel(props.chapter, props.depth, props.pathIndices));

// ---------- 編輯器（本節點自有，單一實例） ----------
const titleEditor = ref(null);
const contentEditor = ref(null);
const tableEditor = ref(null);
const fileInput = ref(null);

const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })];
const titleExt = [Document.extend({ content: 'paragraph' }), ...baseExt, Placeholder.configure({ placeholder: '請輸入標題' })];
const textExt = [Document, ...baseExt, History, Placeholder.configure({ placeholder: '請輸入文字內容' }), Image.configure({ inline: true, allowBase64: true })];
const tableExt = [Document.extend({ content: 'table' }), ...baseExt, History, Focus.configure({ className: 'has-focus', mode: 'all' }), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Image.configure({ inline: true, allowBase64: true })];

const deepClone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const imgUrl = (p) => (p ? `${STATIC_BASE_URL}/uploads/${p}` : '');

const initialDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] });
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
});

// kind: 'title' | 'content' | 'table' → node 欄位字首
const FIELD = { title: 'header', content: 'content', table: 'table' };
const EXT = { title: titleExt, content: textExt, table: tableExt };

function buildEditor(kind, json, fallback) {
  const content = deepClone(json || fallback);
  let editorProps = { attributes: { class: kind === 'title' ? 'title-editor-content' : 'editor-content' } };
  if (kind === 'content') {
    editorProps = { ...editorProps, handlePaste: (view, event) => handleTextPaste(view, event) };
  } else if (kind === 'table') {
    editorProps = { ...editorProps, handleDOMEvents: { drop: () => true, dragstart: () => true, copy: handleCopy, paste: handlePaste, mousedown: handleMousedown } };
  }
  return new Editor({
    content,
    extensions: EXT[kind],
    editorProps,
    onFocus: ({ editor }) => editorCtx.setActive(editor),
    onUpdate: ({ editor }) => {
      const f = FIELD[kind];
      props.node[`${f}_json`] = editor.getJSON();
      if (kind !== 'table') {
        const text = editor.getText();
        props.node[`${f}_text`] = text.length > 0 ? text : null;
      }
      emit('changed');
    },
  });
}

function destroyEditor(refObj) {
  refObj.value?.destroy?.();
  refObj.value = null;
}

function initTitle() {
  titleEditor.value = buildEditor('title', props.node.header_json, initialDoc());
  if (props.node.content_type === 3) titleEditor.value.setEditable(false);
  if (!props.node.header_json) props.node.header_json = titleEditor.value.getJSON();
  // 從載入的 header_json 同步純文字鏡像；舊/遷移資料可能只有 _json 沒有 _text，否則驗證會誤判「尚未填寫標題」
  const t = titleEditor.value.getText();
  props.node.header_text = (t && t.trim()) ? t : null;
}

function initContent(force = false) {
  if (force || !contentEditor.value) {
    destroyEditor(contentEditor);
    contentEditor.value = buildEditor('content', props.node.content_json, initialDoc());
    if (!props.node.content_json) props.node.content_json = contentEditor.value.getJSON();
    // 同上：同步 content 的純文字鏡像，避免誤判「尚未填寫內容」
    const t = contentEditor.value.getText();
    props.node.content_text = (t && t.trim()) ? t : null;
  }
}

function initTable(rows = 3, cols = 4, force = false) {
  if (force || !tableEditor.value) {
    destroyEditor(tableEditor);
    tableEditor.value = buildEditor('table', props.node.table_json, initialTableDoc(rows, cols));
    if (!props.node.table_json) props.node.table_json = tableEditor.value.getJSON();
  }
}

// ---------- content_type 切換 ----------
const tableDialog = reactive({ show: false, rows: 3, cols: 4 });

function onTypeChange() {
  const opt = props.node.content_type;

  if (opt === 3) {
    // 插入文件：唯讀標題、清空內容。帶上 siblings/index，讓父層能把多檔插在同層
    emit('open-doc-search', { node: props.node, siblings: props.siblings, index: props.index });
    destroyEditor(contentEditor);
    destroyEditor(tableEditor);
    props.node.content_json = null;
    props.node.content_text = null;
    props.node.table_json = null;
    props.node.table_text = null;
    props.node.files = [];
    titleEditor.value?.setEditable(false);
    emit('changed');
    return;
  }

  titleEditor.value?.setEditable(true);

  if (opt !== 2) { destroyEditor(tableEditor); props.node.table_json = null; props.node.table_text = null; }
  if (opt === 0) { destroyEditor(contentEditor); props.node.content_json = null; props.node.content_text = null; }
  if (opt !== 1) { if (Array.isArray(props.node.files)) props.node.files.length = 0; }

  if (opt === 2) { tableDialog.show = true; return; } // 等使用者設定尺寸

  nextTick(() => { if (opt === 1) initContent(true); });
  emit('changed');
}

function confirmTableDialog() {
  let r = parseInt(tableDialog.rows, 10);
  let c = parseInt(tableDialog.cols, 10);
  if (isNaN(r) || r < 1) r = 3;
  if (isNaN(c) || c < 1) c = 4;
  props.node.table_json = null; // 用新尺寸重建
  nextTick(() => {
    initTable(r, c, true);
    initContent(true); // ct=2 的「表格說明」用 content 編輯器
    emit('changed');
  });
  tableDialog.show = false;
}
function cancelTableDialog() {
  props.node.content_type = 0;
  tableDialog.show = false;
}

// ---------- 表格工具列 ----------
const tableCmd = (cmd) => tableEditor.value?.chain().focus()[cmd]().run();
const can = (cmd) => !!tableEditor.value?.can()[cmd]?.();
const canMergeOrSplit = computed(() => !!(tableEditor.value?.can().mergeCells() || tableEditor.value?.can().splitCell()));

// ---------- 圖片 ----------
const triggerFileInput = () => fileInput.value?.click();
function removeFile(i) {
  props.node.files.splice(i, 1);
  emit('changed');
}
async function handleImageUpload(evt) {
  const file = evt.target.files?.[0];
  if (!file) return;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE_URL}/uploads/image`, { method: 'POST', body: fd });
    const result = await res.json();
    if (!result.success) throw new Error(result.message || 'upload failed');
    if (props.node.content_type === 1) {
      props.node.files.push({ name: file.name, size: file.size, path_to_save: result.path_to_save });
    } else if (props.node.content_type === 2) {
      tableEditor.value?.chain().focus().setImage({ src: API_BASE_URL + result.url }).run();
    }
    emit('changed');
  } catch (e) {
    console.error('上傳錯誤:', e);
    alert('圖片上傳失敗');
  } finally {
    evt.target.value = '';
  }
}

// ---------- 結構操作 ----------
function addSibling() {
  props.siblings.splice(props.index + 1, 0, makeNode());
  emit('changed');
}
function addChild() {
  if (!canAddChild(props.depth)) return;
  props.node.children.push(makeNode());
  emit('changed');
}
function remove() {
  if (!confirm(`確定要刪除「${label.value}」及其子層?`)) return;
  props.siblings.splice(props.index, 1);
  emit('changed');
}

// ---------- 生命週期 ----------
onMounted(() => {
  initTitle();
  if (props.node.content_type === 1) initContent(true);
  if (props.node.content_type === 2) { initTable(3, 4, true); initContent(true); }
});
onBeforeUnmount(() => {
  destroyEditor(titleEditor);
  destroyEditor(contentEditor);
  destroyEditor(tableEditor);
});
</script>

<style scoped>
.node-wrapper { padding: 15px; margin-bottom: 16px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9; }
.node-wrapper.is-child { margin-left: 24px; border: 1px dashed #aaa; background-color: #fff; padding: 12px; margin-top: 12px; }

.node-header { display: flex; align-items: center; gap: 15px; margin-bottom: 12px; }
.node-label { font-weight: bold; font-size: 1.1em; color: #023b64; flex-shrink: 0; min-width: 52px; }

.title-editor-content { flex-grow: 1; background-color: #fff; border: 1px solid #ddd; border-radius: 4px; }
.title-editor-content :deep(.ProseMirror) { padding: 10px; outline: none; }
.title-editor-content :deep(.ProseMirror p) { margin: 0; font-size: 1em; }

.action-buttons { display: flex; gap: 8px; flex-shrink: 0; }
.action-buttons button { padding: 7px 12px; border: none; border-radius: 4px; cursor: pointer; background-color: #007bff; color: #fff; font-size: 0.85em; }
.action-buttons button:hover { background-color: #0056b3; }
.action-buttons button.danger { background-color: #e15241; }
.action-buttons button.danger:hover { background-color: #d23c2a; }

.menu.color { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.font-color { width: 20px; height: 20px; border-radius: 50%; cursor: pointer; border: 1px solid #ccc; }
.font-color.blue { background-color: blue; }
.font-color.black { background-color: black; }

.content-type-option { display: flex; gap: 10px; flex-shrink: 0; font-size: 0.9em; }

.editor-body { background-color: #f0f0f0; border: 1px solid #eee; padding: 10px; border-radius: 4px; }
.editor-content { border: 1px solid #ddd; min-height: 80px; line-height: 1.5; background-color: #fff; }
.editor-content :deep(.ProseMirror) { padding: 10px; outline: none; line-height: 1.5; }
.editor-content :deep(p) { margin: 0; }
.editor-content :deep(table) { border-collapse: collapse; width: 100%; margin: 10px 0; table-layout: fixed; }
.editor-content :deep(th) { position: sticky; top: 35px; z-index: 5; background-color: #fff; }
.editor-content :deep(th), .editor-content :deep(td) { border: 1px solid #ccc; padding: 8px; text-align: center; vertical-align: middle; }
.editor-content :deep(img) { max-width: 100%; height: auto; display: block; margin: 5px 0; cursor: pointer; border: 2px solid transparent; }
.editor-content :deep(.ProseMirror) p.is-editor-empty::before { content: attr(data-placeholder); float: left; color: #adb5bd; height: 0; }
.editor-content :deep(.ProseMirror-focused td.selectedCell),
.editor-content :deep(.ProseMirror-focused th.selectedCell) { background-color: #cce7ff; box-shadow: 0 0 0 3px #4a90e2 inset; border-color: transparent; }
.editor-content :deep(th.has-focus), .editor-content :deep(td.has-focus) { background-color: #fff7cc; box-shadow: inset 0 0 0 2px #ff9800; }

.explain-label { font-size: 13px; color: #666; font-weight: bold; margin: 8px 0 6px; }

.menu-bar { margin-bottom: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; background-color: #f0f8ff; }
.menu-btn { padding: 5px 10px; border: 1px solid #007bff; background-color: #fff; color: #007bff; cursor: pointer; border-radius: 3px; }
.menu-btn:hover:not(:disabled) { background-color: #007bff; color: #fff; }
.menu-btn:disabled { cursor: not-allowed; opacity: 0.5; }

.preview-grid { list-style: none; padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 15px; max-height: 250px; overflow-y: auto; border: 1px solid #f0f0f0; border-radius: 5px; background-color: #fff; }
.preview-item { position: relative; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; padding: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; }
.preview-thumbnail { width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-bottom: 5px; }
.remove-btn { position: absolute; top: 0; right: 0; background-color: #dc3545; color: #fff; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; }
.remove-btn:hover { background-color: #c82333; transform: scale(1.1); }

.children { margin-top: 8px; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: center; align-items: center; }
.modal-content { background: #fff; padding: 20px 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 300px; }
.form-group { margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.btn-cancel { background: #f5f5f5; border: 1px solid #ddd; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-confirm { background: #007bff; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-confirm:hover { background: #0056b3; }
</style>
