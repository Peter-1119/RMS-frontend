<template>
  <div class="blk-wrap">
    <button class="btn add" @click="addBlock" :disabled="!_condTemplate && !_paramTemplate">新增下一層</button>

    <div v-for="(blk, blkIndex) in localBlockContents" :key="blk.id" class="blk">
      <div class="blk-hd">  <!-- 製程多選 -->
        <div class="spec-select">
          <label>製程：</label>
          <div class="spec-multi">
            <div class="spec-multi-trigger" :class="{ 'step-error': (_condTemplate || _paramTemplate) && (!blk.data[0]?.metadata?.programs || blk.data[0]?.metadata?.programs?.length === 0) }" @click="toggleSpecDropdown(blkIndex)">
              <span v-if="!_condTemplate && !_paramTemplate">無製程選擇</span>
              <span v-else-if="blk.data[0]?.metadata?.programs?.length > 0">{{ blk.data[0].metadata.programs.map(specInfo => specInfo.specCode).join('、') }}</span>
              <span v-else class="placeholder">請選擇製程（可多選）</span>
              <span class="caret">▼</span>
            </div>
            <div v-if="(_condTemplate || _paramTemplate) && openSpecDropdownIndex === blkIndex" class="spec-multi-panel">
              <label v-for="opt in props.specOptions" :key="opt.code" class="spec-option">
                <input type="checkbox" :value="opt.code" :checked="isSpecChecked(blkIndex, opt.code)" @change="onToggleSpec(blkIndex, opt)"/>
                <span>{{ opt.name || opt.code }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 右邊：複製參數代碼 / block 操作 -->
        <div class="copybox">
          <label>參數代碼：</label>
          <input v-model="blk.data[0].metadata.copyCode" placeholder="輸入要複製的代碼" />
          <button class="btn info" @click="copyFromCode(blkIndex)">複製</button>
        </div>
        <div class="ops">
          <button class="btn info" @click="addBlock" :disabled="!_condTemplate && !_paramTemplate">新增同層</button>
          <button class="btn info" @click="duplicateBlock(blkIndex)">複製模塊</button>
          <button class="btn danger" @click="delBlock(blkIndex)">刪除</button>
        </div>
      </div>

      <!-- 被選擇的製程 + 程式號碼 tag -->
      <div v-if="blk.data[0]?.metadata?.programs?.length > 0" class="program-tags">
        <div v-for="specInfo in blk.data[0].metadata.programs" :key="specInfo.programCode" class="program-tag">
          <span class="tag-spec">{{ specInfo.specName || specInfo.specCode }}</span>
          <span class="tag-code">{{ specInfo.programCode || '尚未配號' }}</span>
          <button type="button" class="tag-remove" @click="removeProgram(blkIndex, specInfo)" title="移除此製程與程式號碼">✕</button>
        </div>
      </div>

      <!-- ★ 兩邊都沒有資料：只顯示這句 -->
      <div v-if="!_condTemplate && !_paramTemplate" class="hint empty">選擇的機台無任何參數</div>

      <!-- 下面條件 / PMS table 原樣保留 -->
      <template v-else>
        <div v-if="_condTemplate">
          <div v-if="condEditors[blkIndex]" class="menu right">
            <div v-if="allowColor" class="r">
              <i class="dot blue" @click="setCellColor(blkIndex, '#0000ff')"></i>
              <i class="dot black" @click="setCellColor(blkIndex, '#000000')"></i>
            </div>
          </div>
          <EditorContent v-if="condEditors[blkIndex]" :editor="condEditors[blkIndex]" class="ed ed-cond"/>
        </div>
        <p v-else class="hint empty">此機台無條件參數</p>

        <div v-if="_paramTemplate">
          <div v-if="paramEditors[blkIndex]" class="menu right">
            <div v-if="allowColor" class="r">
              <i class="dot blue" @click="paramEditors[blkIndex].chain().focus().setColor('#0000ff').run()"></i>
              <i class="dot black" @click="paramEditors[blkIndex].chain().focus().setColor('#000000').run()"></i>
            </div>
          </div>
          <EditorContent v-if="paramEditors[blkIndex]" :editor="paramEditors[blkIndex]" class="ed ed-param"/>
        </div>
        <p v-else class="hint empty">此機台無PMS資料</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount, reactive } from 'vue'
import { v1 as uuidv1 } from 'uuid';
import { EditorContent, Editor } from '@tiptap/vue-3'
import { Focus } from '@tiptap/extensions'
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
import { parseCondTemplate, parseParamTemplate } from '@/utils/tiptapTableUtils'

import { getText, getListText, handleCopy, handlePaste, handleMousedown, handleKeyDown, validateValueStatus } from '@/utils/tiptapTableUtils.js'
import { copyMcrFromCode, allocateProgramCode, releaseProgramCode } from '@/api/docsApi'

// ==========================================
// 1. Emit and props Function
// ==========================================
const emit = defineEmits(['update-cond', 'update-param', 'update-block', 'invalid-check']);
const props = defineProps({
  dataBlocks: { type: Array, required: true },
  specOptions: { type: Array, default: () => [] },
  allowColor: {type: Boolean, default: true},
  documentToken: { type: String, default: '' },
  machine: { type: String, required: '' },
})

// ==========================================
// 2. Editor Declare & Tiptap Extension Presets & Helper Function
// ==========================================
let _condTemplate = ref(null);
let _paramTemplate = ref(null);
let condEditors = reactive([]);
let paramEditors = reactive([]);
let localBlockContents = ref([]);

const Base = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })];
const Hdr = TableHeader.extend({ addAttributes() { return { ...(this.parent?.() || {}), cellType:{default:'text'}, contenteditable:{ default: false } } } });
const Row = TableRow.extend({ content: '(tableCell | tableHeader | actionCell)*', addAttributes() { return { ...(this.parent?.() || {}), class: { default: null } } } })

// Render add and delete row button
const ActionCell = TableCell.extend({
  name: 'actionCell',
  group: 'tableCell',
  addAttributes() { return { ...this.parent?.(), contenteditable: { default: false }, class: { default: 'action-cell-wrapper' } } },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('td');
      dom.classList.add('action-cell-wrapper');
      dom.contentEditable = 'false';

      const btnContainer = document.createElement('div');
      btnContainer.classList.add('action-btn-group');

      // [+] 按鈕
      const addBtn = document.createElement('button');
      addBtn.innerText = '+';
      addBtn.className = 'act-btn add';
      addBtn.onclick = async () => { 
        if (typeof getPos === 'function') { 
          addCondRow(editor);
          // editor.chain().setNodeSelection(getPos()).addRowAfter().run(); 
          // updateCondRowNumbers(editor); 
        } 
      }

      // [-] 按鈕
      const delBtn = document.createElement('button');
      delBtn.innerText = '-';
      delBtn.className = 'act-btn del';
      delBtn.onclick = async () => { if (typeof getPos === 'function' && confirm('確定要刪除此列嗎？')) { editor.chain().setNodeSelection(getPos()).deleteRow().run(); updateCondRowNumbers(editor); } }

      btnContainer.appendChild(addBtn);
      btnContainer.appendChild(delBtn);
      dom.appendChild(btnContainer);
      return { dom, ignoreMutation: () => true, stopEvent: () => true };
    }
  }
})
const Cell = TableCell.extend({
  name: 'customTableCell',
  group: 'tableCell',
  addAttributes() {
    return {
      ...(this.parent?.() || {}),
      cellType: { default: 'text' },
      contenteditable: { default: true },
      dropdownValue: { default: '' },
      dropdownOptions: { default: [] },
      dropdownColor: { default: '#000000' },
      checked: {
        default: false,
        parseHTML: el => el.getAttribute('data-checked') === 'true',
        renderHTML: attrs => (attrs.checked ? { 'data-checked': 'true' } : {})
      },
      class: { default: null, parseHTML: el => el.getAttribute('class'), renderHTML: attrs => (attrs.class ? { class: attrs.class } : {}) }
    }
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const td = document.createElement('td');
      if (node.attrs.class) td.className = node.attrs.class;

      if (node.attrs.cellType === 'dropdown') {
        const select = document.createElement('select');
        select.className = 'cell-dropdown';
        select.style.color = node.attrs.dropdownColor;
        select.innerHTML = `<option value="">-- 選擇 --</option>` + (node.attrs.dropdownOptions || []).map(opt => `<option value="${opt}">${opt}</option>`).join('');
        select.value = node.attrs.dropdownValue || '';
        select.addEventListener('change', () => { editor.view.dispatch(editor.state.tr.setNodeMarkup(getPos(), null, { ...node.attrs, dropdownValue: select.value })); });

        const box = document.createElement('div');
        box.className = 'dropdown-cell';
        box.appendChild(select);

        // hidden contentDOM lets CellSelection work
        const hidden = document.createElement('div');
        hidden.style.cssText = 'height:0;overflow:hidden;';
        box.appendChild(hidden);

        td.appendChild(box);
        td.contentEditable = 'false';
        return { dom: td, contentDOM: hidden, stopEvent: e => e.target === select };
      }

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

        const hidden = document.createElement('div');
        hidden.style.cssText = 'height:0;overflow:hidden;';
        box.appendChild(hidden);

        td.appendChild(box);
        td.contentEditable = 'false';
        return { dom: td, contentDOM: hidden, stopEvent: e => e.target === input };
      }

      td.classList.add('text-cell-wrapper');
      if (node.attrs.contenteditable === false) td.contentEditable = 'false';
      return { dom: td, contentDOM: td };
    }
  },
})
const TableOnlyDoc = Document.extend({ content:'table' })
const TExt = [
  TableOnlyDoc, ...Base, Focus.configure({ className: 'has-focus', mode: 'all' }),
  Table.configure({ resizable:false, allowTableNodeSelection:true, handleWidth:5, cellMinWidth:50 }),
  Row, Hdr, ActionCell, Cell, History
]

const LOCKCOLS = [0, 1];

// 與 ManufacturingParameterBlocks_.vue 共用同一組 header 名稱常數（保證後端格式一致）
const CHECKBOX_HEADER_NAMES = ['定值項目'];
const NUMERIC_HEADER_NAMES = ['規格下限(OOS-)', '操作下限(OOC-)', '設定值', '操作上限(OOC+)', '規格上限(OOS+)'];
const findCheckboxColIndex = (headers) => headers.findIndex(h => CHECKBOX_HEADER_NAMES.includes(h));
const findNumericColIndices = (headers) => NUMERIC_HEADER_NAMES.map(name => headers.indexOf(name));

const createParamRowNode = (type, row, headers = []) => row.map((text, cellIndex) => {
  if (type !== 'tableHeader' && CHECKBOX_HEADER_NAMES.includes(headers[cellIndex])) {
    const checked = text === '1' || text === true || text === 'true';
    return {
      type: 'customTableCell',
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
const initialParamTableDoc = (template) => {
  const headers = template[0] || [];
  return {
    type: 'doc', content: [{
      type: 'table', content: template.map((row, rowIndex) => ({
        type: 'tableRow', content: createParamRowNode((rowIndex === 0) ? "tableHeader" : "customTableCell", row, headers)
      })),
    }],
  };
};

// 比對 / dup 用 cell 字串（checkbox 換成符號避免被視為空字串）
const getCellSig = (cellNode) => {
  if (cellNode.attrs?.cellType === 'checkbox') return cellNode.attrs.checked ? '☑' : '☐';
  return getText(cellNode);
};

const initialCondTableDoc = (template, initialValues = null) => {
  const headers = ["按鈕操作", '條件名稱', ...template.map(x => x.name)];
  const headerRow = {
    type:'tableRow',
    content: headers.map(text => ({ type:'tableHeader', attrs:{ contenteditable:false }, content:[{ type: 'paragraph', content:[{ type: 'text', text }] }] }))
  }
  const rowsData = (initialValues && initialValues.length > 0) ? initialValues : [Array(template.length).fill("")];
  const dataRows = rowsData.map((rowVals, rIdx) => {
    return {
      type: 'tableRow',
      content: headers.map((header, colIdx) => {
        if (colIdx === 0) return { type:'actionCell', attrs: { contenteditable: false }, content: [{ type: 'paragraph' }] };
        if (colIdx === 1) return { type:'customTableCell', attrs:{ cellType:'text', contenteditable:false }, content:[{ type:'paragraph', content:[{ type:'text', text: `組合${rIdx + 1}` }] }] };

        const tmplIdx = colIdx - 2;
        const opts = template[tmplIdx]?.parameters || [];
        const value = rowVals[tmplIdx] || ""; // ★ 填入舊值或被過濾後的空字串

        return {
          type:'customTableCell',
          attrs:{ cellType:'dropdown', dropdownValue: value, dropdownOptions: opts, dropdownColor: '#000000', contenteditable: false },
          content:[{ type:'paragraph' }]
        }
      })
    }
  })

  return { type:'doc', content:[{ type:'table', content:[headerRow, ...dataRows] }] };
}

// ==========================================
// 3. Specification Select Function
// ==========================================
const openSpecDropdownIndex = ref(null);
const toggleSpecDropdown = (idx) => openSpecDropdownIndex.value = openSpecDropdownIndex.value === idx ? null : idx;
const isSpecChecked = (blkIndex, specCode) => !!localBlockContents.value[blkIndex].data[0].metadata?.programs?.some(specInfo => specInfo.specCode === specCode);
const onToggleSpec = async (blkIndex, opt) => {
  // console.log("onToggleSpec _condTemplate: ", _condTemplate, ", _paramTemplate: ", _paramTemplate.value)
  if (!_condTemplate.value && !_paramTemplate.value) return;
  if (!localBlockContents.value[blkIndex].data[0].metadata.programs) localBlockContents.value[blkIndex].data[0].metadata.programs = [];
  const programs = localBlockContents.value[blkIndex].data[0].metadata.programs;
  const existsIdx = programs?.findIndex(specInfo => specInfo.specCode === opt.code);
  if (props.specOptions.length == 1 && existsIdx >= 0) return;

  if (existsIdx >= 0) {
    try { await releaseProgramCode(programs[existsIdx].programCode); } 
    catch (e) { console.error('releaseProgramCode failed', e); alert('程式號碼釋放失敗，請稍後再試'); }
    localBlockContents.value[blkIndex].data[0].metadata.programs.splice(existsIdx, 1);
  }
  else if (!props.documentToken) { 
    alert('尚未取得草稿代碼，請先儲存或重新整理頁面');
    return;
  }
  else {
    try{
      const data = await allocateProgramCode(opt.code, props.documentToken);
      const programCode = data?.programCode || '';
      if (!programCode) throw new Error('後端未回傳程式號碼');
      localBlockContents.value[blkIndex].data[0].metadata.programs.push({ specCode: opt.code, specName: opt.name, programCode });
    } catch (e) {
      console.error('allocateProgramCode failed', e);
      alert('程式號碼配號失敗，請稍後再試');
    }
  }
  exportTableData();
}
const removeProgram = async (blkIndex, specInfo, showWindow = true) => {
  if (showWindow && !confirm(`確定要移除製程「${specInfo.specName}」與程式號碼「${specInfo.programCode || ''}」嗎？`)) return;
  const programs = localBlockContents.value[blkIndex].data[0].metadata.programs;
  try { await releaseProgramCode(specInfo.programCode); }
  catch (e) {
    console.error('releaseProgramCode failed', e);
    if (showWindow) alert('程式號碼釋放失敗，請稍後再試');
  }
  exportTableData();
}
const handleClickOutside = (event) => { if (openSpecDropdownIndex.value !== null && !event.target.closest('.spec-multi')) openSpecDropdownIndex.value = null; }

// ==========================================
// 4. Editor Trigger Function
// ==========================================
const setCellColor = (blkIndex, color) => {
  const { state, view } = condEditors[blkIndex]; const { selection } = state; const tr = state.tr;
  const $p = state.doc.resolve(selection.from); let c = null, cpos = null;
  for(let d = $p.depth; d > 0; d--) { const n = $p.node(d); if (n.type.name === 'customTableCell' || n.type.name === 'tableCell') { c = n; cpos = $p.before(d); break; } }
  if (c && c.attrs.cellType === 'dropdown'){ tr.setNodeMarkup(cpos, undefined, { ...c.attrs, dropdownColor: color }); view.dispatch(tr); }
}
function getCondTableText(editor) {
  if (!editor) return;
  const { state } = editor;
  const tableNode = state.doc.firstChild;
  const textTable = [tableNode.child(0).content.content.slice(2).map(cellNode => getText(cellNode))];
  const attrsTable = [tableNode.child(0).attrs];
  for(let rowIndex = 1; rowIndex < tableNode.childCount; rowIndex++) {
    const rowText = tableNode.child(rowIndex).content.content.slice(2).map(cellNode => getListText(cellNode));
    textTable.push(rowText); attrsTable.push(tableNode.child(rowIndex).attrs);
  }
  return { textTable, attrsTable };
}
function exportTableData() { 
  const messages = []; // ★ 準備收集錯誤訊息
  const blks = localBlockContents.value.map((blk, blkIndex) => {
    console.log("exportTableData flags: ", errorFlags);
    const flags = errorFlags[blkIndex];
    const programs = blk.data[0]?.metadata?.programs || [];
    if (programs.length === 0) messages.push(`模塊 ${blkIndex + 1} 尚未選擇製程與配發程式號碼`);

    if (flags?.condDup) messages.push(`模塊 ${blkIndex + 1} 的「條件表」包含完全重複的組合`);
    if (flags?.paramInvalid) messages.push(`模塊 ${blkIndex + 1} 的「參數表」有數值未填妥或包含非數字`);
    if (flags?.paramDup) messages.push(`模塊 ${blkIndex + 1} 的「參數表」設定與其他模塊完全重複`);

    const paramText = (paramEditors[blkIndex]) ? getParamMatrix(paramEditors[blkIndex]) : null;
    const paramJson = (paramText) ? paramEditors[blkIndex].getJSON() : null;
    const condText = (condEditors[blkIndex]) ? getCondTableText(condEditors[blkIndex]).textTable : null;
    const condJson = (condText) ? condEditors[blkIndex].getJSON() : null;

    if (condText && condText.slice(1).some(row => row.some(cell => cell === ''))) messages.push(`模塊 ${blkIndex + 1} 的「條件表」有項目尚未選擇`);

    return { step_type: 2, tier_no: blkIndex, data: [
      {content_type: 2, header_text: null, header_json: null, content_text: null, content_json: null, table_text: paramText, table_json: paramJson, files: [], metadata: blk.data[0].metadata },
      {content_type: 2, header_text: null, header_json: null, content_text: null, content_json: null, table_text: condText, table_json: condJson, files: [], metadata: blk.data[0].metadata },
    ]};
  });
  emit('update-block', blks); 
  emit('invalid-check', { isValid: messages.length === 0, message: messages });
}
const updateCondRowNumbers = (editor) => {
  const { state, view } = editor;
  const tr = state.tr;
  const table = state.doc.content.firstChild;
  let updates = [], rowIndex = 0;
  
  state.doc.descendants((node, pos) => {
    if (node.type.name==='tableRow') {
      if (rowIndex > 0) updates.push({ cellPos: pos + 1 + node.child(0).nodeSize, node: node.child(1), number: rowIndex });
      rowIndex++;
    }
  })

  for (let k = updates.length - 1; k >= 0; k--) {
    const u = updates[k];
    const newCell = state.schema.nodes.customTableCell.create({ cellType: 'text', contenteditable: false }, state.schema.nodes.paragraph.create(null, state.schema.text("組合" + String(u.number))));
    tr.replaceWith(u.cellPos, u.cellPos + u.node.nodeSize, newCell);
  }
  if (tr.docChanged) view.dispatch(tr);
}
const addCondRow = (editor) => {
  const selRowIdx = editor.state.selection.$anchor.path[4];
  if (selRowIdx < 0){ alert('請選擇一個儲存格'); return; }
  editor.chain().focus().addRowAfter().run();

  nextTick(() => {
    const { state, view } = editor;
    const tr = state.tr;
    let rowIdx = 0, newRowNode=null, newRowPos=null;
    state.doc.descendants((n, p) => {
      if(n.type.name === 'tableRow'){
        if (rowIdx === selRowIdx + 1){ newRowNode = n; newRowPos = p; }
        rowIdx++;
      }
    })
    if(!newRowNode) return;

    const optionCols = Object.fromEntries(_condTemplate.value.map(item => [item.name, item.parameters]));
    const headers = _condTemplate.value.map(paramInfo => paramInfo.name);

    let cells = [];
    let offset = 1, ci = 0;
    newRowNode.forEach((cellNode, cellIndex) => { cells.push({ node: cellNode, pos: newRowPos + offset, index: ci++ }); offset += cellNode.nodeSize; });

    for (let i = cells.length - 1; i > 0; i--) { 
      const { node: cellNode, pos: cpos, index: ci } = cells[i];
      let repl = null;
      
      if (ci === 1) repl = state.schema.nodes.customTableCell.create({ cellType: 'text', contenteditable: false },  state.schema.nodes.paragraph.create(null, state.schema.text("組合" + String(selRowIdx))));
      else repl = state.schema.nodes.customTableCell.create({ cellType:'dropdown', dropdownValue:'', dropdownOptions: optionCols[headers[ci-2]] || [], dropdownColor: '#000000', contenteditable: false }, state.schema.nodes.paragraph.create());
      tr.replaceWith(cpos, cpos + cellNode.nodeSize, repl);
    }
    if (tr.docChanged) view.dispatch(tr);
    updateCondRowNumbers(editor); 
    validateCondTableContent();
  })
}

// ==========================================
// 5. Editor Build Function
// ==========================================
let condDebounceTimer = null;
let paramDebounceTimer = null;
const buildCondTableEditor = (template, initialValues = null) => {
  if (!template) return;
  const data = (Array.isArray(template)) ? initialCondTableDoc(template, initialValues) : template;
  const ed = new Editor({
    content: data, extensions: TExt,
    editorProps: { handleDOMEvents: { drop:()=>true, dragstart:()=>true, mousedown:()=>false }, handleKeyDown: handleKeyDown },
    onUpdate: () => { 
      if (condDebounceTimer) clearTimeout(condDebounceTimer);
      condDebounceTimer = setTimeout(() => { validateCondTableContent(); }, 300);
    },
  });
  return ed;
}
const buildParamTableEditor = (template) => {
  if (!template) return;
  const data = (Array.isArray(template)) ? initialParamTableDoc(template) : template;
  const ed = new Editor({
    content: data, extensions: TExt,
    editorProps: { handleDOMEvents: { drop: () => true, dragstart: () => true, copy: handleCopy, paste: handlePaste, mousedown: handleMousedown }, handleKeyDown: handleKeyDown },
    onUpdate: ({ editor }) => { 
      validateParamTableContent(editor, paramEditors.indexOf(editor), false);
      if (paramDebounceTimer) clearTimeout(paramDebounceTimer);
      paramDebounceTimer = setTimeout(() => { validateParamDuplicate(); }, 300);
    },
  });
  return ed;
}
const assignTemplateFromProps = (condTemplate, pmsTemplate) => { _condTemplate.value = condTemplate; _paramTemplate.value = pmsTemplate; }
const initTemplateFromProps = async (condTemplate, pmsTemplate) => {
  _condTemplate.value = condTemplate; _paramTemplate.value = pmsTemplate;
  const N = condEditors.length;

  // No any template then just remove all block (include program code), then create new one block to display nothing parameter
  if (!condTemplate && !pmsTemplate) { await delAllBlock(); }
  if ((!condTemplate && !pmsTemplate) || N == 0) addBlock();

  // Remove all program code
  for(let i = 0; i < N; i++) {
    const programs = localBlockContents.value[i].data[0].metadata.programs || [];
    for (const specInfo of programs) { await removeProgram(i, specInfo); }
  }

  // Force destroy all editors and rebuild all editor
  paramEditors.forEach(ed => ed?.destroy?.()); condEditors.forEach(ed => ed?.destroy?.());
  for (let i = 0; i < Math.max(1, N); i++) condEditors[i] = buildCondTableEditor(condTemplate);
  for (let i = 0; i < Math.max(1, N); i++) { paramEditors[i] = buildParamTableEditor(pmsTemplate); validateParamTableContent(paramEditors[i], i, false); }

  validateCondTableContent(false); validateParamDuplicate(); exportTableData();
}
const loadTableFromProps = (blockContents) => {
  localBlockContents.value = [...blockContents]; 
  blockContents.forEach((blk, blkIndex) => {
    if (condEditors.length == blkIndex) condEditors.push(null);
    if (paramEditors.length == blkIndex) paramEditors.push(null);
    if (condEditors[blkIndex]) condEditors[blkIndex].destroy();
    if (paramEditors[blkIndex]) paramEditors[blkIndex].destroy();

    // Load condition table & parameter table
    if (errorFlags.length === blkIndex) { errorFlags.push({ condDup: false, paramInvalid: false, paramDup: false }); }
    console.log("loading Table from props flags: ", errorFlags);
    if (blk.data[1].table_json) { condEditors[blkIndex] = buildCondTableEditor(blk.data[1].table_json); validateCondTableContent(false); }
    if (blk.data[0].table_json) { paramEditors[blkIndex] = buildParamTableEditor(blk.data[0].table_json); validateParamTableContent(paramEditors[blkIndex], blkIndex, false); }
  })

  console.log("load Table from props flags: ", errorFlags);
  if (condEditors.length == 0) addBlock();
  exportTableData();
}
const loadUpdateParamTableFromProps = (pmsTables) => {
  pmsTables.forEach((pmsTable, index) => {
    if (paramEditors.length == index) paramEditors.push(null);
    if (paramEditors[index]) paramEditors[index].destroy();
    paramEditors[index] = buildParamTableEditor(pmsTable);
    validateParamTableContent(paramEditors[index], index);
  })
}
const loadUpdateCondTableFromProps = (condTemplate, mergedValuesArray) => {
  mergedValuesArray.forEach((values, index) => {
    if (condEditors.length == index) condEditors.push(null);
    if (condEditors[index]) condEditors[index].destroy();
    condEditors[index] = buildCondTableEditor(condTemplate, values);
  });
  validateCondTableContent();
}

// ==========================================
// 6. Editor Validate Function
// ==========================================
const errorFlags = reactive([]); // ★ 改為陣列
function validateCondTableContent(isExport = true) {
  const sigMap = new Map();
  condEditors.forEach((ed, bIdx)=>{
    if(!ed) return;

    const { state } = ed;
    const N = state.doc.firstChild.childCount;

    let rowsPos = [1];
    const { textTable, attrsTable } = getCondTableText(ed);
    for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
    for(let rowIndex = 1; rowIndex < N; rowIndex++) {
      const rowText = JSON.stringify(textTable[rowIndex]);
      const attrs = attrsTable[rowIndex];
      if (!sigMap.has(rowText)) sigMap.set(rowText, []);
      sigMap.get(rowText).push({ bIdx, pos: rowsPos[rowIndex], attrs });
    }
  })

  const dupIdx = [];
  const uniIdx = [];
  for(const indices of sigMap.values()) {
    if (indices.length > 1) indices.forEach(i => dupIdx.push(i));
    else uniIdx.push(indices[0]);
  }

  dupIdx.toReversed().forEach(idx => {
    const { state, view } = condEditors[idx.bIdx];
    errorFlags[idx.bIdx].condDup = true;

    const tr = state.tr;
    tr.setNodeMarkup(idx.pos, undefined, { attrs: idx.attrs, class: 'dup-table' });
    if(tr.docChanged) view.dispatch(tr);
  })

  uniIdx.toReversed().forEach(idx => {
    const { state, view } = condEditors[idx.bIdx];
    errorFlags[idx.bIdx].condDup = false;

    const tr = state.tr;
    tr.setNodeMarkup(idx.pos, undefined, { attrs: idx.attrs, class: '' });
    if(tr.docChanged) view.dispatch(tr);
  })
  
  if (isExport) exportTableData();
}
function validateParamTableContent(editor, blkIndex, isExport = true) {
  if (!editor) return;
  let hasInvalidValue = false;

  const { state, view } = editor; let tr = state.tr;

  // 動態定位欄位（不再 hardcoded index 2~7）
  const headerRowNode = state.doc.firstChild.firstChild;
  const headers = headerRowNode.content.content.map(getText);
  const numericIdx = findNumericColIndices(headers);
  const checkboxIdx = findCheckboxColIndex(headers);

  if (numericIdx.some(i => i < 0)) {
    if (errorFlags[blkIndex]) errorFlags[blkIndex].paramInvalid = false;
    if (isExport) exportTableData();
    return;
  }

  const setValueIdxInArr = NUMERIC_HEADER_NAMES.indexOf('設定值');

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

    // 該 row 是否勾選「定值項目」
    const isFixed = checkboxIdx >= 0 && cells.child(checkboxIdx)?.attrs?.checked === true;

    const value = [];
    let valueStatus = [];
    for (let i = 0; i < numericIdx.length; i++) {
      const txt = getText(cells.child(numericIdx[i]));
      let status = 'empty';
      let val = Number(txt);

      if (txt) status = (Number.isNaN(val)) ? 'invalid' : 'valid';
      value.push(val); valueStatus.push(status);
    }

    // 勾選定值項目：上下限 4 格不卡控，但「設定值」保留原始 empty/invalid → 強制必填
    if (isFixed) {
      valueStatus = valueStatus.map((s, i) => i === setValueIdxInArr ? s : 'valid');
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

  errorFlags[blkIndex].paramInvalid = hasInvalidValue;
  editor.view.dispatch(tr);
  if (isExport) exportTableData();
}
const getParamMatrix = (ed) => ed.state.doc.firstChild.content.content.map(rowNode => rowNode.content.content.map(getCellSig));
function validateParamDuplicate() {
  const sigMap = new Map();
  paramEditors.forEach((ed, idx) => {
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
    errorFlags[idx].paramDup = true;
    const { state, view } = paramEditors[idx];
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
    errorFlags[idx].paramDup = false;
    const { state, view } = paramEditors[idx];
    const tr = state.tr;
    const N = state.doc.content.firstChild.content.childCount

    let rowsPos = [1];
    for(let rowIndex = 0; rowIndex < N - 1; rowIndex++) rowsPos.push(rowsPos.at(-1) + state.doc.content.firstChild.content.child(rowIndex).nodeSize);
    for(let rowIndex = N - 1; rowIndex > 0; rowIndex--) {
      tr.setNodeMarkup(rowsPos[rowIndex], undefined, { ...rowsPos[rowIndex].attrs, class: '' })
    }
    if(tr.docChanged) view.dispatch(tr);
  })
}

// ==========================================
// 7. Editor Validate Function
// ==========================================
const addBlock = () => {
  localBlockContents.value.push({ id: uuidv1(), step_type: 2, tier_no: localBlockContents.value.length + 1, data: [
    { content_type: 2, header_text: null, header_json: null, content_text: null, content_json: null, table_text: null, table_json: null, files: [], metadata: {} },
    { content_type: 2, header_text: null, header_json: null, content_text: null, content_json: null, table_text: null, table_json: null, files: [], metadata: {} },
  ]});
  errorFlags.push({ condDup: false, paramInvalid: false, paramDup: false });
  condEditors.push(buildCondTableEditor(_condTemplate.value));
  paramEditors.push(buildParamTableEditor(_paramTemplate.value));
  validateCondTableContent(false); validateParamTableContent(paramEditors.at(-1), paramEditors.length - 1, false); validateParamDuplicate(); exportTableData();
}
const delBlock = async (blkIndex) => {
  if (localBlockContents.value.length == 1) { alert("至少需要保留一個組合"); return; }
  if (!confirm("確定要刪除此組合嗎？")) return;
  if (condEditors[blkIndex]) condEditors[blkIndex].destroy();
  if (paramEditors[blkIndex]) paramEditors[blkIndex].destroy();
  condEditors.splice(blkIndex, 1);
  paramEditors.splice(blkIndex, 1);
  errorFlags.splice(blkIndex, 1);
  const programs = localBlockContents.value[blkIndex].data[0].metadata.programs || [];
  for (const specInfo of programs) { await removeProgram(blkIndex, specInfo, false); }
  localBlockContents.value.splice(blkIndex, 1);
  validateCondTableContent(false); validateParamDuplicate(); exportTableData();
}
const delAllBlock = async () => {
  const N = condEditors.length;
  for (let i = 0; i < N; i++) {
    if (condEditors[i]) condEditors[i].destroy();
    if (paramEditors[i]) paramEditors[i].destroy();
    const programs = localBlockContents.value[i].data[0].metadata.programs || [];
    for (const specInfo of programs) { await removeProgram(i, specInfo); }
  };
  condEditors.splice(0, N); paramEditors.splice(0, N); localBlockContents.value.splice(0, N); errorFlags.splice(0, N);
}
const duplicateBlock = async (blkIndex) => {
  localBlockContents.value.push({ id: uuidv1(), step_type: 2, tier_no: localBlockContents.value.length + 1, data: [
    { content_type: 2, header_text: null, header_json: null, content_text: null, content_json: null, table_text: null, table_json: null, files: [], metadata: {} },
    { content_type: 2, header_text: null, header_json: null, content_text: null, content_json: null, table_text: null, table_json: null, files: [], metadata: {} },
  ]});
  errorFlags.push({ condDup: false, paramInvalid: false, paramDup: false });
  condEditors.push(buildCondTableEditor(condEditors[blkIndex]?.getJSON()));
  paramEditors.push(buildParamTableEditor(paramEditors[blkIndex]?.getJSON()));
  const programs = localBlockContents.value[blkIndex].data[0].metadata.programs || [];
  for (const specInfo of programs) { await onToggleSpec(localBlockContents.value.length - 1, { code: specInfo.specCode, name: specInfo.specName }); }
  validateCondTableContent(false); validateParamTableContent(paramEditors.at(-1), paramEditors.length - 1, false); validateParamDuplicate(); exportTableData();
}
const copyFromCode = (blkIndex) => { 
  const codeToCopy = localBlockContents.value[blkIndex].data[0].metadata.copyCode;
  if (!codeToCopy) { alert("請先輸入代碼！"); return; }
  alert("在已簽核文件中查無此代碼"); 
}
// ==========================================
// 7. Constructor & Destructor Function
// ==========================================
onMounted(() => { 
  _condTemplate.value = parseCondTemplate(props.dataBlocks?.[0]?.data?.[1]?.table_json)?.condTemplate;
  _paramTemplate.value = parseParamTemplate(props.dataBlocks?.[0]?.data?.[0]?.table_json);
  loadTableFromProps(props.dataBlocks);
  window.addEventListener('click', handleClickOutside);
})
onBeforeUnmount(() => {
  if (condDebounceTimer) clearTimeout(condDebounceTimer);
  if (paramDebounceTimer) clearTimeout(paramDebounceTimer);
  exportTableData();
  for(let i = 0; i < paramEditors.length; i++) { paramEditors[i]?.destroy?.(); paramEditors[i] = null; }
  for(let i = 0; i < condEditors.length; i++) { condEditors[i]?.destroy?.(); condEditors[i] = null; }
  window.removeEventListener('click', handleClickOutside);
})

defineExpose({ assignTemplateFromProps, initTemplateFromProps, loadTableFromProps, loadUpdateParamTableFromProps, loadUpdateCondTableFromProps, exportTableData });
</script>

<style scoped>
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
.dot{display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:pointer}
.red{background:#f00}.blue{background:#00f}.black{background:#000000}
.ed{background:#fff;border:1px solid #ddd;border-radius:6px;margin-bottom:10px}
.ed :deep(.ProseMirror){padding:8px;min-height:80px;outline:none}
.ed :deep(table){border-collapse:collapse;width:100%;table-layout:fixed}
.ed :deep(th),.ed :deep(td){background-color: #fff; border:1px solid #ddd;padding:8px;text-align:center;vertical-align:middle;min-width:72px;position:relative}
.ed :deep(th){background:#f8f9fa;font-weight:700;position:sticky;top:35px;z-index:5;}
.ed :deep(.selectedCell){background:#e3f2fd!important;outline:2px solid #2196f3;outline-offset:-2px}
.ed :deep([contenteditable="false"]){background:#f5f5f5;color:#666;cursor:not-allowed}
.ed :deep(tr.dup-row td){background:#ffe6e6!important}      /* 5.1 duplicate row: red-ish */
.ed :deep(tr.dup-table td){background:#ffe6e6!important}    /* 6.3 duplicate table: red-ish */
.ed :deep(td.value-empty){background:#fff7c2}               /* 6.4.2 empty: yellow */
.ed :deep(td.value-invalid),.ed :deep(td.value-error){background:#ffcdd2} /* 6.4.3 invalid: red */
.ed :deep(.dropdown-cell){width:100%;padding:4px}
.ed :deep(.cell-dropdown){width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;background:#fff}
.ed :deep(.cell-dropdown:focus){outline:2px solid #2196f3;border-color:#2196f3}
.ed :deep(td.has-focus){ background-color:#fff7cc; box-shadow: inset 0 0 0 2px #ff9800; }

.ed-param :deep(col:nth-child(1)) { width: 75%; }  /* 槽體 */
.ed-param :deep(col:nth-child(2)) { width: 100%; } /* 管理項目 */
.ed-param :deep(col:nth-child(3)) { width: 50%; }  /* 定值項目 (checkbox) */
.ed-param :deep(col:nth-child(4)) { width: 75%; }  /* 規格下限(OOS-) */
.ed-param :deep(col:nth-child(5)) { width: 75%; }  /* 操作下限(OOC-) */
.ed-param :deep(col:nth-child(6)) { width: 75%; }  /* 設定值 */
.ed-param :deep(col:nth-child(7)) { width: 75%; }  /* 操作上限(OOC+) */
.ed-param :deep(col:nth-child(8)) { width: 75%; }  /* 規格上限(OOS+) */
.ed-param :deep(col:nth-child(9)) { width: 100%; } /* 說明 */
.ed-cond :deep(col:nth-child(1)) { width: 75%; }
.ed-cond :deep(col:nth-child(2)) { width: 100%; }
.ed-cond :deep(col:nth-child(3)) { width: 75%; }
.ed-cond :deep(col:nth-child(4)) { width: 75%; }
.ed-cond :deep(col:nth-child(5)) { width: 75%; }
.ed-cond :deep(col:nth-child(6)) { width: 75%; }
.ed-cond :deep(col:nth-child(7)) { width: 75%; }
.ed-cond :deep(col:nth-child(8)) { width: 100%; }
.ed :deep(td:last-child) { text-align: left; }
.ed :deep(td.checkbox-cell-wrapper) { background-color: #fafbfc; padding: 0; }
.ed :deep(.checkbox-cell) { display: flex; align-items: center; justify-content: center; padding: 8px; }
.ed :deep(.checkbox-cell input[type="checkbox"]) { width: 18px; height: 18px; cursor: pointer; margin: 0; accent-color: #1666C0; }

.hint { margin: 6px 0; color: #555; }
.hint.empty { margin: 8px 0; color: #c62828; font-weight: 600; }

.spec-select { display: flex; align-items: center; gap: 8px; }
.spec-multi { position: relative; min-width: 260px; }
.spec-multi-trigger {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #fff;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}
.spec-multi-trigger .placeholder { color: #999; }
.spec-multi-trigger .caret { margin-left: 8px; font-size: 10px; }
.spec-multi-trigger.step-error { background-color: #ffcdd2;}
.spec-multi-panel {
  position: absolute;
  top: 105%;
  left: 0;
  right: 0;
  max-height: 220px;
  overflow: auto;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #ddd;
  box-shadow: 0 4px 10px rgba(0,0,0,.08);
  padding: 6px 8px;
  z-index: 20;
}

.spec-option { display: flex; align-items: center; gap: 6px; padding: 4px 2px; font-size: 13px; cursor: pointer; }
.spec-option:hover { background: #f5f8ff; }

.program-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
.program-tag { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; background: #eef4ff; border: 1px solid #c3d3ff; font-size: 12px; }

.tag-spec { font-weight: 600; color: #1a3d8f; }
.tag-code { font-family: monospace; padding: 0 4px; background: #fff; border-radius: 4px; border: 1px dashed #b0c4ff; }
.tag-remove { border: none; background: transparent; cursor: pointer; font-size: 12px; line-height: 1; color: #888; }
.tag-remove:hover { color: #c62828; }

.ed :deep(.action-cell-wrapper) { padding: 2px; background-color: #f1f3f5; vertical-align: middle; text-align: center; }
.ed :deep(.action-btn-group) { display: flex; justify-content: center; gap: 12px; }
.ed :deep(.act-btn) { width: 25px; height: 25px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; font-size: 14px; padding: 0; line-height: 1; }
.ed :deep(.act-btn.add) { color: #1c7ed6; background-color: #e7f5ff; }
.ed :deep(.act-btn.add:hover) { background-color: #d0ebff; }
.ed :deep(.act-btn.del) { color: #fa5252; background-color: #fff5f5; }
.ed :deep(.act-btn.del:hover) { background-color: #ffe3e3; }

</style>