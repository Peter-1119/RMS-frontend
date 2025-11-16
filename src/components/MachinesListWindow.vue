<!-- MachineListWindow.vue -->
<template>
  <div class="window-wrapper" @click.self="closeWindow">
    <div class="dialog">
      <div class="header"><h3>適用機台選取</h3></div>

      <div class="content">
        <!-- Search -->
        <div class="search-block">
          <p>關鍵字：</p>
          <input
            type="text"
            class="search-keyword-input"
            v-model.trim="keyword"
            placeholder="請輸入關鍵字"
            @keyup.enter="loadOriginal"
          />
          <button class="btn-search" @click="loadOriginal">搜尋</button>
          <button class="btn" v-if="isFiltered" @click="restoreOriginal">清除篩選</button>
        </div>

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
                  <td class="chk-col" @click.stop>
                    <!-- <input
                      type="checkbox"
                      :checked="isGroupChecked(g.code)"
                      :indeterminate.prop="isGroupIndeterminate(g.code)"
                      @change="onToggleGroup(g.code, $event.target.checked)"
                    /> -->
                    <input
                      type="checkbox"
                      :checked="isGroupChecked(g.code)"
                      :indeterminate.prop="isGroupIndeterminate(g.code)"
                      :disabled="isFiltering"
                      @change="onToggleGroup(g.code, $event.target.checked)"
                    />
                  </td>
                  <td>{{ g.name }}</td>
                  <!-- <td class="count-col">{{ (groupMachines[g.code] || []).length }}</td> -->
                  <td class="count-col">{{ groupCount(g.code) }}</td>
                </tr>

                <tr v-if="searched && !groups.length">
                  <td colspan="3" class="empty">沒有符合的群組</td>
                </tr>
                <tr v-if="!searched">
                  <td colspan="3" class="empty">載入中 / 請輸入關鍵字後搜尋</td>
                </tr>
              </tbody>
            </table>

            <div class="page-action-block">
              <span class="icon-item prev" @click="currentGroupPage = Math.max(1, currentGroupPage - 1)" :class="{ disabled: currentGroupPage === 1 }">&lt;</span>
              <label>第</label>
              <input type="number" class="page-input" v-model.number="currentGroupPage" :min="1" :max="totalGroupPages"/>
              <label>頁, 共 {{ totalGroupPages }} 頁</label>
              <span class="icon-item next" @click="currentGroupPage = Math.min(totalGroupPages, currentGroupPage + 1)" :class="{ disabled: currentGroupPage === totalGroupPages }">&gt;</span>
            </div>
          </div>

          <!-- RIGHT: MACHINES -->
          <div class="col col-machines">
            <div class="col-header">
              <h4>
                機台清單
                <small v-if="activeGroupCode">（{{ activeGroupName }}）</small>
              </h4>
              <small v-if="currentMachineList.length">共 {{ currentMachineList.length }} 台</small>
              <small v-if="isFiltering" class="processing">處理中…</small>
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
                <tr v-for="m in paginatedMachines" :key="`${activeGroupCode}::${m.code}`">
                  <td class="chk-col">
                    <input
                      type="checkbox"
                      :checked="selectedCodesSet.has(m.code)"
                      :disabled="isFiltering || isMachineDisabled(m)"
                      @change.stop="onToggleMachine(m, $event.target.checked)"
                    />
                  </td>
                  <td>
                    {{ m.code }}
                    <span v-if="m._mismatch" class="tag-mismatch">非相同的條件參數</span>
                  </td>
                  <td>{{ m.name }}</td>
                </tr>

                <tr v-if="activeGroupCode && !currentMachineList.length">
                  <td colspan="3" class="empty">此群組沒有機台</td>
                </tr>
                <tr v-if="!activeGroupCode">
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
    project: { type: String, default: '' },
  },
  data() {
    return {
      keyword: '',
      searched: false,
      isFiltered: false,

      isFiltering: false,                // NEW: “處理中” + disable UI

      groups: [],               // [{ code, name }]
      groupMachines: {},        // { [groupCode]: [{ code, name }] }
      activeGroupCode: '',

      selectedCodes: [],        // keep order for pinned list

      groupPageRows: 8,
      currentGroupPage: 1,
      machinePageRows: 8,
      currentMachinePage: 1,

      originalGroupsPayload: {},
      filteredGroupsPayload: {},         // last filtered payload (same shape as original)
      baselineCode: '',            // the machine_code that created the baseline
    }
  },
  computed: {
    totalGroupPages() { return this.groups.length ? Math.ceil(this.groups.length / this.groupPageRows) : 1 },
    paginatedGroups() {
      const start = (this.currentGroupPage - 1) * this.groupPageRows
      return this.groups.slice(start, start + this.groupPageRows)
    },
    activeGroupName() {
      const g = this.groups.find(x => x.code === this.activeGroupCode)
      return g ? g.name : ''
    },

    // map code -> machine object, across all groups (for pinned rows)
    codeToMachine() {
      const m = {}
      Object.values(this.groupMachines).forEach(arr => arr.forEach(x => { m[x.code] = x }))
      return m
    },
    selectedCodesSet() { return new Set(this.selectedCodes) },

    // >>> PINNED LIST: selected first (in selection order), then current group's others
    currentMachineList() {
      const active = this.activeGroupCode

      // 1) 全域 pinned：所有已選中的機台（不分群組），使用 codeToMachine 取資料
      const pinnedRaw = this.selectedCodes
        .map(code => {
          const m = this.codeToMachine[code]
          if (!m) return null
          // 這邊順便標記有沒有 mismatch（只跟 active group 的 baseline 邏輯有關）
          return { ...m, _mismatch: this._isMismatchInActive(code) }
        })
        .filter(Boolean)

      const pinnedCodes = new Set(pinnedRaw.map(m => m.code))

      // 2) 當前群組中「正常匹配」的機台（但排除已 pinned 過的）
      const matched = (this.groupMachines[active] || [])
        .filter(x => !pinnedCodes.has(x.code))
        .map(x => ({
          ...x,
          _mismatch: this._isMismatchInActive(x.code),
        }))

      // 3) baseline 過濾後，active group 中「不符合條件」的機台（mismatch rows）
      let mismatches = []
      if (this.isFiltered && active) {
        const origKW  = this._keywordFilterPayload(this.originalGroupsPayload, this.keyword)
        const origMap = origKW[active]?.machines || {}
        const filtMap = this.filteredGroupsPayload[active]?.machines || {}

        const mismatchCodes = Object.keys(origMap).filter(c => !(c in filtMap))

        mismatches = mismatchCodes
          .filter(code => !pinnedCodes.has(code)) // 避免和 pinned 重複
          .map(code => ({
            code,
            name: origMap[code]?.name ?? code,
            _mismatch: true,
          }))
      }

      // 4) 最後組合順序：已勾選(pinned) → 當前群組正常 → mismatch
      return [...pinnedRaw, ...matched, ...mismatches]
    },

    totalMachinePages() {
      return this.currentMachineList.length
        ? Math.ceil(this.currentMachineList.length / this.machinePageRows)
        : 1
    },
    paginatedMachines() {
      const start = (this.currentMachinePage - 1) * this.machinePageRows
      return this.currentMachineList.slice(start, start + this.machinePageRows)
    },

  },
  async mounted() {
    await this.loadOriginal()
  },
  methods: {
    // utility: is a machine row disabled for selection?
    isMachineDisabled(m) { return !!m._mismatch },

    _allowedSetForGroup(gcode) {
      if (this.isFiltered) {
        const m = this.filteredGroupsPayload?.[gcode]?.machines || {}
        return new Set(Object.keys(m))
      }
      const list = this.groupMachines[gcode] || []
      return new Set(list.map(x => x.code))
    },

    // find a machine (code,name) from any payload (original/filtered)
    _findInPayloadByCode(payload, code) {
      for (const g of Object.values(payload || {})) {
        if (g?.machines?.[code]) {
          return { code, name: g.machines[code]?.name ?? code }
        }
      }
      return null
    },

    // whether a code is mismatch (not in filtered active group) when filtered is on
    _isMismatchInActive(code) {
      if (!this.isFiltered || !this.activeGroupCode) return false
      const filt = this.filteredGroupsPayload[this.activeGroupCode]?.machines || {}
      return !(code in filt)
    },

    // narrow a payload by keyword (applies to both code & name)
    _keywordFilterPayload(payload, keyword) {
      const out = {}
      const kw = (keyword || '').trim().toLowerCase()
      const hit = (s) => !kw || (s || '').toLowerCase().includes(kw)
      Object.entries(payload || {}).forEach(([gcode, gval]) => {
        const machines = {}
        Object.entries(gval?.machines || {}).forEach(([mcode, mval]) => {
          if (hit(mcode) || hit(mval?.name)) {
            machines[mcode] = { name: mval?.name ?? mcode }
          }
        })
        if (Object.keys(machines).length) {
          out[gcode] = { name: gval?.name ?? gcode, machines }
        }
      })
      return out
    },

    // merge filtered list with the baseline (active) group from *original* (after keyword)
    _unionWithActiveGroup(filteredPayload) {
      if (!this.activeGroupCode) return filteredPayload
      const out = JSON.parse(JSON.stringify(filteredPayload || {}))
      const origKW = this._keywordFilterPayload(this.originalGroupsPayload, this.keyword)
      const activeOrig = origKW[this.activeGroupCode]
      if (activeOrig) {
        // ensure group present, but only machines that pass keyword remain here
        out[this.activeGroupCode] = out[this.activeGroupCode] || { name: activeOrig.name, machines: {} }
        // DO NOT merge machines here; right table handles mismatches visually.
        // We only ensure the group remains in left column.
        out[this.activeGroupCode].name = activeOrig.name
      }
      return out
    },

    /** keyword-filtered ORIGINAL payload */
    _kwOrig() {
      return this._keywordFilterPayload(this.originalGroupsPayload, this.keyword)
    },

    /** keyword-filtered FILTERED payload (server result after baseline) */
    _kwFilt() {
      return this._keywordFilterPayload(this.filteredGroupsPayload, this.keyword)
    },

    /** codes that are mismatches for a given group under current baseline+keyword */
    _mismatchCodesForGroup(gcode) {
      if (!this.isFiltered) return []
      const orig = this._kwOrig()[gcode]?.machines || {}
      const filt = this._kwFilt()[gcode]?.machines || {}
      return Object.keys(orig).filter(c => !(c in filt))
    },

    /** REPLACE your current groupCount(gcode) with this version */
    groupCount(gcode) {
      // When no baseline filter active: count = keyword-filtered ORIGINAL for that group
      if (!this.isFiltered) {
        const origKW = this._kwOrig()
        const m = origKW?.[gcode]?.machines || {}
        return Object.keys(m).length
      }

      // When baseline filter active:
      // - For ANY group (including the active one), start with keyword-filtered FILTERED payload count
      // - For the ACTIVE group ONLY, also add the mismatch rows (orig - filtered) under the keyword
      const filtKW = this._kwFilt()
      const m = filtKW?.[gcode]?.machines || {}
      const base = Object.keys(m).length

      if (gcode !== this.activeGroupCode) {
        return base
      }

      // active group adds mismatches (still visible on the right, but disabled)
      const mismatches = this._mismatchCodesForGroup(gcode)
      return base + mismatches.length
    },

    applyGroupsPayload(groupsPayload, { filtered = false, preserveActive = false } = {}) {
      let usePayload = groupsPayload || {}

      // If we should preserve the active/baseline group in list (avoid “cleared” effect)
      if (preserveActive && this.activeGroupCode) {
        usePayload = this._unionWithActiveGroup(groupsPayload)
      }

      // build left list tables
      const groups = []
      const groupMachines = {}
      Object.entries(usePayload).forEach(([gcode, gval]) => {
        groups.push({ code: gcode, name: gval?.name ?? gcode })
        const arr = []
        Object.entries(gval?.machines || {}).forEach(([mcode, mval]) => {
          arr.push({ code: mcode, name: mval?.name ?? mcode })
        })
        groupMachines[gcode] = arr
      })
      groups.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'))

      this.groups = groups
      this.groupMachines = groupMachines

      if (filtered) this.filteredGroupsPayload = groupsPayload

      if (!this.activeGroupCode && this.groups.length) this.activeGroupCode = this.groups[0].code
      this.currentGroupPage = 1
      this.currentMachinePage = 1
    },

    async loadOriginal() {
      try {
        const API = import.meta.env.VITE_APP_API_BASE_URL
        const params = {}
        if (this.keyword) params.keyword = this.keyword
        if (this.project) params.project = this.project

        const { data } = await axios.get(`${API}/mes/groups-machines`, { params })
        // raw original from server
        this.originalGroupsPayload = data?.data?.groups || {}
        this.searched = true

        if (this.baselineCode) {
          // If already filtered by baseline, maintain that baseline also for keyword searches
          await this.filterByBaseline(this.baselineCode, (this._findInPayloadByCode(this.originalGroupsPayload, this.baselineCode)?.name || ''))
        } else {
          // No baseline yet → show keyword-filtered original
          const kwPayload = this._keywordFilterPayload(this.originalGroupsPayload, this.keyword)
          this.filteredGroupsPayload = {}
          this.applyGroupsPayload(kwPayload, { filtered: false, preserveActive: false })
          this.isFiltered = false
        }

        // prune selection by visibility only if no baseline; with baseline we keep pins
        if (!this.isFiltered) {
          const allCodes = new Set(Object.values(this.groupMachines).flat().map(x => x.code))
          this.selectedCodes = this.selectedCodes.filter(c => allCodes.has(c))
        }
      } catch (e) {
        console.error('Error /groups-machines:', e)
      }
    },

    async restoreOriginal() {
      this.keyword = ''
      this.baselineCode = ''
      const kwPayload = this._keywordFilterPayload(this.originalGroupsPayload, '')
      this.applyGroupsPayload(kwPayload, { filtered: false, preserveActive: false })
      this.isFiltered = false
      this.filteredGroupsPayload = {}

      if (!this.groups.find(g => g.code === this.activeGroupCode) && this.groups.length) {
        this.activeGroupCode = this.groups[0].code
      }
      const allCodes = new Set(Object.values(this.groupMachines).flat().map(x => x.code))
      this.selectedCodes = this.selectedCodes.filter(c => allCodes.has(c))
    },

    onClickGroup(groupCode) {
      if (this.activeGroupCode === groupCode) return
      this.activeGroupCode = groupCode
      this.currentMachinePage = 1
    },

    isGroupChecked(gcode) {
      const allowed = this._allowedSetForGroup(gcode)
      if (!allowed.size) return false
      const sel = this.selectedCodesSet
      // checked only if ALL allowed are selected
      for (const c of allowed) {
        if (!sel.has(c)) return false
      }
      return true
    },
    isGroupIndeterminate(gcode) {
      const allowed = this._allowedSetForGroup(gcode)
      if (!allowed.size) return false
      const sel = this.selectedCodesSet
      let picked = 0
      for (const c of allowed) if (sel.has(c)) picked++
      return picked > 0 && picked < allowed.size
    },


    async onToggleGroup(gcode, checked) {
      if (this.isFiltering) return

      // 1) switch the right table to this group
      if (this.activeGroupCode !== gcode) {
        this.activeGroupCode = gcode
        this.currentMachinePage = 1
      }

      // 2) allowed codes under current filter/baseline state
      const allowed = this._allowedSetForGroup(gcode)
      if (!allowed.size) return

      const before = this.selectedCodes.slice()
      const set = new Set(this.selectedCodes)

      if (checked) {
        // add only allowed codes
        allowed.forEach(c => set.add(c))
      } else {
        // remove only allowed codes
        allowed.forEach(c => set.delete(c))
      }

      this.selectedCodes = Array.from(set)

      // 3) baseline management
      if (!this.baselineCode && before.length === 0 && this.selectedCodes.length > 0) {
        // choose a deterministic baseline from this group
        const first = [...allowed][0]
        const name = this.groupMachines[gcode]?.find(x => x.code === first)?.name || first
        await this.filterByBaseline(first, name)
      }
      if (this.selectedCodes.length === 0) {
        await this.restoreOriginal()
      }
    },
    async onToggleMachine(m, checked) {
      if (this.isFiltering || this.isMachineDisabled(m)) return
      const beforeCount = this.selectedCodes.length
      if (checked) {
        if (!this.selectedCodes.includes(m.code)) this.selectedCodes.push(m.code)
        if (!this.baselineCode && beforeCount === 0 && this.selectedCodes.length === 1) {
          await this.filterByBaseline(m.code, m.name)
        }
      } else {
        this.selectedCodes = this.selectedCodes.filter(c => c !== m.code)
        if (this.selectedCodes.length === 0) {
          await this.restoreOriginal()
        }
      }
    },

    async filterByBaseline(code, name) {
      try {
        this.isFiltering = true
        this.baselineCode = code
        const API = import.meta.env.VITE_APP_API_BASE_URL
        const payload = { machine_code: code, machine_name: name, keyword: this.keyword || null, project: this.project || null }
        const { data } = await axios.post(`${API}/mes/filter-by-baseline`, payload)
        const serverFiltered = data?.data?.groups || {}

        // Keep active group visible
        const merged = this._unionWithActiveGroup(serverFiltered)

        // Build left list from merged; remember raw serverFiltered for mismatch calc
        this.applyGroupsPayload(merged, { filtered: true, preserveActive: true })
        this.isFiltered = true

        // >>> NEW: prune selection so mismatches are not "checked"
        const enabledSet = new Set(
          Object.values(serverFiltered).flatMap(g => Object.keys(g.machines || {}))
        )
        this.selectedCodes = this.selectedCodes.filter(c => enabledSet.has(c))

        if (!this.groups.find(g => g.code === this.activeGroupCode) && this.groups.length) {
          this.activeGroupCode = this.groups[0].code
        }
      } catch (e) {
        console.error('Error /filter-by-baseline:', e)
      } finally {
        this.isFiltering = false
      }
    },
    confirmSelection() {
      // Only submit enabled (matched) codes of current visible list
      const enabledSet = new Set((this.groupMachines[this.activeGroupCode] || []).map(x => x.code))
      const nameByCode = {}
      Object.values(this.groupMachines).forEach(arr => arr.forEach(x => { nameByCode[x.code] = x.name }))

      // const payload = this.selectedCodes.filter(code => enabledSet.has(code)).map(code => ({ [nameByCode[code] || ""]: code })).filter(obj => Object.keys(obj)[0])
      const payload = this.selectedCodes.filter(code => enabledSet.has(code)).map(code => ({code: code, name: nameByCode[code] || ""}))

      this.$emit('select-machine', payload)
      this.$emit('cancel')
    },

    closeWindow() { this.$emit('cancel') },
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
.group-col { width: 250px; text-align: center; }
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

.processing { color: #ff6f00; margin-left: 8px; }
.tag-mismatch {
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 10px;
  background: #ffe9e9;
  color: #c62828;
  font-size: 12px;
  white-space: nowrap;
}


</style>
