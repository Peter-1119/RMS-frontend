<template>
  <div class="spec-view-container">
    <div class="page-header">
      <div class="title-group">
        <button @click="$router.push('/home')" class="icon-btn"><img src="@/assets/home-icon.png" alt="home" /></button>
        <h1>式樣書確認一覽表</h1>
      </div>
    </div>

    <div class="filter-card">
      <div class="search-row">
        <!-- 加上 min 屬性限制不可選擇 2026-04-01 之前的日期 -->
        <div class="input-group">
          <label>建立日期 起</label>
          <input type="date" v-model="search.startDate" min="2026-04-01" @change="validateDate" />
        </div>
        <div class="input-group">
          <label>迄</label>
          <input type="date" v-model="search.endDate" min="2026-04-01" @change="validateDate" />
        </div>
        <div class="input-group"><label>品目</label><input type="text" v-model="search.item" placeholder="輸入品目..." /></div>
        <div class="input-group"><label>製程</label><input type="text" v-model="search.station" placeholder="代號或名稱..." /></div>
        <div class="input-group"><label>式樣書編號</label><input type="text" v-model="search.document_id" placeholder="輸入式樣書編號..." /></div>
        <div class="input-group"><label>課別</label><input type="text" v-model="search.department" placeholder="輸入課別..." /></div>
        <div class="input-group">
          <label>文件狀態</label>
          <select v-model="search.status" class="status-select">
            <option value="">全部</option>
            <option value="已公告">已公告</option>
            <option value="已下載">已下載</option>
            <option value="草稿">草稿</option>
          </select>
        </div>
        <button class="btn search-btn" @click="handleSearch" :disabled="isLoading || isExporting"><i class="fa fa-search"></i> {{ isLoading ? '查詢中...' : '查詢' }}</button>
        <button class="btn export-btn" @click="handleExport" :disabled="isLoading || isExporting"><i class="fa fa-download"></i> {{ isExporting ? '匯出中...' : '匯出 Excel' }}</button>
      </div>
    </div>

    <div class="table-card">
      <table class="styled-table">
        <thead>
          <tr>
            <th width="50">項次</th>
            <th width="100">品目</th>
            <th width="80">製程</th>
            <th width="120">製程名稱</th>
            <th width="120">式樣書編號</th>
            <th width="100">建立時間</th>
            <th width="100">文管編號</th>
            <th width="120">文件名稱</th>
            <th width="70">版本</th>
            <th width="80">制定者</th>
            <th width="80">承認者</th>
            <th width="120">變更要點</th>
            <th width="80">文件狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading"><td colspan="13" class="empty-state">資料載入中，請稍候...</td></tr>
          <tr v-else-if="filteredDisplayData.length === 0"><td colspan="13" class="empty-state">查無資料</td></tr>
          <tr v-else v-for="(row, index) in filteredDisplayData" :key="index" @click="handleRowClick(row)">
            <td>{{ (currentPage - 1) * displayPageSize + index + 1 }}</td>
            <td class="fw-bold">{{ row.MATNR }}</td>
            <td>{{ row.KTSCH }}</td>
            <td class="text-left">{{ row.LTXA1 }}</td>
            <td class="fw-bold">{{ row.SFHNR }}</td>
            <td>{{ formatDate(row.EDATE) }}</td>
            <!-- 以下為 MySQL 對應資料，若無資料顯示空值或預設提示 -->
            <td>{{ row.doc_id || '-' }}</td>
            <td class="text-left">{{ row.doc_name || '-' }}</td>
            <td>{{ row.doc_version ? parseFloat(row.doc_version).toFixed(1) : '-' }}</td>
            <td>{{ row.author || '-' }}</td>
            <td>{{ row.approver || '-' }}</td>
            <td class="text-left precautions-cell">{{ row.change_summary || '-' }}</td>
            <td><span :class="getStatusClass(row.status_text)">{{ row.status_text }}</span></td>
          </tr>
        </tbody>
      </table>
      <div class="pagination-bar">
        <div class="page-size-selector">
          每頁顯示
          <select v-model="displayPageSize" @change="onPageSizeChange" class="page-size-select" :disabled="isLoading">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="30">30</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          筆
        </div>

        <span class="info" v-if="total > 0">共 {{ total }} 筆資料，第 {{ currentPage }} / {{ totalPages }} 頁</span>
        <span class="info" v-else>尚未查詢或查無資料</span>
        
        <div class="actions">
          <button :disabled="currentPage <= 1 || isLoading || total === 0" @click="changePage(-1)">上一頁</button>
          <button :disabled="currentPage >= totalPages || isLoading || total === 0" @click="changePage(1)">下一頁</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ''
const router = useRouter()

// 搜尋條件
const search = reactive({
  startDate: '2026-04-01',
  endDate: '',
  item: '',
  station: '',
  document_id: '',
  department: '',
  status: ''
})

// === 原本是常數，現在改成響應式設定 ===
const displayPageSize = ref(10); // 畫面上每頁顯示的筆數
const bucketSize = computed(() => displayPageSize.value * 10); // 快取桶永遠是顯示數量的 10 倍

const currentPage = ref(1);        // 使用者目前看到的頁碼
const allFetchedData = ref([]);    // 快取桶 (存放目前抓下來的所有資料)
const total = ref(0);              // 資料庫總筆數
const isLoading = ref(false);      // 讀取狀態
const isExporting = ref(false);    // 匯出狀態

// 計算總頁數
const totalPages = computed(() => Math.ceil(total.value / displayPageSize.value) || 1);

// ★ 只從 Cache 中切出當前頁面需要的資料
const filteredDisplayData = computed(() => {
  const startIndex = (currentPage.value - 1) * displayPageSize.value;
  const endIndex = startIndex + displayPageSize.value;
  return allFetchedData.value.slice(startIndex, endIndex);
});

// 日期防呆
const validateDate = () => {
  const minDate = new Date('2026-04-01')
  if (search.startDate && new Date(search.startDate) < minDate) {
    search.startDate = '2026-04-01'
  }
  if (search.endDate && new Date(search.endDate) < minDate) {
    search.endDate = '2026-04-01'
  }
}

// 向後端請求資料 (以 Bucket 為單位)
const fetchBucket = async (bucketIndex) => {
  isLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/item/spec-list`, {
      params: {
        ...search,
        page: bucketIndex,
        pageSize: bucketSize.value    // 👉 改用 bucketSize.value (例如選 20 筆時，這裡會送 200)
      }
    })
    
    if (res.data.success) {
      if (bucketIndex === 1) {
        allFetchedData.value = res.data.data.items;
      } else {
        allFetchedData.value.push(...res.data.data.items);
      }
      total.value = res.data.data.total;
    }
  } catch (err) {
    console.error('Fetch data failed:', err)
  } finally {
    isLoading.value = false;
  }
}

// 👉 新增：當使用者改變每頁顯示數量時，重新整理並重撈第一桶快取
const onPageSizeChange = () => {
  currentPage.value = 1;
  allFetchedData.value = []; // 清空舊快取
  fetchBucket(1);            // 重新依照新的 bucketSize 抓資料
}

// 使用者按下「查詢」按鈕
const handleSearch = () => {
  currentPage.value = 1;
  allFetchedData.value = [];
  fetchBucket(1);
}

// 匯出 Excel：先預檢數量，再下載 xlsx
const handleExport = async () => {
  if (isExporting.value) return;
  isExporting.value = true;
  try {
    // Step 1: 預檢數量
    const countRes = await axios.get(`${API_BASE_URL}/item/spec-list/export-count`, {
      params: { ...search }
    });
    if (!countRes.data.success) {
      alert('匯出失敗：' + (countRes.data.error || '無法取得筆數'));
      return;
    }
    const count = countRes.data.data.count;
    if (count === 0) {
      alert('沒有符合條件的資料');
      return;
    }
    if (count > 10000) {
      if (!confirm(`即將匯出 ${count} 筆資料，可能需要等候較久，確定繼續？`)) return;
    } else if (count > 2000) {
      if (!confirm(`將匯出 ${count} 筆資料，確定繼續？`)) return;
    }

    // Step 2: 下載 xlsx（不設 timeout 避免大量匯出被中斷）
    const dlRes = await axios.get(`${API_BASE_URL}/item/spec-list/export`, {
      params: { ...search },
      responseType: 'blob',
      timeout: 0
    });

    // 後端回 JSON 表示失敗
    const contentType = dlRes.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const errText = await dlRes.data.text();
      try {
        const errJson = JSON.parse(errText);
        alert('匯出失敗：' + (errJson.error || '未知錯誤'));
      } catch {
        alert('匯出失敗：' + errText);
      }
      return;
    }

    // 從 Content-Disposition 取得後端建議檔名
    const cd = dlRes.headers['content-disposition'] || '';
    const match = cd.match(/filename="?([^";]+)"?/);
    const filename = match ? decodeURIComponent(match[1]) : '式樣書清單.xlsx';

    // 觸發瀏覽器下載
    const blobUrl = URL.createObjectURL(dlRes.data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Export failed:', err);
    alert('匯出失敗：' + (err.message || '未知錯誤'));
  } finally {
    isExporting.value = false;
  }
}

// 使用者按下「上一頁」或「下一頁」
const changePage = async (step) => {
  const targetPage = currentPage.value + step;
  if (targetPage < 1 || targetPage > totalPages.value) return;

  const requiredItemsCount = targetPage * displayPageSize.value; // 👉 改用 .value
  
  if (requiredItemsCount > allFetchedData.value.length && allFetchedData.value.length < total.value) {
    // 👉 計算下一個 Bucket，改用 bucketSize.value
    const nextBucketIndex = Math.floor(allFetchedData.value.length / bucketSize.value) + 1;
    await fetchBucket(nextBucketIndex);
  }

  currentPage.value = targetPage;
}

// 狀態 Badge 顏色對應
const getStatusClass = (status) => {
  switch (status) {
    case '已公告': return 'badge success'
    case '已下載': return 'badge info'
    case '草稿': return 'badge warning'
    default: return 'badge default'
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-TW')
}

// 點擊 Row 跳轉至 NewSpecification
const handleRowClick = (row) => {
  if (row.author) {
    alert(`該式樣已由 ${row.author} 進行編輯，若有問題請詢問開發人員。`);
    return; // 中止執行，不跳轉
  }

  // 沒有資料才允許跳轉到 NewSpecification 建立新草稿
  router.push({
    path: '/new-specification',
    query: {
      item: row.MATNR.split("-")[0],
      styleNo: row.SFHNR,
      processCode: row.KTSCH,
      mode: 'new'
    }
  })
}

</script>

<style scoped>
.precautions-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spec-view-container { padding: 20px; background-color: #f5f7fa; min-height: 100vh; font-family: 'Segoe UI', sans-serif; }

/* Header */
.page-header { display: flex; align-items: center; margin-bottom: 20px; }
.title-group { display: flex; align-items: center; gap: 15px; }
.title-group h1 { font-size: 24px; color: #2c3e50; margin: 0; font-weight: 600; }
.icon-btn { background: white; border: 1px solid #ddd; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: all 0.2s; }
.icon-btn:hover { background: #eef2f7; transform: translateY(-1px); }
.icon-btn img { width: 20px; height: 20px; }

/* Filter Card */
.filter-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); margin-bottom: 20px; }

.search-row { display: flex; flex-wrap: wrap; gap: 15px; align-items: flex-end; margin-bottom: 20px; }

.input-group { display: flex; flex-direction: column; gap: 5px; text-align: center; }
.input-group label { font-size: 13px; color: #666; font-weight: 500; }
.input-group input { padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 14px; outline: none; transition: border 0.2s; }
.input-group input:focus { border-color: #4a90e2; }
.status-select { padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 14px; outline: none; transition: border 0.2s; background-color: white; cursor: pointer; }
.status-select:focus { border-color: #4a90e2; }

.search-btn { background-color: #4a90e2; color: white; border: none; padding: 9px 20px; border-radius: 6px; cursor: pointer; font-weight: 500; box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3); }
.search-btn:hover:not(:disabled) { background-color: #357abd; }
.search-btn:disabled { background-color: #a4c4e8; cursor: not-allowed; box-shadow: none; }

.export-btn { background-color: #27ae60; color: white; border: none; padding: 9px 20px; border-radius: 6px; cursor: pointer; font-weight: 500; box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3); }
.export-btn:hover:not(:disabled) { background-color: #1e8449; }
.export-btn:disabled { background-color: #95c9a8; cursor: not-allowed; box-shadow: none; }

.control-row { display: flex; align-items: center; gap: 30px; padding-top: 15px; border-top: 1px solid #f0f0f0; }

.threshold-control { display: flex; align-items: center; gap: 10px; }
.short-input { width: 60px; padding: 5px; border: 1px solid #ddd; border-radius: 4px; text-align: center; }
.hint { font-size: 12px; color: #999; }

.checkbox-group { display: flex; gap: 20px; }
.cb-container { display: flex; align-items: center; cursor: pointer; font-size: 14px; color: #555; user-select: none; }
.cb-container input { margin-right: 8px; }

/* Table Card */
.table-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }

.styled-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.styled-table thead tr { background-color: #f8f9fa; color: #666; text-align: left; }
.styled-table th, .styled-table td { padding: 12px 15px; border-bottom: 1px solid #eee; vertical-align: top; /* 讓內容靠上對齊 */ }
.styled-table tbody tr { transition: background-color 0.2s; cursor: pointer; }
.styled-table tbody tr:hover { background-color: #f0f7ff; }

/* Process List Styling */
.process-item {
  margin-bottom: 4px;
  font-size: 13px;
  color: #444;
  line-height: 1.4;
}
.precautions-cell {
  max-width: 300px;
  white-space: pre-wrap; /* 保留換行 */
}

/* Row Highlights */
.row-overdue { background-color: #fff5f5; }
.row-overdue td { color: #c0392b;  }

/* Badges */
.badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; display: inline-block; white-space: nowrap; }
.badge.success { background-color: #e6fffa; color: #00b894; }
.badge.warning { background-color: #fff0f0; color: #fab1a0; }
.badge.info { background: #e3f2fd; color: #1976d2; }
.badge.danger { background: #ffebee; color: #c62828; }
.badge.default { background: #f5f5f5; color: #999; }

.text-left { text-align: left; }
.fw-bold { font-weight: 600; }
.empty-state { text-align: center; color: #999; padding: 40px; }

/* Pagination */
.pagination-bar { padding: 15px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eee; }
.actions button { margin-left: 10px; padding: 5px 15px; cursor: pointer; }

.page-size-selector { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #666; }
.page-size-select { padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; outline: none; font-size: 14px; cursor: pointer; }
.page-size-select:focus { border-color: #4a90e2; }
</style>