<template>
  <div class="Porject-Specification-container">
    <!-- 控制列 -->
    <div class="top-control">
      <div class="input-action-layout">
        <p>關鍵字：</p>
        <input v-model="keyword" type="text" placeholder="搜尋適用工程/製程關鍵字" class="border rounded px-3 py-2 w-80" @input="onKeywordInput"/>
        <button class="btn-search" @click="onKeywordInput()">搜尋</button>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- 左表：工程清單 -->
      <div class="table-wrapper">
        <div class="info-block">
          <h3 class="title-label">適用工程</h3>
          <div class="info-label">共 {{ total }} 筆</div>
        </div>
        <table class="project-table">
          <thead>
            <tr>
              <th>項次</th>
              <th>工程代碼</th>
              <th>適用工程</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in list" :key="row.id" :class="[ 'cursor-pointer', activeId===row.id ? 'bg-blue-50' : '' ]" @click="selectRow(row)">
              <td>{{ (page-1)*pageSize + idx + 1 }}</td>
              <td>{{ row.projectCode.slice(0, 3) }}</td>
              <td>{{ row.projectName.slice(3) }}</td>
              <td><button class="btn edit" @click.stop="openAddSpecsDialog(row)">編輯</button></td>
            </tr>
            <tr v-if="!loading && list.length===0">
              <td colspan="4">無資料</td>
            </tr>
            <tr v-if="loading">
              <td colspan="4">讀取中…</td>
            </tr>
          </tbody>
        </table>
        <div class="header-control">
          <button :disabled="page===1" class="btn next" @click="changePage(page-1)">上一頁</button>
          <span class="page-info">{{ page }} / {{ totalPages }}</span>
          <button :disabled="page===totalPages" class="btn last" @click="changePage(page+1)">下一頁</button>
        </div>
      </div>

      <!-- 右表：該工程的製程清單 -->
      <div class="table-wrapper">
        <div class="info-block">
          <h3 class="title-label">所屬製程</h3>
          <div class="info-label" v-if="activeRow">工程：{{ activeRow.projectName }}（{{ activeRow.projectCode }}）</div>
        </div>
        <table class="specification-table">
          <thead>
            <tr>
              <th>製程代碼</th>
              <th>製程</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in processes" :key="p.id">
              <td>{{ p.specCode }}</td>
              <td>{{ p.specName }}</td>
              <td><button class="btn delete" @click="removeProcess(p)">移除</button></td>
            </tr>
            <tr v-if="activeId && !loadingRight && processes.length===0">
              <td colspan="3">此工程目前無製程</td>
            </tr>
            <tr v-if="loadingRight">
              <td colspan="3">讀取中…</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增 Dialog -->
    <ProjectSpecificationWindow
      v-if="showAdd"
      :visible="showAdd"
      :initial="addDialogProject"
      @close="showAdd=false"
      @saved="onAdded"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getEngineeringList, getEngineeringProcesses, deleteProcessFromEngineering } from '@/services/applicableProcess'
import ProjectSpecificationWindow from '@/components/ProjectSpecificationWindow.vue'

const keyword = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const list = ref([]);
const loading = ref(false);

const activeId = ref(null);
const activeRow = ref(null);
const processes = ref([]);
const loadingRight = ref(false);

const showAdd = ref(false);
const addDialogProject = ref(null); // pass project info to dialog

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

function openAddSpecsDialog(row) {
  const r = row || activeRow.value;
  if (!r) return;
  // 工程類別 = 工程代碼 + 適用工程（顯示用，唯讀）
  const displayLabel = `${r.projectName}(${r.projectCode})`;
  addDialogProject.value = {
    projectCode: r.projectCode,
    projectName: r.projectName,
    displayLabel
  }
  showAdd.value = true;
}


async function onAdded() {
  showAdd.value = false;
  if (activeRow.value) await selectRow(activeRow.value); // refresh right table
}

async function removeProcess(p) {
  if (!activeId.value) return;
  if (!confirm(`確定將製程「${p.specName}」從工程中移除？`)) return;
  await deleteProcessFromEngineering(activeId.value, p.id);
  await selectRow(activeRow.value);
}


let debounceTimer = null
function onKeywordInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    page.value = 1;
    load();
  }, 300)
}

async function load() {
  loading.value = true;
  try {
    const { items, total: t } = await getEngineeringList({ keyword: keyword.value, page: page.value, pageSize: pageSize.value });
    list.value = items || [];
    total.value = t || 0;
    if (activeId.value && !list.value.some(x => x.id === activeId.value)) {
      activeId.value = null;
      activeRow.value = null;
      processes.value = [];
    }
  } finally {
    loading.value = false;
  }
}

function changePage(p) {
  if (p < 1 || p > totalPages.value) return;
  page.value = p;
  load();
}

async function selectRow(row) {
  activeId.value = row.id;
  activeRow.value = row;
  loadingRight.value = true;
  try { processes.value = await getEngineeringProcesses(row.id, keyword.value); }
  finally {loadingRight.value = false; }
}

// init
load()
</script>

<style scoped>
.Porject-Specification-container { width: 90%; margin: 30px auto; padding: 25px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
.top-control { display: flex; justify-content: space-between; margin-bottom: 20px; text-align: right; align-items: center; }
.top-control input { padding: 4px; font-size: 15px; border-radius: 4px; margin-right: 12px; }
.top-control p { margin: 0; }

.input-action-layout { display: flex; }
.btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; }
.btn.add-project { background-color: #4CAF50; color: white; }

.content-wrapper { display: flex; }
.table-wrapper { margin-right: 8px; width: 100%; max-height: 600px; overflow-y: auto; }
.info-block { display: flex; padding: 4px; justify-content: space-between; align-items: center; }
.header-control { display: flex; justify-content: center; gap: 20px; margin-bottom: 20px; text-align: right; align-items: center; }

.project-table { width: 100%; max-height: 600px; overflow-y: auto; }
.project-table th, .project-table td { border: 1px solid #ddd; padding: 8px; word-wrap: break-word; text-align: center; }
.project-table th { background-color: #f2f2f2; }
.project-table tbody tr { cursor: pointer; transition: background-color 0.3s ease; }
.project-table tbody tr:hover { background-color: #f5f5f5; }
.project-table tbody tr.selected-row { background-color: #e0f7fa; }

.specification-table { width: 100%; max-height: 600px; overflow-y: auto; }
.specification-table th, .specification-table td { border: 1px solid #ddd; padding: 8px; word-wrap: break-word; text-align: center; }
.specification-table th { background-color: #f2f2f2; }
.specification-table tbody tr { cursor: pointer; transition: background-color 0.3s ease; }
.specification-table tbody tr:hover { background-color: #f5f5f5; }
.specification-table tbody tr.selected-row { background-color: #e0f7fa; }
</style>