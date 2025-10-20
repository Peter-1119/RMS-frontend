<template>
  <div class="new-instruction-container">
    <div class="header">
      <button @click="$router.push('/home')" class="back-btn">
        <img src="@/assets/home-icon.png" alt="首頁" class="icon"> 回首頁
      </button>
      <h1>製造條件指示書</h1>
      <button class="save-btn" @click="saveDraft" :disabled="isSaving">
        <img src="@/assets/save-icon.png" alt="儲存" class="icon">
        {{ isSaving ? '儲存中…' : '暫存草稿' }}
      </button>
    </div>

    <div class="steps-navigation">
      <div v-for="(step, index) in steps" :key="index" :class="['step-item', { 'active': currentStep === index + 1, 'completed': currentStep > index + 1 }]" @click="goToStep(index + 1)">
        <div class="step-circle">{{ index }}</div>
        <div class="step-label">{{ step.label }}</div>
      </div>
    </div>

    <div class="form-section">
      <div v-if="currentStep === 1" class="step-content">
        <h2>基本屬性</h2>
        <div class="fundamental-attribute-block">
          <div class="attribute">
            <div class="form-group"><label for="doc-code">文管編號：</label><input type="text" id="doc-code" v-model="form.documentID" readonly/></div>
            <div class="form-group"><label for="doc-name">文件名稱：</label><input type="text" id="doc-name" v-model="form.documentName"/></div>
            <div class="form-group"><label for="doc-version">文件版本：</label><input type="text" id="doc-version" v-model="form.documentVersion" readonly/></div>
            <div class="form-group">
              <label for="apply-project">適用工程：</label>
              <input class="input-machine" type="text" id="apply-project" v-model="form.attribute.applyProject" @click="projectsListVisible=!projectsListVisible" readonly/>
            </div>
            <div class="form-group">
              <label for="machines">適用機台：</label>
              <input class="input-machine" type="text" id="machines" v-model="form.attribute.machines" @click="machinesListVisible=(form.attribute.applyProject.length > 0 && !machinesListVisible)" readonly/>
            </div>
            <div class="form-group"><label for="department">制訂單位：</label><input type="text" id="department" v-model="form.department" readonly/></div>
            <div class="form-group"><label for="author">制訂者：</label><input type="text" id="author" v-model="form.author" readonly/></div>
            <div class="form-group"><label for="approver">承認者：</label><input type="text" id="approver" v-model="form.approver"/></div>
            <div class="form-group"><label for="confirmer">確認者：</label><input type="text" id="confirmer" v-model="form.confirmer"/></div>
          </div>
          <div class="supplement">
            <div class="form-group"><label for="revise-reason">變更理由：</label><textarea id="revise-reason" v-model="form.reviseReason"></textarea></div>
            <div class="form-group"><label for="revise-point">變更要點：</label><textarea id="revise-point" v-model="form.revisePoint"></textarea></div>
          </div>
        </div>

        <ProjectListWindow 
          v-if="projectsListVisible"
          @selectProject="getProject"
          @cancel="projectsListVisible=false"
        ></ProjectListWindow>

        <MachinesListWindow 
          v-if="machinesListVisible"
          :project="form.attribute.applyProject"
          @selectMachine="getMachines"
          @cancel="machinesListVisible=false"
        ></MachinesListWindow>
      </div>

      <div v-if="currentStep === 2" class="step-content">
        <h2>目的</h2>
        <div class="purpose-group">
          <textarea v-model="form.documentPurpose" placeholder="此處將填寫文件的目的相關內容。"></textarea>
        </div>
      </div>

      <div v-if="currentStep === 3" class="step-content">
        <h2>製造流程</h2>
        <ProcessFlowBlock v-model="processFlowData" :cols="9" :token="draftToken"/>
      </div>

      <div v-if="currentStep === 4" class="step-content">
        <h2>管理條件</h2>
        <div class="Management">
          <button class="layer-action-btn add" @click="addManagementLayer">新增下一層</button>
        </div>
        
        <div class="management-combination-block">
          <ManagementSpecificBlock
            :machines="form.attribute.machines"
            :managementBlock="managementSpecific"
            @update-table-data="updateManagementTableData">
          </ManagementSpecificBlock>
        </div>
        <div v-if="managementBlocks.length > 0" class="management-content-bloc">
          <DynamicEditorBlock
            v-for="blk in managementBlocks"
            :key="blk.id"
            :block-editors="blk"
            @update-block="updateManagementBlockData"
            @delete-block="removeManagementLayer"
          />
        </div>
      </div>

      <div v-if="currentStep === 5" class="step-content">
        <h2>製造條件參數一覽表</h2>
        <ManufacturingConditionRuleBlocks
          :data-blocks="mcrBlocks"
          :cond-template="OPTS"
          :param-template="PARAM_ROWS"
          :current-step="currentStep"
          @update:dataBlocks="mcrBlocks = $event"
          @save="mcrBlocks = $event"/>
      </div>

      <div v-if="currentStep === 6" class="step-content">
        <h2>異常處置</h2>
        <div class="Exception">
          <button class="layer-action-btn add" @click="addExceptionLayer">新增下一層</button>
        </div>

        <template v-for="blockContent in exceptionBlocks" :key="blockContent.id">
          <DynamicEditorBlock
            :blockEditors="blockContent"
            @delete-block="removeExceptionLayer(blockContent.id)"
            @update-block="updateExceptionBlockData"
          ></DynamicEditorBlock>
        </template>
      </div>

      <div v-if="currentStep === 7" class="step-content">
        <h2>相關文件</h2>
        <div class="relative-document">
          <button class="layer-action-btn add" @click="docWindowVisible=true">新增文件</button>
        </div>

        <div v-for="(docInfo, docIndex) in relativeDocuments" class="document-block" :key="docInfo.id">
          <div class="doc-info-block">
            <label class="doc-label no">6.{{ docIndex + 1 }}</label>
            <label class="doc-label id">{{ docInfo.docId }}</label>  
            <label class="doc-label name">{{ docInfo.docName }}</label>
          </div>
          <div class="doc-btn-block">
            <button class="remove-btn" @click="relativeDocumentRemove(docInfo.id)">x</button>
          </div>
        </div>
        <DocSearchWindow 
          v-if="docWindowVisible"
          headerName="相關文件選取"
          :existingDocs="relativeDocuments"
          @add-new-doc="addRelativeDocument"
          @close-window="docWindowVisible=false">
        </DocSearchWindow>
      </div>

      <div v-if="currentStep === 8" class="step-content">
        <h2>使用表單</h2>
        <div class="used-form">
          <button class="layer-action-btn add" @click="formWindowVisible=true">新增表單</button>
        </div>

        <div v-for="(formInfo, formIndex) in usedForms" class="form-block" :key="formInfo.id">
          <div class="form-info-block">
            <label class="form-label no">7.{{ formIndex + 1 }}</label>
            <label class="form-label id">{{ formInfo.formId }}</label>  
            <label class="form-label name">{{ formInfo.formName }}</label>
          </div>
          <div class="form-btn-block">
            <button class="remove-btn" @click="formRemove(formInfo.id)">x</button>
          </div>
        </div>
        <FormSearchWindow 
          v-if="formWindowVisible"
          headerName="表單選取"
          :existingForms="usedForms"
          @add-new-form="addUsedForm"
          @close-window="formWindowVisible=false">
        </FormSearchWindow>
      </div>

      <div v-if="currentStep === 9" class="step-content">
        <div style="display: flex; justify-content: space-between;">
          <h2>文件產出</h2>
          <button @click="requestEIPAPI" class="layer-action-btn add">拋轉EIP</button>
        </div>
        <div v-if="pdfSrc" class="pdf-viewer">
          <iframe :src="pdfSrc" width="100%" height="600px" frameborder="0"></iframe>
        </div>
      </div>

      <div class="form-actions">
        <button v-if="currentStep > 1" @click="prevStep" class="nav-btn prev-btn">上一步</button>
        <button v-if="currentStep < steps.length" @click="nextStep" class="nav-btn next-btn">下一步</button>
        <button v-if="currentStep === steps.length" @click="submitForm" class="submit-btn">送出</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'

import ProjectListWindow from '@/components/ProjectListWindow.vue'
import MachinesListWindow from '@/components/MachinesListWindow.vue'
import ProcessFlowBlock from '@/components/ProcessFlowBlock.vue'
import ManagementSpecificBlock from '@/components/ManagementSpecificBlock.vue'
import DynamicEditorBlock from '@/components/DynamicEditorBlock.vue'
import ManufacturingConditionRuleBlocks from '@/components/ManufacturingConditionRuleBlocks.vue'
import DocSearchWindow from '@/components/DocSearchWindow.vue'
import FormSearchWindow from '@/components/FormSearchWindow.vue'
import { useDraftToken } from '@/composables/useDraftToken'

const { token: draftToken, setToken, clearToken } = useDraftToken('rms:draft:new-instruction')

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL

// --- ensure we have a server-side token row ---
const ensureDraftToken = async () => {
  if (draftToken.value) return draftToken.value
  try {
    const { data } = await axios.post(`${API_BASE_URL}/drafts/init`)
    if (data?.success && data.token) {
      setToken(data.token)                  // keep in URL + localStorage
      return data.token
    }
    throw new Error(data?.message || 'init failed')
  } catch (e) {
    console.error('drafts/init failed:', e)
    alert('建立草稿代碼失敗，請稍後再試')
    return null
  }
}

// ---------- nav / steps ----------
const currentStep = ref(1)
const steps = [
  { label: '基本屬性' }, { label: '目的' }, { label: '製造流程' }, { label: '管理條件' }, { label: '製造條件參數一覽表' }, { label: '異常處置' }, { label: '相關文件' }, { label: '使用表單' }, { label: '文件產出' },
]
const goToStep = s => { currentStep.value = s }
const nextStep = () => { if (currentStep.value < steps.length) currentStep.value++ }
const prevStep = () => { if (currentStep.value > 1) currentStep.value-- }

// ---------- basic form ----------
let itemID = 0
const form = reactive({
  documentType: 0,
  documentID: '',
  documentName: 'KF_RTR腔體銑削制程課-01_製造條件指示書',
  documentVersion: 1.0,
  attribute: { applyProject: '', machines: [] },
  department: sessionStorage.getItem('loggedInUserdeptName'),
  author_id: sessionStorage.getItem('loggedInUserNo'),
  author: sessionStorage.getItem('loggedInUserName'),
  approver: '',
  confirmer: '',
  issueDate: '2025/5/20',
  reviseReason: '',
  revisePoint: '',
  documentStyle: 'FM-R-MF-AZ-052 Rev9.0',
  documentPurpose: '',
})

// ---------- popups ----------
const projectsListVisible = ref(false)
const machinesListVisible = ref(false)
const getProject = val => { if (val) form.attribute.applyProject = val }
const getMachines = val => { 
  form.attribute.machines = val
  console.log("machines: ", form.attribute.machines)
  // form.attribute.machines = val ? val.join(', ') : ''
}

// ---------- process (step 3) ----------
const processFlowData = ref({
  mode: 'table',                // instead of 0/1, but you can keep 0/1 if you prefer
  cols: 9,
  header_json: null,
  items: [],
  file: null,                   // { asset_id, url, path }
})

// ---------- 管理條件 (step 4) ----------
const managementSpecific = ref({id: 0, step: 3, tier: 1, data: {jsonContent: null, arrayData: []}})

// handler for ManagementSpecificBlock
const updateManagementTableData = (payload) => {
  managementSpecific.value = payload
}

const managementBlocks = ref([])

// const managementBlocks = ref([{ id: 0, step: 3, tier: 1, data: {} }])
const addManagementLayer = () => {
  managementBlocks.value.push({
    id: ++itemID, step: 3, tier: managementBlocks.value.length + 2,
    data: [{ content_id: null, client_temp_id: `tmp-${itemID}`, option: 0, jsonHeader: null, jsonContent: null, files: [] }],
  })
}
const removeManagementLayer = id => {
  console.log("management blocks: ", managementBlocks.value)
  console.log("id: ", id)
  managementBlocks.value = managementBlocks.value.filter(b => b.id !== id).map((b, i) => ({...b, tier: i + 1}));
}
const updateManagementBlockData = payload => {
  const idx = managementBlocks.value.findIndex(b => b.id === payload.id)
  if (idx !== -1) managementBlocks.value[idx] = payload
}

const serializeManagementStep = () => {
  const rows = []

  // 3.1 管理基本條件 (table) -> sub_no = 1
  if (managementSpecific.value?.data?.jsonContent) {
    rows.push({
      step_type: 1,                  // 管理條件
      tier_no: managementSpecific.value.tier || 1,
      sub_no: 1,                     // 固定 3.1
      content_type: 2,               // table
      header_json: null,             // 3.1 沒有標題編輯器就留 null
      header_text: null,
      content_json: managementSpecific.value.data.jsonContent,
      content_text: null,            // 可不存純文字
      files: [],                     // 3.1 沒有 files 欄位
      metadata: { source: 'mgmt-3.1' }
    })
  }

  // 3.2+ 其他管理條件 (DynamicEditorBlock)
  // 每個 tier 一個 block，每個 block 的 data[] 是一組小節
  managementBlocks.value.forEach(blk => {
    const tier = blk.tier
    blk.data.forEach((item, idx) => {
      // map option → content_type
      // 0: title only → 0 (we still store header_json)
      // 1: text&picture → 1 (store header_json, content_text/json optional, files)
      // 2: table → 2 (store header_json, content_json; table images are inside json)
      const content_type =
        item.option === 0 ? 0 :
        item.option === 1 ? 1 : 2

      rows.push({
        step_type: 1,                      // 管理條件
        tier_no: tier,
        sub_no: idx + 2,                   // 從 3.2 開始
        content_type,
        header_json: item.jsonHeader || null,
        header_text: null,                 // 你不需要搜尋就不存
        content_json: content_type === 2 ? (item.jsonContent || null) : null,
        content_text: content_type === 1 ? null : null, // 如需，這裡可放純文字摘要
        files: Array.isArray(item.files) ? item.files : [],
        metadata: { source: 'mgmt-dynamic' }
      })
    })
  })

  return rows
}

// ---------- 製造條件參數一覽表 (step 5) ----------
const mcrBlocks = ref([])
const paramTemplate = ref(null)   // tiptap JSON for parameter table
const condTemplate  = ref(null)   // tiptap JSON for condition table

const OPTS = [
  {name: "銅電式樣", options: [{label:'全鍍',value:'full_plating'},{label:'多層板內外層',value:'mlb_inner_outer'},{label:'局部銅電鍍',value:'partial_copper_plating'},{label:'雙面板無鍍銅品',value:'double_sided_no_plating'}]},
  {name: "製品式樣", options: [{label:'雙面板',value:'double_sided'},{label:'多層板外層',value:'mlb_outer'},{label:'雙面板無鍍銅品',value:'double_sided_no_plating'},{label:'多層板內外層',value:'mlb_inner_outer'},{label:'多層板內外層局部銅電鍍品',value:'mlb_inner_outer_partial'},{label:'無鍍銅品',value:'no_plating'},{label:'多層板',value:'mlb'},{label:'多層板外層線路',value:'mlb_outer_circuit'},{label:'多層板外層局部銅電鍍品',value:'mlb_outer_partial'},{label:'全板銅電鍍品',value:'full_board_plating'},{label:'局部銅電鍍品',value:'partial_plating'},{label:'多層板內層',value:'mlb_inner'},{label:'單面板',value:'single_sided'},{label:'FP品目',value:'fp_item'},{label:'單面板雙面銅材無鍍銅',value:'single_sided_double_copper_no_plating'}]},
  {name: "流程", options: [{label:'RTR',value:'rtr'},{label:'RTS',value:'rts'},{label:'SBS',value:'sbs'}]},
  {name: "原銅厚度", options: [{label:'1',value:'1'},{label:'1/2',value:'1/2'},{label:'1/3',value:'1/3'},{label:'1/4',value:'1/4'}]},
  {name: "鍍銅厚度", options: [{label:'8',value:'8'},{label:'10',value:'10'},{label:'12',value:'12'},{label:'14',value:'14'},{label:'15',value:'15'},{label:'18',value:'18'}]},
  {name: "銅材種類", options: [{label:'ED銅',value:'ed_copper'},{label:'非HA銅',value:'non_ha_copper'},{label:'HA銅',value:'ha_copper'},{label:'LCP材',value:'lcp_material'},{label:'LCP',value:'lcp'}]},
  {name: "乾膜種類", options: [{label:'ADC-301',value:'adc_301'},{label:'FF-1030',value:'ff_1030'},{label:'HS-930',value:'hs_930'},{label:'HW-630',value:'hw_630'},{label:'AQ-209A',value:'aq_209a'},{label:'HY-920',value:'hy_920'},{label:'ADW-401',value:'adw_401'},{label:'H-9540',value:'h_9540'},{label:'FF-1040',value:'ff_1040'},{label:'FF-1020',value:'ff_1020'},{label:'AQ-1558',value:'aq_1558'}]},
]
const PARAM_ROWS = [
  ['槽體','管理項目','規格上限','操作上限','中值','操作下限','規格下限','單位','參數下放','說明'],
  ['熱水洗1','噴壓','','','','','','kgf/cm2','Y',''],
  ['熱水洗1','溫度','','','','','','℃','Y',''],
  ['剝膜1','氫氧化鈉NaOH','','','','','','%','Y',''],
  ['剝膜1','噴壓','','','','','','kgf/cm2','Y',''],
  ['剝膜1','作業溫度','','','','','','℃','Y','']
]

const requestConditionParameterDataStructure = async() => {
  if (form.attribute.machines.length == 0)
    return;

  try {
    const { conditiondata } = await axios.get(`${API_BASE_URL}/get-condition-data`)
    condTemplate.value = conditiondata.data
    const { parameterdata } = await axios.get(`${API_BASE_URL}/get-parameter-data`)
    paramTemplate.value = parameterdata.data
  } catch (e) {
    condTemplate.value = OPTS
    paramTemplate.value = PARAM_ROWS
    console.error('get condition data failed:', e)
    alert('取得條件參數失敗')
    return null
  }
}

const loadMCR = async (t) => {
  const { data } = await axios.get(`${API_BASE_URL}/drafts/${t}/mcr`)
  console.log("MCR data: ", data)
  if (!data?.success) return
  mcrBlocks.value = (data.blocks || []).map((b, i) => ({
    id: i + 1,
    code: b.code || `XXXX${i+1}`,
    data: {
      jsonParameterContent: b.data?.jsonParameterContent || null,
      arrayParameterData:   b.data?.arrayParameterData   || [],
      jsonConditionContent: b.data?.jsonConditionContent || null,
      arrayConditionData:   b.data?.arrayConditionData   || [],
    }
  }))
}

const serializeMCRows = () => {
  // mcrBlocks: [{ code, data:{ jsonParameterContent, arrayParameterData, jsonConditionContent, arrayConditionData } }]
  const rows = []
  mcrBlocks.value.forEach((blk, i) => {
    const tier = i + 1
    // sub_no 0 — parameter table (code in header_text)
    rows.push({
      step_type: 2,
      tier_no: tier,
      sub_no: 0,
      content_type: 2,
      header_text: blk.code || `XXXX${tier}`,
      header_json: null,
      content_json: blk.data?.jsonParameterContent || null,
      array_content: blk.data?.arrayParameterData || [],   // -> backend writes to content_text
      files: null,
      metadata: { source: 'mcr-parameter' },
    })
    // sub_no 1 — condition table
    rows.push({
      step_type: 2,
      tier_no: tier,
      sub_no: 1,
      content_type: 2,
      header_text: null,               // no textHeader here
      header_json: null,
      content_json: blk.data?.jsonConditionContent || null,
      array_content: blk.data?.arrayConditionData || [],   // -> backend writes to content_text
      files: null,
      metadata: { source: 'mcr-condition' },
    })
  })
  return rows
}

// ---------- 異常處置 (step 6) ----------
const exceptionBlocks = ref([])
const addExceptionLayer = () => {
  exceptionBlocks.value.push({
    id: ++itemID, step: 5, tier: exceptionBlocks.value.length + 1,
    data: [{ content_id: null, client_temp_id: `"tmp-${itemID}"`, option: 0, jsonHeader: null, jsonContent: null, files: [] }],
  })
}
const removeExceptionLayer = id => {
  exceptionBlocks.value = exceptionBlocks.value.filter(b => b.id !== id)
  exceptionBlocks.value.forEach((b, i) => (b.tier = i + 1))
}
const updateExceptionBlockData = payload => {
  const idx = exceptionBlocks.value.findIndex(b => b.id === payload.id)
  if (idx !== -1) exceptionBlocks.value[idx] = payload
}

// ---------- 相關文件 (step 7) ----------
const docWindowVisible = ref(false)
const relativeDocuments = ref([])
const addRelativeDocument = ({ docId, docName }) => {
  relativeDocuments.value.push({ id: itemID++, docId, docName })
  docWindowVisible.value = false
}
const relativeDocumentRemove = id => {
  relativeDocuments.value = relativeDocuments.value.filter(d => d.id !== id)
}

// ---------- 使用表單 (step 8) ----------
const formWindowVisible = ref(false)
const usedForms = ref([])
const addUsedForm = ({ formId, formName }) => {
  usedForms.value.push({ id: itemID++, formId, formName })
  formWindowVisible.value = false
}
const formRemove = id => {
  usedForms.value = usedForms.value.filter(f => f.id !== id)
}

// ---------- 文件產出 (step 9) — skipped per your request ----------
const pdfSrc = ref(null)
// keep a stub so template calls don’t break
const generateAndDisplayPdf = () => {
  console.warn('generateAndDisplayPdf skipped (data structure WIP).')
}
const requestEIPAPI = () => {
  console.warn('requestEIPAPI skipped.')
}

// ---------- saving ----------
const isSaving = ref(false)

// deep-clone to plain JSON and strip any reactive proxies
const toPlain = v => JSON.parse(JSON.stringify(v))

const serializeForSave = () => ({
  form: toPlain(form),
  managementBlocks: toPlain(managementBlocks.value),
  manufacturingBlocks: toPlain(manufacturingBlocks.value),
  exceptionBlocks: toPlain(exceptionBlocks.value),
  relativeDocuments: toPlain(relativeDocuments.value),
  usedForms: toPlain(usedForms.value),
})

const saveDraft = async () => {
  const t = await ensureDraftToken()
  if (!t) return

  try {
    // 1) attributes
    const { data: a } = await axios.post(`${API_BASE_URL}/drafts/save`, {
      token: t,
      form,
    })
    if (!a?.success) return alert(a?.message || '屬性儲存失敗')

    // 2) process flow (你已經有)
    await axios.post(`${API_BASE_URL}/drafts/save-process-flow`, {
      token: t,
      processFlow: {
        mode: processFlowData.value.mode,
        cols: processFlowData.value.cols,
        header_json: processFlowData.value.header_json,
        items: processFlowData.value.items,
        file: processFlowData.value.file,
      }
    })

    // 3) management step (NEW)
    const mgmtRows = serializeManagementStep()
    await axios.post(`${API_BASE_URL}/drafts/save-management`, {
      token: t,
      rows: mgmtRows,
    })

    const mcrRows = serializeMCRows()
    await axios.post(`${API_BASE_URL}/drafts/save-mcr`, { token: t, rows: mcrRows })

    alert(`草稿已儲存（時間：${a.issueTime || ''}）`)
  } catch (e) {
    console.error(e)
    alert('儲存草稿失敗')
  }
}


onMounted(async () => {
  const t = await ensureDraftToken()
  if (!t) return

  try {
    // 1) attributes
    const res = await axios.get(`${API_BASE_URL}/drafts/${t}`)
    if (res.data?.success) Object.assign(form, res.data.form || {})

    // 2) process flow
    const pf = await axios.get(`${API_BASE_URL}/drafts/${t}/process-flow`)
    if (pf.data?.success) processFlowData.value = pf.data.processFlow

    // 3) management step (NEW → rebuild your two UIs)
    const mg = await axios.get(`${API_BASE_URL}/drafts/${t}/management`)
    if (mg.data?.success) {
      const { specific, dynamics } = mg.data

      // 3.1
      if (specific) {
        managementSpecific.value = {
          id: 0,
          step: 3,
          tier: specific.tier_no || 1,
          data: {jsonContent: specific.content_json || null, arrayData: specific.arrayData || []}
        }
      }

      // 3.2+ dynamic
      managementBlocks.value = (dynamics || []).map((blk, i) => ({
        id: i + 1,
        step: 3,
        tier: blk.tier_no,
        data: blk.items.map(it => ({
          content_id: it.content_id || null,
          client_temp_id: it.client_temp_id || null,
          option: it.option,                // 0/1/2
          jsonHeader: it.jsonHeader || null,
          jsonContent: it.jsonContent || null,
          files: it.files || []
        }))
      }))

      loadMCR(t)
    }
  } catch (e) {
    console.error(e)
    alert('載入草稿失敗')
  }
})


</script>


<style scoped>
.new-instruction-container { width: 90%; margin: 30px auto; padding: 25px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }

.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
.header h1 { margin: 0; font-size: 28px; color: #333; }

.back-btn, .save-btn {
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 15px;
  display: flex;
  align-items: center;
  transition: background-color 0.3s ease;
}
.back-btn:hover, .save-btn:hover { background-color: #5a6268; }
.back-btn .icon, .save-btn .icon { width: 18px; height: 18px; margin-right: 8px; filter: invert(100%); }

.steps-navigation {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30px;
  background-color: #e3f2fd; /* 淺藍色背景 */
  padding: 15px 10px;
  border-radius: 8px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
  position: sticky; /* 關鍵屬性 */
  top: 0;           /* 滾動到距離視窗頂部 0px 時固定 */
  z-index: 1000;    /* 確保它在其他內容之上，避免被覆蓋 */
  box-shadow: 0 2px 5px rgba(0,0,0,0.7); /* 增加一點陰影，讓它看起來更像是浮動在上面 */
}
.step-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; opacity: 0.7; transition: opacity 0.3s ease, transform 0.2s ease; }
.step-item:hover { opacity: 1; transform: translateY(-2px); }
.step-item.active { opacity: 1; }
.step-item.completed .step-circle { background-color: #28a745; color: white; }
.step-item.active .step-circle { background-color: #007bff; color: white; box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.25); }
.step-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #cccccc;
  color: #555;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 18px;
  margin-bottom: 8px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}
.step-label { font-size: 14px; color: #555; text-align: center; }
.step-item.active .step-label { color: #007bff; font-weight: bold; }

.form-section { padding: 20px 0; }

.step-content { background-color: #f9f9f9; padding: 25px; border-radius: 8px; min-height: 250px; border: 1px solid #e0e0e0; }
.step-content h2 { font-size: 22px; color: #333; margin-top: 0; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #007bff; display: inline-block; }

.fundamental-attribute-block { display: flex; border: unset; padding: 0px; }
.fundamental-attribute-block .attribute { display: flex; flex-direction: column; width: 100%; }
.fundamental-attribute-block .supplement { display: flex; flex-direction: column; width: 100%; }
.form-group { display: flex; flex-direction: row; align-items: center; margin-bottom: 8px; padding: 8px; }
.form-group label { width: 20%; font-size: 15px; color: #555; margin-bottom: 8px; font-weight: bold; }
.form-group input, .form-group textarea, .form-group select { width: 70%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 15px; box-sizing: border-box; transition: border-color 0.2s ease; }
.form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: #008bff; outline: none; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);}
.form-group textarea { resize: vertical; min-height: 80px; }
.form-group input[readonly] { background-color: #e9ecef; color: #495057; cursor: not-allowed; }
.form-group input.input-machine { background: white; cursor: pointer; }

.form-actions { display: flex; justify-content: flex-end; margin-top: 30px; gap: 15px; }

.nav-btn, .submit-btn {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;
}
.nav-btn.prev-btn { background-color: #6c757d; }
.nav-btn:hover { background-color: #0056b3; }
.nav-btn.prev-btn:hover { background-color: #5a6268; }

.submit-btn { background-color: #28a745; }
.submit-btn:hover { background-color: #218838; }
.purpose-group { width: 100%; flex-grow: 1; height: 50%; }

.purpose-group textarea {
  width: 100%;       /* 佔據其父容器 (.purpose-group) 的全部寬度 */
  height: 100%;      /* 佔據其父容器 (.purpose-group) 的全部高度 */
  min-height: 150px; /* <--- 設置一個最小高度，確保即使父容器高度不足也能顯示 */
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;   /* 調整字體大小 */
  box-sizing: border-box; /* <--- 確保 padding 和 border 不會增加總寬高 */
  resize: vertical;  /* 允許使用者垂直拖動調整大小 */
  transition: border-color 0.2s ease;
}

.purpose-group textarea:focus { border-color: #007bff; outline: none; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1); }

/* 管理條件頁面特定樣式 */
.layer-action-btn {
  margin: 10px;
  background-color: #1666C0;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 5px;
  font-size: 14px;
  cursor: pointer;
}

.document-block { display: flex; justify-content: space-between; padding: 10px; margin: 10px 10px; border: 1px solid #ddd; }
.doc-label { padding: 8px 10px; }
.doc-label.no { border-right: 1px solid #ddd; }
.doc-label.id { display: inline-block; width: 200px; border-right: 1px solid #ddd; }
.doc-btn-block { display: flex; align-items: center;}

.form-block { display: flex; justify-content: space-between; padding: 10px; margin: 10px 10px; border: 1px solid #ddd; }
.form-label { padding: 8px 10px; }
.form-label.no { border-right: 1px solid #ddd; }
.form-label.id { display: inline-block; width: 200px; border-right: 1px solid #ddd; }
.form-btn-block { display: flex; align-items: center;}
.remove-btn { background: none; border: none; color: red; font-weight: bold; cursor: pointer; font-size: 1.2em; }

</style>