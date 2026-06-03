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
      <div v-for="(step, index) in steps" :key="index" :class="['step-item', stepStatusClass(index), { 'active': currentStep === index + 1, 'completed': currentStep > index + 1 }]" @click="scrollToStep(index + 1)">
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
              <div class="form-group"><label for="doc-code">文管編號：</label><input type="text" id="doc-code" v-model="form.document_id" readonly/></div>
              <div class="form-group"><label for="doc-name">文件名稱：</label>
                <!-- <input type="text" id="doc-name" v-model="form.document_name"/> -->
                <InlineColorEditor
                  :json-value="formJson.document_name"
                  :plain-fallback="form.document_name"
                  :single-line="true"
                  @update:jsonValue="v => formJson.document_name = v"
                  @update:text="v => form.document_name = v"
                />
              </div>
              <div class="form-group"><label for="doc-version">文件版本：</label><input type="text" id="doc-version" v-model="form.document_version" readonly/></div>
              <div class="form-group">
                <label for="apply-project">適用工程：</label>
                <InlineColorEditor
                  :json-value="formJson.applyProject"
                  :plain-fallback="form.attribute.applyProject"
                  :single-line="true"
                  :options="projectList"
                  :lock-input="true"
                  :disabled="revise || isRevisionDoc || form.document_id.length > 0"
                  @update:jsonValue="v => formJson.applyProject = v"
                  @update:text="v => form.attribute.applyProject = v"
                  @select="applyProjectChange"
                />
              </div>
              <div class="form-group">
                <label for="machines">適用機台：</label>
                <input class="input-machine" type="text" id="machines" :value="'    --- 請選擇機台 ---    '" @click="machinesListVisible=(form.attribute.applyProject.length > 0 && !machinesListVisible)" readonly/>
              </div>
              <div class="form-group"><label for="space"></label>
                <div v-if="machine_tags.length" class="machine-tags">
                  <div v-for="machine in machine_tags" :key="machine.id" class="machine-tag" :class="{ invalid: !machine.isValid }">
                    <span class="tag-name">{{ machine.name }}</span>
                    <button type="button" class="tag-remove" @click="removeMachineTag(machine.id)" title="移除此機台">✕</button>
                  </div>
                </div>
              </div>
              
              <div class="form-group"><label for="department">制訂單位：</label><input type="text" id="department" v-model="form.department" readonly/></div>
              <div class="form-group"><label for="author">制訂者：</label><input type="text" id="author" v-model="form.author" readonly/></div>
              <div class="form-group"><label for="confirmer">確認者：</label><input type="text" id="confirmer" v-model="form.confirmer"/></div>
              <div class="form-group"><label for="approver">承認者：</label><input type="text" id="approver" v-model="form.approver"/></div>
            </div>
            <div class="supplement">
              <div class="form-group"><label for="revise-reason">變更理由：</label><textarea id="revise-reason" v-model="form.change_reason"></textarea></div>
              <div class="form-group"><label for="revise-point">變更要點：</label><textarea id="revise-point" v-model="form.change_summary"></textarea></div>
            </div>
          </div>

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
            <!-- <textarea v-model="form.purpose" placeholder="此處將填寫文件的目的相關內容。"></textarea> -->
            <InlineColorEditor
              :json-value="formJson.purpose"
              :plain-fallback="form.purpose"
              @update:jsonValue="v => formJson.purpose = v"
              @update:text="v => form.purpose = v"
            />
          </div>
        </section>

        <!-- Step 3 -->
        <section :ref="el => sectionRefs[2].value = el" class="step-section">
          <h2>2. 製造流程</h2>
          <ProcessFlowBlock
            ref="ProcessFlowBlockComponent"
            :blockContent="blocks.processFlow.data[0]"
            :cols="9"
            :documentToken="draftToken"
            :allow-color="isRevisionDoc"
            @update-block="blocks.processFlow = $event"
            @invalid-check="(payload) => updateSingleStepValidation(2, payload)"
          />
        </section>

        <!-- Step 4 -->
        <section :ref="el => sectionRefs[3].value = el" class="step-section">
          <h2>3. 管理條件</h2>
          <div class="management-add">
            <button class="layer-action-btn add" @click="managementTree?.addRoot()">＋ 新增區塊</button>
          </div>
          <!-- 3.1：特製 PMS 區塊（leaf，無子層） -->
          <div class="management-combination-block">
            <ManagementSpecificBlock
              ref="ManagementBlockComponent"
              :step="3"
              :tier="1"
              :blockContent="blocks.managementPms"
              :allow-color="isRevisionDoc"
              @update-block="blocks.managementPms = $event"
              @invalid-check="(payload) => updateDynamicValidation(3, 'management', 'pms', payload)"
            />
          </div>
          <!-- 3.2+：通用樹（indexOffset=1，編號從 3.2 起；新增鈕由上方按鈕代理） -->
          <DynamicEditorTree
            ref="managementTree"
            :nodes="blocks.management"
            :chapter="chapterNumber(0, 1)"
            :index-offset="1"
            :allow-color="isRevisionDoc"
            :show-add="false"
            @invalid-check="(payload) => updateDynamicValidation(3, 'management', 'tree', payload)"
          />
        </section>

        <!-- Step 5 -->
        <section :ref="el => sectionRefs[4].value = el" class="step-section">
          <h2>4. 製造條件參數一覽表</h2>
          <div v-if="form.attribute.isParamNA" style="font-size: 16px; font-weight: bold; text-align: center; padding: 40px; background-color: #f4f9ff; border: 1px dashed #1666C0; border-radius: 8px; color: #1666C0;">
            請依照「3. 管理條件」進行製造參數設定與確認
          </div>

          <ManufacturingConditionRuleBlocks
            v-else
            ref="ManufactureBlockComponent"
            :dataBlocks="blocks.manufacture"
            :spec-options="form.attribute.specifications"
            :allow-color="isRevisionDoc"
            :document-token="draftToken"
            :machine="form.attribute.machines?.[0]"
            @update-block="blocks.manufacture = $event"
            @invalid-check="(payload) => updateSingleStepValidation(4, payload)"
          />
        </section>

        <!-- Step 6 -->
        <section :ref="el => sectionRefs[5].value = el" class="step-section">
          <h2>5. 異常處置</h2>
          <DynamicEditorTree
            :nodes="blocks.exception"
            :chapter="chapterNumber(0, 3)"
            :allow-color="isRevisionDoc"
            @invalid-check="(payload) => updateSingleStepValidation(5, payload)"
          />
        </section>

        <!-- Step 7 -->
        <section :ref="el => sectionRefs[6].value = el" class="step-section">
          <h2>6. 相關文件</h2>
          <div class="relative-document" style="display: flex; justify-content: space-between; align-items: center;">
            <button class="layer-action-btn add" @click="docWindowVisible = 0">新增文件</button>
            <div v-if="isRevisionDoc" class="color-picker-group">
              <span style="font-size: 14px; color: #666; margin-right: 8px;">文字顏色:</span>
              <i class="dot blue" @click="setRefColor('document', 'blue')" title="設為藍色"></i>
              <i class="dot black" @click="setRefColor('document', 'black')" title="設為黑色"></i>
            </div>
          </div>

          <div v-for="(referInfo, refIndex) in references.document" 
                class="document-block" 
                :class="{ 'is-selected': selectedRef.type === 'document' && selectedRef.index === refIndex }"
                @click="selectRef('document', refIndex)"
                :key="referInfo.id || refIndex">
            <div class="doc-info-block" :style="{ color: referInfo.color === 'blue' ? 'blue' : 'black' }">
              <label class="doc-label no" :style="{ borderColor: referInfo.color === 'blue' ? 'blue' : '#ddd' }">6.{{ refIndex + 1 }}</label>
              <label class="doc-label id" :style="{ borderColor: referInfo.color === 'blue' ? 'blue' : '#ddd' }">{{ referInfo.refer_document }}</label>  
              <label class="doc-label name">{{ referInfo.refer_document_name }}</label>
            </div>
            <div class="doc-btn-block">
              <button class="remove-btn" @click.stop="removeDoc('document', refIndex)">x</button>
            </div>
          </div>
          <FormSearchWindow 
            v-if="docWindowVisible == 0"
            headerName="相關文件選取"
            documentType="document"
            @add-new-forms="(payload) => addDocs('document', payload)" 
            @close-window="docWindowVisible = -1">
          </FormSearchWindow>
        </section>

        <!-- Step 8 -->
        <section :ref="el => sectionRefs[7].value = el" class="step-section">
          <h2>7. 使用表單</h2>
          <div class="used-form" style="display: flex; justify-content: space-between; align-items: center;">
            <button class="layer-action-btn add" @click="docWindowVisible = 1">新增表單</button>
            <div v-if="isRevisionDoc" class="color-picker-group">
              <span style="font-size: 14px; color: #666; margin-right: 8px;">文字顏色:</span>
              <i class="dot blue" @click="setRefColor('form', 'blue')" title="設為藍色"></i>
              <i class="dot black" @click="setRefColor('form', 'black')" title="設為黑色"></i>
            </div>
          </div>

          <div v-for="(referInfo, refIndex) in references.form" 
               class="form-block" 
               :class="{ 'is-selected': selectedRef.type === 'form' && selectedRef.index === refIndex }"
               @click="selectRef('form', refIndex)"
               :key="referInfo.id || refIndex">
            <div class="form-info-block" :style="{ color: referInfo.color === 'blue' ? 'blue' : 'black' }">
              <label class="form-label no" :style="{ borderColor: referInfo.color === 'blue' ? 'blue' : '#ddd' }">7.{{ refIndex + 1 }}</label>
              <label class="form-label id">{{ referInfo.refer_document }}</label>
              <label class="form-label name" :style="{ borderColor: referInfo.color === 'blue' ? 'blue' : '#ddd' }">{{ referInfo.refer_document_name }}</label>
            </div>
            <div class="form-btn-block">
              <button class="remove-btn" @click.stop="removeDoc('form', refIndex)">x</button>
            </div>
          </div>
          <FormSearchWindow 
            v-if="docWindowVisible == 1"
            headerName="表單選取"
            documentType="form"
            @add-new-forms="(payload) => addDocs('form', payload)" 
            @close-window="docWindowVisible = -1">
          </FormSearchWindow>
        </section>
      </div>

      <!-- 輸出頁：Step 9 獨立畫面 -->
      <div v-else class="output-page">
        <div style="display: flex; justify-content: space-between; align-items:center;">
          <h2>文件產出</h2>
          <div style="display:flex; gap:.5rem;">
            <button @click="DownloadDocx" :disabled="downloadLoading" class="layer-action-btn add">{{ downloadLoading ? '產生中…' : '產生文件（Word）' }}</button>
          </div>
        </div>

        <p v-if="errorMsg" style="color:#c00; margin:.5rem 0;">{{ errorMsg }}</p>

        <div class="docx-viewer" style="margin-top: 1rem;">
          <div v-if="previewLoading">預覽產生中…</div>
          <WordPreview v-else-if="docxSrc" :file-url="docxSrc" />
          <small v-else style="color:#666;">尚未產生預覽。</small>
        </div>
      </div>
    </div>
  </div>
  <div class="floating-tools">
    <button class="tool-btn" @click="$router.push('/home')" title="回首頁">⌂</button>
    <button class="tool-btn" @click="scrollToTop" title="回到最上層">↑</button>
    <button class="tool-btn" @click="saveDraft" :disabled="isSaving" title="儲存草稿">💾</button>
  </div>

</template>

<script setup>
defineOptions({ name: 'new-instruction' });

import axios from 'axios'
import { ref, reactive, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'

import MachinesListWindow from '@/components/MachinesListWindow.vue'
import ProcessFlowBlock from '@/components/ProcessFlowBlock_.vue'
import ManagementSpecificBlock from '@/components/ManagementSpecificBlock_.vue'
import DynamicEditorTree from '@/components/DynamicEditorTree.vue'
import ManufacturingConditionRuleBlocks from '@/components/ManufacturingConditionRuleBlocks_.vue'
import FormSearchWindow from '@/components/FormSearchWindow_.vue'
import WordPreview from '@/components/WordPreview.vue'
import InlineColorEditor from '@/components/InlineColorEditor.vue';
import { useDraftToken } from '@/composables/useDraftToken'
import { registerDraftTab, unregisterDraftTab } from '@/composables/draftTabRegistry'
import { initDoc, saveInstruction, loadInstruction, getPmsAndParams, getMachineMatchInfo, fetchInstructionLatestDocVersion } from '@/api/docsApi'
import { parseCondTemplate, parseParamTemplate, parseParamTable } from '@/utils/tiptapTableUtils'
import { pmsTemplateDiffCheck, paramTemplateDiffCheck, condTemplateDiffCheck } from '@/utils/pmsDiffUtils'
// P2：樹狀區塊
import { ensureTree, toPayloadTree, nodeFromBlockData, blockDataFromNode } from '@/utils/blockTree.js'
import { paramBlockToNode, nodeToMcrBlock } from '@/utils/paramNode.js'
import { chapterNumber } from '@/utils/blockNumbering.js'
import { richOrPlain } from '@/utils/richText.js'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const route = useRoute();
const mode = computed(() => route.query.mode || 'new')
const revise = computed(() => form.previous_document_token != "");
const currentToken = computed(() => route.query.token || '');
const storageKey = computed(() => { return (mode.value == 'new') ? 'rms:draft:new-instruction' : `rms:draft:${currentToken.value}`; });
const isRevisionDoc = computed(() => form.document_version > 1);

const { token: draftToken, setToken, clearToken } = useDraftToken(storageKey.value);

const ensureDraftToken = async () => {
  if (route.query.token) { setToken(draftToken.value, { updateUrl: true }); return; }
  try {
    const res = await initDoc(0);
    if (res?.success && res.token) { setToken(res.token, { updateUrl: true }); return; }
    throw new Error(res?.message || 'init failed');
  } catch (e) { console.error('docs/init failed:', e); alert('建立草稿代碼失敗，請稍後再試'); }
}

// ==========================================
// 1. Main Data
// ==========================================
const form = reactive({
  document_type: 0,
  document_id: '',
  document_name: '',
  document_version: 1.0,
  attribute: { applyProject: '', machines: [], specifications: [], inputMachines: '', scopeUnits: "", isParamNA: true },
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
// P2：processFlow / managementPms / manufacture 為特製單塊或陣列（元件驅動）；management / exception 為通用樹 forest
const blocks = reactive({ processFlow: null, managementPms: null, management: [], manufacture: [], exception: [] });
const references = reactive({ document: [], form: [] });

// 主表欄位的 tiptap 樣式 JSON（與 form 的純文字並存；舊文件沒有 JSON 時用純文字 fallback）
const formJson = reactive({ document_name: null, applyProject: null, purpose: null });

let uuid = 0;
const createBlock = (step_type, content_type = 0, amount = 1) => ({ id: uuid++, step_type, tier_no: 1, data: Array.from({ length: amount }, () => createBlockData(content_type)) })
const createBlockData = (content_type) => ({ content_type, header_text: null, header_json: null, content_text: null, content_json: null, table_text: null, table_json: null, files: [], metadata: {} })

const refer_type_mapping_table = { document: 0, form: 1 };
const createReference = (refer_type_name, payload) => ({ id: uuid++, refer_type: refer_type_mapping_table[refer_type_name], ...payload });

const resetAll = () => {
  Object.assign(form, {
    document_type: 0,
    document_id: '',
    document_name: '',
    document_version: 1.0,
    attribute: { applyProject: '', machines: [], specifications: [], inputMachines: '', scopeUnits: "", isParamNA: true },
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

  Object.assign(blocks, {
    processFlow: createBlock(0, 2),
    managementPms: createBlockData(2), // 3.1 PMS 單塊
    management: [],                    // 3.2+ 通用樹
    manufacture: [],
    exception: [],
  });

  Object.assign(references, { document: [], form: [] });
  Object.assign(formJson, { document_name: null, applyProject: null, purpose: null });
}

// ==========================================
// 2. Step Navigation Function
// ==========================================
const sectionRefs = Array.from({ length: 8 }, () => ref(null));
const currentStep = ref(1);
const navCollapsed = ref(false);
const steps = [
  { label: '基本屬性', status: false },
  { label: '目的', status: false },
  { label: '製造流程', status: false },
  { label: '管理條件', status: false },
  { label: '製造條件參數一覽表', status: false },
  { label: '異常處置', status: false },
  { label: '相關文件', status: false },
  { label: '使用表單', status: false },
  { label: '文件產出' },
];
const scrollToTop = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); }
const scrollToStep = (index) => {
  currentStep.value = index;
  if (index >= 1 && index <= 8) {  // Step 1 ~ 8：一頁式捲動
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
  if (index === 9) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchDocx();
  }
}
// const stepStatusClass = (index) => { return 'step-ok'; }
const handleScroll = () => {
  const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

  // 1) 控制縮小 / 放大
  navCollapsed.value = scrollY > 120;

  // 2) 根據捲動位置，讓 step-navigation 自動切換 active 章節 - 只在 Step 1~8 的一頁式畫面才做；Step 9（輸出頁）不需要跟著跑
  if (currentStep.value === 9) return;

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
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex = idx;
    }
  })

  // index 0 -> Step 1, index 1 -> Step 2, ...
  currentStep.value = closestIndex + 1
}

// ==========================================
// 2.1 Step validation Function
// ==========================================
const stepValidations = reactive({
  0: { isValid: false, title: '基本屬性', message: [] },       // step 0: 基本屬性 (手動算)
  1: { isValid: false, title: '目的', message: [] },           // step 1: 目的 (手動算)
  2: { isValid: false, title: '製造流程', message: [] },       // step 2: ProcessFlowBlock
  3: { isValid: false, title: '管理條件', message: [] },       // step 3: ManagementSpecificBlock + 多個 DynamicEditor
  4: { isValid: false, title: '製造參數一覽表', message: [] }, // step 4: ManufacturingConditionRuleBlocks
  5: { isValid: false, title: '異常處置', message: [] },       // step 5: 多個 DynamicEditor
  6: { isValid: true, title: '相關文件', message: [] },       // step 6: (非必填，預設 true)
  7: { isValid: true, title: '使用表單', message: [] },       // step 7: (非必填，預設 true)
});

watch(() => form, (newForm) => {
    // --- Step 0 檢查 ---
    const s0 = stepValidations[0];
    s0.message = [];
    
    const requireFields = [newForm.document_name, newForm.document_version, newForm.attribute.applyProject, newForm.attribute.inputMachines, newForm.department, newForm.author, newForm.confirmer, newForm.approver];
    const machineCheck = (Array.isArray(newForm.attribute.machines) && newForm.attribute.machines.length > 0 && !machine_tags.value.some(tag => tag.isValid == false));

    console.log(" -- revise.value: ", revise.value);

    if (!machineCheck) s0.message.push('適用機台未選擇或包含無效機台');
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
  console.log(" -- updateSingleStepValidation: ", stepNo, payload);
  stepValidations[stepNo].isValid = payload.isValid;
  stepValidations[stepNo].message = payload.message || [];
};

// Temporary object status for management block and exception block (storage format: { blkId: { isValid, message } })
const dynamicValidations = reactive({ management: {}, exception: {} });
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
  console.log(" -- stepValidations: ", stepValidations);
};
// Step status process and display
const stepStatusClass = (stepNo) => {
  if (stepNo >= currentStep.value) return '';  // skip subsequent step

  if (stepNo == 3 && blocks.management.length == 0 && !blocks.managementPms?.table_json) return '';
  else if (stepNo == 4 && form.attribute.isParamNA) return '';
  else if (stepNo == 5 && blocks.exception.length == 0) return '';
  else if (stepNo == 6) return references.document.length > 0 ? 'step-ok' : '';
  else if (stepNo == 7) return references.form.length > 0 ? 'step-ok' : '';
  else if (stepValidations[stepNo]) return stepValidations[stepNo].isValid ? 'step-ok' : 'step-error';
  return 'step-ok'; // 預設值
}

// ==========================================
// 3. Fundamental-Attribute Function
// ==========================================
const machinesListVisible = ref(false);
const projectList = ref([]);
const machine_tags = ref([]);
async function applyProjectChange() {
  Object.assign(form.attribute, { machines: [], specifications: [], inputMachines: "", scopeUnits: "" });   // Reset form information
  await setParamNA(true);
  machine_tags.value = [];

  ProcessFlowBlockComponent.value.buildTableEditor(null);
  ManagementBlockComponent.value.initFromProps(null);
  if (ManufactureBlockComponent.value) await ManufactureBlockComponent.value.initTemplateFromProps(null, null);
  await nextTick();
}
const getMachines = async (payload) => {
  const machines = payload?.selected || [];

  form.attribute.machines = machines.map(machine => machine.code);
  form.attribute.inputMachines = machines.map(m => m.name).join(',');
  form.attribute.specifications = [...new Map(machines.flatMap(machine => machine.specifications).map(({ code, name }) => [code, name]))].map(([code, name]) => ({ code, name }));
  machine_tags.value = machines.map(machineInfo => ({ id: machineInfo.code, name: machineInfo.name, isValid: true }));

  if (form.attribute.machines.length > 0) { processPMSData(form.attribute.machines[0]); }
  else { ManagementBlockComponent.value.initFromProps(); }

  if (mode.value != 'revise') {
    const res = await fetchInstructionLatestDocVersion(form.attribute.applyProject, form.attribute.machines);
    form.document_id = (res.document_version || 1.0) == 1 ? "" : res.document_id;
    form.document_version = res.document_version || 1.0;
  }
  // ★ 根據所選機台自動更新文件名稱
  form.document_name = updateDocumentNameByMachines(machines || []);
}
const removeMachineTag = (machine_code) => {
  const finalMachineMatchCheck = machine_code == form.attribute.machines[0];

  machine_tags.value = machine_tags.value.filter(machineInfo => machineInfo.id != machine_code);
  form.attribute.inputMachines = machine_tags.value.map(machineInfo => machineInfo.name).join(",");
  form.attribute.machines = machine_tags.value.map(machineInfo => machineInfo.id);
  
  if (finalMachineMatchCheck && form.attribute.machines.length > 0) {
    if (!machine_tags.value[0].isValid) { processPMSData(form.attribute.machines[0]); }
    machinesMatchCheck(false);
  }
}
const machinesMatchCheck = async (notification = true) => {
  if (!form.attribute.machines || form.attribute.machines.length == 0) return;

  // Request the machines which have the same parameters and condition
  const matchInfo = await getMachineMatchInfo(form.attribute.applyProject, form.attribute.machines[0]);
  if (!matchInfo) return;

  const matchMachines = new Set();
  Object.values(matchInfo.groups).forEach(groupInfo => Object.keys(groupInfo.machines).forEach(machineCode => matchMachines.add(machineCode)));

  // Match machine parameters and condition
  machine_tags.value.forEach(tagInfo => tagInfo.isValid = matchMachines.has(tagInfo.id) ? true : false);
  if (notification && machine_tags.value.some(tag => tag.isValid == false)) alert("機台參數已更動請更新適用機台");
}
const processPMSData = async (machine_code) => {
  const { pfTemplate, pmsTemplate, condTemplate, paramTemplate } = await getPmsAndParams(machine_code);
  console.log("pfTemplate: ", pfTemplate); console.log("pmsTemplate: ", pmsTemplate); console.log("condTemplate: ", condTemplate); console.log("paramTemplate: ", paramTemplate);
  ProcessFlowBlockComponent.value.buildTableEditor(pfTemplate.slots);
  ManagementBlockComponent.value.initFromProps(pmsTemplate.table_rows.length == 0 ? null : pmsTemplate.table_rows);
  await setParamNA(condTemplate.length == 0 && paramTemplate.table_rows.length == 0);
  await ManufactureBlockComponent.value?.initTemplateFromProps(condTemplate.length == 0 ? null : condTemplate, paramTemplate.table_rows.length == 0 ? null : paramTemplate.table_rows);
}
const setParamNA = async (paramNA) => { form.attribute.isParamNA = paramNA; await nextTick(); if (paramNA) { blocks.manufacture = []; } }

function compressNumbers(nums) {
  if (!nums?.length) return [];
  // 轉為唯一值並強制轉數字排序
  const sorted = [...new Set(nums)].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  
  const res = [];
  let start = sorted[0], prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    // 若連續則推進，否則結算當前區間
    if (i < sorted.length && parseInt(sorted[i], 10) === parseInt(prev, 10) + 1) {
      prev = sorted[i];
    } else {
      res.push(start === prev ? start : `${start}~${prev}`);
      start = prev = sorted[i];
    }
  }
  return res;
}
function updateDocumentNameByMachines(machines) {
  if (!machines?.length) return "";

  // [步驟 A]：極簡化提取棟別 (ex: "K#4F" -> "K#")
  const buildings = [...new Set(machines.map(m => (m.building || '').split('#')[0] + '#'))]
    .filter(b => b !== '#').sort().join(''); 

  // [步驟 B]：解析名稱並建立 Map 樹：BaseName -> Num -> Set(Suffix)
  const baseMap = new Map(); 

  machines.forEach(m => {
    const cleanName = (m.name || '').replace(/^\s*\([^)]*\)\s*/, '').trim();
    // ★ 修復核心：使用 [^-]+ 匹配所有非減號字元，完美捕捉全形 Ａ、Ｂ
    const [, base, num = '', sfx = ''] = cleanName.match(/^(.*?)(?:-(\d+)(?:-([^-]+))?)?$/) || [];
    
    if (!baseMap.has(base)) baseMap.set(base, new Map());
    if (!baseMap.get(base).has(num)) baseMap.get(base).set(num, new Set());
    if (sfx) baseMap.get(base).get(num).add(sfx);
  });

  // [步驟 C]：處理分組與合併
  const machineNames = Array.from(baseMap.entries()).map(([base, numMap]) => {
    const mergedNums = [], partialMap = new Map();
    let hasEmptyNum = false;

    // 1. 分流：需合併 (size > 1) 與 不需合併
    for (const [num, sfxSet] of numMap.entries()) {
      if (!num) hasEmptyNum = true;
      else if (sfxSet.size > 1) mergedNums.push(num); // 滿編合併 (ex: 03-A, 03-B -> 03)
      else {
        const sfx = [...sfxSet][0] || '';
        if (!partialMap.has(sfx)) partialMap.set(sfx, []);
        partialMap.get(sfx).push(num);
      }
    }

    // 2. 執行壓縮並組合字串
    const parts = mergedNums.length ? compressNumbers(mergedNums) : [];
    for (const [sfx, nums] of partialMap.entries()) {
      parts.push(...compressNumbers(nums).map(r => sfx ? `${r}-${sfx}` : r));
    }

    // 3. 依照「首個數字」進行自然排序
    parts.sort((a, b) => parseInt((a.match(/\d+/) || [0])[0], 10) - parseInt((b.match(/\d+/) || [0])[0], 10));

    const tail = parts.join('、');
    return (hasEmptyNum && tail) ? `${base}、${base}-${tail}` : tail ? `${base}-${tail}` : base;
  }).sort().join('、');

  // [步驟 D]：輸出最終結果
  return `${buildings}_${machineNames}_製造條件指示書`;
}

// ==========================================
// 4. Blocks Function
// ==========================================
const ProcessFlowBlockComponent = ref(null);
const ManagementBlockComponent = ref(null);
const ManufactureBlockComponent = ref(null);
const managementTree = ref(null); // 管理條件 3.2+ 通用樹（新增鈕在 3.1 上方代理 addRoot）

const managementEditorRefs = reactive({});
const exceptionEditorRefs = reactive({});
const setManagementEditorRef = (id, el) => { if (el) managementEditorRefs[id] = el; }
const setExceptionEditorRef = (id, el) => { if (el) exceptionEditorRefs[id] = el; }

const addDynamicBlock = (step_name, step_type) => { 
  blocks[step_name].push(createBlock(step_type, 0));
  blocks[step_name].forEach((blk, blkIndex) => { blk.tier_no = blkIndex + 1; }); 
}
const removeDynamicBlock = (step_name, index) => {
  // Get corresponding step index for step name
  const stepNo = step_name === 'management' ? 3 : 5;
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

// ==========================================
// 5. Docs Function (format: { document: [{ refer_type, refer_document, refer_document_name }, ...], form: [...] })
// ==========================================
const docWindowVisible = ref(-1);
const selectedRef = reactive({ type: null, index: -1 });
const selectRef = (type, index) => Object.assign(selectedRef, { type: type, index: index });
const setRefColor = (type, color) => {
  if (selectedRef.type === type && selectedRef.index !== -1) { references[type][selectedRef.index].color = color; }
  else { alert('請先點擊選取要更改顏色的列'); }
};

const addDocs = (refer_type_name, payload) => {
  console.log("refer_type_name: ", refer_type_name, ", payload: ", payload);

  const defaultColor = mode.value == 'revise' ? 'blue' : 'black';
  payload.forEach(doc => {
    if (!references[refer_type_name].some(r => r.refer_document === doc.refer_document)) {
      references[refer_type_name].push({...createReference(refer_type_name, doc), color: defaultColor});
    }
  })
  docWindowVisible.value = -1;
}
const removeDoc = (refer_type_name, index) => { 
  references[refer_type_name].splice(index, 1);
  if (selectedRef.type === refer_type_name && selectedRef.index === index) { Object.assign(selectedRef, { type: null, index: -1 }); }
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
    // 主表欄位的 tiptap 樣式 JSON，獨立成一個 key（內容都進另一張表）；key 名稱對齊主表欄位，load 時可同名查詢
    // form_attribute 永遠送 tiptap doc（無樣式 JSON 時用純文字補成 doc），後端單一渲染路徑、零 fallback
    form_attribute: {
      document_name: richOrPlain(formJson.document_name, form.document_name),
      applyProject:  richOrPlain(formJson.applyProject,  form.attribute.applyProject),
      purpose:       richOrPlain(formJson.purpose,       form.purpose),
    },
    // P2：整包巢狀樹（§7.1）。step0 ProcessFlow / step1 首節點=3.1 PMS / step2 參數+條件包成 ct=4 / step3 通用樹
    tree: [
      { step_type: 0, children: toPayloadTree([nodeFromBlockData(blocks.processFlow?.data?.[0] || {})]) },
      { step_type: 1, children: toPayloadTree([nodeFromBlockData(blocks.managementPms || {}), ...blocks.management]) },
      { step_type: 2, children: toPayloadTree(blocks.manufacture.map((b) => paramBlockToNode(b, { conditionTable: b.data?.[1]?.table_json ?? null }))) },
      { step_type: 3, children: toPayloadTree(blocks.exception) },
    ],
    reference: [...references.document.map(r => ({ ...r, refer_type: 0 })), ...references.form.map(r => ({ ...r, refer_type: 1 }))]
  }
}

const previewLoading = ref(false);
const errorMsg = ref("");
const docxSrc = ref(null);
async function fetchDocx() {
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

// 檢查所有 step 是否通過驗證 (與 stepStatusClass 邏輯一致：空白/N/A 的選填區塊不卡控)
const collectInvalidSteps = () => {
  const invalid = [];
  for (const [key, stepInfo] of Object.entries(stepValidations)) {
    const n = Number(key);
    // Skip optional / not-applicable steps
    if (n === 3 && blocks.management.length === 0 && !blocks.managementPms?.table_json) continue;
    if (n === 4 && form.attribute.isParamNA) continue;
    if (n === 5 && blocks.exception.length === 0) continue;
    if (n === 6 || n === 7) continue;  // 相關文件、使用表單為選填

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
    const payload = buildDocxPayload();
    const success = await saveDraft();
    if (!success) return;

    const res = await axios.post(`${API_BASE_URL}/docs/generate/word_`, payload, { responseType: 'blob' });
    if (res.headers['x-document-id']) form.document_id = res.headers['x-document-id'];

    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);

    const versionStr = Number(form.document_version ?? 1).toFixed(1);
    a.download = `${form.document_name || 'document'}${versionStr}.docx`;

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
const saveDraft = async () => {
  isSaving.value = true;
  try {
    const payload = buildDocxPayload();
    console.log("save draft: ", payload);
    const result = await saveInstruction(payload);

    if (!result.success) { alert(result?.message || '儲存草稿失敗'); return false; }

    alert(`草稿已儲存(時間：${result.issueTime || ''})`);
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
    console.log("request load instruction...");
    const result = await loadInstruction(draftToken.value, sessionStorage.getItem('loggedInUserNo'));
    if (!result) {
      alert(result?.message || '讀取草稿失敗');
      return;
    }

    // Get login information
    form.department = sessionStorage.getItem('loggedInUserdeptName');
    form.author_id = sessionStorage.getItem('loggedInUserNo');
    form.author = sessionStorage.getItem('loggedInUserName');

    // Get projects list and document information
    console.log("result: ", result);
    projectList.value = result.projects || [];
    let oldPmsTable = null, oldParamTable = null, oldCondTable = null;
    if (result.form){  // Load data
      Object.assign(form, { ...result.form, department: form.department, author_id: form.author_id, author: form.author });

      // 主表欄位的 tiptap 樣式 JSON，從獨立的 form_attribute 同名讀取；舊文件查不到時維持 null，InlineColorEditor 會用純文字 fallback
      formJson.document_name = result.form_attribute?.document_name ?? null;
      formJson.applyProject  = result.form_attribute?.applyProject  ?? null;
      formJson.purpose       = result.form_attribute?.purpose       ?? null;

      // P2：載入巢狀樹
      const pfForest = forestFromResult(result, 'processFlow', 0);
      if (pfForest.length) blocks.processFlow = { step_type: 0, tier_no: 1, data: [blockDataFromNode(pfForest[0])] };
      const mgmtForest = forestFromResult(result, 'management', 1);
      if (mgmtForest.length) {
        blocks.managementPms = blockDataFromNode(mgmtForest[0]); // 首節點 = 3.1 PMS
        blocks.management.splice(0, blocks.management.length, ...mgmtForest.slice(1)); // 其餘 = 3.2+ 通用樹
      }
      blocks.manufacture = forestFromResult(result, 'manufacture', 2).map((n, i) => nodeToMcrBlock(n, i));
      blocks.exception.splice(0, blocks.exception.length, ...forestFromResult(result, 'exception', 3));
      Object.assign(references, { ...result.references });

      if (form.attribute?.inputMachines?.length > 0) machine_tags.value = form.attribute.inputMachines.split(",").map(machineInfo => ({ id: machineInfo.trim().slice(1, 7), name: machineInfo, isValid: true }));
      await machinesMatchCheck();
      await nextTick();

      // Parse data format through reverse tiptap table
      oldPmsTable = blocks.managementPms?.table_text;
      oldParamTable = blocks.manufacture.map(blk => parseParamTable(blk.data[0].table_json));
      oldCondTable = blocks.manufacture.map(blk => parseCondTemplate(blk.data[1].table_json));

      // Update data block in management and andmanufacture step
      await setParamNA(!oldCondTable?.[0]?.condTemplate && !parseParamTemplate(blocks.manufacture?.[0]?.data[0]?.table_json));
      ProcessFlowBlockComponent.value.loadBlockContent(blocks.processFlow.data[0]);
      ManagementBlockComponent.value.initFromProps(blocks.managementPms);
      ManufactureBlockComponent.value?.assignTemplateFromProps(oldCondTable?.[0]?.condTemplate || null, parseParamTemplate(blocks?.manufacture[0]?.data[0]?.table_json) || null);
      ManufactureBlockComponent.value?.loadTableFromProps(blocks.manufacture);
    }

    // Get latest update information
    if (form.attribute.machines && form.attribute.machines.length > 0) {
      const { pfTemplate, pmsTemplate, condTemplate, paramTemplate } = await getPmsAndParams(form.attribute.machines[0]);
      if (!pfTemplate && !pmsTemplate && !condTemplate && !paramTemplate) return;
      await setParamNA(condTemplate.length == 0 && paramTemplate.table_rows.length == 0);

      // Check difference between news and olds
      const pmsResult = pmsTemplateDiffCheck(oldPmsTable, pmsTemplate.table_rows);
      const paramResult = paramTemplateDiffCheck(oldParamTable, paramTemplate.table_rows);
      const condResult = condTemplateDiffCheck(oldCondTable, condTemplate);

      // Combine message and output
      const allNotifications = [
        ...(pmsResult.messages.length ? ['【管理項目 (PMS) 異動】', ...pmsResult.messages, ''] : []),
        ...(condResult.messages.length ? ['【製造條件 異動】', ...condResult.messages] : []),
        ...(paramResult.messages.length ? ['【參數下放 異動】', ...paramResult.messages, ''] : []),
      ];
      if (allNotifications.length > 0) alert(`系統偵測到機台參數有更新：\n\n${allNotifications.join('\n')}\n\n已為您保留原填寫資料。`);

      // refresh data to news template with data
      await setParamNA(condTemplate.length == 0 && paramTemplate.table_rows.length == 0);
      if (condResult.messages.length > 0 && paramResult.messages.length > 0) ManufactureBlockComponent.value.assignTemplateFromProps(condTemplate, paramTemplate.table_rows);
      if (paramResult.messages.length) ManufactureBlockComponent.value.loadUpdateParamTableFromProps(paramResult.mergedTables);
      if (condResult.messages.length) ManufactureBlockComponent.value.loadUpdateCondTableFromProps(condTemplate, condResult.mergedValues);
    }
  } catch (e) {
    console.error(e);
    alert('載入草稿失敗');
  } finally {
    isloading.value = false;
  }
}

resetAll();
onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true });
  await ensureDraftToken();
  applyLoadedData();
});

// 以 document token 註冊到頁簽 registry：App.vue 點頁簽 ✕ 當下即可詢問並儲存此份草稿。
// （keep-alive 下同名頁簽會延後 unmount，故詢問不靠 onBeforeUnmount，改在 closeTab 即時觸發。）
watch(draftToken, (newTok, oldTok) => {
  if (oldTok && oldTok !== newTok) unregisterDraftTab(oldTok);
  if (newTok) registerDraftTab(newTok, { save: () => saveDraft(), label: '製造條件指示書' });
}, { immediate: true });

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll);
  unregisterDraftTab(draftToken.value);
});
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
  justify-content: space-between;
  border-bottom: 1px solid #eee;
  transition: all 0.2s ease;
}
.steps-navigation.collapsed { padding: 6px 12px; transform: translateY(-4px); box-shadow: 0 2px 6px rgba(0,0,0,0.05); }
.step-item { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 8px; border-radius: 999px; transition: background 0.15s, transform 0.15s; }
.steps-navigation.collapsed .step-item { transform: scale(0.92); }
.step-item.active { background: #1f6feb; color: #fff; }
.step-circle { width: 24px; height: 24px; border-radius: 999px; display:flex; align-items:center; justify-content:center; font-size: 13px; background: rgba(0,0,0,0.05); }
.step-item.active .step-circle { background: rgba(255,255,255,0.2); }
.step-label { font-size: 16px; }
.steps-navigation.collapsed .step-circle { width: 20px; height: 20px; font-size: 14px; }
.steps-navigation.collapsed .step-label { font-size: 13px; }
.step-item.step-error { background-color: #ffe5e5; border-color: #e74c3c; color: #000000; }
.step-item.step-ok { background-color: #e6f9e8; border-color: #27ae60; color: #000000; }
.step-section h2 { font-size: 22px; color: #333; margin-top: 40px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #007bff; display: inline-block; }

.fundamental-attribute-block { display: flex; border: unset; padding: 0px; }
.fundamental-attribute-block .attribute { display: flex; flex-direction: column; width: 100%; min-width: 0; }
.fundamental-attribute-block .supplement { display: flex; flex-direction: column; width: 100%; min-width: 0; }
.form-group { display: flex; flex-direction: row; align-items: center; margin-bottom: 8px; padding: 8px; }
.form-group label { width: 20%; font-size: 15px; color: #555; margin-bottom: 8px; font-weight: bold; }
.form-group input, .form-group textarea, .form-group select { width: 70%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 15px; box-sizing: border-box; transition: border-color 0.2s ease; }
.form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: #008bff; outline: none; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);}
.form-group textarea { resize: vertical; min-height: 80px; }
.form-group input[readonly] { background-color: #e9ecef; color: #495057; cursor: not-allowed; }
.form-group input.input-machine { background: white; cursor: pointer; }
/* 讓 InlineColorEditor 的整體寬度與一般 input 對齊（label 20% + 欄位 70%） */
.form-group :deep(.inline-color-editor) { width: 70%; }

.machine-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; flex: 1 1 0; min-width: 0; }
.machine-tag { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; background: #eef4ff; border: 1px solid #c3d3ff; font-size: 12px; }
.tag-name { font-weight: 600; color: #1a3d8f; }
.tag-remove { border: none; background: transparent; cursor: pointer; font-size: 12px; line-height: 1; color: #888; }
.tag-remove:hover { color: #c62828; }
/* 新增樣式：不一致的機台顯示紅色 */
.machine-tag.invalid { background-color: #ffe5e5; border-color: #ff4d4f; color: #ff4d4f; }
.machine-tag.invalid .tag-name { color: #d9363e; }

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
.doc-label.id { display: inline-block; width: 15vh; border-right: 1px solid #ddd; }
.doc-btn-block { display: flex; align-items: center;}

.form-block { display: flex; justify-content: space-between; padding: 10px; margin: 10px 10px; border: 1px solid #ddd; }
.form-label { padding: 8px 10px; }
.form-label.no { border-right: 1px solid #ddd; }
.form-label.id { display: inline-block; width: 20vh; border-right: 1px solid #ddd; }
.form-btn-block { display: flex; align-items: center;}
.remove-btn { background: none; border: none; color: red; font-weight: bold; cursor: pointer; font-size: 1.2em; }

.document-block, .form-block { cursor: pointer; transition: all 0.2s ease; border-radius: 4px; }
.document-block.is-selected, .form-block.is-selected { outline: 2px solid #2196f3; background-color: #f4f9ff; border-color: #2196f3; }
.color-picker-group { display: flex; align-items: center; background: #f8f9fa; padding: 4px 12px; border-radius: 20px; border: 1px solid #eee; }
.dot { display: inline-block; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); cursor: pointer; margin-left: 6px; }
.blue { background: #0000ff; }
.black { background: #000000; }

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