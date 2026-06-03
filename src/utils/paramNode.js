// src/utils/paramNode.js
//
// 參數表 block ↔ content_type=4 節點 互轉（對齊 spec §6.B / §19）。
// 用於把 ManufacturingParameterBlocks_ / ManufacturingConditionRuleBlocks_ 既有的
// block 形狀（{id, step_type, tier_no, data:[{table_json, table_text, metadata}, ...]}）
// 包成樹的 content_type=4 leaf 節點，存檔送出；載入時再反向解包還原給元件。
//
//   table_json = { parameterTable, conditionTable }   // 式樣書 step5 conditionTable=null
//   programs[] / 機台資訊 留在 metadata（節點自有，元件 PMS 比對需要）
//
// 不重寫參數表元件，僅在 parent 端做薄轉接（P2 範圍；深度重寫留 P3）。

import { v1 as uuidv1 } from 'uuid';

/**
 * 參數表 block → content_type=4 節點。
 * @param {object} blk  ManufacturingParameterBlocks 的單一 block：{ id, data:[{ table_json, table_text, metadata }] }
 * @param {object} [opt]
 * @param {object|null} [opt.conditionTable]  條件表 tiptap doc（指示書 step2 用；式樣書 null）
 * @param {string|null} [opt.conditionText]   條件表純文字鏡像
 */
export function paramBlockToNode(blk, { conditionTable = null, conditionText = null } = {}) {
  const d = (blk?.data && blk.data[0]) || {};
  return {
    client_id: blk?.client_id || (blk?.id != null ? String(blk.id) : uuidv1()),
    content_id: blk?.content_id ?? null,
    content_type: 4,
    header_json: null,
    header_text: null,
    content_json: null,
    content_text: null,
    table_json: { parameterTable: d.table_json ?? null, conditionTable },
    table_text: d.table_text ?? null,
    files: [],
    metadata: d.metadata ?? {},
    children: [],
  };
}

/**
 * content_type=4 節點 → 參數表 block（還原給 ManufacturingParameterBlocks_.loadBlocks 用）。
 * @param {object} node  content_type=4 節點
 * @param {number} index 在該 step 下的順序（tier_no 用）
 * @param {number} stepType 還原的 step_type（式樣書參數=5）
 */
export function nodeToParamBlock(node, index = 0, stepType = 5) {
  const tj = node?.table_json || {};
  return {
    id: node?.client_id || uuidv1(),
    client_id: node?.client_id || null,
    content_id: node?.content_id ?? null,
    step_type: stepType,
    tier_no: index + 1,
    data: [{
      content_type: 2,
      header_text: null,
      header_json: null,
      content_text: null,
      content_json: null,
      table_text: node?.table_text ?? null,
      table_json: tj.parameterTable ?? null,
      files: [],
      metadata: node?.metadata ?? {},
    }],
  };
}

/** 取出條件表（指示書 step2 用）：content_type=4 節點 → conditionTable tiptap doc。 */
export function nodeConditionTable(node) {
  return node?.table_json?.conditionTable ?? null;
}

/**
 * content_type=4 節點 → 指示書 MCR block（step2，data:[param, cond] 雙表）。
 * 還原給 ManufacturingConditionRuleBlocks_.loadTableFromProps 用。
 * data[0]=參數表（table_json=parameterTable）、data[1]=條件表（table_json=conditionTable），共用 metadata。
 */
export function nodeToMcrBlock(node, index = 0) {
  const tj = node?.table_json || {};
  const meta = node?.metadata ?? {};
  const mk = (table_json, table_text) => ({
    content_type: 2, header_text: null, header_json: null,
    content_text: null, content_json: null,
    table_text, table_json, files: [], metadata: meta,
  });
  return {
    id: node?.client_id || uuidv1(),
    client_id: node?.client_id || null,
    content_id: node?.content_id ?? null,
    step_type: 2,
    tier_no: index + 1,
    data: [mk(tj.parameterTable ?? null, node?.table_text ?? null), mk(tj.conditionTable ?? null, null)],
  };
}
