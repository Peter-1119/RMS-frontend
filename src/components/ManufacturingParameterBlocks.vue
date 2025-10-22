<!-- src/components/ManufacturingParameterBlocks.vue -->
<template>
  <div class="blk-wrap">
    <button class="btn add" @click="addBlock">新增組合</button>

    <div v-for="(b, i) in localBlocks" :key="b.id" class="blk">
      <div class="blk-hd">
        <div><b>程式號碼：</b>{{ b.code }}</div>
        <div class="ops">
          <button class="btn info" @click="copyBlock(i)">複製模塊</button>
          <button class="btn danger" @click="deleteBlock(i)">刪除</button>
        </div>
      </div>

      <!-- meta row -->
      <div class="menu">
        <div class="l">
          <label>群組</label>
          <select v-model="b.machineGroup">
            <option value="">--</option>
            <option v-for="g in machineGroups" :key="g" :value="g">{{ g }}</option>
          </select>
          <label style="margin-left:8px;">機台</label>
          <input v-model="b.machine" placeholder="機台代碼/名稱"/>
        </div>
        <div class="r">
          <button class="btn ghost" @click="addRow(i)">新增列</button>
          <button class="btn ghost danger" @click="deleteRow(i)">刪除列</button>
        </div>
      </div>

      <EditorContent v-if="editors[i]" :editor="editors[i]" class="ed ed-param" />
      <div v-if="dupMap[i]" class="dup-hint">⚠ 此表與其它表內容重複</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { EditorContent, Editor } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { History } from '@tiptap/extension-history'
import { CellSelection } from 'prosemirror-tables'

const props = defineProps({
  /* v-model for blocks */
  modelValue: {
    type: Array,
    default: () => [],   // [{id, code, machineGroup, machine, table:string[][]}]
  },
  machineGroups: { type: Array, default: () => [] },
  codePrefix: { type: String, default: 'XXXY' },
})

const emit = defineEmits(['update:modelValue'])

let uid = 1
const localBlocks = ref([])
const editors = ref([])
const dupMap = ref({})

/* ---------- TipTap setup ---------- */
const BaseDoc = Document.extend({ content: 'table' })
const EXT = [BaseDoc, Paragraph, Text, History, Table, TableRow, TableHeader, TableCell]

function buildDocFromTable(rows) {
  const trows = (rows || []).map((row, rIdx) => ({
    type: 'tableRow',
    content: (row || []).map((txt) => ({
      type: rIdx === 0 ? 'tableHeader' : 'tableCell',
      content: [{ type:'paragraph', content: txt ? [{ type:'text', text: String(txt) }] : [] }]
    }))
  }))
  // fallback to a 6-col header + 1 row
  if (!trows.length) {
    trows.push({
      type:'tableRow',
      content: Array.from({length: 6}, () => ({ type:'tableHeader', content:[{type:'paragraph'}] }))
    })
    trows.push({
      type:'tableRow',
      content: Array.from({length: 6}, () => ({ type:'tableCell', content:[{type:'paragraph'}] }))
    })
  }
  return { type:'doc', content: [{ type:'table', content: trows }] }
}

function extractTable(ed) {
  const t = ed?.state?.doc?.content?.firstChild
  if (!t || t.type.name !== 'table') return []
  const out = []
  t.content.forEach(row => {
    const r = []
    row.content.forEach(c => {
      const p = c.content?.childCount ? c.content.child(0) : null
      const s = p?.content?.content?.map(x=>x.text || '').join('') || ''
      r.push(s.trim())
    })
    out.push(r)
  })
  return out
}

function initEditorAt(i) {
  const b = localBlocks.value[i]
  const ed = new Editor({
    extensions: EXT,
    content: buildDocFromTable(b.table || []),
    editorProps: {
      handleKeyDown(view, event) {
        if (!['Backspace','Delete'].includes(event.key)) return false
        const sel = view.state.selection
        if (!(sel instanceof CellSelection)) return false
        const { state } = view; let tr = state.tr
        sel.forEachCell((cell,pos) => {
          if (cell.type.name === 'tableHeader') return
          const empty = state.schema.nodes.paragraph.create()
          const newCell = cell.type.create(cell.attrs, empty, cell.marks)
          tr = tr.replaceWith(pos, pos + cell.nodeSize, newCell)
        })
        if (tr.docChanged) view.dispatch(tr)
        event.preventDefault(); return true
      }
    },
    onUpdate: ({ editor }) => {
      localBlocks.value[i].table = extractTable(editor)
      computeDuplicates()
      emit('update:modelValue', structuredClone(localBlocks.value))
    }
  })
  editors.value[i] = ed
}

function destroyEditorAt(i) {
  editors.value[i]?.destroy()
  editors.value[i] = null
}

/* ---------- Block ops ---------- */
function nextCode(n) {
  return `${props.codePrefix}${String(n).padStart(2, '0')}`
}
function renumberCodes() {
  localBlocks.value.forEach((b, i) => { b.code = nextCode(i + 1) })
}

function addBlock() {
  localBlocks.value.push({
    id: uid++,
    code: nextCode(localBlocks.value.length + 1),
    machineGroup: '',
    machine: '',
    table: [],
  })
  nextTick(() => {
    initEditorAt(localBlocks.value.length - 1)
    computeDuplicates()
    emit('update:modelValue', structuredClone(localBlocks.value))
  })
}

function copyBlock(i) {
  const src = localBlocks.value[i]
  localBlocks.value.push(structuredClone({
    ...src,
    id: uid++,
    code: nextCode(localBlocks.value.length + 1),
  }))
  nextTick(() => {
    initEditorAt(localBlocks.value.length - 1)
    // seed content into editor
    const lastIdx = localBlocks.value.length - 1
    const tdoc = buildDocFromTable(localBlocks.value[lastIdx].table || [])
    editors.value[lastIdx]?.commands.setContent(tdoc, false)
    computeDuplicates()
    emit('update:modelValue', structuredClone(localBlocks.value))
  })
}

function deleteBlock(i) {
  destroyEditorAt(i)
  localBlocks.value.splice(i, 1)
  editors.value.splice(i, 1)
  renumberCodes()
  computeDuplicates()
  emit('update:modelValue', structuredClone(localBlocks.value))
}

/* ---------- Row ops (current editor selection) ---------- */
function addRow(i) {
  editors.value[i]?.chain().focus().addRowAfter().run()
}
function deleteRow(i) {
  const ed = editors.value[i]; if (!ed) return
  const $a = ed.state.selection.$anchor
  for (let d=$a.depth; d>=0; d--){
    const n = $a.node(d)
    if(n.type.name==='tableRow'){
      const inHeader = $a.before(d)===2
      if(inHeader) return alert('無法刪除表頭')
      ed.chain().focus().deleteRow().run()
      return
    }
  }
  alert('請選擇要刪除的列')
}

/* ---------- Duplicate detection ---------- */
function serializeTable(table) {
  if (!Array.isArray(table) || table.length <= 1) return null
  const payload = table.slice(1).map(row => (row || []).slice(0, 8).join('|')).join('|')
  return payload.includes('||') ? null : JSON.stringify(table.slice(1))
}
function computeDuplicates() {
  const seen = new Map()
  const dup = {}
  localBlocks.value.forEach((_, idx) => dup[idx] = false)
  localBlocks.value.forEach((b, idx) => {
    const sig = serializeTable(b.table)
    if (!sig) return
    if (!seen.has(sig)) seen.set(sig, [])
    seen.get(sig).push(idx)
  })
  for (const indices of seen.values()) {
    if (indices.length > 1) indices.forEach(i => dup[i] = true)
  }
  dupMap.value = { ...dup }
}

/* ---------- v-model wiring ---------- */
watch(() => props.modelValue, (nv) => {
  // re-init when parent provides initial or loaded blocks
  // destroy old editors
  editors.value.forEach(ed => ed?.destroy())
  editors.value = []
  localBlocks.value = (nv && nv.length ? structuredClone(nv) : []).map((b, idx) => ({
    id: b.id ?? (uid++),
    code: b.code ?? nextCode(idx + 1),
    machineGroup: b.machineGroup || '',
    machine: b.machine || '',
    table: b.table || [],
  }))
  nextTick(() => {
    localBlocks.value.forEach((_, i) => initEditorAt(i))
    computeDuplicates()
  })
}, { immediate: true, deep: true })

onBeforeUnmount(() => editors.value.forEach(ed => ed?.destroy()))
</script>

<style scoped>
.blk-wrap{padding:12px}
.btn{padding:6px 12px;border:none;border-radius:6px;color:#fff;background:#007bff;cursor:pointer}
.btn.add { margin: 10px; background-color: #1666C0; padding: 8px 12px; border-radius: 5px; font-size: 14px; cursor: pointer;}
.btn.info{background:#17a2b8}
.btn.danger{background:#dc3545}
.btn.ghost{margin-right: 8px;background:#f0f8ff;border:1px solid #007bff;color:#007bff}
.blk{border:2px solid #ddd;border-radius:8px;padding:12px;margin-bottom:14px;background:#fafafa}
.blk-hd{display:flex;gap:12px;align-items:center;justify-content:space-between;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:10px}
.ops{display:flex;gap:8px}
.menu{display:flex;justify-content:space-between;align-items:center;padding:8px;border:1px solid #eee;border-radius:6px;background:#fff;margin:8px 0}
.ed{background:#fff;border:1px solid #ddd;border-radius:6px;margin-bottom:10px}
.ed :deep(.ProseMirror){padding:8px;min-height:120px;outline:none}
.ed :deep(table){border-collapse:collapse;width:100%;table-layout:fixed}
.ed :deep(th),.ed :deep(td){border:1px solid #ddd;padding:8px;text-align:center;vertical-align:middle;min-width:72px;position:relative}
.ed :deep(th){background:#f8f9fa;font-weight:700}
.dup-hint{color:#c00;margin-top:6px}
</style>
