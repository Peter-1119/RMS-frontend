<template>
    <div class="Specification-Parameters-container">
        <div class="top-controls">
            <div class="input-action-layout">
                <p>關鍵字：</p>
                <input type="text" placeholder="請輸入機台關鍵字" v-model="machineKeyword" @keyup.enter="fetchConditions(machineKeyword)"/>
                <button class="btn-search" @click="fetchConditions(machineKeyword)">搜尋</button>
            </div>
            <div class="btn-action-layout">
                <button class="btn add-condition" @click="openEditWindow(null)">新增條件</button>
            </div>
        </div>
        
        <div class="table-content">
            <div class="condition-table-wrapper">
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

            <div class="machine-table-wrapper">
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

        <SpecificationParamWindow 
            v-if="visible"
            :condition="conditions[selectedIndex]"
            @update-condition-data="updateConditionData"
            @cancel="closeWindow">
            <template #header>
                <h3>{{ this.selectedIndex != null ? '編輯條件' : '新增條件' }}</h3>
            </template>
        </SpecificationParamWindow>
    </div>
</template>

<script>
import axios from 'axios';
import SpecificationParamWindow from '@/components/SpecificationParamWindow.vue';

export default {
    name: "SpecificationParamPage",
    components: {
        SpecificationParamWindow
    },
    data() {
        return {
            machineKeyword: "",
            conditions: [],
            groups: {},
            results: [],
            visible: false,
            selectedIndex: null,
        };
    },
    async mounted() {
        this.fetchConditions("");
    },
    methods: {
        async selectConditionRow(condition_index) {
            this.selectedIndex = condition_index;

            if (condition_index == null) {
                return;
            }

            try {
                const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
                const response = await axios.get(API_BASE_URL + "/conditions/get-condition-machines", {params: {condition_id: this.conditions[condition_index].id}});
                this.groups = response.data.data.groups;
            }

            catch (error) {
                this.groups = {};
            }
        },
        async fetchConditions(keyword) {
            try {
                // console.log("GET /conditions/search-conditions-by-machines.")
                const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
                const response = await axios.get(API_BASE_URL + "/conditions/search-conditions-by-machines", {params: {keyword}});
                this.conditions = response.data.data.conditions;

                if (this.conditions.length > 0) {
                    this.selectedIndex = (this.selectedIndex < this.conditions.length) ? this.selectedIndex : null;
                }
                else {
                    this.selectedIndex = null;
                }
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
                console.log("刪除狀態: ", response);
                console.log("刪除狀態: ", response.data.data.message);

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

        //  Handle window event
        updateConditionData() {
            this.fetchConditions("");
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
.top-controls { display: flex; justify-content: space-between; margin-bottom: 20px; text-align: right; align-items: center; }
.top-controls input { padding: 4px; font-size: 15px; border-radius: 4px; margin-right: 12px; }
.top-controls p { margin: 0; }
.btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; }
.btn.add-condition { background-color: #4CAF50; color: white; }
.btn.save-conditions { background-color: #008CBA; color: white; }
.btn.edit { margin: 0 10px 0 0;background-color: #ff9800; color: white; }
.btn.delete { margin: 0 0 0 10px; background-color: #f44336; color: white; }

.input-action-layout { display: flex; }

.Specification-Parameters-container { width: 90%; margin: 30px auto; padding: 25px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
.table-content { display: flex; width: 100%; vertical-align: top;}

.condition-table-wrapper { margin-right: 8px; max-height: 600px; overflow-y: auto; }
.conditions-table th, .conditions-table td { border: 1px solid #ddd; padding: 8px; word-wrap: break-word; text-align: center; }
.conditions-table th { background-color: #f2f2f2; }
.conditions-table tbody tr { cursor: pointer; transition: background-color 0.3s ease; }
.conditions-table tbody tr:hover { background-color: #f5f5f5; }
.conditions-table tbody tr.selected-row { background-color: #e0f7fa; }

.conditions-table { border-collapse: collapse; table-layout: fixed; width: 100%}
.conditions-table th:first-child, .conditions-table td:first-child { width: 5%; }
.conditions-table th:nth-child(1), .conditions-table td:nth-child(1) { width: 5%; }
.conditions-table th:nth-child(2), .conditions-table td:nth-child(2) { width: 10%; }
.conditions-table th:nth-child(3), .conditions-table td:nth-child(3) { width: 20%; }
.conditions-table th:nth-child(4), .conditions-table td:nth-child(4) { width: 15%; }

.header h3 { padding-bottom: 0px; margin: 0px; }

.list-item { line-height: 1.5; text-align: center; }
.list-param { line-height: 1.5; text-align: left; margin: 0; padding: 8px 0px 8px 24px; }

.machine-table-wrapper { margin-left: 8px; flex-grow: 1; max-height: 600px; overflow-y: auto; }
.machines-table{ border-collapse: collapse; table-layout: fixed; width: 100%;}
.machines-table th, .machines-table td { border: 1px solid #ddd; padding: 8px; word-wrap: break-word; text-align: center;}
.machines-table th { background-color: #f2f2f2; }

.machines-table th:first-child, .machines-table td:first-child { width: 20%; }
.machines-table th:nth-child(2), .machines-table td:nth-child(2) { width: 30%; text-align: left;}
</style>