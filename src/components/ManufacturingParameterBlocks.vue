<template>
  <div class="blk-wrap">
    <button class="btn add" @click="addBlock">新增下一層</button>

    <div v-for="(b,i) in blocks" :key="b.id" class="blk">
      <div class="blk-hd">
        <div><b>程式號碼：</b>{{ b.code }}</div>
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

      <!-- Parameter (Table 2) -->
      <!-- <div v-if="paramEditors[i]" class="menu"> -->
      <div class="menu">
        <div class="l">
          <label>機檯群組：</label>
          <select v-model="blocks[i].meta.group" @change="onGroupChange(i)">
            <option value="">-- 請選擇群組 --</option>
            <option v-for="[groupCode, groupInfo] in groupKeys" :key="groupCode" :value="groupCode">{{ groupInfo.name }}</option>
          </select>

          <label>機台：</label>
          <select v-model="blocks[i].meta.machine" @change="onMachineChange(i)">
            <option value="">-- 請選擇機台 --</option>
            <option v-for="[machineCode, machineInfo] in machineKeysFor(i)" :key="machineCode" :value="machineCode">{{ machineInfo.name }}</option>
          </select>
        </div>
        <div class="r">
          <!-- <i class="dot red" @click="paramEditors[i]?.chain().focus().setColor('red').run()"></i> -->
          <i class="dot blue" @click="paramEditors[i]?.chain().focus().setColor('blue').run()"></i>
          <i class="dot black" @click="paramEditors[i]?.chain().focus().setColor('null').run()"></i>
        </div>
      </div>
      <div v-if="!blocks[i].meta.group || !blocks[i].meta.machine" class="hint">
        請先選擇「機檯群組」與「機台」，將自動載入 PMS 參數。
      </div>

      <div v-else-if="pmsLoading[i]" class="hint">正在載入 PMS 參數…</div>

      <div v-else-if="pmsEmpty[i]" class="hint empty">此機台無PMS資料</div>

      <EditorContent v-else-if="paramEditors[i]" :editor="paramEditors[i]" class="ed ed-param"/>
      <!-- <EditorContent v-if="paramEditors[i]" :editor="paramEditors[i]" class="ed ed-param"/> -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount, watch, computed } from 'vue'
import axios from 'axios'
import { v1 as uuidv1 } from 'uuid'
import { EditorContent, Editor } from '@tiptap/vue-3'
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

/* ===== Props / Emits ===== */
const props = defineProps({
  dataBlocks: { type: Array, default: () => [] },     // [{ code, data:{ jsonParameterContent, arrayParameterData, metadata? }, ...}]
  specification: { type: [Array, Object], default: () => ([])},       // passed from parent
  currentStep: { type: Number, default: 0 },
})
const emit = defineEmits(['update:dataBlocks','save'])

/* ===== API base ===== */
const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL

/* ===== TipTap setup (plain cells) ===== */
const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })]
const CustomTableCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), contenteditable: {default: true}, class: {default: null} } } })
const CustomTableHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), contenteditable: { default: true } } } })
const CustomTableRow = TableRow.extend({ addAttributes() { return { ...this.parent?.(), class: { default: null } } } })
const TExt = [ Document.extend({ content: 'table' }), ...baseExt, Table, CustomTableRow, CustomTableHeader, CustomTableCell, History ]

/* ===== Reactive state ===== */
const blocks = ref([])          // [{ id, code, data, meta:{group, machine}, content_id?, client_temp_id? }]
const paramEditors = ref([])    // Editor[]
const copyCode = ref('')
let idSeq = 0

// NEW: PMS states per block index
const pmsLoading = ref({})  // { [i]: boolean }
const pmsEmpty   = ref({})  // { [i]: boolean }

/* ===== MES: groups & machines ===== */
// specGroupsMap: 後端回傳的完整 map
// {
//   "R221-01": {
//     "G1": { name: "群組1", machines: [{code,name,building}, ...] },
//     ...
//   },
//   "R331-03": { ... },
// }
const specGroupsMap = ref({})

// 壓平成原本 UI 需要的 groupsMap：
// {
//   "G1": {
//      name: "群組1",
//      machines: {
//        "M001": { name: "機台1", specCodes: ["R221-01", ...] },
//        ...
//      }
//   },
//   ...
// }
const groupsMap = computed(() => {
  const merged = {}

  for (const [specCode, groups] of Object.entries(specGroupsMap.value || {})) {
    for (const [gCode, gInfo] of Object.entries(groups || {})) {
      const gKey = gCode
      if (!merged[gKey]) {
        merged[gKey] = {
          name: gInfo.name,
          machines: {},
        }
      }

      for (const m of (gInfo.machines || [])) {
        const mKey = m.code
        if (!merged[gKey].machines[mKey]) {
          merged[gKey].machines[mKey] = {
            name: m.name,
            specCodes: [],
          }
        }
        if (!merged[gKey].machines[mKey].specCodes.includes(specCode)) {
          merged[gKey].machines[mKey].specCodes.push(specCode)
        }
      }
    }
  }

  return merged
})

const groupKeys = computed(() => Object.entries(groupsMap.value))

const machineKeysFor = (i) => {
  const g = blocks.value[i]?.meta?.group || ''
  const gm = groupsMap.value[g]?.machines || {}
  return Object.entries(gm)
}

// 取得目前 attribute.specification 中第一個有 code 的工程代碼
const primarySpecificCode = computed(() => {
  if (Array.isArray(props.specification)) {
    const first = props.specification.find(s => s && s.code)
    return first ? first.code : ''
  }
  if (props.specification && props.specification.code) {
    return props.specification.code
  }
  return ''
})

// 把 "R221-01" → "22101"
function normalizeSpecificCode(code) {
  if (!code) return '00000'
  const digits = String(code).match(/\d+/g)
  if (digits && digits.length) return digits.join('')
  return String(code).replace(/[^0-9A-Za-z]/g, '')
}

// 產生程式號碼：RE + 22101 + 01
function buildProgramCode(blockIndex, specCode) {
  const base = normalizeSpecificCode(specCode || primarySpecificCode.value)
  const seq  = String(blockIndex + 1).padStart(2, '0') // 01, 02, ...
  return `RE${base}${seq}`
}

function findSpecCodeForGroupAndMachine(groupCode, machineCode) {
  const g = (groupCode || '').trim()
  const m = (machineCode || '').trim()
  if (!g || !m) return ''

  // 直接從 specGroupsMap 走一遍
  for (const [specCode, groups] of Object.entries(specGroupsMap.value || {})) {
    const group = groups[g]
    if (!group) continue
    if ((group.machines || []).some(x => (x.code || '').trim() === m)) {
      return specCode
    }
  }
  return ''
}

async function fetchGroups() {
  // 把 specification 轉成 code list
  let specCodes = []

  if (Array.isArray(props.specification)) {
    specCodes = props.specification.map(s => s && s.code).filter(Boolean)
  } else if (props.specification && props.specification.code) {
    specCodes = [props.specification.code]
  }

//   console.log("specCodes: ", specCodes)

  if (!specCodes.length) {
    specGroupsMap.value = {}
    return
  }

  try {
    const { data } = await axios.get(`${API_BASE_URL}/mes/spec-groups-machines`, {
      params: { specific: specCodes },   // 這裡會序列化成 ?specific=A&specific=B
    })
    specGroupsMap.value = data?.data?.specGroups || {}
  } catch (e) {
    console.error('fetch spec-groups-machines failed:', e)
    specGroupsMap.value = {}
  }
}

// 取得對應的適用工程 code（簡化版：先吃第一個，有多工程你之後可以再細調）
function getSpecCodeForBlock(i) {
  const spec = props.specification

  // 如果未來你把 specification 改成 array，這裡先支援一下
  if (Array.isArray(spec) && spec.length > 0) {
    // TODO：如果每個 group 對應不同 spec，可以在這裡用 group 去反查 spec
    return (spec[0].code || '').trim()
  }

  // 原本是單一 object 的情況
  if (spec && typeof spec === 'object') {
    return (spec.code || spec.specific || '').trim()
  }

  return ''
}

// 依照「適用工程 code + block index」產生程式號碼
function updateProgramCode(i) {
  const specCode = getSpecCodeForBlock(i)  // e.g. "L262-01" / "R221-01"
  if (!specCode) {
    // 沒有適用工程就用舊 fallback
    blocks.value[i].code = `XXXY${String(i + 1).padStart(2, '0')}`
    return
  }

  // 移除連結符號，類似你說的 .split('-').join('')
  const normalized = specCode.replace(/-/g, '')   // R221-01 -> R22101

  // 兩位數流水號
  const seq = String(i + 1).padStart(2, '0')      // 0 -> "01", 1 -> "02", ...

  // 最後組合：RE + <工程碼去掉'-'> + <流水號>
  // e.g. "RE" + "22101" + "01" -> "RE2210101"
  blocks.value[i].code = `RE${normalized}${seq}`
}



// NEW: resolve the Oracle MACHINE_CODE (machine_id) from current selection
function getSelectedMachineId(i){
  const mKey = blocks.value[i]?.meta?.machine || ''
  return (mKey || '').trim()
}


/* ===== Parameter table template ===== */
const LOCK_COLS = [0,1,7,8]

function buildParamDocFromRows(rows) {
  const trows = rows.map((row, rIdx) => ({
    type: 'tableRow',
    content: row.map((txt, cIdx) => ({
      type: rIdx === 0 ? 'tableHeader' : 'tableCell',
      attrs: { contenteditable: (rIdx === 0 || LOCK_COLS.includes(cIdx)) ? false : true },
      content: [{ type: 'paragraph', content: txt ? [{ type: 'text', text: String(txt) }] : [] }],
    })),
  }))

  return { type: 'doc', content: [{ type: 'table', content: trows }] }
}

/* ===== Helpers ===== */
const cellText = (n) => {
  if (!n) return ''
  const p = n.content?.childCount ? n.content.child(0) : null
  if (!p || p.type.name !== 'paragraph') return ''
  const out = []
  p.content?.forEach(x => { if (x.text) out.push(x.text) })
  return out.join('').trim()
}

/* ===== Editor factory ===== */
function makeParamEditor(json, onUpdate) {
  if (!json) {
    console.warn('makeParamEditor called without json content, skip editor init')
    return null
  }

  return new Editor({
    content: seed,
    extensions: TExt,
    editorProps: {
      handleDOMEvents: {
        drop: () => true,
        dragstart: () => true,
      },
      handleKeyDown(view, event) {
        if (!['Backspace','Delete'].includes(event.key)) return false
        const sel = view.state.selection
        if (!(sel instanceof CellSelection)) return false
        const { state } = view; let tr = state.tr; const editableCells=[]
        sel.forEachCell((cell,pos) => {
          const head = cell.type.name === 'tableHeader'
          const editable = cell.attrs?.contenteditable !== false
          if (!head && editable) editableCells.push({ cell, pos })
        })
        if (!editableCells.length) { event.preventDefault(); return true }
        for (let i = editableCells.length - 1; i >= 0; i--) {
          const { cell, pos } = editableCells[i]
          const empty = state.schema.nodes.paragraph.create()
          const newCell = cell.type.create(cell.attrs, empty, cell.marks)
          tr = tr.replaceWith(pos, pos + cell.nodeSize, newCell)
        }
        view.dispatch(tr); event.preventDefault(); return true
      }
    },
    onUpdate({ editor }) {
      onUpdate?.(editor)
      syncToParent()
    }
  })
}

async function seedFromMES(i, machineId){
  // mark loading / clear empties
  pmsLoading.value[i] = true
  pmsEmpty.value[i]   = false
  try {
    const { data } = await axios.get(`${API_BASE_URL}/mes/pms/machine-parameters-set-attribute`, {
      params: { machine_id: machineId }
    })
    const rows = data?.data?.table_rows || []

    if (!rows.length){
      // no PMS data => destroy editor if exists and show empty message
      if (paramEditors.value[i]) {
        paramEditors.value[i].destroy()
        paramEditors.value[i] = null
      }
      pmsEmpty.value[i] = true
      return
    }

    // build TipTap doc and show editor
    const doc = buildParamDocFromRows(rows)
    if (!paramEditors.value[i]) {
      paramEditors.value[i] = makeParamEditor(
        doc,
        (editor)=>{ runParamValueValidation(editor); runParamDuplicateValidation() }
      )
    } else {
      paramEditors.value[i].commands.setContent(doc, false)
    }
    // validations + sync
    nextTick(()=>{ runAllValidations(); syncToParent() })
  } catch(e){
    console.error('seedFromMES error:', e)
    // on error, fallback to empty state (don’t leave stale editor)
    if (paramEditors.value[i]) {
      paramEditors.value[i].destroy()
      paramEditors.value[i] = null
    }
    pmsEmpty.value[i] = true
  } finally {
    pmsLoading.value[i] = false
  }
}


/* ===== Public actions ===== */
function addBlock(){
  const id = idSeq++
  const firstGroup = groupKeys.value[0]?.[0] || ''   // fix: groupKeys is entries => [code, info]
  const firstMachine = ''                            // don’t prefill machine

  blocks.value.push({
    content_id: null,
    client_temp_id: `temp-${uuidv1()}`,
    id,
    code: '',  // 先留空，下面用 updateProgramCode 填
    meta: { group: firstGroup, machine: firstMachine },
    data:{}
  })

  const idx = blocks.value.length - 1
  // 一建立 block 就依照目前的適用工程 + index 算程式號碼
  updateProgramCode(idx)

  // don’t init editor here; wait for machine selection
  pmsLoading.value[id] = false
  pmsEmpty.value[id]   = false
}

function renumberCodes() {
  blocks.value.forEach((b, idx) => {
    if (!b.code) return

    // 把「最後兩位數字」視為流水號
    const m = b.code.match(/^(.*?)(\d{2})$/)
    if (m) {
      const prefix = m[1]                  // e.g. "RE22101"
      const seq = String(idx + 1).padStart(2, '0') // "01", "02", ...
      b.code = `${prefix}${seq}`           // e.g. "RE22101" + "02"
    } else if (b.code.startsWith('XXXY')) {
      // 舊格式還是用 XXXY1, XXXY2 補一下
      b.code = `XXXY${idx + 1}`
    }
    // 其他奇怪格式就先暫時不動
  })
}
function delBlock(i){
  if (blocks.value.length === 1) return alert('至少需要保留一個組合')
  if (!confirm('確定要刪除此組合嗎？')) return

  paramEditors.value[i]?.destroy()
  blocks.value.splice(i, 1)
  paramEditors.value.splice(i, 1)

  // ✅ 只重排尾巴的流水號，不動前綴（RE + 製程碼那一段）
  renumberCodes()

  nextTick(runAllValidations)
}

function duplicateBlock(i){
  const src = blocks.value[i]
  const newIndex = blocks.value.length   // 將會是最後一個 index
  let newCode = src.code

  const m = src.code && src.code.match(/^(.*?)(\d{2})$/)
  if (m) {
    const prefix = m[1]
    const seq = String(newIndex + 1).padStart(2, '0')
    newCode = `${prefix}${seq}`
  } else {
    // fallback：沒 match 到就用舊邏輯
    newCode = `XXXY${newIndex + 1}`
  }

  blocks.value.push({
    id: idSeq++,
    code: newCode,
    meta: { ...(src.meta || {}) },
    data:{ jsonParameterContent: paramEditors.value[i]?.getJSON() }
  })
  nextTick(()=> initEditors(blocks.value.length-1))
}

function copyFromCode(targetIdx) {
  if (!copyCode.value) {
    return alert('請輸入要複製的代碼')
  }

  const srcIdx = blocks.value.findIndex(b => b.code === copyCode.value)
  if (srcIdx < 0) {
    return alert('找不到指定的代碼')
  }

  const srcEditor = paramEditors.value[srcIdx]

  // 🧱 防呆：來源 block 沒有 PMS 表格，就不要幫他生預設表格
  if (!srcEditor) {
    return alert('此程式號碼沒有 PMS 參數可複製')
  }

  const srcJson = srcEditor.getJSON()

  // 目標 block 若沒有 editor，才在這裡建立（用來源 JSON，不會用預設模板）
  if (!paramEditors.value[targetIdx]) {
    paramEditors.value[targetIdx] = makeParamEditor(
      srcJson,
      (editor) => {
        runParamValueValidation(editor)
        runParamDuplicateValidation()
      }
    )
  } else {
    // 已經有 editor，就直接覆蓋內容
    paramEditors.value[targetIdx].commands.setContent(srcJson)
  }

  // 同步 meta（群組、機台、specCode）
  blocks.value[targetIdx].meta = { ...(blocks.value[srcIdx].meta || {}) }

  runAllValidations()
  alert('複製成功')
}

async function onMachineChange(i) {
  const machineId = getSelectedMachineId(i)

  // 先推 metadata 中的 specCode
  const g = blocks.value[i]?.meta?.group || ''
  const m = blocks.value[i]?.meta?.machine || ''
  const specCode = findSpecCodeForGroupAndMachine(g, m)
  blocks.value[i].meta.specCode = specCode || blocks.value[i].meta.specCode || ''

  // 依 specCode + index 重算程式號碼
  // blocks.value[i].code = buildProgramCode(i, blocks.value[i].meta.specCode)

  syncToParent() // keep parent in sync

  if (!machineId) {
    // 清 editor & flags
    if (paramEditors.value[i]) {
      paramEditors.value[i].destroy()
      paramEditors.value[i] = null
    }
    pmsLoading.value[i] = false
    pmsEmpty.value[i]   = false
    return
  }

  await seedFromMES(i, machineId)
}

function onGroupChange(i) {
  const g = blocks.value[i]?.meta?.group || ''
  const mk = Object.keys(groupsMap.value[g]?.machines || {})
  if (!mk.includes(blocks.value[i].meta.machine)) {
    blocks.value[i].meta.machine = '' // force re-select machine
  }

  // 👉 群組改變時，就根據「適用工程 + block index」更新程式號碼
  updateProgramCode(i)

  // wipe editor and PMS flags until a machine is chosen
  if (paramEditors.value[i]) {
    paramEditors.value[i].destroy()
    paramEditors.value[i] = null
  }
  pmsLoading.value[i] = false
  pmsEmpty.value[i]   = false
  syncToParent()
}

/* ===== Validations ===== */
function getParamMatrix(ed){
  const mat=[]; let r=0
  ed.state.doc.descendants((n)=>{ 
    if(n.type.name==='tableRow'){ 
      if(r>0){
        const row=[]; let ci=0
        n.forEach(c=>{ if(ci>=2 && ci<=6) row.push(cellText(c) || '') ; ci++ })
        mat.push(row)
      }
      r++ 
    }
  })
  return JSON.stringify(mat)
}
function runParamDuplicateValidation(){
  const sigs = paramEditors.value.map((ed,i)=> ed?{i, sig:getParamMatrix(ed)}:null).filter(Boolean)
  const dupIdx = new Set()
  for(let a=0;a<sigs.length;a++) for(let b=a+1;b<sigs.length;b++){
    if(sigs[a].sig===sigs[b].sig){ dupIdx.add(sigs[a].i); dupIdx.add(sigs[b].i) }
  }
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
    const values=[], status=[]
    for(let c=2;c<=6;c++){
      const txt = cellText(cells.child(c))
      if(txt===''){ values.push(null); status.push('value-empty') }
      else if(isFinite(Number(txt))){ values.push(Number(txt)); status.push('value-valid') }
      else { values.push(null); status.push('value-invalid') }
    }
    for(let k=1;k<values.length;k++){
      const a=values[k-1], b=values[k]
      if(a!=null && b!=null && a>b){ status[k-1]='value-error'; status[k]='value-error' }
    }
    let posRow = 1; for(let t=0;t<r;t++) posRow += table.content.child(t).nodeSize
    let acc=[posRow+1]; for(let t=0;t<cells.childCount-1;t++) acc.push(acc[t]+cells.child(t).nodeSize)
    status.forEach((st,idx)=>{ const cellIdx=2+idx; const at = acc[cellIdx]; tr.setNodeMarkup(at, null, { ...cells.child(cellIdx).attrs, class:st }) })
  }
  if(tr.docChanged) view.dispatch(tr)
}
function runAllValidations(){
  paramEditors.value.forEach(ed=> ed && runParamValueValidation(ed))
  runParamDuplicateValidation()
}

/* ===== init per index ===== */
function initEditors(i) {
  const b = blocks.value[i]
  const json = b.data?.jsonParameterContent

  // 沒有 json 就不要建 editor（避免生出任何預設表格）
  if (!json) return

  const ed = makeParamEditor(json, (editor) => {
      runParamValueValidation(editor)
      runParamDuplicateValidation()
    }
  )

  if (ed) {
    paramEditors.value[i] = ed
    nextTick(runAllValidations)
  }
}



/* ===== Mount / Unmount ===== */
onMounted(async () => {
  await fetchGroups()

  if (!props.dataBlocks.length) {
    // 新草稿
    addBlock()
  } else {
    // 從後端載入既有資料
    blocks.value = props.dataBlocks.map((blk, idx) => {
      const meta = blk.data?.metadata || {}
      const group = meta.machineGroup || meta.group || ''
      const machine = meta.machine || ''
      const specCode = meta.specCode || ''       // 新增：嘗試讀出 specCode

      return {
        id: idSeq++,
        code: blk.code || buildProgramCode(idx, specCode),
        content_id: blk.content_id,
        client_temp_id: blk.client_temp_id,
        meta: {
          group,
          machine,
          specCode,
        },
        data: blk.data || {},
      }
    })

    // 修正不合法的群組/機台
    blocks.value.forEach((b, i) => {
      if (!b.meta.group || !groupsMap.value[b.meta.group]) {
        b.meta.group = ''
      }
      const mk = Object.keys(groupsMap.value[b.meta.group]?.machines || {})
      if (!b.meta.machine || !mk.includes(b.meta.machine)) {
        b.meta.machine = ''
      }
    })

    // 初始化 editor（保留你原本的三種情況邏輯）
    await Promise.all(
      blocks.value.map(async (b, i) => {
        const hasJson = !!b.data?.jsonParameterContent
        const mid = getSelectedMachineId(i)

        if (hasJson) {
          paramEditors.value[i] = makeParamEditor(
            b.data.jsonParameterContent,
            (editor) => {
              runParamValueValidation(editor)
              runParamDuplicateValidation()
            }
          )
          pmsLoading.value[i] = false
          pmsEmpty.value[i] = false
        } else if (mid) {
          await seedFromMES(i, mid)
        } else {
          pmsLoading.value[i] = false
          pmsEmpty.value[i] = false
        }
      })
    )
    blocks.value.forEach((b, i) => {
      // 舊資料可能已經有 code，如果你想「保留舊的」就加條件判斷
      if (!b.code || b.code.startsWith('XXXY')) {
        updateProgramCode(i)
      }
    })
  }

  nextTick(syncToParent)
})

// If template changes, re-seed only empty editors
watch(() => props.currentStep, (n) => {
  // no-op; you can react on step switch if needed
})
watch(
  () => {
    if (Array.isArray(props.specification)) {
      return props.specification
        .map(s => s && s.code)
        .filter(Boolean)
        .join('|')
    }
    return props.specification && props.specification.code
      ? props.specification.code
      : ''
  },
  async () => {
    await fetchGroups()

    // 調整每個 block 的群組/機台是否合法
    blocks.value.forEach((b, i) => {
      if (!b.meta.group || !groupsMap.value[b.meta.group]) {
        b.meta.group = ''
      }
      const mk = Object.keys(groupsMap.value[b.meta.group]?.machines || {})
      if (!b.meta.machine || !mk.includes(b.meta.machine)) {
        b.meta.machine = ''
        if (paramEditors.value[i]) {
          paramEditors.value[i].destroy()
          paramEditors.value[i] = null
        }
        pmsLoading.value[i] = false
        pmsEmpty.value[i]   = false
      }
    })

    syncToParent()
  }
)


onBeforeUnmount(()=>{
  const payload = exportData()
  emit('save', payload)
  paramEditors.value.forEach(e=>e?.destroy())
})

/* ===== Export / sync to parent ===== */
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

function exportData(){
  return blocks.value.map((b,i)=>({
    code: b.code,
    content_id: b.content_id,
    client_temp_id: b.client_temp_id,
    id: b.id,
    data:{
      jsonParameterContent: paramEditors.value[i]?.getJSON() || null,
      arrayParameterData:   extractTableArray(paramEditors.value[i]),
      paramHeaderText:      b.code,
      metadata: {
        machineGroup: b.meta?.group || '',
        machine: b.meta?.machine || '',
        specCode: b.meta?.specCode || '',      // ⬅ 新增
      }
    }
  }))
}


let emitTimer = null
function syncToParent() {
  clearTimeout(emitTimer)
  emitTimer = setTimeout(() => emit('update:dataBlocks', exportData()), 120)
}

/* ===== expose (optional) ===== */
defineExpose({ exportData })
</script>


<style scoped>
/* .blk-wrap{padding:12px} */
.btn{padding:6px 12px;border:none;border-radius:6px;color:#fff;background:#007bff;cursor:pointer}
.btn:hover{opacity:.9}
/* .btn.add{background:#28a745;margin-bottom:12px} */
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

.hint{ padding:12px; color:#555; background:#f8f9fb; border:1px dashed #cfd8dc; border-radius:6px; margin:8px 0 }
.hint.empty{ color:#9e9e9e; text-align:center; }
</style>