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
                <input id="item-type" class="window-select" type="text" v-model="form.attribute.itemType" :readonly="true" @click="(!isRevision && form.documentID.length === 0) && (itemsListVisible = !itemsListVisible)"/>
              </div>
              
              <div class="form-group">
                <label>式樣NO：</label>
                
                <div class="custom-select window-select" tabindex="0" @focusout="closeStyleMenu">
                  <div class="select-trigger" @click="toggleStyleMenu" :class="{ disabled: (mode !== 'new') && (isRevision || form.documentID.length > 0) }">
                    <span>{{ form.attribute.styleNo || '-- 請先選品目，再選式樣 --' }}</span>
                    <span class="arrow">▼</span>
                  </div>
                  
                  <div class="select-options" v-show="isStyleMenuOpen">
                    <div v-for="st in styleOptions" :key="st.sfhnr" class="option-item style-option-item" :class="{ 'is-locked': st.isLocked }" @mousedown.prevent="!st.isLocked && selectStyle(st.sfhnr)">
                      <div class="style-name-group">
                        <span class="style-name">{{ st.sfhnr }}</span>
                        <span v-if="st.isLocked" class="locked-hint">(已由 {{ st.lockedBy }} 編輯中)</span>
                      </div>

                      <div class="process-tags">
                        <span v-for="proc in st.clean_process_names" :key="proc" class="proc-tag">{{ proc }}</span>
                      </div>
                    </div>
                  </div>
                </div>
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
            @add-block="addSpecLayer"
            @update-block="updateSpecLayer"
            @delete-block="removeSpecLayer(blk.id)"
          />
        </section>

        <!-- Step 4 製造參數一覽表 -->
        <section :ref="el => (sectionRefs[3].value = el)" class="step-section">
          <h2 style="border: none; margin: 0; padding: 0;">3. 製造參數一覽表</h2>
          
          <!-- 標題列：加入 N/A 選項 -->
          <!-- <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #007bff; margin-bottom: 20px; padding-bottom: 10px;">
            <h2 style="border: none; margin: 0; padding: 0;">3. 製造參數一覽表</h2>
            <label style="cursor: pointer; color: #d32f2f; font-weight: bold; font-size: 15px;">
              <input type="checkbox" v-model="form.attribute.isParamNA" @change="onParamNAChange" />
              無需設定機台參數 (N/A)
            </label>
          </div> -->

          <!-- 勾選 N/A 時顯示的取代區塊 -->
          <!--
          <div v-if="form.attribute.isParamNA" style="font-size: 16px; font-weight: bold; text-align: center; padding: 40px; background-color: #f4f9ff; border: 1px dashed #1666C0; border-radius: 8px; color: #1666C0;">
            請依照「2. 製作條件規範」進行製造參數設定與確認
          </div>
          -->

          <!-- 未勾選 N/A 時，顯示原本的編輯組件 -->
          <!-- <ManufacturingParameterBlocks
            v-else-if="paramsLoaded"
            :data-blocks="mcrBlocks"
            :itemType="form.attribute.itemType"
            :specification="form.attribute.specification"
            :current-step="currentStep"
            :document-token="draftToken"
            :allow-color="isRevisionDoc"
            @update:dataBlocks="mcrBlocks = $event"
            @save="mcrBlocks = $event"
            @machine-group-info="onMachineGroupInfo"
          /> -->
          <ManufacturingParameterBlocks
            v-if="paramsLoaded"
            :data-blocks="mcrBlocks"
            :itemType="form.attribute.itemType"
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
            :documentMode="true"
            @add-block="addQualityLayer"
            @update-block="updateQualityLayer"
            @delete-block="removeQualityLayer(blk.id)"
            @open-doc-search="handleOpenDocSearch(blk.tier - 1, blk)"
          />

          <FormSearchWindow 
            v-if="specDocWindowVisible"
            headerName="適用品質與規格文件選取"
            documentType="qua"
            @add-new-forms="handleAddDocsToSpec" 
            @close-window="specDocWindowVisible=false">
          </FormSearchWindow>
        </section>

        <!-- Step 6 使用表單 -->
        <section :ref="el => (sectionRefs[5].value = el)" class="step-section">
          <h2>5. 使用表單</h2>
          <div class="used-form" style="display: flex; justify-content: space-between; align-items: center;">
            <button class="layer-action-btn add" @click="formWindowVisible = true">新增表單</button>
            <div v-if="isRevisionDoc" class="color-picker-group">
              <span style="font-size: 14px; color: #666; margin-right: 8px;">文字顏色:</span>
              <i class="dot blue" @click="setDocColor('blue')" title="設為藍色"></i>
              <i class="dot black" @click="setDocColor('black')" title="設為黑色"></i>
            </div>
          </div>

          <div v-for="(f, idx) in usedForms" :key="f.id" class="form-block" :class="{ 'is-selected': selectedFormId === f.id }" @click="selectedFormId = f.id">
            <div class="form-info-block" :style="{ color: f.color === 'blue' ? 'blue': 'black' }">
              <label class="form-label no" :style="{ borderColor: f.color === 'blue' ? 'blue' : '#ddd' }">5.{{ idx + 1 }}</label>
              <label class="form-label id" :style="{ borderColor: f.color === 'blue' ? 'blue' : '#ddd' }">{{ f.formId }}</label>
              <label class="form-label name">{{ f.formName }}</label>
            </div>
            <div class="form-btn-block">
              <button class="remove-btn" @click="removeUsedForm(f.id)">x</button>
            </div>
          </div>

          <FormSearchWindow 
            v-if="formWindowVisible"
            headerName="表單選取"
            documentType="form"
            @add-new-forms="addUsedForm"
            @close-window="formWindowVisible=false">
          </FormSearchWindow>
        </section>

        <!-- Step 7 其它 -->
        <section :ref="el => (sectionRefs[6].value = el)" class="step-section">
          <h2>6. 其它</h2>
          <div class="other-block"><button class="layer-action-btn add" @click="addOtherLayer">新增下一層</button></div>
          <DynamicEditorBlock v-for="blk in otherBlocks" :key="blk.id" :block-editors="blk" @add-block="addOtherLayer" @update-block="updateOtherLayer" @delete-block="removeOtherLayer(blk.id)"/>
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
defineOptions({ name: 'new-specification' })
import { ref, reactive, onMounted, onBeforeUnmount, watch, computed, nextTick, onActivated } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  fetchLatestSpecificationDocVersion,
} from '@/api/docsApi'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ''
// const { token: draftToken, setToken } = useDraftToken('rms:draft:new-specification')

const route = useRoute();
const router = useRouter();

const mode = computed(() => route.query.mode || 'new')
const currentToken = computed(() => route.query.token || '')

// 2. 動態決定這個實例的 LocalStorage Key (這跟我們在 App.vue 刪除時的邏輯完全對應！)
const storageKey = computed(() => {
  if (mode.value === 'new') {
    return 'rms:draft:new-specification'; 
  } else {
    return currentToken.value ? `rms:draft:${currentToken.value}` : 'rms:draft:unknown'; 
  }
})

// 3. 把動態的 Key 傳給 composable (注意：useDraftToken 內部可能只吃初始值，所以要傳入 .value)
const { token: draftToken, setToken, clearToken } = useDraftToken(storageKey.value)

// ─── 模式判斷 ──────────────────────────────
const isRevisionDoc = computed(() => form.documentVersion > 1)
// const isRevisionDoc = computed(() => route.query.mode === 'revision')

// 從哪裡來：submitted / rejected / ''
const fromSource = computed(() => String(route.query.source || '').trim())  // submitted / rejected / ''
const rmsId = computed(() => String(route.query.rms_id || '').trim())
const routeToken = computed(() => String(route.query.token || '').trim())

const copyToken = computed(() => String(route.query.copyToken || '').trim())
const isCopyMode = computed(() => route.query.mode === 'copy')

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

// 搜尋結果 (製程列表)
const searchResults = ref([]) 
const isSearching = ref(false)
const currentStep = ref(1)

// 一頁式 section refs（只需要前 7 章節）
const sectionRefs = Array.from({ length: 7 }, () => ref(null))

// 步驟列縮放
const navCollapsed = ref(false)

// 其餘原本的狀態：form、specBlocks、mcrBlocks、qualityBlocks、otherBlocks 等
const form = reactive({
  documentType: 1,
  documentID: '',
  documentName: '',
  documentVersion: '',
  documentPurpose: '',
  department: '',
  author: '',
  author_id: '',
  approver: '',
  confirmer: '',
  reviseReason: '',
  revisePoint: '',
  attribute: {
    itemType: '',        // 片段 MATNR
    styleNo: '',         // 完整 SFHNR（含版本）
    specification: [],   // 任務三回傳的 [{code, name}, ...]
    isParamNA: false,
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
const dataloading = ref(false);

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
  if (index === 8 && !dataloading.value) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  else if (index == 8 && dataloading.value) {
    alert("資料載入中，請稍後嘗試");
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
const getText = cellNode => {
  const paragraphs = cellNode.content || [];
  return paragraphs.map(pNode => { return (pNode.content || []).map(textNode => textNode.text || '').join('') }).join('\n');
}
const isStep4Valid = computed(() => {
  if (!hasAnyMachineGroup.value) return null;

  const blocksArr = mcrBlocks.value || [];
  if (!blocksArr.length) return false;

  let hasAnyPmsTable = false;
  const signatures = [];

  for (const blk of blocksArr) {
    const data = blk?.data || {};
    const meta = data.metadata || {};
    const arr  = data.arrayParameterData || [];

    const hasGroup   = !!meta.groupCode;
    const hasMachine = meta.machines && meta.machines.length > 0;
    const hasProgram = (Array.isArray(meta.programs) && meta.programs.length > 0);
    const hasProcessOrder = (meta.processOrder && meta.processOrder.length > 0);
    const isParamNA = meta.isParamNA === true; 
    const hasTableBody = Array.isArray(arr) && arr.length > 1;

    // ★ 任務 5：只要這個 Block 被新增出來，這三個東西就是「絕對必填」，不再跳過！
    if (!hasGroup || !hasMachine) return false;
    if (!isParamNA && !hasProcessOrder) return false;

    // 如果是 N/A (無點位參數)，合法過關
    if (isParamNA) continue;

    // 🔴 若不是 N/A，那就必須要有配到程式號碼，且要有表格資料
    if (!hasProgram || !hasTableBody) return false;

    hasAnyPmsTable = true;

    // 數值檢查：欄位 2~6 必須是數字、不可遞減
    for (let r = 1; r < arr.length; r++) {
      const row = arr[r] || []
      const value = [];
      const valueStatus = [];
      for(let index = 3; index < 8; index++) {
        const txt = row[index];
        let status = 'empty';
        let val = Number(txt);

        if (txt) status = (Number.isNaN(val)) ? 'invalid' : 'valid';
        
        value.push(val);
        valueStatus.push(status);
      }

      // Compare relation from left to right
      const validIndices = [0, 1, 2, 3, 4].filter(i => valueStatus[i] === 'valid');
      if (validIndices.length > 1){
        let maxSoFar = value[validIndices[0]];
        for (let i = 1; i < validIndices.length; i++) {
            const item = value[validIndices[i]];
            if (item <= maxSoFar) valueStatus[validIndices[i]] = 'invalid';
            else maxSoFar = item;
        }

        let minSoFar = value[validIndices.at(-1)];;
        for (let i = validIndices.length - 2; i >= 0; i--) {
            const item = value[validIndices[i]];
            if (item >= minSoFar) valueStatus[validIndices[i]] = 'invalid';
            else minSoFar = item;
        }
      }
      if (valueStatus.some(status => status == 'invalid' || status == 'empty')) return false;
      // const cellStatus = row.slice(3, 8).map(cell => {
      //   let status = 'empty';
      //   let val = Number(cell);
      //   if (cell) status = (Number.isNaN(val)) ? 'invalid' : 'valid';
      //   return status;
      // });
      // if (cellStatus.some(status => status == 'invalid')) return false;
      // if (cellStatus[2] == 'valid' && (cellStatus[0] == 'empty' || cellStatus[4] == 'empty')) return false;
      // if (cellStatus.every(status => status == 'empty')) return false;
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

  if (!hasAnyPmsTable && blocksArr.every(b => b.data.metadata.isParamNA)) return true;

  // 檢查不同 block 是否有完全相同的 PMS 表 → 不允許重複
  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      if (signatures[i] === signatures[j]) return false;
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

// ★ 新增：當勾選/取消 N/A 時的處理
const onParamNAChange = () => {
  if (form.attribute.isParamNA) {
    // 如果原本已經有選機台或填資料，警告會被清空
    if (mcrBlocks.value && mcrBlocks.value.length > 0 && mcrBlocks.value[0]?.data?.metadata?.groupCode) {
      const ok = confirm("勾選 N/A 將會忽略並清空下方已設定的參數資料，確定要繼續嗎？");
      if (!ok) {
        form.attribute.isParamNA = false; // 恢復不勾選
        return;
      }
      // 確定 N/A，清空資料，避免後端存入垃圾資料
      mcrBlocks.value = [];
    }
  } else {
    // 取消 N/A 時，確保陣列是乾淨的，讓子元件重新掛載第一列
    if (!mcrBlocks.value || mcrBlocks.value.length === 0) {
      mcrBlocks.value = [];
    }
  }
};

/* =========================================
   新增：全域驗證與錯誤收集邏輯 (仿照 NewInstruction)
   ========================================= */

// 檢查單一 Dynamic Block (層級) 是否填寫完整
// 邏輯：檢查該 Block 內的所有 item，只要有一個 item 沒填標題或內容就算不完整
const isDynamicBlockComplete = (blk) => {
  const items = blk.data || [];
  if (items.length === 0) return false; // 雖然理論上不會是空陣列

  for (const item of items) {
    // 使用既有的 isDynamicBlockItemValid 函式進行檢查
    if (!isDynamicBlockItemValid(item)) {
      return false;
    }
  }
  return true;
};

const collectValidationErrors = () => {
  const errors = [];

  // --- Step 1: 基本屬性 ---
  const vRaw = String(form.documentVersion ?? '').trim();
  const vNum = parseFloat(vRaw || '1');
  const isFirstVersion = !Number.isFinite(vNum) || vNum <= 1;

  if (!form.documentName) errors.push('【基本屬性】文件名稱未填寫');
  if (!form.attribute.itemType) errors.push('【基本屬性】品目未選擇');
  if (!form.attribute.styleNo) errors.push('【基本屬性】式樣NO未選擇');
  if (!Array.isArray(form.attribute.specification) || form.attribute.specification.length === 0) {
    errors.push('【基本屬性】適用工程未載入');
  }
  if (!form.department) errors.push('【基本屬性】制訂單位未填寫');
  if (!form.author) errors.push('【基本屬性】制訂者未填寫');
  if (!form.confirmer) errors.push('【基本屬性】確認者未填寫');
  if (!form.approver) errors.push('【基本屬性】承認者未填寫');

  // 變版檢查 (版本 > 1.0)
  if (!isFirstVersion) {
    if (!form.documentID) errors.push('【基本屬性】文管編號未填寫 (變版必填)');
    if (!form.reviseReason) errors.push('【基本屬性】變更理由未填寫 (變版必填)');
    if (!form.revisePoint) errors.push('【基本屬性】變更要點未填寫 (變版必填)');
  }

  // --- Step 2: 目的 ---
  if (!String(form.documentPurpose ?? '').trim()) {
    errors.push('【1. 目的】內容未填寫');
  }

  // --- Step 3: 製作條件規範 (Dynamic) ---
  const specBs = specBlocks.value || [];
  // 檢查是否有建立區塊，且每個區塊都完整
  if (specBs.length > 0) {
    specBs.forEach((blk, idx) => {
      if (!isDynamicBlockComplete(blk)) {
        errors.push(`【2. 製作條件規範 - 層級 ${idx + 1}】內容未填寫完整 (標題必填，若選文字/表格/圖片則需有內容)`);
      }
    });
  } else {
    // 若此章節完全沒新增，視為未填寫 (若此章節為選填可移除此判斷)
    // errors.push('【2. 製作條件規範】至少需新增一層內容'); 
  }

  // --- Step 4: 製造參數一覽表 (PMS) ---
  // 這部分邏輯最複雜，需檢查 Group, Machine, ProcessOrder, Table Values
  if (!hasAnyMachineGroup.value) {
    // 若完全沒有機台群組，此步驟不需檢查
  } else {
    const pmsBs = mcrBlocks.value || [];
    if (pmsBs.length === 0) {
      errors.push('【3. 製造參數一覽表】尚未建立任何參數模塊');
    } else {
      const signatures = [];

      pmsBs.forEach((blk, idx) => {
        const prefix = `【3. 製造參數一覽表 - 模塊 ${idx + 1}】`;
        const meta = blk.data?.metadata || {};
        const arr = blk.data?.arrayParameterData || [];

        const hasGroup = !!meta.groupCode;
        const hasMachine = meta.machines && meta.machines.length > 0;
        const hasProgram = (Array.isArray(meta.programs) && meta.programs.length > 0);
        const hasProcessOrder = meta.processOrder && meta.processOrder.length > 0;
        const isParamNA = meta.isParamNA === true; 
        const hasTableBody = Array.isArray(arr) && arr.length > 1;

        // ★ 任務 5：精準報出缺失，不再提早 return 結束檢查
        if (!hasGroup) errors.push(`${prefix} 未選擇機台群組`);
        if (!hasMachine) errors.push(`${prefix} 未選擇機台`);
        if (!isParamNA && !hasProcessOrder) errors.push(`${prefix} 未選擇流程順序`);
        
        if (isParamNA) { } 
        else {
          // 只有這三項必填都有了，才去報配號或表格的錯
          if (hasGroup && hasMachine && hasProcessOrder) {
            if (!hasProgram) errors.push(`${prefix} 尚未配發程式號碼`);
            if (!hasTableBody) {
              errors.push(`${prefix} 尚未取得 PMS 表格資料或資料為空`);
            } else {
              let tableInvalid = false;
              for (let r = 1; r < arr.length; r++) {
                const row = arr[r] || [];
                const cellStatus = row.slice(3, 8).map(cell => {
                  const val = Number(cell);
                  if (cell && Number.isNaN(val)) return 'invalid';
                  if (!cell && cell !== 0) return 'empty';
                  return 'valid';
                });

                if (cellStatus.some(s => s === 'invalid')) {
                  tableInvalid = true; 
                  break;
                }
                if (cellStatus.every(s => s === 'empty')) {
                  tableInvalid = true; 
                  break;
                }
              }
              if (tableInvalid) {
                errors.push(`${prefix} 表格數值填寫不完整或包含非數字內容`);
              }

              const mat = [];
              for (let r = 1; r < arr.length; r++) {
                const row = arr[r] || [];
                const sub = [];
                for (let c = 3; c <= 7; c++) sub.push(String(row[c] ?? '').trim());
                mat.push(sub);
              }
              signatures.push(JSON.stringify(mat));
            }
          }
        }
      });

      // 檢查重複內容
      for (let i = 0; i < signatures.length; i++) {
        for (let j = i + 1; j < signatures.length; j++) {
          if (signatures[i] === signatures[j]) {
            errors.push(`【3. 製造參數一覽表】模塊 ${i + 1} 與 模塊 ${j + 1} 的參數設定內容完全重複`);
          }
        }
      }
    }
  }

  // --- Step 5: 適用品質與規格內容 (Dynamic) ---
  const qualBs = qualityBlocks.value || [];
  if (qualBs.length > 0) {
    qualBs.forEach((blk, idx) => {
      if (!isDynamicBlockComplete(blk)) {
        errors.push(`【4. 適用品質與規格內容 - 層級 ${idx + 1}】內容未填寫完整`);
      }
    });
  }

  // --- Step 6: 使用表單 ---
  // 若為必填可取消註解
  // if ((usedForms.value || []).length === 0) {
  //   errors.push('【5. 使用表單】未選擇任何表單');
  // }

  // --- Step 7: 其他 (Dynamic) ---
  const otherBs = otherBlocks.value || [];
  if (otherBs.length > 0) {
    otherBs.forEach((blk, idx) => {
      if (!isDynamicBlockComplete(blk)) {
        errors.push(`【6. 其他 - 層級 ${idx + 1}】內容未填寫完整`);
      }
    });
  }

  return errors;
};
// ---------- pickers ----------
const specificsListVisible = ref(false)

function onSelectItemType(payload) {
  form.attribute.itemType = payload || ''
  form.attribute.styleNo = ''
  form.attribute.specification = []
  specificationDisplay.value = ''
  styleOptions.value = []
  itemsListVisible.value = false

  if (!isSnapshotView.value && !isRevision.value) {
    form.documentID = ''
    form.documentVersion = '1.0'
  }

  if (!form.attribute.itemType) return

  // 依品目抓式樣清單
  loadStylesForItem(form.attribute.itemType)
}
async function loadStylesForItem(matnr) {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/item/styles`, { params: { matnr } })
    if (!data.success) {
      alert(data.error || '取得式樣清單失敗')
      styleOptions.value = []
      return
    }
    console.log("data: ", data);
    styleOptions.value = data.data.styles.map(st => ({ ...st, clean_process_names: st.process_names.map(name => cleanProcessName(name)) }));
  } catch (e) {
    console.error('loadStylesForItem failed:', e)
    alert('取得式樣清單失敗')
  }
}

const isStyleMenuOpen = ref(false);
const toggleStyleMenu = () => {
  if ((mode.value !== 'new') && (isRevision.value || form.documentID.length > 0)) return;
  isStyleMenuOpen.value = !isStyleMenuOpen.value;
};
const closeStyleMenu = (event) => {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  isStyleMenuOpen.value = false;
};
const selectStyle = (sfhnr) => {
  form.attribute.styleNo = sfhnr;
  isStyleMenuOpen.value = false;
  onSelectStyle(); // 觸發你原本的 API 抓取或資料綁定邏輯
};
async function onSelectStyle() {
  const sfhnr = form.attribute.styleNo;
  if (!sfhnr) {
    form.attribute.specification = [];
    specificationDisplay.value = '';
    return;
  }

  const selectedStyle = styleOptions.value.find(st => st.sfhnr === sfhnr);
  
  if (!selectedStyle || !selectedStyle.processes || selectedStyle.processes.length === 0) {
    alert('該式樣查無適用工程');
    form.attribute.specification = [];
    specificationDisplay.value = '';
    return;
  }

  // 1. 直接將記憶體中的 processes 賦值給 specification (零延遲！)
  const specList = selectedStyle.processes;
  form.attribute.specification = specList;

  // 2. 適用工程 readonly input 顯示 PROCESS_NAME 串
  specificationDisplay.value = specList.map(s => cleanProcessName(s.name)).join('、');

  // 3. 更新文件名 (使用洗乾淨的名稱)
  if (form.attribute.itemType && specList.length) {
    // form.documentName = `${form.attribute.styleNo.split('-', 1)[0]}_${specList.map(s => s.name).join('、')} 製造式樣書`;
    form.documentName = `${form.attribute.styleNo.split('-', 1)[0]}_${specList.map(s => cleanProcessName(s.name, true, false)).join('、')} 製造式樣書`;
  }

  // 4. 取得最新版本號
  if (!isSnapshotView.value && !isRevision.value) {
    try {
      const versionInfo = await fetchLatestSpecificationDocVersion(sfhnr);
      form.documentID = versionInfo.document_id;
      form.documentVersion = versionInfo.document_version;
    } catch (e) {
      console.error('取得版本號失敗:', e);
    }
  }

  await saveDraft(false);
}
// 輔助函數：清洗適用工程名稱
const cleanProcessName = (name, filter_front = true, filter_end = true) => {
  if (!name) return '';

  let cleaned = name;
  
  // 1. 去除開頭的代碼 (例如: (L314-17)、(L210-33))
  // ^\([^)]+\) 代表：從開頭找第一個左括號，一直到第一個右括號為止
  if (filter_front) cleaned = name.replace(/^\([^)]+\)/, '');
  
  // 2. 去除結尾的括號與數字 (例如: (1)、(2))
  // \(\d+\)$ 代表：在字串最尾端，尋找括號裡面包著純數字的部分
  if (filter_end) cleaned = cleaned.replace(/\(\d+\)$/, '');
  
  // 回傳並去除前後多餘空白
  return cleaned.trim();
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
  if (node.type === 'image') return '[IMAGE]'
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
      // const isHeaderRow = r === 0
      // if (isHeaderRow) continue

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
    id: uid++,
    step: stepType,
    tier: blk.tier,
    data: (blk.data || []).map(it => ({
      option: it.option ?? 0,
      jsonHeader: it.jsonHeader || null,
      jsonContent: it.jsonContent || null,
      files: it.files || []
    }))
  }))

const specDocWindowVisible = ref(false);
const currentSpecInsertIndex = ref(-1);
const currentSpecInsertBlockItem = ref(null); // ★ 記錄當下點擊的小區塊

// 開啟視窗
const handleOpenDocSearch = (index, blockItem) => {
  currentSpecInsertIndex.value = index;
  currentSpecInsertBlockItem.value = blockItem;
  specDocWindowVisible.value = true;
};

// ★ 新增：關閉視窗 (取消)
const handleCloseDocSearch = () => {
  // 如果使用者點擊取消，把 option 恢復為 0，標題就會自動解鎖
  if (currentSpecInsertBlockItem.value && currentSpecInsertBlockItem.value.option === 3) {
    currentSpecInsertBlockItem.value.option = 0;
  }
  specDocWindowVisible.value = false;
};

// 處理選擇後的文件插入
const handleAddDocsToSpec = (selectedDocs) => {
  if (!selectedDocs || selectedDocs.length === 0) {
    handleCloseDocSearch();
    return;
  }

  const createTitleJson = (text) => {
    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
  };

  const newBlocks = selectedDocs.map(doc => {
    return {
      id: uid++,
      step: 4,
      data: [
        {
          option: 3, 
          jsonHeader: createTitleJson(`${doc.formId} ${doc.formName}`),
          jsonContent: null,
          files: [],
        }
      ]
    };
  });

  const targetBlock = qualityBlocks.value[currentSpecInsertIndex.value];
  
  // ★ 核心判斷：
  // 如果當前這個大模塊只有一個子項目 (代表它是新建出來當跳板的空模塊)
  // 我們就用 splice 直接「替換」它，避免留一個空的在上面浪費。
  if (targetBlock.data.length === 1) {
    qualityBlocks.value.splice(currentSpecInsertIndex.value, 1, ...newBlocks);
  } else {
    // 如果它已經有多個子區塊(有內容)，我們才把它「附加」在後面
    qualityBlocks.value.splice(currentSpecInsertIndex.value + 1, 0, ...newBlocks);
  }

  qualityBlocks.value = qualityBlocks.value.map((blk, blkIndex) => ({ ...blk, tier: blkIndex + 1 }));

  console.log("qualityBlocks: ", qualityBlocks.value);

  specDocWindowVisible.value = false;
};

// ---------- step 4 — parameters (SPEC_PARAM = 5) ----------
const hasAnyMachineGroup = ref(true)   // 預設 true，舊資料不會被誤判
const onMachineGroupInfo = (payload) => {
  hasAnyMachineGroup.value = !!(payload && payload.hasAnyMachineGroup)
}
// serialize params → backend shape for /docs/params/save (step_type = 5)
function serializeParamsFromMCR() {
  console.log("mcrBlocks: ", mcrBlocks.value);
  
  // ★ 新增防護：如果系統判定沒有群組機台，一律送出空陣列給後端
  if (!hasAnyMachineGroup.value) {
    return []
  }

  if (mcrBlocks.value.length == 0){
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
const selectedFormId = ref(null); // 新增：記錄目前選取的文件 ID

// 新增：改變文件顏色的函式
const setDocColor = (color) => {
  if (selectedFormId.value == null) return alert('請先點擊選取要更改顏色的文件列');
  const target = usedForms.value.find(d => d.id === selectedFormId.value);
  if (target) target.color = color;
}
// const addUsedForm = ({ formId, formName }) => { usedForms.value.push({ id: usedFormUid++, formId, formName }); formWindowVisible.value = false }
const addUsedForm = (selectedForms) => {
  console.log("selectedForms: ", selectedForms);
  console.log("usedForms: ", usedForms);
  selectedForms.forEach(form => {
    // 檢查是否已經存在，避免重複加入
    if (!usedForms.value.some(f => f.formId === form.formId)) {
      usedForms.value.push({ 
        id: usedFormUid++, 
        formId: form.formId, 
        formName: form.formName,
        color: 'black'
      });
    }
  });
  formWindowVisible.value = false;
}
const removeUsedForm = (id) => { usedForms.value = usedForms.value.filter(x => x.id !== id) }

// ---------- token bootstrap (document_type = 1) ----------
// 規則：
//   - snapshotView：使用 URL 上的 token（同一份文件），覆蓋原草稿
//   - 一般模式：用 initDoc(1) 建立 / 取得草稿 token
// 當組件被 keep-alive 喚醒時觸發
onActivated(() => {
  // 如果當前 URL 沒有 token，但我們手上有草稿 token (代表是點側邊欄切回來的)
  if (!route.query.token && draftToken.value) {
    // 把 token 補回 URL，這樣看起來才像是在編輯同一份文件
    setToken(draftToken.value, { updateUrl: true })
  }
})

// ==========================================
// ★ 自動帶入邏輯：解析網址參數並自動選擇品目與式樣
// ==========================================
const handleAutoLoadFromQuery = async () => {
  const { item, styleNo, token, rms_id, mode } = route.query;

  // 1. 如果有 token 或 rms_id，代表正在開啟既有文件或快照，不執行自動帶入
  // 2. 如果是複製模式，也不執行
  if (token || rms_id || mode === 'copy') return;

  // 3. 如果網址有傳入 item 和 styleNo，執行自動帶入
  if (item && styleNo) {
    // 如果目前表單已經是這個品目和式樣，不用重複執行
    if (form.attribute.itemType === item && form.attribute.styleNo === styleNo) {
       return;
    }
    
    // B. 載入該品目下的所有式樣清單 (這包 API 會回傳每個式樣對應的所有 processes)
    await loadStylesForItem(item);
    form.attribute.itemType = item;
    
    // C. 帶入式樣號碼，並觸發 onSelectStyle()
    // (onSelectStyle 內部會自動把該式樣的所有 processes 抓出來塞進 form.attribute.specification)
    form.attribute.styleNo = styleNo;
    await onSelectStyle();

    // D. 幫使用者跳回第一步
    currentStep.value = 1;
    
    // E. (優化) 清理 URL，避免使用者按 F5 重新整理時又重複觸發這段邏輯
    const query = { ...route.query };
    delete query.item;
    delete query.styleNo;
    delete query.processCode;
    router.replace({ query });
  }
}

// ==========================================
// ★ 核心邏輯：handleSearch
// 目的：呼叫後端，取得該 品目+式樣書 下的所有製程
// ==========================================
const handleSearch = async () => {
  // 1. 防呆檢查
  if (!form.attribute.itemType || !form.attribute.styleNo) {
    alert("請輸入完整的品目與式樣書編號")
    return
  }

  isSearching.value = true
  searchResults.value = [] // 清空舊結果

  try {
    // 2. 呼叫後端 API
    // 注意：這裡的路徑要對應您的 item.py 內的 route
    // 假設 item.py 有一個查詢 API 叫做 /item/search 或類似的
    const response = await axios.get(`${API_BASE_URL}/item/search`, {
      params: {
        keyword: form.attribute.itemType,     // 或 specific: form.item
        sfhnr: form.attribute.styleNo,     // 假設後端接收式樣書編號的參數名為 sfhnr
        mode: 'spec_confirm'    // 標記這是從確認頁來的 (可選)
      }
    })

    if (response.data.success) {
      // 3. 綁定資料
      // 假設後端回傳的是一個陣列，包含 { STATION: 'L260', STATION_CH: '壓合' ... }
      searchResults.value = response.data.data || []
      
      console.log('搜尋成功，找到製程數:', searchResults.value.length)
      
      // [UX 優化] 如果只有一筆製程，直接幫使用者選中並跳下一頁 (視需求而定)
      /*
      if (searchResults.value.length === 1) {
         selectStation(searchResults.value[0])
      }
      */
    } else {
      alert(response.data.message || "查無資料")
    }
  } catch (error) {
    console.error("Search Error:", error)
    alert("搜尋發生錯誤，請稍後再試")
  } finally {
    isSearching.value = false
  }
}

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
  if (draftToken.value) {
    if (!route.query.token) setToken(draftToken.value, { updateUrl: true });
    return draftToken.value;
  }

  try {
    // doc_type = 1 → 製造式樣書
    const res = await initDoc(1)
    if (res?.success && res.token) {
      setToken(res.token, { updateUrl: true })
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
          color: f.color
        })),
      ],
    }
    console.log("generate and preview Docx: ", payload);

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
  const errors = collectValidationErrors();
  if (errors.length > 0) {
    alert("檢測到以下內容未完成，無法產生文件：\n\n" + errors.join('\n'));
    return;
  }

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
          referenceDocumentName: f.formName,
          color: f.color
        }))
      ]
    }
    const url = `${API_BASE_URL}/docs/generate/word`

    // 先強制儲存草稿
    const success = await saveDraft();
    if (success == false) return;

    const res = await axios.post(url, payload, { responseType: 'blob' })

    const docIdHeader = res.headers['x-document-id'] || res.headers['X-Document-ID']
    const docVersion = res.headers['x-document-version'] || res.headers['X-Document-Version']
    if (docIdHeader) { form.documentID = docIdHeader; form.documentVersion = docVersion }

    const contentType = res.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const dispo = res.headers['content-disposition']
    const versionStr = Number(form.documentVersion ?? 1).toFixed(1)
    const filename = extractFilenameFromDisposition(dispo, `${form.documentName || 'document'} ${form.attribute.styleNo.split("-")[1]} ${versionStr}.docx`)

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
          if (obj && typeof obj === 'object' && obj.message) { msg = String(obj.message) }
        } catch {}

        if (msg.includes('ORA-01031')) { msg = 'EIP 建檔 / 歷史快照失敗：Oracle 權限不足（ORA-01031）。\n請聯絡資訊部或系統管理員開啟寫入 IDBUSER.RMS_DCC2EIP 的權限。' }

        errorMsg.value = msg.replace(/\\n/g, '\n')
      } catch {
        errorMsg.value = e?.message || '文件產出失敗，請稍後再試'
      }
    } else {
      const msg = e?.response?.data?.message || e?.message || '文件產出失敗，請稍後再試'
      errorMsg.value = msg
    }
  } finally {
    loading.value = false
  }
}

// ---------- save ----------
const isSaving = ref(false)

const saveDraft = async (show_window = true) => {
  if (dataloading.value) {
    alert("資料載入中，請稍後嘗試");
    return;
  }
  // Snapshot 模式：直接用 URL token 覆蓋最新草稿
  let t;
  if (isSnapshotView.value) {
    t = routeToken.value;
    if (!t) {
      alert('缺少文件代碼，無法儲存草稿');
      return false;
    }

    setToken(t, { updateUrl: false });

    const ok = window.confirm(`${snapshotWarningMessage.value || '此畫面為歷史快照檢視'}\n\n` + '現在儲存會以目前畫面內容覆蓋這份文件最新草稿，確定要這樣做嗎？');
    if (!ok) return false;
  } else {
    // 一般情況：走原本 ensureDraftToken 流程
    t = await ensureDraftToken();
    if (!t) return false;
  }

  try {
    isSaving.value = true;

    const specBlockPayload = toGenericBlocks(specBlocks.value, 4);
    const qualityBlockPayload = toGenericBlocks(qualityBlocks.value, 6);
    const otherBlockPayload = toGenericBlocks(otherBlocks.value, 7);
    const paramPayload = serializeParamsFromMCR();

    const result = await saveDraftAll(t, {
      form,
      blockRequests: [{ step_type: 4, blocks: specBlockPayload }, { step_type: 6, blocks: qualityBlockPayload }, { step_type: 7, blocks: otherBlockPayload },],
      paramRequests: [{ step_type: 5, blocks: paramPayload }],
      references: { documents: [], forms: (usedForms.value || []).map(f => ({ formId: f.formId, formName: f.formName, color: f.color })) },
    });

    if (!result?.success) {
      alert(result?.message || '屬性儲存失敗');
      return false;
    }
    if (show_window) alert(`草稿已儲存（時間：${result.issueTime || ''}）`);
  } catch (e) {
    console.error('saveDraft failed:', e);
    alert('儲存草稿失敗');
    return false;
  } finally {
    isSaving.value = false
  }
}

// ★ 共用：把後端撈回來的 snapshot/draft 結果套用到前端
const applyLoadedData = async (snapshot, { isSnapshot = false, isCopy = false } = {}) => {
  dataloading.value = true;
  // console.log("applyLoadedData form attribute: ", form.attribute);
  // if (route.query.autoLoad === 'true') return;
  // 1) attributes
  if (!(route.query.autoLoad === 'true') && snapshot.attributes?.success) {
    if (isCopy) {
      const oldForm = snapshot.attributes.form || {}
      form.documentPurpose = oldForm.documentPurpose || ''
      form.documentVersion = '1.0'
    } else {
      // 一般模式：照單全收
      Object.assign(form, snapshot.attributes.form || {})
    }
  }

  // 重新帶入登入者資訊 (新建或複製都要執行這段！)[cite: 2]
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
  if (!isCopy) {
    const pm = snapshot.params?.['5']
    if (pm?.success) {
      loadParamsIntoMCR(pm)
    } else {
      paramsLoaded.value = true
    }
  } else {
    // ★ 任務 1：如果是複製模式，雖然不載入舊參數，但必須告訴系統「參數區塊已就緒」
    // 否則 v-if="paramsLoaded" 會讓整個組件消失！
    paramsLoaded.value = true;
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
      color: f.color
    }))
  }
  console.log("applyLoadedData form attribute: ", form.attribute);
  dataloading.value = false;
  if (form.documentName) alert("草稿載入成功");
}

// 當組件被 keep-alive 喚醒時觸發
onActivated(async () => {
  // 如果當前 URL 沒有 token，但我們手上有草稿 token (代表是點側邊欄切回來的)
  if (!route.query.token && draftToken.value) {
    // 把 token 補回 URL，這樣看起來才像是在編輯同一份文件
    setToken(draftToken.value, { updateUrl: true })
  }
  
  // ★ 從其他頁面 (如 ItemViewPage) Keep-alive 切換過來時，自動帶入參數
  await handleAutoLoadFromQuery();
})
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
    } else if (isCopyMode.value && copyToken.value) {
      // 1. 用「舊的 copyToken」去後端撈舊資料
      snapshot = await loadDraftAll(copyToken.value, { blocks: [4, 6, 7], params: [5], attrs: true, refs: true })
      
      // 2. 帶入畫面 (isCopy: true 會濾掉原作者等不該複製的資訊)
      await applyLoadedData(snapshot, { isSnapshot: false, isCopy: true })

      // ★ 3. 載入完成後，立刻在背景偷偷存檔！
      const saveSuccess = await saveDraft(); 

      // ★ 4. 存檔成功後，把網址上的 mode=copy 和 copyToken 洗掉
      // 讓它變成一份普通的草稿，使用者就算按 F5 重新整理，也不會再發生去撈舊資料的靈異事件
      if (saveSuccess) {
        const query = { ...route.query };
        delete query.mode;
        delete query.copyToken;
        router.replace({ query });
      }
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

    // ★ 在載入空白草稿之後，檢查是否有外部傳入的參數需要自動帶入
    await handleAutoLoadFromQuery();

  } catch (e) {
    console.error('load draft/snapshot failed:', e)
    alert(isSnapshotView.value ? '載入歷史快照失敗' : '載入草稿失敗')
    paramsLoaded.value = true
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll);
  if(confirm("請問是否要保存內容")) {
    saveDraft();
  }
  clearToken();
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

/* 自訂選項的排版：左右對齊 */
.style-option-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
/* 適用工程 Tag 的容器 */
.process-tags { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; max-width: 60%; }
/* 小 Card 設計 */
.proc-tag { background-color: #e3f2fd; color: #1565c0; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap; }
.select-trigger.disabled { background-color: #f5f5f5; color: #999; pointer-events: none; }
/* ====================================================
   自製 Select Component 樣式 (完美對齊原生 input 版)
==================================================== */

/* 1. 容器本身：寬度設定為 70%，與其他 input 保持絕對一致 */
.custom-select { position: relative; width: 70%; outline: none; }
.custom-select:focus .select-trigger { border-color: #008bff; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1); }

/* 2. 觸發按鈕：Padding、字體大小、邊框顏色全部「複製」你原本的 input 設定 */
.select-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px; /* ★ 對齊原本 input 的 padding */
  background-color: #ffffff;
  border: 1px solid #ddd; /* ★ 對齊原本 input 的邊框色 */
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  font-size: 15px; /* ★ 對齊原本 input 的字體大小 */
  color: #333;
  box-sizing: border-box; /* 確保寬度計算包含 padding，不會凸出去 */
}

/* Interaction feedback and cursor style */
.select-trigger:hover { border-color: #008bff;  }
.select-trigger .arrow { font-size: 12px; color: #999; margin-left: 10px; }

/* 5. 展開的下拉選單面板 (維持原樣，讓它有立體感) */
.select-options {
  position: absolute;
  top: calc(100% + 4px); /* 稍微靠近輸入框一點 */
  left: 0;
  width: 100%;
  background-color: #ffffff;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
  z-index: 2000; 
  max-height: 250px;
  overflow-y: auto;
}

/* 6. 選單內的每一個選項 */
.style-option-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  color: #333;
  font-size: 15px; /* 配合主字體大小 */
  transition: background-color 0.2s;
}

/* 鎖定狀態的選項樣式 */
.style-option-item.is-locked {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.6; /* 讓整體變淡，提示無法選擇 */
}

/* 鎖定狀態時，滑鼠移上去不要變色 */
.style-option-item.is-locked:hover {
  background-color: #f5f5f5; 
}

/* 左側文字群組，讓名稱跟提示排在一起 */
.style-name-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 鎖定提示文字：紅色醒目提醒 */
.locked-hint {
  font-size: 12px;
  color: #e74c3c; /* 紅色，或者用你的主題色 */
  font-weight: bold;
}

/* 選項 hover 時的背景色變換 */
.style-option-item:hover { background-color: #f5f7fa; }

/* 7. 禁用狀態 (對齊你 input[readonly] 的風格) */
.select-trigger.disabled { background-color: #e9ecef; color: #495057; cursor: not-allowed; border-color: #ddd; }

/* 8. 適用工程小標籤 (Card) */
.process-tags { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: 65%; }
.proc-tag { background-color: #ecf5ff; color: #008bff; border: 1px solid #d9ecff;  padding: 2px 6px; border-radius: 4px; font-size: 12px; white-space: nowrap; }

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

/* 文件與表單區塊樣式 */
.document-block, .form-block { 
  display: flex; 
  justify-content: space-between; 
  padding: 10px; 
  margin: 10px 10px; 
  border: 1px solid #ddd; 
  border-radius: 4px; /* 加點圓角更好看 */
  cursor: pointer;    /* 讓使用者知道可以點擊 */
  transition: all 0.2s ease;
}

/* ★ 被選取時的狀態 (藍色高光) */
.document-block.is-selected, .form-block.is-selected {
  outline: 2px solid #2196f3;
  background-color: #f4f9ff;
  border-color: #2196f3;
}

/* 顏色選擇器 */
.color-picker-group {
  display: flex;
  align-items: center;
  background: #f8f9fa;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid #eee;
}

/* 共用顏色圓點 (沿用您原本的 .dot 樣式，但稍微修正一下邊距) */
.dot { display: inline-block; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); cursor: pointer; margin-left: 6px; }
.blue { background: #0000ff; }
.black { background: #000000; }
</style>