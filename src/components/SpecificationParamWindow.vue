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
          <!-- Specification search & picker -->
          <div class="form-section specification-section">
            <label for="processSelect">選擇適用工程:</label>

            <div class="specific-input-block">
              <input
                type="text"
                v-model="specSearchKeyword"
                placeholder="請輸入關鍵字"
                @keyup.enter="fetchSpecifications(specSearchKeyword)"
              />
              <button class="btn search" @click="fetchSpecifications(specSearchKeyword)">搜尋</button>
            </div>

            <div v-if="selectVisible" class="select-block">
              <ul v-if="specificationOptions.length">
                <li
                  v-for="opt in specificationOptions"
                  :key="opt.code"
                  @click="specificationSelect(opt.code)"
                >
                  {{ opt.name }}（{{ opt.code }}）
                </li>
              </ul>
              <div v-else class="empty">查無工程</div>
            </div>

            <div v-if="selectedSpecCode" class="mt-2 text-muted">
              已選工程：{{ selectedSpecName || '—' }}（{{ selectedSpecCode }}）
            </div>
          </div>

          <!-- Available machines (NEW model: gCode -> { name, machines: { mCode -> { name } } }) -->
          <div class="form-section machine-list-section">
            <h4>未選機台</h4>
            <div class="scrollable-list">
              <details v-for="(gi, gCode) in availableGroups" :key="gCode">
                <summary class="machine-group-item">
                  <input
                    type="checkbox"
                    :checked="isGroupChecked(gCode)"
                    @change="checkGroupMachines(gCode, $event.target.checked)"
                  />
                  <span>{{ gi.name }}（{{ gCode }}）</span>
                </summary>

                <div
                  v-for="(mi, mCode) in gi.machines"
                  :key="mCode"
                  class="machine-list-item"
                >
                  <input
                    type="checkbox"
                    :checked="isMachineChecked(gCode, mCode)"
                    @change="checkMachine(gCode, mCode, $event.target.checked)"
                  />
                  <span>{{ mi.name }}（{{ mCode }}）</span>
                </div>
              </details>
            </div>
            <button class="btn move-btn" @click="addSelectedMachines">新增至已選 >></button>
          </div>

          <!-- Selected machines (same new model) -->
          <div class="form-section machine-list-section">
            <h4>已選機台</h4>
            <div class="scrollable-list">
              <template v-for="(gi, gCode) in selectedGroups" :key="gCode">
                <div v-for="(mi, mCode) in gi.machines" :key="mCode" class="machine-item">
                  <span>{{ mi.name }}（{{ mCode }}）</span>
                  <button class="remove-btn" @click="removeMachine(gCode, mCode)">x</button>
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
    condition: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      // condition
      localCondition: {},

      // spec search/pick
      selectVisible: false,
      specificationOptions: [],  // [{ code, name }]
      specSearchKeyword: "",
      selectedSpecCode: "",
      selectedSpecName: "",

      // machine lists (normalized NEW model everywhere internally)
      // shape: { [groupCode]: { name: <groupName>, machines: { [machineCode]: { name: <machineName> } } } }
      allGroups: {},
      availableGroups: {},
      selectedGroups: {},
      machinesChecked: {},  // same shape as availableGroups but contains only checked items

      // track original in DB to build add/delete payloads correctly
      selectedGroupsInDB: {},

      // deltas to send to backend (NEW model)
      machinesToAdd: {},     // { gCode: { name, machines: { mCode: { name } } } }
      machinesToDelete: {},  // same

      // condition parameters UI
      newParameter: '',
    };
  },
  created() {
    this.conditionLoading();
  },
  methods: {
    // ------------------ Normalizers ------------------
    // OLD -> NEW shape: groups keyed by group_name with { code, machines: { machine_name: { code } } }
    // Convert to: { [groupCode]: { name: groupName, machines: { [machineCode]: { name: machineName } } } }
    _normalizeOldGroups(oldObj) {
      const out = {};
      Object.entries(oldObj || {}).forEach(([gName, gInfo]) => {
        const gCode = (gInfo?.code || '').trim();
        const machines = {};
        Object.entries(gInfo?.machines || {}).forEach(([mName, mInfo]) => {
          const mCode = (mInfo?.code || '').trim();
          if (mCode) machines[mCode] = { name: mName };
        });
        if (gCode) out[gCode] = { name: gName, machines };
      });
      return out;
    },

    // NEW shape passthrough (already desired shape)
    _normalizeNewGroups(newObj) {
      // Ensure names/codes are trimmed
      const out = {};
      Object.entries(newObj || {}).forEach(([gCode, gInfo]) => {
        const machines = {};
        Object.entries(gInfo?.machines || {}).forEach(([mCode, mInfo]) => {
          machines[(mCode || '').trim()] = { name: (mInfo?.name || mCode || '').trim() };
        });
        out[(gCode || '').trim()] = { name: (gInfo?.name || gCode || '').trim(), machines };
      });
      return out;
    },

    // Shallow union-add machines from src -> dst (same NEW model keys)
    _mergeMachines(dst, src) {
      Object.entries(src || {}).forEach(([gCode, gInfo]) => {
        if (!dst[gCode]) dst[gCode] = { name: gInfo.name, machines: {} };
        Object.entries(gInfo.machines || {}).forEach(([mCode, mInfo]) => {
          dst[gCode].machines[mCode] = { name: mInfo.name };
        });
      });
    },

    // Remove machines from obj if present
    _subtractMachines(obj, toRemove) {
      Object.entries(toRemove || {}).forEach(([gCode, gInfo]) => {
        if (!obj[gCode]) return;
        Object.keys(gInfo.machines || {}).forEach(mCode => {
          delete obj[gCode].machines[mCode];
        });
        if (!Object.keys(obj[gCode].machines).length) delete obj[gCode];
      });
    },

    // ------------------ Specs ------------------
    async fetchSpecifications(keyword) {
      try {
        const API = import.meta.env.VITE_APP_API_BASE_URL;
        const { data } = await axios.get(`${API}/mes/specifics`, {
          params: { keyword, machine: this.machineKeyword }
        });
        const specsObj = data?.data?.specifics || {};
        this.specificationOptions = Object.entries(specsObj).map(([code, v]) => ({
          code: (code || '').trim(),
          name: (v?.name || code || '').trim(),
        }));
        this.selectVisible = this.specificationOptions.length > 0;
      } catch (e) {
        console.error("Specifics fetch error:", e);
        this.specificationOptions = [];
        this.selectVisible = false;
      }
    },

    async specificationSelect(specCode) {
      const item = this.specificationOptions.find(x => x.code === specCode);
      this.selectedSpecCode = specCode || "";
      this.selectedSpecName = item?.name || specCode || "";
      await this.fetchGroupMachines(specCode);
    },

    // ------------------ Machines (available) ------------------
    async fetchGroupMachines(specCode) {
      this.availableGroups = {};
      this.machinesChecked = {};
      this.allGroups = {};

      try {
        const API = import.meta.env.VITE_APP_API_BASE_URL;
        // /mes/groups-machines (NEW shape) with { specific: <specCode> }
        const resp = await axios.get(`${API}/mes/groups-machines`, { params: { specific: specCode } });
        const groupsPayload = resp?.data?.data?.groups || {};
        // normalize (already new shape; still trim/guard)
        this.allGroups = this._normalizeNewGroups(groupsPayload);
      } catch (e) {
        console.error("groups-machines fetch error:", e);
        this.allGroups = {};
      }

      // Build available = all - selected
      const available = JSON.parse(JSON.stringify(this.allGroups)); // shallow clone
      this._subtractMachines(available, this.selectedGroups);      // remove already selected
      this.availableGroups = available;
    },

    // ------------------ Machines (selected in DB) ------------------
    async fetchConditionMachines(condition_id) {
      try {
        const API = import.meta.env.VITE_APP_API_BASE_URL;
        const resp = await axios.get(`${API}/conditions/get-condition-machines`, { params: { condition_id }});
        const groupsOld = resp?.data?.data?.groups || {};
        // convert OLD shape -> NEW internal shape
        this.selectedGroups = this._normalizeOldGroups(groupsOld);
        this.selectedGroupsInDB = JSON.parse(JSON.stringify(this.selectedGroups)); // snapshot
      } catch (e) {
        console.error("get-condition-machines error:", e);
        this.selectedGroups = {};
        this.selectedGroupsInDB = {};
      }

      // Since availableGroups depends on selectedGroups and chosen spec:
      if (this.selectedSpecCode) {
        await this.fetchGroupMachines(this.selectedSpecCode);
      }
    },

    // ------------------ Condition init ------------------
    async conditionLoading() {
      if (!this.condition || this.condition.id == null) {
        this.localCondition = { id: -1, name: '', parameters: [] };
        this.selectedGroups = {};
        this.selectedGroupsInDB = {};
      } else {
        this.localCondition = {
          id: this.condition.id,
          name: this.condition.name,
          parameters: (this.condition.parameters || []).map(n => n)
        };
        await this.fetchConditionMachines(this.condition.id);
      }
    },

    // ------------------ Checkbox helpers ------------------
    isMachineChecked(gCode, mCode) {
      return !!this.machinesChecked[gCode]?.machines?.[mCode];
    },
    checkMachine(gCode, mCode, isChecked) {
      const mName = this.availableGroups[gCode]?.machines?.[mCode]?.name || '';
      if (!mName) return;

      if (!this.machinesChecked[gCode]) {
        this.machinesChecked[gCode] = { name: this.availableGroups[gCode].name, machines: {} };
      }
      if (isChecked) {
        this.machinesChecked[gCode].machines[mCode] = { name: mName };
      } else {
        delete this.machinesChecked[gCode].machines[mCode];
        if (!Object.keys(this.machinesChecked[gCode].machines).length) {
          delete this.machinesChecked[gCode];
        }
      }
    },
    isGroupChecked(gCode) {
      const availCnt = Object.keys(this.availableGroups[gCode]?.machines || {}).length;
      const checkedCnt = Object.keys(this.machinesChecked[gCode]?.machines || {}).length;
      return availCnt > 0 && availCnt === checkedCnt;
    },
    checkGroupMachines(gCode, isChecked) {
      if (isChecked) {
        const gi = this.availableGroups[gCode];
        const machines = {};
        Object.entries(gi?.machines || {}).forEach(([mCode, mi]) => { machines[mCode] = { name: mi.name }});
        this.machinesChecked[gCode] = { name: gi.name, machines };
      } else {
        delete this.machinesChecked[gCode];
      }
    },

    // ------------------ Move -> Selected ------------------
    addSelectedMachines() {
      if (!Object.keys(this.machinesChecked).length) return;

      // merge into selectedGroups
      this._mergeMachines(this.selectedGroups, this.machinesChecked);

      // build delta: machinesToAdd = (selected - selectedInDB)
      // copy checked first, then prune any that already exists in DB
      const addBuf = JSON.parse(JSON.stringify(this.machinesChecked));
      // prune already in DB
      Object.entries(addBuf).forEach(([gCode, gInfo]) => {
        Object.keys(gInfo.machines).forEach(mCode => {
          if (this.selectedGroupsInDB[gCode]?.machines?.[mCode]) {
            delete addBuf[gCode].machines[mCode];
          }
        });
        if (!Object.keys(addBuf[gCode].machines).length) delete addBuf[gCode];
      });
      this._mergeMachines(this.machinesToAdd, addBuf);

      // remove any to-add from machinesToDelete (undo delete)
      Object.entries(this.machinesToDelete).forEach(([gCode, gInfo]) => {
        Object.keys(gInfo.machines).forEach(mCode => {
          if (this.machinesChecked[gCode]?.machines?.[mCode]) {
            delete this.machinesToDelete[gCode].machines[mCode];
          }
        });
        if (!Object.keys(this.machinesToDelete[gCode].machines).length) delete this.machinesToDelete[gCode];
      });

      // remove from available
      this._subtractMachines(this.availableGroups, this.machinesChecked);

      // clear checked buffer
      this.machinesChecked = {};
    },

    // ------------------ Remove from Selected ------------------
    removeMachine(gCode, mCode) {
      const mName = this.selectedGroups[gCode]?.machines?.[mCode]?.name || '';
      if (!mName) return;

      // return to available if present in allGroups (spec scope)
      if (this.allGroups[gCode]) {
        if (!this.availableGroups[gCode]) {
          this.availableGroups[gCode] = { name: this.allGroups[gCode].name, machines: {} };
        }
        this.availableGroups[gCode].machines[mCode] = { name: mName };
      }

      // delta add: if it was going to be added, cancel that
      if (this.machinesToAdd[gCode]?.machines?.[mCode]) {
        delete this.machinesToAdd[gCode].machines[mCode];
        if (!Object.keys(this.machinesToAdd[gCode].machines).length) delete this.machinesToAdd[gCode];
      }

      // delta delete: if it exists in DB snapshot, mark delete
      if (this.selectedGroupsInDB[gCode]?.machines?.[mCode]) {
        if (!this.machinesToDelete[gCode]) {
          this.machinesToDelete[gCode] = { name: this.selectedGroups[gCode].name, machines: {} };
        }
        this.machinesToDelete[gCode].machines[mCode] = { name: mName };
      }

      // remove from selected
      delete this.selectedGroups[gCode].machines[mCode];
      if (!Object.keys(this.selectedGroups[gCode].machines).length) delete this.selectedGroups[gCode];
    },

    // ------------------ Condition parameters ------------------
    addParameter() {
      const p = (this.newParameter || '').trim();
      if (p && !this.localCondition.parameters.includes(p)) {
        this.localCondition.parameters.push(p);
        this.newParameter = '';
      }
    },
    removeParameter(idx) {
      this.localCondition.parameters.splice(idx, 1);
    },

    // ------------------ Save ------------------
    async saveCondition() {
      if (!this.localCondition.name?.trim()) {
        alert("條件名稱不能為空。");
        return;
      }
      if ((this.localCondition.parameters || []).some(p => !p.trim())) {
        alert("條件細項不能包含空值。");
        return;
      }

      // Param diffs
      let parametersToAdd = [];
      let parametersToDelete = [];
      if (this.localCondition.id === -1) {
        parametersToAdd = this.localCondition.parameters;
      } else {
        const original = new Set(this.condition?.parameters || []);
        const local = new Set(this.localCondition.parameters || []);
        for (const p of local) if (!original.has(p)) parametersToAdd.push(p);
        for (const p of original) if (!local.has(p)) parametersToDelete.push(p);
      }

      const conditionNameUpdate =
        this.localCondition.id === -1 ||
        (this.localCondition.name.trim() !== (this.condition?.name || '').trim());

      const conditionMachinesUpdate =
        Object.keys(this.machinesToAdd).length > 0 || Object.keys(this.machinesToDelete).length > 0;

      const conditionParametersUpdate =
        parametersToAdd.length > 0 || parametersToDelete.length > 0;

      if (conditionNameUpdate || conditionMachinesUpdate || conditionParametersUpdate) {
        const formData = new FormData();
        formData.append('condition-id', this.localCondition.id);
        if (conditionNameUpdate) {
          formData.append('condition-name', this.localCondition.name.trim());
        }
        if (conditionMachinesUpdate) {
          // send NEW model: { gCode: { name, machines: { mCode: { name } } } }
          formData.append('condition-machines', JSON.stringify({
            machinesToAdd: this.machinesToAdd,
            machinesToDelete: this.machinesToDelete,
          }));
        }
        if (conditionParametersUpdate) {
          formData.append('condition-parameters', JSON.stringify({
            parametersToAdd, parametersToDelete
          }));
        }

        console.log("machinesToDelete:", this.machinesToDelete);

        try {
          const API = import.meta.env.VITE_APP_API_BASE_URL;
          const resp = await axios.post(`${API}/conditions/update-condition-data`, formData);
          console.log("update-condition-data:", resp?.data);
        } catch (e) {
          console.error("saveCondition error:", e);
        }
      }

      this.$emit('update-condition-data');
      this.$emit('cancel');
    },

    closeWindow() {
      this.$emit('cancel');
    },
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