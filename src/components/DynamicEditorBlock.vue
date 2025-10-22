<template>
    <div class="block-container">
        <div v-for="(blockItem, blockIndex) in localBlockContents.data" :key="blockIndex" class="block-item-wrapper" :class="{'child-block-container': blockIndex > 0}">
            <div class="block-header">
                <label>{{ step }}.{{ tier }}{{ blockIndex > 0 ? '.' + blockIndex : '' }}</label>
                
                <template v-if="blockIndex === 0">
                    <EditorContent :editor="titleEditor" class="title-editor-content" />
                </template>
                <template v-else>
                    <input type="text" placeholder="輸入標題" v-model="blockItem.jsonHeader" class="process-title-input">
                </template>

                <div class="menu color">
                    <div class="font-color red" @click="setGenericColor('red')"></div>
                    <div class="font-color blue" @click="setGenericColor('blue')"></div>
                    <div class="font-color black" @click="setGenericColor(null)"></div>
                </div>

                <div :class="`menu content-type-option-${step}-${tier}-${blockIndex}`">
                    <label><input type="radio" v-model="blockItem.option" :value=0 @change="radioInputChange(blockIndex)">無</label>
                    <label><input type="radio" v-model="blockItem.option" :value=1 @change="radioInputChange(blockIndex)">文字框 or 圖</label>
                    <label><input type="radio" v-model="blockItem.option" :value=2 @change="radioInputChange(blockIndex)">表格</label>
                </div>

                <div class="action-buttons">
                    <button v-if="blockIndex === 0" @click="addSmallBlock">新增下一層</button>
                    <button v-else @click="removeSmallBlock(blockIndex)">刪除</button>
                    <button v-if="blockIndex === 0" @click="emitDelete">刪除</button>
                </div>
            </div>

            <div class="editor-body">
                <div class="menu-bar" v-if="blockItem.option !== 0">
                    <template v-if="blockItem.option === 2">
                        <button @click="addRow(blockIndex)" class="menu-btn" title="表格：新增列">新增列</button>
                        <button @click="addColumn(blockIndex)" class="menu-btn" title="表格：新增行">新增行</button>
                        <button @click="mergeCells(blockIndex)" class="menu-btn" :disabled="!canMergeOrSplit(blockIndex)" title="表格：合併儲存格">合併儲存格</button>
                        <button @click="unmergeCells(blockIndex)" class="menu-btn" :disabled="!canMergeOrSplit(blockIndex)" title="表格：解除合併">取消合併</button>
                        <span style="border-right: 1px solid #ccc; margin: 0 5px;"></span>
                    </template>
                    <input type="file" :ref="el => fileInputRefs[blockIndex] = el" @change="handleImageUpload($event, blockIndex)" accept="image/*" style="display: none;">
                    <button @click="triggerFileInput(blockIndex)" class="menu-btn" title="插入圖片">插入圖片</button>
                </div>
                
                <EditorContent v-if="blockItem.option !== 0" :editor="editors[blockIndex]" class="editor-content" />
                <div v-if="blockItem.option == 1 && blockItem.files.length > 0" class="files-block">
                    <ul class="preview-grid">
                        <li v-for="(fileItem, index) in blockItem.files" :key="index" class="preview-item">
                            <img :src="imgUrl(fileItem.path_to_save)" alt="圖片預覽" class="preview-thumbnail">
                            <button @click="removeFile(blockIndex, index)" class="remove-btn">X</button>
                            <div class="file-info">
                                <span>{{ fileItem.name }}</span> 
                                <span>({{ (fileItem.size / 1024 / 1024).toFixed(2) }} MB)</span>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { v1 as uuidv1 } from 'uuid'
import { EditorContent, Editor } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Image } from '@tiptap/extension-image'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL
const STATIC_BASE_URL = import.meta.env.VITE_APP_STATIC_BASE_URL || ''

// ---------- props / emits ----------
const props = defineProps({
  blockEditors: { type: Object, required: true }, // { step, tier, data:[{option, header, jsonContent, files:[]}, ...] }
})
const emit = defineEmits(['update-block', 'delete-block'])

// ---------- state ----------
const step = ref(props.blockEditors.step)
const tier = ref(props.blockEditors.tier)
const localBlockContents = reactive({ ...props.blockEditors }) // shallow copy is enough since we replace fields

const titleEditor = ref(null)
const editors = reactive({})         // { [idx]: Editor }
const activeEditor = ref(null)
const fileInputRefs = ref([])        // array-style refs per block index

// ---------- tiptap extension presets ----------
const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })]
const titleExt = [Document.extend({ content: 'paragraph' }), ...baseExt, Placeholder.configure({ placeholder: '請輸入標題' })]
const textExt  = [Document, ...baseExt, Placeholder.configure({ placeholder: '請輸入文字內容' }), Image.configure({ inline: true, allowBase64: true })]
const tableExt = [Document.extend({ content: 'table' }), ...baseExt, Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Image.configure({ inline: true, allowBase64: true })]

// ---------- helpers ----------
const deepClone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))
const imgUrl = p => (p ? `${STATIC_BASE_URL}/uploads/${p}` : '')

const initialDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] })
const initialTableDoc = (rows = 3, cols = 4) => ({
  type: 'doc',
  content: [{
    type: 'table',
    content: Array.from({ length: rows }, (_, r) => ({
      type: 'tableRow',
      content: Array.from({ length: cols }, () => ({
        type: r === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph' }],
      })),
    })),
  }],
})

const setActiveEditor = ed => (activeEditor.value = ed)
const setGenericColor = color => activeEditor.value?.chain().focus().setColor(color || '#000').run()

// safe can()-checks for table actions
const canMergeOrSplit = idx => {
  const ed = editors[idx]
  if (!ed) return false
  try { return ed.can().mergeCells() || ed.can().splitCell() } catch { return false }
}

// ---------- editor init / lifecycle ----------
const initTitleEditor = () => {
  titleEditor.value = new Editor({
    content: localBlockContents.data[0].jsonHeader || initialDoc(),
    extensions: titleExt,
    editorProps: { attributes: { class: 'title-editor-content' } },
    onFocus: ({ editor }) => setActiveEditor(editor),
    onUpdate: ({ editor }) => { localBlockContents.data[0].jsonHeader = editor.getJSON() },
  })
}

const initBlockEditor = (idx, option) => {
  // destroy old
  editors[idx]?.destroy()
  delete editors[idx]

  if (option === 0) return

  const ext = option === 1 ? textExt : tableExt
  const defaultContent = option === 1 ? initialDoc() : initialTableDoc()
  const content = localBlockContents.data[idx].jsonContent || defaultContent

  const ed = new Editor({
    content: deepClone(content),
    extensions: ext,
    editorProps: { attributes: { class: 'editor-content' } },
    onFocus: ({ editor }) => setActiveEditor(editor),
    onUpdate: ({ editor }) => { localBlockContents.data[idx].jsonContent = editor.getJSON() },
  })
  editors[idx] = ed

  // seed jsonContent once
  if (!localBlockContents.data[idx].jsonContent) {
    localBlockContents.data[idx].jsonContent = ed.getJSON()
  }
}

onMounted(() => {
  initTitleEditor()
  // lazy init only for active options
  nextTick(() => {
    localBlockContents.data.forEach((blk, i) => blk.option !== 0 && initBlockEditor(i, blk.option))
  })
})

onBeforeUnmount(() => {
  emit('update-block', localBlockContents)
  titleEditor.value?.destroy()
  Object.values(editors).forEach(e => e.destroy())
})

// ---------- watchers / emit ----------
watch(() => props.blockEditors.tier, t => {
  tier.value = t
  localBlockContents.tier = t
})

// ---------- UI handlers ----------
const addSmallBlock = () => {
  localBlockContents.data.push({ content_id: null, client_temp_id: `temp-${uuidv1()}`, option: 0, jsonHeader: null, jsonContent: null, files: [] })
}
const removeSmallBlock = (idx) => {
  if (!confirm('確定要刪除此子區塊?')) return
  editors[idx]?.destroy()
  delete editors[idx]
  localBlockContents.data.splice(idx, 1)
}

const radioInputChange = (idx) => {
  const opt = localBlockContents.data[idx].option
  localBlockContents.data[idx].jsonContent = null
  if (opt !== 1) localBlockContents.data[idx].files = []
  nextTick(() => initBlockEditor(idx, opt))
}

const emitDelete = () => {
  if (!confirm('確定要刪除此區塊?')) return
  emit('delete-block', localBlockContents.id)
}

const addRow = idx => editors[idx]?.chain().focus().addRowAfter().run()
const addColumn = idx => editors[idx]?.chain().focus().addColumnAfter().run()
const mergeCells = idx => editors[idx]?.chain().focus().mergeCells().run()
const unmergeCells = idx => editors[idx]?.chain().focus().splitCell().run()

const triggerFileInput = idx => {
  const el = fileInputRefs.value[idx]
  if (Array.isArray(el) ? el[0] : el) (Array.isArray(el) ? el[0] : el).click()
}

const removeFile = (idx, picIdx) => localBlockContents.data[idx].files.splice(picIdx, 1)

const handleImageUpload = async (evt, idx) => {
  const file = evt.target.files?.[0]
  const ed = editors[idx]
  if (!file) return
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_BASE_URL}/uploads/image`, { method: 'POST', body: fd })
    const result = await res.json()
    if (!result.success) throw new Error(result.message || 'upload failed')

    if (localBlockContents.data[idx].option === 1) {
      localBlockContents.data[idx].files.push({ name: file.name, size: file.size, path_to_save: result.path_to_save })
    } else if (ed) {
      ed.chain().focus().setImage({ src: API_BASE_URL + result.url }).run()
    }
  } catch (e) {
    console.error('上傳錯誤:', e)
    alert('圖片上傳失敗')
  } finally {
    evt.target.value = ''
  }
}
</script>


<style scoped>
/* 將您原本的樣式保持不變，並新增以下 wrapper 樣式 */
.block-item-wrapper { padding: 15px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9; }
.child-block-container { margin-left: 20px;  border: 1px dashed #aaa;  background-color: #fff; padding: 10px; margin-top: 15px; }
.block-header { display: flex; align-items: center; gap: 15px;  margin-bottom: 15px; }

/* 確保標題輸入框在子區塊中正確顯示 */
.process-title-input { flex-grow: 1;  padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 1em; }

/* 標籤樣式 */
.block-header label { font-weight: bold; font-size: 1.2em; color: #333; flex-shrink: 0; }

/* 確保標題編輯器可以正確 flex 伸展 */
.title-editor-content { flex-grow: 1;  background-color: #fff;  padding: 0px;  border: 1px solid #ddd;  border-radius: 4px;  }
.title-editor-content :deep(.ProseMirror) { padding: 10px; outline: none; }
.title-editor-content :deep(.ProseMirror p) { margin: 0px; font-size: 1em; }


/* 動作按鈕樣式 */
.action-buttons { display: flex; gap: 10px; flex-shrink: 0; }
.action-buttons button {
padding: 8px 12px;
border: none;
border-radius: 4px;
cursor: pointer;
background-color: #007bff;
color: white;
font-size: 0.9em;
transition: background-color 0.2s ease;
}
.action-buttons button:hover { background-color: #0056b3; }


/* 顏色選單樣式 */
.menu.color { display: flex; align-items: center; margin: 0px 12px; flex-shrink: 0; }
.font-color { width: 20px; height: 20px; border-radius: 50%; margin: 0px 4px; cursor: pointer; border: 1px solid #ccc; }
.font-color.red { background-color: red; }
.font-color.blue { background-color: blue; }
.font-color.black { background-color: black; }


/* Radio 選項樣式 */
.menu[class^="content-type-option"] { display: flex; gap: 10px; flex-shrink: 0; }


/* 編輯器主體樣式 */
.editor-body { background-color: #f0f0f0; border: 1px solid #eee; padding: 10px; border-radius: 4px; }
.editor-content { border: 1px solid #ddd;  padding: 0px;  min-height: 80px;  line-height: 1.5;  background-color: white; }
.editor-content :deep(.ProseMirror) { padding: 10px; outline: none; line-height: 1.5; }
.editor-content :deep(p) { margin: 0px; }


/* TipTap Table 樣式 */
.editor-content :deep(table) { border-collapse: collapse; width: 100%; margin: 10px 0px; table-layout: fixed; }
.editor-content :deep(th), .editor-content :deep(td) { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
.editor-content :deep(img) { max-width: 100%; height: auto; display: block; margin: 5px auto; cursor: pointer; border: 2px solid transparent; }
.editor-content :deep(img) { max-width: 100%; height: auto; display: block; margin: 5px 0; cursor: pointer; border: 2px solid transparent; }


/* TipTap Placeholder & Selection 樣式 (沿用您原本的樣式) */
.editor-content :deep(.ProseMirror) p.is-editor-empty::before { content: attr(data-placeholder); float: left; color: #adb5bd; height: 0; }
.editor-content :deep(td.selectedCell),
.editor-content :deep(th.selectedCell) { border: 2px solid #ccc; background-color: #cce7ff; box-shadow: 0 0 0 3px #4a90e2 inset; border-color: transparent; opacity: 1; }


/* 工具列樣式 */
.menu-bar { margin-bottom: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; background-color: #f0f8ff; }
.menu-btn { padding: 5px 10px; border: 1px solid #007bff; background-color: white; color: #007bff; cursor: pointer; border-radius: 3px; }
.menu-btn:hover:not(:disabled) { background-color: #007bff; color: white; }
.menu-btn:disabled { cursor: not-allowed; opacity: 0.5; }

.image-block{ display: flex; justify-content: center; width: 100%; height: auto; gap: 10px; }
.preview-grid {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* 自動填充，最小100px寬 */
    gap: 15px; /* 項目間距 */
    max-height: 250px; /* 設定最大高度並允許滾動 */
    overflow-y: auto;
    border: 1px solid #f0f0f0;
    border-radius: 5px;
    background-color: #fff;
    padding: 10px;
}

.preview-item {
    position: relative;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    padding: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    align-items: center;
    text-align: center;
}

.preview-thumbnail {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 5px;
}

.remove-btn {
    position: absolute;
    top: 0px;
    right: 0px;
    background-color: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    transition: background-color 0.3s ease, transform 0.2s ease;
}

.remove-btn:hover { background-color: #c82333; transform: scale(1.1); }
</style>