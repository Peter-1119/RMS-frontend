<!-- ManufacturingParameterBlocks.vue -->
<template>
  <div class="blk-wrap">
    <button class="btn add" @click="addBlock(null, true)">新增下一層</button>

    <div v-for="(blk, index) in localBlockContents" :key="blk.id" class="blk">
      <div class="blk-hd">
        <div><b>程式代碼：</b>{{ blk.data[0].metadata.programs?.[0]?.programCode || '(尚未配號)' }}</div>

        <div class="copybox">
          <label>程式代碼：</label>
          <input v-model="copyCode" placeholder="輸入要複製的代碼" />
          <button class="btn info" @click="copyFromCode(index)">複製</button>
        </div>

        <div class="ops">
          <button class="btn info" @click="addBlock(null, true, index)">新增同層</button>
          <button class="btn info" @click="duplicateBlock(index)">複製模塊</button>
          <button class="btn danger" @click="delBlock(index)">刪除</button>
        </div>
      </div>

      <!-- Parameter (Table 2) -->
      <div v-if="hasAnyMachineGroup" class="menu" :class="{ 'menu-error': !blk.data[0].metadata.groupCode || !blk.data[0].metadata.machines }">
        <div class="l">
          <label>機檯群組：</label>
          <select v-model="blk.data[0].metadata.groupCode" @change="onGroupSelect(index)">
            <option value="">-- 請選擇群組 --</option>
            <option v-for="([groupCode, groupInfo]) in Object.entries(groupSpecMap)" :key="groupCode" :value="groupCode">{{ groupInfo.name }}</option>
          </select>

          <template v-if="blk.data[0].metadata.groupCode">
            <label style="margin-left: 12px;">流程順序：</label>
            <div class="custom-select" tabindex="0" @focusout="onFocusOut(index, $event)" :style="blk.data[0].metadata.isParamNA ? 'opacity: 0.5; pointer-events: none; background-color: #f5f5f5;' : ''">
              <div class="select-trigger" @click="toggleProcessMenu(index)">
                {{ (blk.data[0].metadata.processOrder && blk.data[0].metadata.processOrder.length > 0) ? blk.data[0].metadata.processOrder.join('、') : '-- 請選擇 --' }}
                <span class="arrow">▼</span>
              </div>
              
              <div class="select-options" v-show="openProcessOrderMenu === index">
                <label v-for="n in getStepCount(index)" :key="n" class="option-item" @mousedown.prevent>
                  <input type="checkbox" :checked="blk.data[0].metadata.processOrder?.includes(n)" @change="toggleProcessOrder(index, n)">{{ n }}
                </label>
              </div>
            </div>
          </template>
        </div>

        <div v-if="allowColor" class="r">
          <i class="dot blue"  @click="tableEditors[index]?.chain().focus().setColor('blue').run()"></i>
          <i class="dot black" @click="tableEditors[index]?.chain().focus().setColor('null').run()"></i>
        </div>
      </div>

      <div v-if="blk.data[0].metadata.groupCode" class="machine-list-panel">
        <div class="panel-head">
          <label>機台選擇：</label>
          <div class="actions">
            <button class="btn small" @click.prevent="selectAllMachines(index)">全選</button>
            <button class="btn small danger" @click.prevent="deselectAllMachines(index)">全部取消</button>
          </div>
        </div>
        
        <div class="machine-grid">
          <label v-for="m in getGroupMachines(index)" :key="m.code" class="machine-item" :class="{'disabled': isMachineDisabled(index, m.code),'conflict': isMachineConflict(index, m.code)}">
            <input type="checkbox" v-model="blk.data[0].metadata.machines" :value="m.code" @click="toggleMachine(index, m, $event)" :disabled="isMachineDisabled(index, m.code)">{{ m.name }}
          </label>
        </div>
      </div>

      <div class="status-message-area">
  
        <div v-if="!hasAnyMachineGroup" class="hint empty">此適用工程目前沒有可用的機台群組，無需設定。</div>
        <div v-else-if="!blk.data[0].metadata.groupCode" class="hint info">請先從上方選單選擇一個「機檯群組」。</div>
        <div v-else-if="blk.data[0].metadata.machines.length === 0" class="hint warning">請勾選上方至少一台機台，系統將以「第一台」作為基準載入 PMS 表格。</div>

        <div v-else-if="blk.data[0].metadata.isParamNA" class="hint info" style="background-color: #f4f9ff; border-color: #1666C0;">
          <label style="color: #1666C0; font-weight: bold; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" checked disabled />此基準機台無點位資料，系統已自動設為無需設定機台參數 (N/A)。 請依照「2. 製作條件規範」進行製造參數設定與確認
          </label>
        </div>

        <div v-else-if="!tableEditors[index]" class="hint non-param">此機台無PMS資料</div>
        <div v-else-if="tableEditors[index]" class="editor-container">
          <EditorContent :editor="tableEditors[index]" class="ed ed-param"/>
        </div>

      </div>

      <!-- 完全沒有機台群組：只顯示一行說明，整個 Step 視為「不需填寫」 -->
      <!-- <div v-else class="hint empty">此適用工程沒有任何機台群組，不需設定 PMS。</div> -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, onBeforeUnmount, computed } from 'vue'
import { v1 as uuidv1 } from 'uuid';

import { EditorContent, Editor } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Focus } from '@tiptap/extensions'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { History } from '@tiptap/extension-history'
import { getText, handleCopy, handlePaste as baseHandlePaste, handleMousedown, handleKeyDown, validateValueStatus, handlePaste } from '@/utils/tiptapTableUtils.js'

import { allocateProgramCode, releaseProgramCode, copySpecParamFromCode, fetchMachineSpecPMS } from '@/api/docsApi'

// ==========================================
// 1. Emit and props Function
// ==========================================
const emit = defineEmits(['update-block', 'invalid-check']);
const props = defineProps({
  partNo: { type: String, default: true },
  blockContent: { type: Array, default: () => [] },
  specification: { type: Object, required: true },
  groupMachines: { type: Object, required: true },
  documentToken: { type: String, default: '' },
  allowColor: {type: Boolean, default: true},
})

// ==========================================
// 2. Computed Helper Function
// ==========================================
const hasAnyMachineGroup = computed(() => Object.keys(props.groupMachines || {}).length > 0);
const groupKeys = computed(() => (Object.values(props.groupMachines).flatMap(groups => Object.keys(groups))));
const groupSpecMap = computed(() => (Object.fromEntries(Object.entries(props.groupMachines).flatMap(([spec, groups]) => Object.entries(groups).map(([group, groupInfo]) => [group, { name: groupInfo.name, spec }])))));
let machineMatchSet = {};

// ==========================================
// 3. Editor Declare & Tiptap Extension Presets & Helper Function
// ==========================================
let tableEditors = ref([]);
let localBlockContents = ref([]);

const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })];
const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      contenteditable: { default: true, parseHTML: el => el.getAttribute('contenteditable') !== 'false', renderHTML: attrs => ({ contenteditable: attrs.contenteditable ? 'true' : 'false' }) },
      class: { default: null, parseHTML: el => el.getAttribute('class'), renderHTML: attrs => (attrs.class ? { class: attrs.class } : {}) },
      cellType: { default: 'text' },
      checked: {
        default: false,
        parseHTML: el => el.getAttribute('data-checked') === 'true',
        renderHTML: attrs => (attrs.checked ? { 'data-checked': 'true' } : {})
      }
    }
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const td = document.createElement('td');
      if (node.attrs.class) td.className = node.attrs.class;

      if (node.attrs.cellType === 'checkbox') {
        td.classList.add('checkbox-cell-wrapper');

        const box = document.createElement('div');
        box.className = 'checkbox-cell';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!node.attrs.checked;
        input.addEventListener('change', () => {
          if (typeof getPos !== 'function') return;
          const pos = getPos();
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, null, { ...node.attrs, checked: input.checked })
          );
        });
        box.appendChild(input);

        // hidden contentDOM 讓 CellSelection / paste 等行為仍可運作
        const hidden = document.createElement('div');
        hidden.style.cssText = 'height:0;overflow:hidden;';
        box.appendChild(hidden);

        td.appendChild(box);
        td.contentEditable = 'false';
        return { dom: td, contentDOM: hidden, stopEvent: e => e.target === input };
      }

      if (node.attrs.contenteditable === false) td.contentEditable = 'false';
      return { dom: td, contentDOM: td };
    };
  }
});
const CustomTableHeader = TableHeader.extend({ 
  addAttributes() { 
    return { 
      ...this.parent?.(), 
      contenteditable: { default: false, parseHTML: el => el.getAttribute('contenteditable') !== 'false', renderHTML: attrs => ({ contenteditable: attrs.contenteditable ? 'true' : 'false' }) }
    }; 
  } 
});
const CustomTableRow = TableRow.extend({ content: '(tableCell | tableHeader)*', addAttributes() { return { ...this.parent?.(), class: { default: null } }; } });
const tableEditorExtensions = [Document.extend({ content: 'table' }), ...baseExt, Table, Focus.configure({ className: 'has-focus', mode: 'all' }), CustomTableRow, CustomTableHeader, CustomTableCell, History];

// Prohibit certain columns to edit
const LOCKCOLS = [0, 1];

// 用 header 名稱動態判定特殊欄位（避免後端調整欄位順序時 hardcoded index 失準）
const CHECKBOX_HEADER_NAMES = ['定值項目'];
const NUMERIC_HEADER_NAMES = ['規格下限(OOS-)', '操作下限(OOC-)', '設定值', '操作上限(OOC+)', '規格上限(OOS+)'];
const findCheckboxColIndex = (headers) => headers.findIndex(h => CHECKBOX_HEADER_NAMES.includes(h));
const findNumericColIndices = (headers) => NUMERIC_HEADER_NAMES.map(name => headers.indexOf(name));

const createParamRowNode = (type, row, headers = []) => row.map((text, cellIndex) => {
  // 資料列遇到 checkbox 欄位 → 產生 cellType:'checkbox' cell（header 仍是文字）
  if (type !== 'tableHeader' && CHECKBOX_HEADER_NAMES.includes(headers[cellIndex])) {
    const checked = text === '1' || text === true || text === 'true';
    return {
      type: 'tableCell',
      attrs: { cellType: 'checkbox', checked, contenteditable: false },
      content: [{ type: 'paragraph' }]
    };
  }
  return {
    type,
    attrs: { cellType: 'text', contenteditable: !LOCKCOLS.includes(cellIndex) && type != 'tableHeader' },
    content: [{ type: 'paragraph', ...(text ? { content: [{ type: "text", text }] } : {}) }]
  };
});
const initialTableDoc = (template) => {
  const headers = template[0] || [];
  return {
    type: 'doc', content: [{
      type: 'table', content: template.map((row, rowIndex) => ({
        type: 'tableRow',
        content: createParamRowNode(rowIndex == 0 ? "tableHeader" : "tableCell", row, headers)
      }))
    }]
  };
};

// 取得單一 cell 的「比對用」字串（checkbox 換成符號，避免 dup 偵測時被視為空）
const getCellSig = (cellNode) => {
  if (cellNode.attrs?.cellType === 'checkbox') return cellNode.attrs.checked ? '☑' : '☐';
  return getText(cellNode);
};
const getParamMatrix = (ed) => ed.state.doc.firstChild.content.content.map(rowNode => rowNode.content.content.map(getCellSig));

// ==========================================
// 4. Specification Select Function
// ==========================================
const removeProgram = async (blkIndex, specInfo, showWindow = true) => {
  if (showWindow && !confirm(`確定要移除製程「${specInfo.specName}」與程式號碼「${specInfo.programCode || ''}」嗎？`)) return;
  try { await releaseProgramCode(specInfo.programCode); }
  catch (e) {
    console.error('releaseProgramCode failed', e);
    if (showWindow) alert('程式號碼釋放失敗，請稍後再試');
  }
  exportTableData();
}

// ==========================================
// 5. Editor Initialize & Validate Function
// ==========================================
let validateTimer = null;
const buildTableEditor = (template) => {
  if (!template) return null;
  const data = (Array.isArray(template)) ? initialTableDoc(template) : template;
  const ed = new Editor({
    content: data, extensions: tableEditorExtensions,
    editorProps: { handleDOMEvents: { drop: () => true, dragstart: () => true, copy: handleCopy, paste: handlePaste, mousedown: handleMousedown }, handleKeyDown: handleKeyDown },
    onUpdate: ({ editor }) => {
      if (validateTimer) clearTimeout(validateTimer);
      validateTimer = setTimeout(() => { validateParamTableContent(editor, tableEditors.value.indexOf(editor)), validateParamDuplicate(); }, 200);
    },
  });
  return ed;
}
const initFromProps = (template, blkIndex) => {
  if (tableEditors.value.length <= blkIndex) return;
  if (tableEditors.value[blkIndex]) { tableEditors.value[blkIndex].destroy(); tableEditors.value[blkIndex] = null; }  // destroy first
  if (template) {
    tableEditors.value[blkIndex] = buildTableEditor(template);
    validateParamTableContent(tableEditors.value[blkIndex], blkIndex, false)
    localBlockContents.value[blkIndex].data[0].metadata.isParamNA = false;
  } else {
    localBlockContents.value[blkIndex].data[0].metadata.isParamNA = true;
    localBlockContents.value[blkIndex].data[0].metadata.processOrder = [];
    localBlockContents.value[blkIndex].data[0].table_json = null;
    localBlockContents.value[blkIndex].data[0].table_text = null;
  }

  // if (!template) {  // No PMS data
  //   localBlockContents.value[blkIndex] = { id: uuidv1(), step_type: 5, tier_no: localBlockContents.value.length + 1, data: [
  //     { content_type: 2, header_text: null, header_json: null, content_text: null, content_json: null, table_text: null, table_json: null, files: [], metadata: {} },
  //   ]};
  // } else { tableEditors.value[blkIndex] = buildTableEditor(template); } // Load PMS template

  exportTableData();
}
const loadBlocks = async (blocks) => {

  console.log("load blocks: ", blocks);
  // Clear all data
  await delAllBlock(false);

  // If there is no any block data then create a new one
  if (!blocks || blocks.length === 0) { 
    addBlock(null); 
    return; 
  }

  // Load data table from parent
  localBlockContents.value = [...blocks];

  // Build and load all table editor
  errorFlags.splice(0, errorFlags.length, ...localBlockContents.value.map(() => createErrorFlag()));
  tableEditors.value = localBlockContents.value.map(blk => {
    if (!blk.id) blk.id = uuidv1();
    
    const machines = blk.data[0].metadata?.machines || [];
    machineMatchSet[blk.id] = new Set(machines);

    const tableData = blk.data[0].table_json;
    return buildTableEditor(tableData);
  });

  // Emit data table to parent
  validateParamDuplicate(false); exportTableData();
}
const applyUpdates = (updates) => {
  if (!updates) return;

  localBlockContents.value.forEach((blk, blkIndex) => {
    const updateInfo = updates[blk.id];
    if (!updateInfo) return;

    // 1. 無論如何都更新最新的 matchSet (給 checkbox 狀態判定用)
    machineMatchSet[blk.id] = new Set(updateInfo.matchSet);

    // 2. 如果父組件說「有異動」，就拿合併後的新表格重新初始化 Editor
    if (updateInfo.hasUpdate) { initFromProps(updateInfo.mergedTable, blkIndex); }
  });

  exportTableData();
}

const errorFlags = reactive([]); // ★ 改為陣列
const createErrorFlag = () => ({ paramInvalid: false, paramDup: false });
const validateParamTableContent = (editor, blkIndex, isExport = true) => {
  if (!editor) return;
  let hasInvalidValue = false;

  const { state, view } = editor; let tr = state.tr;

  // 動態定位欄位（不再 hardcoded index 2~7）
  const headerRowNode = state.doc.firstChild.firstChild;
  const headers = headerRowNode.content.content.map(getText);
  const numericIdx = findNumericColIndices(headers);
  const checkboxIdx = findCheckboxColIndex(headers);

  // 5 個數值欄位有缺 → template 異常，直接跳過驗證
  if (numericIdx.some(i => i < 0)) {
    if (errorFlags[blkIndex]) errorFlags[blkIndex].paramInvalid = false;
    if (isExport) exportTableData();
    return;
  }

  const N = state.doc.content.firstChild.content.childCount;
  let rowsPos = [1];
  for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
  for(let rowIndex = N - 1; rowIndex > 0; rowIndex--){
    if (rowIndex >= editor.state.selection.$anchor.node(1).content.childCount) return;
    const rowNode = editor.state.selection.$anchor.node(1).content.child(rowIndex);
    const rowPos = rowsPos[rowIndex];
    const cells = rowNode.content;

    const cellPos = [rowPos + 1];
    for(let index = 0; index < cells.childCount - 1; index++) cellPos.push(cellPos.at(-1) + cells.child(index).nodeSize);

    // 該 row 是否勾選「定值項目」→ 勾選時跳過上下限驗證
    const isFixed = checkboxIdx >= 0 && cells.child(checkboxIdx)?.attrs?.checked === true;

    // 收集 5 個數值欄位
    const value = [];
    let valueStatus = [];
    for (let i = 0; i < numericIdx.length; i++) {
      const txt = getText(cells.child(numericIdx[i]));
      let status = 'empty';
      let val = Number(txt);

      if (txt) status = (Number.isNaN(val)) ? 'invalid' : 'valid';
      value.push(val); valueStatus.push(status);
    }

    // 勾選定值項目：上下限 4 格不卡控，但「設定值」必填且須為合法數字（保留 empty/invalid 狀態）
    if (isFixed) {
      const setValueIdx = NUMERIC_HEADER_NAMES.indexOf('設定值');
      valueStatus = valueStatus.map((s, i) => i === setValueIdx ? s : 'valid');
    } else {
      valueStatus = validateValueStatus(value, valueStatus);
    }

    // 套色
    for (let i = numericIdx.length - 1; i >= 0; i--) {
      if (valueStatus[i] === 'invalid' || valueStatus[i] === 'empty') hasInvalidValue = true;
      const cellNode = cells.child(numericIdx[i]);
      const newClass = 'value-' + valueStatus[i];

      if (cellNode.attrs.class === newClass) continue;

      const newAttrs = { ...cellNode.attrs, class: newClass };
      tr = tr.setNodeMarkup(cellPos[numericIdx[i]], cellNode.type, newAttrs, cellNode.marks);
    }
  }

  if (errorFlags[blkIndex]) {
    errorFlags[blkIndex].paramInvalid = hasInvalidValue;
  }
  editor.view.dispatch(tr);
  if (isExport) exportTableData();
}
const validateParamDuplicate = (isExport = true) => {
  const sigMap = new Map();
  tableEditors.value.forEach((ed, idx) => {
    if (!ed) return;
    const sig = JSON.stringify(getParamMatrix(ed));

    if (!sigMap.has(sig)) sigMap.set(sig, []);
    sigMap.get(sig).push(idx);
  });

  const dupIdx = new Set();
  const uniIdx = new Set();
  for(const indices of sigMap.values()) {
    if (indices.length > 1) indices.forEach(i => dupIdx.add(i));
    else uniIdx.add(indices[0]);
  }

  dupIdx.forEach(idx => {
    if (errorFlags[idx]) errorFlags[idx].paramDup = true;
    const { state, view } = tableEditors.value[idx];
    const tr = state.tr;
    const N = state.doc.content.firstChild.content.childCount

    let rowsPos = [1];
    for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
    for(let rowIndex = N - 1; rowIndex > 0; rowIndex--) {
      tr.setNodeMarkup(rowsPos[rowIndex], undefined, { ...rowsPos[rowIndex].attrs, class: 'dup-table' })
    }
    if(tr.docChanged) view.dispatch(tr);
  })

  uniIdx.forEach(idx => {
    if (errorFlags[idx]) errorFlags[idx].paramDup = false;
    const { state, view } = tableEditors.value[idx];
    const tr = state.tr;
    const N = state.doc.content.firstChild.content.childCount

    let rowsPos = [1];
    for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
    for(let rowIndex = N - 1; rowIndex > 0; rowIndex--) {
      tr.setNodeMarkup(rowsPos[rowIndex], undefined, { ...rowsPos[rowIndex].attrs, class: '' })
    }
    if(tr.docChanged) view.dispatch(tr);
  })
  if (isExport) exportTableData();
}
const validationState = computed(() => {
  const messages = [];
  localBlockContents.value.forEach((blkInfo, index) => {
    const prefix = `[第 ${index + 1} 組模塊]`;
    const metadata = blkInfo.data[0]?.metadata || {};

    // 1. 檢查是否填寫機台 (必填)
    if (!metadata.groupCode || !metadata.machines || metadata.machines.length === 0) {
      messages.push(`${prefix} 尚未選擇機檯群組與機台`);
    }

    // 2. 檢查是否選擇流程順序 (僅當機台有 PMS 點位時才必填)
    // Why: 機台若無 PMS 點位 (isParamNA=true)，UI 中流程順序選單會被禁用 (pointer-events:none)，
    // 使用者無法選擇；同樣地，尚未選機台時也由上面 #1 負責，這邊不重複卡控。
    if (metadata.machines && metadata.machines.length > 0 && !metadata.isParamNA) {
      if (!metadata.processOrder || metadata.processOrder.length === 0) {
        messages.push(`${prefix} 尚未選擇流程順序`);
      }
    }

    // 3. 檢查是否有 PMS 參數的表格錯誤 (僅當機台有 PMS 點位時才檢查)
    if (!metadata.isParamNA && errorFlags[index]) {
      if (errorFlags[index].paramInvalid) {
        messages.push(`${prefix} 表格內有未填寫或格式錯誤的參數`);
      }
      if (errorFlags[index].paramDup) {
        messages.push(`${prefix} 表格內有重複的參數列`);
      }
    }
  });

  return { isValid: messages.length === 0, message: messages };
});

// ==========================================
// 6. Trigger Function
// ==========================================
const onGroupSelect = (blkIndex) => {
  initFromProps(null, blkIndex);
  machineMatchSet[localBlockContents.value[blkIndex].id] = new Set(); 
  Object.assign(localBlockContents.value[blkIndex].data[0].metadata, { programs: [], machines: [], machines_name: [], isParamNA: false, processOrder: [] });

  const count = getStepCount(blkIndex);
  if (count === 1) { localBlockContents.value[blkIndex].data[0].metadata.processOrder = [1]; }
  exportTableData();
}
const getGroupMachines = (blkIndex) => {
  const groupCode = localBlockContents.value[blkIndex].data[0].metadata.groupCode;
  return props.groupMachines[groupSpecMap.value[groupCode].spec][groupCode].machines;
}
const isMachineDisabled = (blkIndex, machineCode) => {
  return machineMatchSet[localBlockContents.value[blkIndex].id].size > 0 && !machineMatchSet[localBlockContents.value[blkIndex].id].has(machineCode);
}
const isMachineConflict = (blkIndex, machineCode) => {
  // console.log("blkIndex: ", blkIndex, "machineCode: ", machineCode, ", match set: ", machineMatchSet);
  // console.log("match set condition: ", !machineMatchSet[localBlockContents.value[blkIndex].id].has(machineCode) && localBlockContents.value[blkIndex].data[0].metadata.machines.some(_machineCode => _machineCode == machineCode));
  return !machineMatchSet[localBlockContents.value[blkIndex].id].has(machineCode) && localBlockContents.value[blkIndex].data[0].metadata.machines.some(_machineCode => _machineCode == machineCode);
}
const matchRequesting = ref(false);
const toggleMachine = async (blkIndex, machineInfo, event) => {
  if (matchRequesting.value) return; 

  if (props.partNo == "") {
    alert("請選擇品目");
    return;
  }

  matchRequesting.value = true;
  const blk = localBlockContents.value[blkIndex];
  if (event.target.checked && blk.data[0].metadata.machines.length == 0) {
    try { 
      machineMatchSet[blk.id] = new Set([machineInfo.code]);
      const { pms, matchSet } = await fetchMachineSpecPMS(blk.data[0].metadata.groupCode, machineInfo.code);
      const { specCode, programCode, prefix, serial } = await allocateProgramCode(groupSpecMap.value[blk.data[0].metadata.groupCode].spec, props.documentToken, props.partNo);

      initFromProps(pms, blkIndex);
      machineMatchSet[blk.id] = new Set(matchSet);
      if (pms) blk.data[0].metadata.programs = [{ specCode, programCode }];
      blk.data[0].metadata.machines_name.push(machineInfo.name);
    } 
    catch (e) { 
      console.error('fetch machine PMS failed:', e);
      machineMatchSet[blk.id] = new Set([]);
      blk.data[0].metadata.machines = blk.data[0].metadata.machines.filter(_machineCode => _machineCode != machineInfo.code); 
      alert('獲取機台 PMS 失敗');
    }
  }
  else if (!event.target.checked && blk.data[0].metadata.machines.length == 1) { 
    try {
      if (blk.data[0].metadata.programs.length > 0) await releaseProgramCode(blk.data[0].metadata.programs?.[0].programCode);

      initFromProps(null, blkIndex);
      machineMatchSet[blk.id] = new Set();
      Object.assign(blk.data[0].metadata, { programs: [], machines: [], machines_name: blk.data[0].metadata.machines_name.filter(_machineName => _machineName != machineInfo.name), isParamNA: false });
    } catch (e) {
      console.error('release program code failed:', e);
      if (!blk.data[0].metadata.machines.includes(machineInfo.code)) blk.data[0].metadata.machines = blk.data[0].metadata.machines.push(machineInfo.code);
      alert('釋放程式代碼失敗');
    }
  }
  matchRequesting.value = false;
}

const selectAllMachines = async (blkIndex) => {
  const blk = localBlockContents.value[blkIndex];

  // Toggle first machine and select match machines
  await toggleMachine(blkIndex, getGroupMachines(blkIndex)[0], { target: { checked: true } });
  getGroupMachines(blkIndex).forEach(machineInfo => {
    if (machineMatchSet[blk.id].has(machineInfo.code) && !blk.data[0].metadata.machines.includes(machineInfo.code)) {
      blk.data[0].metadata.machines.push(machineInfo.code);
      blk.data[0].metadata.machines_name.push(machineInfo.name);
    }
  })

  console.log("metadata: ", blk.data[0].metadata);
  exportTableData();
}
const deselectAllMachines = async (blkIndex) => {
  const blk = localBlockContents.value[blkIndex];

  // Release program code
  const programs = blk.data[0].metadata.programs || [];
  for (const specInfo of programs) { await removeProgram(blkIndex, specInfo, false); }

  // Clear data and match set
  blk.data[0].metadata.machines.length = 0;
  blk.data[0].metadata.machines_name.length = 0;
  blk.data[0].metadata.programs.length = 0;
  blk.data[0].metadata.isParamNA = false;
  machineMatchSet[blk.id].clear();

  console.log("metadata: ", blk.data[0].metadata);
  exportTableData();
}


const exportTableData = () => {
  const blks = localBlockContents.value.map((blk, blkIndex) => {
    const paramText = (tableEditors.value[blkIndex]) ? getParamMatrix(tableEditors.value[blkIndex]) : null;
    const paramJson = (paramText) ? tableEditors.value[blkIndex].getJSON() : null;

    return { id: blk.id, step_type: 5, tier_no: blkIndex, data: [
      {content_type: 2, header_text: null, header_json: null, content_text: null, content_json: null, table_text: paramText, table_json: paramJson, files: [], metadata: blk.data[0].metadata },
    ]};
  })
  console.log(" -- emit!!!")
  emit("update-block", blks);
  emit('invalid-check', validationState.value);
}

// ==========================================
// 6.1 Processes Order Helper Function
// ==========================================
const openProcessOrderMenu = ref(null); // Mark which block the user focus on
function toggleProcessMenu(index) { openProcessOrderMenu.value = (openProcessOrderMenu.value === index) ? null : index; }

// Close the menu when user click outside the menu
function onFocusOut(index, event) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  if (openProcessOrderMenu.value === index) openProcessOrderMenu.value = null;
}

// Get correspond step_count from props.specification
const getStepCount = (blkIndex) => {
  const groupCode = localBlockContents.value[blkIndex].data[0].metadata.groupCode;
  if (!groupCode) return 0;
  
  const specCode = groupSpecMap.value[groupCode]?.spec;
  if (!specCode) return 0;

  return props.specification[specCode] || 1;;
}

// Toggle process order
const toggleProcessOrder = (blkIndex, stepNumber) => {
  const blk = localBlockContents.value[blkIndex];
  if (!blk.data[0].metadata.processOrder) { blk.data[0].metadata.processOrder = []; }
  
  const list = blk.data[0].metadata.processOrder;
  const idx = list.indexOf(stepNumber);
  
  if (idx > -1) { list.splice(idx, 1); }
  else { list.push(stepNumber); list.sort((a, b) => a - b); }
  
  exportTableData(); // Export table data to parent component
}

// ==========================================
// 7. Button Function
// ==========================================
const _initial_metadata = () => ({ machines: [], programs: [], groupCode: "", isParamNA: false, processOrder: [], machines_name: [] });
const addBlock = (table, isExport = true, index = null) => {
  const id = uuidv1();
  const n = index == null ? localBlockContents.value.length : index + 1;
  localBlockContents.value.splice(n, 0, { id, step_type: 5, tier_no: localBlockContents.value.length + 1, data: [
    { content_type: 2, header_text: null, header_json: null, content_text: null, content_json: null, table_text: null, table_json: null, files: [], metadata: { ..._initial_metadata() } },
  ]});
  machineMatchSet[id] = new Set();
  tableEditors.value.splice(n, 0, buildTableEditor(table));
  errorFlags.splice(n, 0, createErrorFlag());

  if (isExport) exportTableData();
}
const delBlock = async (blkIndex, showWindow = true) => {
  if (matchRequesting.value) alert("數據訪問中，請稍後嘗試");

  // Notify user
  if (localBlockContents.value.length == 1) { alert("至少需要保留一個組合"); return; }
  if (showWindow && !confirm("確定要刪除此組合嗎？")) return;

  // Destroy editor object
  if (tableEditors.value[blkIndex]) tableEditors.value[blkIndex].destroy();
  tableEditors.value.splice(blkIndex, 1);

  // Release program code if system have assigned
  const blkid = localBlockContents.value[blkIndex].id;
  const programs = localBlockContents.value[blkIndex].data[0].metadata.programs || [];
  for (const specInfo of programs) { await removeProgram(blkIndex, specInfo, false); }
  localBlockContents.value.splice(blkIndex, 1);
  errorFlags.splice(blkIndex, 1);

  // Clear and delete machine match set
  machineMatchSet[blkid].clear()
  delete machineMatchSet[blkid];

  // Validate table content and table data
  validateParamDuplicate(); exportTableData();
}
const delAllBlock = async (isExport = true, keepone = false) => {
  const N = tableEditors.value.length;
  for (let i = 0; i < N; i++) {
    if (tableEditors.value[i]) tableEditors.value?.destroy?.();
    const programs = localBlockContents.value[i].data?.[0]?.metadata?.programs || [];
    for (const specInfo of programs) { await removeProgram(i, specInfo, false); }
  };
  tableEditors.value.splice(0, N); localBlockContents.value.splice(0, N);
  localBlockContents.value = [];

  Object.entries(machineMatchSet).forEach(([id, matchSet]) => matchSet.clear());
  machineMatchSet = {};
  errorFlags.splice(0, errorFlags.length);

  if (keepone) addBlock(null, false);
  if (isExport) exportTableData();
}
const duplicateBlock = async (blkIndex) => {
  // Duplicate new table editor and temporary data block
  localBlockContents.value.splice(blkIndex + 1, 0, JSON.parse(JSON.stringify(localBlockContents.value[blkIndex])));

  const blk = localBlockContents.value[blkIndex + 1];
  const id = uuidv1();
  blk.id = id;
  machineMatchSet[id] = new Set(machineMatchSet[localBlockContents.value[blkIndex].id]);
  tableEditors.value.splice(blkIndex + 1, 0, buildTableEditor(tableEditors.value[blkIndex]?.getJSON()));
  errorFlags.splice(blkIndex + 1, 0, createErrorFlag());

  // Copy and assign program code
  const programs = blk.data[0].metadata.programs || [];
  if (programs.length > 0) {
    const { specCode, programCode, prefix, serial } = await allocateProgramCode(groupSpecMap.value[blk.data[0].metadata.groupCode].spec, props.documentToken);
    blk.data[0].metadata.programs = [{ specCode, programCode }];
  }

  // Validate table and export
  validateParamDuplicate(); exportTableData();
}
const copyCode = ref(null);
const copyFromCode = (blkIndex) => { 
  const codeToCopy = localBlockContents.value[blkIndex].data[0].metadata.copyCode;
  if (!codeToCopy) { alert("請先輸入代碼！"); return; }
  alert("在已簽核文件中查無此代碼"); 
}

// ==========================================
// 8. Constructor & Destructor Function
// ==========================================
onMounted(async () => { await loadBlocks(props.blockContent); })
defineExpose({ delAllBlock, loadBlocks, exportTableData, applyUpdates });
</script>

<style scoped>
/* 你的原樣式我基本沒動，只保留 */
.btn{padding:6px 12px;border:none;border-radius:6px;color:#fff;background:#007bff;cursor:pointer}
.btn:hover{opacity:.9}
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

/* [新增] 樣式 */
.machine-list-panel { background: #f8f9fa; border: 1px solid #eee; border-top: none; padding: 10px; border-radius: 0 0 6px 6px; margin-bottom: 10px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.actions { display: flex; gap: 8px; }
.machine-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); 
  gap: 8px; 
  max-height: 200px; 
  overflow-y: auto; 
  background: #fff;
  border: 1px solid #ddd;
  padding: 8px;
  border-radius: 4px;
}
.machine-item.disabled { opacity: 0.5; pointer-events: none; color: #999; }
.machine-item.conflict { background-color: #ffebee; border: 1px solid #ef5350; color: #d32f2f; border-radius: 4px; padding: 0 4px; }
.machine-item.conflict input { cursor: pointer; }
.custom-select { position: relative; display: inline-block; width: 160px; vertical-align: middle; outline: none; background: #fff; }

.select-trigger {
  border: 1px solid #767676; /* 仿照 Chrome 預設 select 邊框顏色 */
  border-radius: 2px;
  padding: 2px 6px;
  min-height: 24px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13.3333px; /* 仿照預設 select 字體大小 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.select-trigger .arrow { font-size: 10px; margin-left: 6px; color: #666; }
.select-options {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  border: 1px solid #ddd;
  background: #fff;
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  border-radius: 0 0 4px 4px;
}
.option-item { display: block; padding: 6px 10px; cursor: pointer; user-select: none; }
.option-item:hover { background-color: #f0f8ff; }
.option-item input { margin-right: 8px; vertical-align: middle; }

.machine-item { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; user-select: none;}
.summary { margin-top: 8px; font-size: 13px; color: #666; text-align: right; }
.btn.small { padding: 4px 8px; font-size: 12px; }
.dot{display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:pointer}
.red{background:#f00}.blue{background:#00f}.black{background:#000}
.ed{background:#fff;border:1px solid #ddd;border-radius:6px;margin-bottom:10px}
.ed :deep(.ProseMirror){padding:8px;min-height:80px;outline:none}
.ed :deep(table){border-collapse:collapse;width:100%;table-layout:fixed}
.ed :deep(th),.ed :deep(td){border:1px solid #ddd;padding:8px;text-align:center;vertical-align:middle;min-width:72px;position:relative}
.ed :deep(th){background:#f8f9fa;font-weight:700;position:sticky;top:35px;z-index:5;}
.ed :deep(.selectedCell){background:#e3f2fd!important;outline:2px solid #2196f3;outline-offset:-2px}
.ed :deep([contenteditable="false"]){background:#f5f5f5;color:#666;cursor:not-allowed}
.ed :deep(tr.dup-row td){background:#ffe6e6!important}
.ed :deep(tr.dup-table td){background:#ffe6e6!important}
.ed :deep(td.value-empty){background:#fff7c2}
.ed :deep(td.value-invalid),.ed :deep(td.value-error){background:#ffcdd2}
.ed :deep(col:nth-child(1)) { width: 40%; }   /* 槽體 */
.ed :deep(col:nth-child(2)) { width: 75%; }   /* 管理項目 */
.ed :deep(col:nth-child(3)) { width: 30%; }   /* 定值項目 (checkbox) */
.ed :deep(col:nth-child(4)) { width: 40%; }   /* 規格下限(OOS-) */
.ed :deep(col:nth-child(5)) { width: 40%; }   /* 操作下限(OOC-) */
.ed :deep(col:nth-child(6)) { width: 40%; }   /* 設定值 */
.ed :deep(col:nth-child(7)) { width: 40%; }   /* 操作上限(OOC+) */
.ed :deep(col:nth-child(8)) { width: 40%; }   /* 規格上限(OOS+) */
.ed :deep(col:nth-child(9)) { width: 100%; }  /* 說明 */
.ed :deep(td:last-child) { text-align: left; }
.ed :deep(td.checkbox-cell-wrapper) { background-color: #fafbfc; padding: 0; }
.ed :deep(.checkbox-cell) { display: flex; align-items: center; justify-content: center; padding: 8px; }
.ed :deep(.checkbox-cell input[type="checkbox"]) { width: 18px; height: 18px; cursor: pointer; margin: 0; accent-color: #1666C0; }
.hint{ padding:12px; color:#555; background:#f8f9fb; border:1px dashed #cfd8dc; border-radius:6px; margin:8px 0 }
.hint.empty{ color:#9e9e9e; text-align:center; }
.menu-error { background: #ffcdd2; border-color: #f44336; }
</style>
