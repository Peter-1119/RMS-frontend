<template>
  <div class="Specification-Parameters-container">
      <div class="page-header">
        <div>
          <h2>規則一覽表</h2>
          <span class="subtitle">維護製造條件規則及其適用的機台群組</span>
        </div>
        <button class="btn add-condition" @click="openEditWindow(null)">＋ 新增條件</button>
      </div>

      <div class="table-content">
        <!-- 左欄：條件規則 -->
        <div class="table-column">
          <div class="search-row">
            <label>條件關鍵字：</label>
            <input type="text" placeholder="請輸入條件名稱或細項" v-model="conditionKeyword" @keyup.enter="fetchConditionsByKeyword(conditionKeyword)"/>
            <button class="btn-search" @click="fetchConditionsByKeyword(conditionKeyword)">搜尋</button>
          </div>

          <div class="condition-table-wrapper">
            <div class="panel-title">條件規則</div>
            <table class="conditions-table">
              <thead>
                <tr>
                  <th>項次</th>
                  <th>條件名稱</th>
                  <th>條件細項</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(condition, index) in conditions" :key="condition.id" @click="selectConditionRow(index)" :class="{'selected-row': index === selectedIndex}">
                  <td>{{ index + 1 }}</td>
                  <td>{{ condition.name }}</td>
                  <td><ul class="list-param"><li v-for="param in condition.parameters" :key="param">{{ param }}</li></ul></td>
                  <td>
                    <button class="btn edit" @click="openEditWindow(index)">編輯</button>
                    <button class="btn delete" @click="deleteCondition(index)">刪除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 右欄：適用機台群組 -->
        <div class="table-column">
          <div class="search-row">
            <label>機台關鍵字：</label>
            <input type="text" placeholder="請輸入機台名稱或群組" v-model="machineKeyword" @keyup.enter="fetchConditionsByMachines(machineKeyword)"/>
            <button class="btn-search" @click="fetchConditionsByMachines(machineKeyword)">搜尋</button>
          </div>

          <div class="machine-table-wrapper">
            <div class="panel-title">適用機台群組</div>
            <table class="machines-table">
              <thead>
                <tr>
                  <th>機台群組</th>
                  <th>機台名稱</th>
                </tr>
              </thead>
              <tbody v-if="selectedIndex != null">
                <tr v-for="(mi, mn) in groups" :key="mi.code">
                  <td>{{ mn }}</td>
                  <td>{{ Object.keys(mi.machines).join(', ') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    <SpecificationParamWindow 
      v-if="visible"
      :condition="conditions[selectedIndex]"
      @update-condition-data="updateConditionData"
      @cancel="closeWindow">
      <template #header><h3>{{ this.selectedIndex != null ? '編輯條件' : '新增條件' }}</h3></template>
    </SpecificationParamWindow>
  </div>
</template>

<script>
import axios from 'axios';
import SpecificationParamWindow from '@/components/SpecificationParamWindow.vue';

export default {
  name: "SpecificationParamPage",
  components: { SpecificationParamWindow },
  data() {
    return {
      machineKeyword: "",
      conditionKeyword: "",
      conditions: [],
      groups: {},
      results: [],
      visible: false,
      selectedIndex: null,
    };
  },
  async mounted() {
    this.fetchConditionsByKeyword("");
  },
  methods: {
    async selectConditionRow(condition_index) {
      this.selectedIndex = condition_index;
      if (condition_index == null) return;

      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
        const response = await axios.get(API_BASE_URL + "/conditions/get-condition-machines", {params: {condition_id: this.conditions[condition_index].id}});
        this.groups = response.data.data.groups;
      }
      catch (error) {
        this.groups = {};
      }
    },
    async fetchConditionsByMachines(keyword) {
      try {
        // console.log("GET /conditions/search-conditions-by-machines.")
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
        const response = await axios.get(API_BASE_URL + "/conditions/search-conditions-by-machines", {params: {keyword}});
        this.conditions = response.data.data.conditions;

        if (this.conditions.length > 0) this.selectedIndex = (this.selectedIndex < this.conditions.length) ? this.selectedIndex : null;
        else this.selectedIndex = null;
        this.conditionKeyword = "";
      }
      catch (error) {
        this.conditions = [];
        console.error("conditions fetch error: ", error);
        this.selectedIndex = (this.conditions.length > 0) ? 0 : null;
      }
    },
    async fetchConditionsByKeyword(keyword) {
      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
        const response = await axios.get(API_BASE_URL + "/conditions/search-conditions-by-keyword", {params: {keyword}});
        this.conditions = response.data.data.conditions;

        if (this.conditions.length > 0) this.selectedIndex = (this.selectedIndex < this.conditions.length) ? this.selectedIndex : null;
        else this.selectedIndex = "";
        this.machineKeyword = "";
      }
      catch (error) {
        this.conditions = [];
        console.error("conditions fetch error: ", error);
        this.selectedIndex = (this.conditions.length > 0) ? 0 : null;
      }
    },
    async deleteCondition(condition_index) {
      if (!confirm("確認要刪除 " + this.conditions[condition_index].name + " 條件參數嗎?")){
        return;
      }
      
      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
        const response = await axios.get(API_BASE_URL + "/conditions/delete-condition-by-id", {params: {condition_id: this.conditions[condition_index].id}});

        if (this.selectedIndex == condition_index || this.conditions.length == 1) {
          this.selectedIndex = null;
        }
        else if (this.selectedIndex > condition_index) {
          this.selectedIndex -= 1;
        }

        this.conditions.splice(condition_index, 1);
      }
      catch (error) {
        this.conditions = [];
        console.error("conditions fetch error: ", error);
        this.selectedIndex = null;
      }
    },
    openEditWindow(condition_index) {
      this.selectedIndex = condition_index;
      this.visible = true;
    },

    // Handle window event
    updateConditionData() {
      this.fetchConditionsByKeyword("");
      if (this.selectedIndex != null) {
        this.selectConditionRow(this.selectedIndex);
      }
    },
    closeWindow() {
      this.visible = false;
    },
  }
};
</script>

<style scoped>
.Specification-Parameters-container {
  width: 90%;
  margin: 24px auto;
  padding: 24px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* 頁首 */
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.page-header h2 { margin: 0; font-size: 20px; color: #023b64; }
.page-header .subtitle { font-size: 13px; color: #888; }

/* 各欄上方的搜尋列（靠左、含前綴 label） */
.search-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.search-row label { font-size: 14px; font-weight: bold; color: #555; white-space: nowrap; }
.search-row input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.btn-search {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  background-color: #61a5d6;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.btn-search:hover { background-color: #4f93c4; }

.btn { padding: 7px 14px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
.btn.add-condition { background-color: #007bff; color: white; }
.btn.add-condition:hover { background-color: #0069d9; }
.btn.edit { margin-right: 8px; background-color: #f0ad4e; color: white; }
.btn.edit:hover { background-color: #ec9c2d; }
.btn.delete { background-color: #e15241; color: white; }
.btn.delete:hover { background-color: #d23c2a; }

/* 雙表佈局：左右 1:1 */
.table-content { display: flex; width: 100%; gap: 16px; align-items: stretch; }
.table-column { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; }

.condition-table-wrapper,
.machine-table-wrapper {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  max-height: 620px;
  display: flex;
  flex-direction: column;
}

.panel-title {
  padding: 10px 14px;
  font-weight: bold;
  color: #fff;
  background-color: #61a5d6;
  flex-shrink: 0;
}

/* 表格通用 */
.conditions-table,
.machines-table { border-collapse: collapse; table-layout: fixed; width: 100%; }
.conditions-table th, .conditions-table td,
.machines-table th, .machines-table td {
  border: 1px solid #eee;
  padding: 8px;
  word-wrap: break-word;
  text-align: center;
  font-size: 14px;
}
.conditions-table thead th,
.machines-table thead th {
  background-color: #f6f9fc;
  color: #333;
  position: sticky;
  top: 0;
  z-index: 1;
}
.conditions-table tbody tr { cursor: pointer; transition: background-color 0.2s ease; }
.conditions-table tbody tr:hover { background-color: #f5f9fd; }
.conditions-table tbody tr.selected-row { background-color: #cfe6fb; }

.conditions-table th:nth-child(1), .conditions-table td:nth-child(1) { width: 8%; }
.conditions-table th:nth-child(2), .conditions-table td:nth-child(2) { width: 22%; }
.conditions-table th:nth-child(3), .conditions-table td:nth-child(3) { width: 40%; }
.conditions-table th:nth-child(4), .conditions-table td:nth-child(4) { width: 30%; }

.list-param { line-height: 1.6; text-align: left; margin: 0; padding: 4px 0 4px 20px; }

.machines-table th:first-child, .machines-table td:first-child { width: 35%; }
.machines-table th:nth-child(2), .machines-table td:nth-child(2) { text-align: left; }

/* 讓表格本身可捲動，表頭固定 */
.condition-table-wrapper,
.machine-table-wrapper { overflow-y: auto; }
</style>