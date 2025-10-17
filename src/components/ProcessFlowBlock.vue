<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
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

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ mode: 'table', cols: 9, header_json: null, items: [], file: null })
  },
  cols: { type: Number, default: 9 },
  token: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

/* -------- robust v-model guard -------- */
const clone = v => { try { return JSON.parse(JSON.stringify(v)) } catch { return v } }
const m = ref(clone(props.modelValue))
if (!Array.isArray(m.value.items)) m.value.items = []
let gate = false
let last = JSON.stringify(m.value)

watch(() => props.modelValue, v => {
  gate = true
  const c = clone(v); if (!Array.isArray(c.items)) c.items = []
  m.value = c
  gate = false
}, { deep: true })

watch(m, v => {
  if (gate) return
  const s = JSON.stringify(v)
  if (s !== last) { last = s; emit('update:modelValue', clone(v)) }
}, { deep: true })

/* -------- editors -------- */
const headerEditor = ref(null)
onMounted(() => {
  headerEditor.value = new Editor({
    extensions: [
      Document.extend({ content: 'paragraph' }),
      Paragraph, Text, TextStyle, History,
      Color.configure({ types: ['textStyle'] }),
      Placeholder.configure({ placeholder: '請輸入標題' }),
    ],
    content: m.value.header_json || { type: 'doc', content: [{ type: 'paragraph' }] },
    onFocus: () => activeTarget.value = 'header',
    onUpdate: ({ editor }) => { m.value.header_json = editor.getJSON() }
  })
})
onBeforeUnmount(() => headerEditor.value?.destroy())

/* helpers (define BEFORE makeTableDoc) */
function tr(cells){ return { type:'tableRow', content: cells } }
function th(text){ return { type:'tableHeader', content:[{ type:'paragraph', content: text ? [{type:'text', text}] : [] }] } }
function td(text){ return { type:'tableCell', content:[{ type:'paragraph', content: text ? [{type:'text', text:String(text)}] : [] }] } }
function makeTableDoc(items=[], cols=9){
  const total = Math.max(cols, Math.ceil(Math.max(1, items.length)/cols)*cols)
  const arr = Array.from({length: total}, (_, i) => items[i] ?? '')
  const rows=[]
  for(let i=0;i<total;i+=cols){
    const chunk=arr.slice(i,i+cols)
    rows.push(tr([th('步驟'), ...chunk.map((_,j)=> th(String(i+j+1)))]))
    rows.push(tr([td('流程'), ...chunk.map(txt=> td(txt))]))
  }
  return { type:'doc', content:[{ type:'table', content:rows }] }
}

const tableEditor = ref(null)
const tableDoc = computed(() => makeTableDoc(m.value.items, props.cols))

onMounted(() => {
  // NOTE: editable=true so the user can create a selection; we’ll block text editing.
  tableEditor.value = new Editor({
    extensions: [
      Document, Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] }),
      Table.configure({}), TableRow, TableHeader, TableCell, History
    ],
    editable: true,
    content: tableDoc.value,
    onFocus: () => activeTarget.value = 'table',
    editorProps: {
      handleDOMEvents: {
        keydown: (view, evt) => {
          // Block edits. Allow navigation & selection (arrows/home/end/pageup/down) and shortcuts like Ctrl/Cmd+C.
          const k = evt.key
          const allowNav = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(k)
          const allowMetaOnly = (evt.ctrlKey || evt.metaKey) && !evt.shiftKey && !evt.altKey
          if (allowNav || allowMetaOnly) return false // let it pass
          evt.preventDefault()
          return true
        },
        paste: (view, evt) => { evt.preventDefault(); return true } // block paste
      }
    }
  })
})
watch(tableDoc, doc => tableEditor.value?.commands.setContent(doc, false))
onBeforeUnmount(() => tableEditor.value?.destroy())

/* -------- color: apply to selection, or to whole current cell if caret-only -------- */
const activeTarget = ref('header')

function applyColor(color) {
  if (activeTarget.value === 'header') {
    headerEditor.value?.chain().focus().setColor(color || '#000').run()
    return
  }
  const ed = tableEditor.value
  if (!ed) return
  ed.chain().focus()
  const sel = ed.state.selection
  // If selection is empty, expand to the whole current cell's text content
  if (sel.empty) {
    const $pos = sel.$from
    let found = null
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d)
      if (node?.type?.name === 'tableCell' || node?.type?.name === 'tableHeader') {
        const cellPos = $pos.before(d)      // position of the cell node
        const cellSize = node.nodeSize
        const from = cellPos + 1
        const to = cellPos + cellSize - 1
        ed.commands.setTextSelection({ from, to })
        found = true
        break
      }
    }
    if (!found) {
      // fallback: apply to entire table (rare)
      ed.commands.selectAll()
    }
  }
  ed.chain().setColor(color || '#000').run()
}

/* -------- items & upload (unchanged) -------- */
const draftItem = ref('')
const addItem = () => {
  const v = (draftItem.value || '').trim()
  if (!v) return
  m.value.items.push(v)
  draftItem.value = ''
}
const popItem = () => { m.value.items.pop() }

const fileInput = ref(null)
const uploading = ref(false)
const pickFile = () => fileInput.value?.click()
const fullUrl = (u)=> (u?.startsWith('http') ? u : `${API_BASE_URL}${u}`)

async function handleFile(ev){
  const f = ev.target.files?.[0]; ev.target.value=''
  if(!f) return
  uploading.value = true
  try{
    const ext = (f.name.split('.').pop()||'').toLowerCase()
    const url = `${API_BASE_URL}/api/upload/image?token=${props.token}`
    if(ext==='drawio'){
      const fd = new FormData(); fd.append('drawioFile', f)
      const res = await axios.post(`${API_BASE_URL}/drawioToPng`, fd, { responseType:'arraybuffer', headers:{'Content-Type':'multipart/form-data'} })
      const blob = new Blob([res.data], {type:'image/png'})
      const png = new File([blob], `flow_${Date.now()}.png`, {type:'image/png'})
      const up = new FormData(); up.append('file', png)
      const r = await axios.post(url, up)
      if(!r.data?.success) throw new Error(r.data?.message||'upload failed')
      m.value.file = { asset_id: r.data.asset_id, url: r.data.url, path: r.data.path_to_save }
    }else{
      const up = new FormData(); up.append('file', f)
      const r = await axios.post(url, up)
      if(!r.data?.success) throw new Error(r.data?.message||'upload failed')
      m.value.file = { asset_id: r.data.asset_id, url: r.data.url, path: r.data.path_to_save }
    }
  }catch(e){ console.error(e); alert('上傳失敗') }
  finally{ uploading.value=false }
}

const setMode = (mode)=> { m.value.mode = mode }
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
        <div class="font-color red"   @click="applyColor('red')"></div>
        <div class="font-color blue"  @click="applyColor('blue')"></div>
        <div class="font-color black" @click="applyColor(null)"></div>
      </div>
    </div>

    <!-- one row: title editor + input + +/- (same height) -->
    <div class="pfb-input-row" @mousedown="activeTarget='header'">
      <label>2.1</label>
      <EditorContent :editor="headerEditor" class="title-editor-content" />
      <input v-if="m.mode==='table'" class="process-input" v-model="draftItem" placeholder="輸入流程（Enter 新增）" @keyup.enter="addItem" @focus="activeTarget='header'"/>
      <button v-if="m.mode==='table'" class="action-btn add-btn" @click="addItem">+</button>
      <button v-if="m.mode==='table'" class="action-btn remove-btn" @click="popItem" :disabled="!m.items.length">-</button>
    </div>

    <!-- readonly-like table (editable just for selecting) -->
    <div v-if="m.mode==='table'" class="process-table-wrapper">
      <div class="pf-table-focusable" tabindex="0" @mousedown="activeTarget='table'" @focus="activeTarget='table'">
        <EditorContent :editor="tableEditor" class="pf-editor" />
      </div>
    </div>

    <!-- upload preview -->
    <div v-else-if="m.mode==='image'" class="upload-body">
      <div v-if="m.file" class="preview"><img :src="fullUrl(m.file?.url)" alt="flow" /></div>
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
.spacer{ flex:1 }

/* ONE ROW: title + input + +/- — SAME HEIGHT */
.pfb-input-row{ display:flex; align-items:center; gap:10px; }
.title-editor-content :deep(.ProseMirror){
  min-height: 36px; height: 36px; /* same as input */
  display:flex; align-items:center;
  padding: 0 10px; border:1px solid #ddd; border-radius:4px;
  min-width: 12rem; max-width: 28rem;
  box-sizing: border-box;
}
.title-editor-content :deep(.ProseMirror p.is-editor-empty::before) {
  content: attr(data-placeholder);
  pointer-events: none;
  height: 0;
  float: left;
  color: #adb5bd;
}
.process-input{
  height: 36px; line-height: 36px;
  flex:1; min-width:160px;
  padding: 0 12px; border:1px solid #ccc; border-radius:4px;
  box-sizing: border-box;
}
.action-btn{ width:30px; height:30px; border:none; border-radius:50%; color:#fff; cursor:pointer; }
.add-btn{ background:#28a745; }
.remove-btn{ background:#dc3545; }

/* palette */
.menu.color{ display:flex; align-items:center; gap:6px; }
.font-color{ width:18px; height:18px; border-radius:50%; border:1px solid #ccc; cursor:pointer; }
.font-color.red{background:red}
.font-color.blue{background:blue}
.font-color.black{background:black}

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
