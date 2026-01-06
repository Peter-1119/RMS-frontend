<template>
  <div class="window-wrapper" @click.self="closeWindow">
    <div class="dialog">
      <div class="window-header">
        <h3>{{ headerName }}</h3>
      </div>
      <div class="content">
        <div class="search-block">
          <p>關鍵字：</p>
          <input type="text" class="form-input" v-model="keyword" placeholder="請輸入文件名稱" @keyup.enter="searchKeywork(keyword)"/>
          <button class="btn-search" @click="searchForm(keyword)">搜尋</button>
        </div>
        <table class="search-table">
          <thead>
            <tr>
              <th>文管編號</th>
              <th>文件名稱</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="formInfo in formInfos" :key="formInfo.formId" @click="selectedForm = formInfo" :class="{'selected-row': formInfo.formId === selectedForm.formId}">
              <td>{{ formInfo.formId }}</td>
              <td>{{ formInfo.formName }}</td>
            </tr>
          </tbody>
        </table>
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
          <button class="btn confirm" @click="addNewForm">確定</button>
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

      selectedForm: {},
    }
  },
  mounted() {
    this.searchKeywork("");
    this.loading = false;
  },
  methods: {
    async getPagesAndLoad(keyword, page) {
      try{
        const {status, data} = await axios.get(`${API_BASE_URL}/dcc/docs`, { params: { documentType: this.documentType, keyword, pageSize: this.pageSize, getPages: true } });

        if (status != 200) {
          alert(`資料檢索異常，原因為 ${data}`);
          return {pages: 0, data: []};
        }

        return {pages: data.data.pages, data: await this.load(keyword, page)};
      }
      catch { alert("取得資料庫發生問題，請重新確認網路1"); }
      return {pages: 0, data: []};
    },
    async load(keyword, page) {
      try {
        this.loading = true;
        const {status, data} = await axios.get(`${API_BASE_URL}/dcc/docs`, { params: { documentType: this.documentType, keyword, page, pageSize: this.pageSize }});

        if (status != 200) {
          alert(`資料檢索異常，原因為 ${data}`);
          return [];
        }

        return data.data.map(row => { return { formId: row.dccno, formName: row.dccname }; });
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
    addNewForm() {
      if (Object.keys(this.selectedForm).length === 0){
        alert("請選擇表單");
      }
      this.$emit("add-new-form", {formId: this.selectedForm.formId, formName: this.selectedForm.formName});
    },

    closeWindow() {
      this.$emit("close-window");
    }
  }
}
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
    z-index: 1001;
    background-color: rgba(0, 0, 0, 0.5);
}

.dialog {
    background-color: white;
    padding: 10px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 50%;
}

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

.footer { display: flex; margin: 10px; justify-content: space-between; align-items: center; }
.icon-item { background-color: #eee; padding: 4px; margin: 0px 10px; border-radius: 4px; cursor: pointer; transition: background-color 0.3s ease;}
.icon-item:hover { background-color: #ccc;}

/* Chrome, Safari, Edge, Opera */
.page-input::-webkit-outer-spin-button,
.page-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* Firefox */
/* .page-input[type='number'] {
    -moz-appearance: textfield;
} */

/* 為了讓「確定」和「取消」按鈕樣式不同，你可以區分開來 */
.window-action-block .btn { margin: 4px; padding: 8px 18px; border-radius: 5px; font-size: 14px; border: none; cursor: pointer; }
.btn.confirm { background-color: #007bff; color: white; }
.btn.cancel { background-color: #6c757d; color: white; }

</style>