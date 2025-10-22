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

      <!-- Condition (Table 1) -->
      <div v-if="condEditors[i]" class="menu">
        <div class="l">
          <button class="btn ghost" @click="addCondRow(i)">新增列</button>
          <button class="btn ghost danger" @click="delCondRow(i)">刪除列</button>
        </div>
        <div class="r">
          <i class="dot red" @click="setCellColor(i,'cond','#ff0000')"></i>
          <i class="dot blue" @click="setCellColor(i,'cond','#0000ff')"></i>
          <i class="dot black" @click="setCellColor(i,'cond','#000000')"></i>
        </div>
      </div>
      <EditorContent v-if="condEditors[i]" :editor="condEditors[i]" class="ed ed-cond" />

      <!-- Parameter (Table 2) -->
      <div v-if="paramEditors[i]" class="menu right">
        <div class="r">
          <i class="dot red" @click="setCellColor(i,'param','#ff0000')"></i>
          <i class="dot blue" @click="setCellColor(i,'param','#0000ff')"></i>
          <i class="dot black" @click="setCellColor(i,'param','#000000')"></i>
        </div>
      </div>
      <EditorContent v-if="paramEditors[i]" :editor="paramEditors[i]" class="ed ed-param" />
    </div>
  </div>
</template>

<script setup>
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

/* ===== Props ===== */
const props = defineProps({
  dataBlocks: { type: Array, default: () => [] },     // saved blocks
  // Templates can be:
  // 1) TipTap JSON doc (object with type:'doc')
  // 2) Condition: Array<{ name: string, options: {label,value}[] }>
  // 3) Parameter: 2D array of strings (header + rows)
  condTemplate:  { type: [Object, Array], default: null },
  paramTemplate: { type: [Object, Array], default: null },
  currentStep: { type: Number, default: 0 },
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
      dropdownColor: { default: '#000' },
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
            .map(o => `<option value="${o.value}">${o.label}</option>`)
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
  TableOnlyDoc, ...Base,
  Table.configure({ resizable:false, allowTableNodeSelection:true, handleWidth:5, cellMinWidth:50 }),
  Row, Hdr, Cell, History
]

/* ===== Reactive state ===== */
const blocks = ref([])          // {id, code, data?}
const condEditors = ref([])     // Editor[]
const paramEditors = ref([])    // Editor[]
const copyCode = ref('')
let idSeq = 0

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
  const LOCK_COLS = [0,1,7,8]
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

/* ===== Public actions (unchanged UI) ===== */
function addBlock(){
  const id = idSeq++
  blocks.value.push({ content_id: null, client_temp_id: `temp-${uuidv1()}`, id, code:`XXXX${blocks.value.length + 1}`, data:{} })
  nextTick(()=> initEditors(blocks.value.length-1))
}
function delBlock(i){
  if (blocks.value.length===1) return alert('至少需要保留一個組合')
  if (!confirm('確定要刪除此組合嗎？')) return
  condEditors.value[i]?.destroy(); paramEditors.value[i]?.destroy()
  blocks.value.splice(i,1); condEditors.value.splice(i,1); paramEditors.value.splice(i,1)
  blocks.value = blocks.value.map((b, i) => ({...b, code: `XXXX${i + 1}`}))
  nextTick(runAllValidations)
}
function duplicateBlock(i){
  const src = blocks.value[i]; const id = idSeq++
  blocks.value.push({
    id, code:`${src.code}_copy`, data:{
      jsonConditionContent: condEditors.value[i].getJSON(),
      jsonParameterContent: paramEditors.value[i].getJSON()
    }
  })
  nextTick(()=> initEditors(blocks.value.length-1))
}
function copyFromCode(targetIdx){
  if (!copyCode.value) return alert('請輸入要複製的代碼')
  const srcIdx = blocks.value.findIndex(b=>b.code===copyCode.value)
  if (srcIdx<0) return alert('找不到指定的代碼')
  condEditors.value[targetIdx].commands.setContent(condEditors.value[srcIdx].getJSON())
  paramEditors.value[targetIdx].commands.setContent(paramEditors.value[srcIdx].getJSON())
  runAllValidations(); alert('複製成功')
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
      if(a!=null && b!=null && a<b){ rowStatus[k-1]='value-error'; rowStatus[k]='value-error' }
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

/* ===== init per index ===== */
function initEditors(i) {
  const b = blocks.value[i]
  condEditors.value[i] = makeCondEditor(
    b.data?.jsonConditionContent || null,
    () => { runCondValidation() }
  )
  paramEditors.value[i] = makeParamEditor(
    b.data?.jsonParameterContent || null,
    ({ editor }) => { runParamValueValidation(editor); runParamDuplicateValidation() }
  )
  nextTick(runAllValidations)
}

/* ===== Mount / Unmount ===== */
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

// If templates change later (e.g., user switches machine),
// re-seed ONLY empty editors to avoid clobbering user edits.
watch(() => props.condTemplate, () => {
  condEditors.value.forEach((ed,i)=>{
    const hasUserContent = !!blocks.value[i]?.data?.jsonConditionContent
    if (!hasUserContent && ed) {
      const doc = normalizeCondTemplate()
      if (doc) ed.commands.setContent(doc, false)
    }
  })
})
watch(() => props.paramTemplate, () => {
  paramEditors.value.forEach((ed,i)=>{
    const hasUserContent = !!blocks.value[i]?.data?.jsonParameterContent
    if (!hasUserContent && ed) {
      const doc = normalizeParamTemplate()
      if (doc) ed.commands.setContent(doc, false)
    }
  })
})

onBeforeUnmount(()=>{
  const payload = exportData()
  emit('save', payload)
  condEditors.value.forEach(e=>e?.destroy())
  paramEditors.value.forEach(e=>e?.destroy())
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

function exportData(){
  return blocks.value.map((b,i)=>({
    // keep code so backend can save parameter table textHeader
    code: b.code,
    content_id: b.content_id,
    client_temp_id: b.client_temp_id,
    id: b.id,
    data:{
      // condition
      jsonConditionContent: condEditors.value[i]?.getJSON(),
      arrayConditionData:   extractTableArray(condEditors.value[i]),
      // parameter
      jsonParameterContent: paramEditors.value[i]?.getJSON(),
      arrayParameterData:   extractTableArray(paramEditors.value[i]),
      // for parameter table “textHeader” requirement
      paramHeaderText: b.code,
    }
  }))
}

let emitTimer = null
function syncToParent() {
  clearTimeout(emitTimer)
  emitTimer = setTimeout(() => emit('update:dataBlocks', exportData()), 150)
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
.ed :deep(th){background:#f8f9fa;font-weight:700}
.ed :deep(.selectedCell){background:#e3f2fd!important;outline:2px solid #2196f3;outline-offset:-2px}
.ed :deep([contenteditable="false"]){background:#f5f5f5;color:#666;cursor:not-allowed}
.ed :deep(tr.dup-row td){background:#ffe6e6!important}      /* 5.1 duplicate row: red-ish */
.ed :deep(tr.dup-table td){background:#ffe6e6!important}    /* 6.3 duplicate table: red-ish */
.ed :deep(td.value-empty){background:#fff7c2}               /* 6.4.2 empty: yellow */
.ed :deep(td.value-invalid),.ed :deep(td.value-error){background:#ffcdd2} /* 6.4.3 invalid: red */
.ed :deep(.dropdown-cell){width:100%;padding:4px}
.ed :deep(.cell-dropdown){width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;background:#fff}
.ed :deep(.cell-dropdown:focus){outline:2px solid #2196f3;border-color:#2196f3}
</style>