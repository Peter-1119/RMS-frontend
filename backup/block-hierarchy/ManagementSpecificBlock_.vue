<template>
  <div class="combination-block">
    <div class="management-header-block">
      <label>{{ props.step }}.{{ props.tier }} 生產基本條件</label>
    </div>

    <div class="editor-wrapper">
      <div class="management-operation-block">
        <div v-if="props.allowColor" class="menu color">
          <div class="font-color blue" @click="contentEditor?.chain().focus().setColor('blue').run()"></div>
          <div class="font-color black" @click="contentEditor?.chain().focus().setColor('null').run()"></div>
        </div>
      </div>
      <div class="content-editor-wrapper"><EditorContent v-if="contentEditor" :editor="contentEditor" class="content-editor" /></div>
      <p v-if="!tableEditor" class="hint empty">選擇的機台無任何參數</p>

      <div v-else-if="tableEditor">
        <div class="management-operation-block">
          <div v-if="props.allowColor" class="menu color">
            <div class="font-color blue" @click="tableEditor?.chain().focus().setColor('blue').run()"></div>
            <div class="font-color black" @click="tableEditor?.chain().focus().setColor('null').run()"></div>
          </div>
        </div>
        <EditorContent :editor="tableEditor" class="table-editor management-tiptap-editor"/> <!-- 有 PMS 而且 editor 存在：顯示 Tiptap 表格 -->
      </div>
    </div>

  </div>
</template>

<script setup>
import { onMounted, onUnmounted, shallowRef } from 'vue'
import { EditorContent, Editor } from '@tiptap/vue-3'
import { Focus } from '@tiptap/extensions'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { History } from '@tiptap/extension-history'
import { CellSelection, selectedRect } from 'prosemirror-tables'
import { Placeholder } from '@tiptap/extension-placeholder'
import { getText, handleCopy, handlePaste as baseHandlePaste, handleMousedown, handleKeyDown, validateValueStatus } from '@/utils/tiptapTableUtils.js'

// ==========================================
// 1. Emit and props Function
// ==========================================
const emit = defineEmits(['update-block', 'invalid-check']);
const props = defineProps({
  step: { type: Number, required: true },
  tier: { type: Number, required: true },
  blockContent: { type: Object, required: true },
  allowColor: { type: Boolean, default: true },
})

// ==========================================
// 2. Editor Declare & Tiptap Extension Presets & Helper Function
// ==========================================
let contentEditor = shallowRef(null);
let tableEditor = shallowRef(null);
let validateTimer = null;
let dirtyRows = new Set();
const invalidRows = new Set();

const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })];

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      contenteditable: {
        default: true,
        parseHTML: el => el.getAttribute('contenteditable') !== 'false',
        renderHTML: attrs => ({ contenteditable: attrs.contenteditable ? 'true' : 'false' }),
      },
      // ⭐ 兇手在這裡！你漏掉了這段 class 的註冊
      class: {
        default: null,
        parseHTML: el => el.getAttribute('class'),
        renderHTML: attrs => (attrs.class ? { class: attrs.class } : {}),
      },
      cellType: { default: 'text' },
      checked: {
        default: false,
        parseHTML: el => el.getAttribute('data-checked') === 'true',
        renderHTML: attrs => (attrs.checked ? { 'data-checked': 'true' } : {})
      }
    }
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const td = document.createElement('td');
      if (node.attrs.class) td.className = node.attrs.class;

      if (node.attrs.cellType === 'checkbox') {
        td.classList.add('checkbox-cell-wrapper');

        const box = document.createElement('div');
        box.className = 'checkbox-cell';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!node.attrs.checked;
        input.addEventListener('change', () => {
          if (typeof getPos !== 'function') return;
          const pos = getPos();
          // 手動把所在列加入 dirtyRows，避免 markCurrentRowDirty 取到舊的 selection 而漏掉本列
          try {
            const rowIdx = editor.state.doc.resolve(pos).index(1);
            if (typeof rowIdx === 'number') dirtyRows.add(rowIdx);
          } catch (_) { /* 解析失敗就交給 markCurrentRowDirty fallback */ }
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, null, { ...node.attrs, checked: input.checked })
          );
        });
        box.appendChild(input);

        const hidden = document.createElement('div');
        hidden.style.cssText = 'height:0;overflow:hidden;';
        box.appendChild(hidden);

        td.appendChild(box);
        td.contentEditable = 'false';
        return { dom: td, contentDOM: hidden, stopEvent: e => e.target === input };
      }

      if (node.attrs.contenteditable === false) td.contentEditable = 'false';
      return { dom: td, contentDOM: td };
    };
  }
});
const CustomTableHeader = TableHeader.extend({ 
  addAttributes() { 
    return { 
      ...this.parent?.(), 
      contenteditable: { 
        default: false, // Header 預設全部鎖定
        parseHTML: el => el.getAttribute('contenteditable') !== 'false',
        renderHTML: attrs => ({ contenteditable: attrs.contenteditable ? 'true' : 'false' }),
      }
    }; 
  } 
});
const CustomTableRow = TableRow.extend({ content: '(tableCell | tableHeader)*', addAttributes() { return { ...this.parent?.(), class: { default: null } }; } });
const tableEditorExtensions = [Document.extend({ content: 'table' }), ...baseExt, Table, Focus.configure({ className: 'has-focus', mode: 'all' }), CustomTableRow, CustomTableHeader, CustomTableCell, History]
const textExt  = [Document, ...baseExt, History, Placeholder.configure({ placeholder: '請輸入文字內容' })];

const initialDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] });

// Prohibit certain columns to edit
const LOCKCOLS = [0, 1, 2];

// 與 ManufacturingParameterBlocks_.vue / ManufacturingConditionRuleBlocks_.vue 共用同一組 header 名稱
const CHECKBOX_HEADER_NAMES = ['定值項目'];
const NUMERIC_HEADER_NAMES = ['規格下限(OOS-)', '操作下限(OOC-)', '設定值', '操作上限(OOC+)', '規格上限(OOS+)'];
const findCheckboxColIndex = (headers) => headers.findIndex(h => CHECKBOX_HEADER_NAMES.includes(h));
const findNumericColIndices = (headers) => NUMERIC_HEADER_NAMES.map(name => headers.indexOf(name));

// 取得單一 cell 的「字串化」內容；checkbox 用符號保留狀態（避免 dup/export 變空）
const getCellSig = (cellNode) => {
  if (cellNode.attrs?.cellType === 'checkbox') return cellNode.attrs.checked ? '☑' : '☐';
  return getText(cellNode);
};

const initialTableDoc = (template) => {
  const headers = template[0] || [];
  const rowspans = Array(template.length).fill(1);
  let anchor = 1;

  for (let i = 2; i < template.length; i++) {
    if (template[i][1] === template[anchor][1] && template[i][1]) { rowspans[anchor]++; rowspans[i] = 0; }
    else { anchor = i; }
  }

  return {
    type: 'doc', content: [{
      type: 'table', content: template.map((row, rowIndex) => {
        const isHeader = rowIndex === 0;
        const type = isHeader ? "tableHeader" : "tableCell";
        const currentSpan = rowspans[rowIndex]; // 讀取剛剛算好的 span

        const cells = row.map((text, cellIndex) => {
          const isLastCell = cellIndex === row.length - 1;
          if (!isHeader && isLastCell && currentSpan === 0) return null;

          // 資料列遇到「定值項目」→ render 成 checkbox cell
          if (!isHeader && CHECKBOX_HEADER_NAMES.includes(headers[cellIndex])) {
            const checked = text === '1' || text === true || text === 'true';
            return {
              type: 'tableCell',
              attrs: { cellType: 'checkbox', checked, contenteditable: false },
              content: [{ type: 'paragraph' }]
            };
          }

          const attrs = { cellType: 'text', contenteditable: !LOCKCOLS.includes(cellIndex) && !isHeader };
          if (!isHeader && isLastCell && currentSpan > 1) { attrs.rowspan = currentSpan; }

          return { type, attrs, content: [{ type: 'paragraph', ...(text ? { content: [{ type: "text", text }] } : {}) }] };
        }).filter(Boolean);
        return { type: 'tableRow', content: cells };
      }),
    }],
  };
}

// ==========================================
// 3. Editor Trigger Function
// ==========================================
function markCurrentRowDirty(editor) {
  if (!editor) return;
  const { selection } = editor.state;

  if (selection instanceof CellSelection) {
    const rect = selectedRect(editor.state);
    for (let r = rect.top; r < rect.bottom; r++) dirtyRows.add(r);
  } 
  else if (selection.$anchor && selection.$anchor.path.length >= 5) dirtyRows.add(selection.$anchor.path[4]);
}
function exportTableData() {
  const ed = tableEditor.value;
  const hEd = contentEditor.value;

  if (!ed && !hEd) {
    emit('update-block', { content_type: 2, header_json: null, header_text: null, content_json: null, content_text: null, table_json: null, table_text: null, files: [], metadata: { source: "management" } });
    return;
  }

  const table_json = (ed) ? ed.getJSON() : null;
  const table_text = (ed) ? ed.state.doc.content.firstChild.content.content.map(rowNode => rowNode.content.content.map(getCellSig)) : null;
  emit('update-block', { content_type: 2, header_json: null, header_text: null, content_json: hEd.getJSON(), content_text: hEd.getText(), table_json, table_text, files: [], metadata: { source: "management" } });

  const messages = ed && invalidRows.size > 0 ? ['「生產基本條件」參數表有數值未填妥或格式錯誤'] : null;
  emit('invalid-check', { isValid: invalidRows.size === 0, message: messages });
}
const customHandlePaste = (view, event) => {
  // 1. 取得貼上的起點 (Start Row)
  const sel = view.state.selection;
  let startRow = -1;
  if (sel instanceof CellSelection) startRow = selectedRect(view.state).top; 
  else if (sel.$anchor && sel.$anchor.path.length > 4) startRow = sel.$anchor.path[4];

  // 2. 估算貼上的資料會覆蓋多少列
  let affectedRows = 1;
  const htmlData = event.clipboardData?.getData('text/html');
  const rawText = event.clipboardData?.getData('text/plain') || '';

  if (htmlData && htmlData.includes('<table')) affectedRows = (htmlData.match(/<tr/gi) || []).length || 1;
  else if (rawText) affectedRows = rawText.trim().split('\n').length || 1;

  // 3. 把受影響的列全部加入 dirtyRows
  if (startRow >= 0) {
    for (let i = 0; i < affectedRows; i++) { dirtyRows.add(startRow + i); }
  }

  // 4. 將核心邏輯交還給底層通用的 Paste 工具處理
  return baseHandlePaste(view, event);
}

// ==========================================
// 4. Editor Initialize & Validate Function
// ==========================================
const buildContentEditor = (content) => {
  const ed = new Editor({
    content: content || initialDoc(),
    extensions: textExt,
    editorProps: { attributes: { class: 'table-editor' } },
    onUpdate: ({ editor }) => { 
      if (validateTimer) clearTimeout(validateTimer);
      validateTimer = setTimeout(() => { exportTableData() }, 200);
    },
  });
  return ed;
}
const buildTableEditor = (template) => {
  const data = (Array.isArray(template)) ? initialTableDoc(template) : template;
  const ed = new Editor({
    content: data, extensions: tableEditorExtensions,
    editorProps: { handleDOMEvents: { drop: () => true, dragstart: () => true, copy: handleCopy, paste: customHandlePaste, mousedown: handleMousedown }, handleKeyDown: handleKeyDown },
    onUpdate: ({ editor }) => {
      markCurrentRowDirty(editor);
      if (validateTimer) clearTimeout(validateTimer);
      validateTimer = setTimeout(() => {  // 驗證：稍微 debounce，只檢查 dirtyRows
        const rows = Array.from(dirtyRows);
        if (rows.length) validateTableContent(editor, rows);
      }, 200);
    },
  });
  return ed;
}
const initFromProps = (template) => {
  if (!template) {  // No PMS data
    tableEditor.value = null;
    exportTableData();
    return;
  }

  if (tableEditor.value) tableEditor.value?.destroy?.();

  // Load PMS template
  if (Array.isArray(template)) { tableEditor.value = buildTableEditor(template); }
  else {  // Load from database restore
    if (contentEditor.value) contentEditor.value?.destroy?.();
    contentEditor.value = buildContentEditor(template.content_json);
    if (template.table_json) tableEditor.value = buildTableEditor(template.table_json);
  }
  
  // Get table editor row count to validate all columns
  if (tableEditor.value) {
    const editor = tableEditor.value;
    const tableNode = editor.state.doc.firstChild; // Tiptap 結構中，最外層第一個子節點就是 table
    const rowsToValidate = new Set(Array.from({ length: tableNode.childCount - 1 }, (_, i) => i + 1));
    validateTableContent(editor, rowsToValidate);
  }

  exportTableData();
}
function validateTableContent(editor, rowsToCheck = null) {
  if (!editor || rowsToCheck == null) { dirtyRows.clear(); return; }

  let tr = editor.state.tr;
  let changed = false;

  // 動態定位欄位 index（header 列已固定，從 doc 第一列取出）
  const headerRowNode = editor.state.doc.firstChild.firstChild;
  const headers = headerRowNode.content.content.map(getText);
  const numericIdx = findNumericColIndices(headers);
  const checkboxIdx = findCheckboxColIndex(headers);

  if (numericIdx.some(i => i < 0)) {
    dirtyRows.clear();
    return;
  }

  const setValueIdxInArr = NUMERIC_HEADER_NAMES.indexOf('設定值');

  let maxRow = Math.max(...rowsToCheck);
  let rowsPos = [1];
  if (!editor.state.selection.$anchor.node(1)) return;
  for(let rowIndex = 0; rowIndex < Math.min(editor.state.selection.$anchor.node(1).content.childCount, maxRow); rowIndex++) rowsPos.push(rowsPos.at(-1) + editor.state.doc.content.firstChild.content.child(rowIndex).nodeSize);

  const sortedIndex = [...rowsToCheck].sort((a, b) => b - a);
  sortedIndex.forEach(rowIndex => {
    if (rowIndex >= editor.state.selection.$anchor.node(1).content.childCount) {
      invalidRows.delete(rowIndex);
      return;
    }
    const rowNode = editor.state.selection.$anchor.node(1).content.child(rowIndex);
    const rowPos = rowsPos[rowIndex];
    const cells = rowNode.content;

    const cellPos = [rowPos + 1];
    for(let index = 0; index < cells.childCount - 1; index++) cellPos.push(cellPos.at(-1) + cells.child(index).nodeSize);

    // 該 row 是否勾選「定值項目」
    const isFixed = checkboxIdx >= 0 && cells.child(checkboxIdx)?.attrs?.checked === true;

    const value = [];
    let valueStatus = [];
    for (let i = 0; i < numericIdx.length; i++) {
      const txt = getText(cells.child(numericIdx[i]));
      let status = 'empty';
      let val = Number(txt);

      if (txt) status = (Number.isNaN(val)) ? 'invalid' : 'valid';
      value.push(val); valueStatus.push(status);
    }

    // 勾選定值項目：上下限 4 格不卡控，但「設定值」保留原始 empty/invalid → 強制必填
    if (isFixed) {
      valueStatus = valueStatus.map((s, i) => i === setValueIdxInArr ? s : 'valid');
    } else {
      valueStatus = validateValueStatus(value, valueStatus);
    }

    // 套色
    let rowHasError = false;
    for (let i = numericIdx.length - 1; i >= 0; i--) {
      if (rowIndex != 0 && (valueStatus[i] === 'invalid' || valueStatus[i] === 'empty')) rowHasError = true;

      const cellNode = cells.child(numericIdx[i]);
      const newClass = 'value-' + valueStatus[i];

      if (cellNode.attrs.class === newClass) continue;

      const newAttrs = { ...cellNode.attrs, class: newClass };
      tr = tr.setNodeMarkup(cellPos[numericIdx[i]], cellNode.type, newAttrs, cellNode.marks);
      changed = true;
    }

    if (rowHasError) invalidRows.add(rowIndex);
    else invalidRows.delete(rowIndex);
  })

  dirtyRows.clear();
  exportTableData();
  if (changed) editor.view.dispatch(tr);
}

// ==========================================
// 5. Constructor & Destructor Function
// ==========================================
onMounted(() => { initFromProps(props.blockContent); })
onUnmounted(() => {
  if (validateTimer) clearTimeout(validateTimer);
  exportTableData();
  if (tableEditor.value) { tableEditor.value.destroy(); tableEditor.value = null; }
  if (contentEditor.value) { contentEditor.value.destroy(); contentEditor.value = null; }
})
defineExpose({ initFromProps, exportTableData });
</script>

<style scoped>

.combination-block { border: 1px solid #ccc; padding: 15px; margin: 4px; border-radius: 8px; background-color: #f9f9f9; }

.management-header-block { display: flex; margin-bottom: 10px; justify-content: space-between; align-items: center; align-items: center; }
.management-header-block label { font-size: 18px; }
.management-operation-block { margin-bottom: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; background-color: #f0f8ff; justify-content: flex-end; }

.menu.color { display: flex; gap: 5px; align-items: center; }
.font-color { width: 20px; height: 20px; border-radius: 50%; margin: 0px 4px; }
.font-color.red { background-color: red; }
.font-color.blue { background-color: blue; }
.font-color.black { background-color: black; }

/* Title Editor Style */
.header-editor-container { margin-bottom: 15px; background: #fff; border: 1px solid #ddd; border-radius: 4px; }
.content-editor-wrapper { margin-bottom: 15px; background: #fff; border: 1px solid #ddd; border-radius: 4px; }
.content-editor :deep(.ProseMirror) { padding: 8px 12px; min-height: 40px; font-size: 16px; outline: none; }
.content-editor :deep(.ProseMirror p.is-editor-empty::before) { content: attr(data-placeholder); float: left; color: #adb5bd; pointer-events: none; height: 0; }

/* Tiptap 專用 CSS 樣式 */
.table-editor :deep(.action-cell-wrapper) { padding: 2px; background-color: #f1f3f5; vertical-align: middle; text-align: center; }
.table-editor :deep(.action-btn-group) { display: flex; justify-content: center; gap: 4px; }
.table-editor :deep(.act-btn) { width: 20px; height: 20px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; font-size: 14px; padding: 0; line-height: 1; }
.table-editor :deep(.act-btn.add) { color: #1c7ed6; background-color: #e7f5ff; }
.table-editor :deep(.act-btn.add:hover) { background-color: #d0ebff; }
.table-editor :deep(.act-btn.del) { color: #fa5252; background-color: #fff5f5; }
.table-editor :deep(.act-btn.del:hover) { background-color: #ffe3e3; }
.table-editor :deep(.act-btn.disabled) { opacity: 0.3; cursor: not-allowed; color: #adb5bd; background-color: #e9ecef; }

.table-editor :deep(.ProseMirror) { padding: 10px; outline: none; line-height: 1.5; }
.table-editor :deep(table) { border-collapse: collapse; width: 100%; margin: 10px 0px; table-layout: fixed; }
.table-editor :deep(th) { position:sticky; top:35px; z-index:5; }
.table-editor :deep(th), .table-editor :deep(td) { 
  border: 1px solid #ccc; 
  padding: 8px; 
  text-align: left; 
  vertical-align: middle; 
  min-height: 40px;
}

.table-editor :deep(p) { margin: 0px; }
.table-editor :deep(th), .table-editor :deep(td) { text-align: center; }

.management-tiptap-editor :deep(col:nth-child(1)) { width: 50px; }   /* 項次 */
.management-tiptap-editor :deep(col:nth-child(2)) { width: 80px; }   /* 槽體 */
.management-tiptap-editor :deep(col:nth-child(3)) { width: 100px; }  /* 管理項目 */
.management-tiptap-editor :deep(col:nth-child(4)) { width: 60px; }   /* 定值項目 (checkbox) */
.management-tiptap-editor :deep(col:nth-child(5)),
.management-tiptap-editor :deep(col:nth-child(6)),
.management-tiptap-editor :deep(col:nth-child(7)),
.management-tiptap-editor :deep(col:nth-child(8)),
.management-tiptap-editor :deep(col:nth-child(9))  { width: 60px; }  /* 規格下限~規格上限 */
.management-tiptap-editor :deep(col:nth-child(10)) { width: 60px; }  /* 檢查頻率 */
.management-tiptap-editor :deep(col:nth-child(11)) { width: 60px; }  /* 檢查方式 */
.management-tiptap-editor :deep(col:nth-child(12)) { width: 60px; }  /* 檢驗人員 */
.management-tiptap-editor :deep(col:nth-child(13)) { width: 100px; } /* 記錄 */
.management-tiptap-editor :deep(col:nth-child(14)) { width: 100px; } /* 備註/參考指示書 */
.management-tiptap-editor :deep(td.align-left) { text-align: left; }
.management-tiptap-editor :deep(td.checkbox-cell-wrapper) { background-color: #fafbfc; padding: 0; }
.management-tiptap-editor :deep(.checkbox-cell) { display: flex; align-items: center; justify-content: center; padding: 6px; }
.management-tiptap-editor :deep(.checkbox-cell input[type="checkbox"]) { width: 16px; height: 16px; cursor: pointer; margin: 0; accent-color: #1666C0; }

.table-editor :deep(.ProseMirror-focused td.selectedCell),
.table-editor :deep(.ProseMirror-focused th.selectedCell) {
  border: 2px solid #ccc;
  background-color: #cce7ff;
  box-shadow: 0 0 0 3px #4a90e2 inset;
  border-color: transparent;
  opacity: 1;
}
.management-tiptap-editor :deep(td[contenteditable="false"]),
.management-tiptap-editor :deep(th[contenteditable="false"]) {
  background-color: #f1f3f5; 
  cursor: default;      
  color: #6c757d;
}

.table-editor :deep(td.value-empty), .table-editor :deep(th.value-empty) { background-color: #fffee0; }
.table-editor :deep(td.value-error), .table-editor :deep(th.value-error) { background-color: #ffeaea; }
.table-editor :deep(td.value-invalid), .table-editor :deep(th.value-invalid) { background-color: #ffeaea; }
.table-editor :deep(td.has-focus){ background-color:#fff7cc; box-shadow: inset 0 0 0 2px #ff9800; }

.hint.empty { margin: 8px 0; color: #c62828; font-weight: 600; }
</style>