<template>
    <div class="modal-overlay" @click.self="closeWindow">
        <div class="modal-dialog" @click="selectVisible=false">
            <div class="dialog-header">
                <slot name="header">
                    <h3>新增／維護工程之製程</h3>
                </slot>
            </div>

            <div class="content-grid">
                <div class="content-panel">
                    <div class="form-group">
                        <label>工程類別:</label>
                        <div class="text--readonly">{{ form.projectLabel }}</div>
                    </div>

                    <div class="form-group">
                        <h4>已選製程</h4>
                        <div class="scrollable-list">
                            <div
                                v-for="p in selected"
                                :key="p.id"
                                class="list-item"
                            >
                                <span class="list-item-text">{{ p.specCode }} - {{ p.specName }}</span>
                                <button class="btn--remove" @click="removeSelected(p.id)">×</button>
                            </div>
                            <div v-if="!selected.length" class="list-item">
                                <span class="text--muted">尚未選擇任何製程</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="content-panel">
                    <div class="form-group">
                        <label>搜尋未被新增的製程:</label>
                        <div class="input-search-group">
                            <input
                                type="text"
                                v-model="procKeyword"
                                placeholder="請輸入製程關鍵字"
                                @keyup.enter="reloadUnassigned"
                                @input="onProcKeyword"
                            />
                            <button class="btn btn--search" @click="reloadUnassigned">搜尋</button>
                        </div>
                    </div>

                    <div class="form-group machine-list-section">
                        <h4>未被新增的製程</h4>
                        <div class="scrollable-list">
                            <table class="process-table">
                                <thead>
                                    <tr class="process-table__head-row">
                                        <th class="process-table__th process-table__th--checkbox">
                                            <input type="checkbox" :checked="allChecked" @change="toggleAll($event)" />
                                        </th>
                                        <th class="process-table__th process-table__th--code">製程代碼</th>
                                        <th class="process-table__th">製程</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="p in unassigned" :key="p.id">
                                        <td class="process-table__td process-table__td--center">
                                            <input
                                                type="checkbox"
                                                :value="p.id"
                                                v-model="checked"
                                            />
                                        </td>
                                        <td class="process-table__td">{{ p.specCode }}</td>
                                        <td class="process-table__td">{{ p.specName }}</td>
                                    </tr>
                                    <tr v-if="loadingRight">
                                        <td colspan="3" class="process-table__td--loading">讀取中…</td>
                                    </tr>
                                    <tr v-if="!loadingRight && !unassigned.length">
                                        <td colspan="3" class="process-table__td--loading">沒有符合條件的製程</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="flex-line">
                            <div class="pager">
                                <button class="pager__button" :disabled="page===1" @click="changePage(page-1)">上一頁</button>
                                <span class="pager__info">{{ page }} / {{ totalPages }}</span>
                                <button class="pager__button" :disabled="page===totalPages" @click="changePage(page+1)">下一頁</button>
                            </div>
                            <div>
                                <button class="btn btn--move" :disabled="!checked.length" @click="addCheckedToSelected">
                                    加入已選 >>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dialog-footer">
                <button class="btn btn--confirm" :disabled="submitting || !canSubmit" @click="submit">儲存</button>
                <button class="btn btn--cancel" @click="closeWindow">取消</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getUnassignedProcesses, addProcessesToProject } from '@/services/applicableProcess'

// props / emits（和你現有的視窗行為一致）
const props = defineProps({
  visible: { type: Boolean, default: false },
  // 若要支援「編輯模式」，可傳入初值：
  initial: {
    type: Object,
    default: () => null, // { projectCode, projectName, selected: [ {id, specCode, specName}, ... ] }
  }
})
const emit = defineEmits(['close','saved'])

// 左側表單
const form = ref({
  projectCode: props.initial?.projectCode || '',
  projectLabel: props.initial?.displayLabel || ''
})

// 右側：未被新增的製程 + 勾選
const procKeyword = ref('')
const unassigned = ref([])
const checked = ref([])
const loadingRight = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 已選清單（左側）
const selected = ref(props.initial?.selected ? [...props.initial.selected] : [])

// 防抖
let debounceTimer = null
function onProcKeyword() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    reloadUnassigned()
  }, 300)
}

// 載入未被新增的製程
async function reloadUnassigned() {
  loadingRight.value = true
  try {
    const { items, total: t } = await getUnassignedProcesses({
      projectCode: form.value.projectCode, // 依該工程找尚未加入的製程
      keyword: procKeyword.value,
      page: page.value,
      pageSize: pageSize.value
    })
    unassigned.value = items || []
    total.value = t || 0

    // remove items already selected (avoid dupes)
    if (selected.value.length) {
      const selectedSet = new Set(selected.value.map(x => x.id))
      unassigned.value = unassigned.value.filter(x => !selectedSet.has(x.id))
    }

    checked.value = []
  } finally {
    loadingRight.value = false
  }
}



const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
function changePage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  reloadUnassigned()
}

const allChecked = computed(() => unassigned.value.length > 0 && checked.value.length === unassigned.value.length)
function toggleAll(e) {
  const v = e.target.checked
  checked.value = v ? unassigned.value.map(x => x.id) : []
}

function addCheckedToSelected() {
  if (!checked.value.length) return
  const set = new Set(checked.value)
  const addItems = unassigned.value.filter(x => set.has(x.id))
  // 加入已選
  for (const it of addItems) {
    // 防重
    if (!selected.value.some(s => s.id === it.id)) {
      selected.value.push({ id: it.id, specCode: it.specCode, specName: it.specName })
    }
  }
  // 從未選移除 + 清空勾選
  unassigned.value = unassigned.value.filter(x => !set.has(x.id))
  checked.value = []
}

function removeSelected(id) {
  selected.value = selected.value.filter(x => x.id !== id)
}

// 儲存
const submitting = ref(false)
const canSubmit = computed(() => form.value.projectCode.trim().length > 0 && selected.value.length > 0)

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const processIds = selected.value.map(x => ({code: x.specCode, desc: x.specName}))
    // const processIds = selected.value.map(x => x.id) // spec_code list
    await addProcessesToProject({ projectCode: form.value.projectCode.trim(), processIds })
    emit('saved')
  } finally {
    submitting.value = false
  }
}


function closeWindow() {
  emit('close')
}

// 初始化載入未被新增製程
reloadUnassigned()
</script>

<style scoped>
/* 總體視窗與對話框 */
.modal-overlay {
    position: fixed;
    display: flex;
    justify-content: center;
    align-items: center;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 999;
    background-color: rgba(0, 0, 0, 0.5);
}

.modal-dialog { background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); width: 80%; max-width: 1000px; }
.dialog-header { border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 6px; }
.dialog-footer { text-align: right; margin-top: 6px; border-top: 1px solid #eee; padding-top: 4px; }

/* 按鈕樣式 */
.btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; transition: background-color 0.2s; }
.btn--confirm { background-color: #42b983; color: white; } /* 原 .btn.confirm */
.btn--cancel { background-color: #ccc; color: black; } /* 原 .btn.cancel */
.btn--search { background-color: #2196F3; color: #fff; } /* 原 .btn.search */
.btn--remove { background: none; border: none; color: red; font-weight: bold; cursor: pointer; font-size: 1.2em; } /* 原 .remove-btn */
.btn--move { background-color: #4CAF50; color: white; } /* 原 .btn.move-btn */

/* 內容佈局 */
.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; flex-grow: 1; } /* 原 .content-split */
.content-panel { display: flex; flex-direction: column; gap: 8px; } /* 原 .content-left, .content-right */

/* 表單區塊 */
.form-group { display: flex; flex-direction: column; padding: 0 0 10px 0; } /* 原 .form-section */
.form-group label, .form-group h4 { margin: 0px; font-weight: bold; }
.form-group input[type="text"],
.form-group select { padding: 8px; border: 1px solid #ccc; border-radius: 4px; flex-grow: 1; box-sizing: border-box; }
.input-search-group { display: flex; gap: 8px; } /* 原 .specific-input-block */

/* 通用捲動列表 */
.scrollable-list {
  min-height: 120px;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #ccc;
  padding-bottom: 8px;
  border-radius: 4px;
  margin-top: 6px;
  background-color: #fff;
}
.list-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-bottom: 1px solid #eee; word-wrap: break-word; overflow-wrap: break-word; }
.list-item:last-child { border-bottom: none; }
.list-item-text { flex-grow: 1; text-align: left; margin-right: 10px; } /* 原 .list-item span */
.text--muted { color: #888; } /* 原 .text-muted */

/* 製程表格樣式 */
.process-table {
    width: 100%; /* 原 .w-full */
    font-size: 0.875rem; /* 原 .text-sm */
    border-collapse: collapse; /* 原 .border-collapse */
    margin-top: -1px; /* 為了讓表格邊框與 scrollable-list 頂部對齊 */
}
.process-table__head-row {
    background-color: #f8fafc; /* 原 .bg-gray-50 */
}
.process-table__th,
.process-table__td {
    border: 1px solid #ddd; /* 原 .border */
    padding: 0.5rem; /* 原 .p-2 */
    vertical-align: top;
}
.process-table__th--checkbox { width: 48px; } /* 原 .w-12 */
.process-table__th--code { width: 160px; } /* 原 .w-40 */

.process-table__td--center { text-align: center; } /* 原 .text-center */
.process-table__td--loading {
    padding: 1rem; /* 原 .p-4 */
    text-align: center;
    color: #6b7280; /* 原 .text-gray-500 */
}

/* 底部操作與分頁器 */
.flex-line { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; } /* 原 .flex-line, .mt-2 */
.pager { display: flex; gap: 8px; align-items: center; }
.pager__button {
    padding: 0.25rem 0.5rem; /* 原 .px-2 .py-1 */
    border: 1px solid #ddd; /* 原 .border */
    border-radius: 4px; /* 原 .rounded */
    background: white;
    cursor: pointer;
}
.pager__button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}
.pager__info { font-size: 0.875rem; } /* 原 .text-sm */
</style>