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

    <div v-for="(blockItem, blockIndex) in localBlockContents.data" :key="blockItem.id" class="block-item-wrapper" :class="{'child-block-container': blockIndex > 0}">
      <div class="block-header">
        <label>{{ step }}.{{ tier }}{{ blockIndex > 0 ? '.' + blockIndex : '' }}</label>
        
        <EditorContent :editor="titleEditor[blockItem.id]" class="title-editor-content" />
        
        <div v-if="allowColor" class="menu color">
          <div class="font-color blue" @click="setGenericColor('blue')"></div>
          <div class="font-color black" @click="setGenericColor(null)"></div>
        </div>

        <div :class="`menu content-type-option-${step}-${tier}-${blockIndex}`">
          <label><input type="radio" v-model="blockItem.option" :value=0 @change="radioInputChange(blockItem)">無</label>
          <label><input type="radio" v-model="blockItem.option" :value=1 @change="radioInputChange(blockItem)">文字框 or 圖</label>
          <label><input type="radio" v-model="blockItem.option" :value=2 @change="radioInputChange(blockItem)">表格</label>
          <label v-if="documentMode"><input type="radio" v-model="blockItem.option" :value=3 @change="radioInputChange(blockItem)">插入文件</label>
        </div>

        <div class="action-buttons">
          <button v-if="blockIndex === 0" @click="emitAddBlock">新增同層</button>
          <button @click="addSmallBlock">{{ (blockIndex) === 0 ? "新增下一層" : "新增同層" }}</button>
          <button @click="(blockIndex === 0) ? emitDelete() : removeSmallBlock(blockIndex)">刪除</button> 
        </div>
      </div>

      <div class="editor-body">
        <div class="menu-bar" v-if="blockItem.option !== 0 && blockItem.option !== 3">
          <template v-if="blockItem.option === 2">
            <button @click="addRow(blockItem.id)" class="menu-btn" title="表格：新增列">新增列</button>
            <button @click="addColumn(blockItem.id)" class="menu-btn" title="表格：新增行">新增行</button>
            <button @click="deleteRow(blockItem.id)" class="menu-btn" :disabled="!canDeleteRow(blockItem.id)" title="表格：刪除列">刪除列</button>
            <button @click="deleteColumn(blockItem.id)" class="menu-btn" :disabled="!canDeleteColumn(blockItem.id)" title="表格：刪除行">刪除行</button>
            <button @click="mergeCells(blockItem.id)" class="menu-btn" :disabled="!canMergeOrSplit(blockItem.id)" title="表格：合併儲存格">合併儲存格</button>
            <button @click="unmergeCells(blockItem.id)" class="menu-btn" :disabled="!canMergeOrSplit(blockItem.id)" title="表格：解除合併">取消合併</button>

            <span style="border-right: 1px solid #ccc; margin: 0 5px;"></span>
          </template>

          <input type="file" :ref="el => fileInputRefs[blockItem.id] = el" @change="handleImageUpload($event, blockItem)" accept="image/*" style="display: none;">
          <button @click="triggerFileInput(blockItem.id)" class="menu-btn" title="插入圖片">插入圖片</button>
        </div>
        
        <EditorContent v-if="blockItem.option !== 0 && blockItem.option !== 3" :editor="editors[blockItem.id]" class="editor-content" />

        <div v-if="blockItem.option === 2" class="explain-box-container">
          <div class="explain-label">💡 表格說明 (Explain)：</div>
          <EditorContent :editor="explainEditors[blockItem.id]" class="editor-content" />
        </div>

        <div v-if="blockItem.option == 1 && blockItem.files.length > 0" class="files-block">
          <ul class="preview-grid">
            <li v-for="(fileItem, index) in blockItem.files" :key="index" class="preview-item">
              <img :src="imgUrl(fileItem.path_to_save)" alt="圖片預覽" class="preview-thumbnail">
              <button @click="removeFile(blockItem, index)" class="remove-btn">X</button>
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
import { ref, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { v1 as uuidv1 } from 'uuid';
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
import { CellSelection, selectedRect } from 'prosemirror-tables'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL
const STATIC_BASE_URL = import.meta.env.VITE_APP_STATIC_BASE_URL || ''

// ---------- props / emits ----------
const props = defineProps({
  blockEditors: { type: Object, required: true }, // { step, tier, data:[{option, header, jsonContent, files:[]}, ...] }
  allowColor: {type: Boolean, default: true},
  documentMode: { type: Boolean, default: false }
})
const emit = defineEmits(['add-block', 'update-block', 'delete-block', 'open-doc-search']);

// ---------- state ----------
const step = ref(props.blockEditors.step)
const tier = ref(props.blockEditors.tier)
const localBlockContents = reactive({ ...props.blockEditors }) // shallow copy is enough since we replace fields

const titleEditor = reactive({})
const editors = reactive({})         // { [idx]: Editor }
const explainEditors = reactive({}) // ✅ 新增：用來存放表格說明的編輯器實例
const activeEditor = ref(null)
const fileInputRefs = ref([])        // array-style refs per block index

const tableDialog = reactive({
  show: false,
  rows: 3,
  cols: 4,
  blockItem: null
});

// 加入兩個控制方法：
const confirmTableDialog = () => {
  let r = parseInt(tableDialog.rows);
  let c = parseInt(tableDialog.cols);
  if (isNaN(r) || r < 1) r = 3;
  if (isNaN(c) || c < 1) c = 4;
  
  tableDialog.blockItem.jsonContent = initialTableDoc(r, c);
  nextTick(() => initBlockEditor(tableDialog.blockItem));
  tableDialog.show = false;
};

const cancelTableDialog = () => {
  // 取消的話，把 radio 退回「無」
  tableDialog.blockItem.option = 0;
  tableDialog.blockItem.jsonContent = null;
  tableDialog.show = false;
};

// ---------- tiptap extension presets ----------
const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })]
const titleExt = [Document.extend({ content: 'paragraph' }), ...baseExt, History, Placeholder.configure({ placeholder: '請輸入標題' })]
const textExt  = [Document, ...baseExt, History, Placeholder.configure({ placeholder: '請輸入文字內容' }), Image.configure({ inline: true, allowBase64: true })]
const tableExt = [Document.extend({ content: 'table' }), ...baseExt, History, Focus.configure({ className: 'has-focus', mode: 'all' }),, Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Image.configure({ inline: true, allowBase64: true })]
const explainExt = [Document.extend({ content: 'paragraph' }), ...baseExt, History, Placeholder.configure({ placeholder: '請輸入此表格的說明內容...' })]

// ---------- helpers ----------
const deepClone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))
const imgUrl = p => (p ? `${STATIC_BASE_URL}/uploads/${p}` : '')

const initialDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] })
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

const setActiveEditor = ed => (activeEditor.value = ed)
const setGenericColor = color => activeEditor.value?.chain().focus().setColor(color || '#000').run()

// safe can()-checks for table actions
const canMergeOrSplit = id => {
  const ed = editors[id];
  if (!ed) return false;
  try { return ed.can().mergeCells() || ed.can().splitCell() } catch { return false }
}
const canDeleteRow = id => {
  const ed = editors[id];
  if (!ed) return false;
  try { return ed.can().deleteRow() } catch { return false }
}
const canDeleteColumn = id => {
  const ed = editors[id];
  if (!ed) return false;
  try { return ed.can().deleteColumn() } catch { return false }
}

// ---------- editor init / lifecycle ----------
const initTitleEditor = (blockItem) => {
  const id = blockItem.id;
  titleEditor[id]?.destroy()
  delete titleEditor[id]

  let content = null
  if (!blockItem.jsonHeader) {
    content = initialDoc()
  } else {
    content = blockItem.jsonHeader
    if (typeof content === 'string' && content) {
      content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] }
    }
  }

  const ed = new Editor({
    content: deepClone(content),
    extensions: titleExt,
    editorProps: { attributes: { class: 'title-editor-content' }, handlePaste: (view, event) => handleTextPaste(view, event) },
    editable: blockItem.option !== 3,
    onFocus: ({ editor }) => setActiveEditor(editor), 
    onUpdate: ({ editor }) => { 
      // 直接綁定物件屬性，不怕陣列 index 改變！
      blockItem.jsonHeader = editor.getJSON() 
    },
  })

  titleEditor[id] = ed
  if (!blockItem.jsonHeader) blockItem.jsonHeader = ed.getJSON()
}

const initBlockEditor = (blockItem) => {
  const id = blockItem.id;
  editors[id]?.destroy();
  delete editors[id];

  // 清理 explain 編輯器 (如果有的話)
  explainEditors[id]?.destroy()
  delete explainEditors[id]

  if (blockItem.option === 0 || blockItem.option === 3) return

  const ext = blockItem.option === 1 ? textExt : tableExt
  const defaultContent = blockItem.option === 1 ? initialDoc() : initialTableDoc()
  let content = deepClone(blockItem.jsonContent || defaultContent)

  let specificEditorProps = { attributes: { class: 'editor-content' } };

  if (blockItem.option === 1) {
    specificEditorProps = { attributes: { class: 'editor-content' }, handlePaste: (view, event) => handleTextPaste(view, event) }
  } else if (blockItem.option === 2) {
    content = forceHeaderRow(content)
    specificEditorProps = {
      attributes: { class: 'editor-content' },
      handleDOMEvents: { drop: () => true, dragstart: () => true, copy: handleCopy, paste: handlePaste, mousedown: handleMousedown }
    }
  }

  const ed = new Editor({
    content,
    extensions: ext,
    editorProps: specificEditorProps,
    onFocus: ({ editor }) => setActiveEditor(editor),
    onUpdate: ({ editor }) => { blockItem.jsonContent = editor.getJSON() },
  })
  editors[id] = ed

  if (!blockItem.jsonContent) blockItem.jsonContent = ed.getJSON()

  // ✅ 功能 3: 如果是表格模式，初始化說明文字的編輯器
  if (blockItem.option === 2) {
    const exEd = new Editor({
      content: deepClone(blockItem.explain_json || initialDoc()),
      extensions: explainExt,
      editorProps: { attributes: { class: 'editor-content' }, handlePaste: (view, event) => handleTextPaste(view, event) },
      onFocus: ({ editor }) => setActiveEditor(editor),
      onUpdate: ({ editor }) => {
        blockItem.explain_json = editor.getJSON();
        blockItem.explain_text = editor.getText(); // 同步抓出純文字
      }
    })
    explainEditors[id] = exEd;
    if (!blockItem.explain_json) {
      blockItem.explain_json = exEd.getJSON();
      blockItem.explain_text = exEd.getText();
    }
  }
}

// 強制將 Table 的第一列轉換為 tableHeader
const forceHeaderRow = (doc) => {
  // 基礎檢查：確保是 Tiptap doc 結構
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return doc

  // 1. 尋找 table 節點
  const tableNode = doc.content.find(n => n.type === 'table')
  if (!tableNode || !Array.isArray(tableNode.content) || tableNode.content.length === 0) return doc

  // 2. 取得第一列 (Row 0)
  const firstRow = tableNode.content[0]
  if (firstRow.type === 'tableRow' && Array.isArray(firstRow.content)) {
    // 3. 遍歷第一列的所有儲存格，將 tableCell 改為 tableHeader
    firstRow.content.forEach(cell => {
      if (cell.type === 'tableCell') {
        cell.type = 'tableHeader'
      }
    })
  }
  return doc
}

const range = (a, b) => Array.from({length: b - a}, (v, i) => i + a);
const getText = cellNode => {
  const paragraphs = cellNode.content?.content || [];
  return paragraphs.map(pNode => { return (pNode.content?.content || []).map(textNode => textNode.text || '').join('') }).join('\n');
}
// Parse Excel and Word format
function parseExcelClipboard(str) {
  // 移除字串末端多餘的換行
  str = str.replace(/(\r\n|\n|\r)$/, '');

  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuote = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = str[i+1];

    if (inQuote) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"'; // 雙引號跳脫
          i++; 
        } else {
          inQuote = false; // 結束引號
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === '\t') {
        currentRow.push(currentCell);
        currentCell = "";
      } else if (char === '\n' || (char === '\r')) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  return rows;
}
// Handle copy process (Ctrl + C)
function handleCopy(view, event) {
  const { state } = view;
  const sel = state.selection;
  if (!(sel instanceof CellSelection)) {
    const slice = sel.content();
    const text = slice.content.textBetween(0, slice.content.size, '\n', '\n');

    if (event.clipboardData) {
      event.clipboardData.setData('text/plain', text);
      event.preventDefault(); // 阻止 Tiptap 預設行為
      return true;
    }
    return false;
  }

  const rect = selectedRect(state);
  const table = rect.table;
  const rows = [];

  for (let r = rect.top; r < rect.bottom; r++) {
    const rowNode = table.child(r);
    const cols = Array.from({length: rect.right - rect.left}, (_, i) => i + rect.left).map(col => {
      const text = getText(rowNode.child(col)).replace(/"/g, '""');
      return `"${text}"`;
    })
    rows.push(cols.join('\t')); // 欄位用 Tab 分隔
  }

  const clipboardText = rows.join('\r\n');

  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', clipboardText);
    event.preventDefault();
    return true;
  }
  return false;
}
// Handle paste process (Ctrl + V)
function handlePaste(view, event) {
  const { state, dispatch } = view;
  const sel = state.selection;
  console.log("Dynamic block paste function");

  // =================================================================
  // 🌟 關鍵新增：檢查剪貼簿是否包含 HTML 格式的表格 (例如從 Word 複製)
  // =================================================================
  const htmlData = event.clipboardData?.getData('text/html');
  if (htmlData && htmlData.includes('<table')) {
    console.log("偵測到 HTML 表格，放手交給 Tiptap 原生引擎處理！");
    // return false 代表「取消攔截」，讓 Tiptap 底層的 ProseMirror 接管貼上行為。
    // 它會自動解析 HTML 中的 colspan 和 rowspan，完美還原 Word 表格！
    return false; 
  }

  // =================================================================
  // 往下是你原本的 Excel 純文字解析邏輯 (沒有 HTML 時才觸發)
  // =================================================================
  const raw = event.clipboardData?.getData('text/plain') || '';
  if (!raw) return false;

  const matrix = parseExcelClipboard(raw);
  if (!matrix.length) return true;

  // 2. 定位 Table & Row / 計算起點
  let tableNode = view.state.doc.content.firstChild;
  let startRowIndex = view.state.selection.$anchor.path[4];
  let startColIndex = view.state.selection.$anchor.path[7];

  if (!(sel instanceof CellSelection)) {
    let textToPaste = raw;
    textToPaste = textToPaste.replace(/(\r\n|\n|\r)+$/, '');
    if (textToPaste.length >= 2 && textToPaste.startsWith('"') && textToPaste.endsWith('"')) {
       textToPaste = textToPaste.slice(1, -1);
       textToPaste = textToPaste.replace(/""/g, '"');
    }
    textToPaste = textToPaste.replace(/\r\n/g, '\n');
    dispatch(state.tr.insertText(textToPaste));

    const anchorPath = view.state.selection.$anchor.path;
    if(anchorPath && anchorPath.length > 4) {
      startRowIndex = anchorPath[4];
    }
    event.preventDefault(); 
    return true; 
  }

  const rect = selectedRect(state);
  startRowIndex = rect.top;
  startColIndex = rect.left;

  if (startRowIndex < 0 || startColIndex < 0) return false;

  let M = view.state.selection.$anchor.node(1).childCount;
  let N = view.state.selection.$anchor.node(2).childCount;

  let rowsPos = [1];
  for(let rowIndex = 0; rowIndex < tableNode.childCount; rowIndex++) rowsPos.push(rowsPos.at(-1) + tableNode.content.child(rowIndex).nodeSize);

  const targets = [];
  range(startRowIndex, startRowIndex + matrix.length).forEach((rowIndex, rIndex) => {
    if (rowIndex >= M) return;

    const rowNode = view.state.selection.$anchor.node(1).content.child(rowIndex);
    const rowPos = rowsPos[rowIndex];
    const cells = rowNode.content;
    const sourceRowData = matrix[rIndex] || [];

    const cellPos = [rowPos + 1];
    for(let index = 0; index < N - 1; index++) cellPos.push(cellPos.at(-1) + cells.child(index).nodeSize);

    range(startColIndex, startColIndex + sourceRowData.length).forEach((colIndex, cIndex) => {
      if (colIndex >= N) return;
      const cellNode = cells.child(colIndex);
      targets.push({ cellPos: cellPos[colIndex], cellSize: cellNode.nodeSize, type: cellNode.type, attrs: cellNode.attrs, text: sourceRowData[cIndex].toString() });
    })
  })

  if (targets.length === 0) return true;
  targets.sort((a, b) => b.cellPos - a.cellPos);

  let tr = state.tr;
  const schema = state.schema;

  for (const t of targets) {
    const lines = t.text.split('\n');
    const contentNodes = lines.map(line => schema.nodes.paragraph.create({}, line ? [schema.text(line)] : []));
    const newCell = t.type.create(t.attrs, contentNodes);
    tr = tr.replaceWith(t.cellPos, t.cellPos + t.cellSize, newCell);
  }

  if (tr.docChanged) {
    dispatch(tr.scrollIntoView());
  }

  event.preventDefault();
  return true;
}
function handleTextPaste(view, event) {
  const text = event.clipboardData?.getData('text/plain');
  if (text) {
    view.dispatch(view.state.tr.insertText(text));
    event.preventDefault();
    return true;
  }
  return false;
}
// Handle mouse click for cell select
function handleMousedown(view, event) {
  // 1. 忽略按鈕
  if (event.target.closest('button')) return false;
  
  // 2. 找出點擊的儲存格 DOM
  const cellDOM = event.target.closest('td, th');
  if (!cellDOM) return false;

  // 3. 取得該儲存格在文件中的位置
  const pos = view.posAtDOM(cellDOM, 0);
  if (pos === null) return false;

  const cellPos = view.state.doc.resolve(pos).before(3);

  // 4. 判斷是否為「第二次點擊」(進入編輯模式)
  const { selection } = view.state;
  if (selection instanceof CellSelection) {
      // 如果已經單選了這一格，且再次點擊 -> 放行事件，讓使用者進入編輯模式
      if (selection.$anchorCell.pos === cellPos && selection.$headCell.pos === cellPos) {
          return false; 
      }
  }

  // [情境：第一次點擊] -> 手動實作「點擊選取」與「拖曳框選」
  view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, view.state.doc.resolve(cellPos).pos)));
  if (!view.hasFocus()) view.focus();
  event.preventDefault();

  // C. 手動啟動拖曳監聽 (因為 preventDefault 殺死了插件的拖曳功能)
  const startAnchorPos = cellPos;
  let currentHeadPos = cellPos;

  const moveHandler = (moveEvent) => {
    // 1. 找出滑鼠當前位置下的 Cell
    const posObj = view.posAtCoords({ left: moveEvent.clientX, top: moveEvent.clientY });
    if (!posObj) return;

    const $currPos = view.state.doc.resolve(posObj.pos);
    let foundCellPos = $currPos.before(3);

    // 2. 如果滑鼠移到了新的格子，且位置合法，更新選取範圍
    if (foundCellPos !== null && foundCellPos !== currentHeadPos) {
      currentHeadPos = foundCellPos;
      try {
        // 使用 CellSelection.create 自動計算矩形範圍
        // 注意：必須確保 anchor 和 head 在同一個 table 內，否則 create 會報錯，這裡用 try-catch 保護
        const newSelection = CellSelection.create(view.state.doc, startAnchorPos, foundCellPos);
        view.dispatch(view.state.tr.setSelection(newSelection));
      } catch (e) {
        // 跨表格拖曳或結構錯誤時忽略
      }
    }
  };

  const upHandler = () => {
    // 滑鼠放開時，移除監聽
    window.removeEventListener('mousemove', moveHandler);
    window.removeEventListener('mouseup', upHandler);
  };

  // D. 掛載監聽器到 window (確保拖曳出表格也能感應)
  window.addEventListener('mousemove', moveHandler);
  window.addEventListener('mouseup', upHandler);

  // E. 回傳 true，表示我們完全接管了這個事件
  return true; 
}

onMounted(() => {
  nextTick(() => {
    localBlockContents.data.forEach((blk) => { 
      // 確保每一個 block 一定有 id
      if (!blk.id) blk.id = uuidv1();
      initTitleEditor(blk);
      if (blk.option !== 0) initBlockEditor(blk);
    })
  })
})

onBeforeUnmount(() => {
  emit('update-block', localBlockContents)
  titleEditor.value?.destroy()
  Object.values(editors).forEach(e => e.destroy())
  Object.values(explainEditors).forEach(e => e.destroy()) // ✅ 清除說明編輯器
})

// ---------- watchers / emit ----------
watch(() => props.blockEditors.tier, t => {
  tier.value = t
  localBlockContents.tier = t
})

// // ★ 新增：監聽資料變化，動態切換標題編輯器的鎖定狀態
// watch(() => localBlockContents.data, (newData) => {
//   newData.forEach(blockItem => {
//     const tEd = titleEditor[blockItem.id];
//     if (tEd) {
//       tEd.setEditable(blockItem.option !== 3);
//     }
//   });
// }, { deep: true });

// ---------- UI handlers ----------
const addSmallBlock = () => {
  const newBlock = { option: 0, jsonHeader: null, jsonContent: null, explain_json: null, explain_text: null, files: [], id: uuidv1() };
  localBlockContents.data.push(newBlock);
  initTitleEditor(newBlock);
}

const removeSmallBlock = (idx) => {
  if (!confirm('確定要刪除此子區塊?')) return
  
  // 刪除陣列前，先抓到 id，並用 id 把編輯器徹底銷毀
  const id = localBlockContents.data[idx].id;
  titleEditor[id]?.destroy();
  editors[id]?.destroy();
  explainEditors[id]?.destroy(); // ✅ 刪除時也摧毀 explain
  delete titleEditor[id];
  delete editors[id];
  delete explainEditors[id];
  localBlockContents.data.splice(idx, 1);
  
  // 執行刪除
  localBlockContents.data.splice(idx, 1)
}

const radioInputChange = (blockItem) => {
  const opt = blockItem.option;
  
  if (opt === 3) {
    emit('open-doc-search', blockItem);
    return;
  }

  const tEd = titleEditor[blockItem.id];
  if (tEd) { tEd.setEditable(blockItem.option !== 3); }

  // ✅ 功能 2 修改：若選擇「表格」，打開我們自己寫的彈窗，暫停後續執行
  if (opt === 2) {
    tableDialog.blockItem = blockItem;
    tableDialog.show = true;
    return; // 👈 這裡很重要，return 掉，等使用者按確定再初始化 Editor
  } else {
    blockItem.jsonContent = null;
  }

  if (opt !== 1) blockItem.files = [];
  nextTick(() => initBlockEditor(blockItem));
}

const emitAddBlock = () => { emit('add-block'); }

const emitDelete = () => {
  if (!confirm('確定要刪除此區塊?')) return
  console.log("Emit delete");
  emit('delete-block', localBlockContents.id);
}

const addRow = id => editors[id]?.chain().focus().addRowAfter().run()
const addColumn = id => editors[id]?.chain().focus().addColumnAfter().run()
const deleteRow = id => editors[id]?.chain().focus().deleteRow().run()
const deleteColumn = id => editors[id]?.chain().focus().deleteColumn().run()
const mergeCells = id => editors[id]?.chain().focus().mergeCells().run()
const unmergeCells = id => editors[id]?.chain().focus().splitCell().run()


const triggerFileInput = id => {
  const el = fileInputRefs.value[id]
  if (Array.isArray(el) ? el[0] : el) (Array.isArray(el) ? el[0] : el).click()
}
const removeFile = (blockItem, picIdx) => blockItem.files.splice(picIdx, 1)

const handleImageUpload = async (evt, blockItem) => {
  const file = evt.target.files?.[0]
  const ed = editors[blockItem.id]
  if (!file) return
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_BASE_URL}/uploads/image`, { method: 'POST', body: fd })
    const result = await res.json()
    if (!result.success) throw new Error(result.message || 'upload failed')

    if (blockItem.option === 1) {
      blockItem.files.push({ name: file.name, size: file.size, path_to_save: result.path_to_save })
    } else if (ed) {
      ed.chain().focus().setImage({ src: API_BASE_URL + result.url }).run()
    }
  } catch (e) {
    console.error('上傳錯誤:', e)
    alert('圖片上傳失敗')
  } finally {
    evt.target.value = ''
  }
}
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

.explain-box-container {
  margin-top: 10px;
  padding: 10px;
  background-color: #f9f9f9;
  border: 1px dashed #ccc;
  border-radius: 4px;
}
.explain-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
  font-weight: bold;
}
.explain-editor-input {
  min-height: 40px;
  background-color: white;
  border: 1px solid #eee;
  padding: 5px;
}

/* ✅ 新增的彈窗樣式 */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.5); z-index: 9999;
  display: flex; justify-content: center; align-items: center;
}
.modal-content {
  background: white; padding: 20px 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 300px;
}
.form-group { margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.btn-cancel { background: #f5f5f5; border: 1px solid #ddd; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-confirm { background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-confirm:hover { background: #0056b3; }

.remove-btn:hover { background-color: #c82333; transform: scale(1.1); }
</style>