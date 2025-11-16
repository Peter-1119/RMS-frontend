<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { Editor, EditorContent } from '@tiptap/vue-3'
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

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ''

/* ---------- Custom cells with contenteditable attr ---------- */
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
})

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
})

/* ---------- props / v-model ---------- */
const props = defineProps({
  modelValue: { type: Object, default: () => ({ mode: 'table', cols: 9, header_json: null, items: [], file: null }) },
  cols: { type: Number, default: 9 },
  token: { type: String, default: '' },
  machineCode: { type: String, default: '' },   // 第一台 MACHINE_CODE
})
const emit = defineEmits(['update:modelValue'])

const clone = v => { try { return JSON.parse(JSON.stringify(v)) } catch { return v } }
const m = ref(clone(props.modelValue))
if (!m.value) m.value = {}
if (!Array.isArray(m.value.items) && typeof m.value.items !== 'object') m.value.items = null
let gate = false
let last = JSON.stringify(m.value)

watch(
  () => props.modelValue,
  v => {
    gate = true
    const c = clone(v)
    if (!c) m.value = { mode: 'table', cols: 9, header_json: null, items: null, file: null }
    else m.value = c
    gate = false
  },
  { deep: true },
)

watch(
  m,
  v => {
    if (gate) return
    const s = JSON.stringify(v)
    if (s !== last) {
      last = s
      emit('update:modelValue', clone(v))
    }
  },
  { deep: true },
)

/* ---------- editors / internal state ---------- */
const headerEditor = ref(null)
const tableEditor = ref(null)
const activeTarget = ref('header')
let updatingFromSteps = false

// 內部用來做新增 / 刪除的 steps，一律從 doc 解析出來
const stepsRef = ref([])          // 目前所有步驟文字
const hasUserEdited = ref(false)  // 使用者是否曾經修改過

function hasNonEmptySteps() {
  return Array.isArray(stepsRef.value) && stepsRef.value.some(s => (s || '').trim() !== '')
}


/* ---------- table helpers ---------- */
const COLS = 9
const tr = cells => ({ type: 'tableRow', content: cells })
const th = (text, editable = false) => ({
  type: 'tableHeader',
  attrs: { contenteditable: editable },
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text: String(text) }] : [] }],
})
const td = (text, editable = true) => ({
  type: 'tableCell',
  attrs: { contenteditable: editable },
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text: String(text) }] : [] }],
})

// steps: ['熱水洗1', '剝膜1', ...]
// 固定每組 9 欄，超出換下一組，最後一組沒用到的欄位不顯示號碼且不可編輯
function makeTableDoc(steps = [], cols = COLS) {
  const rows = []
  const total = steps.length
  const groups = Math.max(1, Math.ceil(Math.max(total, 1) / cols))

  for (let g = 0; g < groups; g++) {
    const base = g * cols
    const headerCells = [th('步驟', false)]
    const processCells = [th('流程', false)]

    for (let j = 0; j < cols; j++) {
      const idx = base + j
      if (idx < total) {
        headerCells.push(th(idx + 1, false))           // 真實步驟號
        processCells.push(td(steps[idx] || '', true))  // 可編輯
      } else {
        headerCells.push(th('', false))                // 沒有號碼
        processCells.push(td('', false))               // 不可編輯
      }
    }

    rows.push(tr(headerCells))
    rows.push(tr(processCells))
  }

  return { type: 'doc', content: [{ type: 'table', content: rows }] }
}

function cellText(node) {
  if (!node || !node.content) return ''
  const p = node.content.childCount ? node.content.child(0) : null
  if (!p || p.type.name !== 'paragraph') return ''
  let out = ''
  p.content?.forEach(child => { if (child.text) out += child.text })
  return out.trim()
}

// 從 table doc 抽回 steps (尾端全空會被去掉)
function getStepsFromDoc(editor) {
  const doc = editor.state.doc
  const table = doc.content.firstChild
  if (!table || table.type.name !== 'table') return []

  const steps = []
  let rowIdx = 0
  table.content.forEach(rowNode => {
    if (rowIdx % 2 === 1) {
      rowNode.content.forEach((cellNode, ci) => {
        if (ci === 0) return
        steps.push(cellText(cellNode))
      })
    }
    rowIdx++
  })

  while (steps.length && !steps[steps.length - 1]) steps.pop()
  return steps
}

// 由選取位置 → globalIndex（只接受「有號碼的流程 cell」）
function getSelectedStepIndex(ed) {
  const { state } = ed
  const doc = state.doc
  const table = doc.content.firstChild
  if (!table || table.type.name !== 'table') return null

  const pos = state.selection.$from.pos
  let rowIdx = -1
  let colIdx = -1
  let rowStart = 1

  for (let r = 0; r < table.content.childCount; r++) {
    const rowNode = table.content.child(r)
    let cellPos = rowStart + 1
    for (let c = 0; c < rowNode.childCount; c++) {
      const cell = rowNode.child(c)
      const cellEnd = cellPos + cell.nodeSize
      if (pos >= cellPos && pos <= cellEnd) {
        rowIdx = r
        colIdx = c
        break
      }
      cellPos = cellEnd
    }
    if (rowIdx !== -1) break
    rowStart += rowNode.nodeSize
  }

  if (rowIdx === -1 || colIdx <= 0) return null   // 左邊標題欄不算
  if (rowIdx % 2 === 0) rowIdx++                  // header → 對應流程列

  const groupIndex = Math.floor(rowIdx / 2)
  const stepIndexInGroup = colIdx - 1
  const globalIndex = groupIndex * COLS + stepIndexInGroup
  const stepsLen = stepsRef.value.length
  if (globalIndex < 0 || globalIndex >= stepsLen) return null // 不能點在「沒有號碼」那一格
  return { globalIndex }
}

// 由 globalIndex → 把游標選到對應流程 cell
function selectStep(ed, globalIndex) {
  if (!ed || globalIndex == null || globalIndex < 0) return
  const doc = ed.state.doc
  const table = doc.content.firstChild
  if (!table || table.type.name !== 'table') return

  const groupIndex = Math.floor(globalIndex / COLS)
  const colInGroup = (globalIndex % COLS) + 1  // col 0 是「流程」

  let rowStart = 1
  for (let r = 0; r < table.content.childCount; r++) {
    const rowNode = table.content.child(r)
    const isProcessRow = r % 2 === 1
    if (isProcessRow && Math.floor(r / 2) === groupIndex) {
      let cellPos = rowStart + 1
      for (let c = 0; c < rowNode.childCount; c++) {
        const cell = rowNode.child(c)
        const cellEnd = cellPos + cell.nodeSize
        if (c === colInGroup) {
          const from = cellPos + 1
          const to = cellEnd - 1
          ed.commands.setTextSelection({ from, to })
          ed.chain().focus().run()
          return
        }
        cellPos = cellEnd
      }
    }
    rowStart += rowNode.nodeSize
  }
}

/* ---------- PMS 預設流程 ---------- */
async function loadDefaultFlow(machineCode) {
  if (!machineCode || !tableEditor.value || m.value.mode !== 'table') return
  try {
    const res = await axios.get(`${API_BASE_URL}/mes/pms/machine-process-flow`, {
      params: { machine_id: machineCode },
    })
    if (!res.data?.success) {
      console.log('[PMS] API success=false', res.data)
      return
    }
    const slots = res.data.data?.slots || res.data.slots || []
    if (!Array.isArray(slots) || !slots.length) {
      console.log('[PMS] no slots returned')
      return
    }

    const steps = slots
    updatingFromSteps = true
    tableEditor.value.commands.setContent(makeTableDoc(steps, COLS), false)
    updatingFromSteps = false

    stepsRef.value = steps
    m.value.items = tableEditor.value.getJSON()
    console.log('[PMS] flow loaded, steps =', steps)
  } catch (err) {
    console.error('load default flow failed', err)
  }
}

// 專門決定「要不要自動帶入 PMS」的邏輯
function maybeAutoLoadPms(code) {
  console.log('[PMS] maybeAutoLoadPms code =', code)
  if (!code) return

  const parentItems = props.modelValue?.items

  // 1️⃣ 父層已經給我一份 TipTap doc JSON → 表示是草稿 / 自己存過的內容 → 完全尊重，不要再叫 PMS
  const parentHasDocJson =
    parentItems &&
    typeof parentItems === 'object' &&
    !Array.isArray(parentItems) &&
    parentItems.type === 'doc'

  if (parentHasDocJson) {
    console.log('[PMS] skip auto: parent already has doc JSON')
    return
  }

  // 2️⃣ 父層給的是 steps array 或 null/undefined → 視為「沒現成流程」 → 用 PMS 補預設
  console.log('[PMS] no doc JSON from parent → auto load PMS')
  loadDefaultFlow(code)
}



/* ---------- 決定初始 table content：支援舊資料 (steps array) / 新資料 (doc JSON) ---------- */
const initialTableDoc = () => {
  const items = m.value.items
  if (items && typeof items === 'object' && !Array.isArray(items) && items.type === 'doc') {
    // 新版：父層已經給 doc JSON
    return items
  }
  // 舊版：items 是 steps 陣列或 null
  const legacySteps = Array.isArray(items) ? items : []
  stepsRef.value = legacySteps
  return makeTableDoc(legacySteps, COLS)
}

/* ---------- onMounted / onBeforeUnmount ---------- */
onMounted(() => {
  // 標題 editor
  headerEditor.value = new Editor({
    extensions: [
      Document.extend({ content: 'paragraph' }),
      Paragraph, Text, TextStyle, History,
      Color.configure({ types: ['textStyle'] }),
      Placeholder.configure({ placeholder: '請輸入標題' }),
    ],
    content: m.value.header_json || { type: 'doc', content: [{ type: 'paragraph' }] },
    onFocus: () => (activeTarget.value = 'header'),
    onUpdate: ({ editor }) => { m.value.header_json = editor.getJSON() },
  })

  // 流程表 editor
  tableEditor.value = new Editor({
    extensions: [
      Document, Paragraph, Text, TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Table.configure({}), TableRow,
      CustomTableHeader, CustomTableCell,
      History,
    ],
    editable: true,
    content: initialTableDoc(),
    onFocus: () => (activeTarget.value = 'table'),
    onUpdate: ({ editor }) => {
      if (updatingFromSteps) return
      const docJSON = editor.getJSON()
      const steps = getStepsFromDoc(editor)
      stepsRef.value = steps
      m.value.items = docJSON

      // ⭐ 使用者動過內容
      if (steps.some(s => (s || '').trim() !== '')) {
        hasUserEdited.value = true
      }
    },
    editorProps: {
      handleDOMEvents: {
        keydown: (view, event) => {
          const { state } = view
          const { $from } = state.selection
          let inLockedCell = false
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d)
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
              if (node.attrs.contenteditable === false) inLockedCell = true
              break
            }
          }
          if (!inLockedCell) return false
          const k = event.key
          const allowNav = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown','Tab'].includes(k)
          const allowMeta = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey
          if (allowNav || allowMeta) return false
          event.preventDefault()
          return true
        },
        paste: (view, event) => {
          const { state } = view
          const { $from } = state.selection
          let inLockedCell = false
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d)
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
              if (node.attrs.contenteditable === false) inLockedCell = true
              break
            }
          }
          if (!inLockedCell) return false
          event.preventDefault()
          return true
        },
      },
    },
  })

  // 若初始是 doc JSON，要補一次 stepsRef
  if (!stepsRef.value.length) {
    stepsRef.value = getStepsFromDoc(tableEditor.value)
  }
  // 並同步一次 m.value.items 為標準 doc JSON（把舊 steps 陣列升級成 JSON）
  m.value.items = tableEditor.value.getJSON()

  // 🚩 這裡改成只看「父層原本傳進來的 items」，決定要不要跑 PMS
  maybeAutoLoadPms(props.machineCode)
})

onBeforeUnmount(() => {
  headerEditor.value?.destroy()
  tableEditor.value?.destroy()
})

/* ---------- 插入 / 刪除欄位（保持焦點） ---------- */
function addStepRight() {
  const ed = tableEditor.value
  if (!ed) return

  const steps = [...stepsRef.value]
  const info = getSelectedStepIndex(ed)
  let baseIndex
  if (info) {
    baseIndex = info.globalIndex
  } else {
    // 沒選任何格：如果沒有步驟 → 從 0 開始；如果有步驟 → 從最後一格往右插
    baseIndex = steps.length ? steps.length - 1 : -1
  }

  const insertPos = Math.min(baseIndex + 1, steps.length)
  steps.splice(insertPos, 0, '')   // 插入空步驟（右邊全部後移）

  updatingFromSteps = true
  ed.commands.setContent(makeTableDoc(steps, COLS), false)
  updatingFromSteps = false

  stepsRef.value = steps
  m.value.items = ed.getJSON()     // ⭐ 更新對外 JSON

  selectStep(ed, insertPos)
  activeTarget.value = 'table'
}

function removeStep() {
  const ed = tableEditor.value
  if (!ed) return
  const info = getSelectedStepIndex(ed)
  if (!info) { alert('請先點選要刪除的流程儲存格'); return }

  const { globalIndex } = info
  const steps = [...stepsRef.value]
  if (globalIndex < 0 || globalIndex >= steps.length) return

  steps.splice(globalIndex, 1)

  updatingFromSteps = true
  ed.commands.setContent(makeTableDoc(steps, COLS), false)
  updatingFromSteps = false

  stepsRef.value = steps
  m.value.items = ed.getJSON()     // ⭐ 更新對外 JSON

  let target = globalIndex
  if (target >= steps.length) target = steps.length - 1
  if (target >= 0) selectStep(ed, target)
  activeTarget.value = 'table'
}

/* ---------- 顏色 ---------- */
function applyColor(color) {
  if (activeTarget.value === 'header') {
    headerEditor.value?.chain().focus().setColor(color || '#000').run()
    return
  }
  const ed = tableEditor.value
  if (!ed) return
  ed.chain().focus()
  const sel = ed.state.selection
  if (sel.empty) {
    const $pos = sel.$from
    let found = null
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d)
      if (node?.type?.name === 'tableCell' || node?.type?.name === 'tableHeader') {
        const cellPos = $pos.before(d)
        const cellSize = node.nodeSize
        const from = cellPos + 1
        const to = cellPos + cellSize - 1
        ed.commands.setTextSelection({ from, to })
        found = true
        break
      }
    }
    if (!found) ed.commands.selectAll()
  }
  ed.chain().setColor(color || '#000').run()
}

/* ---------- 上傳 / 下載 ---------- */
const fileInput = ref(null)
const uploading = ref(false)
const pickFile = () => fileInput.value?.click()
const fullUrl = u => (u?.startsWith('http') ? u : `${API_BASE_URL}${u}`)
const setMode = mode => { m.value.mode = mode }

async function handleFile(ev) {
  const f = ev.target.files?.[0]; ev.target.value = ''
  if (!f) return
  uploading.value = true
  try {
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (ext === 'drawio') {
      const fd = new FormData()
      fd.append('file', f)
      const r = await axios.post(`${API_BASE_URL}/uploads/drawio?token=${props.token}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (!r.data?.success) throw new Error(r.data?.message || 'convert failed')
      m.value.file = {
        asset_id: r.data.asset_id || null,
        url: r.data.url,
        path: r.data.path_to_save,
        download_url: r.data.download_url || r.data.url,
      }
    } else {
      const up = new FormData()
      up.append('file', f)
      const r = await axios.post(`${API_BASE_URL}/uploads/image?token=${props.token}`, up, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (!r.data?.success) throw new Error(r.data?.message || 'upload failed')
      m.value.file = {
        asset_id: r.data.asset_id,
        url: r.data.url,
        path: r.data.path_to_save,
        download_url: r.data.download_url || r.data.url,
      }
    }
  } catch (e) {
    console.error(e)
    alert('上傳失敗')
  } finally {
    uploading.value = false
  }
}
</script>


<template>
  <div class="pfb">
    <!-- toolbar -->
    <div class="pfb-toolbar">
      <label>選擇模式：</label>
      <button :class="['mode-btn', m.mode==='table' && 'active']" @click="setMode('table')">輸入模式</button>
      <button :class="['mode-btn', m.mode==='image' && 'active']" @click="setMode('image')">上傳模式</button>

      <button v-if="m.mode==='image'" class="mode-btn file-upload" @click="pickFile">選擇檔案</button>
      <input ref="fileInput" type="file" accept=".drawio,image/*" @change="handleFile" style="display:none" />
      <span v-if="uploading" class="hint">上傳中...</span>
      <span v-else-if="m.file" class="hint">已選檔</span>

      <div class="menu color">
        <div class="font-color blue"  @click="applyColor('blue')"></div>
        <div class="font-color black" @click="applyColor(null)"></div>
      </div>

      <a
        v-if="m.mode === 'image' && (m.file?.download_url || m.file?.url)"
        :href="fullUrl(m.file.download_url || m.file.url)"
        download
        class="download-link-toolbar"
      >下載檔案</a>
    </div>

    <!-- 標題 + 欄位操作 -->
    <div class="pfb-input-row" @mousedown="activeTarget='header'">
      <label>2.1</label>
      <EditorContent :editor="headerEditor" class="title-editor-content" />
      <div v-if="m.mode==='table'" class="step-ops">
        <button class="action-btn add-btn" @click="addStepRight">+</button>
        <button class="action-btn remove-btn" @click="removeStep">-</button>
      </div>
    </div>

    <!-- table -->
    <div v-if="m.mode==='table'" class="process-table-wrapper">
      <div class="pf-table-focusable" tabindex="0" @mousedown="activeTarget='table'" @focus="activeTarget='table'">
        <EditorContent :editor="tableEditor" class="pf-editor" />
      </div>
    </div>

    <!-- upload preview -->
    <div v-else-if="m.mode==='image'" class="upload-body">
      <div v-if="m.file" class="preview">
        <img :src="fullUrl(m.file?.url)" alt="flow" />
      </div>
      <div v-else class="empty">尚未選擇檔案（支援 .drawio / 圖檔）</div>
    </div>
  </div>
</template>

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
.title-editor-content :deep(.ProseMirror p.is-editor-empty::before){
  content:attr(data-placeholder); pointer-events:none; height:0; float:left; color:#adb5bd;
}
.step-ops{ display:flex; gap:6px; align-items:center; }
.action-btn{ width:30px; height:30px; border:none; border-radius:50%; color:#fff; cursor:pointer; font-size:18px; line-height:30px; padding:0; }
.add-btn{ background:#28a745; }
.remove-btn{ background:#dc3545; }

/* table */
.process-table-wrapper{ width:100%; }
.pf-table-focusable{ outline:none; }
.pf-table-focusable:focus-visible{ box-shadow:0 0 0 3px rgba(0,123,255,.25); border-radius:6px; }
.pf-editor :deep(table){ width:100%; border-collapse:collapse; table-layout:fixed; }
.pf-editor :deep(th), .pf-editor :deep(td){
  border:1px solid #ddd; padding:8px; text-align:center; vertical-align:middle; word-wrap:break-word;
}
.pf-editor :deep(th:first-child), .pf-editor :deep(td:first-child){
  width:72px; background:#f7f9fc; font-weight:600;
}
.pf-editor :deep(.ProseMirror){ outline:none; }

/* upload preview */
.upload-body{ display:flex; justify-content:center; padding:16px; }
.upload-body .preview img{ max-width:100%; height:auto; display:block; border:1px solid #eee; border-radius:4px; }
.upload-body .empty{ padding:10px; color:#777; }
</style>
