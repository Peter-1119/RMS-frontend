<template>
  <div ref="rootEl" class="inline-color-editor" :class="{ disabled }">
    <!-- 藍/黑色標記：用 mousedown.prevent 才不會在點按鈕時讓編輯器失去選取範圍 -->
    <div class="color-toolbar">
      <i class="dot blue"  title="標記為本版變更"
         @mousedown.prevent="applyColor('blue')"></i>
      <i class="dot black" title="移除標記"
         @mousedown.prevent="clearColor()"></i>
    </div>

    <div class="editor-row">
      <EditorContent :editor="editor" :class="['ed', { single: singleLine, 'lock-input': lockInput }]" />

      <!-- 只有 parent 有傳 options 時才出現下拉，且只能由這顆 icon 觸發（點編輯區本身不會開） -->
      <div v-if="normalizedOptions.length" class="dropdown-wrap">
        <button type="button" class="dropdown-toggle" :disabled="disabled"
                title="選擇選項" @click.stop="toggleMenu">▾</button>
        <ul v-if="menuOpen" class="dropdown-menu">
          <li v-for="(opt, i) in normalizedOptions" :key="i"
              class="dropdown-item" @click="selectOption(opt)">{{ opt.label }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, shallowRef, ref, computed } from 'vue'
import { EditorContent, Editor } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { History } from '@tiptap/extension-history'

const props = defineProps({
  jsonValue:     { type: Object,  default: null },        // rms_document_form 撈到的 tiptap JSON（v-model）
  plainFallback: { type: String,  default: '' },          // 主表純文字，沒有 JSON 時當初始內容（相容舊文件）
  singleLine:    { type: Boolean, default: false },
  options:       { type: Array,   default: () => [] },     // 有給才會出現下拉；可是字串陣列或 {value,label}/{id,projectName}
  disabled:      { type: Boolean, default: false },
  lockInput:     { type: Boolean, default: false },        // 鎖打字：只能下拉賦值＋改顏色，不能手動輸入文字
})
const emit = defineEmits(['update:jsonValue', 'update:text', 'select'])

const SingleLineDoc = Document.extend({ content: 'paragraph' })
const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] }), History]

const editor   = shallowRef(null)
const rootEl   = ref(null)
const menuOpen = ref(false)

// 把 options 正規化成 { value, label }，相容 projectList 的 { id, projectName }
const normalizedOptions = computed(() => (props.options || []).map(o => {
  if (o == null) return { value: '', label: '' }
  if (typeof o === 'string' || typeof o === 'number') return { value: String(o), label: String(o) }
  const label = o.label ?? o.projectName ?? o.name ?? String(o.value ?? '')
  const value = o.value ?? o.projectName ?? o.name ?? label
  return { value, label }
}))

// 初始內容：優先吃已存的 tiptap JSON；舊文件沒有樣式時退回純文字（TipTap 會自動包成 paragraph）
const getInitContent = () => {
  if (props.jsonValue && typeof props.jsonValue === 'object' && Object.keys(props.jsonValue).length) return props.jsonValue
  return props.plainFallback || ''
}

// 外部資料（applyLoadedData / 舊文件純文字）非同步載入後，把內容同步進編輯器
let applyingExternal = false
const syncFromProps = () => {
  const ed = editor.value
  if (!ed || ed.isFocused) return   // 使用者正在輸入時不覆蓋
  applyingExternal = true
  ed.commands.setContent(getInitContent(), false)   // false = 不觸發 onUpdate，避免回圈
  applyingExternal = false
}

const applyColor = (color) => { if (!props.disabled) editor.value?.chain().focus().setColor(color).run() }
const clearColor = ()      => { if (!props.disabled) editor.value?.chain().focus().unsetColor().run() }

const toggleMenu = () => { if (!props.disabled) menuOpen.value = !menuOpen.value }
const selectOption = (opt) => {
  menuOpen.value = false
  if (props.disabled) return
  editor.value?.commands.setContent(opt.value, true)   // true = 觸發 onUpdate，帶出 text/json
  emit('select', opt.value, opt)
}

const onDocClick = (e) => {
  if (menuOpen.value && rootEl.value && !rootEl.value.contains(e.target)) menuOpen.value = false
}

// lockInput 時放行的按鍵：方向／選取／複製／全選，其餘一律擋掉（不讓使用者改動文字）
const SELECTION_KEYS = new Set([
  'ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown',
  'Shift','Control','Alt','Meta','Tab','Escape',
])
const isSelectionKey = (e) => {
  if (SELECTION_KEYS.has(e.key)) return true
  if ((e.ctrlKey || e.metaKey) && ['a', 'c'].includes((e.key || '').toLowerCase())) return true // 全選/複製
  return false
}

onMounted(() => {
  editor.value = new Editor({
    content: getInitContent(),
    editable: !props.disabled,
    extensions: [props.singleLine ? SingleLineDoc : Document, ...baseExt],
    editorProps: {
      // 鎖打字但保留選取＋程式化上色（setColor 走 command，不經這些 handler）
      handleKeyDown:   (view, event) => props.lockInput && !isSelectionKey(event), // return true = 攔截
      handleTextInput: () => props.lockInput,                                      // 擋一般輸入與 IME
      handlePaste:     () => props.lockInput,                                      // 擋貼上
      handleDrop:      () => props.lockInput,                                      // 擋拖放
    },
    onUpdate: ({ editor }) => {
      if (applyingExternal) return
      emit('update:jsonValue', editor.getJSON())
      emit('update:text', editor.getText())
    },
  })
  document.addEventListener('click', onDocClick)
})

watch(() => [props.jsonValue, props.plainFallback], syncFromProps)
watch(() => props.disabled, v => editor.value?.setEditable(!v))

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  editor.value?.destroy()
  editor.value = null
})
</script>

<style scoped>
.inline-color-editor { display: flex; align-items: flex-start; gap: 6px; width: 100%; max-width: 100%; box-sizing: border-box; }
.inline-color-editor.disabled { opacity: 0.7; }

.color-toolbar { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
.dot { width: 14px; height: 14px; border-radius: 50%; cursor: pointer; border: 1px solid #ccc; }
.dot.blue  { background: #1f6feb; }
.dot.black { background: #000; }
.inline-color-editor.disabled .dot { cursor: not-allowed; }

.editor-row { position: relative; display: flex; align-items: stretch; flex: 1; min-width: 0; }
.ed { flex: 1; min-width: 0; max-width: 100%; border: 1px solid #ddd; border-radius: 5px; padding: 6px 8px; min-height: 36px; }
.ed.single { min-height: unset; }
.ed.single :deep(p) { margin: 0; white-space: nowrap; overflow-x: auto; }
.ed :deep(.ProseMirror) { outline: none; white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; }
/* 鎖打字：藏游標但仍可反白選取去上色 */
.ed.lock-input { background: #fafafa; }
.ed.lock-input :deep(.ProseMirror) { caret-color: transparent; }

.dropdown-wrap { position: relative; }
.dropdown-toggle {
  height: 100%; min-width: 30px; margin-left: 4px; padding: 0 8px;
  border: 1px solid #ddd; border-radius: 5px; background: #f5f5f5;
  cursor: pointer; font-size: 12px; color: #555;
}
.dropdown-toggle:hover:not(:disabled) { background: #e9e9e9; }
.dropdown-toggle:disabled { cursor: not-allowed; opacity: 0.5; }

.dropdown-menu {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 50;
  margin: 0; padding: 4px 0; list-style: none; min-width: 180px; max-height: 240px; overflow-y: auto;
  background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.dropdown-item { padding: 8px 12px; cursor: pointer; font-size: 14px; white-space: nowrap; }
.dropdown-item:hover { background: #f0f6ff; }
</style>
