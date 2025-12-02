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

    <div class="steps-navigation" :class="{ 'collapsed': navCollapsed }">
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


    <div class="form-section">
      <!-- 一頁式內容區：Step 1 ~ 8 -->
      <div v-if="currentStep !== 9" class="content-page">
        <!-- Step 1 -->
        <section :ref="el => sectionRefs[0].value = el" class="step-section">
          <h2>基本屬性</h2>
          <div class="fundamental-attribute-block">
            <div class="attribute">
              <div class="form-group"><label for="doc-code">文管編號：</label><input type="text" id="doc-code" v-model="form.documentID" readonly/></div>
              <div class="form-group"><label for="doc-name">文件名稱：</label><input type="text" id="doc-name" v-model="form.documentName"/></div>
              <div class="form-group"><label for="doc-version">文件版本：</label><input type="text" id="doc-version" v-model="form.documentVersion" readonly/></div>
              <div class="form-group">
                <label for="apply-project">適用工程：</label>
                <select v-model="form.attribute.applyProject" :disabled="!!form.previousDocumentToken" @change = applyProjectChange>
                  <option value="">-- 請選擇適用工程 --</option>
                  <option v-for="p in projectList" :key="p.id" :value="p.projectName">{{ p.projectName }}</option>
                </select>
              </div>
              <div class="form-group">
                <label for="machines">適用機台：</label>
                <input class="input-machine" type="text" id="machines" v-model="inputMachines" @click="machinesListVisible=(form.attribute.applyProject.length > 0 && !machinesListVisible)" readonly/>
              </div>
              <div class="form-group"><label for="department">制訂單位：</label><input type="text" id="department" v-model="form.department" readonly/></div>
              <div class="form-group"><label for="author">制訂者：</label><input type="text" id="author" v-model="form.author" readonly/></div>
              <div class="form-group"><label for="confirmer">確認者：</label><input type="text" id="confirmer" v-model="form.confirmer"/></div>
              <div class="form-group"><label for="approver">承認者：</label><input type="text" id="approver" v-model="form.approver"/></div>
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
        </section>

        <!-- Step 2 -->
        <section :ref="el => sectionRefs[1].value = el" class="step-section">
          <h2>1. 目的</h2>
          <div class="purpose-group">
            <textarea v-model="form.documentPurpose" placeholder="此處將填寫文件的目的相關內容。"></textarea>
          </div>
        </section>

        <!-- Step 3 -->
        <section :ref="el => sectionRefs[2].value = el" class="step-section">
          <h2>2. 製造流程</h2>
          <ProcessFlowBlock
            v-model="processFlowData"
            :cols="9"
            :token="draftToken"
            :machineCode="firstMachineCode"
            :version="flowVersion"
            :allow-color="isRevisionDoc"
          />
        </section>

        <!-- Step 4 -->
        <section :ref="el => sectionRefs[3].value = el" class="step-section">
          <h2>3. 管理條件</h2>
          <!-- 原本 Step 4 的內容搬進來 -->
          <div class="Management">
            <button class="layer-action-btn add" @click="addManagementLayer">新增下一層</button>
          </div>
          
          <div class="management-combination-block">
            <ManagementSpecificBlock
              ref="managementSpecificBlockRef"
              :machines="form.attribute.machines"
              :managementBlock="managementSpecific"
              :has-pms="hasPmsForStep3"
              :allow-color="isRevisionDoc"
              @update-table-data="updateManagementTableData"
            />
          </div>
          <div v-if="managementBlocks.length > 0" class="management-content-bloc">
            <DynamicEditorBlock
              v-for="blk in managementBlocks"
              :key="blk.id"
              :block-editors="blk"
              :allow-color="isRevisionDoc"
              @update-block="updateManagementBlockData"
              @delete-block="removeManagementLayer"
            />
          </div>
        </section>

        <!-- Step 5 -->
        <section :ref="el => sectionRefs[4].value = el" class="step-section">
          <h2>4. 製造條件參數一覽表</h2>
          <ManufacturingConditionRuleBlocks
            :data-blocks="mcrBlocks"
            :cond-template="condTemplate"
            :param-template="paramTemplate"
            :current-step="currentStep"
            :has-pms="hasPmsForMcr"
            :has-conditions="hasCondForMcr"
            :spec-options="specOptionsForMcr"
            :document-token="draftToken"
            :allow-color="isRevisionDoc"
            :base-machine-code="baseMachineCode"
            @update:dataBlocks="mcrBlocks = $event"
            @save="mcrBlocks = $event"
          />
        </section>

        <!-- Step 6 -->
        <section :ref="el => sectionRefs[5].value = el" class="step-section">
          <h2>5. 異常處置</h2>
          <!-- 原本 Step 6 的 DynamicEditorBlock 區塊 -->
          <div class="Exception">
            <button class="layer-action-btn add" @click="addExceptionLayer">新增下一層</button>
          </div>

          <DynamicEditorBlock
            v-for="blockContent in exceptionBlocks"
            :key="blockContent.id"
            :blockEditors="blockContent"
            :allow-color="isRevisionDoc"
            @delete-block="removeExceptionLayer(blockContent.id)"
            @update-block="updateExceptionBlockData"
          ></DynamicEditorBlock>
        </section>

        <!-- Step 7 -->
        <section :ref="el => sectionRefs[6].value = el" class="step-section">
          <h2>6. 相關文件</h2>
          <!-- 原本 Step 7 的 DocSearchWindow 區塊 -->
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
        </section>

        <!-- Step 8 -->
        <section :ref="el => sectionRefs[7].value = el" class="step-section">
          <h2>7. 使用表單</h2>
          <!-- 原本 Step 8 的 FormSearchWindow 區塊 -->
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
        </section>
      </div>

      <!-- 輸出頁：Step 9 獨立畫面 -->
      <div v-else class="output-page">
        <div style="display: flex; justify-content: space-between; align-items:center;">
          <h2>文件產出</h2>
          <div style="display:flex; gap:.5rem;">
            <!-- 不再寫「預覽」，這顆專門當正式文件下載 (Word) -->
            <button @click="generateAndDownloadDocx" :disabled="loading" class="layer-action-btn add">
              {{ loading ? '產生中…' : '產生文件（Word）' }}
            </button>
            <!-- <button @click="requestEIPAPI" class="layer-action-btn add">拋轉EIP</button> -->
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
  <!-- 右側浮動工具列 -->
  <div class="floating-tools">
    <button class="tool-btn" @click="$router.push('/home')" title="回首頁">⌂</button>
    <button class="tool-btn" @click="scrollToTop" title="回到最上層">↑</button>
    <button class="tool-btn" @click="saveDraft" :disabled="isSaving" title="儲存草稿">💾</button>
  </div>

</template>

<script setup>
import axios from 'axios'
import { ref, reactive, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'

import ProjectListWindow from '@/components/ProjectListWindow.vue'
import MachinesListWindow from '@/components/MachinesListWindow.vue'
import ProcessFlowBlock from '@/components/ProcessFlowBlock.vue'
import ManagementSpecificBlock from '@/components/ManagementSpecificBlock.vue'
import DynamicEditorBlock from '@/components/DynamicEditorBlock.vue'
import ManufacturingConditionRuleBlocks from '@/components/ManufacturingConditionRuleBlocks.vue'
import DocSearchWindow from '@/components/DocSearchWindow.vue'
import FormSearchWindow from '@/components/FormSearchWindow.vue'
import PdfPreview from '@/components/PdfPreview.vue'
import WordPreview from '@/components/WordPreview.vue'
import { useDraftToken } from '@/composables/useDraftToken'
import { loadPersonnel, initDoc, saveDraftAll, loadDraftAll, loadSnapshotDraftAll } from '@/api/docsApi'
const { token: draftToken, setToken, clearToken } = useDraftToken('rms:draft:new-instruction')

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL

const route = useRoute()

const mode = computed(() => route.query.mode || '')
const isRejectedDoc = computed(() => mode.value === 'rejected')
const isSubmittedDoc = computed(() => mode.value === 'submitted')
const rmsId = computed(() => route.query.rms_id || '')

// ⭐ 判斷是不是變版模式
const isRevisionDoc = computed(() => route.query.mode === 'revision')

// --- ensure we have a server-side token row ---
const ensureDraftToken = async () => {
  if (draftToken.value) return draftToken.value
  try {
    const res = await initDoc(0)
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

// ---------- nav / steps ----------
const currentStep = ref(1)
const steps = [
  { label: '基本屬性', status: false},
  { label: '目的', status: false },
  { label: '製造流程', status: false },
  { label: '管理條件', status: false },
  { label: '製造條件參數一覽表', status: false },
  { label: '異常處置', status: false },
  { label: '相關文件', status: false },
  { label: '使用表單', status: false },
  { label: '文件產出' },
]

const flowVersion = ref(0)   // 專門給 Step3 流程用的 reload 版本號

// 一頁式 section refs（只需要前 8 章節）
const sectionRefs = Array.from({ length: 8 }, () => ref(null))

// 步驟列縮放
const navCollapsed = ref(false)

// 捲動時同步：1) 縮小 step-navigation  2) 更新目前所在章節
const handleScroll = () => {
  const scrollY =
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0

  // 1) 控制縮小 / 放大
  navCollapsed.value = scrollY > 120

  // 2) 根據捲動位置，讓 step-navigation 自動切換 active 章節
  //    - 只在 Step 1~8 的一頁式畫面才做；Step 9（輸出頁）不需要跟著跑
  if (currentStep.value === 9) return

  const navHeight = navCollapsed.value ? 56 : 96
  const targetY = scrollY + navHeight + 24 // 稍微往下 24px，避免剛貼到邊界就跳來跳去

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

  // index 0 -> Step 1, index 1 -> Step 2, ...
  currentStep.value = closestIndex + 1
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const scrollToStep = (index) => {
  currentStep.value = index

  // Step 1 ~ 8：一頁式捲動
  if (index >= 1 && index <= 8) {
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

  // Step 9：切到輸出頁，順便回到最上
  if (index === 9) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
const goToStep = scrollToStep

// ---------- step 驗證狀態（只先做 Step1, Step2） ----------
const isStep1Valid = computed(() => {
  // 版本：可能是 number 或 string，統一轉成 float
  const versionNum = parseFloat(String(form.documentVersion ?? '0'))

  // Left block 必填欄位
  const leftFields = [
    form.documentName,
    form.documentVersion,
    form.attribute.applyProject,
    form.department,
    form.author,
    form.confirmer,
    form.approver,
  ]

  // 槽：選了機台才算有填
  const hasMachines =
    (Array.isArray(form.attribute.machines) && form.attribute.machines.length > 0) ||
    (String(inputMachines.value ?? '').trim().length > 0)

  // 先檢查左邊欄位 & 機台
  if (!hasMachines) return false
  if (leftFields.some(v => !String(v ?? '').trim())) return false

  // 版本 > 1.0 時，右側「變更理由」「變更要點」也變成必填
  if (versionNum > 1.0) {
    if (!String(form.reviseReason ?? '').trim()) return false
    if (!String(form.revisePoint ?? '').trim()) return false
  }

  return true
})
const isStep2Valid = computed(() => {
  return String(form.documentPurpose ?? '').trim().length > 0
})
const isStep3Valid = computed(() => {
  const pf = processFlowData.value || {}

  // 1) 圖片模式：有檔案就算有填寫
  if (pf.mode === 'image') {
    return !!(pf.file && (pf.file.url || pf.file.path || pf.asset_id))
  }

  // 2) 表格模式
  if (pf.mode === 'table') {
    const items = pf.items

    // 2-1 舊格式：items 是 steps array（純字串陣列）
    if (Array.isArray(items)) {
      return items.some(s => String(s || '').trim() !== '')
    }

    // 2-2 新格式：TipTap doc JSON
    if (items && typeof items === 'object' && items.type === 'doc') {
      try {
        hasNonEmptyFlowCell(items)
      } catch (e) {
        if (e && e.message === '__HAS_CONTENT__') {
          return true
        }
      }
      return false
    }

    return false
  }

  // 其他未知模式 → 視為沒填
  return false
})
const isStep4Valid = computed(() => {
  const pmsStatus = isPmsTableValid()      // true / false / null
  const hasDynamic = (managementBlocks.value || []).length > 0

  // 是否「這一步有東西要填」
  const hasAnyContent = (pmsStatus !== null) || hasDynamic
  if (!hasAnyContent) {
    // ✅ 規則 1：沒有 PMS & 沒有 DynamicBlock → Step4 不需要填寫
    return null          // 用 null 代表「不適用」
  }

  let ok = true
  if (pmsStatus !== null) { ok = ok && pmsStatus }
  if (hasDynamic) { ok = ok && areDynamicBlocksValid(managementBlocks.value) }
  return ok
})
const isStep5Valid = computed(() => {
  const hasCond = hasCondForMcr.value
  const hasPms  = hasPmsForMcr.value
  const blocksArr = mcrBlocks.value || []

  // 規則 1：完全沒有 PMS + 沒有條件 → 此 step 不用上色
  if (!hasCond && !hasPms) {
    return null
  }

  // 有東西要填，但一個 block 都沒有 → 視為沒填
  if (!blocksArr.length) return false

  let ok = true

  // 🔸 [新增] 每個 block 都要至少選一個 specification / programLinks
  for (const b of blocksArr) {
    const hasPrograms =
      (Array.isArray(b.data?.metadata.programs) && b.data?.metadata.programs.length > 0) ||
      (b.specCode && String(b.specCode).trim() !== '')
    if (!hasPrograms) {
      ok = false
      break
    }
  }

  // ---- 条件 table 檢查 ----
  if (ok && hasCond) {
    for (const b of blocksArr) {
      const v = isConditionTableValidForBlock(b)
      if (v === false) {
        ok = false
        break
      }
    }
    if (ok && hasConditionDuplicates(blocksArr)) {
      ok = false
    }
  }

  // ---- PMS table 檢查 ----
  if (ok && hasPms) {
    for (const b of blocksArr) {
      const v = isParamTableValidForBlock(b)
      if (v === false) {
        ok = false
        break
      }
    }
    if (ok && hasParamTableDuplicates(blocksArr)) {
      ok = false
    }
  }

  return ok
})
const isStep6Valid = computed(() => {
  const blocksArr = exceptionBlocks.value || []
  if (!blocksArr.length) return null   // 不要求一定要寫異常處置

  return areDynamicBlocksValid(blocksArr)
})
const isStep7Valid = computed(() => {
  return (relativeDocuments.value || []).length > 0 ? true : null
})
const isStep8Valid = computed(() => {
  return (usedForms.value || []).length > 0 ? true : null
})
const stepStatusClass = (index) => {
  const stepNo = index + 1

  // 只在 stepNo <= currentStep 時顯示紅 / 綠
  if (stepNo > currentStep.value) return ''

  if (stepNo === 1) {
    steps[index].status = isStep1Valid.value ? true : false
    return isStep1Valid.value ? 'step-ok' : 'step-error'
  }
  if (stepNo === 2) {
    steps[index].status = isStep2Valid.value ? true : false
    return isStep2Valid.value ? 'step-ok' : 'step-error'
  }
  if (stepNo === 3) {
    steps[index].status = isStep3Valid.value ? true : false
    return isStep3Valid.value ? 'step-ok' : 'step-error'
  }
  if (stepNo === 4) {
    const v = isStep4Valid.value
    // v === null → 不適用，不改變背景
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = v ? true : false
    return v ? 'step-ok' : 'step-error'
  }
  // 🔹 新增：Step 5
  if (stepNo === 5) {
    const v = isStep5Valid.value
    // v === null → 沒有 PMS & 沒有條件 table，不上色
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = v ? true : false
    return v ? 'step-ok' : 'step-error'
  }
  // 🔹 Step 6：異常處置（DynamicEditorBlock）
  if (stepNo === 6) {
    const v = isStep6Valid.value
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = v ? true : false
    return v ? 'step-ok' : 'step-error'
  }

  // 🔹 Step 7：相關文件
  if (stepNo === 7) {
    const v = isStep7Valid.value
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = true
    return 'step-ok'
  }

  // 🔹 Step 8：使用表單
  if (stepNo === 8) {
    const v = isStep8Valid.value
    if (v === null) {
      steps[index].status = true
      return ''
    }
    steps[index].status = true
    return 'step-ok'
  }

  // 其他步驟先不做驗證
  steps[index].status = true
  return 'step-ok'
}

// ---------- basic form ----------
let itemID = 0
const projectList = ref([]);
const inputMachines = ref('');
const form = reactive({
  documentType: 0,
  documentID: '',
  documentName: 'KF_RTR腔體銑削制程課-01_製造條件指示書',
  documentVersion: 1.0,
  attribute: { applyProject: '', machines: [] },
  department: '',
  author_id: '',
  author: '',
  approver: '',
  confirmer: '',
  reviseReason: '',
  revisePoint: '',
  documentStyle: 'FM-R-MF-AZ-052 Rev9.0',
  documentPurpose: '',
  previousDocumentToken: '', // 🔸 新增
})

// ---------- popups ----------
const projectsListVisible = ref(false)
const machinesListVisible = ref(false)
function applyProjectChange(event) {
  form.attribute.machines = []
  inputMachines.value = ""
  processFlowData.value = { mode: 'table', cols: 9, header_json: null, items: [], file: null }
  flowVersion.value++;

  managementSpecific.value = {
    ...managementSpecific.value,
    data: { jsonContent: null, arrayData: [] }
  }

  hasPmsForStep3.value = false
  hasPmsForMcr.value  = false
  hasCondForMcr.value = false
  paramTemplate.value = null
  condTemplate.value  = null
  mcrBlocks.value     = []
}
const getProject = val => { if (val) form.attribute.applyProject = val }
const groupSummary = ref({})  // groupCode -> { code, name, total }
const getMachines = async (payload) => {
  const machines = payload?.selected || []
  groupSummary.value = payload?.groupsSummary || {}

  form.attribute.machines = machines

  // 顯示在 input 內的機台名稱
  inputMachines.value = machines.map(m => m.name).join(', ')

  // 取得「新的第一台機台代碼」
  let newFirstCode = ''
  if (Array.isArray(form.attribute.machines) && form.attribute.machines.length > 0) {
    const m0 = form.attribute.machines[0]
    newFirstCode = m0.machineCode || m0.MACHINE_CODE || m0.code || ''
  }

  // ⚠️ 這裡是關鍵：
  // 若「機台真的有變」（包括從空 -> 有機台），重置 Step3 的流程資料
  if (newFirstCode !== lastMachineCodeForProcessFlow.value) {
    // 重置流程資料成「完全空」，讓 ProcessFlowBlock 重新掛載時判定為「新狀態」→ 自動用 PMS 帶入
    processFlowData.value = { mode: 'table', cols: 9, header_json: null, items: [], file: null }

    // 記住目前流程綁的這台機台
    lastMachineCodeForProcessFlow.value = newFirstCode

    // ⭐ 通知流程區塊重新吃「空資料（或 PMS）」：子元件會自己判斷是否要載 PMS
    flowVersion.value++
  } else {
    console.log('[Step3] machine unchanged, keep existing processFlowData')
  }

  // ---------- 以下維持你原本 Step4 / Step5 的 PMS / MCR ----------
  if (Array.isArray(machines) && machines.length > 0) {
    const code = machines[0].code

    // 先處理 Step4 的 PMS
    await loadPmsTemplate(code)

    // 再處理 Step5 的 template & flag
    await loadMcrTemplates(code)

    // 最後清空 mcrBlocks 讓子元件重建 Editor
    mcrBlocks.value = []
  } else {
    // 沒選機台 → 完全清空
    managementSpecific.value = {
      ...managementSpecific.value,
      data: { jsonContent: null, arrayData: [] }
    }

    hasPmsForMcr.value  = false
    hasCondForMcr.value = false
    paramTemplate.value = null
    condTemplate.value  = null
    mcrBlocks.value     = []
  }
  // ★ 根據所選機台自動更新文件名稱
  updateDocumentNameByMachines()
}
const baseMachineCode = computed(() => {
  const ms = form.attribute.machines || []
  if (!ms.length) return ''
  const m0 = ms[0]
  return m0.machineCode || m0.MACHINE_CODE || m0.code || ''
})

// --------- 機台命名工具 ---------
// 棟別前綴：K#4F -> K#，A#1F -> A#
function extractBuildingPrefix(building) {
  if (!building) return ''
  const idx = building.indexOf('#')
  if (idx === -1) return building
  return building.slice(0, idx + 1)
}

// 把數字字串陣列（例如 ['01','02','04']）壓成 ['01~02','04']
function compressNumberRanges(numStrs) {
  if (!numStrs.length) return []
  const arr = Array.from(new Set(numStrs)).map(s => ({
    s,
    n: parseInt(s, 10),
  })).sort((a, b) => a.n - b.n)

  const segments = []
  let start = arr[0]
  let prev = arr[0]

  for (let i = 1; i < arr.length; i++) {
    const cur = arr[i]
    if (cur.n === prev.n + 1) {
      prev = cur
    } else {
      if (start.n === prev.n) segments.push(start.s)
      else segments.push(`${start.s}~${prev.s}`)
      start = cur
      prev = cur
    }
  }

  if (start) {
    if (start.n === prev.n) segments.push(start.s)
    else segments.push(`${start.s}~${prev.s}`)
  }
  return segments
}
// 拿掉 "(L23A05)" 這種 code prefix，只留下後面的機台名稱
const CODE_PREFIX_RE = /^\s*\([^)]*\)\s*(.*)$/
function stripCodePrefix(raw) {
  if (!raw) return ''
  const m = raw.match(CODE_PREFIX_RE)
  return (m ? m[1] : raw).trim()
}

/**
 * 單一群組命名：
 *   groupName: 這個群組名稱（例如 "RTR 乾膜前處理線"）
 *   machines:  該群組被選取的機台陣列（都屬於同一 groupCode）
 *   groupTotal: 這個群組母群台數（來自 groupsSummary）
 */
function buildGroupMachineName(groupName, machines, groupTotal) {
  if (!machines.length) return ''

  // === 3.2 / 3.3：整群被選 → 直接用「去掉前綴 code」的群組名稱 ===
  const cleanGroupName = stripCodePrefix(groupName || '')
  if (groupTotal && machines.length >= groupTotal) {
    return cleanGroupName || stripCodePrefix(machines[0].name)
  }

  // --- 3.4.x：部分選 → 先解析每一台，再依 prefix 拆成多個 cluster 各自合併 ---

  const parsed = machines.map(m => {
    const raw = m.name || ''
    // e.g. "(L23A05)蝕刻線-03-A" -> "蝕刻線-03-A"
    const base = stripCodePrefix(raw)
    const parts = base.split('-').map(p => p.trim()).filter(Boolean)

    let prefix = base
    let num = null
    let suffix = null

    if (parts.length >= 3) {
      prefix = parts.slice(0, -2).join('-')   // "蝕刻線-03-A" -> "蝕刻線"
      num = parts[parts.length - 2]           // "03"
      suffix = parts[parts.length - 1]        // "A"
    } else if (parts.length === 2) {
      prefix = parts[0]
      if (/^\d+/.test(parts[1])) num = parts[1]
      else suffix = parts[1]
    }

    return { raw, base, prefix, num, suffix }
  })

  // 如果有任何一台完全拆不出 num/suffix，就直接平列「去 prefix 後的名字」
  if (parsed.some(p => !p.num && !p.suffix)) {
    const uniq = Array.from(new Set(parsed.map(p => p.base)))
    return uniq.join('、')
  }

  // 依 prefix 分 cluster，例如：
  //   cluster1: prefix="蝕刻線" → 01-A, 02-A, 03-A
  //   cluster2: prefix="RTR 蝕刻線" → 04-A
  const clusters = new Map()
  parsed.forEach(p => {
    if (!clusters.has(p.prefix)) clusters.set(p.prefix, [])
    clusters.get(p.prefix).push(p)
  })

  function buildForPrefix(basePrefix, list) {
    // num -> suffixSet
    const suffixSetByNum = new Map()
    list.forEach(p => {
      const key = p.num || ''
      if (!suffixSetByNum.has(key)) suffixSetByNum.set(key, new Set())
      suffixSetByNum.get(key).add(p.suffix || '')
    })

    const allNums = Array.from(suffixSetByNum.keys())
    const sizes = Array.from(suffixSetByNum.values()).map(s => s.size)
    const maxSuffixCnt = sizes.length ? Math.max(...sizes) : 0

    const segments = []

    // fullNums: suffix 數量達到 max 的 num（例如 01 同時有 A/B）
    const fullNums = allNums.filter(num => {
      const size = suffixSetByNum.get(num)?.size || 0
      return size >= 2 && size === maxSuffixCnt
    })
    const partialNums = allNums.filter(num => !fullNums.includes(num))

    // 3.4.1 / 3.4.3：01-A + 01-B → "01"，多個 full num → "01、02"
    if (fullNums.length) {
      fullNums.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      segments.push(fullNums.join('、'))
    }

    // 3.4.4 / 3.4.5：對 partial num 做 01~03 / 01~02、04
    const bySuffix = new Map()
    list.forEach(p => {
      if (!partialNums.includes(p.num)) return
      const sfx = p.suffix || ''
      if (!bySuffix.has(sfx)) bySuffix.set(sfx, [])
      bySuffix.get(sfx).push(p.num)
    })

    Array.from(bySuffix.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([sfx, nums]) => {
        const segNums = compressNumberRanges(nums)
        const segStr = segNums
          .map(seg => (sfx ? `${seg}-${sfx}` : seg))
          .join('、')
        if (segStr) segments.push(segStr)
      })

    const tail = segments.join('、')
    return tail ? `${basePrefix}-${tail}` : basePrefix
  }

  // 每個 prefix cluster 都跑一次 buildForPrefix，最後用 "、" 接起來
  const allSegments = []
  for (const [prefix, list] of clusters.entries()) {
    allSegments.push(buildForPrefix(prefix, list))
  }

  return allSegments.join('、')
}
function updateDocumentNameByMachines() {
  const machines = form.attribute.machines || []
  if (!machines.length) return

  // 1) buildings set
  const buildingSet = new Set()
  machines.forEach(m => {
    const prefix = extractBuildingPrefix(m.building)
    if (prefix) buildingSet.add(prefix)
  })
  const buildings = Array.from(buildingSet).sort().join('')

  // 2) 依 group 分組
  const byGroup = new Map() // groupCode -> { groupName, machines: [] }
  machines.forEach(m => {
    const gcode = m.groupCode || '__NO_GROUP__'
    if (!byGroup.has(gcode)) {
      byGroup.set(gcode, {
        groupName: m.groupName || '',
        machines: [],
      })
    }
    byGroup.get(gcode).machines.push(m)
  })

  // 3) 對每個群組跑 buildGroupMachineName
  const perGroupNames = []
  for (const [gcode, { groupName, machines: groupMachines }] of byGroup.entries()) {
    const summary = groupSummary.value[gcode] || {}
    const total = summary.total || 0
    perGroupNames.push(
      buildGroupMachineName(groupName, groupMachines, total)
    )
  }

  perGroupNames.sort()
  const machineNameRule = perGroupNames.join('、')

  const suffix = '製造條件指示書'
  form.documentName = `${buildings}_${machineNameRule}_${suffix}`
}

// ---------- process (step 3) ----------
const processFlowData = ref({
  mode: 'table',                // instead of 0/1, but you can keep 0/1 if you prefer
  cols: 9,
  header_json: null,
  items: [],
  file: null,                   // { asset_id, url, path }
})

const lastMachineCodeForProcessFlow = ref('')
const firstMachineCode = computed(() => {
  const machines = form.attribute?.machines || []
  if (!Array.isArray(machines) || !machines.length) return ''
  const m0 = machines[0]

  // 根據你實際的欄位調整，這裡做比較保險的寫法
  return m0.machineCode || m0.MACHINE_CODE || m0.code || ''
})

// ---------- helper: 從 TipTap node 抽文字 ----------
function extractTextFromNode(node) {
  if (!node) return ''
  if (node.type === 'text' && node.text) return node.text
  const children = node.content || []
  let out = ''
  for (const child of children) {
    out += extractTextFromNode(child)
  }
  return out
}

/**
 * 檢查流程 table 的「流程列」是否有非空內容
 * - 只看 table 裡的 row：
 *   rowIndex 偶數   → header 列（有「步驟，1，2，3」）
 *   rowIndex 奇數   → 流程列（有「熱水洗1、剝膜1…」）
 * - 流程列內的第 0 欄是標題「流程」，從第 1 欄起才是流程內容
 */
function hasNonEmptyFlowCell(docJson) {
  if (!docJson || docJson.type !== 'doc') return false
  const content = Array.isArray(docJson.content) ? docJson.content : []
  const tableNode = content.find(n => n.type === 'table')
  if (!tableNode) return false

  const rows = Array.isArray(tableNode.content) ? tableNode.content : []
  let rowIdx = 0

  for (const row of rows) {
    const cells = Array.isArray(row.content) ? row.content : []

    // 奇數列：流程列
    const isProcessRow = rowIdx % 2 === 1
    if (isProcessRow) {
      cells.forEach((cell, ci) => {
        // ci === 0 是左邊的「流程」那格，不算內容
        if (ci === 0) return
        const text = extractTextFromNode(cell)
        if (String(text || '').trim() !== '') {
          // 有任一流程格有文字，就算「有填寫」
          throw new Error('__HAS_CONTENT__')
        }
      })
    }
    rowIdx++
  }

  return false
}

// process-flow <-> blocks (step_type = 0)
function serializeProcessFlowToBlocks(pf) {
  if (pf.mode === 'table') {
    return [{
      step_type: 0,
      tier: 1,
      data: [{
        option: 2,
        jsonHeader: pf.header_json || null,
        // jsonContent: { cols: Number(pf.cols || 9), items: pf.items },
        jsonContent: pf.items,
        files: []
      }]
    }]
  }
  return [{
    step_type: 0,
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
  if (!first) {
    return { mode: 'table', cols: 9, header_json: null, items: [], file: null }
  }

  if (first.option === 2) {
    const jc = first.jsonContent

    // 1️⃣ 舊格式：{ cols: 9, items: [...] }
    if (jc && typeof jc === 'object' && Array.isArray(jc.items)) {
      return {
        mode: 'table',
        cols: Number(jc.cols || 9),
        header_json: first.jsonHeader || null,
        items: jc.items,   // 這裡是舊版 steps array，ProcessFlowBlock 會自動升級成 doc JSON
        file: null,
      }
    }

    // 2️⃣ 新格式：TipTap doc JSON：{ type:'doc', content:[...] }
    if (jc && typeof jc === 'object' && jc.type === 'doc') {
      return {
        mode: 'table',
        cols: 9, // 你現在固定用 9 欄，真的要動態 cols 之後再加欄位
        header_json: first.jsonHeader || null,
        items: jc,   // 直接給 doc JSON，ProcessFlowBlock initialTableDoc 會直接使用
        file: null,
      }
    }

    // 3️⃣ 其他怪格式 → 給一個空的 table
    return {
      mode: 'table',
      cols: 9,
      header_json: first.jsonHeader || null,
      items: [],
      file: null,
    }
  }

  if (first.option === 1) {
    return {
      mode: 'image',
      cols: 9,
      header_json: first.jsonHeader || null,
      items: [],
      file: (first.files || [])[0] || null,
    }
  }

  return { mode: 'table', cols: 9, header_json: null, items: [], file: null }
}

// ---------- 管理條件 (step 4) ----------
const managementSpecificBlockRef = ref(null)
const managementSpecific = ref({id: 0, step: 3, tier: 1, data: {jsonContent: null, arrayData: []}})
const hasPmsForStep3  = ref(false)   // Step 3 生產基本條件 PMS

// 載入第一台機台的 PMS 模板
const loadPmsTemplate = async (machineCode) => {
  if (!machineCode) {
    managementSpecific.value = { ...managementSpecific.value,  data: { jsonContent: null, arrayData: [] } }
    return
  }

  try {
    const API = import.meta.env.VITE_APP_API_BASE_URL
    const { data } = await axios.get(`${API}/mes/pms/machine-parameters`, {
      params: { machine_id: machineCode },
    })
    
    hasPmsForStep3.value = (data.data.table_rows.length > 0) ? true : false
    
    const tableRows = data?.data?.table_rows || []

    managementSpecific.value = {
      ...managementSpecific.value,
      data: {
        ...managementSpecific.value.data,
        arrayData: tableRows,     // 2D 陣列丟給子元件
        jsonContent: null,        // 讓子元件用 arrayData 產生 TipTap 內容
      },
    }
  } catch (e) {
    console.error('loadPmsTemplate error:', e)
  }
}

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
      step_type: 1,
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
      step_type: 1,
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

// ---------- Step4 驗證用 helper ----------

// 遞迴把 TipTap JSON 裡的文字抽出來
function extractPlainTextFromNode(node) {
  if (!node) return ''
  if (node.type === 'text' && node.text) return node.text
  const children = node.content || []
  let out = ''
  for (const child of children) {
    out += extractPlainTextFromNode(child)
  }
  return out
}
// 支援 string / doc JSON
function extractPlainTextFromDocJson(doc) {
  if (!doc) return ''
  if (typeof doc === 'string') return doc.trim()
  return extractPlainTextFromNode(doc).trim()
}
/** Step4-1: PMS 表格是否有效
 *  - 沒有 PMS（hasPmsForStep3 = false 或 arrayData 太少）→ 回傳 null（代表「不適用」）
 *  - 有 PMS：每列第 3~7 欄都要「非空 & 數字」才算 valid
 */
function isPmsTableValid() {
  // 這台機本來就沒有 PMS → 不適用
  if (!hasPmsForStep3.value) return null

  const doc = managementSpecific.value?.data?.jsonContent
  if (!doc || typeof doc !== 'object') {
    // 有 PMS 的機台，但還沒打開/編輯過管理條件 → 視為沒填
    return false
  }

  // 找第一個 table
  const tables = Array.isArray(doc.content)
    ? doc.content.filter(n => n.type === 'table')
    : []
  if (!tables.length) {
    // 有 PMS 設定但內容不是 table → 視為沒填完
    return false
  }

  const tableNode = tables[0]
  const rows = Array.isArray(tableNode.content) ? tableNode.content : []

  // 至少要有表頭 + 1 列
  if (rows.length <= 1) {
    return false
  }

  // 從第 2 列（index 1）開始檢查
  for (let r = 1; r < rows.length; r++) {
    const rowNode = rows[r]
    const cells = Array.isArray(rowNode.content) ? rowNode.content : []

    // 欄位 index 對應： 0 "項次", 1 "槽體", 2 "管理項目", 3 "規格下限(OOS-)", 4 "操作下限(OOC-)," 5 "設定值", 6 "操作上限(OOC+)", 7 "規格上限(OOS+)", 8 "單位"
    for (let c = 3; c <= 7; c++) {
      const cellNode = cells[c]
      if (!cellNode) return false

      const raw = extractPlainTextFromNode(cellNode).trim()
      if (!raw) return false                     // 空白 → 未填完
      const num = Number(raw)
      if (!Number.isFinite(num)) return false   // 不是數字 → 無效
    }
  }

  return true
}

/** Step4-2: 單一 DynamicEditorBlock 的某一 item 是否有效 */
function isDynamicBlockItemValid(item) {
  const titleText = extractPlainTextFromDocJson(item.jsonHeader)
  const hasTitle = titleText.length > 0

  // 👉 只要這個項目存在，title 一律必填
  if (!hasTitle) {
    return false
  }

  const contentText = extractPlainTextFromDocJson(item.jsonContent)
  const hasFiles = Array.isArray(item.files) && item.files.length > 0

  // option 0: 純標題 OK（小標）
  if (item.option === 0) {
    return true
  }

  // option 1: 文字框 or 圖 → 要有文字或有檔案其一
  if (item.option === 1) {
    return !!(contentText.length || hasFiles)
  }

  // option 2: 表格 → 每一列不能全為空
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
      const isHeaderRow = (r === 0)
      if (isHeaderRow) continue

      let rowHasText = false
      for (const cell of cells) {
        const cellText = extractPlainTextFromNode(cell).trim()
        if (cellText) {
          rowHasText = true
          break
        }
      }
      if (!rowHasText) {
        // 有一列完全空 → 視為未填完
        return false
      }
    }
    return true
  }

  return true
}
/** Step4-3: 所有 DynamicEditorBlock 是否都有效 */
function areDynamicBlocksValid(blocksArr) {
  const blocks = blocksArr || []
  for (const blk of blocks) {
    const items = blk.data || []
    for (const item of items) {
      if (!isDynamicBlockItemValid(item)) {
        return false
      }
    }
  }
  return true
}

// ---------- 製造條件參數一覽表 (step 5) ----------
const mcrBlocks = ref([])
const paramTemplate = ref(null)   // tiptap JSON for parameter table
const condTemplate  = ref(null)   // tiptap JSON for condition table

const hasPmsForMcr   = ref(false)   // 此機台 PMS（製造條件一覽表用）是否有資料
const hasCondForMcr  = ref(false)   // 此機台 條件參數 是否有資料

const loadMcrTemplates = async (machineCode) => {
  if (!machineCode) {
    paramTemplate.value = null
    condTemplate.value = null
    return
  }

  try {
    const API = import.meta.env.VITE_APP_API_BASE_URL

    const [pmsRes, condRes] = await Promise.all([
      axios.get(`${API}/mes/pms/machine-parameters-set-attribute`, {
        params: { machine_id: machineCode },
      }),
      axios.get(`${API}/conditions/search-conditions-by-machines`, {
        params: { keyword: machineCode },   // 用機台代碼當 keyword
      }),
    ])

    hasPmsForMcr.value = (pmsRes.data.data.table_rows.length > 0) ? true : false
    hasCondForMcr.value = (condRes.data.data.conditions.length > 0) ? true : false

    // 1) PMS → parameter table template
    const tableRows = pmsRes?.data?.data?.table_rows || []
    paramTemplate.value = tableRows.length ? tableRows : null

    // 2) 條件組 → condition template
    const condList = condRes?.data?.data?.conditions || []
    // condList 裡每一個長這樣：
    // { id, name, parameters: ['全鍍', '多層板內外層', ...] }
    const condTemplateArr = condList.map(c => ({
      name: c.name,   // or c.condition_name，看你實際回傳欄位
      options: (c.parameters || []).map(p => ({
        label: p,
        value: p,     // 這邊我用同一個字，之後如果有 code 再換
      })),
    }))

    condTemplate.value = condTemplateArr.length ? condTemplateArr : null
  } catch (e) {
    console.error('loadMcrTemplates error:', e)
    // 出錯就回到預設模板
    paramTemplate.value = null
    condTemplate.value = null
  }
}
const specOptionsForMcr = computed(() => {
  const machines = form.attribute?.machines || []
  const map = new Map()  // code -> name

  machines.forEach(m => {
    const specs = Array.isArray(m.specifications) ? m.specifications : []
    specs.forEach(spec => {
      if (!spec || !spec.code) return
      const code = spec.code
      const name = spec.name || spec.code
      if (!map.has(code)) {
        map.set(code, name)
      }
    })
  })

  // 給子元件用：[{ code, name }]
  return Array.from(map, ([code, name]) => ({ code, name }))
})

// ---------- Step5 驗證用 helper ----------
// 保險轉成 2D array
function normalize2DArray(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(row => (Array.isArray(row) ? row : []))
}
function isConditionTableValidForBlock(block) {
  if (!hasCondForMcr.value) return null

  const rows = normalize2DArray(block?.data?.arrayConditionData)
  if (!rows.length) return false

  const rowCount = rows.length
  const colCount = rows[0].length || 0

  // 至少要有 header + 1 列資料，且至少 2 欄
  if (rowCount <= 1 || colCount <= 1) return false

  for (let r = 1; r < rowCount; r++) {
    const row = rows[r] || []
    for (let c = 1; c < colCount; c++) {
      const v = (row[c] ?? '').toString().trim()
      if (!v) {
        // 有一格沒選 → 視為未填完
        return false
      }
    }
  }
  return true
}
function hasConditionDuplicates(blocksArr) {
  const seen = new Map()   // key -> [{blockIdx,rowIndex}, ...]

  blocksArr.forEach((b, blockIdx) => {
    const rows = normalize2DArray(b?.data?.arrayConditionData)
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || []
      const slice = row.slice(1)  // 去掉第 0 欄
      const hasAny = slice.some(v => (v ?? '').toString().trim() !== '')
      if (!hasAny) continue   // 全空列就不拿來比對

      const key = JSON.stringify(slice)
      const list = seen.get(key) || []
      list.push({ blockIdx, rowIndex: r })
      seen.set(key, list)
    }
  })

  for (const list of seen.values()) {
    if (list.length > 1) {
      return true
    }
  }
  return false
}
function isParamTableValidForBlock(block) {
  if (!hasPmsForMcr.value) return null

  const rows = normalize2DArray(block?.data?.arrayParameterData)
  if (!rows.length) return false

  const rowCount = rows.length
  const colCount = rows[0].length || 0

  // 至少 header + 1 列，且要有到第 6 欄 (index 6)
  if (rowCount <= 1 || colCount <= 6) return false

  for (let r = 1; r < rowCount; r++) {
    const row = rows[r] || []
    const values = []

    // 參考 runParamValueValidation：檢查第 2~6 欄
    for (let c = 2; c <= 6; c++) {
      const raw = (row[c] ?? '').toString().trim()
      if (!raw) return false
      const num = Number(raw)
      if (!Number.isFinite(num)) return false
      values.push(num)
    }

    // 檢查單調性：前者 > 後者 就當 error
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > values[i]) {
        return false
      }
    }
  }

  return true
}
function hasParamTableDuplicates(blocksArr) {
  const sigs = []

  blocksArr.forEach((b, idx) => {
    const rows = normalize2DArray(b?.data?.arrayParameterData)
    const mat = []

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || []
      const slice = row.slice(2, 7) // index 2~6
      mat.push(slice.map(v => (v ?? '').toString().trim()))
    }

    sigs.push({ idx, key: JSON.stringify(mat) })
  })

  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      if (sigs[i].key && sigs[i].key === sigs[j].key) {
        return true
      }
    }
  }
  return false
}

// NEW — send both parameter & condition for each tier + programLinks
const serializeMCRToParams = () => {
  if (!hasPmsForMcr.value && !hasCondForMcr.value)
    return []

  return (mcrBlocks.value || []).map((blk, i) => {
    // 優先用 metadata.programs，沒有的話退回 blk.programLinks
    const meta = blk.data?.metadata || {}
    const programsFromMeta = Array.isArray(meta.programs) ? meta.programs : []
    const programs = programsFromMeta.length ? programsFromMeta : (Array.isArray(blk.programLinks) ? blk.programLinks : [])

    return {
      step_type: 2,
      tier_no: i + 1,
      jsonParameterContent: blk.data?.jsonParameterContent || null,
      arrayParameterData:   blk.data?.arrayParameterData   || [],
      jsonConditionContent: blk.data?.jsonConditionContent || null,
      arrayConditionData:   blk.data?.arrayConditionData   || [],
      metadata: {
        ...meta,
        programs,   // ✅ 這裡只存 programs，不存 mainSpec
      },
    }
  })
}
// NEW — rebuild the exact structure you render（含 programLinks）
const loadMCRFromParams = (payload) => {
  mcrBlocks.value = (payload.blocks || []).map((b, i) => {
    const rawMeta = b.metadata || {}

    // 把舊資料 mainSpec 丟掉（如果有的話）
    const { mainSpec, ...metaWithoutMainSpec } = rawMeta

    const programs = Array.isArray(metaWithoutMainSpec.programs) ? metaWithoutMainSpec.programs.map(p => ({ ...p })) : []

    return {
      id: b.id ?? i + 1,
      // 這裡不再用 code/specCode/specName，全部交給 programs
      data: {
        jsonParameterContent: b.jsonParameterContent || null,
        arrayParameterData:   b.arrayParameterData   || [],
        jsonConditionContent: b.jsonConditionContent || null,
        arrayConditionData:   b.arrayConditionData   || [],
        metadata: {
          ...metaWithoutMainSpec,
          programs,   // ✅ 唯一來源
        },
      },
    }
  })
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
      step_type: 3,
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
const loading  = ref(false)
const errorMsg = ref('')
// const captureId = ref('')

// ✅ DOCX 預覽相關
const docxSrc = ref(null)          // blob URL
const previewLoading = ref(false)
let lastDocxUrl = null

watch(currentStep, (val) => {
  if (val === 9) {
    fetchPreviewDocx()
  }
})
watch(
  () => form.attribute.applyProject,
  async (newVal, oldVal) => {
    if (!oldVal || newVal === oldVal) return
    if (!form.documentID) return  // 沒文管編號就不用清

    const ok = window.confirm('已存在文管編號，變更適用工程會清除現有文管編號，是否繼續？')
    if (!ok) {
      // 還原選擇
      form.attribute.applyProject = oldVal
      return
    }

    // 1) 清前端欄位
    form.documentID = ''

    // 2) 通知後端清空 document_id
    const t = await ensureDraftToken()
    if (t) {
      try {
        await clearDocId(t)
      } catch (e) {
        console.error('clearDocId failed', e)
      }
    }
  }
)
async function fetchPreviewDocx() {
  previewLoading.value = true
  errorMsg.value = ''
  try {
    const payload = {
      token: draftToken.value,
      attribute: [{ ...form }],
      content: [
        ...serializeProcessFlowToBlocks(processFlowData.value),
        ...serializeManagementToBlocks(),
        ...serializeMCRToParams(),
        ...serializeExceptionsToBlocks(),
      ],
      reference: [
        ...(relativeDocuments.value || []).map(d => ({
          referenceType: 0,
          referenceDocumentID: d.docId,
          referenceDocumentName: d.docName,
        })),
        ...(usedForms.value || []).map(f => ({
          referenceType: 1,
          referenceDocumentID: f.formId,
          referenceDocumentName: f.formName,
        })),
      ],
    }

    // ⬇⬇⬇ 這裡改成 /docs/preview/docx
    const url = `${API_BASE_URL}/docs/preview/docx`
    const res = await axios.post(url, payload, { responseType: 'blob' })

    console.log('[NewInstruction] preview docx res:', res)
    console.log('[NewInstruction] blob size =', res.data.size)

    const blob = new Blob(
      [res.data],
      {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    )

    if (lastDocxUrl) {
      URL.revokeObjectURL(lastDocxUrl)
    }
    const blobUrl = URL.createObjectURL(blob)
    lastDocxUrl = blobUrl
    docxSrc.value = blobUrl

    console.log('[NewInstruction] docxSrc set:', docxSrc.value)

    // 預覽模式就不要再 window.open
    // window.open(blobUrl, '_blank')
  } catch (e) {
    console.error(e)
    errorMsg.value = (e && e.message) || 'preview docx error'
  } finally {
    previewLoading.value = false
  }
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
  if (steps.some(step => !step.status)) {
    alert('請把內容完成才可下載')
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    const payload = {
      token: draftToken.value,
      attribute: [{ ...form }],
      content: [
        ...serializeProcessFlowToBlocks(processFlowData.value),
        ...serializeManagementToBlocks(),
        ...serializeMCRToParams(),
        ...serializeExceptionsToBlocks()
      ],
      reference: [
        ...(relativeDocuments.value || []).map(d => ({
          referenceType: 0,
          referenceDocumentID: d.docId,
          referenceDocumentName: d.docName
        })),
        ...(usedForms.value || []).map(f => ({
          referenceType: 1,
          referenceDocumentID: f.formId,
          referenceDocumentName: f.formName
        }))
      ]
    }
    // 👇 先強制儲存草稿，確保 DB 狀態 = 當下畫面
    await saveDraft()

    const url = `${API_BASE_URL}/docs/generate/word`

    const res = await axios.post(url, payload, { responseType: 'blob' })

    const docIdFromHeader = res.headers['x-document-id']
    if (docIdFromHeader) {
      form.documentID = docIdFromHeader
    }

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    const urlBlob = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = urlBlob

    const versionStr = Number(form.documentVersion ?? 1).toFixed(1)
    a.download = `${form.documentName || 'document'}${versionStr}.docx`

    a.click()
    URL.revokeObjectURL(urlBlob)
  } catch (e) {
    console.error(e)

    if (e?.response?.data instanceof Blob) {
      try {
        const text = await e.response.data.text()
        let msg = text || e.message || '文件產出失敗，請稍後再試'

        // 嘗試 parse JSON 抓 message
        try {
          const obj = JSON.parse(text)
          if (obj && typeof obj === 'object' && obj.message) {
            msg = String(obj.message)
          }
        } catch {
          // 不是 JSON 就維持原樣
        }

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

// ---------- saving ----------
const isSaving = ref(false)
const applyLoadedData = async (snapshot, { isSnapshot }) => {
  // 1) attributes
  if (snapshot.attributes?.success) {
    Object.assign(form, snapshot.attributes.form || {})
  }

  // 如果是 snapshot，你可以考慮「不覆蓋作者、部門」或標記 read-only
  if (!isSnapshot) {
    form.department = sessionStorage.getItem('loggedInUserdeptName')
    form.author_id = sessionStorage.getItem('loggedInUserNo')
    form.author = sessionStorage.getItem('loggedInUserName')
  }

  // 機台 / personnel etc... 都照你原本邏輯即可
  // 顯示在 input 內的機台名稱
  if (form.attribute.machines && form.attribute.machines.length > 0){
      inputMachines.value = form.attribute.machines.map(machine => machine.name).join(", ")
      hasCondForMcr.value = true
      hasPmsForMcr.value = true
      hasPmsForStep3.value = true
      updateDocumentNameByMachines()
  }
  else {
    form.attribute.machines = [];
  }

  const personnel = await loadPersonnel(sessionStorage.getItem('loggedInUserNo'))
  if (personnel?.success){
    if (form.confirmer.length == 0) form.confirmer = personnel.data.personnel.confirmer
    if (form.approver.length == 0) form.approver = personnel.data.personnel.approver
  }

  // 2) process flow
  const pfResp = snapshot.blocks?.['0']
  if (pfResp?.success) {
    processFlowData.value = loadProcessFlowFromBlocks(pfResp)
  }

  // 3) management
  const mgResp = snapshot.blocks?.['1']
  if (mgResp?.success) {
    loadManagementFromBlocks(mgResp)
  }

  // 4) MCR params
  const mpResp = snapshot.params?.['2']
  if (mpResp?.success && (mpResp.blocks || []).length > 0) {
    loadMCRFromParams(mpResp)
  } else if (!isSnapshot) {
    // 草稿沒有舊資料時才載 template，snapshot 情境就保持原樣
    const machines = form.attribute?.machines || []
    if (machines.length > 0) {
      const code = machines[0].machineCode || machines[0].MACHINE_CODE || machines[0].code || ''
      if (code) {
        await loadMcrTemplates(code)
        mcrBlocks.value = []
      }
    }
  }

  // 5) exceptions
  const exResp = snapshot.blocks?.['3']
  if (exResp?.success) {
    loadExceptionsFromBlocks(exResp)
  }

  // 6) references
  const r = snapshot.references
  if (r?.success) {
    let nextId = 1
    relativeDocuments.value = (r.documents || []).map(d => ({ id: nextId++, docId: d.docId, docName: d.docName }))
    usedForms.value = (r.forms || []).map(f => ({ id: nextId++, formId: f.formId, formName: f.formName }))
  }

  flowVersion.value++
}
const saveDraft = async () => {
  let t
  if (isRejectedDoc.value) {
    // 🔸 退簽模式：直接拿 URL 上的 token，覆蓋「這份文件目前的草稿」
    t = route.query.token
    if (!t) {
      alert('缺少文件代碼，無法儲存草稿')
      return
    }

    // 建議順便把 composable 的 token 一起對齊，避免之後其他地方還抓舊 token
    setToken(t, { updateUrl: false })

    // （可選）給使用者一個確認
    if (!window.confirm('現在儲存會以「退回版本」內容覆蓋目前草稿，確定要這樣做嗎？')) {
      return
    }
  } else {
    // 🔹 一般情況：沿用原本 ensureDraftToken 流程（新建/既有草稿）
    t = await ensureDraftToken()
    if (!t) return
  }

  try {
    await nextTick()
    if (managementSpecificBlockRef.value?.flushNow) {
      managementSpecificBlockRef.value.flushNow()
    }

    // 仍然使用你原本的 serialize 函式
    const pfBlocks = serializeProcessFlowToBlocks(processFlowData.value)
    const mgmtBlocks = serializeManagementToBlocks()
    const paramsPayload = serializeMCRToParams()
    const excBlocks = serializeExceptionsToBlocks()

    const references = {
      documents: (relativeDocuments.value || []).map(d => ({ docId: d.docId, docName: d.docName })),
      forms: (usedForms.value || []).map(f => ({ formId: f.formId, formName: f.formName })),
    }

    const result = await saveDraftAll(t, {
      form,
      blockRequests: [
        { step_type: 0, blocks: pfBlocks },
        { step_type: 1, blocks: mgmtBlocks },
        { step_type: 3, blocks: excBlocks },
      ],
      paramRequests: [
        { step_type: 2, blocks: paramsPayload },
      ],
      references,
    })

    if (!result?.success) {
      return alert(result?.message || '儲存草稿失敗')
    }
    alert(`草稿已儲存(時間：${result.issueTime || ''})`)
  } catch (e) {
    const status = e?.response?.status
    if (status === 409) {
      console.error(e)
      alert('此文件已被簽核，因此停用儲存功能')
    } else {
      console.error(e)
      alert('儲存草稿失敗')
    }
  }
}
onMounted(async () => {
  console.log(
    'mode:', mode.value,
    'isSubmittedDoc:', isSubmittedDoc.value,
    'isRejectedDoc:', isRejectedDoc.value,
  )

  try {
    // 先載入工程清單（原本邏輯）
    const projects = await axios.get(`${API_BASE_URL}/mes/engineering`, {
      params: { pageSize: 40 },
    })
    projectList.value = projects.data.data.items || []
  } catch (e) {
    alert('載入適用工程失敗')
  }

  try {
    let t
    if (isSubmittedDoc.value || isRejectedDoc.value) {
      // ★ 來自 submitted / rejected → 一律用 URL 上的 token
      t = route.query.token
    } else {
      // ★ 一般模式 → 確保有 draft token
      t = await ensureDraftToken()
    }

    if (!t) return

    if (isSubmittedDoc.value || isRejectedDoc.value) {
      // ★ snapshot 模式：只吃快照資料
      const snapshot = await loadSnapshotDraftAll(t, {
        blocks: [0, 1, 3],
        params: [2],
        attrs: true,
        refs: true,
        rms_id: rmsId.value,
      })
      await applyLoadedData(snapshot, { isSnapshot: true })
    } else {
      // ★ 正常草稿模式：直接從現行 DB 讀
      const snapshot = await loadDraftAll(t, {
        blocks: [0, 1, 3],
        params: [2],
        attrs: true,
        refs: true,
      })
      await applyLoadedData(snapshot, { isSnapshot: false })
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
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 999px;
  transition: background 0.15s, transform 0.15s;
}

.steps-navigation.collapsed .step-item {
  transform: scale(0.92);
}

.step-item.active {
  background: #1f6feb;
  color: #fff;
}

/* .step-item.completed {
  background: #e5f1ff;
} */

.step-circle {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 13px;
  background: rgba(0,0,0,0.05);
}

.step-item.active .step-circle {
  background: rgba(255,255,255,0.2);
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

.step-section h2 {
  font-size: 22px;
  color: #333;
  margin-top: 0;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #007bff;
  display: inline-block;
}

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
  background: rgba(255,255,255,0.92);
  box-shadow: 0 2px 8px rgba(15,23,42,0.18);
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  font-size: 18px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.tool-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15,23,42,0.22);
  background: #f3f4f6;
}

.tool-btn:disabled {
  opacity: 0.6;
  cursor: default;
}


</style>