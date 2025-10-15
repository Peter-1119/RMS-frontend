<template>
	<div class="specification-window-wrapper" @click.self="closeWindow">
		<div class="specification-dialog" @click="selectVisible=false">
			<div class="header">
				<slot name="header"></slot>
			</div>

			<div class="content-split">
				<div class="content-left">
					<div class="form-section">
						<label for="conditionName">條件名稱:</label>
						<input type="text" id="conditionName" v-model="localCondition.name" />
					</div>

					<div class="form-section">
						<h4>條件細項清單:</h4>
						<div class="scrollable-list">
							<div v-for="(param, index) in localCondition.parameters" :key="index" class="list-item">
								<input type="text" v-model="localCondition.parameters[index]" />
								<button class="remove-btn" @click="removeParameter(index)">×</button>
							</div>
						</div>
						<div class="add-new-param">
							<input type="text" v-model="newParameter" placeholder="請輸入新細項" @keyup.enter="addParameter" />
							<button class="btn add-item" @click="addParameter">新增細項</button>
						</div>
					</div>
				</div>

				<div class="content-right">
					<div class="form-section specification-section">
						<label for="processSelect">選擇適用工程:</label>
                        <div class="specific-input-block">
                            <input type="text" v-model="selectedSpecification" placeholder="請輸入關鍵字" @keyup.enter="fetchSpecifications(selectedSpecification)"/>
                            <button class="btn search" @click="fetchSpecifications(selectedSpecification)">搜尋</button>
                        </div>
                        <div v-if="selectVisible" class="select-block">
                            <ul v-if="Object.entries(specificationOptions).length > 0">
                                <li v-for="([sn, si]) in Object.entries(specificationOptions)" :key="si.code" @click="specificationSelect(sn)">{{ sn }}</li>
                            </ul>
                        </div>
					</div>

                    <div class="form-section machine-list-section">
                        <h4>未選機台</h4>
                        <div class="scrollable-list">
                            <details v-for="(gi, gn) in availableGroups" :key="gi.code">
                                <summary class="machine-group-item">
                                    <input type="checkbox" :checked="isGroupChecked(gn)" @change="checkGroupMachines(gn, $event.target.checked)"/>
                                    <span>{{ gn }}</span>
                                </summary>

                                <div v-for="(mi, mn) in gi.machines" class="machine-list-item" :key="mi.code">
                                    <input type="checkbox" :checked="isMachineChecked(gn, mn)" @change="checkMachine(gn, mn, $event.target.checked)"/>
                                    <span>{{ mn }}</span>
                                </div>
                            </details>
                        </div>
                        <button class="btn move-btn" @click="addSelectedMachines">新增至已選 >></button>
                    </div>

                    <div class="form-section machine-list-section">
                        <h4>已選機台</h4>
                        <div class="scrollable-list">
                            <template v-for="(gi, gn) in selectedGroups" :key="gi.code">
                                <div v-for="(mi, mn) in gi.machines" :key="mi.code" class="machine-item">
                                    <span>{{ mn }}</span>
                                    <button class="remove-btn" @click="removeMachine(gn, mn)">x</button>
                                </div>
                            </template>
                        </div>
                    </div>
				</div>
			</div>

			<div class="footer">
				<button class="btn confirm" @click="saveCondition">儲存</button>
				<button class="btn cancel" @click="closeWindow">取消</button>
			</div>
		</div>
	</div>
</template>

<script>
import axios from 'axios';

export default {
	name: "SpecificationParamWindow",
	emits: ['update-condition-data', 'cancel'],
	props: {
        condition: { type: Object, default: () => {} },
	},
	data() {
		return {
			localCondition: {},  // local condition storage 

            selectVisible: false,
            specificationOptions: {},
            selectedSpecification: "",

			allGroups: {},  // request all machines
            selectedGrouposInDB: {},  // temp for import machines from database
            machinesToAdd: {},
            machinesToDelete: {},  // temp for delete machines

            availableGroups: {},  // Display non-selected machines
            machinesChecked: {},  // Display for machines checkbox
            selectedGroups: {},  // Display selected machines

			newParameter: '',  // new condition parameter you want to add
		};
	},
	created() {
        this.conditionLoading();
	},
	methods: {
        //  API Function  //
        async fetchSpecifications(keyword) {
            try{
                const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
                const response = await axios.get(API_BASE_URL + "/MES-get-specifics", {params: {keyword, machine: this.machineKeyword}});
                this.specificationOptions = response.data.data.specifics;
                console.log("specificaion options: ", this.specificationOptions);

                if (Object.entries(this.specificationOptions).length > 0) {
                    this.selectVisible = true;
                }
                else {
                    this.selectVisible = false;
                }
            }
            catch (error) {
                console.error("Specifics fetch error: ", error);
                this.specificationOptions = [];
            }
        },
        async specificationSelect(specification) {
            this.selectedSpecification = specification;
            await this.fetchGroupMachines(specification);
        },
        async fetchGroupMachines(specification) {
            this.availableGroups = {};
            this.machinesChecked = {};
            this.allGroups = {};

            try{
                const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
                const response = await axios.get(API_BASE_URL + "/MES-get-groups-machines", {params: {specific: specification}});
                this.allGroups = response.data.data.groups;
                console.log("allGroups: ", this.allGroups);
            }
            catch (error) {
                console.error("Specifics fetch error: ", error);
                return;
            }

            Object.entries(this.allGroups).forEach(([gn, gi]) => {
                if (!this.selectedGroups[gn]) {
                    let machines = {};
                    Object.entries(gi.machines).forEach(([mn, mi]) => { machines[mn] = {"code": mi.code} })
                    this.availableGroups[gn] = {code: gi.code, machines};
                }
                else {
                    let machines = {};
                    let selectedMachines = Object.keys(this.selectedGroups[gn].machines);
                    if (Object.keys(gi.machines).length != selectedMachines.length) {
                        Object.entries(gi.machines).forEach(([mn, mi]) => {
                            if (!selectedMachines.some(machine => mn == machine)) {
                                machines[mn] = {"code": mi.code};
                            }
                        })
                        this.availableGroups[gn] = {code: gi.code, machines};
                    }
                }
            })
        },
        async fetchConditionMachines(condition_id) {
            try {
                const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
                const response = await axios.get(API_BASE_URL + "/get-condition-machines", {params: {condition_id}});
                this.groups = response.data.data.groups;
            }

            catch (error) {
                this.groups = {};
            }

            this.selectedGroups = {};
            this.selectedGrouposInDB = {}
            Object.entries(this.groups).forEach(([gn, gi]) => {
                this.selectedGroups[gn] = {code: gi.code, machines: {}};
                Object.entries(gi.machines).forEach(([mn, mi]) => { this.selectedGroups[gn].machines[mn] = {"code": mi.code} })

                this.selectedGrouposInDB[gn] = {code: gi.code, machines: {}};
                Object.entries(gi.machines).forEach(([mn, mi]) => { this.selectedGrouposInDB[gn].machines[mn] = {"code": mi.code} })
            })
        },

        // Load condition and parameters from backend
        async conditionLoading() {
            this.selectedGroups = {};  
            if (!this.condition || this.condition.id == null){
                this.localCondition = { id: -1, name: '', parameters: []};
            }

            else {
                this.localCondition = {id: this.condition.id, name: this.condition.name, parameters: this.condition.parameters.map(n => n)};
                this.fetchConditionMachines(this.condition.id);
            }
        },

        // Check machine checkbox is check or not based on existing in "machinesChecked" object
        isMachineChecked(group, machine) {
            return this.machinesChecked[group] && this.machinesChecked[group].machines[machine] != undefined;
        },
        // Check action for machine checkbox
        checkMachine(group, machine, isChecked) {
            const machineCode = this.availableGroups[group].machines[machine].code; 
            if (!this.machinesChecked[group]) {
                this.machinesChecked[group] = { code: this.availableGroups[group].code, machines: {} };
            }

            if (isChecked){
                this.machinesChecked[group].machines[machine] = { code: machineCode };
            }
            else {
                delete this.machinesChecked[group].machines[machine];
                if (Object.keys(this.machinesChecked[group].machines).length == 0) {
                    delete this.machinesChecked[group];
                }
            }
        },

        // Check group checkbox is check or not based on existing in "machinesChecked" object
        isGroupChecked(group) {
            const availableCount = Object.keys(this.availableGroups[group]?.machines || {}).length;
            const addedCount = Object.keys(this.machinesChecked[group]?.machines || {}).length;
            return availableCount == addedCount;
        },
        // Check action for group checkbox
        checkGroupMachines(group, isChecked) {
            if (isChecked) {
                let machines = {};
                Object.entries(this.availableGroups[group].machines).forEach(([mn, mi]) => { machines[mn] = {"code": mi.code}})
                this.machinesChecked[group] = { code: this.availableGroups[group].code, machines };
            }
            else {
                delete this.machinesChecked[group];
            }
        },

		//  Fundamental Function  //
		addParameter() {
			const trimmedParam = this.newParameter.trim();
			if (trimmedParam && !this.localCondition.parameters.includes(trimmedParam)) {
				this.localCondition.parameters.push(trimmedParam);
				this.newParameter = '';
			}
		},
		removeParameter(index) {
			this.localCondition.parameters.splice(index, 1);
		},

		addSelectedMachines() {
            Object.entries(this.machinesChecked).forEach(([gn, gi]) => {
                if (!this.selectedGroups[gn]) {
                    this.selectedGroups[gn] = {code: gi.code, machines: {}};
                }

                // Process add machine list
                let noGroup = false;
                if (!this.selectedGrouposInDB[gn]) {
                    this.machinesToAdd[gn] = {code: this.selectedGroups[gn].code, machines: {}};
                    noGroup = true;
                }

                console.log("noGroup: ", noGroup);
                Object.entries(gi.machines).forEach(([mn, mi]) => {
                    this.selectedGroups[gn].machines[mn] = {"code": mi.code};

                    // Process add machine list  ##########################################  刪掉資料庫擁有的機台後加入 this.machinesToAdd 會添加 應該要 不增加
                    if (noGroup || Object.keys(this.selectedGrouposInDB[gn].machines).every(machine => mn != machine)) {
                        if (!this.machinesToAdd[gn]) {
                            this.machinesToAdd[gn] = {code: gi.code, machines: {}}
                        }
                        this.machinesToAdd[gn].machines[mn] = {"code": mi.code};
                    }

                    // Process delete machine list
                    if (this.machinesToDelete[gn] && this.machinesToDelete[gn].machines[mn]) {
                        delete this.machinesToDelete[gn].machines[mn];
                    }
                })

                // Process delete machine list
                if (this.machinesToDelete[gn] && Object.keys(this.machinesToDelete[gn].machines).length == 0) {
                    delete this.machinesToDelete[gn];
                }

                Object.keys(gi.machines).forEach(machineName => {
                    delete this.availableGroups[gn].machines[machineName];
                });
                
                if (Object.keys(this.availableGroups[gn].machines).length === 0) {
                    delete this.availableGroups[gn];
                }
            })
            this.machinesChecked = {};
		},
		removeMachine(group, machine) {
            if (this.allGroups[group] && this.availableGroups[group]){
                this.availableGroups[group].machines[machine] = {code: this.selectedGroups[group].machines[machine].code};
            }

            else if (this.allGroups[group] && !this.availableGroups[group]) {
                this.availableGroups[group] = {code: this.selectedGroups[group].code, machines: {}};
                this.availableGroups[group].machines[machine] = {code: this.selectedGroups[group].machines[machine].code};
            }

            // Process add machine list
            if (this.machinesToAdd[group] && this.machinesToAdd[group].machines[machine]) {
                delete this.machinesToAdd[group].machines[machine];

                if (Object.keys(this.machinesToAdd[group].machines).length == 0) {
                    delete this.machinesToAdd[group];
                }
            }

            // Process delete machine list
            if (this.selectedGrouposInDB[group] && this.selectedGrouposInDB[group].machines[machine]) {
                if (!this.machinesToDelete[group]) {
                    this.machinesToDelete[group] = {code: this.selectedGroups[group].code, machines: {}};
                }
                this.machinesToDelete[group].machines[machine] = {code: this.selectedGroups[group].machines[machine].code};
            }

            delete this.selectedGroups[group].machines[machine];
		},

		async saveCondition() {
			if (!this.localCondition.name.trim()) {
				alert("條件名稱不能為空。");
				return;
			}
			if (this.localCondition.parameters.some(p => !p.trim())) {
				alert("條件細項不能包含空值。");
				return;
			}

            // Update parameters of condition
            let parametersToAdd = [];
            let parametersToDelete = [];
            if (this.localCondition.id == -1) {
                parametersToAdd = this.localCondition.parameters;
            }
            else {
                const originalParameters = new Set(this.condition.parameters || []);
                const localParameters = new Set(this.localCondition.parameters || []);

                for (const param of localParameters) {
                    if (!originalParameters.has(param)) {
                        parametersToAdd.push(param);
                    }
                }

                for (const param of originalParameters) {
                    if (!localParameters.has(param)) {
                        parametersToDelete.push(param);
                    }
                }
            }

            // Update condition data
            const conditionNameUpdate = (this.localCondition.id == -1) || (this.localCondition.name.trim() != this.condition.name.trim());
            const conditionMachinesUpdate = Object.keys(this.machinesToAdd).length > 0 || Object.keys(this.machinesToDelete).length > 0;
            const conditionParametersUpdate = parametersToAdd.length > 0 || parametersToDelete.length > 0;
            if (conditionNameUpdate || conditionMachinesUpdate || conditionParametersUpdate){
                const formData = new FormData();
                try{
                    formData.append('condition-id', this.localCondition.id);
                    if (conditionNameUpdate) {
                        formData.append('condition-name', this.localCondition.name.trim());
                    }
                    if (conditionMachinesUpdate) {
                        formData.append('condition-machines', JSON.stringify({machinesToAdd: this.machinesToAdd, machinesToDelete: this.machinesToDelete}))
                    }
                    if (conditionParametersUpdate) {
                        formData.append('condition-parameters', JSON.stringify({parametersToAdd, parametersToDelete}));
                    }
                    const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
                    const response = await axios.post(API_BASE_URL + "/update-condition-data", formData);
                    console.log("response: ", response.data.data.message);
                }
                catch (error) {
                    console.error("response error: ", error);
                }
            }
            
            this.$emit("update-condition-data");
            this.$emit("cancel");
		},
		closeWindow() {
			this.$emit("cancel");
		}
	}
};
</script>

<style scoped>
/* 保持原有的樣式 */
.specification-window-wrapper {
	position: fixed;
	display: flex;
	justify-content: center;
	align-items: center;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 999;
	background-color: rgba(0, 0, 0, 0.5);
}

.specification-dialog { background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); width: 80%; }
.header { border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 6px; }
.footer { text-align: right; margin-top: 6px; border-top: 1px solid #eee; padding-top: 4px; }

.btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; }
.btn.confirm { background-color: #42b983; color: white; }
.btn.cancel { background-color: #ccc; color: black; }
.remove-btn { background: none; border: none; color: red; font-weight: bold; cursor: pointer; font-size: 1.2em; }
.btn.add-item { background-color: #2196F3; color: white; white-space: nowrap; }
.btn.move-btn { background-color: #4CAF50; color: white; margin-top: 10px; }

.content-split { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; flex-grow: 1; }
.content-left, .content-right { display: flex; flex-direction: column; gap: 4px; }

.form-section { display: flex; flex-direction: column; padding: 0 0 10px 0; }
.form-section label, .form-section h4 { margin: 0px; font-weight: bold; }
.form-section input[type="text"],
.form-section select { padding: 8px; border: 1px solid #ccc; border-radius: 4px; flex-grow: 1; box-sizing: border-box; }
.form-section .specific-input-block { display: flex; }

.form-section ul {
  list-style: none;
  padding: 2px 4px;
  margin: 5px 0;
  border: 1px solid #ccc;
  max-height: 200px;
  overflow-y: auto;
  background: white;
  position: absolute;
  width: 250px;
  z-index: 1000;
}
.form-section li:hover { background-color:  #007bff; color: white; cursor: pointer; }

/* 細項清單與機台清單樣式 */
.scrollable-list {
	min-height: 100px;
	max-height: 200px;
	overflow-y: auto;
	border: 1px solid #ccc;
	padding-bottom: 10px;
	border-radius: 4px;
	margin-top: 5px;
	background-color: #fff;
	/* transform: none !important; */
	/* transform: translateZ(0); */
	/* -webkit-font-smoothing: antialiased; */
	/* will-change: transform;  */
}

.list-item { display: flex; align-items: center; justify-content: space-between; padding: 5px; border-bottom: 1px solid #eee; word-wrap: break-word; overflow-wrap: break-word; }
.list-item:last-child { border-bottom: none; }
.list-item input[type="text"] { flex-grow: 1; margin-right: 10px; border: none; background: transparent; padding: 0; }
.list-item span { flex-grow: 1; text-align: left; margin-right: 10px; }

.add-new-param { display: flex; gap: 10px; margin-top: 10px; }
.add-new-param input { flex-grow: 1; }

.machine-list-section { display: flex; flex-direction: column; }
.machine-list-section h4 { margin-top: 0px; }
.machine-list-section .scrollable-list { flex-grow: 1; }

.list-item label { display: flex; align-items: center; cursor: pointer; }
.list-item input[type="checkbox"] { margin-right: 8px; }

details summary { cursor: pointer; padding: 5px; list-style: none; display: flex; align-items: center; }
details summary label { width: 100%; }
details summary::marker { display: none; }
details summary::before { content: "▶"; margin-right: 8px; transition: transform 0.2s; font-size: 0.8em; }
details[open] summary::before { transform: rotate(90deg); }

.machine-group-item { background-color: #fff; }
.machine-list-item { background-color: #fff; padding-left: 40px; }
.machine-item { display: flex; background-color: #fff; padding: 4px 0 0 12px; justify-content: space-between; }

</style>