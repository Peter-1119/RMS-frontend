<!--
  TEMP — P1 遞迴區塊編輯器 dev harness（驗證用，prod 前移除）
  路由：/dev/block-tree
  目的：在沒有後端的情況下，實跑 DynamicEditorTree / DynamicEditorNode，
        驗證遞迴新增子層、編號（2.1 → 2.1.1 → (1) → (A) → (i)）、L8 擋子層、
        刪子樹、表格/圖片、套色、驗證訊息、存檔 payload 形狀。
-->
<template>
  <div class="harness">
    <header class="bar">
      <h2>P1 Harness — 遞迴區塊編輯器</h2>
      <span class="tag">TEMP / 驗證用</span>
    </header>

    <div class="controls">
      <label>L1 章節號：<input type="number" v-model.number="chapter" min="1" style="width:60px" /></label>
      <label><input type="checkbox" v-model="documentMode" /> documentMode（顯示「插入文件」ct=3）</label>
      <label><input type="checkbox" v-model="allowColor" /> allowColor（顯示套色）</label>
      <button @click="reset">重置樹</button>
      <button @click="showPayload = !showPayload">{{ showPayload ? '隱藏' : '查看' }} 存檔 payload</button>
      <span class="hint">章節對照試查：式樣書 other(7) → {{ chapterNumber(1, 7) }}　指示書 st0 → {{ chapterNumber(0, 0) }}</span>
    </div>

    <div class="layout">
      <main class="tree-area">
        <DynamicEditorTree
          :nodes="nodes"
          :chapter="chapter"
          :allow-color="allowColor"
          :document-mode="documentMode"
          @invalid-check="onInvalid"
          @open-doc-search="onDocSearch"
        />
      </main>

      <aside class="side">
        <section class="panel">
          <h3>驗證狀態 <span :class="['dot', validation.isValid ? 'ok' : 'bad']"></span></h3>
          <p v-if="validation.isValid" class="ok-text">全部通過 ✅</p>
          <ul v-else class="msg-list">
            <li v-for="(m, i) in validation.message" :key="i">{{ m }}</li>
          </ul>
        </section>

        <section class="panel" v-if="lastDocSearch">
          <h3>open-doc-search 事件</h3>
          <p class="hint">最後觸發的節點 client_id：</p>
          <code>{{ lastDocSearch }}</code>
        </section>

        <section class="panel" v-if="showPayload">
          <h3>toPayloadTree(nodes)</h3>
          <pre class="payload">{{ payloadJson }}</pre>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import DynamicEditorTree from '@/components/DynamicEditorTree.vue';
import { makeNode, toPayloadTree } from '@/utils/blockTree.js';
import { chapterNumber } from '@/utils/blockNumbering.js';

const chapter = ref(2);
const documentMode = ref(false);
const allowColor = ref(true);
const showPayload = ref(false);
const validation = ref({ isValid: true, message: [] });
const lastDocSearch = ref('');

// 種子樹：2.1 → 2.1.1 → (1)，以及 2.2，方便一眼看出多層編號
function seed() {
  const l4 = makeNode(0);
  const l3 = makeNode(0); l3.children = [l4];
  const l2a = makeNode(0); l2a.children = [l3];
  const l2b = makeNode(1);
  return [l2a, l2b];
}

const nodes = reactive(seed());

function reset() {
  nodes.splice(0, nodes.length, ...seed());
}
function onInvalid(v) { validation.value = v; }
function onDocSearch(payload) { lastDocSearch.value = payload?.node?.client_id || '(unknown)'; }

const payloadJson = computed(() => JSON.stringify(toPayloadTree(nodes), null, 2));
</script>

<style scoped>
.harness { padding: 16px; font-family: "Microsoft JhengHei", sans-serif; }
.bar { display: flex; align-items: center; gap: 12px; }
.bar h2 { margin: 0; color: #023b64; }
.tag { background: #e15241; color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 4px; }

.controls { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin: 14px 0; padding: 10px; background: #f4f9ff; border: 1px solid #d6e6f5; border-radius: 8px; font-size: 14px; }
.controls button { padding: 6px 12px; border: none; border-radius: 5px; background: #61a5d6; color: #fff; cursor: pointer; }
.controls .hint { color: #888; font-size: 12px; }

.layout { display: flex; gap: 16px; align-items: flex-start; }
.tree-area { flex: 1; min-width: 0; }
.side { width: 360px; flex-shrink: 0; }
.panel { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #fff; }
.panel h3 { margin: 0 0 8px; font-size: 15px; color: #023b64; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
.dot.ok { background: #27ae60; }
.dot.bad { background: #e15241; }
.ok-text { color: #27ae60; margin: 0; }
.msg-list { margin: 0; padding-left: 18px; color: #c0392b; font-size: 13px; }
.payload { max-height: 420px; overflow: auto; background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 6px; font-size: 12px; }
code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
</style>
