<template>
  <div class="dept-process-page">
    <!-- 輕量 toast -->
    <transition name="fade">
      <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.text }}</div>
    </transition>

    <div class="page-header">
      <h2>課別製程管理</h2>
      <span class="subtitle">設定每個課別可使用的製程（課別與製程主檔由 HR / SAJET 系統維護）</span>
    </div>

    <div class="master-detail">
      <!-- 左：課別樹 -->
      <aside class="master">
        <div class="panel-title">課別組織</div>
        <div class="tree-scroll">
          <p v-if="treeLoading" class="loading">載入課別樹…</p>
          <p v-else-if="!tree.length" class="loading">無課別資料</p>
          <DepartmentTreeNode
            v-for="node in tree"
            v-else
            :key="node.deptNo"
            :node="node"
            :depth="0"
            :selected-dept-no="selectedNode ? selectedNode.deptNo : ''"
            @select="selectDept"
          />
        </div>
      </aside>

      <!-- 右：製程綁定 -->
      <section class="detail">
        <!-- 未選課別 -->
        <div v-if="!selectedNode" class="placeholder">
          <p>請於左側選擇一個「課別」以管理其製程綁定。</p>
        </div>

        <template v-else>
          <div class="detail-header">
            <div>
              <div class="dept-name">{{ selectedNode.deptName }}</div>
              <div class="dept-no">{{ selectedNode.deptNo }}</div>
            </div>
            <button class="btn add" @click="openAddModal">＋ 新增製程</button>
          </div>

          <div class="detail-body">
            <p v-if="processesLoading" class="loading">載入製程清單…</p>

            <template v-else>
              <p v-if="processes.length" class="bound-count">
                目前已綁定 {{ processes.length }} 個製程：
              </p>

              <ul v-if="processes.length" class="process-list">
                <li v-for="p in processes" :key="p.processCode" class="process-item">
                  <span class="dot">•</span>
                  <span class="p-code">{{ p.processCode }}</span>
                  <span class="p-name">{{ p.processName }}</span>
                  <button
                    class="btn-remove"
                    title="移除綁定"
                    :disabled="removingCode === p.processCode"
                    @click="removeProcess(p)"
                  >×</button>
                </li>
              </ul>

              <div v-else class="empty-state">
                此課別尚未綁定任何製程，點上方按鈕開始綁定。
              </div>
            </template>
          </div>
        </template>
      </section>
    </div>

    <!-- 新增製程 Modal -->
    <AddProcessWindow
      v-if="showAddModal && selectedNode"
      ref="addModal"
      :dept-no="selectedNode.deptNo"
      :dept-name="selectedNode.deptName"
      @confirm="onConfirmAdd"
      @cancel="showAddModal = false"
      @error="(msg) => notify(msg, 'error')"
    />
  </div>
</template>

<script>
import DepartmentTreeNode from "@/components/DepartmentTreeNode.vue";
import AddProcessWindow from "@/components/AddProcessWindow.vue";
import {
  getDepartmentTree,
  getDepartmentProcesses,
  bindProcesses,
  unbindProcess,
} from "@/api/departmentApi";

export default {
  name: "DepartmentProcessPage",
  components: { DepartmentTreeNode, AddProcessWindow },
  data() {
    return {
      tree: [],
      treeLoading: false,
      selectedNode: null, // 直接持有樹節點參照，更新 processCount 時樹會同步反映
      processes: [],
      processesLoading: false,
      showAddModal: false,
      removingCode: "",
      toast: { show: false, text: "", type: "info", timer: null },
    };
  },
  mounted() {
    this.loadTree();
  },
  beforeUnmount() {
    if (this.toast.timer) clearTimeout(this.toast.timer);
  },
  methods: {
    notify(text, type = "info") {
      if (this.toast.timer) clearTimeout(this.toast.timer);
      this.toast = { show: true, text, type, timer: null };
      this.toast.timer = setTimeout(() => { this.toast.show = false; }, 2800);
    },

    async loadTree() {
      this.treeLoading = true;
      try {
        const res = await getDepartmentTree();
        if (res.success) {
          this.tree = res.data?.tree || [];
        } else {
          this.notify(res.error || "載入課別樹失敗", "error");
        }
      } catch (e) {
        this.notify("系統錯誤，無法載入課別樹", "error");
      } finally {
        this.treeLoading = false;
      }
    },

    async selectDept(node) {
      this.selectedNode = node;
      await this.loadProcesses();
    },

    async loadProcesses() {
      if (!this.selectedNode) return;
      this.processesLoading = true;
      this.processes = [];
      try {
        const res = await getDepartmentProcesses(this.selectedNode.deptNo);
        if (res.success) {
          this.processes = res.data?.items || [];
        } else {
          this.notify(res.error || "載入製程清單失敗", "error");
        }
      } catch (e) {
        this.notify("系統錯誤，無法載入製程清單", "error");
      } finally {
        this.processesLoading = false;
      }
    },

    openAddModal() {
      this.showAddModal = true;
    },

    async onConfirmAdd(processes) {
      const modal = this.$refs.addModal;
      try {
        const res = await bindProcesses(this.selectedNode.deptNo, processes);
        if (res.success) {
          const added = res.data?.added ?? 0;
          // 直接 patch 樹節點 processCount（selectedNode 即樹中同一參照）
          this.selectedNode.processCount += added;
          this.showAddModal = false;
          await this.loadProcesses();
          if (added > 0) this.notify(`成功綁定 ${added} 個製程`, "success");
          else this.notify("所選製程皆已綁定，未新增", "info");
        } else {
          if (modal) modal.releaseSubmit();
          this.notify(res.error || "綁定失敗", "error");
        }
      } catch (e) {
        if (modal) modal.releaseSubmit();
        this.notify("系統錯誤，綁定失敗", "error");
      }
    },

    async removeProcess(p) {
      if (!window.confirm(`確定移除「${p.processName}」？`)) return;
      this.removingCode = p.processCode;
      try {
        const res = await unbindProcess(this.selectedNode.deptNo, p.processCode);
        if (res.success) {
          this.processes = this.processes.filter((x) => x.processCode !== p.processCode);
          if (this.selectedNode.processCount > 0) this.selectedNode.processCount -= 1;
          this.notify("已移除綁定", "success");
        } else {
          this.notify(res.error || "移除失敗", "error");
        }
      } catch (e) {
        this.notify("系統錯誤，移除失敗", "error");
      } finally {
        this.removingCode = "";
      }
    },
  },
};
</script>

<style scoped>
.dept-process-page { padding: 4px 8px; position: relative; }

.page-header { margin-bottom: 12px; }
.page-header h2 { margin: 0; font-size: 20px; color: #023b64; }
.page-header .subtitle { font-size: 13px; color: #888; }

.master-detail {
  display: flex;
  gap: 16px;
  align-items: stretch;
  min-height: 70vh;
}

/* 左欄 */
.master {
  width: 320px;
  flex-shrink: 0;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-title {
  padding: 10px 14px;
  font-weight: bold;
  color: #fff;
  background: #61a5d6;
}
.tree-scroll { padding: 8px; overflow-y: auto; flex: 1; }

/* 右欄 */
.detail {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 15px;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #eee;
  background: #f8fbfe;
}
.dept-name { font-size: 16px; font-weight: bold; color: #023b64; }
.dept-no { font-size: 12px; color: #999; margin-top: 2px; }

.btn.add {
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  background: #007bff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.btn.add:hover { background: #0069d9; }

.detail-body { padding: 16px 18px; overflow-y: auto; flex: 1; }
.bound-count { margin: 0 0 10px; font-size: 14px; color: #555; }

.process-list { list-style: none; margin: 0; padding: 0; }
.process-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid #f2f2f2;
  font-size: 14px;
}
.process-item:hover { background: #fafcfe; }
.process-item .dot { color: #61a5d6; margin-right: 8px; }
.p-code { font-family: "Consolas", monospace; color: #0a66c2; margin-right: 12px; min-width: 88px; }
.p-name { flex: 1; color: #333; }
.btn-remove {
  border: none;
  background: transparent;
  color: #c0392b;
  font-size: 18px;
  line-height: 1;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
}
.btn-remove:hover { background: #fdecec; }
.btn-remove:disabled { color: #ccc; cursor: not-allowed; }

.empty-state {
  padding: 40px 0;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.loading { color: #888; font-size: 14px; padding: 12px; }

/* toast */
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 22px;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  z-index: 2000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.toast.info { background: #34495e; }
.toast.success { background: #27ae60; }
.toast.error { background: #c0392b; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
