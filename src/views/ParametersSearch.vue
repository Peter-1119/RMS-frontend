<template>
    <div class="parameters-search-container">
        <div class="header-block">
            <div class="header">
                <h1>配方檢索</h1>
                <button class="home-btn" @click="saveDraft">
                    <img src="@/assets/home-icon.png" alt="回首頁" class="icon"> 回首頁
                </button>
            </div>
            <div class="header-panel">
                <div class="header-left-panel">
                    <div class="search">
                        <div class="fundamental-attribute">
                            <div class="form-group">
                                <label for="project">適用工程：</label>
                                <input class="window-input" type="text" v-model="form.specific" @click="specificsListVisible=true" readonly/>
                            </div>
                            <div class="form-group">
                                <label for="machine">適用機台：</label>
                                <input class="window-input" type="text" v-model="form.machine" @click="machineWindowVisable=true" readonly/>
                            </div>
                            <div class="form-group">
                                <label for="item">品目：</label>
                                <input class="window-input" type="text" v-model="form.item" @click="itemWindowVisable=true" readonly/>
                            </div>
                            <div class="form-group"><label for="project">程式代碼：</label><input type="text" v-model="form.item"/></div>
                        </div>
                        <div class="condition-attribute">
                            <div v-for="condition in conditions" class="form-group" :key="condition.id">
                                <label for="project">{{condition.name}}：</label>
                                <select>
                                    <option value=""></option>
                                    <option v-for="parameter in condition.parameters" :key="`${parameter}`" :value="`${parameter}`">{{ parameter }}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="header-right-panel">
                    <button class="btn search" @click="parameterSearch">查詢</button>
                </div>
            </div>
        </div>
        <div class="result-block">

        </div>
    </div>

    <SpecificListWindow
        v-if="specificsListVisible"
        :machineKeyword="machineKeyword"
        @selectSpecific="getSpecific"
        @cancel="specificsListVisible=false"
    ></SpecificListWindow>

    <MachinesListWindow 
        v-if="machineWindowVisable"
        :mode="'radio'"
        :specification="specificKeyword"
        @selectMachine="getMachine"
        @cancel="machineWindowVisable=false"
    ></MachinesListWindow>

    <ItemListWindow
        v-if="itemWindowVisable"
        @selectItem="getItemType"
        @cancel="itemWindowVisable=false"
    ></ItemListWindow>

</template>

<script>
import SpecificListWindow from '@/components/SpecificListWindow.vue';
import MachinesListWindow from '@/components/MachinesListWindow.vue';
import ItemListWindow from '@/components/ItemListWindow.vue';

export default {
    name: "ParametersSearch",
    components: {
        SpecificListWindow,
        MachinesListWindow,
        ItemListWindow,
    },
    data() {
        return {
            specificsListVisible: false,
            machineWindowVisable: false,
            itemWindowVisable: false,

            machineKeyword: "",
            specificKeyword: "",
            form: {
                specific: "",
                machine: "",
                item: "",
                code: "",
            },

            conditions: [
                {id: 1,name: "銅電式樣", parameters: ["全鍍", "多層板內外層", "局部銅電鍍", "雙面板無鍍銅品"]},
                {id: 2,name: "製品式樣", parameters: ["雙面板", "多層板外層", "雙面板無鍍銅品", "多層板內外層", "多層板內外層局部銅電鍍品", "無鍍銅品", "多層板", "多層板外層線路", "多層板外層局部銅電鍍品", "全板銅電鍍品", "局部銅電鍍品", "多層板內層", "單面板", "FP品目", "單面板雙面銅材無鍍銅"]},
                {id: 3,name: "流程", parameters: ["RTR", "RTS", "SBS"]},
                {id: 4,name: "原銅厚度", parameters: ["1", "1/2", "1/3", "1/4"]},
                {id: 5,name: "鍍銅厚度", parameters: ["8", "10", "12", "14", "15", "18"]},
                {id: 6,name: "銅材種類", parameters: ["ED銅", "非HA銅", "HA銅", "LCP材", "LCP"]},
                {id: 7,name: "乾膜種類", parameters: ["ADC-301", "FF-1030", "HS-930", "HW-630", "AQ-209A", "HY-920", "ADW-401", "H-9540", "FF-1040", "FF-1020", "AQ-1558"]},
                {id: 8,name: "銅材疊構厚度：CU/PI/CU、CU/PI", parameters: ["0.5oz", "1oz", "2oz", "3oz", "5oz"]},
            ],
        }
    },
    methods: {
        getSpecific(payload) {
            if (payload) {
                this.form.specific = payload;
                this.specificKeyword = payload;
                console.log("specificKeyword: ", this.specificKeyword);
            }
            else {
                this.form.specific = "";
                this.specificKeyword = "";
            }
        },
        getMachine(payload) {
            if (payload) {
                const entries = Object.entries(payload[0]);
                const [mn, mc] = entries[0];
                this.form.machine = mn;
                this.machineKeyword = mn;
            }
            else {
                this.form.machine = "";
                this.machineKeyword = "";
            }
        }
    }
}

</script>

<style scoped>

.parameters-search-container { width: 95%; margin: auto; justify-content: center; padding: 20px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
.header-block { margin-bottom: 20px; padding: 8px; }
.header-panel { display: flex; }
.header-left-panel { width: 90%; }
.header-right-panel { display: flex; width: 10%; align-items: center; justify-content: center; }
.header-right-panel .btn { 
    padding: 12px 25px; 
    font-size: 16px; 
    background-color: #007bff; 
    color: white; 
    border: none; 
    border-radius: 5px; 
    cursor: pointer;
    transition: background-color 0.3s ease;
}
.header-right-panel .btn:hover { background-color: #0056b3 }

.header { display: flex; justify-content: space-between; border-radius: 5px; margin-bottom: 14px; }
.header h1 { margin: 0; }
.header button { display: flex; background-color: #ffffff; padding: 10px 18px; gap: 5px; border: 1px solid #000; border-radius: 6px; }
.header img { width: 18px; height: 18px; }

.fundamental-attribute { display: flex; }
.form-group { margin-right: 12px; align-items: center; }
.form-group input { padding: 6px; border-radius: 4px; }
.form-group .window-input { cursor: pointer; }

.condition-attribute { display: flex; flex-wrap: wrap; }
.condition-attribute .form-group { display: flex; margin-top: 12px; }
.condition-attribute select { padding: 6px; font-size: 15px ; border-radius: 4px; }


</style>