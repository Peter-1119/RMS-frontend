<template>
  <div class="new-specification-container">
    <!-- Header -->
    <div class="header">
      <button @click="$router.push('/home')" class="back-btn">
        <img src="@/assets/home-icon.png" alt="首頁" class="icon" /> 回首頁
      </button>
      <h1>製造式樣書</h1>
      <button @click="saveDraft" class="save-btn" :disabled="isSaving">
        <img src="@/assets/save-icon.png" alt="儲存" class="icon" />{{ isSaving ? '暫存中…' : '暫存草稿' }}
      </button>
    </div>

    <!-- Steps nav：一樣 sticky + 滾動縮放 -->
    <div class="steps-navigation" :class="{ collapsed: navCollapsed }">
      <div
        v-for="(step, index) in steps" :key="index" :class="[
          'step-item', stepStatusClass(index), { 'active': currentStep === index + 1, 'completed': currentStep > index + 1 }
        ]"
        @click="goToStep(index + 1)"
      >
        <div class="step-circle">{{ (step.label == "基本屬性" || step.label == "文件產出") ? "" : index }}</div>
        <div class="step-label">{{ step.label }}</div>
      </div>
    </div>

    <!-- Content -->
    <div class="form-section">
      <!-- 一頁式內容：Step 1 ~ 7 -->
      <div v-if="currentStep !== 8" class="content-page">
        <!-- Step 1 基本屬性 -->
        <section :ref="el => (sectionRefs[0].value = el)" class="step-section">
          <h2>基本屬性</h2>
          <div class="fundamental-attribute-block">
            <div class="attribute">
              <div class="form-group"><label for="doc-code">文管編號：</label><input id="doc-code" type="text" v-model="form.documentID" readonly /></div>
              <div class="form-group"><label for="doc-name">文件名稱：</label><input id="doc-name" type="text" v-model="form.documentName" readonly /></div>
              <div class="form-group"><label for="doc-version">文件版本：</label><input id="doc-version" type="text" v-model="form.documentVersion" readonly /></div>

              <div class="form-group">
                <label for="item-type">品目：</label>
                <input id="item-type" class="window-select" type="text" v-model="form.attribute.itemType" :readonly="true" @click="!isRevision && (itemsListVisible = !itemsListVisible)"/>
              </div>

              <div class="form-group">
                <label for="style-no">式樣NO：</label>
                <select id="style-no" class="window-select" v-model="form.attribute.styleNo" @change="onSelectStyle" :disabled="isRevision">
                  <option value="">-- 請先選品目，再選式樣 --</option>
                  <option v-for="st in styleOptions" :key="st.sfhnr" :value="st.sfhnr">{{ st.sfhnr }}</option>
                </select>
              </div>

              <div class="form-group">
                <label for="apply-project">適用工程：</label>
                <input id="apply-project" class="window-select" type="text" :value="specificationDisplay" readonly placeholder="請先選擇品目與式樣"/>
              </div>
              <div class="form-group"><label for="department">制訂單位：</label><input id="department" type="text" v-model="form.department" readonly /></div>
              <div class="form-group"><label for="author">制訂者：</label><input id="author" type="text" v-model="form.author" readonly /></div>
              <div class="form-group"><label for="confirmer">確認者：</label><input id="confirmer" type="text" v-model="form.confirmer" /></div>
              <div class="form-group"><label for="approver">承認者：</label><input id="approver" type="text" v-model="form.approver" /></div>
            </div>

            <div class="supplement">
              <div class="form-group"><label for="revise-reason">變更理由：</label><textarea id="revise-reason" v-model="form.reviseReason" /></div>
              <div class="form-group"><label for="revise-point">變更要點：</label><textarea id="revise-point" v-model="form.revisePoint" /></div>
            </div>
          </div>

          <ItemListWindow v-if="itemsListVisible" @selectItem="onSelectItemType" @cancel="itemsListVisible = false"/>
        </section>

        <!-- Step 2 目的 -->
        <section :ref="el => (sectionRefs[1].value = el)" class="step-section">
          <h2>1. 目的</h2>
          <div class="purpose-group">
            <textarea placeholder="此處將填寫文件的目的相關內容" v-model="form.documentPurpose"></textarea>
          </div>
        </section>

        <!-- Step 3 製作條件規範 -->
        <section :ref="el => (sectionRefs[2].value = el)" class="step-section">
          <h2>2. 製作條件規範</h2>
          <div class="manufacturing-specification-block">
            <button class="layer-action-btn add" @click="addSpecLayer">新增下一層</button>
          </div>

          <DynamicEditorBlock
            v-for="blk in specBlocks"
            :key="blk.id"
            :block-editors="blk"
            :allow-color="isRevisionDoc"
            @update-block="updateSpecLayer"
            @delete-block="removeSpecLayer(blk.id)"
          />
        </section>

        <!-- Step 4 製造參數一覽表 -->
        <section :ref="el => (sectionRefs[3].value = el)" class="step-section">
          <h2>3. 製造參數一覽表</h2>
          <ManufacturingParameterBlocks
            v-if="paramsLoaded"
            :data-blocks="mcrBlocks"
            :specification="form.attribute.specification"
            :current-step="currentStep"
            :document-token="draftToken"
            :allow-color="isRevisionDoc"
            @update:dataBlocks="mcrBlocks = $event"
            @save="mcrBlocks = $event"
            @machine-group-info="onMachineGroupInfo"
          />
        </section>

        <!-- Step 5 適用品質與規格內容 -->
        <section :ref="el => (sectionRefs[4].value = el)" class="step-section">
          <h2>4. 適用品質與規格內容</h2>
          <div class="quality-specification-block">
            <button class="layer-action-btn add" @click="addQualityLayer">新增下一層</button>
          </div>

          <DynamicEditorBlock
            v-for="blk in qualityBlocks"
            :key="blk.id"
            :block-editors="blk"
            :allow-color="isRevisionDoc"
            @update-block="updateQualityLayer"
            @delete-block="removeQualityLayer(blk.id)"
          />
        </section>

        <!-- Step 6 使用表單 -->
        <section :ref="el => (sectionRefs[5].value = el)" class="step-section">
          <h2>5. 使用表單</h2>
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

          <FormSearchWindow
            v-if="formWindowVisible"
            headerName="表單選取"
            :existingForms="usedForms"
            :allow-color="isRevisionDoc"
            @add-new-form="addUsedForm"
            @close-window="formWindowVisible = false"
          />
        </section>

        <!-- Step 7 其它 -->
        <section :ref="el => (sectionRefs[6].value = el)" class="step-section">
          <h2>6. 其它</h2>
          <div class="other-block"><button class="layer-action-btn add" @click="addOtherLayer">新增下一層</button></div>
          <DynamicEditorBlock v-for="blk in otherBlocks" :key="blk.id" :block-editors="blk" @update-block="updateOtherLayer" @delete-block="removeOtherLayer(blk.id)"/>
        </section>
      </div>

      <!-- Step 8：文件產出獨立頁 -->
      <div v-else class="output-page">
        <div style="display: flex; justify-content: space-between; align-items:center;">
          <h2>文件產出</h2>
          <div style="display:flex; gap:.5rem;">
            <button @click="generateAndDownloadDocx" :disabled="loading" class="layer-action-btn add">{{ loading ? '產生中…' : '產生文件（Word）' }}</button>
          </div>
        </div>

        <p v-if="errorMsg" style="color:#c00; margin:.5rem 0;">{{ errorMsg }}</p>

        <!-- ✅ 這裡改成 DOCX 預覽 -->
        <div class="docx-viewer" style="margin-top: 1rem;">
          <div v-if="previewLoading">預覽產生中…</div>
          <WordPreview v-else-if="docxSrc" :file-url="docxSrc" />
          <small v-else style="color:#666;">尚未產生預覽。</small>
        </div>
      </div>
    </div>
  </div>

  <!-- 右下浮動工具列 -->
  <div class="floating-tools">
    <button class="tool-btn" @click="$router.push('/home')" title="回首頁">⌂</button>
    <button class="tool-btn" @click="scrollToTop" title="回到最上層">↑</button>
    <button class="tool-btn" @click="saveDraft" :disabled="isSaving" title="儲存草稿">💾</button>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

import DynamicEditorBlock from '@/components/DynamicEditorBlock.vue'
import FormSearchWindow from '@/components/FormSearchWindow.vue'
import ItemListWindow from '@/components/ItemListWindow.vue'
import ManufacturingParameterBlocks from '@/components/ManufacturingParameterBlocks.vue'
import WordPreview from '@/components/WordPreview.vue'

import { useDraftToken } from '@/composables/useDraftToken'
import {
  loadPersonnel,
  initDoc,
  saveDraftAll,
  loadDraftAll,
  loadSnapshotDraftAll,
} from '@/api/docsApi'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ''
const { token: draftToken, setToken } = useDraftToken('rms:draft:new-specification')

const route = useRoute()

// ─── 模式判斷 ──────────────────────────────
const isRevisionDoc = computed(() => route.query.mode === 'revision')

// 從哪裡來：submitted / rejected / ''
const fromSource = computed(() => String(route.query.source || '').trim())  // submitted / rejected / ''
const rmsId = computed(() => String(route.query.rms_id || '').trim())
const routeToken = computed(() => String(route.query.token || '').trim())

// 只要有 rms_id，就視為「snapshot 進來」
// （也就是從 SubmittedDocuments / RejectedDocuments 點進來）
const isSnapshotView = computed(() => !!rmsId.value)

// 你可以用來在 template 顯示警告 Banner：「此畫面來自已送件/退簽快照，儲存會覆蓋最新草稿」
const snapshotWarningMessage = computed(() => {
  if (!isSnapshotView.value) return ''
  if (fromSource.value === 'rejected') {
    return '目前為退簽版本快照，儲存將以此內容覆蓋最新草稿。'
  }
  if (fromSource.value === 'submitted') {
    return '目前為已送簽版本快照，儲存將以此內容覆蓋最新草稿。'
  }
  return '目前為歷史快照檢視，儲存將以此內容覆蓋最新草稿。'
})

// ---------- steps ----------
const steps = [
  { label: '基本屬性', status: false },                  // 1
  { label: '目的', status: false },                      // 2
  { label: '製作條件規範', status: false },               // 3 -> step_type 4
  { label: '條件參數一覽表', status: false },             // 4 -> step_type 5
  { label: '適用品質與規格內容', status: false },         // 5 -> step_type 6
  { label: '使用表單', status: false },                  // 6 -> references (forms)
  { label: '其他', status: false },                      // 7 -> step_type 7
  { label: '文件匯出' },                  // 8
]
const currentStep = ref(1)

// 一頁式 section refs（只需要前 7 章節）
const sectionRefs = Array.from({ length: 7 }, () => ref(null))

// 步驟列縮放
const navCollapsed = ref(false)

// 其餘原本的狀態：form、specBlocks、mcrBlocks、qualityBlocks、otherBlocks 等
const form = reactive({
  documentID: '',
  documentName: '',
  documentVersion: '',
  documentPurpose: '',
  department: '',
  author: '',
  approver: '',
  confirmer: '',
  reviseReason: '',
  revisePoint: '',
  attribute: {
    itemType: '',        // 片段 MATNR
    styleNo: '',         // 完整 SFHNR（含版本）
    specification: [],   // 任務三回傳的 [{code, name}, ...]
  },
})

const styleOptions = ref([])          // 從 /item/styles 抓回來的 SFHNR 清單
const specificationDisplay = ref('')  // 用於畫面顯示的 PROCESS_NAME 串字串
// const specification = ref('')
// const specificationOptions = ref([])
const itemsListVisible = ref(false)

const specBlocks = ref([])
const mcrBlocks = ref([])
const paramsLoaded = ref(false)   // 👈 新增這個

const qualityBlocks = ref([])
const otherBlocks = ref([])
const usedForms = ref([])
const formWindowVisible = ref(false)

// ---------- nav / scroll ----------

const handleScroll = () => {
  const scrollY =
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0

  // 1) 控制縮小 / 放大
  navCollapsed.value = scrollY > 120

  // 2) 只在 Step 1~7 的一頁式畫面才做同步
  if (currentStep.value === 8) return

  const navHeight = navCollapsed.value ? 56 : 96
  const targetY = scrollY + navHeight + 24

  let closestIndex = 0
  let closestDist = Infinity

  sectionRefs.forEach((r, idx) => {
    const el = r.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const sectionTop = rect.top + scrollY

    const dist = Math.abs(sectionTop - targetY)
    if (dist < closestDist) {
      closestDist = dist
      closestIndex = idx
    }
  })

  currentStep.value = closestIndex + 1
}
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
const scrollToStep = (index) => {
  currentStep.value = index

  // Step 1 ~ 7：一頁式捲動
  if (index >= 1 && index <= 7) {
    const el = sectionRefs[index - 1].value
    if (el) {
      const scrollY =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      const navHeight = navCollapsed.value ? 56 : 96
      const rect = el.getBoundingClientRect()
      const offsetTop = rect.top + scrollY - navHeight - 16

      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth',
      })
    }
  }

  // Step 8：切到輸出頁，順便回到最上
  if (index === 8) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
const goToStep = scrollToStep

// ---------- step 驗證狀態（只先做 Step1, Step2） ----------
const isStep1Valid = computed(() => {
  // 版本：可能是 string / number，轉成 number
  const vRaw = String(form.documentVersion ?? '').trim()
  const vNum = parseFloat(vRaw || '1')
  const isFirstVersion = !Number.isFinite(vNum) || vNum <= 1

  // 是否有選「適用工程」
  const hasSpecification =
    Array.isArray(form.attribute.specification) &&
    form.attribute.specification.length > 0

  if (!hasSpecification) return false

  // 左側必填欄位（不含 documentID）
  const leftBaseFields = [
    form.documentName,
    form.documentVersion,
    form.attribute.itemType,
    form.attribute.styleNo,
    form.department,
    form.author,
    form.confirmer,
    form.approver,
  ]

  if (leftBaseFields.some(v => !String(v ?? '').trim())) {
    return false
  }

  // v == 1：documentID 不強制必填，右邊理由/要點也不強制
  if (isFirstVersion) {
    return true
  }

  // v > 1：documentID + 右側欄位都必填
  if (!String(form.documentID ?? '').trim()) return false
  if (!String(form.reviseReason ?? '').trim()) return false
  if (!String(form.revisePoint ?? '').trim()) return false

  return true
})
const isStep2Valid = computed(() => {
  return String(form.documentPurpose ?? '').trim().length > 0
})
const isStep3Valid = computed(() => {
  const { hasUsed, allValid } = evalDynamicBlocks(specBlocks.value || [])
  if (!hasUsed) return null
  return allValid
})
const isStep4Valid = computed(() => {
  // 1) 完全沒有機台群組 → 此 Step 不適用，導航不上色
  if (!hasAnyMachineGroup.value) {
    return null
  }

  const blocksArr = mcrBlocks.value || []
  if (!blocksArr.length) {
    // 有機台群組但一個 block 都沒有（理論上不會發生）→ 當作未填
    return false
  }

  let hasAnySelection = false        // 有沒有選過「任一」群組/機台
  let hasAnyPmsTable = false         // 有沒有至少一台真的有 PMS 表
  const signatures = []

  for (const blk of blocksArr) {
    const data = blk?.data || {}
    const meta = data.metadata || {}
    const arr  = data.arrayParameterData || []

    const hasGroup   = !!meta.machineGroup
    const hasMachine = !!meta.machine
    const hasProgram = (Array.isArray(meta.programs) && meta.programs.length > 0) || !!meta.programCode

    const hasTableBody = Array.isArray(arr) && arr.length > 1

    const isTotallyUnused = !hasGroup && !hasMachine && !hasProgram && !hasTableBody

    // 🔹 完全沒動過的 block：略過
    if (isTotallyUnused) {
      continue
    }

    // 走到這裡代表這個 block 有被操作過
    hasAnySelection = true

    // ✅ 情境 4：已選群組+機台+程式號碼，但沒有任何 PMS 資料
    //    → 該機台本來就沒 PMS，「不上色」（當成不需要填資料）
    if (hasGroup && hasMachine && hasProgram && !hasTableBody) {
      continue
    }

    // 🔴 只要有動作，但欄位不完整（群組 / 機台 / 程式 / 表格其中缺一） → 錯
    if (!hasGroup || !hasMachine || !hasProgram || !hasTableBody) {
      return false
    }

    // ⭐ 正常有 PMS 表的 block，開始做數值 / 重複檢查
    hasAnyPmsTable = true

    // 數值檢查：欄位 2~6 必須是數字、不可遞減
    for (let r = 1; r < arr.length; r++) {
      const row = arr[r] || []
      const vals = []
      for (let c = 2; c <= 6; c++) {
        const txt = String(row[c] ?? '').trim()
        if (!txt) return false
        const num = Number(txt)
        if (!Number.isFinite(num)) return false
        vals.push(num)
      }
      for (let k = 1; k < vals.length; k++) {
        if (vals[k - 1] > vals[k]) return false
      }
    }

    // 建立 signature，用來檢查不同 block 是否完全同一組 PMS
    const mat = []
    for (let r = 1; r < arr.length; r++) {
      const row = arr[r] || []
      const sub = []
      for (let c = 2; c <= 6; c++) {
        sub.push(String(row[c] ?? '').trim())
      }
      mat.push(sub)
    }
    signatures.push(JSON.stringify(mat))
  }

  // 🔴 有機台群組，但一台都沒選 → 必填未填
  if (!hasAnySelection) {
    return false
  }

  // 🔹 有選機台，但全部都是「沒有 PMS 的機台」→ 此 Step 對這份文件不適用 → 不上色
  if (!hasAnyPmsTable) {
    return null
  }

  // 檢查不同 block 是否有完全相同的 PMS 表 → 不允許重複
  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      if (signatures[i] === signatures[j]) {
        return false
      }
    }
  }

  return true
})
const isStep5Valid = computed(() => {
  const { hasUsed, allValid } = evalDynamicBlocks(qualityBlocks.value || [])
  if (!hasUsed) return null
  return allValid
})
const isStep6Valid = computed(() => {
  const len = (usedForms.value || []).length
  if (len === 0) return null
  return true
})
const isStep7Valid = computed(() => {
  const { hasUsed, allValid } = evalDynamicBlocks(otherBlocks.value || [])
  if (!hasUsed) return null
  return allValid
})
const stepStatusClass = (index) => {
  const stepNo = index + 1

  // 只在目前 step 以前才顯示狀態顏色
  if (stepNo > currentStep.value) return ''

  // Step 1：基本屬性（必填）
  if (stepNo === 1) {
    const v = isStep1Valid.value
    steps[index].status = v ? true : false
    return v ? 'step-ok' : 'step-error'
  }

  // Step 2：目的（必填）
  if (stepNo === 2) {
    const v = isStep2Valid.value
    steps[index].status = v ? true : false
    return v ? 'step-ok' : 'step-error'
  }

  // Step 3：製作條件規範（DynamicEditor）
  if (stepNo === 3) {
    const v = isStep3Valid.value
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = v ? true : false
    return v ? 'step-ok' : 'step-error'
  }

  // Step 4：製造參數一覽表（PMS）
  if (stepNo === 4) {
    const v = isStep4Valid.value
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = v ? true : false
    return v ? 'step-ok' : 'step-error'
  }

  // Step 5：適用品質與規格內容（DynamicEditor）
  if (stepNo === 5) {
    const v = isStep5Valid.value
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = v ? true : false
    return v ? 'step-ok' : 'step-error'
  }

  // Step 6：使用表單（有資料 → OK；無資料 → 不上色）
  if (stepNo === 6) {
    const v = isStep6Valid.value
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = true
    return 'step-ok'
  }

  // Step 7：其他（DynamicEditor）
  if (stepNo === 7) {
    const v = isStep7Valid.value
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = v ? true : false
    return v ? 'step-ok' : 'step-error'
  }

  // Step 8：文件匯出 → 一律視為 OK（只是輸出頁）
  steps[index].status = true
  return 'step-ok'
}
// ---------- pickers ----------
const specificsListVisible = ref(false)

function onSelectItemType(payload) {
  form.attribute.itemType = payload || ''
  form.attribute.styleNo = ''
  form.attribute.specification = []
  specificationDisplay.value = ''
  styleOptions.value = []
  itemsListVisible.value = false

  if (!form.attribute.itemType) return

  // 依品目抓式樣清單
  loadStylesForItem(form.attribute.itemType)
}
async function loadStylesForItem(matnr) {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/item/styles`, {
      params: { matnr },
    })
    if (!data.success) {
      alert(data.error || '取得式樣清單失敗')
      styleOptions.value = []
      return
    }
    styleOptions.value = Array.isArray(data.data?.styles)
      ? data.data.styles
      : []
  } catch (e) {
    console.error('loadStylesForItem failed:', e)
    alert('取得式樣清單失敗')
  }
}
function getDisplayName(rawName = '') {
  const idx = rawName.indexOf(')')
  if (idx === -1) {
    // 沒有 ')' 就原樣回傳（或你要不要再 trim 都可以）
    return rawName.trim()
  }
  // 取第一個 ')' 後面的全部，順便 trim 掉前後空白
  return rawName.slice(idx + 1).trim()
}
async function onSelectStyle() {
  const matnr = form.attribute.itemType
  const sfhnr = form.attribute.styleNo

  if (!matnr || !sfhnr) return

  try {
    const { data } = await axios.get(`${API_BASE_URL}/item/processes`, {
      params: { matnr, sfhnr },
    })
    if (!data.success) {
      alert(data.error || '取得適用工程失敗')
      form.attribute.specification = []
      specificationDisplay.value = ''
      return
    }

    const specList = Array.isArray(data.data?.specification) ? data.data.specification : []

    // 5. form.attribute 中的 specific_xxx → specification 陣列
    form.attribute.specification = specList

    // 4. 適用工程 readonly input 顯示 PROCESS_NAME 串
    specificationDisplay.value = specList.map(s => s.name).join(', ')

    // 順便更新文件名（你可以依你喜好調整）
    if (form.attribute.itemType && specList.length) {
      form.documentName = `${form.attribute.itemType}_${specList.map(s => getDisplayName(s.name)).join('、')} 製造式樣書`
    }
  } catch (e) {
    console.error('onSelectStyle /item/processes failed:', e)
    alert('取得適用工程失敗')
  }
}
// ---------- dynamic blocks (spec/quality/other) ----------
let uid = 1
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

// ---------- DynamicEditorBlock 驗證 helper ----------

// 把 TipTap JSON 裡所有 text 拉成純文字
function extractPlainTextFromNode(node) {
  if (!node || typeof node !== 'object') return ''
  let out = ''
  if (typeof node.text === 'string') {
    out += node.text
  }
  if (Array.isArray(node.content)) {
    node.content.forEach(child => {
      out += extractPlainTextFromNode(child)
    })
  }
  return out
}

function extractPlainTextFromDocJson(doc) {
  if (!doc || typeof doc !== 'object') return ''
  if (doc.type === 'doc' && Array.isArray(doc.content)) {
    return doc.content.map(extractPlainTextFromNode).join('').trim()
  }
  return extractPlainTextFromNode(doc).trim()
}

// 有沒有實際「使用」這個 item（標題 / 內容 / 檔案 / option）
function isDynamicBlockItemUsed(item) {
  const titleText = extractPlainTextFromDocJson(item.jsonHeader)
  const contentText = extractPlainTextFromDocJson(item.jsonContent)
  const hasFiles = Array.isArray(item.files) && item.files.length > 0
  return !!(
    titleText ||
    contentText ||
    hasFiles ||
    (item.option && item.option !== 0)
  )
}

// 這個 item 有沒有「填寫完畢」
function isDynamicBlockItemValid(item) {
  const titleText = extractPlainTextFromDocJson(item.jsonHeader)
  const hasTitle = titleText.length > 0
  const contentText = extractPlainTextFromDocJson(item.jsonContent)
  const hasFiles = Array.isArray(item.files) && item.files.length > 0
  const used = isDynamicBlockItemUsed(item)

  console.log("titleText: ", titleText)
  // 👉 只要有一個 item 存在（被建立出來），就要求要有標題
  //    不再分「有沒有使用」，沒標題就一律視為錯
  if (!hasTitle) {
    return false
  }

  // 下面才是 option 0 / 1 / 2 的細節

  // option 0：純標題 → 只要有標題就 OK
  if (item.option === 0) {
    return true
  }

  // option 1：標題 + 文字/檔案 → 至少要有文字或檔案
  if (item.option === 1) {
    return !!(contentText.length || hasFiles)
  }

  // option 2：標題 + 表格 → 每一列不能整列空白
  if (item.option === 2) {
    const doc = item.jsonContent
    if (!doc || typeof doc !== 'object') return false

    const tables = Array.isArray(doc.content)
      ? doc.content.filter(n => n.type === 'table')
      : []
    if (!tables.length) return false

    const tableNode = tables[0]
    const rows = Array.isArray(tableNode.content) ? tableNode.content : []

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const cells = Array.isArray(row.content) ? row.content : []
      const isHeaderRow = r === 0
      if (isHeaderRow) continue

      let rowHasContent = false
      for (const cell of cells) {
        const cellText = extractPlainTextFromNode(cell).trim()
        if (cellText) {
          rowHasContent = true
          break
        }
      }
      if (!rowHasContent) {
        return false
      }
    }
    return true
  }

  return true
}

// 統一檢查一整個 blocks 陣列
function evalDynamicBlocks(blocksArr = []) {
  let hasAnyItem = false
  let allValid = true

  for (const blk of blocksArr || []) {
    const items = blk.data || []
    for (const item of items) {
      hasAnyItem = true               // 只要有一個 item 就當成「有使用這個 step」

      if (!isDynamicBlockItemValid(item)) {
        allValid = false
      }
    }
  }

  // hasUsed 改成代表「這個 step 有沒有任何 item」
  return { hasUsed: hasAnyItem, allValid }
}

// Helpers to convert DynamicEditor UI blocks → backend “generic blocks”
const toGenericBlocks = (arr=[], step_type) =>
  (arr || []).sort((a,b)=>(a.tier||0)-(b.tier||0)).map(blk => ({
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
const hasAnyMachineGroup = ref(true)   // 預設 true，舊資料不會被誤判
const onMachineGroupInfo = (payload) => {
  hasAnyMachineGroup.value = !!(payload && payload.hasAnyMachineGroup)
}
// serialize params → backend shape for /docs/params/save (step_type = 5)
function serializeParamsFromMCR() {
  if (mcrBlocks.value.length == 0 || (mcrBlocks.value.length == 1 && !mcrBlocks.value[0].data.jsonParameterContent)){
    return []
  }
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
  paramsLoaded.value = true  // 👈 告訴畫面「參數已載入」
}

// ---------- references (forms) ----------
let usedFormUid = 1
const addUsedForm = ({ formId, formName }) => { usedForms.value.push({ id: usedFormUid++, formId, formName }); formWindowVisible.value = false }
const removeUsedForm = (id) => { usedForms.value = usedForms.value.filter(x => x.id !== id) }

// ---------- token bootstrap (document_type = 1) ----------
// 規則：
//   - snapshotView：使用 URL 上的 token（同一份文件），覆蓋原草稿
//   - 一般模式：用 initDoc(1) 建立 / 取得草稿 token
const ensureDraftToken = async () => {
  // Snapshot 模式：一定要用 URL 上的 token
  if (isSnapshotView.value) {
    const t = routeToken.value
    if (!t) {
      alert('缺少文件代碼 (token)，無法載入快照')
      return null
    }
    setToken(t, { updateUrl: false })
    return t
  }

  // 一般情況：如同原本邏輯
  if (draftToken.value) return draftToken.value

  try {
    // doc_type = 1 → 製造式樣書
    const res = await initDoc(1)
    if (res?.success && res.token) {
      setToken(res.token, { updateUrl: false })
      return res.token
    }
    throw new Error(res?.message || 'init failed')
  } catch (e) {
    console.error('docs/init failed:', e)
    alert('建立草稿代碼失敗，請稍後再試')
    return null
  }
}

// ---------- 文件產出 (step 8) ----------
const loading  = ref(false)
const errorMsg = ref('')

const docxSrc = ref('')          // blob URL 給 <WordPreview />
const previewLoading = ref(false)
let lastDocxUrl = null

watch(currentStep, (val) => {
  if (val === 8) {
    generateAndPreviewDocx()
  }
})

async function generateAndPreviewDocx() {
  previewLoading.value = true
  errorMsg.value = ''

  try {
    const t = await ensureDraftToken()
    if (!t) throw new Error('缺少 document token，無法預覽')

    // ★ Snapshot 來的 → 用 snapshot payload 產 Word
    if (isSnapshotView.value) {
      const url = `${API_BASE_URL}/docs/preview/${encodeURIComponent(t)}${
        rmsId.value ? `?rms_id=${encodeURIComponent(rmsId.value)}` : ''
      }`
      const res = await axios.get(url, { responseType: 'blob' })

      const blob = new Blob([res.data], {
        type:
          res.headers['content-type'] ||
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })

      if (lastDocxUrl) {
        URL.revokeObjectURL(lastDocxUrl)
      }
      const blobUrl = URL.createObjectURL(blob)
      lastDocxUrl = blobUrl
      docxSrc.value = blobUrl
      return
    }

    // ★ 一般模式：維持原本 POST /docs/preview/docx 行為
    const payload = {
      token: t,
      attribute: [{ ...form }],
      content: [
        ...toGenericBlocks(specBlocks.value, 4),
        ...serializeParamsFromMCR(),
        ...toGenericBlocks(qualityBlocks.value, 6),
        ...toGenericBlocks(otherBlocks.value, 7),
      ],
      reference: [
        ...(usedForms.value || []).map(f => ({
          referenceType: 1,
          referenceDocumentID: f.formId,
          referenceDocumentName: f.formName,
        })),
      ],
    }

    const url = `${API_BASE_URL}/docs/preview/docx`
    const res = await axios.post(url, payload, { responseType: 'blob' })

    const blob = new Blob([res.data], {
      type:
        res.headers['content-type'] ||
        'application/vnd.openxmlformats-officedocument-wordprocessingml.document',
    })

    if (lastDocxUrl) {
      URL.revokeObjectURL(lastDocxUrl)
    }
    const blobUrl = URL.createObjectURL(blob)
    lastDocxUrl = blobUrl
    docxSrc.value = blobUrl
  } catch (e) {
    console.error(e)
    errorMsg.value = e?.message || '預覽產生失敗'
  } finally {
    previewLoading.value = false
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
function extractErrorMessage(e, fallback = '文件產出失敗，請稍後再試') {
  console.error('generate word error:', e)

  let msg = fallback

  const resp = e?.response
  if (resp) {
    const ct = (resp.headers?.['content-type'] || '').toLowerCase()

    // axios 設了 responseType: 'blob'，後端 JSON 會被包成 Blob
    if (resp.data instanceof Blob) {
      // 這裡不能用 sync，要在呼叫端 await
      return resp.data.text().then((text) => {
        let parsedMsg = text || fallback

        // 嘗試當 JSON parse，再抓 message
        try {
          const obj = JSON.parse(text)
          if (obj && typeof obj === 'object' && obj.message) {
            parsedMsg = String(obj.message)
          }
        } catch {
          // 不是 JSON 就維持原本 text
        }

        // 如果含有 ORA-01031，替換成比較友善的說明
        if (parsedMsg.includes('ORA-01031')) {
          parsedMsg = 'EIP 建檔 / 歷史快照失敗：Oracle 權限不足（ORA-01031）。\n請聯絡資訊部或系統管理員開啟寫入 IDBUSER.RMS_DCC2EIP 的權限。'
        }

        // 把 \n 換成真正換行（如果你之後改成 <pre> 或 white-space: pre-wrap 會生效）
        return parsedMsg.replace(/\\n/g, '\n')
      })
    }

    // 如果不是 Blob（例如後端沒包成 Blob）
    if (resp.data && typeof resp.data === 'object' && 'message' in resp.data) {
      msg = String(resp.data.message)
    }
  }

  return Promise.resolve(msg)
}
async function generateAndDownloadDocx() {
  // ★ Snapshot 檢視模式：不允許重新產出 Word（避免重複建 RMS / EIP）
  if (isSnapshotView.value) {
    alert('此畫面為歷史快照檢視，只能預覽，無法重新產出 Word 文件。\n如需重新送簽，請改用「變版」功能或新建文件。')
    return
  }

  if (steps.some(step => !step.status)) {
    alert('請把內容完成才可下載')
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    const t = await ensureDraftToken()
    if (!t) throw new Error('缺少 document token，無法產出文件')

    const payload = {
      token: t,
      attribute: [{ ...form }],
      content: [
        ...toGenericBlocks(specBlocks.value, 4),
        ...serializeParamsFromMCR(),
        ...toGenericBlocks(qualityBlocks.value, 6),
        ...toGenericBlocks(otherBlocks.value, 7)
      ],
      reference: [
        ...(usedForms.value || []).map(f => ({
          referenceType: 1,
          referenceDocumentID: f.formId,
          referenceDocumentName: f.formName
        }))
      ]
    }
    const url = `${API_BASE_URL}/docs/generate/word`

    // 先強制儲存草稿
    await saveDraft()

    const res = await axios.post(url, payload, { responseType: 'blob' })

    const docIdHeader =
      res.headers['x-document-id'] || res.headers['X-Document-ID']
    if (docIdHeader) {
      form.documentID = docIdHeader
    }

    const contentType =
      res.headers['content-type'] ||
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const dispo = res.headers['content-disposition']
    const versionStr = Number(form.documentVersion ?? 1).toFixed(1)
    const filename = extractFilenameFromDisposition(dispo, `${form.documentName || 'document'}${versionStr}.docx`)

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
    // ...保留你原本的錯誤處理邏輯
    if (e?.response?.data instanceof Blob) {
      try {
        const text = await e.response.data.text()
        let msg = text || e.message || '文件產出失敗，請稍後再試'

        try {
          const obj = JSON.parse(text)
          if (obj && typeof obj === 'object' && obj.message) {
            msg = String(obj.message)
          }
        } catch {}

        if (msg.includes('ORA-01031')) {
          msg = 'EIP 建檔 / 歷史快照失敗：Oracle 權限不足（ORA-01031）。\n請聯絡資訊部或系統管理員開啟寫入 IDBUSER.RMS_DCC2EIP 的權限。'
        }

        errorMsg.value = msg.replace(/\\n/g, '\n')
      } catch {
        errorMsg.value = e?.message || '文件產出失敗，請稍後再試'
      }
    } else {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        '文件產出失敗，請稍後再試'
      errorMsg.value = msg
    }
  } finally {
    loading.value = false
  }
}

// ---------- save ----------
const isSaving = ref(false)

const saveDraft = async () => {
  // Snapshot 模式：直接用 URL token 覆蓋最新草稿
  let t
  if (isSnapshotView.value) {
    t = routeToken.value
    if (!t) {
      alert('缺少文件代碼，無法儲存草稿')
      return
    }

    setToken(t, { updateUrl: false })

    const ok = window.confirm(
      `${snapshotWarningMessage.value || '此畫面為歷史快照檢視'}\n\n` +
      '現在儲存會以目前畫面內容覆蓋這份文件最新草稿，確定要這樣做嗎？'
    )
    if (!ok) return
  } else {
    // 一般情況：走原本 ensureDraftToken 流程
    t = await ensureDraftToken()
    if (!t) return
  }

  try {
    isSaving.value = true

    const specBlockPayload = toGenericBlocks(specBlocks.value, 4)
    const qualityBlockPayload = toGenericBlocks(qualityBlocks.value, 6)
    const otherBlockPayload = toGenericBlocks(otherBlocks.value, 7)
    const paramPayload = serializeParamsFromMCR()

    const result = await saveDraftAll(t, {
      form,
      blockRequests: [
        { step_type: 4, blocks: specBlockPayload },
        { step_type: 6, blocks: qualityBlockPayload },
        { step_type: 7, blocks: otherBlockPayload },
      ],
      paramRequests: [
        { step_type: 5, blocks: paramPayload },
      ],
      references: {
        documents: [],
        forms: (usedForms.value || []).map(f => ({
          formId: f.formId,
          formName: f.formName,
        })),
      },
    })

    if (!result?.success) {
      return alert(result?.message || '屬性儲存失敗')
    }

    alert(`草稿已儲存（時間：${result.issueTime || ''}）`)
  } catch (e) {
    console.error('saveDraft failed:', e)
    alert('儲存草稿失敗')
  } finally {
    isSaving.value = false
  }
}

// ★ 共用：把後端撈回來的 snapshot/draft 結果套用到前端
const applyLoadedData = async (snapshot, { isSnapshot } = { isSnapshot: false }) => {
  // 1) attributes
  if (snapshot.attributes?.success) {
    Object.assign(form, snapshot.attributes.form || {})
  }

  // 如果是 snapshot 檢視 → 不要覆蓋原本的部門/作者
  // 否則正常帶入登入者資訊
  if (!isSnapshot) {
    form.department = sessionStorage.getItem('loggedInUserdeptName')
    form.author_id = sessionStorage.getItem('loggedInUserNo')
    form.author = sessionStorage.getItem('loggedInUserName')

    const personnel = await loadPersonnel(sessionStorage.getItem('loggedInUserNo'))
    if (personnel?.success) {
      if (!form.confirmer) form.confirmer = personnel.data.personnel.confirmer
      if (!form.approver) form.approver = personnel.data.personnel.approver
    }
  }

  // 依據品目載入 style options + 顯示 specification
  if (form.attribute?.itemType) {
    await loadStylesForItem(form.attribute.itemType)

    if (Array.isArray(form.attribute.specification)) {
      specificationDisplay.value = form.attribute.specification.map(s => s.name).join(', ')
    }
  }

  // 2) 規範 blocks (step_type=4)
  const sp = snapshot.blocks?.['4']
  if (sp?.success) {
    specBlocks.value = fromGenericBlocks(sp, 2)
  }

  // 3) 參數 (step_type=5)
  const pm = snapshot.params?.['5']
  if (pm?.success) {
    loadParamsIntoMCR(pm)
  } else {
    paramsLoaded.value = true
  }

  // 4) 品質與規格 blocks (step_type=6)
  const ql = snapshot.blocks?.['6']
  if (ql?.success) {
    qualityBlocks.value = fromGenericBlocks(ql, 4)
  }

  // 5) 其他 blocks (step_type=7)
  const ot = snapshot.blocks?.['7']
  if (ot?.success) {
    otherBlocks.value = fromGenericBlocks(ot, 6)
  }

  // 6) 使用表單
  const rf = snapshot.references
  if (rf?.success) {
    let i = 1
    usedForms.value = (rf.forms || []).map(f => ({
      id: i++,
      formId: f.formId,
      formName: f.formName,
    }))
  }
}
onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true })

  try {
    const t = await ensureDraftToken()
    if (!t) return

    let snapshot

    if (isSnapshotView.value) {
      // ⭐ 從 Submitted / Rejected 進來 → 用 snapshot-draft-all
      snapshot = await loadSnapshotDraftAll(t, {
        blocks: [4, 6, 7],
        params: [5],
        attrs: true,
        refs: true,
        rms_id: rmsId.value,
      })
      await applyLoadedData(snapshot, { isSnapshot: true })
    } else {
      // 一般新建/草稿 → 用 draft-all
      snapshot = await loadDraftAll(t, {
        blocks: [4, 6, 7],
        params: [5],
        attrs: true,
        refs: true,
      })
      await applyLoadedData(snapshot, { isSnapshot: false })
    }
  } catch (e) {
    console.error('load draft/snapshot failed:', e)
    alert(isSnapshotView.value ? '載入歷史快照失敗' : '載入草稿失敗')
    paramsLoaded.value = true
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})

const isRevision = computed(() => {
  return !!String(form.previousDocumentToken || '').trim()
})

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

/* Header */
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
.back-btn,
.save-btn {
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
.back-btn:hover,
.save-btn:hover {
  background-color: #5a6268;
}
.back-btn .icon,
.save-btn .icon {
  width: 18px;
  height: 18px;
  margin-right: 8px;
  filter: invert(100%);
}

/* Steps navigation（跟 NewInstruction.vue 同風格） */
.steps-navigation {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  transition: all 0.2s ease;
}
.steps-navigation.collapsed {
  padding: 6px 12px;
  transform: translateY(-4px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}
.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 999px;
  transition: background 0.15s, transform 0.15s;
  opacity: 0.85;
}
.steps-navigation.collapsed .step-item {
  transform: scale(0.92);
}
.step-item.active {
  background: #1f6feb;
  color: #fff;
  opacity: 1;
}
/* .step-item.completed {
  background: #e5f1ff;
} */
.step-circle {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.05);
}
.step-item.active .step-circle {
  background: rgba(255, 255, 255, 0.2);
}
.step-label {
  font-size: 14px;
}
.steps-navigation.collapsed .step-circle {
  width: 20px;
  height: 20px;
  font-size: 12px;
}
.steps-navigation.collapsed .step-label {
  font-size: 13px;
}

.step-item.step-error {
  background-color: #ffe5e5;
  border-color: #e74c3c;
  color: #000000;
}

.step-item.step-ok {
  background-color: #e6f9e8;
  border-color: #27ae60;
  color: #000000;
}

/* Content */
.form-section {
  padding: 20px 0;
}

.step-section {
  background-color: #f9f9f9;
  padding: 25px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  margin-bottom: 18px;
}
.step-section h2 {
  font-size: 22px;
  color: #333;
  margin-top: 0;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #007bff;
  display: inline-block;
}

/* Attribute Block */
.fundamental-attribute-block {
  display: flex;
  border: unset;
  padding: 0px;
}
.fundamental-attribute-block .attribute {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.fundamental-attribute-block .supplement {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.form-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
  padding: 8px;
}
.form-group label {
  width: 20%;
  font-size: 15px;
  color: #555;
  margin-bottom: 8px;
  font-weight: bold;
}
.form-group input,
.form-group textarea,
.form-group select {
  width: 70%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 15px;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}
.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: #008bff;
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}
.form-group textarea {
  resize: vertical;
  min-height: 80px;
}
.form-group input[readonly] {
  background-color: #e9ecef;
  color: #495057;
  cursor: not-allowed;
}
.form-group input.window-select {
  background: white;
  cursor: pointer;
}

/* Purpose */
.purpose-group {
  width: 100%;
  flex-grow: 1;
  height: 50%;
}
.purpose-group textarea {
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
.purpose-group textarea:focus {
  border-color: #007bff;
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

/* Common */
.layer-action-btn {
  margin: 10px;
  background: #1666c0;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 5px;
  font-size: 14px;
  cursor: pointer;
}

.form-block {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  margin: 10px 10px;
  border: 1px solid #ddd;
}
.form-label {
  padding: 8px 10px;
}
.form-label.no {
  border-right: 1px solid #ddd;
}
.form-label.id {
  display: inline-block;
  width: 200px;
  border-right: 1px solid #ddd;
}
.form-btn-block {
  display: flex;
  align-items: center;
}
.remove-btn {
  background: none;
  border: none;
  color: red;
  font-weight: bold;
  cursor: pointer;
  font-size: 1.2em;
}

/* 浮動工具列 */
.floating-tools {
  position: fixed;
  right: 24px;
  bottom: 72px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 20;
}
.tool-btn {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: none;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.tool-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.22);
  background: #f3f4f6;
}
.tool-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>