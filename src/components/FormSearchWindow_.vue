<template>
  <div class="window-wrapper" @click.self="closeWindow">
    <div class="dialog">
      <div class="window-header">
        <h3>{{ headerName }}</h3>
      </div>
      <div class="content" style="position: relative;"> <div v-if="loading" class="loading-overlay">
          <div class="spinner"></div>
          <p>資料載入中，請稍候...</p>
        </div>

        <div class="search-block">
          <p>關鍵字：</p>
          <input type="text" class="form-input" v-model="keyword" placeholder="請輸入文件名稱" @keyup.enter="searchKeywork(keyword)"/>
          <button class="btn-search" @click="searchKeywork(keyword)" :disabled="loading">{{ loading ? '搜尋中...' : '搜尋' }}</button>
        </div>
        <table class="search-table">
          <thead>
            <tr>
              <th width="50">選擇</th>
              <th>文管編號</th>
              <th>文件名稱</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="formInfo in formInfos" :key="formInfo.refer_document" 
                @click="toggleSelect(formInfo)" 
                :class="{'selected-row': isSelected(formInfo)}">
              <td>
                <input type="checkbox" :checked="isSelected(formInfo)" @click.stop="toggleSelect(formInfo)" />
              </td>
              <td>{{ formInfo.refer_document }}</td>
              <td>{{ formInfo.refer_document_name }}</td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="selectedList.length > 0" class="selection-info">
          已選擇 {{ selectedList.length }} 筆資料
        </div>
        
      </div>
      <div class="footer">
        <div class="page-action-block">
          <span class="icon-item prev" @click="changePage(page - 1)" :class="{'disabled': page === 1}">&lt;</span>
          <label>第</label>
          <input type="number" class="page-input" :showSpinButton="false" v-model.number="page" min="1" :max="total" @change="changePage(page)"/>

          <label>頁, 共{{ total }}頁</label>
          <span class="icon-item next" @click="changePage(page + 1)" :class="{'disabled': page === total}">&gt;</span>
        </div>
        <div class="window-action-block">
          <button class="btn confirm" @click="addNewForms">確定</button>
          <button class="btn cancel" @click="closeWindow">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || '';

export default{
  name: "FormSearchWindow",
  props: { 
    headerName: {type: String, default: ""},
    documentType: {type: String, default: ""},
  },
  data() {
    return {
      formInfos: [],
      loading: false,
      errorMsg: "",
      page: 1,
      pageSize: 10,
      total: 0,
      keyword: '',
      
      // ★ 修改點：用陣列取代原本的 Object
      selectedList: [], 
    }
  },
  mounted() {
    this.searchKeywork("");
    this.loading = false;
  },
  methods: {
    // ... 前面的 getPagesAndLoad, load, changePage, searchKeywork 保持不變 ...
    async getPagesAndLoad(keyword, page) {
      try{
        const {status, data} = await axios.get(`${API_BASE_URL}/dcc/docs`, { params: { documentType: this.documentType, keyword, pageSize: this.pageSize, getPages: true } });
        if (status != 200) { alert(`資料檢索異常，原因為 ${data}`); return {pages: 0, data: []}; }
        return {pages: data.data.pages, data: await this.load(keyword, page)};
      }
      catch { alert("取得資料庫發生問題，請重新確認網路1"); }
      return {pages: 0, data: []};
    },
    async load(keyword, page) {
      try {
        this.loading = true;
        const {status, data} = await axios.get(`${API_BASE_URL}/dcc/docs`, { params: { documentType: this.documentType, keyword, page, pageSize: this.pageSize }});
        if (status != 200) { alert(`資料檢索異常，原因為 ${data}`); return []; }
        return data.data.map(row => { return { refer_document: row.dccno, refer_document_name: row.dccname }; });
      }
      catch { alert("取得資料庫發生問題，請重新確認網路2"); }
      return [];
    },
    async changePage(p) {
      if (p < 1 || p > this.total) return;
      this.loading = true;
      this.page = p;
      this.formInfos = await this.load(this.keyword, this.page);
      this.loading = false;
    },
    async searchKeywork(keyword) {
      this.loading = true;
      this.keyword = keyword;
      this.page = 1;
      const info = await this.getPagesAndLoad(this.keyword, this.page);
      this.total = info.pages;
      this.formInfos = info.data;
      this.loading = false;
    },

    // ★ 修改點：處理多選邏輯
    toggleSelect(formInfo) {
      const idx = this.selectedList.findIndex(f => f.refer_document === formInfo.refer_document);
      if (idx > -1) { this.selectedList.splice(idx, 1); }
      else { this.selectedList.push(formInfo); }
    },
    isSelected(formInfo) { return this.selectedList.some(f => f.refer_document === formInfo.refer_document); },
    addNewForms() {
      if (this.selectedList.length === 0) { alert("請至少選擇一筆資料"); return; }
      this.$emit("add-new-forms", this.selectedList);
    },
    closeWindow() { this.$emit("close-window"); }
  }
}
</script>

<style scoped> 
/* 這裡保留您原本的樣式，並加上一點 selection-info 的樣式 */
.window-wrapper { position: fixed; display: flex; justify-content: center; align-items: center; top: 0; left: 0; width: 100%; height: 100%; z-index: 1001; background-color: rgba(0, 0, 0, 0.5); }
.dialog { background-color: white; padding: 10px 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); width: 50%; }
.window-header { padding: 10px 0; border-bottom: 1px solid #eee; margin-bottom: 20px; }
.window-header h3 { margin: 0px; }
.search-block { display: flex; align-items: center; justify-content: center; }
.search-block p { margin: 0; }
.search-block input { width: 50%; margin-right: 10px; padding: 8px; padding: 4px; font-size: 15px; border-radius: 4px; }
.search-block button { padding: 4px 8px; font-size: 14px; }
.search-table { width: 100%; margin: 10px; border-collapse: collapse; table-layout: auto; }
.search-table tbody tr { cursor: pointer; transition: background-color 0.2s ease;}
.search-table tbody tr:hover { background-color: #f5f5f5;}
.search-table tbody tr.selected-row { background-color: #e0f7fa; font-weight: bold; }
.search-table th, .search-table td { border: 1px solid #ddd; padding: 8px; word-wrap: break-word; text-align: center; }

/* 勾選計數器提示 */
.selection-info { margin: 10px; color: #007bff; font-weight: bold; text-align: right; font-size: 14px; }

.footer { display: flex; margin: 10px; justify-content: space-between; align-items: center; }
.icon-item { background-color: #eee; padding: 4px; margin: 0px 10px; border-radius: 4px; cursor: pointer; transition: background-color 0.3s ease;}
.icon-item:hover { background-color: #ccc;}
.page-input::-webkit-outer-spin-button, .page-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.window-action-block .btn { margin: 4px; padding: 8px 18px; border-radius: 5px; font-size: 14px; border: none; cursor: pointer; }
.btn.confirm { background-color: #007bff; color: white; }
.btn.cancel { background-color: #6c757d; color: white; }

/* --- Loading 遮罩與動畫 --- */
.loading-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(255, 255, 255, 0.8); /* 半透明白底 */
  z-index: 10; /* 蓋在表格上方 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3; /* 淺灰色底環 */
  border-top: 4px solid #007bff; /* 藍色動態環 */
  border-radius: 50%;
  animation: spin 1s linear infinite; /* 旋轉動畫 */
  margin-bottom: 10px;
}

.loading-overlay p {
  color: #007bff;
  font-weight: bold;
  font-size: 14px;
  margin: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>