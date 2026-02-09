<template>
  <div class="blk-wrap">
    <!-- 沒有任何 PMS + 條件 → 禁用按鈕 -->
    <button class="btn add" @click="addBlock" :disabled="noAnyParams">新增下一層</button>

    <div v-for="(b,i) in blocks" :key="b.id" class="blk">
      <div class="blk-hd">
        <!-- 製程多選 -->
        <div class="spec-select">
          <label>製程：</label>
          <div class="spec-multi">
            <div class="spec-multi-trigger" :class="{ 'step-error': isSpecRequired && (!b.programLinks || !b.programLinks.length) }" @click="toggleSpecDropdown(i)">
              <span v-if="b.programLinks && b.programLinks.length">{{ b.programLinks.map(p => p.specCode).join('、') }}</span>
              <span v-else class="placeholder">請選擇製程（可多選）</span>
              <span class="caret">▼</span>
            </div>
            <div v-if="openSpecDropdownIndex === i" class="spec-multi-panel">
              <label v-for="opt in specOptions" :key="opt.code" class="spec-option">
                <input type="checkbox" :value="opt.code" :checked="isSpecChecked(i, opt.code)" @change="onToggleSpec(i, opt)"/>
                <span>{{ opt.name || opt.code }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 右邊：複製參數代碼 / block 操作 -->
        <div class="copybox">
          <label>參數代碼：</label>
          <input v-model="copyCode" placeholder="輸入要複製的代碼" />
          <button class="btn info" @click="copyFromCode(i)">複製</button>
        </div>
        <div class="ops">
          <button class="btn info" @click="addBlock" :disabled="noAnyParams">新增同層</button>
          <button class="btn info" @click="duplicateBlock(i)">複製模塊</button>
          <button class="btn danger" @click="delBlock(i)">刪除</button>
        </div>
      </div>

      <!-- 被選擇的製程 + 程式號碼 tag -->
      <div v-if="b.programLinks && b.programLinks.length" class="program-tags">
        <div v-for="link in b.programLinks" :key="link.programCode || link.specCode" class="program-tag">
          <span class="tag-spec">{{ link.specName || link.specCode }}</span>
          <span class="tag-code">{{ link.programCode || '尚未配號' }}</span>
          <button type="button" class="tag-remove" @click="removeProgram(i, link)" title="移除此製程與程式號碼">✕</button>
        </div>
      </div>

      <!-- ★ 兩邊都沒有資料：只顯示這句 -->
      <div v-if="noAnyParams" class="hint empty">選擇的機台無任何參數</div>

      <!-- 下面條件 / PMS table 原樣保留 -->
      <template v-else>
        <!-- ===== 條件表 (Condition) ===== -->
        <div v-if="hasConditions">
          <div v-if="condEditors[i]" class="menu">
            <div class="l">
              <button class="btn ghost" @click="addCondRow(i)">新增列</button>
              <button class="btn ghost danger" @click="delCondRow(i)">刪除列</button>
            </div>
            <div v-if="allowColor" class="r">
              <i class="dot blue" @click="setCellColor(i,'cond','#0000ff')"></i>
              <i class="dot black" @click="setCellColor(i,'cond','#000000')"></i>
            </div>
          </div>
          <EditorContent v-if="condEditors[i]" :editor="condEditors[i]" class="ed ed-cond"/>
        </div>
        <p v-else class="hint empty">此機台無條件參數</p>

        <!-- ===== PMS 參數表 (Parameter) ===== -->
        <div v-if="hasPms">
          <div v-if="paramEditors[i]" class="menu right">
            <div v-if="allowColor" class="r">
              <i class="dot blue" @click="setCellColor(i,'param','#0000ff')"></i>
              <i class="dot black" @click="setCellColor(i,'param','#000000')"></i>
            </div>
          </div>
          <EditorContent v-if="paramEditors[i]" :editor="paramEditors[i]" class="ed ed-param"/>
        </div>
        <p v-else class="hint empty">此機台無PMS資料</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount, watch, computed } from 'vue'
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

import { copyMcrFromCode, allocateProgramCode, releaseProgramCode } from '@/api/docsApi'

/* ===== Props ===== */
const props = defineProps({
  dataBlocks: { type: Array, default: () => [] },
  condTemplate:  { type: [Object, Array], default: null },
  paramTemplate: { type: [Object, Array], default: null },
  currentStep: { type: Number, default: 0 },

  hasPms:        { type: Boolean, default: true },
  hasConditions: { type: Boolean, default: true },
  specOptions: { type: Array, default: () => [] },

  // 用來配號，從 NewInstruction 傳進來 draftToken
  documentToken: { type: String, default: '' },
  allowColor: {type: Boolean, default: true},
  machines: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:dataBlocks','save'])

/* ===== TipTap extensions ===== */
const Base = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })]
const Hdr = TableHeader.extend({
  addAttributes() {
    return { ...(this.parent?.() || {}), cellType:{default:'text'}, contenteditable:{default:false} }
  }
})
const Row = TableRow.extend({
  content: '(tableCell | tableHeader)*',
  addAttributes() { return { ...(this.parent?.() || {}), class: { default: null } } },
})
const Cell = TableCell.extend({
  name: 'customTableCell',
  group: 'tableCell',
  addAttributes() {
    return {
      ...(this.parent?.() || {}),
      cellType: { default: 'text' },
      contenteditable: { default: true },
      class: { default: null },
      dropdownValue: { default: '' },
      dropdownOptions: { default: [] },
      dropdownColor: { default: '#000000' },
      colIndex: { default: null },
    }
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const td = document.createElement('td')
      if (node.attrs.class) td.classList.add(node.attrs.class)
      const isDropdown = node.attrs.cellType === 'dropdown'
      const locked = node.attrs.contenteditable === false || node.attrs.colIndex === 0

      if (isDropdown) {
        const select = document.createElement('select')
        select.className = 'cell-dropdown'
        select.style.color = node.attrs.dropdownColor
        select.innerHTML =
          `<option value="">-- 選擇 --</option>` +
          (node.attrs.dropdownOptions || [])
            .map(o => `<option value="${o.label}">${o.label}</option>`)
            .join('')
        select.value = node.attrs.dropdownValue || ''
        select.addEventListener('change', () => {
          const pos = getPos()
          if (typeof pos === 'number') {
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(pos, null, {
                ...node.attrs,
                dropdownValue: select.value,
              })
            )
          }
        })

        const box = document.createElement('div')
        box.className = 'dropdown-cell'
        box.appendChild(select)

        // hidden contentDOM lets CellSelection work
        const hidden = document.createElement('div')
        hidden.style.cssText = 'height:0;overflow:hidden;'
        box.appendChild(hidden)

        td.appendChild(box)
        td.contentEditable = 'false'
        return { dom: td, contentDOM: hidden, stopEvent: e => e.target === select }
      }

      td.classList.add('text-cell-wrapper')
      if (locked) td.contentEditable = 'false'
      return { dom: td, contentDOM: td }
    }
  },
})
const TableOnlyDoc = Document.extend({ content:'table' })
const TExt = [
  TableOnlyDoc, ...Base, Focus.configure({ className: 'has-focus', mode: 'all' }),
  Table.configure({ resizable:false, allowTableNodeSelection:true, handleWidth:5, cellMinWidth:50 }),
  Row, Hdr, Cell, History
]

/* ===== Reactive state ===== */
const lastExternalDataJson = ref('')
const blocks = ref([])          // 每個 block：{ id, programLinks[], data }
const condEditors = ref([])
const paramEditors = ref([])
const copyCode = ref('')
let idSeq = 0

// 控制哪一個 block 的「製程下拉」打開
const openSpecDropdownIndex = ref(null)
const noAnyParams = computed(() => !props.hasPms && !props.hasConditions)
const isSpecRequired = computed(() => {
  const opts = props.specOptions || []
  return opts.length > 0   // 有選項就視為必填
})

/* ===== 製程多選相關 ===== */
function toggleSpecDropdown(idx) {
  openSpecDropdownIndex.value = openSpecDropdownIndex.value === idx ? null : idx
}

function isSpecChecked(blockIdx, specCode) {
  const blk = blocks.value[blockIdx]
  if (!blk || !Array.isArray(blk.programLinks)) return false
  return blk.programLinks.some(p => p.specCode === specCode)
}

function updateBlockMetadataPrograms(blockIdx) {
  const blk = blocks.value[blockIdx]
  if (!blk) return

  // 從本地 programLinks 複製一份乾淨的 array 放進 metadata
  const programs = Array.isArray(blk.programLinks) ? blk.programLinks.map(p => ({ ...p })) : []

  blk.data = blk.data || {}
  blk.data.metadata = {
    ...(blk.data.metadata || {}),
    programs,   // ✅ 只存 programs，不存 mainSpec
  }
}
// 勾選 / 取消勾選製程 → 呼叫後端 allocate / release
async function onToggleSpec(blockIdx, opt) {
  const blk = blocks.value[blockIdx]
  if (!blk) return

  blk.programLinks = blk.programLinks || []
  const existsIdx = blk.programLinks.findIndex(p => p.specCode === opt.code)

  const onlyOneSpec = (props.specOptions || []).length === 1

  // ✅ 如果只有一個 specOption，且已經選過，就不允許取消
  if (onlyOneSpec && existsIdx >= 0) {
    // 直接忽略這次 change，不釋放、不動資料
    return
  }

  // 取消勾選 → 釋放程式號碼
  if (existsIdx >= 0) {
    const removed = blk.programLinks.splice(existsIdx, 1)[0]
    if (removed && removed.programCode) {
      try {
        await releaseProgramCode(removed.programCode)
      } catch (e) {
        console.error('releaseProgramCode failed', e)
        alert('程式號碼釋放失敗，請稍後再試')
      }
    }
    updateBlockMetadataPrograms(blockIdx)
    syncToParent()
    return
  }

  // 新增勾選 → 配號
  if (!props.documentToken) {
    alert('尚未取得草稿代碼，請先儲存或重新整理頁面')
    return
  }

  try {
    const data = await allocateProgramCode(opt.code, props.documentToken)
    const programCode = data?.programCode || ''
    if (!programCode) {
      throw new Error('後端未回傳程式號碼')
    }

    blk.programLinks.push({
      specCode: opt.code,
      specName: opt.name || opt.code,
      programCode,
    })
    updateBlockMetadataPrograms(blockIdx)
    syncToParent()
  } catch (e) {
    console.error('allocateProgramCode failed', e)
    alert('程式號碼配號失敗，請稍後再試')
  }
}
// 點 tag 上的 X → 移除某一個 programLinks（也會釋放程式號）
async function removeProgram(blockIdx, link) {
  const blk = blocks.value[blockIdx];
  if (!blk) return;

  if (!confirm(`確定要移除製程「${link.specName || link.specCode}」與程式號碼「${link.programCode || ''}」嗎？`)) {
    return;
  }

  blk.programLinks = (blk.programLinks || []).filter(p => !(p.specCode === link.specCode && p.programCode === link.programCode));

  if (link.programCode) {
    try {
      await releaseProgramCode(link.programCode);
    } catch (e) {
      console.error('releaseProgramCode failed', e);
      alert('程式號碼釋放失敗，請稍後再試');
    }
  }

  updateBlockMetadataPrograms(blockIdx);
  syncToParent();
}
function handleClickOutside(event) {
  // 如果目前沒有打開任何選單，就不做任何事
  if (openSpecDropdownIndex.value === null) return

  // 判斷點擊的目標元素 (event.target) 是否在 .spec-multi 容器內
  // 使用 .closest() 往上查找是否有包含特定 class 的父層
  const isInside = event.target.closest('.spec-multi')

  // 如果點擊目標不在容器內 (isInside 為 null)，代表點到了外面 -> 關閉選單
  if (!isInside) {
    openSpecDropdownIndex.value = null
  }
}
/* ===== Normalizers – accept flexible templates ===== */

// Is this a TipTap doc?
const isDoc = (x) => x && typeof x === 'object' && x.type === 'doc'

// Build condition table TipTap doc from lightweight template:
// template: Array<{name:string, options:Array<{label,value}>}>
function buildCondDocFromArray(templateArr) {
  const headers = ['條件名稱', ...templateArr.map(x => x.name)]
  const headerRow = {
    type:'tableRow',
    content: headers.map(h => ({
      type:'tableHeader',
      attrs:{ contenteditable:false },
      content:[{ type:'paragraph', content:[{ type:'text', text:h }] }]
    }))
  }
  const dataRow = {
    type:'tableRow',
    content: headers.map((_, colIdx) => {
      if (colIdx === 0) {
        return {
          type:'customTableCell',
          attrs:{ cellType:'text', contenteditable:false },
          content:[{ type:'paragraph', content:[{ type:'text', text: '組合1' }] }]
        }
      }
      const opts = templateArr[colIdx - 1]?.options || []
      return {
        type:'customTableCell',
        attrs:{ cellType:'dropdown', dropdownValue:'', dropdownOptions:opts, dropdownColor:'#000', contenteditable:false },
        content:[{ type:'paragraph' }]
      }
    })
  }
  return { type:'doc', content:[{ type:'table', content:[headerRow, dataRow] }] }
}
// Build parameter table TipTap doc from 2D array rows
// rows: string[][]
function buildParamDocFromRows(rows) {
  const LOCK_COLS = [0,1,7]
  const trows = rows.map((row, rIdx) => ({
    type:'tableRow',
    content: row.map((txt, cIdx) => ({
      type: rIdx === 0 ? 'tableHeader' : 'customTableCell',
      attrs:{ cellType:'text', contenteditable: (rIdx===0 || LOCK_COLS.includes(cIdx)) ? false : true },
      content:[{ type:'paragraph', content: txt ? [{ type:'text', text: String(txt) }] : [] }]
    }))
  }))
  return { type:'doc', content:[{ type:'table', content:trows }] }
}

function buildCondDocFromData(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return buildCondDocFromArray([])

  // 1. 取得 Header (來自後端回傳的第一列)
  const headers = rows[0] // ['條件名稱', 'CondA', 'CondB'...]
  
  // 2. 準備 Dropdown 選項 (來自 Props template)
  // 因為後端回傳的欄位順序可能跟 Template 不同，這裡假設後端已經依照 Template 順序整理過
  // 但為了保險，我們依據 props.condTemplate 的結構來對應 Column Dropdown Options
  // 假設 columns 1~N 對應 template[0~N-1]
  const templateArr = Array.isArray(props.condTemplate) ? props.condTemplate : []
  
  // 建構 Header Row
  const headerRow = { type: 'tableRow', content: headers.map(h => ({ type: 'tableHeader', attrs: { contenteditable: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: String(h) }] }] })) }

  // 建構 Data Rows (從 index 1 開始)
  const dataRows = rows.slice(1).map((row, rIdx) => {
    return {
      type: 'tableRow',
      content: row.map((val, cIdx) => {
        // 第 0 欄固定為項次 (Row Index)
        if (cIdx === 0) return { type: 'customTableCell', attrs: { cellType: 'text', contenteditable: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: String(rIdx + 1) }] }] };
        
        const colOpts = templateArr[cIdx - 1]?.options || []
        
        return {
          type: 'customTableCell',
          attrs: { 
            cellType: 'dropdown', 
            dropdownValue: String(val || ''), // 填入後端的數值
            dropdownOptions: colOpts,         // 保留前端的選項設定
            dropdownColor: '#000', 
            contenteditable: false 
          },
          content: [{ type: 'paragraph' }] // Dropdown 的內容在 NodeView 中渲染，這裡留空
        }
      })
    }
  })

  return { type: 'doc', content: [{ type: 'table', content: [headerRow, ...dataRows] }] }
}
// Public: normalize condition template → TipTap doc
function normalizeCondTemplate() {
  const t = props.condTemplate
  if (!t) return null
  if (isDoc(t)) return t
  if (Array.isArray(t)) return buildCondDocFromArray(t)
  // unknown → null
  return null
}
// Public: normalize parameter template → TipTap doc
function normalizeParamTemplate() {
  const t = props.paramTemplate
  if (!t) return null
  if (isDoc(t)) return t
  if (Array.isArray(t)) return buildParamDocFromRows(t)
  return null
}

/* ===== Tiny helpers ===== */
const range = (a, b) => Array.from({length: b - a}, (v, i) => i + a);
const getText = cellNode => {
  const paragraphs = cellNode.content?.content || [];
  return (cellNode.attrs.cellType === 'dropdown') ? cellNode.attrs.dropdownValue || "" : paragraphs.map(pNode => { return (pNode.content?.content || []).map(textNode => textNode.text || '').join('') }).join('\n');
}

/* ===== Editor init ===== */
function makeCondEditor(json, onUpdate) {
  const tmplDoc = normalizeCondTemplate()
  return new Editor({
    content: json || tmplDoc || buildCondDocFromArray([]), // last fallback: empty headers
    extensions: TExt,
    editorProps:{
      handleDOMEvents:{ drop:()=>true, dragstart:()=>true, mousedown:()=>false },
      handleKeyDown(view, event) {
        if (!['Backspace','Delete'].includes(event.key)) return false
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
    onUpdate({ editor }) {
      onUpdate?.({ editor })
      // keep parent’s mcrBlocks in sync with live edits
      syncToParent()
    }   
  })
}

function makeParamEditor(json, onUpdate) {
  const tmplDoc = normalizeParamTemplate()
  return new Editor({
    content: json || tmplDoc || buildParamDocFromRows([[]]),
    extensions: TExt,
    editorProps:{
      handleDOMEvents:{ drop:()=>true, dragstart:()=>true, mousedown: (view, event) => handleMousedown(view, event), copy: (view, event) => handleCopy(view, event), paste: (view, event) => handlePaste(view, event) },
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
    onUpdate({ editor }) {
      onUpdate?.({ editor })
      // keep parent’s mcrBlocks in sync with live edits
      syncToParent()
    }
  })
}
// 專門解析 Excel/Word 剪貼簿格式
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
// [重寫 3] 複製邏輯：確保輸出符合 Excel/TSV 規範
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
// [重寫 4] 貼上邏輯
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
      paramEditors.value.forEach(ed=> ed && runParamValueValidation(ed));
      runParamDuplicateValidation();
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
  console.log("targets: ", targets);
  console.log("targets: ", targets);

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
    paramEditors.value.forEach(ed=> ed && runParamValueValidation(ed));
    runParamDuplicateValidation();
  }

  event.preventDefault();
  return true;
}
function handleMousedown(view, event) {
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
// 修改 mapDataBlocksToInternal，增加 diffCollector 參數
function mapDataBlocksToInternal(dataBlocks, diffCollector = []) {
  return dataBlocks.map((blk, idx) => {
    const savedPrograms = blk.data?.metadata?.programs;
    const validLinks = (Array.isArray(blk.programLinks) && blk.programLinks.length > 0)
      ? blk.programLinks
      : (Array.isArray(savedPrograms) ? savedPrograms : []);
    
    // 找出製程名稱，用於 Alert 顯示
    const blockName = validLinks.map(p=>p.specName || p.specCode).join(',') || `Block #${idx+1}`;

    let finalParamData = blk.data?.arrayParameterData;
    let finalParamJson = blk.data?.jsonParameterContent;
    let finalCondData = blk.data?.arrayConditionData;
    let finalCondJson = blk.data?.jsonConditionContent;

    // --- PMS 同步 ---
    if (props.paramTemplate && Array.isArray(finalParamData) && finalParamData.length > 0) {
       const { rows, diffs } = syncPmsData(finalParamData, props.paramTemplate);
       
       if (diffs) {
         // 收集差異訊息
         const msgs = [];
         if (diffs.added.length) msgs.push(`新增 PMS: ${diffs.added.join(', ')}`);
         if (diffs.removed.length) msgs.push(`移除 PMS: ${diffs.removed.join(', ')}`);
         diffCollector.push(`【${blockName}】\n   ${msgs.join('\n   ')}`);
         
         finalParamData = rows;
         finalParamJson = null; // 強制重繪
       } else if (rows) {
          // 雖然沒 diff (欄位結構一致)，但為了保險起見使用新 template 結構的 rows (確保 header 文字等最新)
          finalParamData = rows;
       }
    } else if (props.paramTemplate && (!finalParamData || finalParamData.length === 0)) {
       finalParamData = props.paramTemplate;
       finalParamJson = null;
    }

    // --- Condition 同步 ---
    if (props.condTemplate && Array.isArray(finalCondData) && finalCondData.length > 0) {
       const { rows, diffs } = syncConditionData(finalCondData, props.condTemplate);
       
       if (diffs) {
         const msgs = [];
         if (diffs.added.length) msgs.push(`新增條件欄位: ${diffs.added.join(', ')}`);
         if (diffs.removed.length) msgs.push(`移除條件欄位: ${diffs.removed.join(', ')}`);
         diffCollector.push(`【${blockName}】\n   ${msgs.join('\n   ')}`);

         finalCondData = rows;
         finalCondJson = null; // 強制重繪
       }
    }

    return {
      id: idx,
      ...blk,
      programLinks: validLinks.map(p => ({ ...p })),
      data: {
        ...(blk.data || {}),
        arrayParameterData: finalParamData,
        jsonParameterContent: finalParamJson,
        arrayConditionData: finalCondData,
        jsonConditionContent: finalCondJson
      }
    }
  })
}

/* ===== Public actions（新增 / 刪除 / 複製 block） ===== */
function addBlock() {
  const id = idSeq++
  blocks.value.push({
    id,
    programLinks: [],
    data: {},
  })
  nextTick(() => initEditors(blocks.value.length - 1))
}
async function delBlock(i) {
  if (blocks.value.length === 1) return alert('至少需要保留一個組合')
  if (!confirm('確定要刪除此組合嗎？')) return

  const blk = blocks.value[i]

  // 2.2 刪除 block 時，釋放所有程式號碼
  if (blk && Array.isArray(blk.programLinks)) {
    for (const link of blk.programLinks) {
      if (!link.programCode) continue
      try {
        await releaseProgramCode(link.programCode)
      } catch (e) {
        console.error('releaseProgramCode failed', e)
      }
    }
  }

  condEditors.value[i]?.destroy()
  paramEditors.value[i]?.destroy()
  blocks.value.splice(i, 1)
  condEditors.value.splice(i, 1)
  paramEditors.value.splice(i, 1)

  nextTick(runAllValidations)
}

// 複製 block：先直接 clone 目前的 programLinks（共用同一組程式號碼）
// 如果你希望「複製時重新配一組新的程式號碼」，可以再改為呼叫 allocateProgramCode
async function duplicateBlock(i) {
  // 0. 檢查是否有 documentToken (配號必須)
  if (!props.documentToken) {
    alert('尚未取得草稿代碼，無法為複製的製程產生新編號，請先儲存草稿。')
    return
  }

  const src = blocks.value[i]
  const id = idSeq++

  // 1. 準備一個新的陣列來存放「新配號」的連結
  const newLinks = []

  // 2. 遍歷來源 Block 的製程，逐一向後端申請新號碼
  if (Array.isArray(src.programLinks)) {
    for (const link of src.programLinks) {
      // 如果來源沒有 specCode 則跳過
      if (!link.specCode) continue
      
      try {
        // 呼叫 API 配號
        const res = await allocateProgramCode(link.specCode, props.documentToken)
        const newCode = res?.programCode
        
        if (newCode) {
          newLinks.push({
            specCode: link.specCode,
            specName: link.specName || link.specCode,
            programCode: newCode // ★ 這裡使用後端回傳的新號碼
          })
        }
      } catch (e) {
        console.error(`複製模塊時配號失敗 (Spec: ${link.specCode})`, e)
        alert(`製程「${link.specName || link.specCode}」配號失敗，請稍後手動重試`)
        // 失敗時您可以選擇：
        // (A) 即使失敗也加入清單但不帶號碼 (讓使用者之後手動配) -> 如下行：
        // newLinks.push({ specCode: link.specCode, specName: link.specName })
        // (B) 或者直接略過該製程 (目前採略過策略)
      }
    }
  }

  // 3. 建立新 Block，使用 newLinks
  blocks.value.push({
    id,
    programLinks: newLinks, // ★ 使用新申請的陣列
    data: {
      ...(src.data || {}),
      // 複製編輯器內容 JSON
      jsonConditionContent: condEditors.value[i]?.getJSON() || null,
      jsonParameterContent: paramEditors.value[i]?.getJSON() || null,
      metadata: {
        ...(src.data?.metadata || {}),
        programs: newLinks,  // ★ Metadata 也要同步更新
      },
    },
  })

  // 4. 初始化編輯器並同步回父層
  nextTick(() => {
    initEditors(blocks.value.length - 1)
    syncToParent()
  })
}

/* ===== Updated copyFromCode (前端比對版 - 修正後) ===== */
async function copyFromCode(targetIdx) {
  if (!copyCode.value) {
    alert('請輸入要複製的代碼')
    return
  }
  const code = copyCode.value.trim()
  const tgt = blocks.value[targetIdx]
  if (!tgt) return

  // 檢查必要條件
  if (!props.machines || props.machines.length === 0) {
    alert('請先選擇機台，才能進行跨文件相容性檢查與複製。')
    return
  }
  if (!props.documentToken) {
    alert('尚未取得草稿代碼，無法為複製的製程產生新編號，請先儲存草稿。')
    return
  }

  try {
    const resp = await copyMcrFromCode({ program_code: code, machines: props.machines });
    
    if (!resp || !resp.success) {
      const msg = resp?.message || resp?.data?.message || '查無可複製的資料或條件不相容'
      alert(msg)
      return
    }

    const data = resp.data || {}
    const remoteBlocks = data.blocks || {}
    
    const addParams = remoteBlocks.add_params || []
    const delParams = remoteBlocks.del_params || []
    const addConds = remoteBlocks.add_conds || []
    const delConds = remoteBlocks.del_conds || []
    const sourcePrograms = remoteBlocks.source_programs || []
    
    // ★ 1. 宣告計數器
    let copiedCount = 0

    // 顯示差異提示
    const diffs = []
    if (addParams.length) diffs.push(`⚠️ 新增 PMS 參數: ${addParams.join(', ')}`)
    if (delParams.length) diffs.push(`⚠️ 移除 PMS 參數: ${delParams.join(', ')}`)
    if (addConds.length) diffs.push(`⚠️ 新增條件: ${addConds.join(', ')}`)
    if (delConds.length) diffs.push(`⚠️ 移除條件: ${delConds.join(', ')}`)

    if (diffs.length > 0) {
      alert(`複製成功，但檢測到機台基準已變更，系統已自動調整內容：\n\n${diffs.join('\n')}`)
    }

    // 2. 套用表格內容
    if (remoteBlocks.cond_json && condEditors.value[targetIdx]) {
      const newDoc = buildCondDocFromData(remoteBlocks.cond_json)
      condEditors.value[targetIdx].commands.setContent(newDoc)
      copiedCount++ // ★ 記得累加
    }
    
    if (remoteBlocks.param_json && paramEditors.value[targetIdx]) {
      const newDoc = buildParamDocFromRows(remoteBlocks.param_json)
      paramEditors.value[targetIdx].commands.setContent(newDoc)
      copiedCount++ // ★ 記得累加
    }

    // 3. 處理製程配號
    if (sourcePrograms.length > 0) {
      let msg = `來源包含 ${sourcePrograms.length} 個製程 (${sourcePrograms.map(p=>p.specName).join(',')})。`
      
      if (diffs.length > 0) {
        msg += `\n\n【檢測到機台基準變更】\n${diffs.join('\n')}`
      }

      msg += `\n\n是否要複製這些製程並自動產生新的程式代碼？\n(若選擇「取消」則只複製表格內容)`

      if (confirm(msg)) {
        // 先釋放舊的
        if (tgt.programLinks && tgt.programLinks.length) {
          for (const link of tgt.programLinks) {
            if (link.programCode) {
                await releaseProgramCode(link.programCode).catch(err => console.error(err))
            }
          }
        }
        tgt.programLinks = []

        // 配新號
        const newLinks = []
        for (const srcProg of sourcePrograms) {
          if (!srcProg.specCode) continue
          try {
            const allocResp = await allocateProgramCode(srcProg.specCode, props.documentToken)
            const newCode = allocResp.programCode
            if (newCode) {
              newLinks.push({
                specCode: srcProg.specCode,
                specName: srcProg.specName || srcProg.specCode,
                programCode: newCode
              })
            }
          } catch (err) {
            console.error(`配號失敗: ${srcProg.specCode}`, err)
          }
        }
        tgt.programLinks = newLinks
        updateBlockMetadataPrograms(targetIdx)
        copiedCount++ // ★ 記得累加
      } else {
        if (diffs.length > 0) {
          alert(`表格內容已更新。\n\n【變更明細】\n${diffs.join('\n')}`)
        }
      }
    } else {
      if (diffs.length > 0 && copiedCount === 0) {
        // 如果只有 diff 但沒有 copy 動作 (例如兩個表格都沒變但有 diff? 理論上不會發生，保險起見)
        // 這裡通常是 copedCount > 0 才會跳 alert
      } else if (copiedCount > 0 && diffs.length === 0) {
         alert('複製成功！')
      }
    }

    if (copiedCount > 0) {
      runAllValidations()
      syncToParent()
    } else {
      alert('複製來源的內容為空或未進行變更。')
    }

  } catch (e) {
    console.error('copyFromCode remote failed', e)
    const msg = e?.response?.data?.message || e.message || '複製失敗'
    alert(msg)
  }
}
/* ===== 資料同步 Helper: 將舊資料 (Saved) 合併入新結構 (Template) ===== */

// 同步 PMS：比對 (Index 0:槽體 + Index 1:管理項目)
function syncPmsData(savedArrayData, templateRows) {
  if (!templateRows || templateRows.length === 0) return { rows: null, diffs: null };
  // 如果沒有舊資料，直接用 Template，不視為差異（或是視為全部新增? 通常視為初始化，不需通知）
  if (!savedArrayData || savedArrayData.length === 0) return { rows: templateRows, diffs: null };

  const savedMap = new Map();
  // 建立舊資料查找表 (Key: "槽體-管理項目")
  savedArrayData.slice(1).forEach(row => {
    // ★ 關鍵：使用 0(槽體) 和 1(管理項目) 作為比對基準
    const key = `${row[0] || ''}-${row[1] || ''}`;
    savedMap.set(key, row);
  });

  const newRows = [];
  const added = [];
  
  // Header
  newRows.push([...templateRows[0]]);

  // 遍歷 Template (最新標準)
  templateRows.slice(1).forEach((tmplRow, idx) => {
    const key = `${tmplRow[0] || ''}-${tmplRow[1] || ''}`;
    const savedRow = savedMap.get(key);

    if (savedRow) {
      // 舊資料有 -> 保留數值 (Index 2~6)
      const mergedRow = [...tmplRow];
      for (let c = 2; c <= 6; c++) {
        mergedRow[c] = savedRow[c];
      }
      // 保留備註 (最後一欄)
      if (savedRow.length > tmplRow.length) {
         mergedRow[mergedRow.length - 1] = savedRow[savedRow.length - 1]; 
      }
      // 移除 map 中的紀錄，剩下的就是「被移除」的
      savedMap.delete(key); 
      newRows.push(mergedRow);
    } else {
      // 舊資料沒有 -> 視為新增
      added.push(key);
      newRows.push([...tmplRow]);
    }
  });

  // 剩下的 savedMap 就是「被移除」的 (新標準已經沒有這個參數了)
  const removed = Array.from(savedMap.keys());

  return { 
    rows: newRows, 
    diffs: (added.length > 0 || removed.length > 0) ? { added, removed } : null 
  };
}

// 同步 Conditions：比對 Column Name
function syncConditionData(savedArrayData, templateStruct) {
  if (!templateStruct || templateStruct.length === 0) return { rows: null, diffs: null };
  if (!savedArrayData || savedArrayData.length === 0) return { rows: null, diffs: null };

  const savedHeader = savedArrayData[0];
  const templateNames = templateStruct.map(t => t.name);

  // 比對 Header
  // 舊資料的 Header (排除第0欄 '條件名稱')
  const oldCols = savedHeader.slice(1);
  const newCols = templateNames;

  const added = newCols.filter(c => !oldCols.includes(c));
  const removed = oldCols.filter(c => !newCols.includes(c));

  if (added.length === 0 && removed.length === 0) {
      return { rows: savedArrayData, diffs: null }; // 沒變
  }

  // 執行重組 (邏輯同前)
  const colMap = new Map();
  templateStruct.forEach(t => {
     const idx = savedHeader.indexOf(t.name);
     if (idx > -1) colMap.set(t.name, idx);
  });

  const newRows = [];
  const newHeader = ['條件名稱', ...templateNames];
  newRows.push(newHeader);

  const savedBody = savedArrayData.slice(1);
  savedBody.forEach((oldRow, rIdx) => {
    const newRow = [];
    newRow.push(String(rIdx + 1)); // 更新項次

    templateStruct.forEach(t => {
      const oldIdx = colMap.get(t.name);
      if (oldIdx !== undefined) {
        newRow.push(oldRow[oldIdx]);
      } else {
        newRow.push("");
      }
    });
    newRows.push(newRow);
  });

  return { 
      rows: newRows, 
      diffs: { added, removed } 
  };
}

/* ===== Condition table row ops (unchanged logic) ===== */
function rowFocusCheck(ed) { return (!ed) ? -1 : ed.state.selection.$anchor.path[4]; }
function addCondRow(i){
  const ed = condEditors.value[i]; if (!ed) return
  const selRowIdx = rowFocusCheck(ed);
  if (selRowIdx < 0){ alert('請選擇一個儲存格'); return }
  ed.chain().focus().addRowAfter().run()

  nextTick(()=>{
    const { state, view } = ed
    const tr = state.tr
    let rowIdx = 0, newRowNode=null, newRowPos=null
    state.doc.descendants((n,p)=>{
      if(n.type.name==='tableRow'){
        if (rowIdx === selRowIdx + 1){ newRowNode = n; newRowPos = p }
        rowIdx++
      }
    })
    if(!newRowNode) return

    // derive dropdown options from current header template
    const tdoc = normalizeCondTemplate()
    const header = tdoc?.content?.[0]?.content?.[0] // tableRow
    const optionCols = []
    if (header?.type === 'tableRow') {
      // header: ['條件名稱', ...]
      // use props.condTemplate (array form) if provided
      if (Array.isArray(props.condTemplate)) {
        optionCols.push(...props.condTemplate.map(x => x.options || []))
      } else {
        // fallback: empty options
        const count = (header.content?.length || 1) - 1
        optionCols.push(...Array.from({length: Math.max(0, count)}, ()=>[]))
      }
    }

    let offset = 1, ci = 0
    newRowNode.forEach((cellNode)=>{
      const cpos = newRowPos + offset
      const repl = (ci===0)
        ? state.schema.nodes.customTableCell.create(
            { cellType:'text', contenteditable:false },
            state.schema.nodes.paragraph.create(null, state.schema.text(String(selRowIdx)))
          )
        : state.schema.nodes.customTableCell.create(
            { cellType:'dropdown', dropdownValue:'', dropdownOptions: optionCols[ci-1] || [], dropdownColor: '#000', contenteditable: false },
            state.schema.nodes.paragraph.create()
          )
      tr.replaceWith(cpos, cpos + cellNode.nodeSize, repl)
      offset += cellNode.nodeSize; ci++
    })
    if (tr.docChanged) view.dispatch(tr)
    updateCondRowNumbers(ed); runCondValidation()
  })
}
function delCondRow(i){
  const ed = condEditors.value[i]; if (!ed) return;
  const selRowIdx = rowFocusCheck(ed);
  if (selRowIdx < 0) return alert('請選擇要刪除的列');
  if (selRowIdx == 0) return alert('無法刪除表頭');
  ed.chain().focus().deleteRow().run();
  nextTick(()=>{ updateCondRowNumbers(ed); runCondValidation() });
}
function updateCondRowNumbers(ed){
  const { state, view } = ed
  const tr = state.tr
  const table = state.doc.content.firstChild
  if (!table || table.type.name!=='table') return
  const updates = []
  let rowIdx = 0
  state.doc.descendants((node,pos)=>{
    if(node.type.name==='tableRow'){
      if(rowIdx>0){
        const firstCell = node.firstChild
        if(firstCell){ const cellPos = pos + 1; updates.push({ cellPos, node:firstCell, number: rowIdx }) }
      }
      rowIdx++
    }
  })
  for (let k = updates.length - 1; k >= 0; k--){
    const u = updates[k]
    const newCell = state.schema.nodes.customTableCell.create(
      { cellType:'text', contenteditable:false },
      state.schema.nodes.paragraph.create(null, state.schema.text("組合" + String(u.number)))
    )
    tr.replaceWith(u.cellPos, u.cellPos + u.node.nodeSize, newCell)
  }
  if(tr.docChanged) view.dispatch(tr)
}

/* ===== Coloring ===== */
function setCellColor(i,type,color){
  const ed = (type==='cond')?condEditors.value[i]:paramEditors.value[i]; if(!ed) return
  const { state, view } = ed; const { selection } = state; const tr = state.tr
  if (selection instanceof CellSelection){
    selection.forEachCell((cell,pos)=>{
      if (cell.attrs.cellType==='dropdown') tr.setNodeMarkup(pos, undefined, { ...cell.attrs, dropdownColor:color })
      else {
        const m = state.schema.marks.textStyle
        state.doc.nodesBetween(pos, pos+cell.nodeSize, (n,p)=>{ if(n.isText) tr.addMark(p, p+n.nodeSize, m.create({ color })) })
      }
    })
    if(tr.docChanged) view.dispatch(tr); return
  }
  const $p = state.doc.resolve(selection.from); let c=null, cpos=null
  for(let d=$p.depth; d>0; d--){ const n=$p.node(d); if(n.type.name==='customTableCell'||n.type.name==='tableCell'){ c=n; cpos=$p.before(d); break } }
  if(c && c.attrs.cellType==='dropdown'){ tr.setNodeMarkup(cpos, undefined, { ...c.attrs, dropdownColor:color }); view.dispatch(tr) }
  else ed.chain().focus().setColor(color).run()
}

/* ===== Validation (unchanged) ===== */
function runCondValidation(){
  const sigMap = new Map()
  console.log("================================")
  condEditors.value.forEach((ed, bIdx)=>{
    if(!ed) return;

    const { state } = ed;
    const N = state.doc.content.firstChild.content.childCount;

    let rowsPos = [1];
    for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
    for(let rowIndex = 1; rowIndex < N; rowIndex++) {
      const rowText = JSON.stringify(state.doc.content.firstChild.content.child(rowIndex).content.content.slice(1).map(cellNode => getText(cellNode)));
      const attrs = state.doc.content.firstChild.content.child(rowIndex).attrs;
      if (!sigMap.has(rowText)) sigMap.set(rowText, []);
      sigMap.get(rowText).push({ bIdx, pos: rowsPos[rowIndex], attrs });
    }
  })

  const dupIdx = [];
  const uniIdx = [];
  for(const indices of sigMap.values()) {
    if (indices.length > 1) indices.forEach(i => dupIdx.push(i));
    else uniIdx.push(indices[0]);
  }

  dupIdx.toReversed().forEach(idx => {
    const { state, view } = condEditors.value[idx.bIdx];
    const tr = state.tr;
    tr.setNodeMarkup(idx.pos, undefined, { attrs: idx.attrs, class: 'dup-table' });
    if(tr.docChanged) view.dispatch(tr);
  })

  uniIdx.toReversed().forEach(idx => {
    const { state, view } = condEditors.value[idx.bIdx];
    const tr = state.tr;
    tr.setNodeMarkup(idx.pos, undefined, { attrs: idx.attrs, class: '' });
    if(tr.docChanged) view.dispatch(tr);
  })
}
function getParamMatrix(ed){
  const mat = ed.state.doc.content.firstChild.content.content.slice(1).map(rowNode => {
    return rowNode.content.content.slice(2, 7).map(cellNode => getText(cellNode));
  })
  return JSON.stringify(mat)
}
function runParamDuplicateValidation() {
  const sigMap = new Map();
  paramEditors.value.forEach((ed, idx) => {
    if (!ed) return;
    const sig = getParamMatrix(ed);

    if (!sigMap.has(sig)) sigMap.set(sig, []);
    sigMap.get(sig).push(idx);
  });

  const dupIdx = new Set();
  const uniIdx = new Set();
  for(const indices of sigMap.values()) {
    if (indices.length > 1) indices.forEach(i => dupIdx.add(i));
    else uniIdx.add(indices[0]);
  }

  dupIdx.forEach(idx => {
    const { state, view } = paramEditors.value[idx];
    const tr = state.tr;
    const N = state.doc.content.firstChild.content.childCount

    let rowsPos = [1];
    for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
    for(let rowIndex = N - 1; rowIndex > 0; rowIndex--) {
      tr.setNodeMarkup(rowsPos[rowIndex], undefined, { ...rowsPos[rowIndex].attrs, class: 'dup-table' })
    }
    if(tr.docChanged) view.dispatch(tr);
  })

  uniIdx.forEach(idx => {
    const { state, view } = paramEditors.value[idx];
    const tr = state.tr;
    const N = state.doc.content.firstChild.content.childCount

    let rowsPos = [1];
    for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
    for(let rowIndex = N - 1; rowIndex > 0; rowIndex--) {
      tr.setNodeMarkup(rowsPos[rowIndex], undefined, { ...rowsPos[rowIndex].attrs, class: '' })
    }
    if(tr.docChanged) view.dispatch(tr);
  })
}
function runParamValueValidation(ed) {
  if (!ed) return;
  const { state, view } = ed; let tr = state.tr;
  let changed = false;
  
  const N = state.doc.content.firstChild.content.childCount;
  let rowsPos = [1];
  for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
  for(let rowIndex = N - 1; rowIndex > 0; rowIndex--){
    if (rowIndex >= state.doc.content.firstChild.content.childCount) return;
    const rowNode = state.doc.content.firstChild.content.child(rowIndex);
    const rowPos = rowsPos[rowIndex];
    const cells = rowNode.content;

    const cellPos = [rowPos + 1];
    const value = [];
    const valueStatus = [];
    for(let index = 0; index < cells.childCount - 1; index++) cellPos.push(cellPos.at(-1) + cells.child(index).nodeSize);

    for(let index = 2; index < 7; index++) {
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
      const cellNode = cells.child(2 + offset);
      const newClass = 'value-' + valueStatus[offset];

      if (cellNode.attrs.class === newClass) continue;

      const newAttrs = { ...cellNode.attrs, class: newClass };
      tr.setNodeMarkup(cellPos[2 + offset], cellNode.type, newAttrs, cellNode.marks);
      changed = true;
    }
  }
  if (changed) view.dispatch(tr);
}
function runAllValidations(){
  runCondValidation()
  paramEditors.value.forEach(ed=> ed && runParamValueValidation(ed))
  runParamDuplicateValidation()
}

/* ===== init per index ===== */
function initEditors(i) {
  const b = blocks.value[i]
  if (props.hasConditions) {
    condEditors.value[i] = makeCondEditor(
      b.data?.jsonConditionContent || null,
      () => { runCondValidation() }
    )
  }
  if (props.hasPms){
    paramEditors.value[i] = makeParamEditor(
      b.data?.jsonParameterContent || null,
      ({ editor }) => { runParamValueValidation(editor); runParamDuplicateValidation() }
    )
  }
  nextTick(runAllValidations)
}

/* ===== Mount / Unmount ===== */
// Mount
onMounted(() => {
  if (!props.dataBlocks.length) {
    addBlock();
  } else {
    // 準備收集器
    const diffs = [];
    blocks.value = mapDataBlocksToInternal(props.dataBlocks, diffs);

    // 如果有差異，顯示通知
    if (diffs.length > 0) {
      alert(`檢測到機台規範已更新，系統已自動同步下列內容：\n\n${diffs.join('\n\n')}`);
    }

    // blocks.value = props.dataBlocks.map((blk, idx) => { return { id: idx, ...blk } });
    blocks.value.forEach((_, i) => initEditors(i));
    idSeq = blocks.value.length + 1;
  }
  nextTick(syncToParent);
  lastExternalDataJson.value = JSON.stringify(props.dataBlocks || []);
  window.addEventListener('click', handleClickOutside);
})

// Watch dataBlocks（外部載草稿 / 換機台時）
watch(() => props.dataBlocks, async (newBlocks) => {
    const json = JSON.stringify(newBlocks || [])
    if (json === lastExternalDataJson.value) return

    // 1️⃣ 收集舊 blocks 裡全部的 programCode
    const oldCodes = new Set()
    blocks.value.forEach(b => {
      (b.programLinks || []).forEach(p => {
        if (p.programCode) oldCodes.add(p.programCode)
      })
    })

    // 2️⃣ 收集 newBlocks 裡的 programCode（避免釋放還存在的）
    const newCodes = new Set()
    ;(newBlocks || []).forEach(b => {
      const metaPrograms =
        b.data && b.data.metadata && Array.isArray(b.data.metadata.programs)
          ? b.data.metadata.programs
          : []
      const localPrograms = Array.isArray(b.programLinks) ? b.programLinks : []

      const all = [...metaPrograms, ...localPrograms]
      all.forEach(p => {
        if (p.programCode) newCodes.add(p.programCode)
      })
    })

    const toRelease = [...oldCodes].filter(c => !newCodes.has(c))

    // 3️⃣ 釋放這些「舊有、但新資料已經沒有」的程式代碼
    for (const code of toRelease) {
      try {
        await releaseProgramCode(code)
      } catch (e) {
        console.error('releaseProgramCode on dataBlocks-change failed:', code, e)
      }
    }

    // 4️⃣ 原本 destroy / 重建的流程保留
    condEditors.value.forEach(e => e?.destroy())
    paramEditors.value.forEach(e => e?.destroy())
    condEditors.value = []
    paramEditors.value = []

    if (!newBlocks || !newBlocks.length) {
      blocks.value = []
      addBlock()
    } else {
      const diffs = [];
      blocks.value = mapDataBlocksToInternal(newBlocks, diffs);
      
      // 這裡通常是切換上一步/下一步，或者重新載入草稿時觸發
      if (diffs.length > 0) {
         alert(`檢測到機台規範已更新，系統已自動同步下列內容：\n\n${diffs.join('\n\n')}`);
      }

      // blocks.value = newBlocks.map((blk, idx) => { return { id: idx, ...blk } });
      blocks.value.forEach((_, i) => initEditors(i));
      idSeq = blocks.value.length + 1;
    }

    nextTick(runAllValidations)
    lastExternalDataJson.value = json
  }, { deep: true }
)
watch(
  () => ({
    hasPms: props.hasPms,
    hasConditions: props.hasConditions,
    condTemplate: props.condTemplate,
    paramTemplate: props.paramTemplate,
  }),
  () => {
    if (blocks.value.length > 0) {
      // 這裡的邏輯稍微複雜，因為編輯器可能已經有使用者輸入的暫存內容
      // 如果要「即時」套用新 Template，會覆蓋掉使用者還沒存檔的輸入嗎？
      // 為了安全，通常只有在「初始化」階段做同步。
      // 但如果您的情境是：使用者載入頁面 -> API 載入 Template -> 此時畫面要更新
      // 那我們可以這樣做：
      const diffs = [];
      const updatedBlocks = mapDataBlocksToInternal(blocks.value, diffs);
      
      // 如果 Template 載入較慢，導致現在才發生同步，也要通知
      if (diffs.length > 0) {
        alert(`檢測到機台規範已更新，系統已自動同步下列內容：\n\n${diffs.join('\n\n')}`);
      }
      
      // 更新編輯器內容 (只更新有變動的)
      updatedBlocks.forEach((newBlk, i) => {
        const oldBlk = blocks.value[i];
        
        if (newBlk.data.jsonParameterContent === null && paramEditors.value[i]) {
          const newDoc = buildParamDocFromRows(newBlk.data.arrayParameterData);
          paramEditors.value[i].commands.setContent(newDoc);
          oldBlk.data.arrayParameterData = newBlk.data.arrayParameterData;
          oldBlk.data.jsonParameterContent = null; // 標記已更新
        }
        
        if (newBlk.data.jsonConditionContent === null && condEditors.value[i]) {
          const newDoc = buildCondDocFromData(newBlk.data.arrayConditionData);
          condEditors.value[i].commands.setContent(newDoc);
          oldBlk.data.arrayConditionData = newBlk.data.arrayConditionData;
          oldBlk.data.jsonConditionContent = null;
        }
      });
    }

    // hasPms / hasConditions 從 false -> true 或 template 準備好時，
    // 幫現有的 blocks 補上 Editor
    blocks.value.forEach((b, i) => {
      if (props.hasConditions && !condEditors.value[i]) {
        condEditors.value[i] = makeCondEditor(
          b.data?.jsonConditionContent || null,
          () => {
            runCondValidation()
          }
        )
      }

      if (props.hasPms && !paramEditors.value[i]) {
        paramEditors.value[i] = makeParamEditor(
          b.data?.jsonParameterContent || null,
          ({ editor }) => {
            runParamValueValidation(editor)
            runParamDuplicateValidation()
          }
        )
      }
    })

    nextTick(runAllValidations)
  },
  { immediate: false }
)
watch(
  () => props.specOptions,
  async (opts) => {
    console.log("specOptions: ", opts);
    const list = opts || [];
    // ✅ 只有一個選項時才啟動
    if (list.length !== 1) return;

    const only = list[0];
    if (!only || !only.code) return;

    // 沒有 documentToken 不能配號，只先跳過
    if (!props.documentToken) return;

    for (let i = 0; i < blocks.value.length; i++) {
      const blk = blocks.value[i];
      if (!blk) continue;

      blk.programLinks = blk.programLinks || [];
      const already = blk.programLinks.some(p => p.specCode === only.code);
      if (already) continue;   // 這個 block 已經有了就不用再配

      try {
        const data = await allocateProgramCode(only.code, props.documentToken);
        const programCode = data?.programCode || '';
        if (!programCode) continue;

        blk.programLinks.push({ specCode: only.code, specName: only.name || only.code, programCode });
        updateBlockMetadataPrograms(i);
      } catch (e) {
        console.error('auto allocateProgramCode failed', e);
      }
    }

    syncToParent();
  },
  { immediate: true }
)

// Unmount 時 emit save
onBeforeUnmount(() => {
  const payload = exportData();
  emit('save', payload);
  condEditors.value.forEach(e => e?.destroy());
  condEditors.value = [];
  paramEditors.value.forEach(e => e?.destroy());
  paramEditors.value = [];
  window.removeEventListener('click', handleClickOutside);
})

/* ===== Export to parent ===== */
function extractTableArray(ed) {
  return (!ed) ? [] : ed.state.doc.content.firstChild.content.content.map(rowNode => (rowNode.content.content.map(cellNode => getText(cellNode))));
}

function exportData() {
  return blocks.value.map((b, i) => {
    return {
      id: b.id,
      // ✅ 不再輸出 programLinks，真正要存的在 metadata.programs
      data: {
        jsonConditionContent: condEditors.value[i]?.getJSON() || null,
        arrayConditionData:   extractTableArray(condEditors.value[i]),
        jsonParameterContent: paramEditors.value[i]?.getJSON() || null,
        arrayParameterData:   extractTableArray(paramEditors.value[i]),
        metadata: b.data?.metadata || {},
      },
    }
  })
}

let emitTimer = null
function syncToParent() {
  clearTimeout(emitTimer)
  emitTimer = setTimeout(() => {
    const payload = exportData()
    console.log("sync to parent")
    lastExternalDataJson.value = JSON.stringify(payload || [])
    emit('update:dataBlocks', payload)
  }, 150)
}

defineExpose({ exportData })
</script>

<style scoped>
.btn{padding:6px 12px;border:none;border-radius:6px;color:#fff;background:#007bff;cursor:pointer}
.btn:hover{opacity:.9}
.btn.add { margin: 10px; background-color: #1666C0; padding: 8px 12px; border-radius: 5px; font-size: 14px; cursor: pointer;}
.btn.info{background:#17a2b8}
.btn.danger{background:#dc3545}
.btn.ghost{margin-right: 8px;background:#f0f8ff;border:1px solid #007bff;color:#007bff}
.btn.ghost.danger{border-color:#dc3545;color:#dc3545}
.blk{border:2px solid #ddd;border-radius:8px;padding:12px;margin-bottom:14px;background:#fafafa}
.blk-hd{display:flex;gap:12px;align-items:center;justify-content:space-between;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:10px}
.copybox{display:flex;align-items:center;gap:8px}
.ops{display:flex;gap:8px}
.menu{display:flex;justify-content:space-between;align-items:center;padding:8px;border:1px solid #eee;border-radius:6px;background:#fff;margin:8px 0}
.menu.right{justify-content:flex-end}
.dot{display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:pointer}
.red{background:#f00}.blue{background:#00f}.black{background:#000}
.ed{background:#fff;border:1px solid #ddd;border-radius:6px;margin-bottom:10px}
.ed :deep(.ProseMirror){padding:8px;min-height:80px;outline:none}
.ed :deep(table){border-collapse:collapse;width:100%;table-layout:fixed}
.ed :deep(th),.ed :deep(td){border:1px solid #ddd;padding:8px;text-align:center;vertical-align:middle;min-width:72px;position:relative}
.ed :deep(th){background:#f8f9fa;font-weight:700;position:sticky;top:35px;z-index:5;}
.ed :deep(.selectedCell){background:#e3f2fd!important;outline:2px solid #2196f3;outline-offset:-2px}
.ed :deep([contenteditable="false"]){background:#f5f5f5;color:#666;cursor:not-allowed}
.ed :deep(tr.dup-row td){background:#ffe6e6!important}      /* 5.1 duplicate row: red-ish */
.ed :deep(tr.dup-table td){background:#ffe6e6!important}    /* 6.3 duplicate table: red-ish */
.ed :deep(td.value-empty){background:#fff7c2}               /* 6.4.2 empty: yellow */
.ed :deep(td.value-invalid),.ed :deep(td.value-error){background:#ffcdd2} /* 6.4.3 invalid: red */
.ed :deep(.dropdown-cell){width:100%;padding:4px}
.ed :deep(.cell-dropdown){width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;background:#fff}
.ed :deep(.cell-dropdown:focus){outline:2px solid #2196f3;border-color:#2196f3}
.ed :deep(td.has-focus){ background-color:#fff7cc; box-shadow: inset 0 0 0 2px #ff9800; }

.ed :deep(col:nth-child(1)) { width: 75%; } /* 槽體/測試點 */
.ed :deep(col:nth-child(2)) { width: 100%; } /* 槽體/測試點 */
.ed :deep(col:nth-child(3)) { width: 100%; } /* 槽體/測試點 */
.ed :deep(col:nth-child(4)) { width: 100%; } /* 槽體/測試點 */
.ed :deep(col:nth-child(5)) { width: 100%; } /* 槽體/測試點 */
.ed :deep(col:nth-child(6)) { width: 100%; } /* 槽體/測試點 */
.ed :deep(col:nth-child(7)) { width: 100%; } /* 槽體/測試點 */
.ed :deep(col:nth-child(8)) { width: 33%; } /* 槽體/測試點 */
.ed :deep(col:nth-child(9)) { width: 100%; } /* 槽體/測試點 */

.hint { margin: 6px 0; color: #555; }
.hint.empty { margin: 8px 0; color: #c62828; font-weight: 600; }

.spec-select { display: flex; align-items: center; gap: 8px; }
.spec-multi { position: relative; min-width: 260px; }
.spec-multi-trigger {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #fff;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}
.spec-multi-trigger .placeholder { color: #999; }
.spec-multi-trigger .caret { margin-left: 8px; font-size: 10px; }
.spec-multi-trigger.step-error { background-color: #ffcdd2;}
.spec-multi-panel {
  position: absolute;
  top: 105%;
  left: 0;
  right: 0;
  max-height: 220px;
  overflow: auto;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #ddd;
  box-shadow: 0 4px 10px rgba(0,0,0,.08);
  padding: 6px 8px;
  z-index: 20;
}

.spec-option { display: flex; align-items: center; gap: 6px; padding: 4px 2px; font-size: 13px; cursor: pointer; }
.spec-option:hover { background: #f5f8ff; }

.program-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
.program-tag { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; background: #eef4ff; border: 1px solid #c3d3ff; font-size: 12px; }

.tag-spec { font-weight: 600; color: #1a3d8f; }
.tag-code { font-family: monospace; padding: 0 4px; background: #fff; border-radius: 4px; border: 1px dashed #b0c4ff; }
.tag-remove { border: none; background: transparent; cursor: pointer; font-size: 12px; line-height: 1; color: #888; }
.tag-remove:hover { color: #c62828; }

</style>