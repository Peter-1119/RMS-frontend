<template>
  <div class="window-wrapper" @click.self="closeWindow">
    <div class="dialog">
      <div class="header">
        <h3>品目選取</h3>
      </div>

      <div class="content">
        <div class="search-block">
          <p>關鍵字：</p>
          <input type="text" class="search-keyword-input" v-model.trim="keyword" placeholder="請輸入 MATNR 關鍵字" @keyup.enter="requestItemsFromAPI(keyword)"/>
          <button class="btn-search" @click="requestItemsFromAPI(keyword)">搜尋</button>
        </div>

        <p v-if="warningText" style="color: red; margin-top: 8px;">{{ warningText }}</p>

        <table class="item_table" v-if="filterItems.length">
          <thead>
            <tr>
              <th></th>
              <th>品目代碼 (MATNR)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in paginatedItemsInfos" :key="p">
              <td><input type="radio" :value="p" v-model="selectedItem" /></td>
              <td>{{ p }}</td>
            </tr>
          </tbody>
        </table>

        <!-- <p v-else style="margin-top: 12px;">尚未有查詢結果</p> -->
      </div>

      <div class="footer">
        <div class="page-action-block">
          <span class="icon-item prev" @click="goPrevPage" :class="{ disabled: currentPage === 1 }">&lt;</span>
          <label>第</label>
          <input type="number" class="page-input" v-model.number="currentPage" :min="1" :max="totalPage"/>
          <label>頁, 共 {{ totalPage }} 頁</label>
          <span class="icon-item next" @click="goNextPage" :class="{ disabled: currentPage === totalPage }">&gt;</span>
        </div>

        <div class="window-action-block">
          <button class="btn confirm" @click="selectItem">確定</button>
          <button class="btn cancel" @click="closeWindow">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "ItemListWindow",
  props: {
    specificCode: { type: String, default: "" }, // 製程代碼
    machineCode:  { type: String, default: "" }, // 機台代碼
  },
  data() {
    return {
      keyword: "",
      items: [],        // 從 API 回來的完整資料
      filterItems: [],  // 目前畫面顯示用（之後要再加篩選也方便）
      pageRows: 8,
      currentPage: 1,
      selectedItem: null,
      warningText: "",
    };
  },
  computed: {
    totalPage() {
      if (!this.filterItems.length) return 1;
      return Math.ceil(this.filterItems.length / this.pageRows);
    },
    paginatedItemsInfos() {
      const start = (this.currentPage - 1) * this.pageRows;
      const end = start + this.pageRows;
      return this.filterItems.slice(start, end);
    },
  },
  mounted() {
    this.requestItemsFromAPI("")
  },
  watch: {
    currentPage(val) {
      if (val < 1) this.currentPage = 1;
      if (val > this.totalPage) this.currentPage = this.totalPage;
    },
  },
  methods: {
    async requestItemsFromAPI(keyword) {
      this.warningText = "品目查詢中";
      this.selectedItem = null;
      this.items = [];
      this.filterItems = [];
      this.currentPage = 1;

      if (this.specificCode.length ==0 && this.machineCode.length == 0 && keyword.length === 0) {
        this.warningText = "請輸入關鍵字";
        return;
      }

      try {
        const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || "";
        const url = `${API_BASE_URL}/item/search`;

        const params = { keyword };
        if (this.specificCode) params.specific = this.specificCode;
        if (this.machineCode)  params.machine  = this.machineCode;

        const response = await axios.get(url, { params });
        this.warningText = "資料處理中";

        if (!response.data.success) {
          this.warningText = response.data.error || "查詢失敗";
          return;
        }

        this.items = Array.isArray(response.data.data?.items) ? response.data.data.items : [];

        this.filterItems = this.items;
        if (!this.filterItems.length) {
          this.warningText = "查無符合條件的品目";
        }
        else {
          this.warningText = "";
        }
      } catch (error) {
        console.error("Error fetching items:", error);
        this.warningText = "系統錯誤，無法取得資料";
      }
    },
    goPrevPage() {
      if (this.currentPage > 1) this.currentPage -= 1;
    },
    goNextPage() {
      if (this.currentPage < this.totalPage) this.currentPage += 1;
    },
    selectItem() {
      this.$emit("selectItem", this.selectedItem);
      this.$emit("cancel");
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
.dialog { background-color: white; width: 40%; border-radius: 8px; box-shadow: 0 4px 6px; padding: 0; overflow: hidden; }

.header,
.footer { display: flex; justify-content: space-between; width: 100%; margin: 0; padding: 8px 20px; align-items: center; box-sizing: border-box; }
.header { background-color: #61a5d6; }
.footer { background-color: white; border-top: 1px solid #ddd; }
.header h3 { margin: 0; padding: 0; }

.content { padding: 12px; }
.content input { padding: 4px; font-size: 15px; border-radius: 4px; }

.search-block { display: flex; align-items: center; justify-content: center; }
.search-block p { margin: 0; }
.search-block input { width: 50%; margin-right: 10px; }
.search-block button { padding: 4px 8px; font-size: 14px; }

.item_table { width: 100%; margin: 12px 0; border-collapse: collapse; table-layout: auto; }
.item_table th,
.item_table td { border: 1px solid #ddd; padding: 8px; word-wrap: break-word; text-align: center; }

.icon-item { background-color: #eee; padding: 4px; margin: 0px 10px; border-radius: 4px; cursor: pointer; transition: background-color 0.3s ease; }
.icon-item:hover { background-color: #ccc; }
.icon-item.disabled { opacity: 0.5; cursor: default; }

.window-action-block .btn { margin: 4px; padding: 8px 18px; border-radius: 5px; font-size: 14px; border: none; cursor: pointer; }
.btn.confirm { background-color: #007bff; color: white; }
.btn.cancel { background-color: #6c757d; color: white; }

</style>
