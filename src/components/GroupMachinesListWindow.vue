<!-- GroupMachineListWindow.vue -->
<template>
  <div class="window-wrapper" @click.self="closeWindow">
    <div class="dialog">
      <div class="header">
        <h3>適用機台選取</h3>
      </div>

      <div class="content">
        <!-- 搜尋列 -->
        <div class="search-block">
          <p>關鍵字：</p>
          <input
            type="text"
            class="search-keyword-input"
            v-model.trim="keyword"
            placeholder="請輸入機台關鍵字"
            @keyup.enter="fetchGroups"
          />
          <button class="btn-search" @click="fetchGroups">搜尋</button>
        </div>

        <!-- 兩欄：群組 / 機台 -->
        <div class="columns">
          <!-- 左：群組 -->
          <div class="col col-groups">
            <div class="col-header">
              <h4>機台群組</h4>
              <small v-if="groups.length">共 {{ groups.length }} 組</small>
            </div>

            <table class="group-table">
              <thead>
                <tr>
                  <th class="group-col">群組名稱</th>
                  <th class="count-col">數量</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="g in paginatedGroups"
                  :key="g.code"
                  :class="{ active: g.code === activeGroupCode }"
                  @click="onClickGroup(g.code)"
                >
                  <td>{{ g.name }}</td>
                  <td class="count-col">{{ (groupMachines[g.code] || []).length }}</td>
                </tr>

                <tr v-if="searched && !groups.length">
                  <td colspan="2" class="empty">沒有符合的群組</td>
                </tr>
                <tr v-if="!searched">
                  <td colspan="2" class="empty">載入中 / 請輸入關鍵字後搜尋</td>
                </tr>
              </tbody>
            </table>

            <!-- 群組分頁 -->
            <div class="page-action-block">
              <span
                class="icon-item prev"
                @click="currentGroupPage = Math.max(1, currentGroupPage - 1)"
                :class="{ disabled: currentGroupPage === 1 }"
              >&lt;</span>
              <label>第</label>
              <input
                type="number"
                class="page-input"
                v-model.number="currentGroupPage"
                :min="1"
                :max="totalGroupPages"
              />
              <label>頁, 共 {{ totalGroupPages }} 頁</label>
              <span
                class="icon-item next"
                @click="currentGroupPage = Math.min(totalGroupPages, currentGroupPage + 1)"
                :class="{ disabled: currentGroupPage === totalGroupPages }"
              >&gt;</span>
            </div>
          </div>

          <!-- 右：機台 -->
          <div class="col col-machines">
            <div class="col-header">
              <h4>
                機台清單
                <small v-if="activeGroupName">（{{ activeGroupName }}）</small>
              </h4>
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
                <tr
                  v-for="m in paginatedMachines"
                  :key="`${activeGroupCode}::${m.code}`"
                  @click="selectMachineRow(m)"
                  :class="{ active: selectedMachineCode === m.code }"
                >
                  <td class="chk-col" @click.stop>
                    <input
                      type="radio"
                      :value="m.code"
                      v-model="selectedMachineCode"
                    />
                  </td>
                  <td>{{ m.code }}</td>
                  <td>{{ m.name }}</td>
                </tr>

                <tr v-if="activeGroupCode && !machinesOfActiveGroup.length">
                  <td colspan="3" class="empty">此群組沒有機台</td>
                </tr>
                <tr v-if="!activeGroupCode">
                  <td colspan="3" class="empty">請先選擇群組</td>
                </tr>
              </tbody>
            </table>

            <!-- 機台分頁 -->
            <div class="page-action-block">
              <span
                class="icon-item prev"
                @click="currentMachinePage = Math.max(1, currentMachinePage - 1)"
                :class="{ disabled: currentMachinePage === 1 }"
              >&lt;</span>
              <label>第</label>
              <input
                type="number"
                class="page-input"
                v-model.number="currentMachinePage"
                :min="1"
                :max="totalMachinePages"
              />
              <label>頁, 共 {{ totalMachinePages }} 頁</label>
              <span
                class="icon-item next"
                @click="currentMachinePage = Math.min(totalMachinePages, currentMachinePage + 1)"
                :class="{ disabled: currentMachinePage === totalMachinePages }"
              >&gt;</span>
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
  name: 'GroupMachinesListWindow',
  props: {
    // 由父層傳入的過濾條件（製程 / 品目）
    specificCode: { type: String, default: '' },
    itemCode:     { type: String, default: '' },
  },
  data() {
    return {
      keyword: '',
      searched: false,
      loading: false,

      groups: [],              // [{ code, name }]
      groupMachines: {},       // { [groupCode]: [{ code, name }] }
      activeGroupCode: '',

      selectedMachineCode: '',

      groupPageRows: 8,
      currentGroupPage: 1,
      machinePageRows: 8,
      currentMachinePage: 1,
    }
  },
  computed: {
    totalGroupPages() {
      return this.groups.length ? Math.ceil(this.groups.length / this.groupPageRows) : 1
    },
    paginatedGroups() {
      const start = (this.currentGroupPage - 1) * this.groupPageRows
      return this.groups.slice(start, start + this.groupPageRows)
    },
    activeGroupName() {
      const g = this.groups.find(x => x.code === this.activeGroupCode)
      return g ? g.name : ''
    },
    machinesOfActiveGroup() {
      return this.groupMachines[this.activeGroupCode] || []
    },
    totalMachinePages() {
      return this.machinesOfActiveGroup.length
        ? Math.ceil(this.machinesOfActiveGroup.length / this.machinePageRows)
        : 1
    },
    paginatedMachines() {
      const start = (this.currentMachinePage - 1) * this.machinePageRows
      return this.machinesOfActiveGroup.slice(start, start + this.machinePageRows)
    },
  },
  mounted() {
    this.fetchGroups()
  },
  methods: {
    async fetchGroups() {
      try {
        this.loading = true
        const API = import.meta.env.VITE_APP_API_BASE_URL || ''
        const params = {}
        if (this.keyword)      params.keyword  = this.keyword
        if (this.specificCode) params.specific = this.specificCode  // 對應後端 groups_machines(specific=...)
        if (this.itemCode)     params.item     = this.itemCode      // 若後端有支援品目過濾就用

        const { data } = await axios.get(`${API}/mes/groups-machines`, { params })
        const rawGroups = data?.data?.groups || {}

        const groups = []
        const groupMachines = {}
        Object.entries(rawGroups).forEach(([gcode, ginfo]) => {
          groups.push({ code: gcode, name: ginfo?.name || gcode })
          const machines = []
          Object.entries(ginfo?.machines || {}).forEach(([mcode, minfo]) => {
            machines.push({ code: mcode, name: minfo?.name || mcode })
          })
          groupMachines[gcode] = machines
        })
        groups.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'))

        this.groups = groups
        this.groupMachines = groupMachines
        this.searched = true

        // 預設選第一組
        if (!this.activeGroupCode && this.groups.length) {
          this.activeGroupCode = this.groups[0].code
        }
        this.currentGroupPage = 1
        this.currentMachinePage = 1
      } catch (e) {
        console.error('/mes/groups-machines error:', e)
        this.groups = []
        this.groupMachines = {}
      } finally {
        this.loading = false
      }
    },

    onClickGroup(groupCode) {
      if (this.activeGroupCode === groupCode) return
      this.activeGroupCode = groupCode
      this.currentMachinePage = 1
    },

    selectMachineRow(m) {
      this.selectedMachineCode = m.code
    },

    confirmSelection() {
      if (!this.selectedMachineCode) {
        alert('請先選擇一台機台')
        return
      }
      // 找到機台名稱
      let picked = null
      Object.values(this.groupMachines).forEach(arr => {
        if (picked) return
        const found = arr.find(m => m.code === this.selectedMachineCode)
        if (found) picked = found
      })
      if (!picked) {
        alert('機台清單中找不到選取的機台')
        return
      }
      this.$emit('select-machine', { code: picked.code, name: picked.name })
      this.$emit('cancel')
    },

    closeWindow() {
      this.$emit('cancel')
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
.search-block { display: flex; align-items: center; gap: 10px; justify-content: center; margin-bottom: 10px; }
.search-block p { margin: 0; }
.search-keyword-input { width: 50%; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; }
.btn-search { padding: 6px 10px; border: none; background: #007bff; color: #fff; border-radius: 4px; cursor: pointer; }
.btn-search:hover { background: #005ec2; }
.columns { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; min-height: 380px; }
.col { display: flex; flex-direction: column; }
.col-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
.col-header h4 { margin: 0; }
.group-table, .machine-table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; border: 1px solid #e5e5e5; }
.group-table th, .group-table td, .machine-table th, .machine-table td { padding: 8px; border-bottom: 1px solid #eee; text-align: left; word-wrap: break-word; }
.group-table thead tr, .machine-table thead tr { background: #f6f7fb; }
.group-col { text-align: center; }
.count-col { width: 72px; text-align: right; }
.group-table tbody tr { cursor: pointer; }
.group-table tbody tr.active { background: #eef6ff; }
.group-table tbody tr:hover { background: #f2f8ff; }
.chk-col { width: 44px; text-align: center; }
.machine-table tbody tr.active { background: #eef6ff; }
.machine-table tbody tr:hover { background: #f2f8ff; }
.empty { text-align: center; color: #888; padding: 18px 0; }
.page-action-block { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 0; }
.icon-item { background: #eee; padding: 4px 8px; border-radius: 4px; cursor: pointer; user-select: none; }
.icon-item:hover { background: #ddd; }
.icon-item.disabled { opacity: .5; pointer-events: none; }
.page-input { width: 72px; padding: 2px 6px; }
.footer { display: flex; justify-content: flex-end; gap: 10px; padding: 10px 16px; border-top: 1px solid #eee; background: #fff; }
.window-action-block .btn { margin: 4px; padding: 8px 18px; border-radius: 5px; font-size: 14px; border: none; cursor: pointer; }
.btn.confirm { background-color: #007bff; color: white; }
.btn.cancel { background-color: #6c757d; color: white; }
</style>
