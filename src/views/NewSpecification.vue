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
    <!-- <section class="page" :style="{'--sticky-top-offset': stickyTop + 'px'}"> -->
      <div ref="stepNavRef" class="step-navigation">
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
    <!-- </section> -->

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
              <input id="item-type" class="window-select" type="text" v-model="form.attribute.itemType" @click="itemsListVisible = !itemsListVisible" readonly/>
            </div>

            <div class="form-group">
              <label for="apply-project">適用工程：</label>
              <select id="apply-project" class="window-select" v-model="specification" @change="onSelectSpecific(specification)">
                <option value="">-- 請選擇適用工程 --</option>
                <option v-for="s in specificationOptions" :key="s.code" :value="s">{{ s.name }}</option>
              </select>
              <!-- <input id="apply-project" class="window-select" type="text" v-model="specification" @click="specificsListVisible = true" readonly/> -->
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
      <!-- <SpecificListWindow
        v-if="specificsListVisible"
        @selectSpecific="onSelectSpecific"
        @cancel="specificsListVisible = false"
      /> -->
      <ItemListWindow
        v-if="itemsListVisible"
        @selectItem="onSelectItemType"
        @cancel="itemsListVisible = false"
      />

      <!-- <ItemListWindow
        v-if="itemsListVisible"
        :items="requestItemFromAPI()"
        @selectItem="onSelectItemType"
        @cancel="itemsListVisible = false"
      /> -->

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
        <!-- <div class="Parameters">
          <button class="layer-action-btn add" @click="addParamLayer">新增組合</button>
        </div> -->
        <!-- <ManufacturingParameterBlocks
          v-model="paramBlocks"/> -->

        <ManufacturingParameterBlocks
          :data-blocks="mcrBlocks"
          :specification="{specific: form.attribute.specific_name, code: form.attribute.specific_code}"
          :current-step="currentStep"
          @update:dataBlocks="mcrBlocks = $event"
          @save="mcrBlocks = $event"/>
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
        <div style="display: flex; justify-content: space-between; align-items:center;">
          <h2>文件產出</h2>
          <div style="display:flex; gap:.5rem;">
            <button @click="generateAndDownloadDocx" :disabled="loading" class="layer-action-btn add">
              {{ loading ? '產生中…' : '預覽（PDF）' }}
            </button>
            <button @click="requestEIPAPI" class="layer-action-btn add">拋轉EIP</button>
          </div>
        </div>

        <p v-if="errorMsg" style="color:#c00; margin:.5rem 0;">{{ errorMsg }}</p>

        <div v-if="pdfSrc" class="pdf-viewer">
          <iframe :src="pdfSrc" width="100%" height="600px" frameborder="0"></iframe>
        </div>
      </div>
      <!-- <div v-if="currentStep === 8" class="step-content">
        <div style="display:flex;justify-content:space-between;">
          <h2>文件產出</h2>
          <button class="layer-action-btn add" disabled>拋轉EIP（稍後改 Word ）</button>
        </div>
        <div class="pdf-viewer muted">
          （產出改版中，稍後接 Word 範本）
        </div>
      </div> -->
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'

// UI components
import DynamicEditorBlock from '@/components/DynamicEditorBlock.vue'
import FormSearchWindow from '@/components/FormSearchWindow.vue'
import SpecificListWindow from '@/components/SpecificListWindow.vue'
import ItemListWindow from '@/components/ItemListWindow.vue'
import ManufacturingParameterBlocks from '@/components/ManufacturingParameterBlocks.vue'

// token & unified docs API (same as NewInstruction.vue)
import { useDraftToken } from '@/composables/useDraftToken'
import {
  initDoc, saveAttributes, loadAttributes,
  saveBlocks, loadBlocks,
  saveParams, loadParams,
  saveReferences, loadReferences
} from '@/api/docsApi'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ''
const { token: draftToken, setToken } = useDraftToken('rms:draft:new-specification')

// ---------- steps ----------
const steps = [
  { label: '基本屬性' },                  // 1
  { label: '目的' },                      // 2
  { label: '製作條件規範' },              // 3 -> step_type 4
  { label: '條件參數一覽表' },            // 4 -> step_type 5
  { label: '適用品質與規格內容' },        // 5 -> step_type 6
  { label: '使用表單' },                  // 6 -> references (forms)
  { label: '其他' },                      // 7 -> step_type 7
  { label: '文件匯出' },                  // 8 (暫不實作)
]
const currentStep = ref(1)
const goToStep = s => { currentStep.value = s }

// const stepNavRef = ref(null)
// const stickyTop = ref(0)

// let ro
// function measure() {
//   // distance we want the child headers to start sticking below
//   stickyTop.value = stepNavRef.value?.offsetHeight || 0
// }


// ---------- basic attributes ----------
const form = reactive({
  documentType: 1,          // 1 = Specification
  documentID: '',
  documentName: '',
  documentVersion: 1.0,
  attribute: {
    itemType: '',
    specific_name: '',
    specific_code: '',
    styleNo: '',
    styleVersion: '',
  },
  department: '',
  author_id: '',
  author: '',
  approver: '',
  confirmer: '',
  reviseReason: '',
  revisePoint: '',
  documentStyle: '',
  documentPurpose: '',
})

// ---------- pickers ----------
const specificsListVisible = ref(false)
const itemsListVisible     = ref(false)
let specificationOptions = ref([])
const specification        = ref('')

function onSelectItemType(payload) {
  specificationOptions.value = payload.specifications
  form.attribute.itemType = payload?.matnr || ''
  form.documentName = `${form.attribute.itemType}_${form.attribute.specific}_製造式樣書`
  itemsListVisible.value = false
  console.log("form.attribute: ", form.attribute)
}

const machineGroups = ref([])
async function fetchMachineGroups(specific_code) {
  console.log("specific_code: ", specific_code)
  machineGroups.value = []
  if (!specific_code) return
  try {
    const { data } = await axios.get(`${API_BASE_URL}/mes/groups-machines`, { params: { specific: specific_code } })
    machineGroups.value = data?.data?.groups || []
  } catch (e) { console.error('fetchMachineGroups failed:', e) }
}

async function onSelectSpecific(s) {
  if (s){
    form.attribute.specific_code = (s.code) ? s.code : s.specific_code
    form.attribute.specific_name = (s.name) ? s.name : s.specific_name
    form.attribute.styleNo = (s.sfhnr) ? s.sfhnr : s.styleNo
    form.attribute.styleVersion = (s.version) ? s.version : s.styleVersion

    form.documentName = `${form.attribute.itemType}_${form.attribute.specific_name.split(')').slice(-1)}_製造式樣書`

    specification.value = {code: form.attribute.specific_code, name: form.attribute.specific_name, sfhnr: form.attribute.styleNo, version: form.attribute.styleVersion}
    console.log("form.attribute: ", form.attribute)
    await fetchMachineGroups(form.attribute.specific_code)
  }
}

async function requestItemsFromAPI(item) {
  try {
    const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || "";
    const url = `${API_BASE_URL}/item/search`;

    const response = await axios.get(url, { params: { item } });

    if (!response.data.success)
      return;

    return Array.isArray(response.data.data?.items) ? response.data.data.items : [];
  } catch (error) {
    console.error("Error fetching items:", error);
  }
}

// ---------- dynamic blocks (spec/quality/other) ----------
let uid = 1
const specBlocks    = ref([])  // step_type = 4
const qualityBlocks = ref([])  // step_type = 6
const otherBlocks   = ref([])  // step_type = 7

const makeBlock = (stepType, tier) => ({
  id: uid++,
  step: stepType,          // only for UI; backend uses step_type passed to saveBlocks
  tier,
  data: [{
    option: 0,             // 0:title only, 1:title+text+files, 2:title+table(+files)
    jsonHeader: null,
    jsonContent: null,
    files: [],
  }],
})

function addSpecLayer()          { specBlocks.value.push   (makeBlock(2, specBlocks.value.length    + 1)) }
function addQualityLayer()       { qualityBlocks.value.push(makeBlock(4, qualityBlocks.value.length + 1)) }
function addOtherLayer()         { otherBlocks.value.push  (makeBlock(6, otherBlocks.value.length   + 1)) }

function removeSpecLayer(id)     { specBlocks.value    = specBlocks.value   .filter(b => b.id !== id).map((b,i)=>({...b,tier:i+1})) }
function removeQualityLayer(id)  { qualityBlocks.value = qualityBlocks.value.filter(b => b.id !== id).map((b,i)=>({...b,tier:i+1})) }
function removeOtherLayer(id)    { otherBlocks.value   = otherBlocks.value  .filter(b => b.id !== id).map((b,i)=>({...b,tier:i+1})) }

function updateSpecLayer(payload)    { const i = specBlocks.value   .findIndex(b=>b.id===payload.id);    if(i!==-1) specBlocks.value[i]    = payload }
function updateQualityLayer(payload) { const i = qualityBlocks.value.findIndex(b=>b.id===payload.id);    if(i!==-1) qualityBlocks.value[i] = payload }
function updateOtherLayer(payload)   { const i = otherBlocks.value  .findIndex(b=>b.id===payload.id);    if(i!==-1) otherBlocks.value[i]   = payload }

// Helpers to convert DynamicEditor UI blocks → backend “generic blocks”
const toGenericBlocks = (arr=[], step_type) =>
  (arr || [])
    .sort((a,b)=>(a.tier||0)-(b.tier||0))
    .map(blk => ({
      step_type,
      tier: blk.tier,
      data: (blk.data || []).map(it => ({
        option: it.option ?? 0,
        jsonHeader: it.jsonHeader || null,
        jsonContent: it.jsonContent || null,
        files: Array.isArray(it.files) ? it.files : []
      }))
    }))

const fromGenericBlocks = (payload, stepType) =>
  (payload.blocks || []).map((blk, i) => ({
    id: i + 1,
    step: stepType,
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

// ---------- step 4 — parameters (SPEC_PARAM = 5) ----------
const mcrBlocks = ref([]) // <-- the one you already bind to the component

// serialize params → backend shape for /docs/params/save (step_type = 5)
function serializeParamsFromMCR() {
  return (mcrBlocks.value || []).map((blk, i) => ({
    step_type: 5,
    tier_no: i + 1,
    code: blk.code || `XXXX${i + 1}`,
    jsonParameterContent: blk.data?.jsonParameterContent || null,
    arrayParameterData:   blk.data?.arrayParameterData   || [],
    metadata: blk.data?.metadata || null,
  }))
}

// load backend → fill mcrBlocks that the child understands
function loadParamsIntoMCR(payload) {
  mcrBlocks.value = (payload.blocks || []).map((b, i) => ({
    id: i + 1,
    code: b.code || `XXXX${i + 1}`,
    data: {
      jsonParameterContent: b.jsonParameterContent || null,
      arrayParameterData:   b.arrayParameterData   || [],
      metadata: b.metadata || null,
    },
  }))
}

// ---------- references (forms) ----------
const formWindowVisible = ref(false)
const usedForms = ref([])   // [{ id, formId, formName }]
let usedFormUid = 1
const addUsedForm = ({ formId, formName }) => { usedForms.value.push({ id: usedFormUid++, formId, formName }); formWindowVisible.value = false }
const removeUsedForm = (id) => { usedForms.value = usedForms.value.filter(x => x.id !== id) }

// ---------- token bootstrap (document_type = 1) ----------
const ensureDraftToken = async () => {
  if (draftToken.value) return draftToken.value
  try {
    const res = await initDoc(1)   // specification doc
    if (res?.success && res.token) { setToken(res.token); return res.token }
    throw new Error(res?.message || 'init failed')
  } catch (e) {
    console.error('docs/init failed:', e)
    alert('建立草稿代碼失敗，請稍後再試')
    return null
  }
}

// ---------- 文件產出 (step 8) — skipped per your request ----------
const loading  = ref(false)
const errorMsg = ref('')
const captureId = ref('')

async function generateAndDisplayPdf() {
  loading.value = true
  errorMsg.value = ''
  captureId.value = ''
  try {
    const payload = {
      attribute: [{...form}],
      content: [...toGenericBlocks(specBlocks.value, 4), ...serializeParamsFromMCR(), ...toGenericBlocks(qualityBlocks.value, 6), ...toGenericBlocks(otherBlocks.value, 7)],
      reference: [
        ...(usedForms.value || []).map(f => ({referenceType: 1, referenceDocumentID: f.formId, referenceDocumentName: f.formName})),
      ],
    }

    const res = await axios.post(`${API_BASE_URL}/capture/capture-request`, payload)
    if (!res?.data?.ok) throw new Error(res?.data?.error || 'capture failed')
    captureId.value = res.data.payload_id
    alert(`Captured OK. payload_id = ${captureId.value}`)
  } catch (e) {
    console.error(e)
    errorMsg.value = e?.message || 'capture error'
  } finally {
    loading.value = false
  }
}

function extractFilenameFromDisposition(disposition, fallback = 'document.docx') {
  if (!disposition) return fallback
  // RFC 5987: filename*=UTF-8''...
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)
  if (star?.[1]) return decodeURIComponent(star[1])
  // Plain filename="..."
  const plain = /filename\s*=\s*"?([^\";]+)"?/i.exec(disposition)
  if (plain?.[1]) return plain[1]
  return fallback
}

async function generateAndDownloadDocx() {
  loading.value = true
  errorMsg.value = ''
  try {
    const payload = {
      attribute: [{...form}],
      content: [...toGenericBlocks(specBlocks.value, 4), ...serializeParamsFromMCR(), ...toGenericBlocks(qualityBlocks.value, 6), ...toGenericBlocks(otherBlocks.value, 7)],
      reference: [
        ...(usedForms.value || []).map(f => ({referenceType: 1, referenceDocumentID: f.formId, referenceDocumentName: f.formName})),
      ],
    }
    const url = `${API_BASE_URL}/docs/generate/word` // or /docs/generate/word if that’s your route

    const res = await axios.post(url, payload, {responseType: 'blob'})

    const contentType = res.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const dispo = res.headers['content-disposition']
    const filename = extractFilenameFromDisposition(dispo, 'document.docx')

    const blob = new Blob([res.data], { type: contentType })

    // IE/old Edge
    // @ts-ignore
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      // @ts-ignore
      window.navigator.msSaveOrOpenBlob(blob, filename)
      return
    }

    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch (e) {
    console.error(e)
    if (e?.response?.data instanceof Blob) {
      try {
        const t = await e.response.data.text()
        errorMsg.value = t || e.message || 'download error'
      } catch {
        errorMsg.value = e?.message || 'download error'
      }
    } else {
      errorMsg.value = e?.message || 'download error'
    }
  } finally {
    loading.value = false
  }
}

// ---------- save ----------
const isSaving = ref(false)
const saveDraft = async () => {
  const t = await ensureDraftToken()
  if (!t) return
  try {
    isSaving.value = true

    // 1) attributes
    const a = await saveAttributes(t, form)
    if (!a?.success) { isSaving.value = false; return alert(a?.message || '屬性儲存失敗') }

    // 2) step 3: 規範（條文/說明/表格） → generic blocks (step_type = 4)
    await saveBlocks(t, 4, toGenericBlocks(specBlocks.value, 4))

    // 3) step 4: 參數一覽表 → params (step_type = 5)
    await saveParams(t, serializeParamsFromMCR(), 5)  // SPEC_PARAM = 5
    // await saveParams(t, serializeParams(), 5)

    // 4) step 5: 品質與規格內容 → generic blocks (step_type = 6)
    await saveBlocks(t, 6, toGenericBlocks(qualityBlocks.value, 6))

    // 5) step 7: 其他 → generic blocks (step_type = 7)
    await saveBlocks(t, 7, toGenericBlocks(otherBlocks.value, 7))

    // 6) step 6: 使用表單 → references
    await saveReferences(t, {
      documents: [], // 規範頁這裡只存表單
      forms: (usedForms.value || []).map(f => ({ formId: f.formId, formName: f.formName })),
    })

    alert(`草稿已儲存（時間：${a.issueTime || ''}）`)
  } catch (e) {
    console.error('saveDraft failed:', e)
    alert('儲存草稿失敗')
  } finally {
    isSaving.value = false
  }
}

// ---------- load ----------
onMounted(async () => {
  // measure()
  // keep it correct on resize/content changes
  // ro = new ResizeObserver(measure)
  // if (stepNavRef.value) ro.observe(stepNavRef.value)
  // window.addEventListener('resize', measure)

  const t = await ensureDraftToken()
  if (!t) return
  try {
    // 1) attributes
    const a = await loadAttributes(t)
    if (a?.success) Object.assign(form, a.form || {})
    form.department = sessionStorage.getItem('loggedInUserdeptName')
    form.author_id = sessionStorage.getItem('loggedInUserNo')
    form.author = sessionStorage.getItem('loggedInUserName')

    if (form.attribute.itemType){
      const result = await requestItemsFromAPI(form.attribute.itemType)
      specificationOptions.value = result[0].specifications
      onSelectSpecific(form.attribute)
    }

    // 2) 規範 blocks (step_type = 4)
    const sp = await loadBlocks(t, 4)
    if (sp?.success) specBlocks.value = fromGenericBlocks(sp, 2)

    // 3) 參數 (step_type = 5)
    const pm = await loadParams(t, 5)
    if (pm?.success) loadParamsIntoMCR(pm)

    // 4) 品質與規格 blocks (step_type = 6)
    const ql = await loadBlocks(t, 6)
    if (ql?.success) qualityBlocks.value = fromGenericBlocks(ql, 4)

    // 5) 其他 blocks (step_type = 7)
    const ot = await loadBlocks(t, 7)
    if (ot?.success) otherBlocks.value = fromGenericBlocks(ot, 6)

    // 6) 使用表單
    const rf = await loadReferences(t)
    if (rf?.success) {
      let i = 1
      usedForms.value = (rf.forms || []).map(f => ({ id: i++, formId: f.formId, formName: f.formName }))
    }

    // dependent lists
    // recomputeDuplicates()
  } catch (e) {
    console.error('load draft failed:', e)
    alert('載入草稿失敗')
  }
})

// onBeforeUnmount(() => {
//   ro?.disconnect()
//   window.removeEventListener('resize', measure)
// })

// optional devtools
defineExpose({ saveDraft })
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