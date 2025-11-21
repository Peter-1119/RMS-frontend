<!-- ParameterSearch.vue -->
<template>
  <div class="parameters-search-container">
    <!-- ===== Block 1：基本查詢條件 ===== -->
    <div class="header-block">
      <div class="header">
        <h1>配方檢索</h1>
        <button class="home-btn" @click="saveDraft">
          <img src="@/assets/home-icon.png" alt="回首頁" class="icon" /> 回首頁
        </button>
      </div>

      <div class="header-panel">
        <div class="header-left-panel">
          <div class="search">
            <div class="fundamental-attribute">
              <div class="form-group">
                <label>適用工程：</label>
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

            <!-- Step2：依機台動態產生條件 select -->
            <div class="condition-attribute">
              <div v-for="condition in conditions" :key="condition.id" class="form-group">
                <label>{{ condition.name }}：</label>
                <select v-model="selectedConditions[condition.id]">
                  <option value=""></option>
                  <option v-for="p in condition.parameters" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>

              <p v-if="form.machineCode && !conditions.length" style="margin-top: 12px; color: #666;">此機台目前尚未設定任何條件。</p>
            </div>
          </div>
        </div>

        <div class="header-right-panel">
          <button class="btn search" @click="parameterSearch">查詢</button>
        </div>
      </div>
    </div>

    <!-- ===== Block 2：配方清單 (Step3) ===== -->
    <div class="result-block">
      <h2>配方清單</h2>

      <table class="result-table" v-if="results.length">
        <thead>
          <tr>
            <th style="width: 40px;"></th>
            <th>適用工程</th>
            <th>機台</th>
            <th>品目</th>
            <!-- 動態條件欄位 -->
            <th v-for="header in conditionHeaders" :key="header">{{ header }}</th>
            <th>程式代碼</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in paginatedResults"
            :key="row.document_token + '-' + idx"
            :class="{ active: selectedResultIndex === (resultPageStartIndex + idx) }"
            @click="selectResult(resultPageStartIndex + idx, row)"
          >
            <td>
              <input type="radio" :checked="selectedResultIndex === (resultPageStartIndex + idx)"/>
            </td>
            <td>{{ row.specific_name }}</td>
            <!-- ✅ 這裡改成用 form.machine 顯示全名，若沒選就 fallback 到 machine_code -->
            <td>{{ form.machine || row.machine_code }}</td>
            <td>{{ row.item_code }}</td>
            <!-- 各條件實際顯示的參數 -->
            <td v-for="header in conditionHeaders" :key="header">{{ (row.conditions && row.conditions[header]) || '' }}</td>
            <td>{{ row.program_code }}</td>
          </tr>
        </tbody>
      </table>

      <p v-else class="empty-text">尚未有查詢結果</p>

      <!-- 簡易分頁 -->
      <div class="page-action-block" v-if="results.length">
        <!-- ... 一樣 ... -->
      </div>
    </div>

    <!-- ===== Block 3：參數表 (Step4) ===== -->
    <div class="parameter-block">
      <h2>參數</h2>

      <table class="param-table" v-if="parameterRows.length">
        <thead>
          <tr><th>槽體名稱</th><th>參數名稱</th><th>規格上限</th><th>操作上限</th><th>中值</th><th>操作下限</th><th>規格下限</th><th>單位</th><th>參數下放</th><th>說明</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in parameterRows" :key="i">
            <td>{{ p.tank_name }}</td>
            <td>{{ p.param_name }}</td>
            <td>{{ p.spec_upper }}</td>
            <td>{{ p.op_upper }}</td>
            <td>{{ p.center }}</td>
            <td>{{ p.op_lower }}</td>
            <td>{{ p.spec_lower }}</td>
            <td>{{ p.unit }}</td>
            <td>{{ p.down_flag }}</td>
            <td>{{ p.remark }}</td>
          </tr>
        </tbody>
      </table>

      <p v-else class="empty-text">請先在上方選擇一筆配方</p>
    </div>
  </div>

  <!-- ===== 三個彈窗 ===== -->
  <SpecificListWindow
    v-if="specificsListVisible"
    :machineKeyword="machineKeyword"
    @selectSpecific="getSpecific"
    @cancel="specificsListVisible = false"
  />

  <GroupMachinesListWindow
    v-if="machineWindowVisable"
    :specific-code="form.specificCode"
    :item-code="form.item"
    @select-machine="getMachine"
    @cancel="machineWindowVisable = false"
  />

  <ItemListWindow
    v-if="itemWindowVisable"
    @selectItem="getItemType"
    @cancel="itemWindowVisable = false"
  />
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

      form: {
        specific: '',
        specificCode: '',
        machine: '',
        machineCode: '',
        item: '',
        code: '',
      },

      // Step2：動態條件
      conditions: [],          // [{id, name, parameters:[...]}]
      selectedConditions: {},  // { [condition_id]: parameter_name }

      // Step3：搜尋結果
      results: [],
      resultPage: 1,
      resultPageSize: 10,
      selectedResultIndex: -1,

      // 後端給的條件欄位（每台機台的欄位集合）
      conditionHeadersFromAPI: [],

      // Step4：參數表
      parameterRows: [],
    }
  },
  computed: {
    totalResultPages() {
      if (!this.results.length) return 1
      return Math.ceil(this.results.length / this.resultPageSize)
    },
    resultPageStartIndex() {
      return (this.resultPage - 1) * this.resultPageSize
    },
    paginatedResults() {
      const start = this.resultPageStartIndex
      return this.results.slice(start, start + this.resultPageSize)
    },

    // 動態條件欄位：直接用後端傳回來的 condition_headers
    conditionHeaders() {
      return this.conditionHeadersFromAPI || []
    },
  },
  methods: {
    saveDraft() {
      console.log('TODO: 回首頁')
    },

    // ===== Step1：三個選單回來的值 =====
    getSpecific(payload) {
      if (payload) {
        // 假設 payload 是 { specific: '顯示文字', code: 'RE233-01' }
        this.form.specific = payload.specific || payload
        this.form.specificCode = payload.code || ''
        this.specificKeyword = this.form.specific
      } else {
        this.form.specific = ''
        this.form.specificCode = ''
        this.specificKeyword = ''
      }
    },

    // GroupMachinesListWindow emit: { code, name }
    async getMachine(payload) {
      if (payload) {
        this.form.machine = payload.name || ''
        this.form.machineCode = payload.code || ''
        this.machineKeyword = this.form.machine
        // 選完機台 → 依機台載入條件
        await this.loadConditionsForMachine(this.form.machineCode)
      } else {
        this.form.machine = ''
        this.form.machineCode = ''
        this.machineKeyword = ''
        this.conditions = []
        this.selectedConditions = {}
      }
    },

    // ItemListWindow emit: { matnr, ... }
    getItemType(payload) {
      if (payload) {
        this.form.item = payload.matnr || ''
      } else {
        this.form.item = ''
      }
    },

    // ===== Step2：依機台查條件 (conditions.py) =====
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
        this.conditions.forEach(c => {
          this.selectedConditions[c.id] = ''
        })
      } catch (e) {
        console.error('loadConditionsForMachine error:', e)
        this.conditions = []
        this.selectedConditions = {}
      }
    },

    // ===== Step3：按下查詢，搜尋 rms_document_attributes / rms_block_content =====
    async parameterSearch() {
      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ""
        const payload = {
          status: 0,   // ← 開發階段先查草稿，之後正式改成 2
          specific_code: this.form.specificCode || null,
          machine_code:  this.form.machineCode  || null,
          item_code:     this.form.item         || null,
          program_code:  this.form.code         || null,
          conditions: Object.entries(this.selectedConditions)
            .filter(([cid, val]) => val)
            .map(([cid, val]) => {
              const cond = this.conditions.find(c => c.id === Number(cid))
              return {
                condition_id: Number(cid),
                condition_name: cond?.name || null,
                parameter_name: val
              }
            }),
          page: this.resultPage,
          page_size: this.resultPageSize,
        }

        const { data } = await axios.post(`${API_BASE_URL}/parameters/search`, payload)
        const res = (data && data.data) || {}
        console.log("data: ", data)

        // 後端 condition_headers
        this.conditionHeadersFromAPI = res.condition_headers || []

        // 搜尋結果
        this.results = res.items || []
        this.resultPage = 1
        this.selectedResultIndex = -1
        this.parameterRows = []
      } catch (e) {
        console.error('parameterSearch error:', e)
        this.results = []
        this.parameterRows = []
        this.conditionHeadersFromAPI = []
      }
    },

    // ===== Step4：點一筆配方，載入參數表 =====
    async selectResult(index, row) {
      this.selectedResultIndex = index
      this.parameterRows = []

      if (!row || !row.document_token) return

      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ""

        // ★ 用 document_type 決定要打哪一個 step
        const stepType = row.document_type === 1 ? 5 : 2

        const { data } = await axios.get(
          `${API_BASE_URL}/parameters/${row.document_token}/blocks`,
          { params: { step_type: stepType } }
        )

        this.parameterRows = (data && data.data && data.data.rows) || []
      } catch (e) {
        console.error('load parameter rows error:', e)
        this.parameterRows = []
      }
    }

  },
}
</script>

<style scoped>
.parameters-search-container { width: 95%; margin: auto; justify-content: center; padding: 20px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
.header-block { margin-bottom: 20px; padding: 8px; }
.header-panel { display: flex; }
.header-left-panel { width: 90%; }
.header-right-panel { display: flex; width: 10%; align-items: center; justify-content: center; }
.header-right-panel .btn { padding: 12px 25px; font-size: 16px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s ease; }
.header-right-panel .btn:hover { background-color: #0056b3; }

.header { display: flex; justify-content: space-between; border-radius: 5px; margin-bottom: 14px; }
.header h1 { margin: 0; }
.header button { display: flex; background-color: #ffffff; padding: 10px 18px; gap: 5px; border: 1px solid #000; border-radius: 6px; }
.header img { width: 18px; height: 18px; }

.fundamental-attribute { display: flex; }
.form-group { margin-right: 12px; align-items: center; }
.form-group input,
.form-group select { padding: 6px; border-radius: 4px; border: 1px solid #ccc; }
.form-group .window-input { cursor: pointer;}

.condition-attribute { display: flex; flex-wrap: wrap; }
.condition-attribute .form-group { display: flex; margin-top: 12px; }

.result-block { margin-top: 10px; padding: 10px 0; }
.result-block h2 { margin: 10px 0; }
.result-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
.result-table th,
.result-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; word-wrap: break-word; }
.result-table tbody tr.active { background-color: #eef6ff; }
.result-table tbody tr:hover { background-color: #f2f8ff; }

.empty-text { color: #888; margin: 8px 0; }

.parameter-block { margin-top: 20px; padding: 10px 0 20px; }
.parameter-block h2 { margin: 10px 0; }
.param-table { width: 100%; border-collapse: collapse; }
.param-table th,
.param-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; word-wrap: break-word; }

.page-action-block { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 0; }
.icon-item { background: #eee; padding: 4px 8px; border-radius: 4px; cursor: pointer; user-select: none; }
.icon-item:hover { background: #ddd; }
.icon-item.disabled { opacity: .5; pointer-events: none; }
.page-input { width: 72px; padding: 2px 6px; }
</style>
