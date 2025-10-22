<template>
  <div class="new-specification-container">
    <!-- Header -->
    <div class="header">
      <button @click="$router.push('/home')" class="back-btn">
        <img src="@/assets/home-icon.png" alt="首頁" class="icon" /> 回首頁
      </button>
      <h1>製造式樣書</h1>
      <button @click="saveDraft" class="save-btn">
        <img src="@/assets/save-icon.png" alt="儲存" class="icon" />暫存草稿
      </button>
    </div>

    <!-- Steps -->
    <div class="step-navigation">
      <div
        v-for="(step, idx) in steps"
        :key="idx"
        :class="['step-item', { active: currentStep === idx + 1, completed: currentStep > idx + 1 }]"
        @click="goToStep(idx + 1)"
      >
        <div class="step-circle">{{ idx }}</div>
        <div class="step-label">{{ step.label }}</div>
      </div>
    </div>

    <!-- Content -->
    <div class="form-section">
      <!-- Step 1 基本屬性 -->
      <div v-if="currentStep === 1" class="step-content">
        <h2>基本屬性</h2>
        <div class="fundamental-attribute-block">
          <div class="attribute">
            <div class="form-group">
              <label for="doc-code">文管編號：</label>
              <input id="doc-code" type="text" v-model="form.documentID" readonly />
            </div>
            <div class="form-group">
              <label for="doc-name">文件名稱：</label>
              <input id="doc-name" type="text" v-model="form.documentName" readonly />
            </div>
            <div class="form-group">
              <label for="doc-version">文件版本：</label>
              <input id="doc-version" type="text" v-model="form.documentVersion" readonly />
            </div>

            <div class="form-group">
              <label for="item-type">品目：</label>
              <input
                id="item-type"
                class="window-select"
                type="text"
                v-model="form.attribute.itemType"
                @click="itemsListVisible = !itemsListVisible"
                readonly
              />
            </div>

            <div class="form-group">
              <label for="apply-project">適用工程：</label>
              <input
                id="apply-project"
                class="window-select"
                type="text"
                v-model="form.attribute.specific"
                @click="specificsListVisible = true"
                readonly
              />
            </div>

            <div class="form-group">
              <label for="style-no">式樣NO：</label>
              <input id="style-no" type="text" v-model="form.attribute.styleNo" readonly />
            </div>
            <div class="form-group">
              <label for="style-version">式樣版本：</label>
              <input id="style-version" type="text" v-model="form.attribute.styleVersion" readonly />
            </div>

            <div class="form-group">
              <label for="department">制訂單位：</label>
              <input id="department" type="text" v-model="form.department" readonly />
            </div>
            <div class="form-group">
              <label for="author">制訂者：</label>
              <input id="author" type="text" v-model="form.author" readonly />
            </div>
            <div class="form-group">
              <label for="approver">承認者：</label>
              <input id="approver" type="text" v-model="form.approver" />
            </div>
            <div class="form-group">
              <label for="confirmer">確認者：</label>
              <input id="confirmer" type="text" v-model="form.confirmer" />
            </div>
          </div>

          <div class="supplement">
            <div class="form-group">
              <label for="revise-reason">變更理由：</label>
              <textarea id="revise-reason" v-model="form.reviseReason" />
            </div>
            <div class="form-group">
              <label for="revise-point">變更要點：</label>
              <textarea id="revise-point" v-model="form.revisePoint" />
            </div>
          </div>
        </div>
      </div>

      <!-- Pickers -->
      <SpecificListWindow
        v-if="specificsListVisible"
        @selectSpecific="onSelectSpecific"
        @cancel="specificsListVisible = false"
      />
      <ItemListWindow
        v-if="itemsListVisible"
        :items="requestItemFromAPI()"
        @selectItem="onSelectItemType"
        @cancel="itemsListVisible = false"
      />

      <!-- Step 2 目的 -->
      <div v-if="currentStep === 2" class="step-content">
        <h2>目的</h2>
        <div class="purpose-group">
          <textarea placeholder="此處將填寫文件的目的相關內容" v-model="form.documentPurpose"></textarea>
        </div>
      </div>

      <!-- Step 3 製作條件規範 → DynamicEditorBlock -->
      <div v-if="currentStep === 3" class="step-content">
        <h2>製作條件規範</h2>
        <div class="manufacturing-specification-block">
          <button class="layer-action-btn add" @click="addSpecLayer">新增下一層</button>
        </div>

        <DynamicEditorBlock
          v-for="blk in specBlocks"
          :key="blk.id"
          :block-editors="blk"
          @update-block="updateSpecLayer"
          @delete-block="removeSpecLayer(blk.id)"
        />
      </div>

      <!-- Step 4 製造參數一覽表（只有參數表；獨立元件） -->
      <div v-if="currentStep === 4" class="step-content">
        <h2>製造參數一覽表</h2>
        <div class="Parameters">
          <button class="layer-action-btn add" @click="addParamLayer">新增組合</button>
        </div>
        <ManufacturingParameterBlocks
          v-model="paramBlocks"
          :machine-groups="machineGroups"
          code-prefix="XXXY"
        />
        <!--
        <ManufacturingParamTable
          v-for="(blk, i) in paramBlocks"
          :key="blk.id"
          :index="i"
          :code="blk.code"
          :machineGroups="machineGroups"
          :data="blk"
          :is-duplicate="duplicateMap[i] || false"
          @update="onParamBlockUpdate"
          @copy="copyParamBlock(i)"
          @delete="removeParamBlock(blk.id)"
        />
        -->
      </div>

      <!-- Step 5 適用品質與規格內容 → DynamicEditorBlock -->
      <div v-if="currentStep === 5" class="step-content">
        <h2>適用品質與規格內容</h2>
        <div class="quality-specification-block">
          <button class="layer-action-btn add" @click="addQualityLayer">新增下一層</button>
        </div>

        <DynamicEditorBlock
          v-for="blk in qualityBlocks"
          :key="blk.id"
          :block-editors="blk"
          @update-block="updateQualityLayer"
          @delete-block="removeQualityLayer(blk.id)"
        />
      </div>

      <!-- Step 6 使用表單 -->
      <div v-if="currentStep === 6" class="step-content">
        <h2>使用表單</h2>
        <div class="used-form">
          <button class="layer-action-btn add" @click="formWindowVisible = true">新增表單</button>
        </div>

        <div v-for="(f, idx) in usedForms" :key="f.id" class="form-block">
          <div class="form-info-block">
            <label class="form-label no">5.{{ idx + 1 }}</label>
            <label class="form-label id">{{ f.formId }}</label>
            <label class="form-label name">{{ f.formName }}</label>
          </div>
          <div class="form-btn-block">
            <button class="remove-btn" @click="removeUsedForm(f.id)">x</button>
          </div>
        </div>
      </div>

      <FormSearchWindow
        v-if="formWindowVisible"
        headerName="表單選取"
        :existingForms="usedForms"
        @add-new-form="addUsedForm"
        @close-window="formWindowVisible = false"
      />

      <!-- Step 7 其他 → DynamicEditorBlock -->
      <div v-if="currentStep === 7" class="step-content">
        <h2>其它</h2>
        <div class="other-block">
          <button class="layer-action-btn add" @click="addOtherLayer">新增下一層</button>
        </div>

        <DynamicEditorBlock
          v-for="blk in otherBlocks"
          :key="blk.id"
          :block-editors="blk"
          @update-block="updateOtherLayer"
          @delete-block="removeOtherLayer(blk.id)"
        />
      </div>

      <!-- Step 8 文件產出（PDF 先略） -->
      <div v-if="currentStep === 8" class="step-content">
        <div style="display:flex;justify-content:space-between;">
          <h2>文件產出</h2>
          <button class="layer-action-btn add" disabled>拋轉EIP（稍後改 Word ）</button>
        </div>
        <div class="pdf-viewer muted">
          （產出改版中，稍後接 Word 範本）
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'

// Components
import DynamicEditorBlock from '@/components/DynamicEditorBlock.vue'
import FormSearchWindow from '@/components/FormSearchWindow.vue'
import SpecificListWindow from '@/components/SpecificListWindow.vue'
import ItemListWindow from '@/components/ItemListWindow.vue'
import ManufacturingParameterBlocks from '@/components/ManufacturingParameterBlocks.vue'

// Token bootstrap (same pattern as NewInstruction.vue)
import { useDraftToken } from '@/composables/useDraftToken'

// -------------------------------
// Constants / wiring
// -------------------------------
const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL
const { token: draftToken, setToken } = useDraftToken('rms:draft:new-specification')

// steps
const steps = [
  { label: '基本屬性' },
  { label: '目的' },
  { label: '製作條件規範' },       // step 3 → specBlocks (step code 2)
  { label: '條件參數一覽表' },     // step 4 → paramBlocks (parameters only)
  { label: '適用品質與規格內容' }, // step 5 → qualityBlocks (step code 4)
  { label: '使用表單' },           // step 6 → usedForms
  { label: '其他' },               // step 7 → otherBlocks (step code 6)
  { label: '文件匯出' },           // step 8 → (ignored for now)
]
const currentStep = ref(1)

// -------------------------------
// Base form (basic attributes)
// -------------------------------
const form = reactive({
  documentType: 1, // specification
  documentID: '',
  documentName: '',
  documentVersion: 1.0,
  attribute: {
    itemType: '',
    specific: '',
    styleNo: '',
    styleVersion: '',
  },
  department: sessionStorage.getItem('loggedInUserdeptName') || '',
  author: sessionStorage.getItem('loggedInUserName') || '',
  approver: '',
  confirmer: '',
  issueDate: '',
  reviseReason: '',
  revisePoint: '',
  documentStyle: '',
  documentPurpose: '',
})

// -------------------------------
// Pickers / windows
// -------------------------------
const specificsListVisible = ref(false)
const itemsListVisible = ref(false)

function requestItemFromAPI() {
  return [
    { factoryCode: '1011', itemCode: 'YD12345' },
    { factoryCode: '1011', itemCode: 'YD18379' },
    { factoryCode: '1011', itemCode: 'YD98765' },
  ]
}

function onSelectItemType(payload) {
  form.attribute.itemType = payload?.itemCode || ''
  form.documentName = `${form.attribute.itemType}_${form.attribute.specific}_製造式樣書`
  itemsListVisible.value = false
}

const machineGroups = ref([])
async function fetchMachineGroups(specific) {
  machineGroups.value = []
  if (!specific) return
  try {
    const { data } = await axios.get(`${API_BASE_URL}/MES-get-groups-machines`, { params: { specific } })
    machineGroups.value = data?.data?.groups || []
  } catch (e) {
    console.error('fetchMachineGroups failed:', e)
  }
}

async function onSelectSpecific(name) {
  form.attribute.specific = name || ''
  form.documentName = `${form.attribute.itemType}_${form.attribute.specific}_製造式樣書`
  specificsListVisible.value = false
  await fetchMachineGroups(form.attribute.specific)
}

// -------------------------------
// Dynamic blocks (3, 5, 7)
// -------------------------------
let uid = 1

const specBlocks = ref([])     // step 3 → backend step_type 2
const qualityBlocks = ref([])  // step 5 → backend step_type 4
const otherBlocks = ref([])    // step 7 → backend step_type 6

const makeBlock = (stepCode, tier) => ({
  id: uid++,
  step: stepCode,         // 2 / 4 / 6
  tier,
  data: [
    {
      option: 0,          // 0:title, 1:text/img, 2:table
      jsonHeader: null,
      jsonContent: null,
      files: [],
    },
  ],
})

// step 3
function addSpecLayer() { 
    specBlocks.value.push(makeBlock(2, specBlocks.value.length + 1)) 
    console.log("spec blocks: ", specBlocks)
}
function removeSpecLayer(id) {
  specBlocks.value = specBlocks.value.filter(b => b.id !== id).map((b, i) => ({ ...b, tier: i + 1 }))
}
function updateSpecLayer(payload) {
  const i = specBlocks.value.findIndex(b => b.id === payload.id)
  if (i !== -1) specBlocks.value[i] = payload
}

// step 5
function addQualityLayer() { qualityBlocks.value.push(makeBlock(4, qualityBlocks.value.length + 1)) }
function removeQualityLayer(id) {
  qualityBlocks.value = qualityBlocks.value.filter(b => b.id !== id).map((b, i) => ({ ...b, tier: i + 1 }))
}
function updateQualityLayer(payload) {
  const i = qualityBlocks.value.findIndex(b => b.id === payload.id)
  if (i !== -1) qualityBlocks.value[i] = payload
}

// step 7
function addOtherLayer() { otherBlocks.value.push(makeBlock(6, otherBlocks.value.length + 1)) }
function removeOtherLayer(id) {
  otherBlocks.value = otherBlocks.value.filter(b => b.id !== id).map((b, i) => ({ ...b, tier: i + 1 }))
}
function updateOtherLayer(payload) {
  const i = otherBlocks.value.findIndex(b => b.id === payload.id)
  if (i !== -1) otherBlocks.value[i] = payload
}

// -------------------------------
// Step 4 — parameters only (placeholder data model)
// -------------------------------
const paramBlocks = ref([])
/**
 * Shape per block:
 * {
 *   id: number,
 *   code: string,                 // e.g. RE233A01
 *   machineGroup: string,
 *   machine: string,
 *   table: string[][]             // Header + rows
 * }
 */
let paramUid = 1
function nextCode(prefix, idx) { return `${prefix}${String(idx).padStart(2, '0')}` }

function addParamLayer() {
  paramBlocks.value.push({
    id: paramUid++,
    code: nextCode('RE233A', paramBlocks.value.length + 1),
    machineGroup: '',
    machine: '',
    table: [],
  })
  recomputeDuplicates()
}

function removeParamBlock(id) {
  paramBlocks.value = paramBlocks.value.filter(b => b.id !== id)
  paramBlocks.value.forEach((b, i) => (b.code = nextCode('RE233A', i + 1)))
  recomputeDuplicates()
}

function updateParamBlock({ id, data }) {
  const i = paramBlocks.value.findIndex(b => b.id === id)
  if (i !== -1) {
    paramBlocks.value[i] = { ...paramBlocks.value[i], ...data }
    recomputeDuplicates()
  }
}

// Duplicate detection
const duplicateMap = ref({})
function serializeTable(table) {
  if (!Array.isArray(table) || table.length <= 1) return null
  const payload = table.slice(1).map(row => (row || []).slice(0, 8).join('|')).join('|')
  return payload.includes('||') ? null : JSON.stringify(table.slice(1))
}
function recomputeDuplicates() {
  const seen = new Map()
  const dup = {}
  paramBlocks.value.forEach((_, idx) => { dup[idx] = false })
  paramBlocks.value.forEach((b, idx) => {
    const sig = serializeTable(b.table)
    if (!sig) return
    if (!seen.has(sig)) seen.set(sig, [])
    seen.get(sig).push(idx)
  })
  for (const indices of seen.values()) {
    if (indices.length > 1) indices.forEach(i => (dup[i] = true))
  }
  duplicateMap.value = { ...dup }
}

// -------------------------------
// Step 6 — used forms
// -------------------------------
const formWindowVisible = ref(false)
const usedForms = ref([]) // [{ id, formId, formName }]
let usedFormUid = 1

function addUsedForm({ formId, formName }) {
  usedForms.value.push({ id: usedFormUid++, formId, formName })
  formWindowVisible.value = false
}
function removeUsedForm(id) {
  usedForms.value = usedForms.value.filter(x => x.id !== id)
}

// -------------------------------
// Navigation
// -------------------------------
function goToStep(n) { currentStep.value = n }

// -------------------------------
// Draft token init (document_type = 1)
// -------------------------------
const ensureDraftToken = async () => {
  if (draftToken.value) return draftToken.value
  try {
    const { data } = await axios.post(`${API_BASE_URL}/drafts/init`, { document_type: 1 })
    if (data?.success && data.token) {
      setToken(data.token)
      return data.token
    }
    throw new Error(data?.message || 'init failed')
  } catch (e) {
    console.error('drafts/init failed:', e)
    alert('建立草稿代碼失敗，請稍後再試')
    return null
  }
}

// -------------------------------
// Save / Load (skeletons)
// -------------------------------
function snapshot() {
  return {
    form: JSON.parse(JSON.stringify(form)),
    specBlocks: JSON.parse(JSON.stringify(specBlocks.value)),
    paramBlocks: JSON.parse(JSON.stringify(paramBlocks.value)),
    qualityBlocks: JSON.parse(JSON.stringify(qualityBlocks.value)),
    otherBlocks: JSON.parse(JSON.stringify(otherBlocks.value)),
    usedForms: JSON.parse(JSON.stringify(usedForms.value)),
  }
}

async function saveDraft() {
  const t = await ensureDraftToken()
  if (!t) return
  try {
    // 1) attributes
    await axios.post(`${API_BASE_URL}/spec/save-attributes`, { token: t, form: snapshot().form })

    // 2) step 3 (spec → dynamic editors)
    await axios.post(`${API_BASE_URL}/spec/save-blocks`, {
      token: t,
      step_type: 2,
      blocks: specBlocks.value,
    })

    // 3) step 4 (parameters-only)
    await axios.post(`${API_BASE_URL}/spec/save-params`, {
      token: t,
      blocks: paramBlocks.value.map((b, i) => ({
        tier_no: i + 1,
        code: b.code,
        machineGroup: b.machineGroup || '',
        machine: b.machine || '',
        table: b.table || [],
      })),
    })

    // 4) step 5 (quality → dynamic editors)
    await axios.post(`${API_BASE_URL}/spec/save-blocks`, {
      token: t,
      step_type: 4,
      blocks: qualityBlocks.value,
    })

    // 5) step 7 (other → dynamic editors)
    await axios.post(`${API_BASE_URL}/spec/save-blocks`, {
      token: t,
      step_type: 6,
      blocks: otherBlocks.value,
    })

    // 6) step 6 (references / forms)
    await axios.post(`${API_BASE_URL}/spec/save-references`, {
      token: t,
      refs: usedForms.value.map(f => ({
        refer_type: 1,                // 1 = form
        refer_document: f.formId,
        refer_document_name: f.formName,
      })),
    })

    alert('草稿已儲存')
  } catch (e) {
    console.error('saveDraft failed:', e)
    alert('儲存草稿失敗')
  }
}

async function loadDraft() {
  const t = await ensureDraftToken()
  if (!t) return
  try {
    // Option A: single endpoint that returns everything
    const { data } = await axios.get(`${API_BASE_URL}/spec/${t}`)
    if (data?.form) Object.assign(form, data.form)

    console.log("Before loading spec blocks: ", specBlocks.value)

    specBlocks.value = data?.specBlocks || []
    paramBlocks.value = data?.paramBlocks || []
    qualityBlocks.value = data?.qualityBlocks || []
    otherBlocks.value = data?.otherBlocks || []
    usedForms.value = data?.usedForms || []
    console.log("After loading spec blocks: ", specBlocks.value)

    await fetchMachineGroups(form.attribute.specific)
    recomputeDuplicates()
  } catch (e) {
    console.error('loadDraft failed:', e)
  }
}

// -------------------------------
// Bootstrap
// -------------------------------
onMounted(loadDraft)

// Expose (optional, for devtools)
defineExpose({
  saveDraft,
  loadDraft,
})
</script>

<style scoped>
.new-specification-container {
    width: 90%;
    margin: 30px auto;
    padding: 25px;
    background-color: #ffffff;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}


/*  Page Header Style  */
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
}

.header h1 {
    margin: 0;
    font-size: 28px;
    color: #333;
}

.back-btn, .save-btn {
    display: flex;
    background-color: #6c757d;
    color: white;
    border: none;
    padding: 10px 18px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 15px;
    align-items: center;
    transition: background-color 0.3s ease;
}

.back-btn:hover, .save-btn:hover {
    background-color: #5a6268;
}

.back-btn .icon, .save-btn .icon {
    width: 18px;
    height: 18px;
    margin-right: 8px;
    filter: invert(100%);
}


/*  Step navigation Style  */
.step-navigation {
    display: flex;
    justify-content: space-around;
    margin-bottom: 30px;
    background-color: #e3f2fd;
    padding: 15px 10px;
    border-radius: 8px;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
    position: sticky;
    top: 0;
    z-index: 1000;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.7);
}

.step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.3s ease, transform 0.2s ease;
}

.step-item:hover {
    opacity: 1;
    transform: translateY(-2px);
}

.step-item.active .step-label{
    color: #007bff;
    font-weight: bold;
    opacity: 1;
}

.step-item.completed .step-circle {
    background-color: #28a745;
    color: white;
}

.step-item.active .step-circle {
    background-color: #007bff;
    color: white;
    box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.25);
}

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
    transition: all 0.3 ease;
}

.step-label {
    font-size: 14px;
    color: #555;
    text-align: center;
}


/*  Content Block Style  */
.form-section {
    padding: 20px 0;
}

.step-content { background-color: #f9f9f9; padding: 25px; border-radius: 8px; min-height: 250px; border: 1px solid #e0e0e0; }
.step-content h2 { font-size: 22px; color: #333; margin-top: 0; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #007bff; display: inline-block; }

/*  Attribute Block Style  */
.fundamental-attribute-block { display: flex; border: unset; padding: 0px; }
.fundamental-attribute-block .attribute { display: flex; flex-direction: column; width: 100%; }
.fundamental-attribute-block .supplement { display: flex; flex-direction: column; width: 100%; }
.form-group { display: flex; flex-direction: row; align-items: center; margin-bottom: 8px; padding: 8px; }
.form-group label { width: 20%; font-size: 15px; color: #555; margin-bottom: 8px; font-weight: bold; }
.form-group input, .form-group textarea, .form-group select { width: 70%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 15px; box-sizing: border-box; transition: border-color 0.2s ease; }
.form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: #008bff; outline: none; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);}
.form-group textarea { resize: vertical; min-height: 80px; }
.form-group input[readonly] { background-color: #e9ecef; color: #495057; cursor: not-allowed; }
.form-group input.window-select { background: white; cursor: pointer; }


/*  Purpose Block Page  */
.purpose-group {
    width: 100%;
    flex-grow: 1;
    height: 50%;
}

.purpose-group textarea{
    width: 100%;
    height: 100%;
    min-height: 150px;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
    box-sizing: border-box;
    resize: vertical;
    transition: border-color 0.2 ease;
}

.purpose-group textarea:focus{
    border-color: #007bff;
    outline: none;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}


/*  Common Use  */
.layer-action-btn {
    margin: 10px;
    background: #1666C0;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 5px;
    font-size: 14px;
    cursor: pointer;
}

.form-block { display: flex; justify-content: space-between; padding: 10px; margin: 10px 10px; border: 1px solid #ddd; }
.form-label { padding: 8px 10px; }
.form-label.no { border-right: 1px solid #ddd; }
.form-label.id { display: inline-block; width: 200px; border-right: 1px solid #ddd; }
.form-btn-block { display: flex; align-items: center;}
.remove-btn { background: none; border: none; color: red; font-weight: bold; cursor: pointer; font-size: 1.2em; }

</style>