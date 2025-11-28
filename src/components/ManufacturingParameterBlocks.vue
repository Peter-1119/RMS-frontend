<!-- ManufacturingParameterBlocks.vue -->
<template>
  <div class="blk-wrap">
    <button class="btn add" @click="addBlock">新增下一層</button>

    <div v-for="(b,i) in blocks" :key="b.id" class="blk">
      <div class="blk-hd">
        <div>
          <b>程式號碼：</b>
          {{ b.code || '(尚未配號)' }}
        </div>

        <div class="copybox">
          <label>參數代碼：</label>
          <input v-model="copyCode" placeholder="輸入要複製的代碼" />
          <button class="btn info" @click="copyFromCode(i)">複製</button>
        </div>

        <div class="ops">
          <button class="btn info" @click="duplicateBlock(i)">複製模塊</button>
          <button class="btn danger" @click="delBlock(i)">刪除</button>
        </div>
      </div>

      <!-- Parameter (Table 2) -->
      <div
        v-if="hasAnyMachineGroup"
        class="menu"
        :class="{ 'menu-error': !blocks[i].meta.group || !blocks[i].meta.machine }"
      >
        <div class="l">
          <label>機檯群組：</label>
          <select v-model="blocks[i].meta.group" @change="onGroupChange(i)">
            <option value="">-- 請選擇群組 --</option>
            <option
              v-for="[groupCode, groupInfo] in groupKeys"
              :key="groupCode"
              :value="groupCode"
            >
              {{ groupInfo.name }}
            </option>
          </select>

          <label>機台：</label>
          <select v-model="blocks[i].meta.machine" @change="onMachineChange(i)">
            <option value="">-- 請選擇機台 --</option>
            <option
              v-for="[machineCode, machineInfo] in machineKeysFor(i)"
              :key="machineCode"
              :value="machineCode"
            >
              {{ machineInfo.name }}
            </option>
          </select>
        </div>

        <div v-if="allowColor" class="r">
          <i class="dot blue"  @click="paramEditors[i]?.chain().focus().setColor('blue').run()"></i>
          <i class="dot black" @click="paramEditors[i]?.chain().focus().setColor('null').run()"></i>
        </div>
      </div>

      <!-- 有機台群組：一般 hint / loading / empty / editor -->
      <div v-if="hasAnyMachineGroup && (!blocks[i].meta.group || !blocks[i].meta.machine)" class="hint">
        請先選擇「機檯群組」與「機台」，將自動載入 PMS 參數。
      </div>
      <div v-else-if="hasAnyMachineGroup && pmsLoading[i]" class="hint">
        正在載入 PMS 參數…
      </div>
      <div v-else-if="hasAnyMachineGroup && pmsEmpty[i]" class="hint empty">
        此機台無PMS資料
      </div>
      <EditorContent v-else-if="hasAnyMachineGroup && paramEditors[i]" :editor="paramEditors[i]" class="ed ed-param"/>

      <!-- 完全沒有機台群組：只顯示一行說明，整個 Step 視為「不需填寫」 -->
      <div v-else class="hint empty">
        此適用工程沒有任何機台群組，不需設定 PMS。
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount, watch, computed } from 'vue'
import axios from 'axios'
import { v1 as uuidv1 } from 'uuid'
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
import { CellSelection } from 'prosemirror-tables'

import {
  allocateProgramCode,
  releaseProgramCode,
  copySpecParamFromCode,
} from '@/api/docsApi'

/* ===== Props / Emits ===== */
const props = defineProps({
  dataBlocks: { type: Array, default: () => [] },     // [{ code, data:{ jsonParameterContent, arrayParameterData, metadata? }, ...}]
  specification: { type: [Array, Object], default: () => ([])}, // parent 給的製程 list
  currentStep: { type: Number, default: 0 },
  documentToken: { type: String, default: '' },       // 文件 token，用來配號
  allowColor: { type: Boolean, default: true },
})
const emit = defineEmits(['update:dataBlocks', 'save', 'machine-group-info'])

/* ===== API base ===== */
const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL

/* ===== TipTap setup (plain cells) ===== */
const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })]
const CustomTableCell = TableCell.extend({
  addAttributes () {
    return {
      ...this.parent?.(),
      contenteditable: { default: true },
      class: { default: null },
    }
  },
})
const CustomTableHeader = TableHeader.extend({
  addAttributes () {
    return {
      ...this.parent?.(),
      contenteditable: { default: true },
    }
  },
})
const CustomTableRow = TableRow.extend({
  addAttributes () {
    return {
      ...this.parent?.(),
      class: { default: null },
    }
  },
})
const TExt = [
  Document.extend({ content: 'table' }),
  ...baseExt,
  Table,
  CustomTableRow,
  CustomTableHeader,
  CustomTableCell,
  History,
]

/* ===== Reactive state ===== */
const blocks = ref([])          // [{ id, code, data, meta:{group, machine, specCode?}, content_id?, client_temp_id? }]
const paramEditors = ref([])    // Editor[]
const copyCode = ref('')
let idSeq = 0

const pmsLoading = ref({})  // { [i]: boolean }
const pmsEmpty   = ref({})  // { [i]: boolean }

/* ===== MES: groups & machines ===== */
// specGroupsMap: 後端回傳的完整 map
// {
//   "R221-01": {
//     "R22J": { name: "(M-R22J)...", machines: [{code,name,building}, ...] },
//     ...
//   },
//   ...
// }
const specGroupsMap = ref({})

// 壓平成 UI 需要的 groupsMap：
// {
//   "R22J": {
//      name: "(M-R22J)...",
//      machines: {
//        "R22J02": { name: "(R22J02)...", specCodes: ["R221-01", ...] },
//        ...
//      }
//   },
//   ...
// }
const groupsMap = computed(() => {
  const merged = {}

  for (const [specCode, groups] of Object.entries(specGroupsMap.value || {})) {
    for (const [gCode, gInfo] of Object.entries(groups || {})) {
      const gKey = gCode
      if (!merged[gKey]) {
        merged[gKey] = {
          name: gInfo.name,
          machines: {},
        }
      }

      for (const m of (gInfo.machines || [])) {
        const mKey = m.code
        if (!merged[gKey].machines[mKey]) {
          merged[gKey].machines[mKey] = {
            name: m.name,
            specCodes: [],
          }
        }
        if (!merged[gKey].machines[mKey].specCodes.includes(specCode)) {
          merged[gKey].machines[mKey].specCodes.push(specCode)
        }
      }
    }
  }

  return merged
})

function getMachineNameByCode (groupCode, machineCode) {
  const g = groupsMap.value[groupCode]
  if (!g) return ''
  const m = g.machines?.[machineCode]
  return m ? (m.name || '') : ''
}

const hasAnyMachineGroup = computed(() => {
  return Object.keys(groupsMap.value || {}).length > 0
})

const groupKeys = computed(() => Object.entries(groupsMap.value))

const machineKeysFor = (i) => {
  const g = blocks.value[i]?.meta?.group || ''
  const gm = groupsMap.value[g]?.machines || {}
  return Object.entries(gm)
}

/* ===== Spec 相關 Helper ===== */
// 舊有 getSpecCodeForBlock：用 parent.specification 的第一個 code
function getSpecCodeForBlock (i) {
  const spec = props.specification

  if (Array.isArray(spec) && spec.length > 0) {
    return (spec[0].code || '').trim()
  }
  if (spec && typeof spec === 'object') {
    return (spec.code || spec.specific || '').trim()
  }
  return ''
}

// 依 group + machine 從 specGroupsMap 反查 specCode（舊版用在 onMachineChange）
function findSpecCodeForGroupAndMachine (groupCode, machineCode) {
  const g = (groupCode || '').trim()
  const m = (machineCode || '').trim()
  if (!g || !m) return ''

  for (const [specCode, groups] of Object.entries(specGroupsMap.value || {})) {
    const group = groups[g]
    if (!group) continue
    if ((group.machines || []).some(x => (x.code || '').trim() === m)) {
      return specCode
    }
  }
  return ''
}

// 只靠 group 找 specCode：用在「選群組就配號」這條路徑
function resolveSpecCodeForGroup (groupCode) {
  const g = (groupCode || '').trim()
  if (!g) return ''

  for (const [specCode, groups] of Object.entries(specGroupsMap.value || {})) {
    if (groups[g]) return specCode
  }
  return ''
}

// 決定「這個 block 應該用哪個 specCode 來配號」
function resolveSpecCodeForProgram (i) {
  const meta = blocks.value[i]?.meta || {}
  if (meta.specCode) return meta.specCode.trim()

  const g = (meta.group || '').trim()
  const m = (meta.machine || '').trim()

  // 先試 group+machine 精確 match
  if (g && m) {
    const specFromGM = findSpecCodeForGroupAndMachine(g, m)
    if (specFromGM) {
      blocks.value[i].meta.specCode = specFromGM
      return specFromGM
    }
  }

  // 再試只靠 group
  if (g) {
    const specFromG = resolveSpecCodeForGroup(g)
    if (specFromG) {
      blocks.value[i].meta.specCode = specFromG
      return specFromG
    }
  }

  // 最後 fallback：parent 第一個 specification
  const specFromParent = getSpecCodeForBlock(i)
  if (specFromParent) {
    blocks.value[i].meta.specCode = specFromParent
  }
  return specFromParent
}

/* ===== PMS table template ===== */
const LOCK_COLS = [0, 1, 7]

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

/* ===== 小工具：擷取 cell 文字 ===== */
function cellText (node) {
  let text = ''
  node.descendants(n => {
    if (n.type && n.type.name === 'text' && n.text) text += n.text
  })
  return text
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
      handleDOMEvents: {
        drop: () => true,
        dragstart: () => true,
      },
      handleKeyDown (view, event) {
        if (!['Backspace', 'Delete'].includes(event.key)) return false
        const sel = view.state.selection
        if (!(sel instanceof CellSelection)) return false
        const { state } = view
        let tr = state.tr
        const editableCells = []
        sel.forEachCell((cell, pos) => {
          const head = cell.type.name === 'tableHeader'
          const editable = cell.attrs?.contenteditable !== false
          if (!head && editable) editableCells.push({ cell, pos })
        })
        if (!editableCells.length) {
          event.preventDefault()
          return true
        }
        for (let i = editableCells.length - 1; i >= 0; i--) {
          const { cell, pos } = editableCells[i]
          const empty = state.schema.nodes.paragraph.create()
          const newCell = cell.type.create(cell.attrs, empty, cell.marks)
          tr = tr.replaceWith(pos, pos + cell.nodeSize, newCell)
        }
        view.dispatch(tr)
        event.preventDefault()
        return true
      },
    },
    onUpdate ({ editor }) {
      onUpdate?.(editor)
      syncToParent()
    },
  })
}

/* ===== MES fetch ===== */
async function fetchGroups () {
  let specCodes = []

  if (Array.isArray(props.specification)) {
    specCodes = props.specification.map(s => s && s.code).filter(Boolean)
  } else if (props.specification && props.specification.code) {
    specCodes = [props.specification.code]
  }

  if (!specCodes.length) {
    specGroupsMap.value = {}
    return
  }

  try {
    const { data } = await axios.get(`${API_BASE_URL}/mes/spec-groups-machines`, {
      params: { specific: specCodes },   // 會序列化成 ?specific=A&specific=B
    })
    specGroupsMap.value = data?.data?.specGroups || {}
  } catch (e) {
    console.error('fetch spec-groups-machines failed:', e)
    specGroupsMap.value = {}
  }
}

// 從 blocks.meta 取 Oracle MACHINE_CODE
function getSelectedMachineId (i) {
  const mKey = blocks.value[i]?.meta?.machine || ''
  return (mKey || '').trim()
}

/* ===== PMS from MES ===== */
async function seedFromMES (i, machineId) {
  pmsLoading.value[i] = true
  pmsEmpty.value[i]   = false
  try {
    const { data } = await axios.get(`${API_BASE_URL}/mes/pms/machine-parameters-set-attribute`, {
      params: { machine_id: machineId },
    })
    const rows = data?.data?.table_rows || []

    if (!rows.length) {
      if (paramEditors.value[i]) {
        paramEditors.value[i].destroy()
        paramEditors.value[i] = null
      }
      pmsEmpty.value[i] = true
      return
    }

    const doc = buildParamDocFromRows(rows)
    if (!paramEditors.value[i]) {
      paramEditors.value[i] = makeParamEditor(
        doc,
        (editor) => {
          runParamValueValidation(editor)
          runParamDuplicateValidation()
        },
      )
    } else {
      paramEditors.value[i].commands.setContent(doc, false)
    }

    nextTick(() => { runAllValidations(); syncToParent() })
  } catch (e) {
    console.error('seedFromMES error:', e)
    if (paramEditors.value[i]) {
      paramEditors.value[i].destroy()
      paramEditors.value[i] = null
    }
    pmsEmpty.value[i] = true
  } finally {
    pmsLoading.value[i] = false
  }
}

/* ===== 核心：向後端配一個新的程式號碼 ===== */
async function allocateNewCodeForBlock (i) {
  const specCode = resolveSpecCodeForProgram(i)
  if (!specCode) return
  if (!props.documentToken) {
    alert('尚未取得文件代碼，請先暫存草稿再配號')
    return
  }

  try {
    const res = await allocateProgramCode(specCode, props.documentToken)
    blocks.value[i].code = res.programCode

    // 更新 metadata.programs
    const origMeta = blocks.value[i].data?.metadata || {}
    blocks.value[i].data = blocks.value[i].data || {}
    blocks.value[i].data.metadata = {
      ...origMeta,
      programs: [
        {
          specCode: res.specCode,
          programCode: res.programCode,
        },
      ],
    }
  } catch (e) {
    console.error('allocateProgramCode failed:', e)
    alert('程式號碼配號失敗，請稍後再試')
    blocks.value[i].code = ''
  }
}

/* ===== Public actions ===== */
function autoSelectMachineIfUnique (i) {
  const g = blocks.value[i]?.meta?.group || ''
  if (!g) return

  const machinesEntries = Object.entries(groupsMap.value[g]?.machines || {})
  if (machinesEntries.length === 1) {
    const onlyMachineCode = machinesEntries[0][0]
    blocks.value[i].meta.machine = onlyMachineCode
    onMachineChange(i)
  }
}

function addBlock () {
  const id = idSeq++
  const allGroupKeys = Object.keys(groupsMap.value || {})
  const firstGroup = allGroupKeys.length === 1 ? allGroupKeys[0] : ''

  blocks.value.push({
    content_id: null,
    client_temp_id: `temp-${uuidv1()}`,
    id,
    code: '',
    meta: { group: firstGroup, machine: '' },
    data: {},
  })

  const idx = blocks.value.length - 1

  pmsLoading.value[id] = false
  pmsEmpty.value[id] = false

  // 如果只有一個群組，直接選上並自動配號 / 自動選機台
  if (firstGroup) {
    onGroupChange(idx)
  }
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

  nextTick(runAllValidations)
}

// 複製模塊：copy table JSON + meta，**一定重新配一個新的 programCode**
async function duplicateBlock (i) {
  const src = blocks.value[i]
  const id = idSeq++

  blocks.value.push({
    id,
    code: '',
    meta: { ...(src.meta || {}) },
    data: { jsonParameterContent: paramEditors.value[i]?.getJSON(), metadata: { ...(src.data?.metadata || {}) } },
  })

  const newIdx = blocks.value.length - 1
  const b = blocks.value[newIdx]

  if (b.data?.jsonParameterContent) {
    paramEditors.value[newIdx] = makeParamEditor(
      b.data.jsonParameterContent,
      (editor) => {
        runParamValueValidation(editor)
        runParamDuplicateValidation()
      },
    )
  }

  if (b.meta.group) {
    await allocateNewCodeForBlock(newIdx)
  }

  nextTick(runAllValidations)
}

/* ===== Copy from 已簽核規格書 (Spec) ===== */
async function copyFromCode (targetIdx) {
  if (!copyCode.value) {
    return alert('請輸入要複製的代碼')
  }

  const code = copyCode.value.trim()

  try {
    const res = await copySpecParamFromCode(code)  // 呼叫 /parameters/copy-spec-source
    if (!res.success) {
      return alert(res.message || '複製失敗')
    }

    const payload = res.data?.blocks || {}
    const contentJson = payload.content_json
    const machine = payload.machine
    const machineGroup = payload.machineGroup

    if (!machine || !machineGroup) {
      return alert('來源資料異常：缺少群組或機台資訊')
    }

    // 確認群組是否存在於目前的 groupsMap
    const gInfo = groupsMap.value[machineGroup]
    if (!gInfo) {
      return alert(`無法複製：目前的適用工程不包含來源群組 (${machineGroup})`)
    }

    // 確認機台是否存在於該群組
    const mInfo = gInfo.machines[machine]
    if (!mInfo) {
      return alert(`無法複製：群組 ${machineGroup} 下沒有機台 (${machine})`)
    }

    const b = blocks.value[targetIdx]

    // 若原本就有程式碼，先釋放舊程式碼
    if (b.code) {
      try { await releaseProgramCode(b.code) } catch (e) {}
      b.code = ''
    }

    // 更新 meta
    b.meta.group = machineGroup
    b.meta.machine = machine

    // 更新 metadata：機台資訊
    const origMeta = b.data?.metadata || {}
    b.data = b.data || {}
    b.data.metadata = {
      ...origMeta,
      machineGroup: machineGroup,
      machineGroupName: gInfo.name || '',
      machine: machine,
      machineName: mInfo.name || '',
    }

    // 填入 editor 內容
    if (contentJson) {
      if (!paramEditors.value[targetIdx]) {
        paramEditors.value[targetIdx] = makeParamEditor(
          contentJson,
          (editor) => {
            runParamValueValidation(editor)
            runParamDuplicateValidation()
          },
        )
      } else {
        paramEditors.value[targetIdx].commands.setContent(contentJson, false)
      }
    }

    // 重新配一個新的程式號碼（對應到目前文件 / spec）
    await allocateNewCodeForBlock(targetIdx)

    runAllValidations()
    syncToParent()
    alert('複製成功')
  } catch (e) {
    console.error('copyFromCode error:', e)
    alert(e.message || '複製發生錯誤')
  }
}

/* ===== Event handlers ===== */

// 選擇群組：立即釋放舊 code、reset 機台/editor、再配新號碼
async function onGroupChange (i) {
  const b = blocks.value[i]
  const g = b.meta.group || ''

  // 釋放舊號碼
  if (b.code) {
    try { await releaseProgramCode(b.code) } catch (e) {}
    b.code = ''
  }

  // 清掉機台 & editor & PMS 狀態
  b.meta.machine = ''
  b.meta.specCode = ''  // 重新由 group 推 specCode
  if (paramEditors.value[i]) {
    paramEditors.value[i].destroy()
    paramEditors.value[i] = null
  }
  pmsLoading.value[i] = false
  pmsEmpty.value[i]   = false

  // 有選群組 → 直接配號
  if (g) {
    await allocateNewCodeForBlock(i)
    // 如果該群組底下只有一台機台 → 自動選擇 + 載 PMS
    autoSelectMachineIfUnique(i)
  }

  syncToParent()
}

// 選擇機台：更新 metadata、載入 PMS（不重新配號）
async function onMachineChange (i) {
  const b = blocks.value[i]
  const g = b.meta.group || ''
  const m = b.meta.machine || ''

  const origMeta = b.data?.metadata || {}
  b.data = b.data || {}
  b.data.metadata = {
    ...origMeta,
    machineGroup: g,
    machineGroupName: groupsMap.value[g]?.name || '',
    machine: m,
    machineName: getMachineNameByCode(g, m),
  }

  const machineId = getSelectedMachineId(i)
  if (machineId) {
    await seedFromMES(i, machineId)
  } else {
    if (paramEditors.value[i]) {
      paramEditors.value[i].destroy()
      paramEditors.value[i] = null
    }
    pmsLoading.value[i] = false
    pmsEmpty.value[i]   = false
  }

  syncToParent()
}

/* ===== Validations (沿用舊版) ===== */
function getParamMatrix (ed) {
  const mat = []
  let r = 0
  ed.state.doc.descendants((n) => {
    if (n.type.name === 'tableRow') {
      if (r > 0) {
        const row = []
        let ci = 0
        n.forEach(c => {
          if (ci >= 2 && ci <= 6) row.push(cellText(c) || '')
          ci++
        })
        mat.push(row)
      }
      r++
    }
  })
  return JSON.stringify(mat)
}

function runParamDuplicateValidation () {
  const sigs = paramEditors.value
    .map((ed, i) => (ed ? { i, sig: getParamMatrix(ed) } : null))
    .filter(Boolean)
  const dupIdx = new Set()
  for (let a = 0; a < sigs.length; a++) {
    for (let b = a + 1; b < sigs.length; b++) {
      if (sigs[a].sig === sigs[b].sig) {
        dupIdx.add(sigs[a].i)
        dupIdx.add(sigs[b].i)
      }
    }
  }
  paramEditors.value.forEach((ed, bIdx) => {
    if (!ed) return
    const dup = dupIdx.has(bIdx)
    const { state, view } = ed
    const tr = state.tr
    let r = 0
    state.doc.descendants((n, p) => {
      if (n.type.name === 'tableRow') {
        if (r > 0) {
          const want = dup ? 'dup-table' : ''
          if ((n.attrs.class || '') !== want) {
            tr.setNodeMarkup(p, undefined, { ...n.attrs, class: want })
          }
        }
        r++
      }
    })
    if (tr.docChanged) view.dispatch(tr)
  })
}

function runParamValueValidation (ed) {
  const { state, view } = ed
  const tr = state.tr
  const table = state.doc.content.firstChild
  if (!table || table.type.name !== 'table') return
  for (let r = 1; r < table.content.childCount; r++) {
    const row = table.content.child(r)
    const cells = row.content
    const values = []
    const status = []
    for (let c = 2; c <= 6; c++) {
      const txt = cellText(cells.child(c))
      if (txt === '') {
        values.push(null)
        status.push('value-empty')
      } else if (isFinite(Number(txt))) {
        values.push(Number(txt))
        status.push('value-valid')
      } else {
        values.push(null)
        status.push('value-invalid')
      }
    }
    for (let k = 1; k < values.length; k++) {
      const a = values[k - 1]; const b = values[k]
      if (a != null && b != null && a > b) {
        status[k - 1] = 'value-error'; status[k] = 'value-error'
      }
    }
    let posRow = 1
    for (let t = 0; t < r; t++) posRow += table.content.child(t).nodeSize
    const acc = [posRow + 1]
    for (let t = 0; t < cells.childCount - 1; t++) acc.push(acc[t] + cells.child(t).nodeSize)
    status.forEach((st, idx) => {
      const cellIdx = 2 + idx
      const at = acc[cellIdx]
      tr.setNodeMarkup(at, null, { ...cells.child(cellIdx).attrs, class: st })
    })
  }
  if (tr.docChanged) view.dispatch(tr)
}

function runAllValidations () {
  paramEditors.value.forEach(ed => ed && runParamValueValidation(ed))
  runParamDuplicateValidation()
}

/* ===== Export / sync to parent (沿用舊版，補上 group/machineName) ===== */
function extractTableArray (ed) {
  if (!ed) return []
  const t = ed.state.doc.content.firstChild
  if (!t || t.type.name !== 'table') return []
  const out = []
  t.content.forEach(row => {
    const r = []
    row.content.forEach(c => r.push(cellText(c)))
    out.push(r)
  })
  return out
}

function exportData () {
  return blocks.value.map((b, i) => {
    const ed = paramEditors.value[i]
    const origMeta = b.data?.metadata || {}

    const groupCode   = b.meta?.group || origMeta.machineGroup || ''
    const machineCode = b.meta?.machine || origMeta.machine || ''

    const machineName = getMachineNameByCode(groupCode, machineCode) || origMeta.machineName || ''
    const groupName   = groupsMap.value[groupCode]?.name || origMeta.machineGroupName || ''

    return {
      code: b.code,
      content_id: b.content_id,
      client_temp_id: b.client_temp_id,
      id: b.id,
      data: {
        jsonParameterContent: ed?.getJSON() || null,
        arrayParameterData: extractTableArray(ed),
        paramHeaderText: b.code,
        metadata: {
          ...origMeta,
          machineGroup: groupCode,
          machineGroupName: groupName,
          machine: machineCode,
          machineName,
        },
      },
    }
  })
}

let emitTimer = null
function syncToParent () {
  clearTimeout(emitTimer)
  emitTimer = setTimeout(() => emit('update:dataBlocks', exportData()), 120)
}

/* ===== init per index ===== */
function initEditors (i) {
  const b = blocks.value[i]
  const json = b.data?.jsonParameterContent
  if (!json) return
  const ed = makeParamEditor(
    json,
    (editor) => {
      runParamValueValidation(editor)
      runParamDuplicateValidation()
    },
  )
  if (ed) {
    paramEditors.value[i] = ed
    nextTick(runAllValidations)
  }
}

/* ===== Watch: 製程變化 → 釋放全部 code + 重抓 group/machine ===== */
watch(
  () => {
    if (Array.isArray(props.specification)) {
      return props.specification
        .map(s => s && s.code)
        .filter(Boolean)
        .join('|')
    }
    return props.specification && props.specification.code
      ? props.specification.code
      : ''
  },
  async () => {
    // 釋放所有程式號碼
    for (const b of blocks.value) {
      if (b.code) {
        try { await releaseProgramCode(b.code) } catch (e) {}
      }
    }

    // 清掉 editor / blocks
    paramEditors.value.forEach(e => e?.destroy())
    paramEditors.value = []
    blocks.value = []

    // 重新抓群組 / 機台
    await fetchGroups()
    addBlock()

    emit('machine-group-info', { hasAnyMachineGroup: hasAnyMachineGroup.value })
    syncToParent()
  },
)

/* ===== Mount / Unmount ===== */
onMounted(async () => {
  await fetchGroups()

  if (!props.dataBlocks.length) {
    // 新草稿
    addBlock()
  } else {
    // 從後端載入既有資料
    blocks.value = props.dataBlocks.map((blk, idx) => {
      const meta = blk.data?.metadata || {}
      const group = meta.machineGroup || meta.group || ''
      const machine = meta.machine || ''

      const programs = Array.isArray(meta.programs) ? meta.programs : []
      const firstProgram = programs[0] || {}

      const specCodeFromProgram = (firstProgram.specCode || '').trim()

      return {
        id: idSeq++,
        code: firstProgram.programCode || blk.code || '',
        content_id: blk.content_id,
        client_temp_id: blk.client_temp_id,
        meta: {
          group,
          machine,
          specCode: specCodeFromProgram || '',
        },
        data: blk.data || {},
      }
    })

    // 修正不合法的群組/機台
    blocks.value.forEach((b, i) => {
      if (!b.meta.group || !groupsMap.value[b.meta.group]) {
        b.meta.group = ''
      }
      const mk = Object.keys(groupsMap.value[b.meta.group]?.machines || {})
      if (!b.meta.machine || !mk.includes(b.meta.machine)) {
        b.meta.machine = ''
      }
    })

    // 初始化 editor / PMS
    await Promise.all(
      blocks.value.map(async (b, i) => {
        const hasJson = !!b.data?.jsonParameterContent
        const mid = getSelectedMachineId(i)

        if (hasJson) {
          paramEditors.value[i] = makeParamEditor(
            b.data.jsonParameterContent,
            (editor) => {
              runParamValueValidation(editor)
              runParamDuplicateValidation()
            },
          )
          pmsLoading.value[i] = false
          pmsEmpty.value[i] = false
        } else if (mid) {
          await seedFromMES(i, mid)
        } else {
          pmsLoading.value[i] = false
          pmsEmpty.value[i] = false
        }
      }),
    )
  }

  emit('machine-group-info', { hasAnyMachineGroup: hasAnyMachineGroup.value })
  nextTick(syncToParent)
})

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
.ed :deep(col:nth-child(1)) { width: 75%; }
.ed :deep(col:nth-child(2)) { width: 100%; }
.ed :deep(col:nth-child(3)) { width: 100%; }
.ed :deep(col:nth-child(4)) { width: 100%; }
.ed :deep(col:nth-child(5)) { width: 100%; }
.ed :deep(col:nth-child(6)) { width: 100%; }
.ed :deep(col:nth-child(7)) { width: 100%; }
.ed :deep(col:nth-child(8)) { width: 33%; }
.ed :deep(col:nth-child(9)) { width: 100%; }
.hint{ padding:12px; color:#555; background:#f8f9fb; border:1px dashed #cfd8dc; border-radius:6px; margin:8px 0 }
.hint.empty{ color:#9e9e9e; text-align:center; }
.menu-error { background: #ffcdd2; border-color: #f44336; }
</style>
