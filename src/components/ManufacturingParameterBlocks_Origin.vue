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

      <!-- palette -->
      <div v-if="paramEditors[i]" class="menu right">
        <div class="r">
          <i class="dot red"   @click="setCellColor(i,'#ff0000')"></i>
          <i class="dot blue"  @click="setCellColor(i,'#0000ff')"></i>
          <i class="dot black" @click="setCellColor(i,'#000000')"></i>
        </div>
      </div>

      <EditorContent v-if="paramEditors[i]" :editor="paramEditors[i]" class="ed ed-param" />
    </div>
  </div>
</template>

<script setup>
/**
 * ManufacturingConditionRuleBlocks.vue (plain-cell edition)
 * - No dropdown nodeView; all cells are plain text
 * - Header + some columns are read-only (LOCK_COLS)
 * - Validations:
 *   - numeric columns 3..7 empty/invalid/error highlighting
 *   - per-table duplicate detection (same 5-number signature)
 * - Emits update:dataBlocks with
 *      data: { jsonParameterContent, arrayParameterData, paramHeaderText }
 */

import { ref, onMounted, nextTick, onBeforeUnmount, watch } from 'vue'
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
  dataBlocks: { type: Array, default: () => [] },   // [{ code, data:{ jsonParameterContent, ... } }, ...]
  paramTemplate: { type: [Object, Array], default: null }, // TipTap JSON or 2D array
  currentStep: { type: Number, default: 0 },
})
const emit = defineEmits(['update:dataBlocks','save'])

/* ===== TipTap setup (plain cells) ===== */
const Base = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })]
const LockableHeader = TableHeader.extend({
  addAttributes() { return { ...(this.parent?.() || {}), contenteditable: { default: false } } }
})
const LockableCell = TableCell.extend({
  addAttributes() { return { ...(this.parent?.() || {}), contenteditable: { default: true }, class: { default: null } } }
})
const Row = TableRow.extend({
  addAttributes() { return { ...(this.parent?.() || {}), class: { default: null } } }
})
const TableOnlyDoc = Document.extend({ content:'table' })

const TExt = [
  TableOnlyDoc, ...Base,
  Table.configure({ resizable:false, allowTableNodeSelection:true, handleWidth:5, cellMinWidth:50 }),
  Row, LockableHeader, LockableCell, History
]

/* ===== Reactive state ===== */
const blocks = ref([])          // [{ id, code, content_id?, client_temp_id?, data? }]
const paramEditors = ref([])    // Editor[]
const copyCode = ref('')
let idSeq = 0

/* ===== Config ===== */
// Keep the “locked” columns read-only (0-based indexes in your parameter table)
const LOCK_COLS = [0, 1, 7, 8]   // 與你原本一致：項次/槽體/單位/參數下放 (可自行調整)

// initial array version (only used if there’s no prop content)
const DEFAULT_ROWS = [
  ['槽體','管理項目','規格上限','操作上限','中值','操作下限','規格下限','單位','參數下放','說明'],
  ['熱水洗1','噴壓','','','','','','kgf/cm2','Y',''],
  ['熱水洗1','溫度','','','','','','℃','Y',''],
  ['剝膜1','氫氧化鈉NaOH','','','','','','%','Y',''],
  ['剝膜1','噴壓','','','','','','kgf/cm2','Y',''],
  ['剝膜1','作業溫度','','','','','','℃','Y',''],
]

/* ===== Template → TipTap ===== */
const isDoc = (x) => x && typeof x === 'object' && x.type === 'doc'

function buildParamDocFromRows(rows) {
  const trows = (rows || []).map((row, rIdx) => ({
    type:'tableRow',
    content:(row || []).map((txt, cIdx) => {
      const head = rIdx === 0
      const locked = head || LOCK_COLS.includes(cIdx)
      const type = head ? 'tableHeader' : 'tableCell'
      return {
        type,
        attrs:{ contenteditable: locked ? false : true },
        content:[{ type:'paragraph', content: txt ? [{ type:'text', text:String(txt)}] : [] }]
      }
    })
  }))
  return { type:'doc', content:[{ type:'table', content:trows }] }
}


function normalizeParamTemplate() {
  const t = props.paramTemplate
  if (!t) return buildParamDocFromRows(DEFAULT_ROWS)
  if (isDoc(t)) return t
  if (Array.isArray(t)) return buildParamDocFromRows(t)
  return buildParamDocFromRows(DEFAULT_ROWS)
}

/* ===== Cell text extractor ===== */
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
        // Clear multiple selected editable cells on Backspace/Delete
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

/* ===== Public actions ===== */
function addBlock(){
  const id = idSeq++
  blocks.value.push({
    content_id: null,
    client_temp_id: `temp-${uuidv1()}`,
    id,
    code:`XXXY${blocks.value.length + 1}`,
    data:{}
  })
  nextTick(()=> initEditors(blocks.value.length-1))
}
function delBlock(i){
  if (blocks.value.length===1) return alert('至少需要保留一個組合')
  if (!confirm('確定要刪除此組合嗎？')) return
  paramEditors.value[i]?.destroy()
  blocks.value.splice(i,1); paramEditors.value.splice(i,1)
  blocks.value = blocks.value.map((b, idx) => ({...b, code: `XXXX${idx + 1}`}))
  nextTick(runAllValidations)
}
function duplicateBlock(i){
  const src = blocks.value[i]
  blocks.value.push({
    id: idSeq++,
    code:`${src.code}_copy`,
    data:{ jsonParameterContent: paramEditors.value[i]?.getJSON() }
  })
  nextTick(()=> initEditors(blocks.value.length-1))
}
function copyFromCode(targetIdx){
  if (!copyCode.value) return alert('請輸入要複製的代碼')
  const srcIdx = blocks.value.findIndex(b=>b.code===copyCode.value)
  if (srcIdx<0) return alert('找不到指定的代碼')
  paramEditors.value[targetIdx].commands.setContent(paramEditors.value[srcIdx].getJSON())
  runAllValidations()
  alert('複製成功')
}

/* ===== Coloring ===== */
function setCellColor(i, color){
  const ed = paramEditors.value[i]; if(!ed) return
  const { state, view } = ed; const { selection } = state; const tr = state.tr
  if (selection instanceof CellSelection){
    const m = state.schema.marks.textStyle
    selection.forEachCell((cell,pos)=>{
      if (cell.attrs?.contenteditable === false) return
      state.doc.nodesBetween(pos, pos+cell.nodeSize, (n,p)=>{ if(n.isText) tr.addMark(p, p+n.nodeSize, m.create({ color })) })
    })
    if(tr.docChanged) view.dispatch(tr)
    return
  }
  // single cell
  const $p = state.doc.resolve(selection.from); let c=null, cpos=null
  for(let d=$p.depth; d>0; d--){ const n=$p.node(d); if(n.type.name==='tableCell'||n.type.name==='tableHeader'){ c=n; cpos=$p.before(d); break } }
  if(!c || c.type.name==='tableHeader' || c.attrs?.contenteditable===false) return
  ed.chain().focus().setColor(color).run()
}

/* ===== Validations ===== */
// signature of 5 numeric values (columns 3..7) to detect duplicates across blocks
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
// per-row numeric value checks across columns 3..7
function runParamValueValidation(ed){
  const { state, view } = ed; const tr = state.tr
  const table = state.doc.content.firstChild; if(!table || table.type.name!=='table') return
  for(let r=1;r<table.content.childCount;r++){
    const row = table.content.child(r); const cells=row.content
    const values=[], status=[]

    // take 3..7
    for(let c=2;c<=6;c++){
      const txt = cellText(cells.child(c))
      if(txt===''){ values.push(null); status.push('value-empty') }
      else if(isFinite(Number(txt))){ values.push(Number(txt)); status.push('value-valid') }
      else { values.push(null); status.push('value-invalid') }
    }

    // adjacent check (a >= b required)
    for(let k=1;k<values.length;k++){
      const a=values[k-1], b=values[k]
      if(a!=null && b!=null && a<b){ status[k-1]='value-error'; status[k]='value-error' }
    }

    // compute absolute positions of each cell in this row
    let posRow = 1; for(let t=0;t<r;t++) posRow += table.content.child(t).nodeSize
    let acc=[posRow+1]; for(let t=0;t<cells.childCount-1;t++) acc.push(acc[t]+cells.child(t).nodeSize)

    // write classes back
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
  const json = b?.data?.jsonParameterContent
    ? b.data.jsonParameterContent
    : (Array.isArray(b?.data?.arrayParameterData) && b.data.arrayParameterData.length
        ? buildParamDocFromRows(b.data.arrayParameterData)
        : null)

  paramEditors.value[i] = makeParamEditor(
    json,
    (editor) => { runParamValueValidation(editor); runParamDuplicateValidation() }
  )
  nextTick(runAllValidations)
}

/* ===== Mount / Unmount ===== */
function destroyEditors() {
  paramEditors.value.forEach(e => e?.destroy())
  paramEditors.value = []
}
function rebuildFromProps(list) {
  destroyEditors()
  blocks.value = (list || []).map((blk, idx) => ({
    id: idSeq++,
    code: blk.code || `XXXX${idx + 1}`,
    content_id: blk.content_id,
    client_temp_id: blk.client_temp_id,
    data: blk.data || {}
  }))
  blocks.value.forEach((_, i) => initEditors(i))
  nextTick(syncToParent)
}

onMounted(()=>{
  if (!props.dataBlocks.length){ addBlock() }
  else {
    blocks.value = props.dataBlocks.map((blk,idx)=>({
      id:idSeq++,
      code: blk.code || `XXXX${idx+1}`,
      content_id: blk.content_id,
      client_temp_id: blk.client_temp_id,
      data: blk.data || {}
    }))
    blocks.value.forEach((_,i)=> initEditors(i))
  }
  nextTick(syncToParent)
})

// If template changes, re-seed only empty editors
watch(() => props.paramTemplate, () => {
  paramEditors.value.forEach((ed,i)=>{
    const hasUserContent = !!blocks.value[i]?.data?.jsonParameterContent
    if (!hasUserContent && ed) {
      ed.commands.setContent(normalizeParamTemplate(), false)
    }
  })
})
watch(
  () => props.dataBlocks,
  (nv) => { if (Array.isArray(nv)) rebuildFromProps(nv) },
  { deep: true }
)


onBeforeUnmount(()=>{
  const payload = exportData()
  emit('save', payload)
  paramEditors.value.forEach(e=>e?.destroy())
})

/* ===== Export / sync ===== */
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
    }
  }))
}

let emitTimer = null
function syncToParent() {
  clearTimeout(emitTimer)
  emitTimer = setTimeout(() => emit('update:dataBlocks', exportData()), 120)
}
</script>

<style scoped>
.btn{padding:6px 12px;border:none;border-radius:6px;color:#fff;background:#007bff;cursor:pointer}
.btn:hover{opacity:.9}
.btn.add { margin: 10px; background-color: #1666C0; padding: 8px 12px; border-radius: 5px; font-size: 14px; cursor: pointer;}
.btn.info{background:#17a2b8}
.btn.danger{background:#dc3545}

.blk{border:2px solid #ddd;border-radius:8px;padding:12px;margin-bottom:14px;background:#fafafa}
.blk-hd{display:flex;gap:12px;align-items:center;justify-content:space-between;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:10px}
.copybox{display:flex;align-items:center;gap:8px}
.ops{display:flex;gap:8px}

.menu{display:flex;justify-content:flex-end;align-items:center;padding:8px;border:1px solid #eee;border-radius:6px;background:#fff;margin:8px 0}
.dot{display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:pointer}
.red{background:#f00}.blue{background:#00f}.black{background:#000}

.ed{background:#fff;border:1px solid #ddd;border-radius:6px;margin-bottom:10px}
.ed :deep(.ProseMirror){padding:8px;min-height:80px;outline:none}
.ed :deep(table){border-collapse:collapse;width:100%;table-layout:fixed}
.ed :deep(th),.ed :deep(td){border:1px solid #ddd;padding:8px;text-align:center;vertical-align:middle;min-width:72px;position:relative}
.ed :deep(th){background:#f8f9fa;font-weight:700}
.ed :deep(.selectedCell){background:#e3f2fd!important;outline:2px solid #2196f3;outline-offset:-2px}
.ed :deep([contenteditable="false"]){background:#f5f5f5;color:#666;cursor:not-allowed}

/* duplicate and numeric state */
.ed :deep(tr.dup-table td){background:#ffe6e6!important}
.ed :deep(td.value-empty){background:#fff7c2}
.ed :deep(td.value-invalid), .ed :deep(td.value-error){background:#ffcdd2}
</style>
