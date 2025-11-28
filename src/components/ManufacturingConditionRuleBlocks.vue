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
              <span v-if="b.programLinks && b.programLinks.length">
                {{ b.programLinks.map(p => p.specCode).join('、') }}
              </span>
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
import { v1 as uuidv1 } from 'uuid'
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
import { CellSelection } from 'prosemirror-tables'

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
  baseMachineCode: { type: String, default: '' },
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
const blocks = ref([])          // 每個 block：{ id, content_id, client_temp_id, programLinks[], data }
const condEditors = ref([])
const paramEditors = ref([])
const copyCode = ref('')
let idSeq = 0

// 控制哪一個 block 的「製程下拉」打開
const openSpecDropdownIndex = ref(null)

const specNameByCode = computed(() => {
  const m = {}
  ;(props.specOptions || []).forEach(o => {
    if (!o?.code) return
    m[o.code] = o.name || o.code
  })
  return m
})

const noAnyParams = computed(() => !props.hasPms && !props.hasConditions)

const isSpecRequired = computed(() => {
  const opts = props.specOptions || []
  return opts.length > 0   // 有選項就視為必填
})


/* ===== 把父層 dataBlocks 轉成內部結構 ===== */
function normalizeBlockFromProps(blk, idx) {
  const meta = (blk.data && blk.data.metadata) || {}

  let programs = []
  if (Array.isArray(blk.programLinks) && blk.programLinks.length) {
    programs = blk.programLinks.map(p => ({ ...p }))
  } else if (Array.isArray(meta.programs) && meta.programs.length) {
    programs = meta.programs.map(p => ({ ...p }))
  } else {
    // 相容舊資料：用舊的 specCode + code 組成一個 program
    const specCode = blk.specCode || meta.specification?.code || ''
    const specName = blk.specName || meta.specification?.name || ''
    const programCode = blk.code || ''
    if (specCode || programCode) {
      programs.push({
        specCode,
        specName: specName || specCode,
        programCode,
      })
    }
  }

  const mainSpec =
    meta.mainSpec ||
    (programs[0]
      ? { specCode: programs[0].specCode, specName: programs[0].specName }
      : null)

  return {
    id: blk.id ?? idx + 1,
    content_id: blk.content_id || null,
    client_temp_id: blk.client_temp_id || `temp-${uuidv1()}`,
    programLinks: programs,
    data: {
      ...(blk.data || {}),
      metadata: {
        ...(meta || {}),
        programs,
        mainSpec,
      },
    },
  }
}

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
  const programs = Array.isArray(blk.programLinks) ? blk.programLinks.slice() : []
  const mainSpec = programs[0]
    ? { specCode: programs[0].specCode, specName: programs[0].specName }
    : null

  blk.data = blk.data || {}
  blk.data.metadata = {
    ...(blk.data.metadata || {}),
    programs,
    mainSpec,
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

  // ↓↓↓ 以下保留你原本的邏輯 ↓↓↓

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
  const blk = blocks.value[blockIdx]
  if (!blk) return

  if (!confirm(`確定要移除製程「${link.specName || link.specCode}」與程式號碼「${link.programCode || ''}」嗎？`)) {
    return
  }

  blk.programLinks = (blk.programLinks || []).filter(
    p => !(p.specCode === link.specCode && p.programCode === link.programCode)
  )

  if (link.programCode) {
    try {
      await releaseProgramCode(link.programCode)
    } catch (e) {
      console.error('releaseProgramCode failed', e)
      alert('程式號碼釋放失敗，請稍後再試')
    }
  }

  updateBlockMetadataPrograms(blockIdx)
  syncToParent()
}

/* ===== 製程多選相關 end ===== */

function buildProgramCodeForSpec(specCode, index) {
  const sc = (specCode || '').toString()
  if (!sc) return `XXXX${index + 1}`

  const normalized = sc.replace(/-/g, '')   // "R221-01" -> "R22101"
  const seq = String(index + 1).padStart(3, '0')  // 01, 02, ...
  return `RE${normalized}${seq}`
}

function updateCodeForBlock(idx) {
  const b = blocks.value[idx]
  if (!b) return
  b.code = buildProgramCodeForSpec(b.specCode, idx)
}

function onSpecChange(i) {
  const b = blocks.value[i]
  const code = b.specCode || ''
  b.specName = specNameByCode.value[code] || ''
  updateCodeForBlock(i)
  syncToParent()
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
          content:[{ type:'paragraph', content:[{ type:'text', text:'1' }] }]
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
const cellText = n => {
  if (!n) return ''
  const a = n.attrs || {}
  if (a.cellType === 'dropdown') return a.dropdownValue || ''
  const p = n.content?.childCount ? n.content.child(0) : null
  return p?.type?.name === 'paragraph'
    ? (p.content?.content || []).map(x => x.text || '').join('').trim()
    : ''
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
      handleDOMEvents:{ drop:()=>true, dragstart:()=>true, mousedown:()=>false, handleKeydown, keydown: (view, event) => handleKeydown(view, event) },
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

/* ===== Public actions（新增 / 刪除 / 複製 block） ===== */
function addBlock() {
  const id = idSeq++
  blocks.value.push({
    id,
    content_id: null,
    client_temp_id: `temp-${uuidv1()}`,
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
function duplicateBlock(i) {
  const src = blocks.value[i]
  const id = idSeq++

  const clonedPrograms = (src.programLinks || []).map(p => ({ ...p }))

  blocks.value.push({
    id,
    content_id: null,
    client_temp_id: `temp-${uuidv1()}`,
    programLinks: clonedPrograms,
    data: {
      ...(src.data || {}),
      jsonConditionContent: condEditors.value[i]?.getJSON() || null,
      jsonParameterContent: paramEditors.value[i]?.getJSON() || null,
      metadata: {
        ...(src.data?.metadata || {}),
        programs: clonedPrograms,
        mainSpec: clonedPrograms[0]
          ? { specCode: clonedPrograms[0].specCode, specName: clonedPrograms[0].specName }
          : null,
      },
    },
  })

  nextTick(() => initEditors(blocks.value.length - 1))
}

/* copyFromCode 邏輯保留，唯一差別是「程式代碼」現在取第一個 programLinks 的 programCode */
async function copyFromCode(targetIdx) {
  if (!copyCode.value) {
    alert('請輸入要複製的代碼')
    return
  }
  const code = copyCode.value.trim()
  const tgt = blocks.value[targetIdx]
  if (!tgt) return

  // ---------------------------------------------------------
  // 1. 本地搜尋 (Local Search)
  // ---------------------------------------------------------
  // 檢查目前編輯器中是否已經有這個 code 的 block
  const srcIdx = blocks.value.findIndex(b =>
    Array.isArray(b.programLinks) &&
    b.programLinks.some(p => p.programCode === code)
  )

  if (srcIdx >= 0) {
    // A. 從本地 block 複製
    const src = blocks.value[srcIdx]

    if (condEditors.value[targetIdx] && condEditors.value[srcIdx]) {
      condEditors.value[targetIdx].commands.setContent(
        condEditors.value[srcIdx].getJSON()
      )
    }
    if (paramEditors.value[targetIdx] && paramEditors.value[srcIdx]) {
      paramEditors.value[targetIdx].commands.setContent(
        paramEditors.value[srcIdx].getJSON()
      )
    }

    // 本地複製時，連同程式號與規格一起套用 (維持既有邏輯)
    tgt.programLinks = (src.programLinks || []).map(p => ({ ...p }))
    
    // 更新 metadata 以便存檔
    tgt.data = tgt.data || {}
    tgt.data.metadata = tgt.data.metadata || {}
    tgt.data.metadata.programs = tgt.programLinks
    if(tgt.programLinks[0]) {
        tgt.data.metadata.mainSpec = { 
            specCode: tgt.programLinks[0].specCode, 
            specName: tgt.programLinks[0].specName 
        }
    }

    runAllValidations()
    alert(`已從第 ${srcIdx + 1} 個模塊複製內容`)
    return
  }

  // ---------------------------------------------------------
  // 2. 遠端搜尋 (Remote Search)
  // ---------------------------------------------------------
  if (!props.baseMachineCode) {
    alert('請先選擇機台，才能進行跨文件相容性檢查與複製。')
    return
  }

  // [Check] 若要產生新號碼，必須要有 documentToken (草稿代碼)
  if (!props.documentToken) {
    alert('尚未取得草稿代碼，無法為複製的製程產生新編號，請先儲存草稿。')
    return
  }

  try {
    const resp = await copyMcrFromCode({
      program_code: code,
      base_machine_code: props.baseMachineCode,
    })

    if (!resp || !resp.success) {
      const msg = resp?.message || resp?.data?.message || '查無可複製的資料或條件不相容'
      alert(msg)
      return
    }

    const data = resp.data || {}
    const remoteBlocks = data.blocks || {}
    
    // 取得回傳資料
    const condJson = remoteBlocks.cond_json || null
    const paramJson = remoteBlocks.param_json || null
    const sourcePrograms = remoteBlocks.source_programs || [] // [New] 取得來源製程

    let copiedCount = 0

    // A. 套用條件表
    if (condJson && condEditors.value[targetIdx]) {
      condEditors.value[targetIdx].commands.setContent(condJson)
      copiedCount++
    }
    
    // B. 套用參數表
    if (paramJson && paramEditors.value[targetIdx]) {
      paramEditors.value[targetIdx].commands.setContent(paramJson)
      copiedCount++
    }

    // C. [New] 複製製程並重新配號 (Re-allocate Program Codes)
    if (sourcePrograms.length > 0) {
      if (confirm(`來源包含 ${sourcePrograms.length} 個製程 (${sourcePrograms.map(p=>p.specName).join(',')})。\n是否要複製這些製程並自動產生新的程式代碼？\n(若選擇「取消」則只複製表格內容)`)) {
        
        // 1. 先釋放舊的 (如果有)
        if (tgt.programLinks && tgt.programLinks.length) {
          for (const link of tgt.programLinks) {
            if (link.programCode) {
                // 這裡選擇 Silent fail，若釋放失敗不卡流程
                await releaseProgramCode(link.programCode).catch(err => console.error(err))
            }
          }
        }
        
        // 清空連結
        tgt.programLinks = []

        // 2. 為每個來源製程申請新號碼
        const newLinks = []
        for (const srcProg of sourcePrograms) {
            if (!srcProg.specCode) continue
            try {
                // 呼叫後端配號 API (針對當前 documentToken)
                const allocResp = await allocateProgramCode(srcProg.specCode, props.documentToken)
                const newCode = allocResp.programCode
                
                if (newCode) {
                    newLinks.push({
                        specCode: srcProg.specCode,
                        specName: srcProg.specName || srcProg.specCode,
                        programCode: newCode // 這是新的唯一號碼
                    })
                }
            } catch (err) {
                console.error(`配號失敗: ${srcProg.specCode}`, err)
                alert(`製程 ${srcProg.specName} 配號失敗，請稍後手動選擇。`)
            }
        }

        // 3. 更新 Block
        tgt.programLinks = newLinks
        
        // 更新 Metadata (mainSpec, programs...)
        updateBlockMetadataPrograms(targetIdx)
        copiedCount++
      }
    }

    if (copiedCount > 0) {
      runAllValidations()
      alert('複製成功！\n包含：表格內容已套用、製程已複製並產生新流水號。')
    } else {
      alert('複製來源的內容為空。')
    }

  } catch (e) {
    console.error('copyFromCode remote failed', e)
    const msg = e?.response?.data?.message || e.message || '複製失敗'
    alert(msg)
  }
}

/* ===== Condition table row ops (unchanged logic) ===== */
function addCondRow(i){
  const ed = condEditors.value[i]; if (!ed) return
  let selRowIdx = -1, curIdx = -1
  const { state } = ed
  state.doc.descendants((n,pos)=>{
    if(n.type.name==='tableRow'){
      if(curIdx === -1) curIdx = 0
      if(state.selection.$anchor.pos >= pos && state.selection.$anchor.pos < pos + n.nodeSize){
        selRowIdx = curIdx
      }
      curIdx++
    }
  })
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
  const ed = condEditors.value[i]; if (!ed) return
  const $a = ed.state.selection.$anchor
  for (let d=$a.depth; d>=0; d--){
    const n = $a.node(d)
    if(n.type.name==='tableRow'){
      const inHeader = $a.before(d)===2
      if(inHeader) return alert('無法刪除表頭')
      ed.chain().focus().deleteRow().run()
      nextTick(()=>{ updateCondRowNumbers(ed); runCondValidation() })
      return
    }
  }
  alert('請選擇要刪除的列')
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
      state.schema.nodes.paragraph.create(null, state.schema.text(String(u.number)))
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
  const rows = []
  condEditors.value.forEach((ed,bIdx)=>{
    if(!ed) return
    let r=0
    ed.state.doc.descendants((n,p)=>{
      if(n.type.name==='tableRow'){
        if(r>0){
          const vals=[]; let ci=0
          n.forEach(c=>{ if(ci>0) vals.push(cellText(c)); ci++ })
          rows.push({ bIdx, pos:p, key:JSON.stringify(vals) })
        }
        r++
      }
    })
  })
  const dupSet = new Set()
  rows.forEach((x,i)=>{ for(let j=i+1;j<rows.length;j++) if(x.key && x.key===rows[j].key){ dupSet.add(i); dupSet.add(j) }})
  condEditors.value.forEach((ed,bIdx)=>{
    if(!ed) return
    const { state, view } = ed; let r=0; const tr = state.tr
    state.doc.descendants((n,p)=>{
      if(n.type.name==='tableRow'){
        if(r>0){
          const idxInRows = rows.findIndex(it=>it.bIdx===bIdx && it.pos===p)
          const isDup = idxInRows>=0 && dupSet.has(idxInRows)
          const want = isDup ? 'dup-row' : ''
          if ((n.attrs.class||'')!==want) tr.setNodeMarkup(p, undefined, { ...n.attrs, class:want })
        }
        r++
      }
    })
    if(tr.docChanged) view.dispatch(tr)
  })
}
function getParamMatrix(ed){
  const mat=[]; let r=0
  ed.state.doc.descendants((n)=>{ if(n.type.name==='tableRow'){ if(r>0){
    const row=[]; let ci=0
    n.forEach(c=>{ if(ci>=2 && ci<=6) row.push(cellText(c) || '') ; ci++ })
    mat.push(row)
  } r++ }})
  return JSON.stringify(mat)
}
function runParamDuplicateValidation(){
  const sigs = paramEditors.value.map((ed,i)=> ed?{i, sig:getParamMatrix(ed)}:null).filter(Boolean)
  const dupIdx = new Set()
  for(let a=0;a<sigs.length;a++) for(let b=a+1;b<sigs.length;b++) if(sigs[a].sig===sigs[b].sig){ dupIdx.add(sigs[a].i); dupIdx.add(sigs[b].i) }
  paramEditors.value.forEach((ed,bIdx)=>{
    if(!ed) return
    const dup = dupIdx.has(bIdx); const { state, view } = ed; const tr = state.tr; let r=0
    state.doc.descendants((n,p)=>{
      if(n.type.name==='tableRow'){
        if(r>0){
          const want = dup ? 'dup-table' : ''
          if ((n.attrs.class||'')!==want) tr.setNodeMarkup(p, undefined, { ...n.attrs, class:want })
        }
        r++
      }
    })
    if(tr.docChanged) view.dispatch(tr)
  })
}
function runParamValueValidation(ed){
  const { state, view } = ed; const tr = state.tr
  const table = state.doc.content.firstChild; if(!table || table.type.name!=='table') return
  for(let r=1;r<table.content.childCount;r++){
    const row = table.content.child(r); const cells=row.content
    let rowVals=[], rowStatus=[]
    for(let c=2;c<=6;c++){
      const txt = cellText(cells.child(c))
      if(txt===''){ rowVals.push(null); rowStatus.push('value-empty') }
      else if(isFinite(Number(txt))){ rowVals.push(Number(txt)); rowStatus.push('value-valid') }
      else { rowVals.push(null); rowStatus.push('value-invalid') }
    }
    for(let k=1;k<5;k++){
      const a=rowVals[k-1], b=rowVals[k]
      if(a!=null && b!=null && a>b){ rowStatus[k-1]='value-error'; rowStatus[k]='value-error' }
    }
    let posRow = 1; for(let t=0;t<r;t++) posRow += table.content.child(t).nodeSize
    let acc=[posRow+1]; for(let t=0;t<cells.childCount-1;t++) acc.push(acc[t]+cells.child(t).nodeSize)
    rowStatus.forEach((st,idx)=>{ const cellIdx=2+idx; const at = acc[cellIdx]; tr.setNodeMarkup(at, null, { ...cells.child(cellIdx).attrs, class:st }) })
  }
  if(tr.docChanged) view.dispatch(tr)
}
function runAllValidations(){
  runCondValidation()
  paramEditors.value.forEach(ed=> ed && runParamValueValidation(ed))
  runParamDuplicateValidation()
}
function handleKeydown(view, event) {
  if (event.key !== 'Enter') return false

  const { state } = view
  const { $from } = state.selection

  // 找到目前所在的 cell / header
  let cellNode = null
  let cellDepth = -1
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'customTableCell' || node.type.name === 'tableHeader') {
      cellNode = node
      cellDepth = d
      break
    }
  }
  if (!cellNode || cellDepth < 0) return false

  // rowNode = 這個 cell 所在的那一列
  const rowNode = $from.node(cellDepth - 1)
  // tableNode = 整張 table
  const tableNode = $from.node(cellDepth - 2)

  let rowIndex = -1
  let colIndex = -1

  // 取得 rowIndex
  tableNode.content.forEach((row, _offset, index) => {
    if (row === rowNode) {
        rowIndex = index
    }
  })

  // 取得 colIndex
  rowNode.content.forEach((cell, _offset, index) => {
    if (cell === cellNode) {
        colIndex = index
    }
  })

  if (rowIndex < 0 || colIndex < 0) return false

  // 欄位 index 對應 initialTableData：
  // 0 "項次"
  // 1 "槽體"
  // 2 "管理項目"
  // 3 "規格下限(OOS-)"
  // 4 "操作下限(OOC-)"
  // 5 "設定值"
  // 6 "操作上限(OOC+)"
  // 7 "規格上限(OOS+)"
  // 8 "單位"
  // ...
  const blockedCols = [2, 3, 4, 5, 6]

  // 如果是在需要鎖 Enter 的那些欄位，就擋掉
  if (blockedCols.includes(colIndex)) {
    event.preventDefault()
    return true       // 告訴 ProseMirror：這個事件已經處理完了
  }

  return false
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
    addBlock()
  } else {
    blocks.value = props.dataBlocks.map((blk, idx) => normalizeBlockFromProps(blk, idx))
    blocks.value.forEach((_, i) => initEditors(i))
  }
  nextTick(syncToParent)
  lastExternalDataJson.value = JSON.stringify(props.dataBlocks || [])
})

// Watch dataBlocks（外部載草稿 / 換機台時）
watch(
  () => props.dataBlocks,
  async (newBlocks) => {
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
      (b.programLinks || []).forEach(p => {
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
      blocks.value = newBlocks.map((blk, idx) => normalizeBlockFromProps(blk, idx))
      blocks.value.forEach((_, i) => initEditors(i))
    }

    nextTick(runAllValidations)
    lastExternalDataJson.value = json
  },
  { deep: true }
)

watch(
  () => ({
    hasPms: props.hasPms,
    hasConditions: props.hasConditions,
    condTemplate: props.condTemplate,
    paramTemplate: props.paramTemplate,
  }),
  () => {
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
    const list = opts || []
    // ✅ 只有一個選項時才啟動
    if (list.length !== 1) return

    const only = list[0]
    if (!only || !only.code) return

    // 沒有 documentToken 不能配號，只先跳過
    if (!props.documentToken) return

    for (let i = 0; i < blocks.value.length; i++) {
      const blk = blocks.value[i]
      if (!blk) continue

      blk.programLinks = blk.programLinks || []
      const already = blk.programLinks.some(p => p.specCode === only.code)
      if (already) continue   // 這個 block 已經有了就不用再配

      try {
        const data = await allocateProgramCode(only.code, props.documentToken)
        const programCode = data?.programCode || ''
        if (!programCode) continue

        blk.programLinks.push({
          specCode: only.code,
          specName: only.name || only.code,
          programCode,
        })
        updateBlockMetadataPrograms(i)
      } catch (e) {
        console.error('auto allocateProgramCode failed', e)
      }
    }

    syncToParent()
  },
  { immediate: true }
)


// Unmount 時 emit save
onBeforeUnmount(() => {
  const payload = exportData()
  emit('save', payload)
  condEditors.value.forEach(e => e?.destroy())
  paramEditors.value.forEach(e => e?.destroy())
})

/* ===== Export to parent ===== */
function extractTableArray(ed){
  if(!ed) return []
  const t = ed.state.doc.content.firstChild
  if(!t || t.type.name!=='table') return []
  const out=[]
  t.content.forEach(row=>{
    const r=[]
    row.content.forEach(c=> r.push(cellText(c)))
    out.push(r)
  })
  return out
}

function exportData() {
  return blocks.value.map((b, i) => {
    const programs = Array.isArray(b.programLinks) ? b.programLinks.slice() : []
    const mainSpec = programs[0]
      ? { specCode: programs[0].specCode, specName: programs[0].specName }
      : null

    // 為了相容舊欄位，可以把「第一組程式號碼」當作 code / specCode / specName 傳出去
    const first = programs[0] || {}

    return {
      id: b.id,
      // 相容 legacy 欄位：code / specCode / specName
      code: first.programCode || '',
      specCode: first.specCode || '',
      specName: first.specName || '',

      content_id: b.content_id,
      client_temp_id: b.client_temp_id,
      programLinks: programs,
      data: {
        jsonConditionContent: condEditors.value[i]?.getJSON() || null,
        arrayConditionData:   extractTableArray(condEditors.value[i]),
        jsonParameterContent: paramEditors.value[i]?.getJSON() || null,
        arrayParameterData:   extractTableArray(paramEditors.value[i]),
        metadata: {
          ...(b.data?.metadata || {}),
          programs,
          mainSpec,
        },
      },
    }
  })
}

let emitTimer = null
function syncToParent() {
  clearTimeout(emitTimer)
  emitTimer = setTimeout(() => {
    const payload = exportData()
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