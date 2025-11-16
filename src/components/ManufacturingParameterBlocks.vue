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
          <i class="dot red" @click="paramEditors[i]?.chain().focus().setColor('red').run()"></i>
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
  specification: { type: Object, default: () => ({ specific: "", code: "" }) },       // passed from parent
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
const groupsMap = ref({}) // shape: { [groupName]: { code, machines: { [machineName]: { code } } } }
const groupKeys = computed(() => Object.entries(groupsMap.value))
const machineKeysFor = (i) => {
  const g = blocks.value[i]?.meta?.group || ''
  const gm = groupsMap.value[g]?.machines || {}
  return Object.entries(gm)
}

async function fetchGroups() {
  console.log("props specification: ", props.specification)
  if (!props.specification) return
  try {
    // Adjust URL if your blueprint is mounted under a prefix (e.g., /mes/groups-machines)
    const { data } = await axios.get(`${API_BASE_URL}/mes/groups-machines`, {
      params: { specific: props.specification.code }
    })
    groupsMap.value = data?.data?.groups || {}
  } catch (e) {
    console.error('fetch groups-machines failed:', e)
    groupsMap.value = {}
  }
}

// NEW: resolve the Oracle MACHINE_CODE (machine_id) from current selection
function getSelectedMachineId(i){
  const gKey = blocks.value[i]?.meta?.group || ''
  const mKey = blocks.value[i]?.meta?.machine || ''
  // const mInfo = groupsMap.value?.[gKey]?.machines?.[mKey]
  // in your data shape, key is "machineCode" (actually a name), .code is the true MACHINE_CODE
  // return (mInfo?.code || '').trim()
  return (mKey || '').trim()
}

/* ===== Parameter table template ===== */
const LOCK_COLS = [0,1,7,8]
const DEFAULT_ROWS = [
  ['槽體','管理項目','規格下限(OOS-)','操作下限(OOC-)','設定值','操作上限(OOC+)','規格上限(OOS+)','單位','參數下放','說明'],
  ['熱水洗1','噴壓','','','','','','kgf/cm2','Y',''],
  ['熱水洗1','溫度','','','','','','℃','Y',''],
  ['剝膜1','氫氧化鈉NaOH','','','','','','%','Y',''],
  ['剝膜1','噴壓','','','','','','kgf/cm2','Y',''],
  ['剝膜1','作業溫度','','','','','','℃','Y',''],
]
const isDoc = (x) => x && typeof x === 'object' && x.type === 'doc'
function buildParamDocFromRows(rows) {
  const trows = rows.map((row, rIdx) => ({
    type:'tableRow',
    content: row.map((txt, cIdx) => ({
      type: rIdx === 0 ? 'tableHeader' : 'tableCell',
      attrs:{ contenteditable: (rIdx===0 || LOCK_COLS.includes(cIdx)) ? false : true },
      content:[{ type:'paragraph', content: txt ? [{ type:'text', text: String(txt) }] : [] }]
    }))
  }))
  return { type:'doc', content:[{ type:'table', content:trows }] }
}
function normalizeParamTemplate() {
  const t = DEFAULT_ROWS
  if (!t) return buildParamDocFromRows([[]])
  if (isDoc(t)) return t
  if (Array.isArray(t)) return buildParamDocFromRows(t)
  return buildParamDocFromRows(DEFAULT_ROWS)
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
  const seed = json || normalizeParamTemplate()
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
    code:`XXXY${blocks.value.length + 1}`,
    meta: { group: firstGroup, machine: firstMachine },
    data:{}
  })
  // don’t init editor here; wait for machine selection
  pmsLoading.value[id] = false
  pmsEmpty.value[id]   = false
}
function delBlock(i){
  if (blocks.value.length===1) return alert('至少需要保留一個組合')
  if (!confirm('確定要刪除此組合嗎？')) return
  paramEditors.value[i]?.destroy()
  blocks.value.splice(i,1); paramEditors.value.splice(i,1)
  blocks.value = blocks.value.map((b, idx) => ({...b, code: `XXXY${idx + 1}`}))
  nextTick(runAllValidations)
}
function duplicateBlock(i){
  const src = blocks.value[i]
  const duplicatedMeta = { ...(src.meta || {}) }
  blocks.value.push({
    id: idSeq++,
    // code:`${src.code}_copy`,
    code:`XXXY${blocks.value.length + 1}`,
    meta: duplicatedMeta,
    data:{ jsonParameterContent: paramEditors.value[i]?.getJSON() }
  })
  nextTick(()=> initEditors(blocks.value.length-1))
}
function copyFromCode(targetIdx){
  if (!copyCode.value) return alert('請輸入要複製的代碼')
  const srcIdx = blocks.value.findIndex(b=>b.code===copyCode.value)
  if (srcIdx<0) return alert('找不到指定的代碼')
  paramEditors.value[targetIdx].commands.setContent(paramEditors.value[srcIdx].getJSON())
  // also copy group/machine meta?
  blocks.value[targetIdx].meta = { ...(blocks.value[srcIdx].meta || {}) }
  runAllValidations(); alert('複製成功')
}

async function onMachineChange(i){
  syncToParent() // keep parent in sync

  const machineId = getSelectedMachineId(i)
  // if no machine, clear editor / flags
  if (!machineId){
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
  paramEditors.value[i] = makeParamEditor(
    b.data?.jsonParameterContent || null,
    (editor) => { runParamValueValidation(editor); runParamDuplicateValidation() }
  )
  nextTick(runAllValidations)
}

/* ===== Mount / Unmount ===== */
onMounted(async ()=>{
  await fetchGroups()

  if (!props.dataBlocks.length){
    addBlock()
  } else {
    blocks.value = props.dataBlocks.map((blk,idx)=>({
      id:idSeq++,
      code: blk.code || `XXXY${idx+1}`,
      content_id: blk.content_id,
      client_temp_id: blk.client_temp_id,
      meta: {
        group: blk.data?.metadata?.machineGroup || '',
        machine: blk.data?.metadata?.machine || '',
      },
      data: blk.data || {}
    }))

    // fix invalid selections against current groups
    blocks.value.forEach((b, i) => {
      if (!b.meta.group || !groupsMap.value[b.meta.group]) b.meta.group = ''
      const mk = Object.keys(groupsMap.value[b.meta.group]?.machines || {})
      if (!b.meta.machine || !mk.includes(b.meta.machine)) b.meta.machine = ''
    })

    // try auto load PMS for blocks that already have a valid machine
    await Promise.all(blocks.value.map(async (b, i) => {
      const mid = getSelectedMachineId(i)
      if (mid) await seedFromMES(i, mid)
      else {
        pmsLoading.value[i] = false
        pmsEmpty.value[i]   = false
      }
    }))
  }
  nextTick(syncToParent)
})

// If template changes, re-seed only empty editors
watch(() => props.currentStep, (n) => {
  // no-op; you can react on step switch if needed
})
// watch(() => props.specification, async () => {
//   await fetchGroups()

//   blocks.value.forEach((b, i) => {
//     if (!b.meta.group || !groupsMap.value[b.meta.group]) b.meta.group = ''
//     const mk = Object.keys(groupsMap.value[b.meta.group]?.machines || {})
//     if (!b.meta.machine || !mk.includes(b.meta.machine)) b.meta.machine = ''
//   })

//   // reload PMS for valid machines, otherwise clear editor
//   await Promise.all(blocks.value.map(async (b, i) => {
//     const mid = getSelectedMachineId(i)
//     if (mid) await seedFromMES(i, mid)
//     else {
//       if (paramEditors.value[i]) { paramEditors.value[i].destroy(); paramEditors.value[i] = null }
//       pmsLoading.value[i] = false
//       pmsEmpty.value[i]   = false
//     }
//   }))

//   syncToParent()
// })


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
.ed :deep(th){background:#f8f9fa;font-weight:700;position:sticky;top:100px;z-index:5;}
.ed :deep(.selectedCell){background:#e3f2fd!important;outline:2px solid #2196f3;outline-offset:-2px}
.ed :deep([contenteditable="false"]){background:#f5f5f5;color:#666;cursor:not-allowed}
.ed :deep(tr.dup-row td){background:#ffe6e6!important}      /* 5.1 duplicate row: red-ish */
.ed :deep(tr.dup-table td){background:#ffe6e6!important}    /* 6.3 duplicate table: red-ish */
.ed :deep(td.value-empty){background:#fff7c2}               /* 6.4.2 empty: yellow */
.ed :deep(td.value-invalid),.ed :deep(td.value-error){background:#ffcdd2} /* 6.4.3 invalid: red */

.hint{ padding:12px; color:#555; background:#f8f9fb; border:1px dashed #cfd8dc; border-radius:6px; margin:8px 0 }
.hint.empty{ color:#9e9e9e; text-align:center; }
</style>