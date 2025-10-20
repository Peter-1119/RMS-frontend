<template>
    <div class="window-wrapper" @click.self="closeWindow">
        <div class="dialog">
            <div class="window-header">
                <h3>{{ headerName }}</h3>
            </div>
            <div class="content">
                <div class="search-block">
                    <p>關鍵字：</p>
                    <input type="text" class="form-input" v-model="searchKeyword" placeholder="請輸入文件名稱" @keyup.enter="searchForm(searchKeyword)"/>
                    <button class="btn-search" @click="searchForm(searchKeyword)">搜尋</button>
                </div>
                <table class="search-table">
                    <thead>
                        <tr>
                            <th>文管編號</th>
                            <th>文件名稱</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="formInfo in paginatedFormInfos" :key="formInfo.id" @click="selectForm(formInfo)" :class="{'selected-row': formInfo.id === selectedFormId}">
                            <td>{{ formInfo.formId }}</td>
                            <td>{{ formInfo.formName }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="footer">
                <div class="page-action-block">
                    <span class="icon-item prev" @click="changePage(currentPage - 1)" :class="{'disabled': currentPage === 1}">&lt;</span>
                    <label>第</label>
                    <input type="number" class="page-input" :showSpinButton="false" v-model.number="currentPage" min="1" :max="totalPage"/>
                    <label>頁, 共{{ totalPage }}頁</label>
                    <span class="icon-item next" @click="changePage(currentPage + 1)" :class="{'disabled': currentPage === totalPage}">&gt;</span>
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

export default{
    name: "FormSearchWindow",
    props: {
        headerName: {type: String, default: ""},
        existingForms: {type: Array, default: () => []},
    },
    data() {
        return {
            formInfos: [],
            results: [],
            selectedFormId: null,

            formName: "",
            formId: null,

            currentPage: 1,         // 當前頁碼
            pageRows: 8,           // 每頁顯示筆數
            searchKeyword: '',      // 新增：搜尋關鍵字
        }
    },
    computed: {
        totalPage() {
            if (!this.results.length)
                return 1;
            return Math.ceil(this.results.length / this.pageRows);
        },
        // 當前頁面要顯示的資料
        paginatedFormInfos() {
            const start = (this.currentPage - 1) * this.pageRows;
            const end = start + this.pageRows;
            return this.results.slice(start, end);
        },
    },
    mounted() {
        this.requestFormInfomations();
    },
    methods: {
        requestFormInfomations() {
            const res = [
                {formId: "FM-R-MF-AF-035", formName: "K# 康代RTR AOI檢查機日常點檢表"},
                {formId: "FM-R-MF-AF-036", formName: "K# 康代RTR VRS檢修機日常點檢表"},
                {formId: "FM-R-MF-AF-050", formName: "K# 康代SBS AOI檢修機日常點檢表"},
                {formId: "FM-R-MF-AF-051", formName: "K# 康代SBS VRS檢修機日常點檢表"},
                {formId: "FM-R-MF-AF-032", formName: "K# 由田RTR AOI線路檢查機日常點檢表"},
                {formId: "FM-R-MF-AA-167", formName: "K#SBS盲檢機日常點檢表"},
                {formId: "FM-R-MF-AD-169", formName: "K# LPSM粗糙度送件紀錄表"},
                {formId: "FM-R-MF-AD-170", formName: "K# LPSM粗糙度送測單"},
                {formId: "FM-R-MF-AA-172", formName: "K#SBS盲檢作業日報表"},
                {formId: "FM-R-MF-AB-232", formName: "K# RTR LVI前處理日常點檢表"},
                {formId: "FM-R-MF-AB-238", formName: "K# SBS黑影線日常點檢表"},
                {formId: "FM-R-MF-AB-240", formName: "K# SBS黑影線作業日報表"},
                {formId: "FM-R-MF-AE-267", formName: "K# LPSM前處理微蝕線日常點檢表"},
                {formId: "FM-R-MF-AT-527", formName: "K#SBS盲孔檢查機-01~03預防保養管理表"},
            ]

            this.formInfos = res.map((formInfo, index) => ({ id: index, ...formInfo }));
        },
        searchForm(searchKeyword) {
            const keyword = searchKeyword.toLowerCase();
            const existingIds = new Set(this.existingForms.map(f => f.formId));

            this.results =  this.formInfos.filter(info => {
                const matchKeyword = info.formName.toLowerCase().includes(keyword) || info.formId.toLowerCase().includes(keyword);
                const isExisting = existingIds.has(info.formId);

                return matchKeyword && !isExisting;
            })
        },
        selectForm(formInfo) {
            this.selectedFormId = formInfo.id;
            this.formId = formInfo.formId;
            this.formName = formInfo.formName;
        },
        changePage(page) {
            if (page >= 1 && page <= this.totalPage)
                this.currentPage = page;
        },
        addNewForm() {
            if (!this.formName || this.formName == ""){
                alert("條件名稱不能為空");
                return;
            }
            if (!this.formId || this.formId == ""){
                alert("請選擇表單");
                return;
            }
            this.$emit("add-new-form", {formId: this.formId, formName: this.formName});
        },
        closeWindow() {
            console.log("cancel window");
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