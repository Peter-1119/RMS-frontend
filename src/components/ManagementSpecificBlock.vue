// Version 0
<template>
  <div class="combination-block">
    <div class="management-header-block">
      <label>{{ props.managementBlock.step }}.{{ props.managementBlock.tier }} 生產基本條件</label>
      <div class="management-operation-block">
        <div v-if="allowColor" class="menu color">
          <div class="font-color blue" @click="editor?.chain().focus().setColor('blue').run()"></div>
          <div class="font-color black" @click="editor?.chain().focus().setColor('null').run()"></div>
        </div>
        <!-- <button class="combination-btn add" @click="addRow(false)">往上插入</button> -->
        <!-- <button class="combination-btn add" @click="addRow(true)">往下插入</button> -->
        <!-- <button class="combination-btn del" @click="deleteRow">刪除該列</button> -->
      </div>
    </div>

    <div class="editor-wrapper">
      <div v-if="hasPms || localBlockData.data?.jsonHeader" class="header-editor-container">
        <EditorContent v-if="headerEditor" :editor="headerEditor" class="title-editor-content" />
      </div>
      <!-- 沒有 PMS：只顯示提示文字 -->
      <p v-if="!hasPms" class="hint empty">選擇的機台無任何參數</p>

      <!-- 有 PMS 而且 editor 存在：顯示 Tiptap 表格 -->
      <EditorContent v-else-if="editor" :editor="editor" class="editor-content management-tiptap-editor"/>
    </div>

  </div>
</template>


<script setup>
import axios from 'axios'
import { onMounted, onUnmounted, reactive, ref, shallowRef, nextTick } from 'vue'
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

const emit = defineEmits(['update-table-data']);

const props = defineProps({
  machine_id: { type: String, default: "" },
  managementBlock: { type: Object, required: true },
  hasPms: { type: Boolean, default: true },
  allowColor: { type: Boolean, default: true },
})

const localBlockData = reactive({ ...props.managementBlock });
let editor = shallowRef(null);
let headerEditor = shallowRef(null);
let validateTimer = null;
let dirtyRows = new Set();

const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })];

const CustomTableCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), contenteditable: { default: true }, class: { default: null } }; } });
const CustomTableHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), contenteditable: { default: true } }; } });
const CustomTableRow = TableRow.extend({ content: '(tableCell | tableHeader | actionCell)*', addAttributes() { return { ...this.parent?.(), class: { default: null } }; } });
// [新增] 1. ActionCell: 渲染 + 和 - 按鈕
const ActionCell = TableCell.extend({
  name: 'actionCell',
  addAttributes() {
    return {
      ...this.parent?.(),
      contenteditable: { default: false }, // 這一格永遠不可編輯文字
      class: { default: 'action-cell-wrapper' },
      isPms: { default: false } // 標記是否為 PMS 帶出的列 (不可刪除)
    }
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('td');
      dom.classList.add('action-cell-wrapper');
      dom.contentEditable = 'false';

      const btnContainer = document.createElement('div');
      btnContainer.classList.add('action-btn-group');

      // [+] 按鈕
      const addBtn = document.createElement('button');
      addBtn.innerText = '+';
      addBtn.className = 'act-btn add';
      addBtn.onclick = async () => {
        if (typeof getPos === 'function') {
          editor.chain().setNodeSelection(getPos()).addRowAfter().run();
          updateTable(editor);
        }
      }

      // [-] 按鈕
      const delBtn = document.createElement('button');
      delBtn.innerText = '-';
      delBtn.className = 'act-btn del';
      
      // 邏輯：如果是 PMS 列 (isPms=true)，禁用刪除
      if (node.attrs.isPms) {
        delBtn.disabled = true;
        delBtn.classList.add('disabled');
        delBtn.title = 'PMS 預設項目不可刪除';
      } else {
        delBtn.onclick = async () => {
          if (typeof getPos === 'function') {
            if (confirm('確定要刪除此列嗎？')) {
              editor.chain().setNodeSelection(getPos()).deleteRow().run();
              updateTable(editor);
            }
          }
        }
      }

      btnContainer.appendChild(addBtn);
      btnContainer.appendChild(delBtn);
      dom.appendChild(btnContainer);

      return { dom, ignoreMutation: () => true, stopEvent: () => true };  // ignoreMutation: 傳遞 ProseMirror 忽略這裡面的 DOM 變動, stopEvent: 事件發生 => return true (事件攔截)
    }
  }
})
const tableEditorExtensions = [
  Document.extend({ content: 'table' }), ...baseExt, Table,
  Focus.configure({ className: 'has-focus', mode: 'all' }),
  CustomTableRow, CustomTableHeader, CustomTableCell, ActionCell, History,
]
const titleExt = [Document.extend({ content: 'paragraph' }), ...baseExt, Placeholder.configure({ placeholder: '請輸入項目說明...' })];

// 鎖定不可編輯欄（用在 from PMS 的 arrayData）
const LOCKCOLS = [0, 1, 2];

// --- 工具：取 cell 裡的純文字（給驗證用） ---
const range = (a, b) => Array.from({length: b - a}, (v, i) => i + a);
const getText = cellNode => {
  const paragraphs = cellNode.content?.content || [];
  return paragraphs.map(pNode => { return (pNode.content?.content || []).map(textNode => textNode.text || '').join('') }).join('\n');
}

function updateTable(editor) {
  if (!editor) return;
  const { state, view } = editor;
  const tr = state.tr;
  let rowIndex = 0;

  // Collect all rows
  const rowsToUpdate = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'tableRow') rowsToUpdate.push({ node, pos, rowNumber: rowIndex++ });
  })

  // Process text from the end（避免位置受影響）
  rowsToUpdate.slice(1).reverse().forEach(rowNode => {
    const { node, pos, rowNumber } = rowNode;
    const firstCell = node.content.child(0);
    const itemNoCell = node.content.child(1);
    const paragraph = state.schema.nodes.paragraph.create({}, state.schema.text(rowNumber.toString()));
    const newCell = itemNoCell.type.create({ ...itemNoCell.attrs, contenteditable: false }, paragraph);
    tr.replaceWith(pos + 1 + firstCell.nodeSize, pos + 1 + firstCell.nodeSize + itemNoCell.nodeSize, newCell);
  })

  if (tr.docChanged) view.dispatch(tr);
}

function validateTableContent(editor, rowsToCheck = null) {
  if (!editor || rowsToCheck == null) return;

  let tr = editor.state.tr;
  let changed = false;

  let maxRow = Math.max(...rowsToCheck);
  let rowsPos = [1];
  for(let rowIndex = 0; rowIndex < Math.min(editor.state.selection.$anchor.node(1).content.childCount, maxRow); rowIndex++) rowsPos.push(rowsPos.at(-1) + editor.state.doc.content.firstChild.content.child(rowIndex).nodeSize);

  const sortedIndex = [...rowsToCheck].sort((a, b) => b - a);
  sortedIndex.forEach(rowIndex => {
    if (rowIndex >= editor.state.selection.$anchor.node(1).content.childCount) return;
    const rowNode = editor.state.selection.$anchor.node(1).content.child(rowIndex);
    const rowPos = rowsPos[rowIndex];
    const cells = rowNode.content;

    const cellPos = [rowPos + 1];
    const value = [];
    const valueStatus = [];
    for(let index = 0; index < cells.childCount - 1; index++) cellPos.push(cellPos.at(-1) + cells.child(index).nodeSize);

    for(let index = 4; index < 9; index++) {
      const txt = getText(cells.child(index));
      let status = 'empty';
      let val = Number(txt);

      if (txt) status = (Number.isNaN(val)) ? 'invalid' : 'valid';
      
      value.push(val);
      valueStatus.push(status);
    }

    const validIndices = [0, 1, 2, 3, 4].filter(i => valueStatus[i] === 'valid');
    if (validIndices.length > 1){
      let maxSoFar = value[validIndices[0]];
      for (let i = 1; i < validIndices.length; i++) {
          const item = value[validIndices[i]];
          if (item < maxSoFar) valueStatus[validIndices[i]] = 'invalid';
          else maxSoFar = item;
      }

      let minSoFar = value[validIndices.at(-1)];;
      for (let i = validIndices.length - 2; i >= 0; i--) {
          const item = value[validIndices[i]];
          if (item > minSoFar) valueStatus[validIndices[i]] = 'invalid';
          else minSoFar = item;
      }
    }

    if (valueStatus.filter(status => status == 'empty').length != 5) {
      valueStatus[1] = (valueStatus[1] == 'invalid') ? 'invalid' : 'valid';
      valueStatus[3] = (valueStatus[3] == 'invalid') ? 'invalid' : 'valid';
      if (valueStatus[2] == 'empty') {
        valueStatus[0] = (valueStatus[0] == 'invalid') ? 'invalid' : 'valid';
        valueStatus[2] = (valueStatus[2] == 'invalid') ? 'invalid' : 'valid';
        valueStatus[4] = (valueStatus[4] == 'invalid') ? 'invalid' : 'valid';
      }
    }

    for (let offset = 4; offset >= 0; offset--) {
      const cellNode = cells.child(4 + offset);
      const newClass = 'value-' + valueStatus[offset];

      if (cellNode.attrs.class === newClass) continue;

      const newAttrs = { ...cellNode.attrs, class: newClass };
      tr = tr.setNodeMarkup(cellPos[4 + offset], cellNode.type, newAttrs, cellNode.marks);
      changed = true;
    }
  })

  exportTableData();
  if (changed) editor.view.dispatch(tr);
}

function exportTableData() {
  const ed = editor.value;
  const hEd = headerEditor.value;

  const jsonHeader = hEd ? hEd.getJSON() : null;
  if (!ed || !ed.state) {
    Object.assign(localBlockData.data, {jsonHeader, arrayData: [], jsonContent: null, pmsData: []});
    emit('update-table-data', localBlockData);
    return { jsonHeader, arrayData: [], jsonContent: null };
  }

  const arrayData = editor.value.state.doc.content.firstChild.content.content.slice(1).map(rowNode => { return rowNode.content.content.slice(1).map(cellNode => getText(cellNode)); });
  let pmsData = [];
  editor.value.state.doc.content.firstChild.content.content.slice(1).forEach(rowNode => {
    pmsData.push([rowNode.content.content[0].attrs.isPms, ...rowNode.content.content.slice(1).map(cellNode => getText(cellNode))]);
  })
  Object.assign(localBlockData.data, {jsonHeader, arrayData, jsonContent: ed.getJSON(), pmsData});
  emit('update-table-data', localBlockData);
  return { jsonHeader, arrayData, jsonContent: ed.getJSON(), pmsData };
}

// [新增] 用於修補舊資料的函式
function migrateOldJsonContent(jsonContent) {
  // 深拷貝以避免修改原始 props (雖然這裡通常是傳入副本，但安全起見)
  const content = JSON.parse(JSON.stringify(jsonContent));

  if (!content || !content.content) return content;

  // 尋找 table 節點
  const tableNode = content.content.find(n => n.type === 'table');
  if (!tableNode) return content;

  // 遍歷每一列 (TableRow)
  tableNode.content.forEach(row => {
    if (row.type === 'tableRow' && row.content) {
      const firstCell = row.content[0];

      // 檢查判斷：如果第一格不是 actionCell，代表這是舊資料 (13欄)
      if (firstCell && firstCell.type !== 'actionCell') {
        
        // 建立缺少的 Action Cell 結構
        const newActionCell = {
          type: 'actionCell',
          attrs: {
            contenteditable: false,
            class: 'action-cell-wrapper',
            isPms: true // 預設設為 true (保護舊資料不被誤刪)，這與 getInitialTableContent 保持一致
          },
          content: [
            { type: 'paragraph' }
          ]
        };

        // 將 Action Cell 插入到該列的最前面
        row.content.unshift(newActionCell);
      }
    }
  });

  return content;
}

function initOrReloadFromProps() {
  const blk = props.managementBlock || {};
  const data = blk.data || {};

  const headerContent = data.jsonHeader || { type: 'doc', content: [{ type: 'paragraph' }] };
  if (!headerEditor.value) {
      headerEditor.value = new Editor({ 
      content: headerContent, 
      extensions: titleExt, 
      editorProps: { 
        attributes: { class: 'title-editor-content' },
        handlePaste: (view, event) => {
          const text = event.clipboardData?.getData('text/plain');
          if (text) {
            view.dispatch(view.state.tr.insertText(text));
            event.preventDefault();
            return true;
          }
          return false;
        }
      } 
    });
  } else {
    // 若 props 變更，重設內容
    if (data.jsonHeader) {
      headerEditor.value.commands.setContent(data.jsonHeader);
    }
  }

  const jsonContent = data.jsonContent || null;
  const arrayData = Array.isArray(data.arrayData) ? data.arrayData : [];

  // ✅ 完全沒有內容（沒有草稿 json，也沒有 PMS arrayData）→ 不建立 editor 只保留「選擇的機台無任何參數」提示
  if (!jsonContent && !arrayData.length) return;
  // 🔥 [修改這裡]：如果是 jsonContent，先通過遷移函式處理
  let content;
  if (jsonContent) {
    // 檢查並修補舊資料
    content = migrateOldJsonContent(jsonContent);
  } else {
    // 如果沒有 json，則從 arrayData 產生 (這原本就會產生正確的 ActionCell)
    content = getInitialTableContent(arrayData);
  }

  if (!editor.value) {
    // 第一次建立 editor
    editor.value = new Editor({
      content,
      extensions: tableEditorExtensions,
      editorProps: {
        handleDOMEvents: { drop: () => true, dragstart: () => true, copy: (view, event) => handleCopy(view, event), keydown: (view, event) => handleKeydown(view, event), paste: (view, event) => handlePaste(view, event), mousedown: (view, event) => handleMousedown(view, event) },
        handleKeyDown(view, event) {
          if (!['Backspace','Delete'].includes(event.key)) return false;
          const sel = view.state.selection
          if (!(sel instanceof CellSelection)) return false
          const { state } = view; let tr = state.tr; const cells=[]
          sel.forEachCell((cell,pos) => {
            const isHeader = cell.type.name === 'tableHeader'
            const editable = cell.attrs?.contenteditable !== false
            if (!isHeader && editable) cells.push({ cell, pos })
          })
          if (!cells.length) { event.preventDefault(); return true }
          for (let i = cells.length - 1; i >= 0; i--) {
            const { cell, pos } = cells[i]
            const empty = state.schema.nodes.paragraph.create()
            const newCell = cell.type.create(cell.attrs, empty, cell.marks)
            tr = tr.replaceWith(pos, pos + cell.nodeSize, newCell)
          }
          view.dispatch(tr); event.preventDefault(); return true
        }
      },
      onUpdate: ({ editor: currEditor }) => {
        // 先標記目前 row 是 dirty
        markCurrentRowDirty(currEditor);
        rowFocusCheck(currEditor);

        // 2️⃣ 驗證：稍微 debounce，只檢查 dirtyRows
        if (validateTimer) clearTimeout(validateTimer)
        validateTimer = setTimeout(() => {
          const rows = Array.from(dirtyRows);
          if (rows.length) {
            validateTableContent(currEditor, rows);
            dirtyRows.clear();
          }
        }, 200);
      },
    });
    validateTableContent(editor.value, new Set(Array.from({length: arrayData.length - 1}, (v, i) => arrayData.length - i - 1)));
  } else {
    // 已經有 editor → 只重設內容
    editor.value.commands.setContent(content, false);
    validateTableContent(editor.value, new Set(Array.from({length: arrayData.length - 1}, (v, i) => arrayData.length - i - 1)));
  }
}
// [新增功能] 比對並更新 PMS (呼叫後端)
async function syncPmsWithBackend() {
  const currentData = exportTableData(); 
  const machineCode = props.machine_id;

  if (!machineCode) {
    // alert("無法取得機台代碼，無法進行比對。");
    return;
  }

  try {
    const API = import.meta.env.VITE_APP_API_BASE_URL;
    const { data} = await axios.post(`${API}/mes/pms/pms-match`, { machine_id: machineCode, pmsData: currentData.pmsData });
    const { PMSData, added, removed } = data.data.data;

    // 3. 顯示變更通知
    let msg = "管理條件 PMS 已更新版本，請確認以下項目：\n";
    if (added.length !== 0 || removed.length !== 0) {
      const addmsg = added.map(pmsItem => `[新增] ${pmsItem} 項目`).join("\n");
      const delmsg = removed.map(pmsItem => `[移除] ${pmsItem} 項目`).join("\n");
      
      alert(msg + addmsg + delmsg);

      const newContent = getInitialTableContent(PMSData.map(pms => pms.slice(1)), PMSData.map(pms => pms[0]));
      editor.value.commands.setContent(newContent);
      
      // 觸發一次儲存以更新父層資料
      exportTableData();
    }
  } catch (e) {
    console.error(e);
    alert("系統錯誤，請稍後再試。");
  }
}

// Record update row index for later processing
function markCurrentRowDirty(editor) {
  if (!editor) return;
  const rowIndex = rowFocusCheck(editor);
  if (rowIndex > 0) dirtyRows.add(rowIndex);
}

// Handle keyboard event
function handleKeydown(view, event) {
  if (event.key !== 'Enter') return false;
  const rowIndex = view.state.selection.selection.$anchor.path[4];
  const colIndex = view.state.selection.selection.$anchor.path[7];
  // const rowIndex = editor.value.state.selection.$anchor.path[4];
  // const colIndex = editor.value.state.selection.$anchor.path[7];

  if (rowIndex > 0  && [4, 5, 6, 7, 8].includes(colIndex)) {
    event.preventDefault();
    return true;
  }

  return false;
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
// Copy Process
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
// Paste Process
function handlePaste(view, event) {
  const { state, dispatch } = view;
  const sel = state.selection;
  
  // 1. 取得並解析內容
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
      const startRowIndex = anchorPath[4];
      validateTableContent(editor.value, [startRowIndex]);
    }

    // 阻止瀏覽器原生貼上 (避免重複)
    event.preventDefault(); 
    return true; 
  }

  const rect = selectedRect(state);
  startRowIndex = rect.top;
  startColIndex = rect.left;

  // [保護] 禁止貼在 Index 0
  if (startColIndex === 0 || startRowIndex < 0 || startColIndex < 0) return false;

  // 3. 紀錄貼上的欄位
  let M = view.state.selection.$anchor.node(1).childCount;
  let N = view.state.selection.$anchor.node(2).childCount;

  let rowsPos = [1];
  for(let rowIndex = 0; rowIndex < tableNode.childCount; rowIndex++) rowsPos.push(rowsPos.at(-1) + tableNode.content.child(rowIndex).nodeSize);

  const targets = [];
  const impactedRowIndexes = range(startRowIndex, Math.min(M, startRowIndex + matrix.length));
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

  // 4. 從尾部節點開始更新欄位
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
    validateTableContent(editor.value, impactedRowIndexes);
  }

  event.preventDefault();
  return true;
}
// Mouse click Process
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
        // 使用 CellSelection.create 自動計算矩形範圍，注意：必須確保 anchor 和 head 在同一個 table 內，否則 create 會報錯，這裡用 try-catch 保護
        const newSelection = CellSelection.create(view.state.doc, startAnchorPos, foundCellPos);
        view.dispatch(view.state.tr.setSelection(newSelection));
      } catch (e) { }
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

function rowFocusCheck() { return (!editor.value) ? -1 : editor.value.state.selection.$anchor.path[4]; }

// Create table content
function getInitialTableContent(data, PmsIndex = null) {
  const table = { type: 'table', content: [] };
  for (let row = 0; row < data.length; row++) {
    let actionCell = { type: 'actionCell', attrs: { contenteditable: false, isPms: (PmsIndex == null || PmsIndex[row]) ? true : false }, content: [{ type: 'paragraph' }] };
    const row_data = data[row].map((text, index) => ({ type: row === 0 ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', content: (text.length != 0) ? [{ type: 'text', text }] : [] }], attrs: (row === 0 || LOCKCOLS.includes(index)) ? { contenteditable: (PmsIndex == null || PmsIndex[row]) ? false : true } : {} }));
    table.content.push({ type: 'tableRow', content: [actionCell, ...row_data] });
  }
  return { type: 'doc', content: [table] };
}

onMounted(() => { initOrReloadFromProps(); });
onUnmounted(() => {
  if (validateTimer) clearTimeout(validateTimer);
  exportTableData();

  // Destroy Table Editor
  if (editor.value) {
    editor.value.destroy();
    editor.value = null;
  }
  // Destroy Header Editor
  if (headerEditor.value) {
    headerEditor.value.destroy();
    headerEditor.value = null; // 🔥 關鍵修正：必須手動設為 null
  }
})
defineExpose({ initOrReloadFromProps, exportTableData, syncPmsWithBackend });
</script>


<style scoped>

.combination-block { border: 1px solid #ccc; padding: 15px; margin: 4px; border-radius: 8px; background-color: #f9f9f9; }

.management-header-block { display: flex; margin-bottom: 10px; justify-content: space-between; align-items: center; align-items: center; }
.management-header-block label { font-size: 18px; }
.management-main-function-block, .management-operation-block { display: flex; gap: 10px; align-items: center; }
.combination-btn {
  background-color: #1666C0;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 5px;
  font-size: 14px;
  cursor: pointer;
}

.combination-btn.del { background-color: #dc3545;  }

.menu.color { display: flex; gap: 5px; align-items: center; }
.font-color { width: 20px; height: 20px; border-radius: 50%; margin: 0px 4px; }
.font-color.red { background-color: red; }
.font-color.blue { background-color: blue; }
.font-color.black { background-color: black; }

/* Title Editor Style */
.header-editor-container { margin-bottom: 15px; background: #fff; border: 1px solid #ddd; border-radius: 4px; }
.title-editor-content :deep(.ProseMirror) { padding: 8px 12px; min-height: 40px; font-size: 16px; outline: none; }
.title-editor-content :deep(.ProseMirror p.is-editor-empty::before) { content: attr(data-placeholder); float: left; color: #adb5bd; pointer-events: none; height: 0; }

/* Tiptap 專用 CSS 樣式 */
.editor-content :deep(.action-cell-wrapper) { padding: 2px; background-color: #f1f3f5; vertical-align: middle; text-align: center; }
.editor-content :deep(.action-btn-group) { display: flex; justify-content: center; gap: 4px; }
.editor-content :deep(.act-btn) { width: 20px; height: 20px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; font-size: 14px; padding: 0; line-height: 1; }
.editor-content :deep(.act-btn.add) { color: #1c7ed6; background-color: #e7f5ff; }
.editor-content :deep(.act-btn.add:hover) { background-color: #d0ebff; }
.editor-content :deep(.act-btn.del) { color: #fa5252; background-color: #fff5f5; }
.editor-content :deep(.act-btn.del:hover) { background-color: #ffe3e3; }
.editor-content :deep(.act-btn.disabled) { opacity: 0.3; cursor: not-allowed; color: #adb5bd; background-color: #e9ecef; }

.editor-content :deep(.ProseMirror) { padding: 10px; outline: none; line-height: 1.5; }
.editor-content :deep(table) { border-collapse: collapse; width: 100%; margin: 10px 0px; table-layout: fixed; }
.editor-content :deep(th) { position:sticky; top:35px; z-index:5; }
.editor-content :deep(th), .editor-content :deep(td) { 
  border: 1px solid #ccc; 
  padding: 8px; 
  text-align: left; 
  vertical-align: middle; 
  min-height: 40px;
}

.editor-content :deep(p) { margin: 0px; }
.editor-content :deep(th), .editor-content :deep(td) { text-align: center; }

.management-tiptap-editor :deep(col:nth-child(1)) { width: 60px; } /* 新增: 操作欄 */
.management-tiptap-editor :deep(col:nth-child(2)) { width: 50px; } /* 項次 */
.management-tiptap-editor :deep(col:nth-child(3)) { width: 80px; } /* 槽體 */
.management-tiptap-editor :deep(col:nth-child(4)) { width: 100px; } /* 管理項目 */
.management-tiptap-editor :deep(col:nth-child(5)), 
.management-tiptap-editor :deep(col:nth-child(6)),
.management-tiptap-editor :deep(col:nth-child(7)),
.management-tiptap-editor :deep(col:nth-child(8)),
.management-tiptap-editor :deep(col:nth-child(9)) { width: 60px; }

.management-tiptap-editor :deep(col:nth-child(10)) { width: 60px; }
.management-tiptap-editor :deep(col:nth-child(11)) { width: 60px; }
.management-tiptap-editor :deep(col:nth-child(12)) { width: 60px; }
.management-tiptap-editor :deep(col:nth-child(13)) { width: 100px; }
.management-tiptap-editor :deep(col:nth-child(14)) { width: 100px; }

.editor-content :deep(.ProseMirror-focused td.selectedCell),
.editor-content :deep(.ProseMirror-focused th.selectedCell) {
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

.editor-content :deep(td.value-empty), .editor-content :deep(th.value-empty) { background-color: #fffee0; }
.editor-content :deep(td.value-error), .editor-content :deep(th.value-error) { background-color: #ffeaea; }
.editor-content :deep(td.value-invalid), .editor-content :deep(th.value-invalid) { background-color: #ffeaea; }
.editor-content :deep(td.has-focus){ background-color:#fff7cc; box-shadow: inset 0 0 0 2px #ff9800; }

.hint.empty { margin: 8px 0; color: #c62828; font-weight: 600; }

</style>