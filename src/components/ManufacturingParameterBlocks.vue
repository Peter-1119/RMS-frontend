<!-- ManufacturingParameterBlocks.vue -->
<template>
  <div class="blk-wrap">
    <button class="btn add" @click="addBlock">新增下一層</button>

    <div v-for="(b,i) in blocks" :key="b.id" class="blk">
      <div class="blk-hd">
        <div><b>程式代碼：</b>{{ b.code || '(尚未配號)' }}</div>

        <div class="copybox">
          <label>參數代碼：</label>
          <input v-model="copyCode" placeholder="輸入要複製的代碼" />
          <button class="btn info" @click="copyFromCode(i)">複製</button>
        </div>

        <div class="ops">
          <button class="btn info" @click="addBlock">新增同層</button>
          <button class="btn info" @click="duplicateBlock(i)">複製模塊</button>
          <button class="btn danger" @click="delBlock(i)">刪除</button>
        </div>
      </div>

      <!-- Parameter (Table 2) -->
      <div v-if="hasAnyMachineGroup" class="menu" :class="{ 'menu-error': !blocks[i].data.metadata.groupCode || !blocks[i].data.metadata.machines }">
        <div class="l">
          <label>機檯群組：</label>
          <select v-model="blocks[i].data.metadata.groupCode" @change="onGroupChange(i)">
            <option value="">-- 請選擇群組 --</option>
            <option v-for="[groupCode, groupInfo] in groupKeys" :key="groupCode" :value="groupCode">{{ groupInfo.name }}</option>
          </select>

          <template v-if="blocks[i].data.metadata.groupCode">
            <label style="margin-left: 12px;">流程順序：</label>
            <div class="custom-select" tabindex="0" @focusout="onFocusOut(i, $event)">
              <div class="select-trigger" @click="toggleProcessMenu(i)">
                {{ (blocks[i].data.metadata.processOrder && blocks[i].data.metadata.processOrder.length > 0) ? blocks[i].data.metadata.processOrder.join('、') : '-- 請選擇 --' }}
                <span class="arrow">▼</span>
              </div>
              
              <div class="select-options" v-show="openProcessOrderMenu === i">
                <label v-for="n in getStepCount(i)" :key="n" class="option-item" @mousedown.prevent>
                  <input type="checkbox" :checked="blocks[i].data.metadata.processOrder?.includes(n)" @change="toggleProcessOrder(i, n)">{{ n }}
                </label>
              </div>
            </div>
          </template>
        </div>

        <div v-if="allowColor" class="r">
          <i class="dot blue"  @click="paramEditors[i]?.chain().focus().setColor('blue').run()"></i>
          <i class="dot black" @click="paramEditors[i]?.chain().focus().setColor('null').run()"></i>
        </div>
      </div>

      <div v-if="blocks[i].data.metadata.groupCode" class="machine-list-panel">
        <div class="panel-head">
          <label>機台選擇：</label>
          <div class="actions">
            <button class="btn small" @click.prevent="selectAllMachines(i)">全選</button>
            <button class="btn small danger" @click.prevent="deselectAllMachines(i)">全部取消</button>
          </div>
        </div>
        
        <!-- <div class="machine-grid">
          <label v-for="m in getGroupMachines(i)" :key="m.code" class="machine-item">
            <input type="checkbox" :checked="isMachineSelected(i, m.code)" @change="toggleMachine(i, m)">{{ m.name }}
          </label>
        </div> -->
        <div class="machine-grid">
          <label v-for="m in getGroupMachines(i)" :key="m.code" class="machine-item" :class="{'disabled': isMachineDisabled(i, m.code),'conflict': isMachineConflict(i, m.code)}">
            <input type="checkbox" :checked="isMachineSelected(i, m.code)" @change="toggleMachine(i, m)" :disabled="isMachineDisabled(i, m.code)">{{ m.name }}
          </label>
        </div>
      </div>

      <div class="status-message-area">
  
        <div v-if="!hasAnyMachineGroup" class="hint empty">
          此適用工程目前沒有可用的機台群組，無需設定。
        </div>

        <div v-else-if="!blocks[i].data.metadata.groupCode" class="hint info">
          請先從上方選單選擇一個「機檯群組」。
        </div>

        <div v-else-if="blocks[i].data.metadata.machines.length === 0" class="hint warning">
          請勾選上方至少一台機台，系統將以「第一台」作為基準載入 PMS 表格。
        </div>

        <div v-else-if="pmsLoading[i]" class="hint loading">
          正在載入 PMS 參數與比對機台相容性...
        </div>

        <div v-else-if="pmsEmpty[i]" class="hint error">
          此基準機台尚無 PMS 設定資料，無法編輯。
        </div>

        <div v-else-if="paramEditors[i]" class="editor-container">
          <EditorContent :editor="paramEditors[i]" class="ed ed-param"/>
        </div>

      </div>

      <!-- 完全沒有機台群組：只顯示一行說明，整個 Step 視為「不需填寫」 -->
      <!-- <div v-else class="hint empty">此適用工程沒有任何機台群組，不需設定 PMS。</div> -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount, watch, computed } from 'vue'
import axios from 'axios'
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
import { CellSelection, selectedRect } from 'prosemirror-tables'

import {
  allocateProgramCode,
  releaseProgramCode,
  copySpecParamFromCode,
} from '@/api/docsApi'

/* ===== Props / Emits ===== */
const props = defineProps({
  dataBlocks: { type: Array, default: () => [] },     // [{ code, data:{ jsonParameterContent, arrayParameterData, metadata? }, ...}]
  itemType: { type: String, default: "" },
  specification: { type: [Array, Object], default: () => ([])}, // parent 給的製程 list
  currentStep: { type: Number, default: 0 },
  documentToken: { type: String, default: '' },       // 文件 token，用來配號
  allowColor: { type: Boolean, default: true },
});
const emit = defineEmits(['update:dataBlocks', 'save', 'machine-group-info']);

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

/* ===== TipTap setup (plain cells) ===== */
const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })]
const CustomTableCell = TableCell.extend({ addAttributes () { return { ...this.parent?.(), contenteditable: { default: true }, class: { default: null } } } })
const CustomTableHeader = TableHeader.extend({ addAttributes () { return { ...this.parent?.(), contenteditable: { default: true } } } })
const CustomTableRow = TableRow.extend({ addAttributes () { return { ...this.parent?.(), class: { default: null } } } })
const TExt = [Document.extend({ content: 'table' }), ...baseExt, Table, CustomTableRow, CustomTableHeader, CustomTableCell, History]

/* ===== Reactive state ===== */
const blocks = ref([])          // [{ id, code, data, meta:{group, machine, specCode?} }]
const paramEditors = ref([])    // Editor[]
const copyCode = ref('')
let idSeq = 0

const specGroupsMap = ref({});
const groupsSpecMap = ref({});
const groupMachinesMap = ref([]);
const pmsLoading = ref({});  // { [i]: boolean }
const pmsEmpty   = ref({});  // { [i]: boolean }

/* ===== MES: fetch & groups & machines ===== */
async function fetchGroups() {
  specGroupsMap.value = {};
  groupsSpecMap.value = {};
  if (props.specification.length == 0) return;

  try {
    const { data } = await axios.get(`${API_BASE_URL}/mes/spec-groups-machines`, { params: { specific: props.specification.map(s => s.code) } });
    specGroupsMap.value = data?.data?.specGroups || {};
    Object.entries(specGroupsMap.value).forEach(([specCode, groupCodes]) => {
      Object.keys(groupCodes).forEach(groupCode => { groupsSpecMap.value[groupCode] = specCode; })
    });
  } catch (e) { }
}

const groups = computed(() => {
  const merged = {};
  Object.entries(specGroupsMap.value).forEach(([specCode, groupCodes]) => {
    Object.entries(groupCodes).forEach(([groupCode, groupInfo]) => { merged[groupCode] = groupInfo; });
  });
  return merged;
})
const hasAnyMachineGroup = computed(() => Object.keys(groups.value || {}).length > 0);
const groupKeys = computed(() => Object.entries(groups.value));

/* ===== PMS table template ===== */
const LOCK_COLS = [0, 1, 2, 8];
function buildParamDocFromRows (rows) {
  const trows = rows.map((row, rIdx) => ({
    type: 'tableRow',
    content: row.map((txt, cIdx) => ({
      type: rIdx === 0 ? 'tableHeader' : 'tableCell',
      attrs: { contenteditable: (rIdx === 0 || LOCK_COLS.includes(cIdx)) ? false : true },
      content: [{ type: 'paragraph', content: txt ? [{ type: 'text', text: String(txt) }] : [] }],
    })),
  }))

  return { type: 'doc', content: [{ type: 'table', content: trows }] }
}

/* ===== Editor factory ===== */
function makeParamEditor (json, onUpdate) {
  if (!json) {
    console.warn('makeParamEditor called without json content, skip editor init')
    return null
  }

  return new Editor({
    content: json,
    extensions: TExt,
    editorProps: {
      handleDOMEvents: { drop: () => true, dragstart: () => true, copy: (view, event) => handleCopy(view, event), keydown: (view, event) => handleKeydown(view, event), paste: (view, event) => handlePaste(view, event), mousedown: (view, event) => handleMousedown(view, event) },
      handleKeyDown(view, event) {
        if (!['Backspace','Delete'].includes(event.key)) return false;
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
    onUpdate ({ editor }) {
      onUpdate?.(editor)
      syncToParent()
    },
  })
}
// Parse Excel/Word clipboard format 格式
function parseExcelClipboard(str) {
  // 移除字串末端多餘的換行
  str = str.replace(/(\r\n|\n|\r)$/, '');

  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuote = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = str[i+1];

    if (inQuote) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"'; // 雙引號跳脫
          i++; 
        } else {
          inQuote = false; // 結束引號
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === '\t') {
        currentRow.push(currentCell);
        currentCell = "";
      } else if (char === '\n' || (char === '\r')) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  return rows;
}
// Handle copy process (Ctrl + C)
function handleCopy(view, event) {
  const { state } = view;
  const sel = state.selection;
  if (!(sel instanceof CellSelection)) {
    const slice = sel.content();
    const text = slice.content.textBetween(0, slice.content.size, '\n', '\n');

    if (event.clipboardData) {
      event.clipboardData.setData('text/plain', text);
      event.preventDefault(); // 阻止 Tiptap 預設行為
      return true;
    }
    return false;
  }

  const rect = selectedRect(state);
  const table = rect.table;
  const rows = [];

  for (let r = rect.top; r < rect.bottom; r++) {
    const rowNode = table.child(r);
    const cols = Array.from({length: rect.right - rect.left}, (_, i) => i + rect.left).map(col => {
      const text = getText(rowNode.child(col)).replace(/"/g, '""');
      return `"${text}"`;
    })
    rows.push(cols.join('\t')); // 欄位用 Tab 分隔
  }

  const clipboardText = rows.join('\r\n');

  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', clipboardText);
    event.preventDefault();
    return true;
  }
  return false;
}
// Handle paste process (Ctrl + V)
function handlePaste(view, event) {
  const { state, dispatch } = view;
  const sel = state.selection;
  
  // 1. 取得並解析內容
  const raw = event.clipboardData?.getData('text/plain') || '';
  if (!raw) return false;

  const matrix = parseExcelClipboard(raw);
  if (!matrix.length) return true;

  // 2. 定位 Table & Row / 計算起點
  let tableNode = view.state.doc.content.firstChild;
  let startRowIndex = view.state.selection.$anchor.path[4];
  let startColIndex = view.state.selection.$anchor.path[7];

  if (!(sel instanceof CellSelection)) {
    let textToPaste = raw;

    textToPaste = textToPaste.replace(/(\r\n|\n|\r)+$/, '');

    if (textToPaste.length >= 2 && textToPaste.startsWith('"') && textToPaste.endsWith('"')) {
       textToPaste = textToPaste.slice(1, -1);
       textToPaste = textToPaste.replace(/""/g, '"');
    }

    textToPaste = textToPaste.replace(/\r\n/g, '\n');
    dispatch(state.tr.insertText(textToPaste));

    const anchorPath = view.state.selection.$anchor.path;
    if(anchorPath && anchorPath.length > 4) {
      const startRowIndex = anchorPath[4];
      paramEditors.value.forEach(ed=> ed && runParamValueValidation(ed));
      runParamDuplicateValidation();
    }

    // 阻止瀏覽器原生貼上 (避免重複)
    event.preventDefault(); 
    return true; 
  }

  const rect = selectedRect(state);
  startRowIndex = rect.top;
  startColIndex = rect.left;

  // [保護] 禁止貼在 Index 0
  if (startColIndex === 0 || startRowIndex < 0 || startColIndex < 0) return false;

  // 3. 紀錄貼上的欄位
  let M = view.state.selection.$anchor.node(1).childCount;
  let N = view.state.selection.$anchor.node(2).childCount;

  let rowsPos = [1];
  for(let rowIndex = 0; rowIndex < tableNode.childCount; rowIndex++) rowsPos.push(rowsPos.at(-1) + tableNode.content.child(rowIndex).nodeSize);

  const targets = [];
  range(startRowIndex, startRowIndex + matrix.length).forEach((rowIndex, rIndex) => {
    if (rowIndex >= M) return;

    const rowNode = view.state.selection.$anchor.node(1).content.child(rowIndex);
    const rowPos = rowsPos[rowIndex];
    const cells = rowNode.content;
    const sourceRowData = matrix[rIndex] || [];

    const cellPos = [rowPos + 1];
    for(let index = 0; index < N - 1; index++) cellPos.push(cellPos.at(-1) + cells.child(index).nodeSize);

    range(startColIndex, startColIndex + sourceRowData.length).forEach((colIndex, cIndex) => {
      if (colIndex >= N) return;
      const cellNode = cells.child(colIndex);
      targets.push({ cellPos: cellPos[colIndex], cellSize: cellNode.nodeSize, type: cellNode.type, attrs: cellNode.attrs, text: sourceRowData[cIndex].toString() });
    })
  })

  // 4. 從尾部節點開始更新欄位
  if (targets.length === 0) return true;
  targets.sort((a, b) => b.cellPos - a.cellPos);

  let tr = state.tr;
  const schema = state.schema;

  for (const t of targets) {
    const lines = t.text.split('\n');
    const contentNodes = lines.map(line => schema.nodes.paragraph.create({}, line ? [schema.text(line)] : []));
    const newCell = t.type.create(t.attrs, contentNodes);
    tr = tr.replaceWith(t.cellPos, t.cellPos + t.cellSize, newCell);
  }

  if (tr.docChanged) {
    dispatch(tr.scrollIntoView());
    paramEditors.value.forEach(ed=> ed && runParamValueValidation(ed));
    runParamDuplicateValidation();
  }

  event.preventDefault();
  return true;
}
// Handle mouse click for cell select
function handleMousedown(view, event) {
  if (event.target.closest('button')) return false;
    // 2. 找出點擊的儲存格 DOM
    const cellDOM = event.target.closest('td, th');
    if (!cellDOM) return false;

    // 3. 取得該儲存格在文件中的位置
    const pos = view.posAtDOM(cellDOM, 0);
    if (pos === null) return false;

    const cellPos = view.state.doc.resolve(pos).before(3);

    // 4. 判斷是否為「第二次點擊」(進入編輯模式)
    const { selection } = view.state;
    if (selection instanceof CellSelection) {
        // 如果已經單選了這一格，且再次點擊 -> 放行事件，讓使用者進入編輯模式
        if (selection.$anchorCell.pos === cellPos && selection.$headCell.pos === cellPos) {
            return false; 
        }
    }

    // [情境：第一次點擊] -> 手動實作「點擊選取」與「拖曳框選」
    view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, view.state.doc.resolve(cellPos).pos)));
    if (!view.hasFocus()) view.focus();
    event.preventDefault();

    // C. 手動啟動拖曳監聽 (因為 preventDefault 殺死了插件的拖曳功能)
    const startAnchorPos = cellPos;
    let currentHeadPos = cellPos;

    const moveHandler = (moveEvent) => {
      // 1. 找出滑鼠當前位置下的 Cell
      const posObj = view.posAtCoords({ left: moveEvent.clientX, top: moveEvent.clientY });
      if (!posObj) return;

      const $currPos = view.state.doc.resolve(posObj.pos);
      let foundCellPos = $currPos.before(3);

      // 2. 如果滑鼠移到了新的格子，且位置合法，更新選取範圍
      if (foundCellPos !== null && foundCellPos !== currentHeadPos) {
        currentHeadPos = foundCellPos;
        try {
          // 使用 CellSelection.create 自動計算矩形範圍
          // 注意：必須確保 anchor 和 head 在同一個 table 內，否則 create 會報錯，這裡用 try-catch 保護
          const newSelection = CellSelection.create(view.state.doc, startAnchorPos, foundCellPos);
          view.dispatch(view.state.tr.setSelection(newSelection));
        } catch (e) {
          // 跨表格拖曳或結構錯誤時忽略
        }
      }
    };

    const upHandler = () => {
      // 滑鼠放開時，移除監聽
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', upHandler);
    };

    // D. 掛載監聽器到 window (確保拖曳出表格也能感應)
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);

    // E. 回傳 true，表示我們完全接管了這個事件
    return true; 
}
// Handle keyboard event
function handleKeydown(view, event) {
  if (event.key !== 'Enter') return false;
  const rowIndex = view.state.selection.selection.$anchor.path[4];
  const colIndex = view.state.selection.selection.$anchor.path[7];

  if (rowIndex > 0  && [4, 5, 6, 7, 8].includes(colIndex)) {
    event.preventDefault();
    return true;
  }

  return false;
}

/* ===== PMS from MES ===== */
// forceReload: 是否強制重置表格 (例如切換基準機台時用 true；載入草稿時用 false)
const incompatibleSets = ref({});
async function updateBaselineDependencies(i, forceReload = false) {
  const blk = blocks.value[i];
  if (!blk.data.metadata.machines || blk.data.metadata.machines.length === 0) return [];

  const baseline = blk.data.metadata.machines[0];
  const logs = []; // 收集變更紀錄
  
  pmsLoading.value[i] = true;

  try {
    // 1. 呼叫後端 API (一次取得 相容清單 + 最新表格)
    const { data: res } = await axios.post(`${API_BASE_URL}/mes/pms/filter-by-pms-baseline`, { baseline_code: baseline });
    
    const validCodes = new Set(res?.data?.valid_machines || []);
    const latestPmsRows = res?.data?.pms_table_rows || [];
    // 2. 更新機台相容性 (反灰 & 紅底邏輯)
    const badSet = new Set();
    
    // ★ 修正：直接從全域資料找當前 Block 群組的機台
    const currentGroupCode = blk.data.metadata.groupCode;
    const currentGroupInfo = groups.value[currentGroupCode]; // groups 是 computed
    
    if (currentGroupInfo && currentGroupInfo.machines) {
      Object.values(currentGroupInfo.machines).forEach(m => {
        if (!validCodes.has(m.code)) badSet.add(m.code);
      });
    }
    incompatibleSets.value[blk.id] = badSet;

    // 檢查「已選機台」是否有不相容 (變更通知)
    const conflictMachines = blk.data.metadata.machines.filter(machineCode => badSet.has(machineCode));
    if (conflictMachines.length > 0) {
      logs.push(`⚠️ [Block ${i+1}] 偵測到不相容機台 (PMS 定義不同): ${conflictMachines.map(m=>m.name).join(', ')}`);
    }

    if (latestPmsRows.length === 0) {
      pmsEmpty.value[i] = true;
      // 若原本有編輯器，要銷毀，避免畫面顯示舊的或壞掉的編輯器
      if (paramEditors.value[i]) {
        paramEditors.value[i].destroy();
        paramEditors.value[i] = null;
      }
      // 直接結束函式，不再往下執行
      return logs;
    }

    // 3. PMS 表格同步 (Sync / Diff)
    const hasExistingData = paramEditors.value[i] || (blk.data.arrayParameterData && blk.data.arrayParameterData.length > 0);

    // ★ 定義驗證與更新的 Callback (避免重複寫)
    const onEditorUpdate = (editor) => {
      runParamValueValidation(editor);
      runParamDuplicateValidation();
    };
    
    if (!hasExistingData || forceReload) {
      // A. 若無資料 或 強制重載：直接套用最新表格
      const doc = buildParamDocFromRows(latestPmsRows);
      if (!paramEditors.value[i]) {
        paramEditors.value[i] = makeParamEditor(doc, onEditorUpdate);
      } else {
        paramEditors.value[i].commands.setContent(doc, false);
      }
      if (forceReload && hasExistingData) logs.push(`已依據新基準 (${baseline.name}) 重置表格內容。`);

    } else {
      // B. 若已有資料 (草稿載入)：執行比對
      let currentRows = paramEditors.value[i] ? extractTableArray(paramEditors.value[i]) : blk.data.arrayParameterData;
      const { rows: syncedRows, diffs } = syncPmsData(currentRows, latestPmsRows);
      const doc = buildParamDocFromRows(syncedRows);

      if (!paramEditors.value[i]) {
        // ★ 修正 1：同樣要傳入 callback
        paramEditors.value[i] = makeParamEditor(doc, onEditorUpdate);
      } else if (diffs) {
        // 只有在真的有差異時才更新內容，避免打斷使用者體驗
        // 如果只是單純載入舊資料且沒變，makeParamEditor 會處理
        if (diffs.added.length > 0 || diffs.removed.length > 0) {
          let msg = `⚠️ [Block ${i+1}] PMS 規格變更通知：\n`;
          if (diffs.added.length > 0)  msg += `[新增] ${diffs.added.length} 筆：\n  + ${diffs.added.join('\n      + ')}\n`;
          if (diffs.removed.length > 0) msg += `[移除] ${diffs.removed.length} 筆 (已自動刪除)：\n  - ${diffs.removed.join('\n      - ')}\n`;
          
          logs.push(msg);
          
          // 更新編輯器內容
          paramEditors.value[i].commands.setContent(doc, false);
        }
      }
    }

    // ★ 修正 2：資料塞完後，手動觸發一次驗證，讓顏色立刻出來
    // 使用 nextTick 確保 Tiptap 實例已就緒
    nextTick(() => {
      const ed = paramEditors.value[i];
      if (ed) {
        runParamValueValidation(ed);
        runParamDuplicateValidation();
      }
    });
  } catch (e) {
    console.error('updateBaselineDependencies error', e);
    // ★ 修正：發生錯誤時，標記為 Empty 或顯示錯誤，避免畫面留白
    pmsEmpty.value[i] = true; 
  } finally {
    pmsLoading.value[i] = false;
  }

  return logs;
}
/* ===== Helper: PMS 同步與比對邏輯 ===== */
// savedRows: 使用者存檔的資料 (二維陣列)
// templateRows: 從後端撈回來的最新標準 (二維陣列)
function syncPmsData(savedRows, templateRows) {
  if (!templateRows || templateRows.length === 0) return { rows: null, diffs: null };
  if (!savedRows || savedRows.length === 0) return { rows: templateRows, diffs: null };

  if (savedRows[0][0] != "項次") savedRows = savedRows.map((row, index) => [(index == 0) ? "項次" : index.toString(), ...row]);

  // 1. 建立舊資料 Map (Key: 槽體-管理項目) Index 1=槽體, 2=管理項目
  const savedMap = new Map();
  const newRows = [templateRows[0]];
  const added = [];
  savedRows.slice(1).forEach(row => { savedMap.set(`${row[1]}-${row[2]}`, row); })
  templateRows.slice(1).forEach((row, index) => {
    const key = `${row[1]}-${row[2]}`;
    const savedRow = savedMap.get(key);

    if (savedRow) {
      savedMap.delete(key);
      newRows.push( [(index + 1).toString(), ...savedRow.slice(1)]);
    }
    else {
      added.push(`${tmplRow[0]}-${tmplRow[1]}`);
      newRows.push([(index + 1).toString(), ...row.slice(1)]);
    }
  })

  const removed = Array.from(savedMap.values()).map(r => `${r[1]} - ${r[2]}`);
  return { rows: newRows, diffs: (added.length > 0 || removed.length > 0) ? { added, removed } : null };
}

function addBlock () {
  const id = idSeq++;
  blocks.value.push({ id, code: '', data: { metadata: { specCode: "", machines: [], machines_name: [], processOrder: [], groupCode: "", groupName: "", programs: [] } } });
  pmsLoading.value[id] = false;
  pmsEmpty.value[id] = false;
  syncToParent();
}
async function delBlock (i) {
  if (blocks.value.length === 1) return alert('至少需要保留一個組合')
  if (!confirm('確定要刪除此組合嗎？')) return

  const code = blocks.value[i]?.code
  if (code) {
    try {
      await releaseProgramCode(code)
    } catch (e) {
      console.error('releaseProgramCode failed:', e)
    }
  }

  paramEditors.value[i]?.destroy()
  blocks.value.splice(i, 1)
  paramEditors.value.splice(i, 1)

  nextTick(() => {
    runAllValidations();
    // ★ 修正：刪除後必須通知父層
    syncToParent();
  });
}

// 複製模塊：copy table JSON + meta，**一定重新配一個新的 programCode**
async function duplicateBlock (i) {
  blocks.value.push({ id: idSeq++, code: '', data: { jsonParameterContent: paramEditors.value[i]?.getJSON(), metadata: { ...(blocks.value[i].data?.metadata || {}) } } });

  const newIdx = blocks.value.length - 1;
  const b = blocks.value[newIdx];
  const g = b.data.metadata.groupCode || '';
  const specCode = groupsSpecMap.value[g];

  if (b.data?.jsonParameterContent) {
    paramEditors.value[newIdx] = makeParamEditor(
      b.data.jsonParameterContent,
      (editor) => {
        runParamValueValidation(editor);
        runParamDuplicateValidation();
      },
    )
  }

  if (g) allocateNewCode(newIdx);
  nextTick(() => {
    runAllValidations();
    // ★ 修正：複製後必須通知父層
    syncToParent();
  });
}

/* ===== Copy from 已簽核規格書 (Spec) ===== */
/* ===== Copy Logic ===== */
async function copyFromCode(i) {
  const blk = blocks.value[i];
  const machines = blk.data.metadata.machines;
  
  // 0. 前端驗證：必須先選擇機台群組
  if (machines.length == 0) {
    alert("請先選擇「機檯」，才能進行參數複製。");
    return;
  }

  // 取得使用者輸入的來源代碼
  // 注意：這裡假設 copyCode 是綁定在該 block 上的變數，或是全域變數
  // 如果是全域變數，請確認是否正確取得。這裡假設您在 template 中是用 v-model="copyCode" 綁定在 component scope
  // 但根據您的 template 結構，copyCode 似乎是 v-for loop 外的變數？
  // 如果 copyCode 是每個 block 獨立的，請將其移入 blocks[i] 資料結構中。
  // 這裡暫時假設您有一個 ref 叫 copyCode (全域) 或者您在 loop 裡使用 (但這會導致所有 block 共用一個輸入框)
  // **建議修正**：將 copyCode 放入 blocks 結構中，例如 blocks[i].copyCodeInput
  
  const sourceCode = copyCode.value; // 若 copyCode 是全域 ref
  console.log("sourceCode: ", sourceCode);
  // const sourceCode = blk.copyCodeInput; // 若您將其改為 block 屬性 (推薦)

  if (!sourceCode) {
    alert("請輸入要複製的來源代碼");
    return;
  }

  try {
    pmsLoading.value[i] = true;

    const res = await axios.post(`${API_BASE_URL}/docs/parameters/copy-spec-source`, { program_code: sourceCode, machines: blk.data.metadata.machines });

    if (res.status != 200) {
      alert(res.data.data.message || "複製失敗");
      return;
    }

    // 2. 處理回傳結果
    const { param_array, metadata, add_params, del_params } = res.data.data.blocks;

    if (add_params.length == 0 && del_params.length == 0) {
      applyCopiedData(i, param_array, []); 
      alert("複製成功！");
    }
    else {
        // source_data 應該已經是後端根據 Target PMS 調整過後的資料 (只保留 Key 相同的數值)
        // diffs 包含 added / removed 資訊
        applyCopiedData(i, source_data, diffs);
        
        // 組合提示訊息
        let msg = "複製成功，但來源與目標機台的 PMS 規範不完全一致。\n系統已自動調整欄位：\n";
        if (add_params.length) msg += `\n[新增] (來源無，目標有 - 留空):\n` + diffs.added.join('\n');
        if (del_params.length) msg += `\n\n[移除] (來源有，目標無 - 捨棄):\n` + diffs.removed.join('\n');
        alert(msg);
    }

  } catch (e) {
    console.error(e);
    alert(e.response?.data?.message || "複製過程中發生錯誤");
  } finally {
    pmsLoading.value[i] = false;
  }
}

// 輔助函式：將資料套用到編輯器
function applyCopiedData(index, sourceRows, diffs) {
  console.log("sourceRows: ", sourceRows);
  if (!paramEditors.value[index]) {
      return;
  }

  console.log("sourceRows: ", sourceRows);

  // 寫入編輯器
  const doc = buildParamDocFromRows(sourceRows);
  paramEditors.value[index].commands.setContent(doc, true); // true = emit update
  
  // 觸發驗證 (重新上色)
  nextTick(() => {
      runParamValueValidation(paramEditors.value[index]);
  });
}

/* ===== Event handlers ===== */
/* ===== [新增] 機台列表 Helper ===== */

// 取得目前 Block 所選群組下的所有機台
function getGroupMachines(i) {
  const gCode = blocks.value[i].data.metadata.groupCode;
  if (!gCode || !groups.value[gCode]) return [];
  return groups.value[gCode].machines || [];
}
// 判斷是否已勾選
function isMachineSelected(i, mCode) { return blocks.value[i].data.metadata.machines.some(machineCode => machineCode == mCode); }
// 判斷是否應該反灰 (不相容且未選 -> 禁止選取)
function isMachineDisabled(i, mCode) {
  const badSet = incompatibleSets.value[blocks.value[i].id];
  const isSelected = isMachineSelected(i, mCode);
  
  // 如果在壞名單裡，且目前沒被選 -> 反灰禁止選
  // (如果已被選，雖然是壞的，但要保持可操作讓使用者取消，所以不 disable)
  return badSet && badSet.has(mCode) && !isSelected;
}

// 判斷是否衝突 (不相容但已選 -> 標紅)
function isMachineConflict(i, mCode) {
  const badSet = incompatibleSets.value[blocks.value[i].id];
  const isSelected = isMachineSelected(i, mCode);
  
  // 在壞名單裡，且目前是被選中的 -> 衝突狀態 (標紅)
  return badSet && badSet.has(mCode) && isSelected;
}
/* ===== [修正] 勾選/取消單一機台 (取代原本的 onMachineCheck) ===== */
async function toggleMachine(i, machine) {
  const blk = blocks.value[i];
  const machines = blk.data.metadata.machines;
  const machinies_name = blk.data.metadata.machines_name;

  if (!machines.some(machineCode => machineCode == machine.code)) {
    machines.push(machine.code); // 加入
    machinies_name.push(machine.name);
    if (machines.length === 1) await updateBaselineDependencies(i, true);
  } else {
    const idx = machines.findIndex(machineCode => machineCode == machine.code);
    machines.splice(idx, 1);
    machinies_name.splice(idx, 1);
    if (machines.length == 0) {
      incompatibleSets.value[blk.id] = new Set();
      if (paramEditors.value[i]) paramEditors.value[i].commands.setContent(buildParamDocFromRows([[]]));
    }
  }

  syncToParent();
}
/* 1. 全選：只選合法的，但需先確認是否有基準 */
async function selectAllMachines(i) {
  const blk = blocks.value[i];
  const machines = blk.data.metadata.machines;
  const machines_name = blk.data.metadata.machines_name;

  // 如果目前是空的，必須先加入第一台當作基準，並執行一次篩選
  if (machines.length === 0) {
    machines.push(groupMachinesMap.value[0].code);
    machines.push(groupMachinesMap.value[0].name);
    // 這是建立基準，必須呼叫
    await updateBaselineDependencies(i, true);
  }
  
  // 之後就只在前端操作，不需再呼叫 API
  const badSet = incompatibleSets.value[blk.id] || new Set();
  const newSelection = [...machines]; // 複製目前的 (包含剛剛加的基準)
  const newSelectionName = [...machines_name];
  
  for (const machineInfo of Object.values(groupMachinesMap.value)) {
    // 跳過已選 & 跳過不相容
    if (newSelection.some(machineCode => machineCode === machineInfo.code)) continue;
    if (badSet.has(machineInfo.code)) continue;
    newSelection.push(machineInfo.code);
    newSelectionName.push(machineInfo.name);
  }
  
  blk.data.metadata.machines = newSelection;
  blk.data.metadata.machines_name = newSelectionName;
  syncToParent()
}
/* 2. 全部取消：純前端操作，不呼叫 API */
function deselectAllMachines(i) {
  const blk = blocks.value[i];
  
  // 清空資料
  blk.data.metadata.machines = [];
  blk.data.metadata.machines_name = [];
  blk.data.metadata.programs = [];
  blk.code = '';
  
  // ★ 直接清空反灰狀態，不需要問後端
  incompatibleSets.value[blk.id] = new Set()
  
  // 清空編輯器
  if (paramEditors.value[i]) {
     paramEditors.value[i].commands.setContent(buildParamDocFromRows([[]]));
  }
  
  // 狀態重置
  pmsLoading.value[i] = false;
  pmsEmpty.value[i] = false;
  
  syncToParent();
}

/* ===== [新增] 流程順序相關邏輯 ===== */
const openProcessOrderMenu = ref(null); // 紀錄目前哪一個 block 的選單是打開的
function toggleProcessMenu(i) {
  openProcessOrderMenu.value = (openProcessOrderMenu.value === i) ? null : i;
}
// [新增] 智慧型的失焦處理
function onFocusOut(i, event) {
  // event.currentTarget 是綁定事件的元素 (即 .custom-select div)
  // event.relatedTarget 是焦點即將前往的元素 (例如內部的 checkbox，或是外部的其他元件)
  
  // 如果新的焦點 (relatedTarget) 依然在目前的元件 (currentTarget) 內部，
  // 代表使用者只是點了 checkbox 或捲軸，不應該關閉選單。
  if (event.currentTarget.contains(event.relatedTarget)) {
    return;
  }

  // 否則，真的點到外面去了，關閉選單
  if (openProcessOrderMenu.value === i) {
    openProcessOrderMenu.value = null;
  }
}
function closeProcessMenu(i) {
  if (openProcessOrderMenu.value === i) {
    openProcessOrderMenu.value = null;
  }
}
// 取得該 Block 對應 Spec 的 step_count
function getStepCount(i) {
  const blk = blocks.value[i];
  const g = blk.data.metadata.groupCode;
  if (!g) return 0;
  
  // 透過 group 找到 specCode
  const specCode = groupsSpecMap.value[g];
  if (!specCode) return 0;

  // 在 props.specification 陣列中找到對應的物件
  // 假設 props.specification 是 [{ code: '...', step_count: 5 }, ...]
  const spec = Array.isArray(props.specification) 
    ? props.specification.find(s => s.code === specCode)
    : null;

  return spec ? (spec.step_count || 1) : 1; 
}
// 切換選取的數字
function toggleProcessOrder(i, step) {
  const blk = blocks.value[i];
  if (!blk.data.metadata.processOrder) {
    blk.data.metadata.processOrder = [];
  }
  
  const list = blk.data.metadata.processOrder;
  const idx = list.indexOf(step);
  
  if (idx > -1) {
    list.splice(idx, 1); // 取消選取
  } else {
    list.push(step); // 加入選取
    list.sort((a, b) => a - b); // 保持數字排序
  }
  
  syncToParent();
}

// Assign new program code to replace old one, reset machine and editor
async function onGroupChange (i) {
  const b = blocks.value[i];
  const g = b.data.metadata.groupCode || '';
  groupMachinesMap.value = [...specGroupsMap.value[groupsSpecMap.value[g]][g].machines];

  // 釋放舊號碼
  if (b.code) {
    try { await releaseProgramCode(b.code.split("-").at(-1)); } catch (e) {}
    b.code = '';
  }

  // 清掉機台 & editor & PMS 狀態
  b.data.metadata.machines = [];
  b.data.metadata.machines_name = [];
  b.data.metadata.processOrder = []; // [新增] 切換群組時重置流程順序
  b.data.metadata.specCode = '';  // 重新由 group 推 specCode
  if (paramEditors.value[i]) {
    paramEditors.value[i].destroy();
    paramEditors.value[i] = null;
  }
  pmsLoading.value[i] = false;
  pmsEmpty.value[i]   = false;

  // 有選群組 → 直接配號
  if (g) {
    // ★ [新增] 自動判斷：若只有 1 個步驟，自動幫選 "1"
    const count = getStepCount(i);
    incompatibleSets.value[b.id] = new Set();
    if (count === 1) {
      b.data.metadata.processOrder = [1];
    }
    allocateNewCode(i);
  }
  syncToParent();
}
// Assign new program code for block
async function allocateNewCode(i) {
  const b = blocks.value[i];
  const g = b.data.metadata.groupCode || '';
  const specCode = groupsSpecMap.value[g];

  try {
    const res = await allocateProgramCode(specCode, props.documentToken);
    blocks.value[i].code = `${props.itemType}-${res.programCode}`;
    blocks.value[i].data.metadata.programs = [{specCode: res.specCode, programCode: res.programCode}];
  } catch (e) {
    console.error('allocateProgramCode failed:', e);
    alert('程式號碼配號失敗，請稍後再試');
    blocks.value[i].code = '';
  }
}

/* ===== Validations ===== */
function runParamDuplicateValidation() {
  const sigMap = new Map();
  paramEditors.value.forEach((ed, idx) => {
    if (!ed) return;
    const sig = JSON.stringify(ed.state.doc.content.firstChild.content.content.slice(1).map(rowNode => (rowNode.content.content.slice(2, 7).map(cellNode => getText(cellNode)))));

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
    const { state, view } = paramEditors.value[idx];
    const tr = state.tr;
    const N = state.doc.content.firstChild.content.childCount;

    let rowsPos = [1];
    for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
    for(let rowIndex = N - 1; rowIndex > 0; rowIndex--) {
      tr.setNodeMarkup(rowsPos[rowIndex], undefined, { ...rowsPos[rowIndex].attrs, class: 'dup-table' });
    }
    if(tr.docChanged) view.dispatch(tr);
  })

  uniIdx.forEach(idx => {
    const { state, view } = paramEditors.value[idx];
    const tr = state.tr;
    const N = state.doc.content.firstChild.content.childCount;

    let rowsPos = [1];
    for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
    for(let rowIndex = N - 1; rowIndex > 0; rowIndex--) {
      tr.setNodeMarkup(rowsPos[rowIndex], undefined, { ...rowsPos[rowIndex].attrs, class: '' });
    }
    if(tr.docChanged) view.dispatch(tr);
  })
}
const range = (a, b) => Array.from({length: b - a}, (v, i) => i + a);
const getText = cellNode => {
  const paragraphs = cellNode.content?.content || [];
  return (cellNode.attrs.cellType === 'dropdown') ? cellNode.attrs.dropdownValue || "" : paragraphs.map(pNode => { return (pNode.content?.content || []).map(textNode => textNode.text || '').join('') }).join('\n');
}
function runParamValueValidation (ed) {
  if (!ed) return;
  const { state, view } = ed; let tr = state.tr;
  let changed = false;
  
  const N = state.doc.content.firstChild.content.childCount;
  let rowsPos = [1];
  for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
  for(let rowIndex = N - 1; rowIndex > 0; rowIndex--){
    if (rowIndex >= state.doc.content.firstChild.content.childCount) return;
    const rowNode = state.doc.content.firstChild.content.child(rowIndex);
    const rowPos = rowsPos[rowIndex];
    const cells = rowNode.content;

    const cellPos = [rowPos + 1];
    const value = [];
    const valueStatus = [];
    for(let index = 0; index < cells.childCount - 1; index++) cellPos.push(cellPos.at(-1) + cells.child(index).nodeSize);

    for(let index = 3; index < 8; index++) {
      const txt = getText(cells.child(index));
      let status = 'empty';
      let val = Number(txt);

      if (txt) status = (Number.isNaN(val)) ? 'invalid' : 'valid';
      
      value.push(val);
      valueStatus.push(status);
    }

    const validIndices = [0, 1, 2, 3, 4].filter(i => valueStatus[i] === 'valid');
    if (validIndices.length > 1){
      let maxSoFar = value[validIndices[0]];
      for (let i = 1; i < validIndices.length; i++) {
          const item = value[validIndices[i]];
          if (item < maxSoFar) valueStatus[validIndices[i]] = 'invalid';
          else maxSoFar = item;
      }

      let minSoFar = value[validIndices.at(-1)];;
      for (let i = validIndices.length - 2; i >= 0; i--) {
          const item = value[validIndices[i]];
          if (item > minSoFar) valueStatus[validIndices[i]] = 'invalid';
          else minSoFar = item;
      }
    }

    if (valueStatus.filter(status => status == 'empty').length != 5) {
      valueStatus[1] = (valueStatus[1] == 'invalid') ? 'invalid' : 'valid';
      valueStatus[3] = (valueStatus[3] == 'invalid') ? 'invalid' : 'valid';
      if (valueStatus[2] == 'empty') {
        valueStatus[0] = (valueStatus[0] == 'invalid') ? 'invalid' : 'valid';
        valueStatus[2] = (valueStatus[2] == 'invalid') ? 'invalid' : 'valid';
        valueStatus[4] = (valueStatus[4] == 'invalid') ? 'invalid' : 'valid';
      }
    }

    for (let offset = 4; offset >= 0; offset--) {
      const cellNode = cells.child(3 + offset);
      const newClass = 'value-' + valueStatus[offset];

      if (cellNode.attrs.class === newClass) continue;

      const newAttrs = { ...cellNode.attrs, class: newClass };
      tr.setNodeMarkup(cellPos[3 + offset], cellNode.type, newAttrs, cellNode.marks);
      changed = true;
    }
  }
  if (changed) view.dispatch(tr);
}
function runAllValidations () {
  paramEditors.value.forEach(ed => ed && runParamValueValidation(ed))
  runParamDuplicateValidation()
}

/* ===== Export / sync to parent (沿用舊版，補上 group/machineName) ===== */
function extractTableArray (ed) {
  return (!ed) ? [] : ed.state.doc.content.firstChild.content.content.map(rowNode => (rowNode.content.content.map(cellNode => getText(cellNode))));
}

function exportData () {
  // console.log("export Data: ", blocks.value);
  return blocks.value.map((b, i) => {
    const ed = paramEditors.value[i];
    return { code: b.code, id: b.id, data: { jsonParameterContent: ed?.getJSON() || null, arrayParameterData: extractTableArray(ed), paramHeaderText: b.code, metadata: b.data.metadata } }
  })
}

let emitTimer = null
function syncToParent () {
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => emit('update:dataBlocks', exportData()), 120);
}

// 監聽 specification 的變化 (使用 deep: true)
watch(
  () => props.specification,
  async (newVal, oldVal) => {
    // 1. 產生簽名用來比對內容是否真的變更 (因為 deep watch 或是物件 reference 有時會誤判)
    const newSig = JSON.stringify(newVal || []);
    const oldSig = JSON.stringify(oldVal || []);

    // 2. 判斷是否為初始化 (舊值為 undefined 通常代表第一次掛載)
    // 但更保險的方式是看目前 blocks 是否為空
    if (blocks.value.length === 0) {
      // --- 情境 A：初始化 / 載入草稿 ---
      // 此時不需要釋放號碼，而是將資料填入
      await initializeBlocks();
    } 
    else if (newSig !== oldSig) {
      // --- 情境 B：使用者修改了適用工程 (且目前已有區塊資料) ---
      console.log("偵測到適用工程變更，正在重置區塊並釋放號碼...");

      // A. 釋放所有現有 Block 的程式號碼
      // 使用 Promise.all 確保所有釋放 API 都呼叫出去
      await Promise.all(blocks.value.map(async (b) => {
        if (b.code) {
          try {
            // 釋放號碼 (假設 b.code 格式正確，或 API 會處理)
            await releaseProgramCode(b.code); 
          } catch (e) {
            console.error(`釋放程式號碼失敗 ${b.code}:`, e);
          }
        }
      }));

      // B. 清空編輯器實例 (避免記憶體洩漏)
      paramEditors.value.forEach(ed => ed?.destroy());
      paramEditors.value = [];

      // C. 清空區塊資料與狀態
      blocks.value = [];
      pmsLoading.value = {};
      pmsEmpty.value = {};
      incompatibleSets.value = {}; // 清空相容性檢查暫存

      // D. 重新根據新的 specification 撈取機台群組
      await fetchGroups();

      // E. 新增一個全新的空白區塊 (讓使用者重新開始)
      addBlock();
    }
  },
  { immediate: true, deep: true }
);

/* ===== Mount / Unmount ===== */
function ProcessTable(doc) {
  // 防呆檢查：確認 doc 結構正確
  if (!doc || !doc.content || !doc.content[0]) return;
  const table = doc.content[0];
  if (table.type !== 'table') return;
  
  const rows = table.content;
  if (!rows || rows.length === 0) return;

  // 輔助函式：從 JSON 結構中讀取 Cell 文字
  const getCellText = (cell) => {
    if (!cell || !cell.content) return '';
    return cell.content.map(p => {
      return (p.content || []).map(t => t.text || '').join('');
    }).join('');
  };

  // 檢查標題列第一欄
  const headerRow = rows[0];
  if (!headerRow.content || headerRow.content.length === 0) return;
  
  const firstHeaderCell = headerRow.content[0];
  const firstHeaderText = getCellText(firstHeaderCell);

  // 如果第一欄是「槽體」，代表是舊資料，需要插入「項次」
  if (firstHeaderText === '槽體') {
    // 1. 插入標題格
    const newHeaderCell = {
      type: 'tableHeader',
      attrs: { contenteditable: false, colspan: 1, rowspan: 1, colwidth: null },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '項次' }] }]
    };
    headerRow.content.unshift(newHeaderCell);

    // 2. 插入資料格 (序號)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.content) row.content = [];
      
      const newCell = {
        type: 'tableCell',
        attrs: { contenteditable: false, colspan: 1, rowspan: 1, colwidth: null, class: null },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: String(i) }] }]
      };
      row.content.unshift(newCell);
    }
  }
}

// 核心初始化函式：負責還原資料並執行 PMS 比對
async function initializeBlocks() {
  // 1. 確保機台清單已載入 (供比對用)
  // 如果 specGroupsMap 還是空的，先去撈
  if (Object.keys(specGroupsMap.value).length === 0) {
    await fetchGroups();
  }

  // 2. 還原資料 (如果有傳入 dataBlocks)
  if (props.dataBlocks && props.dataBlocks.length > 0) {
    blocks.value = [...props.dataBlocks];
    blocks.value.forEach(blk => {
      if (blk.data.metadata.programs.length > 0) blk.code = blk.data.metadata.programs[0].programCode;
    })
    idSeq = blocks.value.length + 1;

    // 3. 並行處理：初始化編輯器 + PMS 同步檢查
    const results = await Promise.all(
      blocks.value.map(async (b, i) => {
        // A. 還原編輯器內容
        if (b.data?.jsonParameterContent) {
          ProcessTable(b.data.jsonParameterContent);
          paramEditors.value[i] = makeParamEditor(
            b.data.jsonParameterContent,
            (editor) => {
              runParamValueValidation(editor);
              runParamDuplicateValidation();
            }
          );
        }

        // B. 執行 PMS 比對 (如果是舊資料)
        if (b.data.metadata.machines.length > 0) {
          // false = 載入模式 (保留舊值，比對結構)
          const logs = await updateBaselineDependencies(i, false);
          return logs || [];
        }
        return [];
      })
    );

    // 4. 通知變更
    const allLogs = results.flat();
    if (allLogs.length > 0) {
      alert(`載入草稿時偵測到機台規範變更，系統已自動調整表格內容：\n\n${allLogs.join('\n')}`);
    }

  } 
  else if (blocks.value.length === 0) {
    addBlock();
  }
}

/* ===== Watchers ===== */
// 監聽 props.dataBlocks 變化，處理非同步載入
watch(
  () => props.dataBlocks,
  async (newVal) => {
    // ★ 關鍵修正：加上 blocks.value.length === 0 的判斷
    // 只有當「目前本地沒有資料」且「外部傳入了新資料」時，才執行初始化
    // 這樣可以防止：編輯器打字 -> syncToParent -> props 更新 -> watch 觸發 -> 重新初始化的迴圈
    if (newVal && newVal.length > 0 && blocks.value.length === 0) {
      await initializeBlocks();
    }
  },
  { immediate: true, deep: true }
);

// onMounted 只需要做最基礎的檢查，或者留空 (因為 watch immediate 已經做了)
onMounted(async () => {
  // 這裡可以留空，或者再次確保 fetchGroups 有跑
  if (Object.keys(specGroupsMap.value).length === 0) {
    await fetchGroups();
  }
});

onBeforeUnmount(() => {
  const payload = exportData()
  emit('save', payload)
  paramEditors.value.forEach(e => e?.destroy())
})

/* ===== expose (optional) ===== */
defineExpose({ exportData })
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
.machine-list-panel {
  background: #f8f9fa;
  border: 1px solid #eee;
  border-top: none;
  padding: 10px;
  border-radius: 0 0 6px 6px;
  margin-bottom: 10px;
}
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
/* [新增] 機台狀態樣式 */
.machine-item.disabled {
  opacity: 0.5;
  pointer-events: none; /* 禁止點擊 */
  color: #999;
}

.machine-item.conflict {
  background-color: #ffebee; /* 淺紅背景 */
  border: 1px solid #ef5350;
  color: #d32f2f;
  border-radius: 4px;
  padding: 0 4px; /* 稍微推開一點 */
}

/* 讓 Checkbox 在 conflict 狀態下依然可點 (讓使用者可以取消勾選) */
.machine-item.conflict input {
  cursor: pointer;
}

/* [新增] 客製化多選下拉選單樣式 */
.custom-select {
  position: relative;
  display: inline-block;
  width: 160px;
  vertical-align: middle;
  outline: none; /* 移除 focus 邊框 */
  background: #fff;
}

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

.select-trigger .arrow {
  font-size: 10px;
  margin-left: 6px;
  color: #666;
}

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

.option-item {
  display: block;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
}

.option-item:hover {
  background-color: #f0f8ff;
}

.option-item input {
  margin-right: 8px;
  vertical-align: middle;
}

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
.ed :deep(col:nth-child(1)) { width: 40%; }
.ed :deep(col:nth-child(2)) { width: 75%; }
.ed :deep(col:nth-child(3)) { width: 100%; }
.ed :deep(col:nth-child(4)) { width: 100%; }
.ed :deep(col:nth-child(5)) { width: 100%; }
.ed :deep(col:nth-child(6)) { width: 100%; }
.ed :deep(col:nth-child(7)) { width: 100%; }
.ed :deep(col:nth-child(8)) { width: 100%; }
.ed :deep(col:nth-child(9)) { width: 33%; }
.ed :deep(col:nth-child(10)) { width: 100%; }
.hint{ padding:12px; color:#555; background:#f8f9fb; border:1px dashed #cfd8dc; border-radius:6px; margin:8px 0 }
.hint.empty{ color:#9e9e9e; text-align:center; }
.menu-error { background: #ffcdd2; border-color: #f44336; }
</style>
