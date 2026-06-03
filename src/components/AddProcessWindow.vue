<template>
  <div class="window-wrapper" @click.self="closeWindow">
    <div class="dialog">
      <div class="header">
        <h3>新增製程綁定</h3>
        <span class="dept-tag">{{ deptName }}（{{ deptNo }}）</span>
      </div>

      <div class="content-grid">
        <!-- 左：已選清單 -->
        <div class="panel">
          <div class="panel-head">
            <h4>已選製程</h4>
            <span class="count-tag">{{ selected.length }}</span>
          </div>
          <div class="scrollable-list">
            <div v-for="p in selected" :key="p.processCode" class="list-item">
              <span class="list-item-text">
                <span class="p-code">{{ p.processCode }}</span>
                <span class="p-name">{{ p.processName }}</span>
              </span>
              <button class="btn-remove" title="取消選取" @click="removeSelected(p.processCode)">×</button>
            </div>
            <div v-if="!selected.length" class="list-item empty">
              <span class="text-muted">尚未選擇任何製程</span>
            </div>
          </div>
        </div>

        <!-- 右：搜尋 + 未綁定製程 -->
        <div class="panel">
          <div class="search-block">
            <input
              type="text"
              v-model="keyword"
              placeholder="搜尋製程名稱…"
              @input="onSearchInput"
            />
          </div>

          <div class="panel-head">
            <h4>未綁定製程</h4>
          </div>

          <div class="scrollable-list">
            <table class="process-table">
              <thead>
                <tr>
                  <th class="th-checkbox">
                    <input
                      type="checkbox"
                      :checked="allChecked"
                      :indeterminate.prop="someChecked && !allChecked"
                      @change="toggleAll"
                    />
                  </th>
                  <th class="th-code">製程代碼</th>
                  <th>製程名稱</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in availableList"
                  :key="p.processCode"
                  class="clickable-row"
                  :class="{ 'checked-row': checkedCodes.has(p.processCode) }"
                  @click="toggleOne(p.processCode)"
                >
                  <td class="td-center" @click.stop>
                    <input
                      type="checkbox"
                      :checked="checkedCodes.has(p.processCode)"
                      @change="toggleOne(p.processCode)"
                    />
                  </td>
                  <td>{{ p.processCode }}</td>
                  <td class="td-left">{{ p.processName }}</td>
                </tr>
                <tr v-if="loading">
                  <td colspan="3" class="td-hint">載入中…</td>
                </tr>
                <tr v-if="!loading && !availableList.length">
                  <td colspan="3" class="td-hint">
                    {{ keyword ? "沒有符合搜尋條件的製程" : "所有製程都已綁定 / 已選取" }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="move-line">
            <button class="btn move" :disabled="!checkedCodes.size" @click="addCheckedToSelected">
              加入已選 &gt;&gt;
            </button>
          </div>
        </div>
      </div>

      <div class="footer">
        <span class="selected-count">已選 {{ selected.length }} 個</span>
        <div class="window-action-block">
          <button class="btn confirm" :disabled="!selected.length || submitting" @click="confirm">
            {{ submitting ? "新增中…" : "確認新增" }}
          </button>
          <button class="btn cancel" @click="closeWindow">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getUnassignedProcesses } from "@/api/departmentApi";

export default {
  name: "AddProcessWindow",
  props: {
    deptNo: { type: String, required: true },
    deptName: { type: String, default: "" },
  },
  data() {
    return {
      keyword: "",
      unassigned: [],        // 後端回傳的未綁定製程
      selected: [],          // 使用者已選（待送出）清單
      checkedCodes: new Set(), // 右側表格目前勾選
      loading: false,
      submitting: false,
      debounceTimer: null,
    };
  },
  computed: {
    // 右側可選清單 = 未綁定 − 已選（已選的就不重複出現在右側）
    availableList() {
      return this.unassigned.filter((p) => !this.selected.some((s) => s.processCode === p.processCode));
    },
    allChecked() {
      return this.availableList.length > 0 && this.availableList.every((p) => this.checkedCodes.has(p.processCode));
    },
    someChecked() {
      return this.availableList.some((p) => this.checkedCodes.has(p.processCode));
    },
  },
  mounted() {
    this.fetchUnassigned();
  },
  beforeUnmount() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  },
  methods: {
    onSearchInput() {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.fetchUnassigned(), 300);
    },
    async fetchUnassigned() {
      this.loading = true;
      try {
        const res = await getUnassignedProcesses(this.deptNo, this.keyword.trim());
        if (res.success) {
          this.unassigned = res.data?.items || [];
        } else {
          this.unassigned = [];
          this.$emit("error", res.error || "取得可用製程失敗");
        }
      } catch (e) {
        this.unassigned = [];
        this.$emit("error", "系統錯誤，無法取得可用製程");
      } finally {
        // 清掉已不在清單中的勾選
        this.pruneChecked();
        this.loading = false;
      }
    },
    pruneChecked() {
      const codes = new Set(this.availableList.map((p) => p.processCode));
      const next = new Set();
      this.checkedCodes.forEach((c) => { if (codes.has(c)) next.add(c); });
      this.checkedCodes = next;
    },
    toggleOne(code) {
      const next = new Set(this.checkedCodes);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      this.checkedCodes = next;
    },
    toggleAll() {
      const next = new Set(this.checkedCodes);
      if (this.allChecked) {
        this.availableList.forEach((p) => next.delete(p.processCode));
      } else {
        this.availableList.forEach((p) => next.add(p.processCode));
      }
      this.checkedCodes = next;
    },
    addCheckedToSelected() {
      if (!this.checkedCodes.size) return;
      const toAdd = this.availableList.filter((p) => this.checkedCodes.has(p.processCode));
      this.selected.push(...toAdd);
      this.checkedCodes = new Set(); // 加入後清空勾選（這些項目會自動從右側移除）
    },
    removeSelected(code) {
      // 從已選移除；若它仍屬於目前搜尋結果，會自動回到右側可選清單
      this.selected = this.selected.filter((p) => p.processCode !== code);
    },
    confirm() {
      if (!this.selected.length) return;
      // 轉名：API #5 收 { code, name }
      const processes = this.selected.map((p) => ({ code: p.processCode, name: p.processName }));
      this.submitting = true;
      this.$emit("confirm", processes);
    },
    // 由父層在 POST 完成（成功或失敗）後呼叫，解除送出鎖
    releaseSubmit() {
      this.submitting = false;
    },
    closeWindow() {
      this.$emit("cancel");
    },
  },
};
</script>

<style scoped>
.window-wrapper {
  position: fixed;
  display: flex;
  justify-content: center;
  align-items: center;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1001;
}
.dialog {
  background-color: white;
  width: 80%;
  max-width: 920px;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.header,
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 20px;
  box-sizing: border-box;
}
.header { background-color: #61a5d6; color: #fff; }
.header h3 { margin: 0; }
.dept-tag { font-size: 13px; opacity: 0.95; }
.footer { background-color: white; border-top: 1px solid #ddd; }

/* 雙面板 */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 16px;
}
.panel { display: flex; flex-direction: column; gap: 8px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; }
.panel-head h4 { margin: 0; font-size: 14px; color: #333; }
.count-tag {
  min-width: 22px;
  padding: 0 8px;
  text-align: center;
  font-size: 12px;
  line-height: 18px;
  border-radius: 9px;
  color: #fff;
  background-color: #61a5d6;
  font-weight: bold;
}

.search-block { display: flex; }
.search-block input {
  width: 100%;
  padding: 6px 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

.scrollable-list {
  min-height: 260px;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
}

/* 左側已選 list */
.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-bottom: 1px solid #f0f0f0;
}
.list-item:last-child { border-bottom: none; }
.list-item.empty { justify-content: center; padding: 24px 0; }
.list-item-text { display: flex; gap: 10px; align-items: baseline; text-align: left; }
.text-muted { color: #999; font-size: 13px; }
.p-code { font-family: "Consolas", monospace; color: #0a66c2; min-width: 84px; }
.p-name { color: #333; }
.btn-remove {
  border: none;
  background: transparent;
  color: #c0392b;
  font-size: 18px;
  line-height: 1;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
}
.btn-remove:hover { background: #fdecec; }

/* 右側表格 */
.process-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.process-table th,
.process-table td { border: 1px solid #eee; padding: 7px 8px; text-align: center; }
.process-table thead th { background-color: #f6f9fc; position: sticky; top: 0; z-index: 1; }
.th-checkbox { width: 44px; }
.th-code { width: 120px; }
.td-center { text-align: center; }
.td-left { text-align: left; }
.td-hint { color: #999; padding: 20px 0; }

.clickable-row { cursor: pointer; transition: background-color 0.15s ease; }
.clickable-row:hover { background-color: #f5f5f5; }
.checked-row { background-color: #e3f2fd; }

.move-line { display: flex; justify-content: flex-end; }
.btn.move {
  padding: 6px 14px;
  border: none;
  border-radius: 5px;
  background-color: #4caf50;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.btn.move:disabled { background-color: #a9d6ab; cursor: not-allowed; }

.selected-count { font-size: 13px; color: #555; }
.window-action-block .btn {
  margin-left: 8px;
  padding: 8px 18px;
  border-radius: 5px;
  font-size: 14px;
  border: none;
  cursor: pointer;
}
.btn.confirm { background-color: #007bff; color: white; }
.btn.confirm:disabled { background-color: #9ec5f0; cursor: not-allowed; }
.btn.cancel { background-color: #6c757d; color: white; }
</style>
