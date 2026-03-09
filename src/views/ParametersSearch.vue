<template>
  <div class="parameters-search-container">
    <div class="header-block">
      <div class="header">
        <h1>配方檢索</h1>
      </div>

      <div class="header-panel">
        <div class="header-left-panel">
          <div class="search">
            <div class="fundamental-attribute">
              <div class="form-group">
                <label>製程：</label>
                <input class="window-input" type="text" v-model="form.specific" @click="specificsListVisible = true" readonly/>
              </div>

              <div class="form-group">
                <label>適用機台：</label>
                <input class="window-input" type="text" v-model="form.machine" @click="machineWindowVisable = true" readonly/>
              </div>

              <div class="form-group">
                <label>品目：</label>
                <input class="window-input" type="text" v-model="form.item" @click="itemWindowVisable = true" readonly/>
              </div>

              <div class="form-group">
                <label>程式代碼：</label>
                <input type="text" v-model="form.code" />
              </div>
            </div>

            <div class="condition-attribute" v-if="form.machineCode && !form.item">
              <div v-for="condition in conditions" :key="condition.id" class="form-group">
                <label>{{ condition.name }}：</label>
                <select v-model="selectedConditions[condition.name]">
                  <option value=""></option>
                  <option v-for="p in condition.parameters" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <p v-if="form.machineCode && !conditions.length" style="margin-top: 12px; color: #666;">此機台目前尚未設定任何條件。</p>
            </div>
          </div>
        </div>

        <div class="header-right-panel">
          <button class="btn clear" @click="searchConditionClear">清空</button>
          <button class="btn search" @click="parameterSearch(false)">查詢</button>
        </div>
      </div>
    </div>

    <div class="result-block" v-if="hasSearched">
      <div class="result-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h2>檢索結果 (共 {{ totalCount }} 筆)</h2>
        
        <div class="pagination-controls" v-if="totalCount > 0">
          <button class="btn page-btn" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">上一頁</button>
          <span style="margin: 0 10px;">第 {{ currentPage }} / {{ totalPages }} 頁</span>
          <button class="btn page-btn" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">下一頁</button>
        </div>
      </div>

      <div class="table-container">
        <table class="result-table">
          <thead>
            <tr>
              <th>製程</th>
              <th>機台</th>
              <th>品目</th>
              <th>程式代碼</th>
              <th v-for="header in dynamicConditionHeaders" :key="header" class="cond-header">
                {{ header }}
              </th>
              <th>文件名稱</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in results" :key="idx" :class="{ active: idx === selectedResultIndex }" @click="selectResult(idx, row)">
              <td>{{ row.process }}</td>
              <td>{{ row.machine }}</td>
              <td>{{ row.item || '-' }}</td>
              <td>{{ row.program_code }}</td>
              <td v-for="header in dynamicConditionHeaders" :key="header">
                {{ row.conditions[header] || '' }}
              </td>
              <td>
                  <a href="#" @click.prevent="viewDoc(row)">{{ row.document_name }}</a>
              </td>
            </tr>
            <tr v-if="results.length === 0">
              <td :colspan="5 + dynamicConditionHeaders.length" class="empty-text">
                查無資料
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="parameter-block">
      <h2>參數</h2>
      <table class="param-table" v-if="parameterRows.length">
        <thead><tr><th v-for="cell in parameterRows[0]">{{ cell }}</th></tr></thead>
        <tbody><tr v-for="row in parameterRows.slice(1)"><td v-for="cell in row">{{ cell }}</td></tr></tbody>
      </table>
      <p v-else class="empty-text">請先在上方選擇一筆配方</p>
    </div>
  </div>

  <SpecificListWindow v-if="specificsListVisible" :machineCode="form.machineCode" :itemCode="form.item" :machineKeyword="machineKeyword" @selectSpecific="getSpecific" @cancel="specificsListVisible = false" />
  <GroupMachinesListWindow v-if="machineWindowVisable" :specific-code="form.specificCode" :item-code="form.item" @select-machine="getMachine" @cancel="machineWindowVisable = false" />
  <ItemListWindow v-if="itemWindowVisable" :specificCode="form.specificCode" :machineCode="form.machineCode" @selectItem="getItemType" @cancel="itemWindowVisable = false" />
</template>

<script>
import axios from 'axios'
import SpecificListWindow from '@/components/SpecificListWindow.vue'
import GroupMachinesListWindow from '@/components/GroupMachinesListWindow.vue'
import ItemListWindow from '@/components/ItemListWindow.vue'

export default {
  name: 'ParametersSearch',
  components: {
    SpecificListWindow,
    GroupMachinesListWindow,
    ItemListWindow,
  },
  data() {
    return {
      specificsListVisible: false,
      machineWindowVisable: false,
      itemWindowVisable: false,

      machineKeyword: '',
      specificKeyword: '',
      
      hasSearched: false,

      // 分頁狀態
      currentPage: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 1,

      form: {
        specific: '',
        specificCode: '', // 搜尋用 Code
        machine: '',
        machineCode: '',  // 搜尋用 Code
        item: '',
        code: '',
      },

      // Step2：動態條件
      conditions: [],          
      selectedConditions: {},  // { [condition_name]: parameter_value }

      // Step3：搜尋結果
      results: [], 
      selectedResultIndex: -1,

      // Step4：參數表
      parameterRows: [],
    }
  },
  computed: {
    dynamicConditionHeaders() {
      const headers = new Set()
      this.results.forEach(row => {
        if (row.conditions) {
          Object.keys(row.conditions).forEach(k => headers.add(k))
        }
      })
      return Array.from(headers).sort() 
    }
  },
  methods: {
    searchConditionClear() {
      this.form = {
        specific: '',
        specificCode: '',
        machine: '',
        machineCode: '',
        item: '',
        code: '',
      }
      this.specificKeyword = ''
      this.machineKeyword = ''
      this.conditions = []
      this.selectedConditions = {}
      
      this.results = []
      this.hasSearched = false
      this.selectedResultIndex = -1
      this.parameterRows = []
      
      // 重置分頁
      this.currentPage = 1
      this.totalCount = 0
      this.totalPages = 1
    },

    getSpecific(payload) {
      if (payload) {
        this.form.specific = payload.specific || payload
        this.form.specificCode = payload.code || ''
        this.specificKeyword = this.form.specific
      } else {
        this.form.specific = ''
        this.form.specificCode = ''
        this.specificKeyword = ''
      }
    },

    async getMachine(payload) {
      if (payload) {
        this.form.machine = payload.name || ''
        this.form.machineCode = payload.code || ''
        this.machineKeyword = this.form.machine
        await this.loadConditionsForMachine(this.form.machineCode)
      } else {
        this.form.machine = ''
        this.form.machineCode = ''
        this.machineKeyword = ''
        this.conditions = []
        this.selectedConditions = {}
      }
    },

    getItemType(payload) {
      if (payload) {
        this.form.item = payload || ''
      } else {
        this.form.item = ''
      }
    },

    async loadConditionsForMachine(machineCode) {
      if (!machineCode) {
        this.conditions = []
        this.selectedConditions = {}
        return
      }
      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ''
        const { data } = await axios.get(
          `${API_BASE_URL}/conditions/search-conditions-by-machines`,
          { params: { keyword: machineCode } }
        )
        const list = (data && data.data && data.data.conditions) || []
        this.conditions = list
        this.selectedConditions = {}
        // 初始化條件選擇
        this.conditions.forEach(c => {
           if(c.name) this.selectedConditions[c.name] = ''
        })
      } catch (e) {
        console.error('loadConditionsForMachine error:', e)
        this.conditions = []
        this.selectedConditions = {}
      }
    },

    // 換頁函式
    changePage(page) {
      if (page < 1 || page > this.totalPages) return
      this.currentPage = page
      this.parameterSearch(true) // true 代表是換頁操作
    },

    // ===== Step3：查詢 =====
    async parameterSearch(isPageChange = false) {
      if (!isPageChange) {
        this.currentPage = 1 // 若非換頁（按下查詢按鈕），重置為第一頁
      }

      this.results = []
      this.hasSearched = false
      this.parameterRows = []
      this.selectedResultIndex = -1

      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ""
        
        // 準備 API 參數
        const params = {
          specific: this.form.specific, // 用名稱搜尋，因為後端用 JSON_SEARCH
          machine:  this.form.machineCode, // 機台用 Code
          item:     this.form.item,
          code:     this.form.code,
          page:     this.currentPage,
          pageSize: this.pageSize
        }

        // 邏輯控制：只有在 (有機台 且 無品目) 時才傳送動態條件
        // 這與 Template 的 v-if 邏輯一致，也與後端邏輯一致
        if (this.form.machineCode && !this.form.item) {
            Object.keys(this.selectedConditions).forEach(key => {
                const val = this.selectedConditions[key]
                if (val) {
                    params[key] = val
                }
            })
        }

        // 移除空值
        Object.keys(params).forEach(key => {
            if (!params[key]) delete params[key]
        })

        const { data } = await axios.get(`${API_BASE_URL}/parameters/search`, { params })
        
        if (data.success) {
            this.results = data.data.items || []
            this.totalCount = data.data.total || 0
            this.totalPages = data.data.totalPages || 1
            this.currentPage = data.data.page || 1
        } else {
            alert(data.message || '查詢失敗')
        }
      } catch (e) {
        console.error('parameterSearch error:', e)
        alert('系統發生錯誤')
      } finally {
        this.hasSearched = true
      }
    },

    // ===== Step4：載入參數表 =====
    async selectResult(index, row) {
      this.selectedResultIndex = index
      this.parameterRows = []

      // 檢查 content_id
      if (!row || !row.content_id) {
          console.error("Missing content_id:", row)
          return
      }

      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ""
        // 呼叫新 API (使用 content_id)
        const { data } = await axios.get(`${API_BASE_URL}/parameters/block/${row.content_id}`)
        
        if (data.success) {
            this.parameterRows = data.data.rows || []
        } else {
            alert(data.message || '讀取失敗')
        }
      } catch (e) {
        console.error('load parameter rows error:', e)
        this.parameterRows = []
      }
    },
    
    viewDoc(row) {
        console.log("View Doc", row)
        // 這裡可以實作開啟文件預覽的邏輯
    }
  },
}
</script>

<style scoped>
/* 樣式保持不變，新增分頁按鈕樣式 */
.parameters-search-container { width: 95%; margin: auto; justify-content: center; padding: 20px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
.header-block { margin-bottom: 20px; padding: 8px; }
.header-panel { display: flex; }
.header-left-panel { width: 90%; }
.header-right-panel { display: flex; width: 15%; align-items: center; justify-content: center; }
.header-right-panel .btn { padding: 8px 12px; margin: 4px; font-size: 14px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s ease; }
.header-right-panel .btn:hover { background-color: #0056b3; }
.header-right-panel .btn.clear { background-color: #BBBBBB; color: black; }
.header-right-panel .btn.clear:hover { background-color: #999999; color: black; }
.header { display: flex; justify-content: space-between; border-radius: 5px; margin-bottom: 14px; }
.fundamental-attribute { display: flex; }
.form-group { display: flex; margin-right: 12px; align-items: center; }
.form-group label { width: 60%; }
.form-group input, .form-group select { width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ccc; }
.form-group .window-input { cursor: pointer; }
.condition-attribute { display: flex; flex-wrap: wrap; }
.condition-attribute .form-group { display: flex; margin-top: 12px; }
.result-block { margin-top: 10px; padding: 10px 0; }
.result-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
.result-table th, .result-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; word-wrap: break-word; }
.result-table tbody tr.active { background-color: #eef6ff; }
.result-table tbody tr:hover { background-color: #f2f8ff; cursor: pointer; }
.empty-text { color: #888; margin: 8px 0; text-align: center; }
.parameter-block { margin-top: 20px; padding: 10px 0 20px; }
.param-table { width: 100%; border-collapse: collapse; }
.param-table th, .param-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; word-wrap: break-word; }
.cond-header { background-color: #eaf4ff; color: #0056b3; }

/* 分頁按鈕樣式 */
.page-btn {
  padding: 4px 10px;
  background-color: #fff;
  border: 1px solid #ddd;
  cursor: pointer;
  border-radius: 4px;
}
.page-btn:disabled {
  background-color: #f5f5f5;
  color: #aaa;
  cursor: not-allowed;
}
</style>