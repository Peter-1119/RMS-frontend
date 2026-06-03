<template>
  <div class="new-specification-container">
    <!-- Header -->
    <div class="header">
      <button @click="$router.push('/home')" class="back-btn"><img src="@/assets/home-icon.png" alt="首頁" class="icon" />回首頁</button>
      <h1>製造式樣書</h1>
      <button @click="saveDraft" class="save-btn" :disabled="isSaving"><img src="@/assets/save-icon.png" alt="儲存" class="icon" />{{ isSaving ? '暫存中…' : '暫存草稿' }}</button>
    </div>

    <!-- Steps nav：一樣 sticky + 滾動縮放 -->
    <div class="steps-navigation" :class="{ collapsed: navCollapsed }">
      <div v-for="(step, index) in steps" :key="index" :class="['step-item', stepStatusClass(index), { 'active': currentStep === index + 1, 'completed': currentStep > index + 1 }]" @click="scrollToStep(index + 1)">
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
              <div class="form-group"><label for="doc-code">文管編號：</label><input id="doc-code" type="text" v-model="form.document_id" readonly /></div>
              <div class="form-group"><label for="doc-name">文件名稱：</label><input id="doc-name" type="text" v-model="form.document_name" readonly /></div>
              <div class="form-group"><label for="doc-version">文件版本：</label><input id="doc-version" type="text" v-model="form.document_version" readonly /></div>

              <div class="form-group">
                <label for="item-type">品目：</label>
                <input id="item-type" class="window-select" type="text" v-model="form.attribute.itemType" :readonly="true" @click="(form.document_id.length === 0) && (itemsListVisible = !itemsListVisible)"/>
              </div>

              <!-- <div class="form-group"> -->
                <!-- <label for="style-no">式樣NO：</label> -->
                <!-- <select id="style-no" class="window-select" v-model="form.attribute.styleNo" @change="fetchProcessesAndMachines" :disabled="form.document_id.length > 0"> -->
                  <!-- <option value="">-- 請先選品目，再選式樣 --</option> -->
                  <!-- <option v-for="st in styleOptions" :key="st.sfhnr" :value="st.sfhnr">{{ st.sfhnr }}</option> -->
                <!-- </select> -->
              <!-- </div> -->
              <div class="form-group">
                <label>式樣NO：</label>
                
                <div class="custom-select window-select" tabindex="0" @focusout="closeStyleMenu">
                  <div class="select-trigger" @click="toggleStyleMenu" :class="{ disabled: (mode !== 'new' && form.attribute.styleNo) }">
                    <span>{{ form.attribute.styleNo || '-- 請先選品目，再選式樣 --' }}</span>
                    <span class="arrow">▼</span>
                  </div>
                  
                  <div class="select-options" v-show="isStyleMenuOpen">
                    <div v-for="st in styleOptions" :key="st.sfhnr" class="option-item style-option-item" :class="{ 'is-locked': st.isLocked }" @mousedown.prevent="!st.isLocked && selectStyle(st.sfhnr)">
                      <div class="style-name-group">
                        <span class="style-name">{{ st.sfhnr }}</span>
                        <span v-if="st.isLocked" class="locked-hint">(已由 {{ st.lockedBy }} 編輯中)</span>
                      </div>

                      <div class="process-tags"><span v-for="proc in st.processNames" :key="proc" class="proc-tag">{{ proc }}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label for="apply-project">適用工程：</label>
                <input id="apply-project" class="window-select" type="text" :value="(form.attribute?.specification || []).map(s => s.name).join(', ')" readonly placeholder="請先選擇品目與式樣"/>
              </div>
              <div class="form-group"><label for="department">制訂單位：</label><input id="department" type="text" v-model="form.department" readonly /></div>
              <div class="form-group"><label for="author">制訂者：</label><input id="author" type="text" v-model="form.author" readonly /></div>
              <div class="form-group"><label for="confirmer">確認者：</label><input id="confirmer" type="text" v-model="form.confirmer" /></div>
              <div class="form-group"><label for="approver">承認者：</label><input id="approver" type="text" v-model="form.approver" /></div>
            </div>

            <div class="supplement">
              <div class="form-group"><label for="revise-reason">變更理由：</label><textarea id="revise-reason" v-model="form.change_reason" /></div>
              <div class="form-group"><label for="revise-point">變更要點：</label><textarea id="revise-point" v-model="form.change_summary" /></div>
            </div>
          </div>

          <ItemListWindow v-if="itemsListVisible" @selectItem="onSelectItemType" @cancel="itemsListVisible = false"/>
        </section>

        <!-- Step 2 目的 -->
        <section :ref="el => (sectionRefs[1].value = el)" class="step-section">
          <h2>1. 目的</h2>
          <div class="purpose-group">
            <InlineColorEditor
              :json-value="formJson.purpose"
              :plain-fallback="form.purpose"
              @update:jsonValue="v => formJson.purpose = v"
              @update:text="v => form.purpose = v"
            />
          </div>
        </section>

        <!-- Step 3 製作條件規範 -->
        <section :ref="el => (sectionRefs[2].value = el)" class="step-section">
          <h2>2. 製作條件規範</h2>
          <DynamicEditorTree
            :nodes="blocks.production"
            :chapter="chapterNumber(1, 4)"
            :allow-color="isRevisionDoc"
            @invalid-check="(payload) => updateSingleStepValidation(2, payload)"
          />
        </section>

        <!-- Step 4 製造參數一覽表 -->
        <section :ref="el => (sectionRefs[3].value = el)" class="step-section">
          <h2>3. 製造參數一覽表</h2>
          <ManufacturingParameterBlocks
            ref="ManufactureBlocks"
            :blockContent="blocks.manufacture"
            :partNo="form.attribute.itemType"
            :specification="Object.fromEntries(form.attribute.specification.map(specInfo => [specInfo.code, specInfo.step_count]))"
            :groupMachines="groupMachines"
            :documentToken="draftToken"
            :allowColor="isRevisionDoc"
            @update-block="blocks.manufacture = $event"
            @invalid-check="(payload) => updateSingleStepValidation(3, payload)"
          />
        </section>

        <!-- Step 5 適用品質與規格內容 -->
        <section :ref="el => (sectionRefs[4].value = el)" class="step-section">
          <h2>4. 適用品質與規格內容</h2>
          <DynamicEditorTree
            :nodes="blocks.quality"
            :chapter="chapterNumber(1, 6)"
            :allow-color="isRevisionDoc"
            :document-mode="true"
            @open-doc-search="handleOpenDocSearch"
            @invalid-check="(payload) => updateSingleStepValidation(4, payload)"
          />

          <FormSearchWindow
            v-if="specDocWindowVisible"
            headerName="適用品質與規格文件選取"
            documentType="qua"
            @add-new-forms="(payload) => addQualityDocs(payload)" 
            @close-window="specDocWindowVisible = false">
          </FormSearchWindow>
        </section>

        <!-- Step 6 使用表單 -->
        <section :ref="el => (sectionRefs[5].value = el)" class="step-section">
          <h2>5. 使用表單</h2>
          <div class="used-form" style="display: flex; justify-content: space-between; align-items: center;">
            <button class="layer-action-btn add" @click="docWindowVisible = 1">新增表單</button>
            <div v-if="isRevisionDoc" class="color-picker-group">
              <span style="font-size: 14px; color: #666; margin-right: 8px;">文字顏色:</span>
              <i class="dot blue" @click="setFormColor('blue')" title="設為藍色"></i>
              <i class="dot black" @click="setFormColor('black')" title="設為黑色"></i>
            </div>
          </div>

          <div v-for="(referInfo, refIndex) in references.form" 
               class="form-block" 
               :class="{ 'is-selected': selectedFormIndex === refIndex }"
               @click="selectedFormIndex = refIndex"
               :key="referInfo.id || refIndex">
            
            <div class="form-info-block" :style="{ color: referInfo.color === 'blue' ? 'blue' : 'black' }">
              <label class="form-label no" :style="{ borderColor: referInfo.color === 'blue' ? 'blue' : '#ddd' }">5.{{ refIndex + 1 }}</label>
              <label class="form-label id">{{ referInfo.refer_document }}</label>
              <label class="form-label name" :style="{ borderColor: referInfo.color === 'blue' ? 'blue' : '#ddd' }">{{ referInfo.refer_document_name }}</label>  
            </div>
            <div class="form-btn-block">
              <button class="remove-btn" @click.stop="removeDoc(refIndex)">x</button>
            </div>
          </div>

          <FormSearchWindow 
            v-if="docWindowVisible == 1"
            headerName="表單選取"
            documentType="form"
            @add-new-forms="(payload) => addDocs(payload)" 
            @close-window="docWindowVisible = -1">
          </FormSearchWindow>
        </section>

        <!-- Step 7 其它 -->
        <section :ref="el => (sectionRefs[6].value = el)" class="step-section">
          <h2>6. 其它</h2>
          <DynamicEditorTree
            :nodes="blocks.other"
            :chapter="chapterNumber(1, 7)"
            :allow-color="isRevisionDoc"
            @invalid-check="(payload) => updateSingleStepValidation(6, payload)"
          />
        </section>
      </div>

      <!-- Step 8：文件產出獨立頁 -->
      <div v-else class="output-page">
        <div style="display: flex; justify-content: space-between; align-items:center;">
          <h2>文件產出</h2>
          <div style="display:flex; gap:.5rem;"><button @click="DownloadDocx" :disabled="downloadLoading" class="layer-action-btn add">{{ downloadLoading ? '產生中…' : '產生文件（Word）' }}</button></div>
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
defineOptions({ name: 'new-specification' });

import axios from 'axios'
import { ref, reactive, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'

import DynamicEditorTree from '@/components/DynamicEditorTree.vue'
import FormSearchWindow from '@/components/FormSearchWindow_.vue'
import ItemListWindow from '@/components/ItemListWindow.vue'
import ManufacturingParameterBlocks from '@/components/ManufacturingParameterBlocks_.vue'
import WordPreview from '@/components/WordPreview.vue'
import InlineColorEditor from '@/components/InlineColorEditor.vue'
import { useDraftToken } from '@/composables/useDraftToken'
import { registerDraftTab, unregisterDraftTab } from '@/composables/draftTabRegistry'
import { initDoc, saveSpecification, loadSpecification, fetchManufactureInfo, fetchLatestSpecificationDocVersion } from '@/api/docsApi'
import { mfgPmsDiffCheck } from '@/utils/pmsDiffUtils.js';
// P2：樹狀區塊
import { makeNode, ensureTree, toPayloadTree } from '@/utils/blockTree.js'
import { paramBlockToNode, nodeToParamBlock } from '@/utils/paramNode.js'
import { chapterNumber } from '@/utils/blockNumbering.js'
import { richOrPlain } from '@/utils/richText.js'
import { v1 as uuidv1 } from 'uuid'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || '';

const route = useRoute();
const mode = computed(() => route.query.mode || 'new');
const revise = computed(() => form.previous_document_token !== "");
const currentToken = computed(() => route.query.token || '');
const storageKey = computed(() => { return (mode.value == "new") ? 'rms:draft:new-specification' : `rms:draft:${currentToken.value}`; })
const isRevisionDoc = computed(() => form.document_version > 1)

const { token: draftToken, setToken, clearToken } = useDraftToken(storageKey.value);
const ensureDraftToken = async () => {
  if (route.query.token) { setToken(draftToken.value, { updateUrl: true }); return; }
  try {
    const res = await initDoc(1);
    if (res?.success && res.token) { setToken(res.token, { updateUrl: true }); return; }
    throw new Error(res?.message || 'init failed');
  } catch (e) { console.error('docs/init failed:', e); alert('建立草稿代碼失敗，請稍後再試'); }
}

const copyToken = computed(() => String(route.query.copyToken || ''));
const isCopyMode = computed(() => route.query.mode === 'copy');

// ==========================================
// 1. Main Data
// ==========================================
const form = reactive({
  document_type: 1,
  document_id: '',
  document_name: '',
  document_version: 1.0,
  attribute: { itemType: '', styleNo: '', specification: [], mpnMode: "" },
  department: '',
  author_id: '',
  author: '',
  approver: '',
  confirmer: '',
  change_reason: '',
  change_summary: '',
  documentStyle: 'FM-R-MF-AZ-052 Rev9.0',
  purpose: '',
  previous_document_token: '',
});

const blocks = reactive({ production: [], manufacture: [], quality: [], other: [] });
const references = reactive({ form: [] });
// 主表欄位的 tiptap 樣式 JSON（與 form 純文字並存；舊文件沒 JSON 時用純文字 fallback）
const formJson = reactive({ purpose: null });

let uuid = 0;
const createBlock = (step_type, content_type = 0) => ({ id: uuid++, step_type, tier_no: 1, data: [createBlockData(content_type)] })
const createBlockData = (content_type) => ({ content_type, header_text: null, header_json: null, content_text: null, content_json: null, table_text: null, table_json: null, files: [], metadata: {} })
const createReference = (payload) => ({ id: uuid++, refer_type: 1, ...payload });

const resetAll = () => {
  Object.assign(form, {
    document_type: 1,
    document_id: '',
    document_name: '',
    document_version: 1.0,
    attribute: { itemType: '', styleNo: '', specification: [], mpnMode: "" },
    department: '',
    author_id: '',
    author: '',
    approver: '',
    confirmer: '',
    change_reason: '',
    change_summary: '',
    documentStyle: 'FM-R-MF-AZ-052 Rev9.0',
    purpose: '',
    previous_document_token: '',
  });

  Object.assign(blocks, { production: [], manufacture: [], quality: [], other: [] });
  Object.assign(references, { form: [] });
  Object.assign(formJson, { purpose: null });
}

// ==========================================
// 2. Step Navigation Function
// ==========================================
const sectionRefs = Array.from({ length: 7 }, () => ref(null));
const currentStep = ref(1);
const navCollapsed = ref(false);
const steps = [
  { label: '基本屬性', status: false },
  { label: '目的', status: false },
  { label: '製作條件規範', status: false },
  { label: '條件參數一覽表', status: false },
  { label: '適用品質與規格內容', status: false },
  { label: '使用表單', status: false },
  { label: '其他', status: false },
  { label: '文件匯出' },
];

const scrollToTop = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); }
const scrollToStep = (index) => {
  currentStep.value = index;
  console.log("currentStep.value: ", currentStep.value);
  if (index >= 1 && index < 8) {  // Step 1 ~ 8：一頁式捲動
    const el = sectionRefs[index - 1].value;
    if (el) {
      const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const navHeight = navCollapsed.value ? 56 : 96;
      const rect = el.getBoundingClientRect();
      const offsetTop = rect.top + scrollY - navHeight - 16;
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  }

  // Step 9：切到輸出頁，順便回到最上
  if (index === 8) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchDocx();
  }
}
// const stepStatusClass = (index) => { return 'step-ok'; }
const handleScroll = () => {
  const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

  // 1) Control zoom in, zoom out
  navCollapsed.value = scrollY > 120;

  // 2) Based on the scroll bar switch step. 
  if (currentStep.value === 8) return;

  const navHeight = navCollapsed.value ? 56 : 96;
  const targetY = scrollY + navHeight + 24; // 稍微往下 24px，避免剛貼到邊界就跳來跳去

  let closestIndex = 0;
  let closestDist = Infinity;

  sectionRefs.forEach((r, idx) => {
    const el = r.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sectionTop = rect.top + scrollY;

    const dist = Math.abs(sectionTop - targetY);
    if (dist < closestDist) { closestDist = dist; closestIndex = idx; }
  })

  // index 0 -> Step 1, index 1 -> Step 2, ...
  currentStep.value = closestIndex + 1
}

// ==========================================
// 2.1 Step validation Function
// ==========================================
const stepValidations = reactive({
  0: { isValid: false,                            message: [], title: '基本屬性' },
  1: { isValid: false,                            message: [], title: '目的' },
  2: { isValid: false,  component: 'production',  message: [], title: '製作條件規範' },
  3: { isValid: false,  component: 'manufacture', message: [], title: '條件參數一覽表' },
  4: { isValid: false,  component: 'quality',     message: [], title: '適用品質與規格內容' },
  5: { isValid: false,  component: 'form',        message: [], title: '使用表單' },
  6: { isValid: false,  component: 'other',       message: [], title: '其他' },
});

watch(() => form, (newForm) => {
    // --- Step 0 檢查 ---
    const s0 = stepValidations[0];
    s0.message = [];
    
    const requireFields = [newForm.document_name, newForm.document_version, newForm.attribute.itemType, newForm.attribute.styleNo, newForm.department, newForm.author, newForm.confirmer, newForm.approver];
    const machineCheck = (Array.isArray(newForm.attribute.machines) && newForm.attribute.machines.length > 0 && !machine_tags.value.some(tag => tag.isValid == false));

    console.log(" -- revise.value: ", revise.value);

    if (requireFields.some(v => !v || v.length == 0)) s0.message.push('有必填欄位未填寫');
    if (revise.value && (!newForm.change_reason || !newForm.change_summary)) s0.message.push('變版時，變更理由與要點為必填');
    s0.isValid = (s0.message.length === 0);

    // --- Step 1 檢查 ---
    const s1 = stepValidations[1];
    s1.message = [];
    if (!newForm.purpose || newForm.purpose.trim() === '') s1.message.push('目的內容不可為空');
    s1.isValid = (s1.message.length === 0);
  },
  { deep: true, immediate: true }
);
const updateSingleStepValidation = (stepNo, payload) => {
  stepValidations[stepNo].isValid = payload.isValid;
  stepValidations[stepNo].message = payload.message || [];
};

// Temporary object status for production block, quality block and other block (storage format: { blkId: { isValid, message } })
const dynamicValidations = reactive({ production: {}, quality: {}, other: {} });
// Dynamic emit valid status
const updateDynamicValidation = (stepNo, category, blkId, payload) => { dynamicValidations[category][blkId] = payload; recalculateStepValidation(stepNo, category); };
const recalculateStepValidation = (stepNo, category) => {
  let allValid = true;
  let allMessages = [];

  // Iterate through all remaining block states in the object
  Object.values(dynamicValidations[category]).forEach(status => {
    if (!status.isValid) {
      allValid = false;
      if (status.message && status.message.length > 0) { allMessages.push(...status.message); }
    }
  });

  // Update step validation value
  stepValidations[stepNo].isValid = allValid;
  stepValidations[stepNo].message = allMessages;
};
// Step status process and display
const stepStatusClass = (stepNo) => {
  if (stepNo >= currentStep.value) return '';  // skip subsequent step

  else if (stepNo == 2 && blocks.production.length == 0) return '';
  else if (stepNo == 3 && blocks.manufacture.length == 0) return '';
  else if (stepNo == 4 && blocks.quality.length == 0) return '';
  else if (stepNo == 5) return references.form.length > 0 ? 'step-ok' : '';
  else if (stepNo == 6 && blocks.other.length == 0) return '';
  else if (stepValidations[stepNo]) return stepValidations[stepNo].isValid ? 'step-ok' : 'step-error';
  return 'step-ok'; // 預設值
}

// ==========================================
// 3. Fundamental-Attribute Function
// ==========================================
const itemsListVisible = ref(false);
const onSelectItemType = async (itemType) => {
  form.attribute.itemType = itemType || '';
  form.attribute.styleNo = '';
  form.attribute.specification = [];
  styleOptions.value = [];
  itemsListVisible.value = false;

  if (!form.attribute.itemType) return;
  
  loadStylesFormItem(itemType);
  await ManufactureBlocks.value.delAllBlock(true, true);
}
const styleOptions = ref([]);
const cleanProcessName = (processName) => processName.replace(/^\([^)]+\)/, '').replace(/\(\d+\)$/, '').trim();
const loadStylesFormItem = async (itemType) => {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/item/styles`, { params: { matnr: itemType } });
    if (data.success) { styleOptions.value = Array.isArray(data.data?.styles) ? data.data.styles.map(st => ({...st, processNames: st.process_names.map(name => cleanProcessName(name))})) : []; return; }
  } catch (e) { 
    console.error('loadStylesForItem failed:', e); 
  }
  alert('取得式樣清單失敗'); 
}

const isStyleMenuOpen = ref(false);
const toggleStyleMenu = () => isStyleMenuOpen.value = (mode.value === 'new' || form.attribute.styleNo == "") && !isStyleMenuOpen.value
const closeStyleMenu = (event) => isStyleMenuOpen.value = event.currentTarget.contains(event.relatedTarget);
const selectStyle = (sfhnr) => {
  form.attribute.styleNo = sfhnr;
  isStyleMenuOpen.value = false;
  fetchProcessesAndMachines(); // 觸發你原本的 API 抓取或資料綁定邏輯
};

const groupMachines = ref({});
const fetchProcessesAndMachines = async (load = false) => {
  if (!form.attribute.itemType || !form.attribute.styleNo) return;
  try {
    const { data } = await axios.get(`${API_BASE_URL}/item/processesAndMachines`, { params: { matnr: form.attribute.itemType, sfhnr: form.attribute.styleNo }, });
    if (!data.success) { 
      form.attribute.specification = [];
      groupMachines.value = {};
      return; 
    }

    await ManufactureBlocks.value?.delAllBlock(true, true);
    form.attribute.specification = data.data?.specification || [];
    form.document_name = `${form.attribute.styleNo.split('-', 1)[0]}_${form.attribute.specification.map(s => cleanProcessName(s.name)).join('、')} 製造式樣書`;
    groupMachines.value = data?.data?.specGroups || {};
    if (!load) await saveDraft(false);
  } catch (e) { 
    console.error('fetch processes and machines failed:', e); 
    alert('取得適用工程與機台失敗');
    return;
  }
  
  if (!revise.value) {
    const versionInfo = await fetchLatestSpecificationDocVersion(form.attribute.styleNo);
    form.document_id = (versionInfo.document_version || 1.0) == 1 ? "" : versionInfo.document_id;
    form.document_version = versionInfo.document_version || 1.0;
  }
}

// ==========================================
// 4. Blocks Function
// ==========================================
const ManufactureBlocks = ref(null);
const addDynamicBlock = (step_name, step_type) => { 
  blocks[step_name].push(createBlock(step_type, 0));
  blocks[step_name].forEach((blk, blkIndex) => { blk.tier_no = blkIndex + 1; }); 
}
const removeDynamicBlock = (step_name, index) => {
  // Get corresponding step index for step name
  const stepNo = Object.entries(stepValidations).filter(([stepNo, stepInfo]) => stepInfo.component === step_name)[0][0];
  const blkId = blocks[step_name][index].id;

  // 1. Delete validation content from step validation value
  if (dynamicValidations[step_name] && dynamicValidations[step_name][blkId]) {
    delete dynamicValidations[step_name][blkId];
  }

  // 2. Delete block process
  blocks[step_name].splice(index, 1); 
  blocks[step_name].forEach((blk, blkIndex) => { blk.tier_no = blkIndex + 1; });

  // 3. Recalculate step validation value
  recalculateStepValidation(stepNo, step_name);
}

const specDocWindowVisible = ref(false);
let pendingDoc = null; // 觸發插入文件的 { node, siblings, index }
const handleOpenDocSearch = (payload) => {
  pendingDoc = payload;
  specDocWindowVisible.value = true;
};
// 把一份文件套進節點 → 唯讀標題的 content_type=3 節點；
// 換新 client_id 強制 DynamicEditorNode 重掛載，讓標題編輯器吃到新的 header_json。
const applyDocToNode = (node, docInfo) => {
  node.content_type = 3;
  node.header_text = docInfo;
  node.header_json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: docInfo }] }] };
  node.content_json = null; node.content_text = null;
  node.table_json = null; node.table_text = null;
  node.files = [];
  node.client_id = uuidv1();
};
const addQualityDocs = (payload) => {
  const ctx = pendingDoc || {};
  payload.forEach((doc, i) => {
    const info = `${doc.refer_document} ${doc.refer_document_name}`;
    if (i === 0 && ctx.node) {
      // 第一筆套進觸發節點本身
      applyDocToNode(ctx.node, info);
    } else if (ctx.siblings) {
      // 其餘文件插在原節點的「同層」之後（同一個 children 陣列）
      const n = makeNode(3); applyDocToNode(n, info);
      ctx.siblings.splice(ctx.index + i, 0, n);
    } else {
      // 後備：無 context 時掛最外層
      const n = makeNode(3); applyDocToNode(n, info); blocks.quality.push(n);
    }
  });
  specDocWindowVisible.value = false;
  pendingDoc = null;
}

// ==========================================
// 5. Docs Function (format: { document: [{ refer_type, refer_document, refer_document_name }, ...], form: [...] })
// ==========================================
const docWindowVisible = ref(-1);
const selectedFormIndex = ref(-1);
const setFormColor = (color) => {
  if (selectedFormIndex.value !== -1 && references.form[selectedFormIndex.value]) { references.form[selectedFormIndex.value].color = color; }
  else { alert('請先點擊選取要更改顏色的表單列'); }
};
const addDocs = (payload) => {
  const defaultColor = revise.value ? 'blue' : 'black';
  payload.forEach(doc => references.form.push({...createReference(doc), color: defaultColor}));
  docWindowVisible.value = -1;
}
const removeDoc = (index) => {
  references.form.splice(index, 1);
  if (selectedFormIndex.value === index) { selectedFormIndex.value = -1; }
}

// ==========================================
// 6. Preview & Export Function
// ==========================================
const normalizeBlock = (blk) => {
  let newBlock = [];
  blk.forEach((blkInfo, blkIndex) => {
    blkInfo.data.forEach((sblkInfo, sblkIndex) => {
      if (sblkInfo.header_text || sblkInfo.header_json || sblkInfo.content_text || sblkInfo.content_json || sblkInfo.table_text || sblkInfo.table_json || sblkInfo.files.length > 0 || Object.keys(sblkInfo.metadata).length > 0){
        newBlock.push({
          step_type: blkInfo.step_type,
          tier_no: blkIndex + 1,
          sub_no: sblkIndex,
          content_type: sblkInfo.content_type,
          header_text: sblkInfo.header_text,
          header_json: sblkInfo.header_json,
          content_text: sblkInfo.content_text,
          content_json: sblkInfo.content_json,
          table_text: sblkInfo.table_text,
          table_json: sblkInfo.table_json,
          files: sblkInfo.files,
          metadata: sblkInfo.metadata,
        })
      }
    })
  })
  return newBlock;
}
const buildDocxPayload = () => {
  return {
    token: draftToken.value,
    attribute: [{ ...form }],
    // form_attribute 永遠送 tiptap doc（無樣式 JSON 時用純文字補成 doc），後端單一渲染路徑、零 fallback
    form_attribute: { purpose: richOrPlain(formJson.purpose, form.purpose) },
    // P2：整包巢狀樹（§7.1）。production/quality/other 為通用樹；manufacture 參數表包成 content_type=4 leaf 節點。
    tree: [
      { step_type: 4, children: toPayloadTree(blocks.production) },
      { step_type: 5, children: toPayloadTree(blocks.manufacture.map((blk) => paramBlockToNode(blk))) },
      { step_type: 6, children: toPayloadTree(blocks.quality) },
      { step_type: 7, children: toPayloadTree(blocks.other) },
    ],
    reference: references.form.map(r => ({ ...r, refer_type: 1 }))
  }
}

const previewLoading = ref(false);
const errorMsg = ref("");
const docxSrc = ref(null);
async function fetchDocx() {
  console.log("fetch docx block manufacture: ", blocks.manufacture);
  previewLoading.value = true;
  errorMsg.value = "";
  try {
    const payload = buildDocxPayload();
    const res = await axios.post(`${API_BASE_URL}/docs/preview/docx_`, payload, { responseType: 'blob' });

    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    if (docxSrc.value) URL.revokeObjectURL(docxSrc.value);
    docxSrc.value = URL.createObjectURL(blob);
  } 
  catch (e) { console.error(e); errorMsg.value = (e && e.message) || 'preview docx error' }
  finally { previewLoading.value = false; }
}

// 檢查所有 step 是否通過驗證 (依 stepStatusClass 的邏輯：空白選填區塊不卡控)
const collectInvalidSteps = () => {
  const invalid = [];
  for (const [key, stepInfo] of Object.entries(stepValidations)) {
    const n = Number(key);
    // Skip optional steps when they're empty (與 stepStatusClass 邏輯一致)
    if (n === 2 && blocks.production.length === 0) continue;
    if (n === 3 && blocks.manufacture.length === 0) continue;
    if (n === 4 && blocks.quality.length === 0) continue;
    if (n === 5) continue;  // 使用表單為選填
    if (n === 6 && blocks.other.length === 0) continue;

    if (!stepInfo.isValid) {
      const detail = (stepInfo.message && stepInfo.message.length > 0)
        ? stepInfo.message.map(m => `  - ${m}`).join('\n')
        : '  - 尚未通過驗證';
      invalid.push(`【${stepInfo.title}】\n${detail}`);
    }
  }
  return invalid;
};

const downloadLoading = ref(false);
async function DownloadDocx() {
  // 卡控：所有 step 必須通過驗證才可下載
  const invalidSteps = collectInvalidSteps();
  if (invalidSteps.length > 0) {
    alert(`請先完成下列項目，才能下載文件：\n\n${invalidSteps.join('\n\n')}`);
    return;
  }

  downloadLoading.value = true;
  try {
    // Build payload and save draft
    const payload = buildDocxPayload();
    const success = await saveDraft();
    if (!success) return;

    // Get Word document and some information
    const res = await axios.post(`${API_BASE_URL}/docs/generate/word_`, payload, { responseType: 'blob' });
    if (res.headers['x-document-id']) form.document_id = res.headers['x-document-id'];
    if (res.headers['x-document-version']) form.document_version = res.headers['x-document-version'];

    // Create blob object and create url to access file
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${form.document_name || 'document'}${Number(form.document_version ?? 1).toFixed(1)}.docx`;
    a.click();
    URL.revokeObjectURL(a.href);
  } 
  catch (e) { console.error(e); errorMsg.value = (e && e.message) || 'preview docx error'; }
  finally { downloadLoading.value = false; }
}

// ==========================================
// 7. Initialize and Destroy Function
// ==========================================
const isSaving = ref(false);
const saveDraft = async (show_window = true) => {
  isSaving.value = true;
  try {
    const payload = buildDocxPayload();
    console.log("save draft: ", payload);
    const result = await saveSpecification(payload);

    if (!result.success) { alert(result?.message || '儲存草稿失敗'); return false; }

    if (show_window) alert(`草稿已儲存(時間：${result.issueTime || ''})`);
    return true;
  } 
  catch (e) { console.error(e); alert((e?.response?.status === 409) ? '此文件已被簽核，因此停用儲存功能' : '儲存草稿失敗'); } 
  finally { isSaving.value = false; }
  return false;
}

// 從後端載入結果取某 step 的節點 forest（相容 result.blocks[step] forest 與 result.tree 兩種形狀）
const forestFromResult = (result, stepName, stepType) => {
  const fromBlocks = result?.blocks?.[stepName];
  if (Array.isArray(fromBlocks)) return ensureTree(fromBlocks.map((n) => ({ ...n })));
  if (Array.isArray(result?.tree)) {
    const grp = result.tree.find((g) => Number(g.step_type) === stepType);
    return ensureTree((grp?.children || []).map((n) => ({ ...n })));
  }
  return [];
};

const isloading = ref(false);
const applyLoadedData = async () => {
  isloading.value = true;
  try {
    console.log("request load specification...");
    const result = await loadSpecification(draftToken.value, sessionStorage.getItem('loggedInUserNo'));
    console.log("result.references: ", result.references);
    if (!result) {
      alert(result?.message || '讀取草稿失敗');
      return;
    }

    // Get login information
    form.department = sessionStorage.getItem('loggedInUserdeptName');
    form.author_id = sessionStorage.getItem('loggedInUserNo');
    form.author = sessionStorage.getItem('loggedInUserName');

    // Get projects list and document information
    // console.log("result form attribute: ", result.form.attribute);
    if (result.form){  // Load data
      Object.assign(form, { ...result.form, department: form.department, author_id: form.author_id, author: form.author, attribute: form.attribute });
      Object.assign(form.attribute, { ...result.form.attribute });
      formJson.purpose = result.form_attribute?.purpose ?? null;
      if (form.attribute.itemType && form.attribute.itemType.length > 0) { await loadStylesFormItem(form.attribute.itemType); }
      if (form.attribute.styleNo && form.attribute.styleNo) { await fetchProcessesAndMachines(true); }

      // P2：載入巢狀樹 forest（原地 splice 保持陣列參照，DynamicEditorTree 才會更新）
      blocks.production.splice(0, blocks.production.length, ...forestFromResult(result, 'production', 4));
      blocks.quality.splice(0, blocks.quality.length, ...forestFromResult(result, 'quality', 6));
      blocks.other.splice(0, blocks.other.length, ...forestFromResult(result, 'other', 7));
      // manufacture：content_type=4 節點 → 還原成參數表 block 形狀（給元件 loadBlocks 用）
      blocks.manufacture = forestFromResult(result, 'manufacture', 5).map((n, i) => nodeToParamBlock(n, i, 5));
      Object.assign(references, { ...result.references });
    }

    if (blocks.manufacture.length > 0) {
      ManufactureBlocks.value?.loadBlocks(blocks.manufacture);
      
      const payload = Object.fromEntries(blocks.manufacture.filter(blk => blk.data[0].metadata.machines && blk.data[0].metadata.machines.length > 0).map(blk => ([blk.id, { groupCode: blk.data[0].metadata.groupCode, machines: blk.data[0].metadata.machines}])));
      console.log(" -- fetchManufactureInfo payload: ", payload);

      if (Object.keys(payload).length > 0) {
        const manufactureInfo = await fetchManufactureInfo(payload);
        
        let hasGlobalChanges = false;
        let globalMessages = [];
        const updatesToChild = {};

        blocks.manufacture.forEach((blk, index) => {
          const info = manufactureInfo[blk.id];
          console.log(" -- info: ", info);
          if (!info) return;

          // Check PMS information
          const { messages, mergedTable } = mfgPmsDiffCheck(blk.data[0].table_text, info.pms);
          updatesToChild[blk.id] = { matchSet: info.matchSet, mergedTable: mergedTable, hasUpdate: messages.length > 0 };

          if (messages.length > 0) {
            hasGlobalChanges = true;
            const machineNames = blk.data[0].metadata.machines_name?.join('、') || '未知機台';
            globalMessages.push(`【第 ${index + 1} 組模塊 (${machineNames})】:\n  - ` + messages.join('\n  - '));
          }
        });

        // Notify user
        if (hasGlobalChanges) { alert(`系統檢測到部分機台的 PMS 點位發生異動：\n\n` + `${globalMessages.join('\n\n')}\n\n` + `系統已自動為您載入最新格式，並保留您原本輸入的數值，請重新確認！`); }

        // Update component pms and machine match information
        ManufactureBlocks.value.applyUpdates(updatesToChild);
      }
    }
  } 
  catch (e) { console.error(e); alert('載入草稿失敗'); }
  finally { isloading.value = false; }
}

// 複製模式：從來源 copyToken 載入自訂內容到「新 token 草稿」。
// 忽略「製造參數一覽表(manufacture)」與「品目/式樣」，並重置文管編號/版本/變版來源 → 成為全新文件。
const applyCopiedData = async () => {
  isloading.value = true;
  try {
    const result = await loadSpecification(copyToken.value, sessionStorage.getItem('loggedInUserNo'));
    if (!result || !result.form) { alert('讀取來源文件失敗，無法複製'); return; }

    form.department = sessionStorage.getItem('loggedInUserdeptName');
    form.author_id  = sessionStorage.getItem('loggedInUserNo');
    form.author     = sessionStorage.getItem('loggedInUserName');

    Object.assign(form, {
      ...result.form,
      department: form.department, author_id: form.author_id, author: form.author,
      attribute: form.attribute,        // 保留現有 attribute 物件參照（下面再 assign）
      document_id: '',                  // 新文件，無文管編號
      document_name: '',                // 由式樣重新產生
      document_version: 1.0,
      previous_document_token: '',      // 複製非變版
    });
    // 品目/式樣/適用工程清空，待使用者重選；其餘 attribute 欄位沿用
    Object.assign(form.attribute, { ...result.form.attribute, itemType: '', styleNo: '', specification: [] });

    // 自訂區塊：製作條件規範 / 適用品質 / 其它 帶過去；製造參數一覽表不複製
    blocks.production.splice(0, blocks.production.length, ...forestFromResult(result, 'production', 4));
    blocks.quality.splice(0, blocks.quality.length, ...forestFromResult(result, 'quality', 6));
    blocks.other.splice(0, blocks.other.length, ...forestFromResult(result, 'other', 7));
    blocks.manufacture = [];

    Object.assign(references, { ...result.references });
    formJson.purpose = result.form_attribute?.purpose ?? null;
  }
  catch (e) { console.error(e); alert('複製文件失敗'); }
  finally { isloading.value = false; }
};

resetAll();
onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true });
  await ensureDraftToken();
  if (isCopyMode.value) await applyCopiedData();
  else await applyLoadedData();
});

// 關閉頁簽（從 keep-alive 移除 → unmount）時詢問是否存檔；切換頁簽是 deactivate，不會觸發。
// saveDraft() 內 buildDocxPayload 為同步、會先擷取當前內容，POST 再非同步送出，故 fire-and-forget 即可。
// 以 document token 註冊到頁簽 registry：App.vue 點頁簽 ✕ 當下即可詢問並儲存此份草稿。
// （keep-alive 下同名頁簽會延後 unmount，故詢問不靠 onBeforeUnmount，改在 closeTab 即時觸發。）
watch(draftToken, (newTok, oldTok) => {
  if (oldTok && oldTok !== newTok) unregisterDraftTab(oldTok);
  if (newTok) registerDraftTab(newTok, { save: () => saveDraft(), label: '製造式樣書' });
}, { immediate: true });

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll);
  unregisterDraftTab(draftToken.value);
});

</script>

<style scoped>
.new-specification-container { width: 90%; margin: 30px auto; padding: 25px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }

/* Header */
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
.header h1 { margin: 0; font-size: 28px; color: #333; }
.back-btn,
.save-btn { display: flex; background-color: #6c757d; color: white; border: none; padding: 10px 18px; border-radius: 5px; cursor: pointer; font-size: 15px; align-items: center; transition: background-color 0.3s ease; }
.back-btn:hover, .save-btn:hover { background-color: #5a6268; }
.back-btn .icon, .save-btn .icon { width: 18px; height: 18px; margin-right: 8px; filter: invert(100%); }

/* Steps navigation（跟 NewInstruction.vue 同風格） */
.steps-navigation { position: sticky; top: 0; z-index: 10; background: #fff; display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #eee; transition: all 0.2s ease; }
.steps-navigation.collapsed { padding: 6px 12px; transform: translateY(-4px); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05); }
.step-item { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 8px; border-radius: 999px; transition: background 0.15s, transform 0.15s; opacity: 0.85; }
.steps-navigation.collapsed .step-item { transform: scale(0.92); }
.step-item.active { background: #1f6feb; color: #fff; opacity: 1; }
.step-circle { width: 24px; height: 24px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 13px; background: rgba(0, 0, 0, 0.05); }
.step-item.active .step-circle { background: rgba(255, 255, 255, 0.2); }
.step-label { font-size: 14px; }
.steps-navigation.collapsed .step-circle { width: 20px; height: 20px; font-size: 12px; }
.steps-navigation.collapsed .step-label { font-size: 13px; }
.step-item.step-error { background-color: #ffe5e5; border-color: #e74c3c; color: #000000; }
.step-item.step-ok { background-color: #e6f9e8; border-color: #27ae60; color: #000000; }

/* Content */
.form-section { padding: 20px 0; }

.step-section { background-color: #f9f9f9; padding: 25px; border-radius: 8px; border: 1px solid #e0e0e0; margin-bottom: 18px; }
.step-section h2 { font-size: 22px; color: #333; margin-top: 0; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #007bff; display: inline-block; }

/* Attribute Block */
.fundamental-attribute-block { display: flex; border: unset; padding: 0px; }
.fundamental-attribute-block .attribute { display: flex; flex-direction: column; width: 100%; }
.fundamental-attribute-block .supplement { display: flex; flex-direction: column; width: 100%; }
.form-group { display: flex; flex-direction: row; align-items: center; margin-bottom: 8px; padding: 8px; }
.form-group label { width: 20%; font-size: 15px; color: #555; margin-bottom: 8px; font-weight: bold; }
.form-group input,
.form-group textarea,
.form-group select { width: 70%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 15px; box-sizing: border-box; transition: border-color 0.2s ease; }
.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus { border-color: #008bff; outline: none; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1); }
.form-group textarea { resize: vertical; min-height: 80px; }
.form-group input[readonly] { background-color: #e9ecef; color: #495057; cursor: not-allowed; }
.form-group input.window-select { background: white; cursor: pointer; }

/* Purpose */
.purpose-group { width: 100%; flex-grow: 1; height: 50%; }
.purpose-group textarea { width: 100%; height: 100%; min-height: 150px; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; box-sizing: border-box; resize: vertical; transition: border-color 0.2 ease; }
.purpose-group textarea:focus { border-color: #007bff; outline: none; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1); }

/* Common */
.layer-action-btn { margin: 10px; background: #1666c0; color: white; border: none; padding: 8px 12px; border-radius: 5px; font-size: 14px; cursor: pointer; }

.form-block { display: flex; justify-content: space-between; padding: 10px; margin: 10px 10px; border: 1px solid #ddd; }
.form-label { padding: 8px 10px; }
.form-label.no { border-right: 1px solid #ddd; }
.form-label.id { display: inline-block; width: 20vh; border-right: 1px solid #ddd; }
.form-btn-block { display: flex; align-items: center; }
.remove-btn { background: none; border: none; color: red; font-weight: bold; cursor: pointer; font-size: 1.2em; }

.document-block, .form-block { cursor: pointer; transition: all 0.2s ease; border-radius: 4px; }
.document-block.is-selected, .form-block.is-selected { outline: 2px solid #2196f3; background-color: #f4f9ff; border-color: #2196f3; }
.color-picker-group { display: flex; align-items: center; background: #f8f9fa; padding: 4px 12px; border-radius: 20px; border: 1px solid #eee; }
.dot { display: inline-block; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); cursor: pointer; margin-left: 6px; }
.blue { background: #0000ff; }
.black { background: #000000; }

/* 浮動工具列 */
.floating-tools { position: fixed; right: 24px; bottom: 72px; display: flex; flex-direction: column; gap: 8px; z-index: 20; }
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
.tool-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15, 23, 42, 0.22); background: #f3f4f6; }
.tool-btn:disabled { opacity: 0.6; cursor: default; }

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
</style>