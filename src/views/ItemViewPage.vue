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
        <div class="input-group"><label>建立日期 起</label><input type="date" v-model="search.startDate" /></div>
        <div class="input-group"><label>迄</label><input type="date" v-model="search.endDate" /></div>
        <div class="input-group"><label>品目</label><input type="text" v-model="search.item" placeholder="輸入品目..." /></div>
        <div class="input-group"><label>製程</label><input type="text" v-model="search.station" placeholder="代號或名稱..." /></div>
        <div class="input-group"><label>單位/課別</label><input type="text" v-model="search.unit" placeholder="輸入課別..." /></div>
        <button class="btn search-btn" @click="fetchData"><i class="fa fa-search"></i> 查詢</button>
      </div>

      <div class="control-row">
        <div class="threshold-control">
          <label>管控閥值 (天)</label>
          <input type="number" v-model.number="thresholdDays" min="0" class="short-input" />
          <span class="hint">超過此天數未確認將標示為紅色</span>
        </div>

        <div class="checkbox-group">
          <label class="cb-container">
            <input type="checkbox" v-model="filters.onlyProd" />
            <span class="checkmark"></span> 僅顯示量產 (Z開頭)
          </label>
          <label class="cb-container">
            <input type="checkbox" v-model="filters.onlyProto" />
            <span class="checkmark"></span> 僅顯示試作 (非Z)
          </label>
          <label class="cb-container">
            <input type="checkbox" v-model="filters.unconfirmed" />
            <span class="checkmark"></span> 僅顯示未確認
          </label>
          <label class="cb-container">
            <input type="checkbox" v-model="filters.overdueOnly" />
            <span class="checkmark"></span> 僅顯示過期
          </label>
        </div>
      </div>
    </div>

    <div class="table-card">
      <table class="styled-table">
        <thead>
          <tr>
            <th width="50">項次</th>
            <th width="120">品目</th>
            <th width="120">式樣書編號</th>
            <th width="220">製程</th> <th width="100">建立時間</th>
            <th width="80">課別</th>
            <th width="80">生技確認</th>
            <th width="100">生技確認人</th>
            <th width="100">確認日期</th>
            <th>式樣注意事項</th>
            <th width="80">文件狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in filteredDisplayData" :key="index" :class="{ 'row-overdue': isRowOverdue(row) }" @click="handleRowClick(row)">
            <td>{{ (search.page - 1) * search.pageSize + index + 1 }}</td>
            
            <td class="fw-bold">{{ row.ITEM }}</td>
            
            <td>{{ row.BOOK }}</td>

            <td class="text-left process-cell">
              <div v-for="(proc, pIdx) in parseProcessInfo(row.PROCESS_INFO)" :key="pIdx" class="process-item">
                {{ proc }}
              </div>
            </td>

            <td>{{ formatDate(row.T_TIME) }}</td>

            <td>{{ row.CLASS_CH }}</td>
            
            <td>
              <span v-if="row.CHECK_TIME" class="badge success">已確認</span>
              <span v-else class="badge warning">未確認</span>
            </td>
            
            <td>{{ row.PT_EMP }}</td>

            <td>{{ formatDate(row.CHECK_TIME) }}</td>

            <td class="text-left precautions-cell">{{ row.PRECAUTIONS }}</td>

            <td>
              <span :class="getStatusClass(row.DOC_STATUS)">{{ row.DOC_STATUS }}</span>
            </td>
          </tr>
          
          <tr v-if="filteredDisplayData.length === 0">
            <td colspan="11" class="empty-state">查無資料</td>
          </tr>
        </tbody>
      </table>
      <div class="pagination-bar" v-if="total > 0">
        <span class="info">共 {{ total }} 筆資料，第 {{ search.page }} / {{ totalPages }} 頁</span>
        <div class="actions">
          <button :disabled="search.page <= 1" @click="changePage(-1)">上一頁</button>
          <button :disabled="search.page >= totalPages" @click="changePage(1)">下一頁</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ''

export default {
  name: 'ItemViewPage',
  data() {
    return {
      // 搜尋條件
      search: {
        startDate: '',
        endDate: '',
        item: '',
        station: '',
        unit: '',
        page: 1,
        pageSize: 20
      },
      total: 0, 

      // 篩選條件
      filters: {
        onlyProd: false,
        onlyProto: false,
        unconfirmed: false,
        overdueOnly: false 
      },
      // 閥值
      thresholdDays: 3, 
      
      // 資料
      tableData: [],
      loading: false
    }
  },
  computed: {
    totalPages() {
      return Math.ceil(this.total / this.search.pageSize) || 1
    },
    // 前端二次過濾 (針對 "僅顯示過期")
    filteredDisplayData() {
      if (!this.filters.overdueOnly) {
        return this.tableData
      }
      return this.tableData.filter(row => this.isRowOverdue(row))
    }
  },
  methods: {
    async fetchData() {
      this.loading = true
      try {
        const params = {
          startDate: this.search.startDate,
          endDate: this.search.endDate,
          item: this.search.item,
          station: this.search.station,
          unit: this.search.unit,
          // 傳遞給後端的 Checkbox 邏輯
          filterProd: this.filters.onlyProd,
          filterProto: this.filters.onlyProto,
          filterUnconfirmed: this.filters.unconfirmed,
          page: this.search.page,
          pageSize: this.search.pageSize
        }

        const { data } = await axios.get(`${API_BASE_URL}/spec/view-list`, { params })
        if (data.success) {
          this.tableData = data.data.items || []
          this.total = data.data.total || 0
        } else {
          alert(data.message)
        }
      } catch (e) {
        console.error(e)
        alert('查詢失敗')
      } finally {
        this.loading = false
      }
    },

    changePage(delta) {
      this.search.page += delta
      this.fetchData()
    },

    // 解析後端傳來的製程字串 (原本由 \n 分隔)
    parseProcessInfo(infoStr) {
      if (!infoStr) return [];
      // 後端 SQL: LISTAGG(..., CHR(10))，所以這裡 split('\n')
      // 過濾掉空字串以防萬一
      return infoStr.split('\n').filter(s => s && s.trim() !== '');
    },

    // 根據狀態回傳對應 class
    getStatusClass(status) {
        if (status === '已簽核') return 'badge success';
        if (status === '送審中') return 'badge info';
        if (status === '被退回') return 'badge danger';
        if (status === '草稿') return 'badge warning';
        return 'badge default'; // 未建立
    },

    // 判斷是否過期
    isRowOverdue(row) {
      if (row.CHECK_TIME) return false
      if (!this.thresholdDays && this.thresholdDays !== 0) return false

      const createDate = new Date(row.T_TIME)
      const today = new Date()
      createDate.setHours(0, 0, 0, 0)
      today.setHours(0, 0, 0, 0)

      const diffTime = today - createDate
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      return diffDays > this.thresholdDays
    },

    // 日期格式化 (YYYY-MM-DD)
    formatDate(val) {
      if (!val) return '-'
      const d = new Date(val)
      if (isNaN(d.getTime())) return val 
      
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },

    handleRowClick(row) {
      // 這裡您可以根據需求，看是要帶入 row.ITEM 還是 row.BOOK
      this.$router.push({
        name: 'new-specification', 
        query: {
          item: row.ITEM, 
          book: row.BOOK,
          mode: 'view_confirm',
          autoLoad: 'true'
        }
      })
    }
  },
  mounted() {
    // 預設查詢日期：最近 30 天
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 30)

    const format = (d) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    this.search.startDate = format(start)
    this.search.endDate = format(end)
    this.fetchData()
  }
}
</script>

<style scoped>
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

.search-btn { background-color: #4a90e2; color: white; border: none; padding: 9px 20px; border-radius: 6px; cursor: pointer; font-weight: 500; box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3); }
.search-btn:hover { background-color: #357abd; }

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
.pagination-bar {
    padding: 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #eee;
}
.actions button {
    margin-left: 10px;
    padding: 5px 15px;
    cursor: pointer;
}
</style>