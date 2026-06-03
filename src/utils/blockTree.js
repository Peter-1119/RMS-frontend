// src/utils/blockTree.js
//
// 文件區塊「樹」資料結構工具（對齊 block-hierarchy-redesign-spec.md §6 / §7 / §21）。
// 純函式、無 Vue 相依。節點形狀對齊 §21 欄位定義。
//
// 節點 = 樹上一個 rms_block_content row：
//   {
//     client_id,             // 前端穩定 id（存檔不送 content_id；後端 echo 回填）
//     content_id: null,      // 後端分配，replace 下每存會變
//     content_type,          // 0 無內容 / 1 文字 / 2 表格 / 3 插入文件（唯讀標題）
//     header_json, header_text,
//     content_json, content_text,
//     table_json,  table_text,
//     files: [],             // [{name,size,path_to_save}]（唯一圖片真相，§14）
//     metadata: {},
//     children: [],          // 巢狀（L2..L8）
//   }
// 註：content_type=4（參數表 leaf）不走這支樹工具，由參數表元件處理。

import { v1 as uuidv1 } from 'uuid';
import { formatNodeLabel } from '@/utils/blockNumbering.js';

/** L1 為 step 本身（不存 row）；可編輯節點從 L2 起，最深 L8。 */
export const ROOT_DEPTH = 2;
export const MAX_DEPTH = 8;

/** 建立一個新節點（預設 content_type=0「無內容」）。 */
export function makeNode(content_type = 0) {
  return {
    client_id: uuidv1(),
    content_id: null,
    content_type,
    header_json: null,
    header_text: null,
    content_json: null,
    content_text: null,
    table_json: null,
    table_text: null,
    files: [],
    metadata: {},
    children: [],
  };
}

/** 確保整棵樹每個節點都有 client_id 與 children 陣列（載入後端資料時做一次防呆）。 */
export function ensureTree(nodes) {
  if (!Array.isArray(nodes)) return [];
  nodes.forEach((n) => {
    if (!n.client_id) n.client_id = uuidv1();
    if (!Array.isArray(n.children)) n.children = [];
    if (!Array.isArray(n.files)) n.files = [];
    if (n.metadata == null) n.metadata = {};
    ensureTree(n.children);
  });
  return nodes;
}

/**
 * 深度優先走訪整棵樹，對每個節點回呼 (node, depth, pathIndices)。
 * pathIndices = 由 L2 至本節點的 1-based 兄弟索引，供 blockNumbering 計算編號。
 * @param {Array} nodes 根層（某 step 的 L2 forest）
 */
export function walkWithPaths(nodes, visit, parentPath = [], depth = ROOT_DEPTH, indexOffset = 0) {
  if (!Array.isArray(nodes)) return;
  nodes.forEach((node, i) => {
    // indexOffset 只套在頂層（管理條件 3.1 為特製塊時，通用樹頂層從 indexOffset+1 起算，與顯示一致）
    const idx = (depth === ROOT_DEPTH ? indexOffset : 0) + i + 1;
    const pathIndices = [...parentPath, idx];
    visit(node, depth, pathIndices);
    if (Array.isArray(node.children) && node.children.length) {
      walkWithPaths(node.children, visit, pathIndices, depth + 1, indexOffset);
    }
  });
}

/** 是否還能在此 depth 的節點底下新增子層（受 MAX_DEPTH 限制，§13）。 */
export function canAddChild(depth) {
  return depth < MAX_DEPTH;
}

/** 遞迴判斷一個 ProseMirror 節點是否有實質內容（文字或圖片）。 */
function hasContentInNode(node) {
  if (!node) return false;
  if (node.type === 'text' && node.text && node.text.trim()) return true;
  if (node.type === 'image') return true;
  if (Array.isArray(node.content)) return node.content.some((child) => hasContentInNode(child));
  return false;
}

/**
 * 整棵樹驗證（對齊現役 DynamicEditorBlock_ validationState 規則，改為遞迴）。
 * @param {Array} nodes 根層
 * @param {number} chapter L1 章節號（編號前綴用）
 * @returns {{ isValid: boolean, message: string[] }}
 */
export function validateTree(nodes, chapter, indexOffset = 0) {
  const messages = [];
  walkWithPaths(nodes, (node, depth, pathIndices) => {
    const label = formatNodeLabel(chapter, depth, pathIndices);

    if (!node.header_text || node.header_text.trim() === '') {
      messages.push(`${label} 尚未填寫標題`);
    }

    if (node.content_type === 1) {
      const hasText = node.content_text && node.content_text.trim() !== '';
      const hasFiles = node.files && node.files.length > 0;
      // 內容編輯器內嵌的圖片/文字（content_json）也算有內容 → 只放圖片也能過驗證
      const hasInline = hasContentInNode(node.content_json);
      if (!hasText && !hasFiles && !hasInline) messages.push(`${label} 尚未填寫內容或上傳圖片`);
    }

    if (node.content_type === 2 && node.table_json) {
      const tables = (node.table_json.content || []).filter((n) => n.type === 'table');
      const rows = tables[0]?.content || [];
      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r].content || [];
        const rowHasContent = cells.some((cell) => hasContentInNode(cell));
        if (!rowHasContent) {
          messages.push(`${label} 表格有未填寫的列 (第 ${r + 1} 列不得全空)`);
          break;
        }
      }
    }
  }, [], ROOT_DEPTH, indexOffset);
  return { isValid: messages.length === 0, message: messages };
}

/**
 * 單一 blockData → 樹節點（給 ProcessFlow step0 / 管理 PMS 3.1 等特製單塊元件用）。
 * blockData 形狀：{ content_type, header_*, content_*, table_*, files, metadata }（無 children）。
 */
export function nodeFromBlockData(d = {}) {
  return {
    client_id: uuidv1(),
    content_id: null,
    content_type: d.content_type ?? 0,
    header_json: d.header_json ?? null,
    header_text: d.header_text ?? null,
    content_json: d.content_json ?? null,
    content_text: d.content_text ?? null,
    table_json: d.table_json ?? null,
    table_text: d.table_text ?? null,
    files: Array.isArray(d.files) ? d.files : [],
    metadata: d.metadata ?? {},
    children: [],
  };
}

/** 樹節點 → 單一 blockData（nodeFromBlockData 的反向）。 */
export function blockDataFromNode(n = {}) {
  return {
    content_type: n.content_type ?? 0,
    header_json: n.header_json ?? null,
    header_text: n.header_text ?? null,
    content_json: n.content_json ?? null,
    content_text: n.content_text ?? null,
    table_json: n.table_json ?? null,
    table_text: n.table_text ?? null,
    files: Array.isArray(n.files) ? n.files : [],
    metadata: n.metadata ?? {},
  };
}

/**
 * 把樹整理成存檔用的巢狀 payload（§7.1）：剝掉 content_id、保留 children 巢狀、
 * 不送 parent_id / sort_order / depth（由後端 DFS 推導）。
 * client_id / _text / files / metadata 照送。
 */
export function toPayloadTree(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => ({
    client_id: n.client_id,
    content_type: n.content_type,
    header_json: n.header_json ?? null,
    header_text: n.header_text ?? null,
    content_json: n.content_json ?? null,
    content_text: n.content_text ?? null,
    table_json: n.table_json ?? null,
    table_text: n.table_text ?? null,
    files: Array.isArray(n.files) ? n.files : [],
    metadata: n.metadata ?? {},
    children: toPayloadTree(n.children),
  }));
}
