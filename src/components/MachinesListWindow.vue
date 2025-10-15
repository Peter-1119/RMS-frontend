<template>
  <div class="window-wrapper" @click.self="closeWindow">
    <div class="dialog">
      <div class="header"><h3>適用機台選取</h3></div>

      <div class="content">
        <!-- Search -->
        <div class="search-block">
          <p>關鍵字：</p>
          <input type="text" class="search-keyword-input" v-model="keyword" placeholder="請輸入關鍵字" @keyup.enter="search"/>
        <button class="btn-search" @click="search">搜尋</button>
        </div>

        <!-- Two columns -->
        <div class="columns">
          <!-- LEFT: GROUPS -->
          <div class="col col-groups">
            <div class="col-header">
              <h4>機台群組</h4>
              <small v-if="groups.length">共 {{ groups.length }} 組</small>
            </div>

            <table class="group-table">
              <thead>
                <tr>
                  <th class="chk-col"></th>
                  <th>群組名稱</th>
                  <th class="count-col">數量</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="g in paginatedGroups" :key="g" :class="{ active: g === activeGroup }" @click="onClickGroup(g)">
                  <td class="chk-col" @click.stop>
                    <input type="checkbox" :checked="isGroupChecked(g)" :indeterminate.prop="isGroupIndeterminate(g)" @change="onToggleGroup(g, $event.target.checked)"/>
                  </td>
                  <td>{{ g }}</td>
                  <td class="count-col">{{ (groupMachines[g] || []).length }}</td>
                </tr>

                <tr v-if="searched && !groups.length">
                  <td colspan="3" class="empty">沒有符合的群組</td>
                </tr>
                <tr v-if="!searched">
                  <td colspan="3" class="empty">請輸入關鍵字後搜尋</td>
                </tr>
              </tbody>
            </table>

            <div class="page-action-block">
              <span class="icon-item prev" @click="currentGroupPage = Math.max(1, currentGroupPage - 1)" :class="{ disabled: currentGroupPage === 1 }"
              >&lt;</span>
              <label>第</label>
              <input type="number" class="page-input" v-model.number="currentGroupPage" :min="1" :max="totalGroupPages"/>
              <label>頁, 共 {{ totalGroupPages }} 頁</label>
              <span class="icon-item next" @click="currentGroupPage = Math.min(totalGroupPages, currentGroupPage + 1)" :class="{ disabled: currentGroupPage === totalGroupPages }">&gt;</span>
            </div>
          </div>

          <!-- RIGHT: MACHINES -->
          <div class="col col-machines">
            <div class="col-header">
              <h4>機台清單 <small v-if="activeGroup">（{{ activeGroup }}）</small></h4>
              <small v-if="machinesOfActiveGroup.length">共 {{ machinesOfActiveGroup.length }} 台</small>
            </div>

            <table class="machine-table">
              <thead>
                <tr>
                  <th class="chk-col"></th>
                  <th>機台代碼</th>
                  <th>機台名稱</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in paginatedMachines" :key="`${activeGroup}::${m.machine}`">
                  <td class="chk-col">
                    <input type="checkbox" :value="m.machine" v-model="selectedMachines" @change.stop/>
                  </td>
                  <td>{{ m.code }}</td>
                  <td>{{ m.machine }}</td>
                </tr>

                <tr v-if="activeGroup && !machinesOfActiveGroup.length">
                  <td colspan="3" class="empty">此群組沒有機台</td>
                </tr>
                <tr v-if="!activeGroup">
                  <td colspan="3" class="empty">請先選擇群組</td>
                </tr>
              </tbody>
            </table>

            <div class="page-action-block">
              <span class="icon-item prev" @click="currentMachinePage = Math.max(1, currentMachinePage - 1)" :class="{ disabled: currentMachinePage === 1 }">&lt;</span>
              <label>第</label>
              <input type="number" class="page-input" v-model.number="currentMachinePage" :min="1" :max="totalMachinePages"/>
              <label>頁, 共 {{ totalMachinePages }} 頁</label>
              <span class="icon-item next" @click="currentMachinePage = Math.min(totalMachinePages, currentMachinePage + 1)" :class="{ disabled: currentMachinePage === totalMachinePages }">&gt;</span>
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="window-action-block">
          <button class="btn confirm" @click="confirmSelection">確定</button>
          <button class="btn cancel" @click="closeWindow">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'MachinesListWindowCheckbox',
  props: {
    project: { type: String, default: '' }, // 只接受 project
  },
  data() {
    return {
      keyword: '',
      searched: false,

      groups: [],            // ['groupA','groupB',...]
      groupMachines: {},     // group -> [{ machine, code }]
      activeGroup: '',

      selectedMachines: [],  // flat selected list

      // pagination
      groupPageRows: 8,
      currentGroupPage: 1,
      machinePageRows: 8,
      currentMachinePage: 1,
    }
  },
  computed: {
    // groups pagination
    totalGroupPages() {
      if (!this.groups.length) return 1
      return Math.ceil(this.groups.length / this.groupPageRows)
    },
    paginatedGroups() {
      const start = (this.currentGroupPage - 1) * this.groupPageRows
      return this.groups.slice(start, start + this.groupPageRows)
    },

    // current group's machines
    machinesOfActiveGroup() {
      return this.groupMachines[this.activeGroup] || []
    },
    totalMachinePages() {
      if (!this.machinesOfActiveGroup.length) return 1
      return Math.ceil(this.machinesOfActiveGroup.length / this.machinePageRows)
    },
    paginatedMachines() {
      const start = (this.currentMachinePage - 1) * this.machinePageRows
      return this.machinesOfActiveGroup.slice(start, start + this.machinePageRows)
    },
  },
  methods: {
    async search() {
      this.resetAfterSearch()
      this.searched = true
      if (!this.project) {
        console.warn('No project provided; cannot fetch groups/machines.')
        return
      }

      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL
        const params = { project: this.project, keyword: this.keyword }
        const { data } = await axios.get(`${API_BASE_URL}/MES-get-groups-machines`, { params })
        const groupsPayload = (data && data.data && data.data.groups) || {}

        const gm = {}
        const names = []
        Object.entries(groupsPayload).forEach(([gname, ginfo]) => {
          const arr = []
          const ms = ginfo?.machines || {}
          Object.entries(ms).forEach(([mn, mi]) => {
            arr.push({ machine: mn, code: mi.code })
          })
          if (arr.length) {
            gm[gname] = arr
            names.push(gname)
          }
        })

        this.groupMachines = gm
        this.groups = names

        if (this.groups.length) {
          this.activeGroup = this.groups[0]
          this.currentGroupPage = 1
          this.currentMachinePage = 1
        }
      } catch (e) {
        console.error('Error fetching MES-get-groups-machines:', e)
      }
    },

    // group interactions
    onClickGroup(name) {
      if (this.activeGroup === name) return
      this.activeGroup = name
      this.currentMachinePage = 1
    },
    onToggleGroup(name, checked) {
      const machines = (this.groupMachines[name] || []).map(m => m.machine)
      if (!machines.length) return

      // if (checked) {
      //   const set = new Set(this.selectedMachines)
      //   machines.forEach(x => set.add(x))
      //   this.selectedMachines = Array.from(set)
      // } else {
      //   const removeSet = new Set(machines)
      //   this.selectedMachines = this.selectedMachines.filter(x => !removeSet.has(x))
      // }
      const set = new Set(this.selectedMachines)
      if (checked) {
        machines.forEach(x => set.add(x))
      } else {
        machines.forEach(x => set.delete(x))
      }
      this.selectedMachines = Array.from(set)
    },
    isGroupChecked(name) {
      const ms = (this.groupMachines[name] || []).map(m => m.machine)
      if (!ms.length) return false
      const set = new Set(this.selectedMachines)
      return ms.every(x => set.has(x))
    },
    isGroupIndeterminate(name) {
      const ms = (this.groupMachines[name] || []).map(m => m.machine)
      if (!ms.length) return false
      const set = new Set(this.selectedMachines)
      const picked = ms.filter(x => set.has(x)).length
      return picked > 0 && picked < ms.length
    },

    // confirm / close
    confirmSelection() {
      this.$emit('select-machine', this.selectedMachines.slice())
      this.$emit('cancel')
    },
    closeWindow() {
      this.$emit('cancel')
    },

    // helpers
    resetAfterSearch() {
      this.groups = []
      this.groupMachines = {}
      this.activeGroup = ''
      this.currentGroupPage = 1
      this.currentMachinePage = 1
      // this.selectedMachines = []
    },
  },
}
</script>

<style scoped>
.window-wrapper { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,.5); z-index: 1001; }
.dialog { background: #fff; width: 80%; max-width: 1100px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.2); overflow: hidden; }
.header { display: flex; align-items: center; justify-content: space-between; background: #61a5d6; color: #fff; padding: 10px 16px; }
.header h3 { margin: 0; }

.content { padding: 12px; }

/* search */
.search-block { display: flex; align-items: center; gap: 10px; justify-content: center; margin-bottom: 10px; }
.search-block p { margin: 0; }
.search-keyword-input { width: 50%; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; }
.btn-search { padding: 6px 10px; border: none; background: #007bff; color: #fff; border-radius: 4px; cursor: pointer; }
.btn-search:hover { background: #005ec2; }

/* two columns */
.columns { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; min-height: 380px; }
.col { display: flex; flex-direction: column; }
.col-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
.col-header h4 { margin: 0; }

/* tables */
.group-table, .machine-table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; border: 1px solid #e5e5e5; }
.group-table th, .group-table td, .machine-table th, .machine-table td { padding: 8px; border-bottom: 1px solid #eee; text-align: left; word-wrap: break-word; }
.group-table thead tr, .machine-table thead tr { background: #f6f7fb; }
.chk-col { width: 44px; text-align: center; }
.count-col { width: 72px; text-align: right; }

.group-table tbody tr { cursor: pointer; }
.group-table tbody tr.active { background: #eef6ff; }
.group-table tbody tr:hover { background: #f2f8ff; }

.empty { text-align: center; color: #888; padding: 18px 0; }

/* pager */
.page-action-block { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 0; }
.icon-item { background: #eee; padding: 4px 8px; border-radius: 4px; cursor: pointer; user-select: none; }
.icon-item:hover { background: #ddd; }
.icon-item.disabled { opacity: .5; pointer-events: none; }
.page-input { width: 72px; padding: 2px 6px; }

/* footer */
.footer { display: flex; justify-content: flex-end; gap: 10px; padding: 10px 16px; border-top: 1px solid #eee; background: #fff; }
.window-action-block .btn { margin: 4px; padding: 8px 18px; border-radius: 5px; font-size: 14px; border: none; cursor: pointer; }
.btn.confirm { background-color: #007bff; color: white; }
.btn.cancel { background-color: #6c757d; color: white; }
</style>
