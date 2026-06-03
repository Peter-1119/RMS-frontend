<template>
  <div class="editor-tree">
    <button v-if="showAdd" class="tree-add" @click="addRoot">＋ 新增區塊</button>

    <div v-if="!nodes.length && showAdd" class="empty-state">
      此章節尚無內容，點上方按鈕新增第一個區塊。
    </div>

    <DynamicEditorNode
      v-for="(node, i) in nodes"
      :key="node.client_id"
      :node="node"
      :chapter="chapter"
      :depth="ROOT_DEPTH"
      :path-indices="[indexOffset + i + 1]"
      :siblings="nodes"
      :index="i"
      :allow-color="allowColor"
      :document-mode="documentMode"
      @open-doc-search="$emit('open-doc-search', $event)"
      @changed="onChanged"
    />

  </div>
</template>

<script setup>
import { provide, reactive, watch, onMounted, onBeforeUnmount } from 'vue';
import DynamicEditorNode from '@/components/DynamicEditorNode.vue';
import { makeNode, ensureTree, validateTree, ROOT_DEPTH } from '@/utils/blockTree.js';

const props = defineProps({
  nodes: { type: Array, required: true },        // 某 step 的 L2 forest（parent 擁有、by-ref 修改）
  chapter: { type: Number, required: true },     // L1 章節號
  allowColor: { type: Boolean, default: true },
  documentMode: { type: Boolean, default: false },
  indexOffset: { type: Number, default: 0 },     // 頂層編號起始偏移（管理條件 3.1 為特製塊時設 1，通用樹從 3.2 起）
  showAdd: { type: Boolean, default: true },      // 是否顯示內建「新增區塊」鈕；管理條件由父層於 3.1 上方提供，設 false
});
const emit = defineEmits(['open-doc-search', 'invalid-check']);

// ---------- 提供給子節點：焦點編輯器追蹤 + 套色 ----------
const ctx = reactive({ active: null });
provide('blockEditorCtx', {
  setActive: (ed) => { ctx.active = ed; },
  applyColor: (color) => ctx.active?.chain().focus().setColor(color || '#000').run(),
});

// ---------- 彙總驗證（debounce） ----------
let timer = null;
function runValidation() {
  emit('invalid-check', validateTree(props.nodes, props.chapter, props.indexOffset));
}
function onChanged() {
  clearTimeout(timer);
  timer = setTimeout(runValidation, 500);
}

function addRoot() {
  props.nodes.push(makeNode());
  onChanged();
}

// 載入後 forest 被 splice 進來（length 0→N），重跑驗證
watch(() => props.nodes.length, () => { ensureTree(props.nodes); onChanged(); });

onMounted(() => {
  ensureTree(props.nodes);
  runValidation();
});
onBeforeUnmount(() => clearTimeout(timer));

defineExpose({ runValidation, addRoot });
</script>

<style scoped>
.editor-tree { display: flex; flex-direction: column; }
.empty-state { padding: 24px; text-align: center; color: #999; border: 1px dashed #ddd; border-radius: 8px; margin-bottom: 12px; }
.tree-add { align-self: flex-start; margin-bottom: 12px; padding: 8px 12px; border: none; border-radius: 5px; background-color: #1666C0; color: #fff; font-size: 14px; cursor: pointer; }
.tree-add:hover { background-color: #1257a3; }
</style>
