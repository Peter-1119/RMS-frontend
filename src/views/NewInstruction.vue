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

        <DynamicEditorBlock
          v-for="blockContent in exceptionBlocks"
          :key="blockContent.id"
          :blockEditors="blockContent"
          @delete-block="removeExceptionLayer(blockContent.id)"
          @update-block="updateExceptionBlockData"
        ></DynamicEditorBlock>
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
import {
  initDoc,
  saveAttributes, loadAttributes,
  saveBlocks,   loadBlocks,
  saveParams,   loadParams,
  saveReferences, loadReferences,
} from '@/api/docsApi'

const { token: draftToken, setToken, clearToken } = useDraftToken('rms:draft:new-instruction')

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL

// --- ensure we have a server-side token row ---
const ensureDraftToken = async () => {
  if (draftToken.value) return draftToken.value
  try {
    const res = await initDoc(0)
    if (res?.success && res.token) {
      setToken(res.token)
      return res.token
    }
    throw new Error(res?.message || 'init failed')
  } catch (e) {
    console.error('docs/init failed:', e)
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

// process-flow <-> blocks (step_type = 0)
function serializeProcessFlowToBlocks(pf) {
  if (pf.mode === 'table') {
    return [{
      tier: 1,
      data: [{
        option: 2,
        jsonHeader: pf.header_json || null,
        jsonContent: { cols: Number(pf.cols || 9), items: Array.isArray(pf.items) ? pf.items : [] },
        files: []
      }]
    }]
  }
  return [{
    tier: 1,
    data: [{
      option: 1,
      jsonHeader: pf.header_json || null,
      jsonContent: null,
      files: pf.file ? [pf.file] : []
    }]
  }]
}

// from blocks (for load)
function loadProcessFlowFromBlocks(resp) {
  const firstTier = (resp?.blocks || [])[0]
  const first = (firstTier?.data || [])[0]
  if (!first) return { mode: 'table', cols: 9, header_json: null, items: [], file: null }

  if (first.option === 2) {
    const cj = first.jsonContent || {}
    return { mode: 'table', cols: Number(cj.cols || 9), header_json: first.jsonHeader || null, items: Array.isArray(cj.items) ? cj.items : [], file: null }
  }
  if (first.option === 1) {
    return { mode: 'image', cols: 9, header_json: first.jsonHeader || null, items: [], file: (first.files || [])[0] || null }
  }
  return { mode: 'table', cols: 9, header_json: null, items: [], file: null }
}

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
  managementBlocks.value = managementBlocks.value.filter(b => b.id !== id).map((b, i) => ({...b, tier: i + 1}));
}
const updateManagementBlockData = payload => {
  const idx = managementBlocks.value.findIndex(b => b.id === payload.id)
  if (idx !== -1) managementBlocks.value[idx] = payload
}

const serializeManagementToBlocks = () => {
  // shape expected by /docs/blocks/save:
  // [{ tier, data:[ {option, jsonHeader, jsonContent, files} ] }, ...]
  const out = []

  // 3.1 specific — treat as tier 1 with a single table (option=2)
  if (managementSpecific.value?.data?.jsonContent) {
    out.push({
      tier: managementSpecific.value.tier || 1,
      data: [{
        option: 2,
        jsonHeader: null,
        jsonContent: managementSpecific.value.data.jsonContent,
        files: []
      }]
    })
  }

  // 3.2+ dynamic — each UI block is a tier
  managementBlocks.value.forEach(blk => {
    out.push({
      tier: blk.tier,
      data: (blk.data || []).map(it => ({
        option: it.option ?? 0,            // 0 title / 1 text-img / 2 table
        jsonHeader: it.jsonHeader || null,
        jsonContent: it.jsonContent || null,
        files: Array.isArray(it.files) ? it.files : []
      }))
    })
  })
  return out
}

const loadManagementFromBlocks = (payload) => {
  // payload.blocks: [{ tier, data:[...] }]
  // Rebuild your two UIs: first row as “specific” (if table), others as dynamic.
  managementSpecific.value = { id: 0, step: 3, tier: 1, data: { jsonContent: null, arrayData: [] } }
  managementBlocks.value = []

  ;(payload.blocks || []).forEach((blk, i) => {
    const first = (blk.data || [])[0]
    // heuristic: if this tier has exactly one item and it's a table, use it as 3.1
    if (i === 0 && first && first.option === 2) {
      managementSpecific.value = {
        id: 0,
        step: 3,
        tier: blk.tier,
        data: { jsonContent: first.jsonContent || null, arrayData: [] }
      }
    } else {
      managementBlocks.value.push({
        id: i + 1,
        step: 3,
        tier: blk.tier,
        data: (blk.data || []).map(it => ({
          content_id: null,
          client_temp_id: null,
          option: it.option ?? 0,
          jsonHeader: it.jsonHeader || null,
          jsonContent: it.jsonContent || null,
          files: it.files || []
        }))
      })
    }
  })
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

// NEW — send both parameter & condition for each tier
const serializeMCRToParams = () => {
  return (mcrBlocks.value || []).map((blk, i) => ({
    tier_no: i + 1,
    code: blk.code || `XXXX${i + 1}`,
    jsonParameterContent: blk.data?.jsonParameterContent || null,
    arrayParameterData:   blk.data?.arrayParameterData   || [],
    jsonConditionContent: blk.data?.jsonConditionContent || null,
    arrayConditionData:   blk.data?.arrayConditionData   || [],
  }))
}

// NEW — rebuild the exact structure you render
const loadMCRFromParams = (payload) => {
  // payload.blocks: [{id, code, jsonParameterContent, arrayParameterData, jsonConditionContent, arrayConditionData}]
  mcrBlocks.value = (payload.blocks || []).map((b, i) => ({
    id: i + 1,
    code: b.code || `XXXX${i + 1}`,
    data: {
      jsonParameterContent: b.jsonParameterContent || null,
      arrayParameterData:   b.arrayParameterData   || [],
      jsonConditionContent: b.jsonConditionContent || null,
      arrayConditionData:   b.arrayConditionData   || [],
    },
  }))
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

const serializeExceptionsToBlocks = () => {
  return (exceptionBlocks.value || [])
    .sort((a,b) => (a.tier||0) - (b.tier||0))
    .map(blk => ({
      tier: blk.tier,
      data: (blk.data || []).map(it => ({
        option: it.option ?? 0,              // 0/1/2 map to content_type
        jsonHeader: it.jsonHeader || null,
        jsonContent: it.jsonContent || null,
        files: Array.isArray(it.files) ? it.files : []
      }))
    }))
}

const loadExceptionsFromBlocks = (payload) => {
  exceptionBlocks.value = (payload.blocks || []).map((blk, i) => ({
    id: i + 1,
    step: 5,
    tier: blk.tier,
    data: (blk.data || []).map(it => ({
      content_id: null,
      client_temp_id: null,
      option: it.option ?? 0,
      jsonHeader: it.jsonHeader || null,
      jsonContent: it.jsonContent || null,
      files: it.files || []
    }))
  }))
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

const saveDraft = async () => {
  const t = await ensureDraftToken()
  if (!t) return
  try {
    // 1) attributes
    const a = await saveAttributes(t, form)
    if (!a?.success) return alert(a?.message || '屬性儲存失敗')

    const pfBlocks = serializeProcessFlowToBlocks(processFlowData.value)
    await saveBlocks(t, 0, pfBlocks)  // step_type = 0

    // 3) management → generic blocks (step_type = 1)
    const mgmtBlocks = serializeManagementToBlocks()
    await saveBlocks(t, 1, mgmtBlocks)

    // 4) MCR parameters
    const paramsPayload = serializeMCRToParams()
    await saveParams(t, paramsPayload, 2) // step_type=2

    // 5) exceptions → generic blocks (step_type = 3)
    const excBlocks = serializeExceptionsToBlocks()
    await saveBlocks(t, 3, excBlocks)

    // 6) references
    await saveReferences(t, {
      documents: (relativeDocuments.value || []).map(d => ({ docId: d.docId, docName: d.docName })),
      forms: (usedForms.value || []).map(f => ({ formId: f.formId, formName: f.formName })),
    })

    alert(`草稿已儲存（時間：${a.issueTime || ''}）`)
  } catch (e) {
    console.error(e)
    alert('儲存草稿失敗')
  }
}

// ---------- Load on mount ----------
onMounted(async () => {
  const t = await ensureDraftToken()
  if (!t) return
  try {
    // 1) attributes
    const a = await loadAttributes(t)
    if (a?.success) Object.assign(form, a.form || {})

    // 2) process flow (only if you add GET in backend)
    const pfResp = await loadBlocks(t, 0)
    if (pfResp?.success) processFlowData.value = loadProcessFlowFromBlocks(pfResp)

    // 3) management
    const mg = await loadBlocks(t, 1) // step_type=1
    if (mg?.success) loadManagementFromBlocks(mg)

    // 4) MCR
    const mp = await loadParams(t, 2)
    if (mp?.success) loadMCRFromParams(mp)

    // 5) exceptions
    const ex = await loadBlocks(t, 3)
    if (ex?.success) loadExceptionsFromBlocks(ex)

    // 6) references
    const r = await loadReferences(t)
    if (r?.success) {
      let nextId = 1
      relativeDocuments.value = (r.documents || []).map(d => ({ id: nextId++, docId: d.docId, docName: d.docName }))
      usedForms.value = (r.forms || []).map(f => ({ id: nextId++, formId: f.formId, formName: f.formName }))
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