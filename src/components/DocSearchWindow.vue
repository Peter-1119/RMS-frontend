<template>
    <div class="window-wrapper" @click.self="closeWindow">
        <div class="dialog">
            <div class="window-header">
                <h3>{{ headerName }}</h3>
            </div>
            <div class="content">
                <div class="search-block">
                    <p>關鍵字：</p>
                    <input type="text" class="doc-input" v-model="searchKeyword" placeholder="請輸入文件名稱" @keyup.enter="searchDoc(searchKeyword)"/>
                    <button class="btn-search" @click="searchDoc(searchKeyword)">搜尋</button>
                </div>
                <table class="search-table">
                    <thead>
                        <tr>
                            <th>文管編號</th>
                            <th>文件名稱</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="docInfo in results" :key="docInfo.id" @click="selectDoc(docInfo)" :class="{'selected-row': docInfo.id === selectedDocId}">
                            <td>{{ docInfo.docId }}</td>
                            <td>{{ docInfo.docName }}</td>
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
                    <button class="btn confirm" @click="addNewDoc">確定</button>
                    <button class="btn cancel" @click="closeWindow">取消</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import axios from 'axios';

export default{
    name: "DocSearchWindow",
    props: {
        headerName: {type: String, default: ""},
        existingDocs: {type: Array, default: () => []},
    },
    data() {
        return {
            docInfos: [],
            results: [],
            selectedDocId: null,

            docName: "",
            docId: null,

            currentPage: 1,         // 當前頁碼
            pageRows: 8,           // 每頁顯示筆數
            searchKeyword: '',      // 新增：搜尋關鍵字
        }
    },
    computed: {
        // filteredDocInfos() {
        //     const keyword = this.searchKeyword.toLowerCase();
        //     const existingIds = new Set(this.existingDocs.map(f => f.docId));

        //     return this.docInfos.filter(info => {
        //         const matchKeyword = info.docName.toLowerCase().includes(keyword) || info.docId.toLowerCase().includes(keyword);
        //         const isExisting = existingIds.has(info.docId);

        //         return matchKeyword && !isExisting;
        //     })
        // },
        totalPage() {
            if (!this.results.length)
                return 1;
            return Math.ceil(this.results.length / this.pageRows);
        },
        // 當前頁面要顯示的資料
        paginatedDocInfos() {
            const start = (this.currentPage - 1) * this.pageRows;
            const end = start + this.pageRows;
            return this.results.slice(start, end);
        },
    },
    mounted() {
        this.requestDocInfomations();
    },
    methods: {
        requestDocInfomations() {
            const res = [
                {docId: "WQD012", docName: "乾膜剝膜品質確認指示書"},
                {docId: "WWA108", docName: "K#_RTR LVI盲孔檢查機-01~08_作業流程作業指示書"},
                {docId: "WWA124", docName: "K#_RTR/SBS盲孔檢查OCAP 異常處理流程作業指示書"},
                {docId: "WWD125", docName: "K# 乾膜剝膜破膜點測試方法作業指示書"},
                {docId: "WWB143", docName: "K# RTR 局部銅電剝膜線作業指示書"},
                {docId: "WWC222", docName: "K# 康代AOI檢查機&VRS檢修機作業指示書"},
                {docId: "WWC228", docName: "K# 康代AOI檢查機日常檢查作業指示書"},
                {docId: "WWC229", docName: "K# 康代VRS檢查機日常檢查作業指示書"},
                {docId: "WWC256", docName: "K# AOI檢測作業指示書"},
                {docId: "WWQ1288", docName: "K#_RTR 盲孔檢查機-01~08預防保養作業指示書"},
                {docId: "WWQ1308", docName: "K#_RTR LVI 盲檢機上下料搭載機-01~08預防保養作業指示書"},
            ]

            this.docInfos = res.map((docInfo, index) => ({ id: index, ...docInfo }));
        },
        searchDoc(searchKeyword) {
            const keyword = searchKeyword.toLowerCase();
            const existingIds = new Set(this.existingDocs.map(f => f.docId));

            this.results = this.docInfos.filter(info => {
                const matchKeyword = info.docName.toLowerCase().includes(keyword) || info.docId.toLowerCase().includes(keyword);
                const isExisting = existingIds.has(info.docId);

                return matchKeyword && !isExisting;
            })
        },
        selectDoc(docInfo) {
            this.selectedDocId = docInfo.id;
            this.docId = docInfo.docId;
            this.docName = docInfo.docName;
        },
        changePage(page) {
            if (page >= 1 && page <= this.totalPage)
                this.currentPage = page;
        },
        addNewDoc() {
            if (!this.docName || this.docName == ""){
                alert("條件名稱不能為空");
                return;
            }
            if (!this.docId || this.docId == ""){
                alert("請選擇表單");
                return;
            }
            console.log("Window emit.");
            this.$emit("add-new-doc", {docId: this.docId, docName: this.docName});
        },
        closeWindow() {
            console.log("cancel window");
            this.$emit("close-window");
        }
    },
    watch: {
        // 當搜尋關鍵字改變時，將頁碼重置為 1
        searchKeyword() {
            this.currentPage = 1;
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
/* .doc-input { width: 100%; padding: 8px; margin: 10px; border: 1px solid #ccc; box-sizing: border-box; border-radius: 4px;} */

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
.window-action-block .btn { margin: 4px; padding: 8px 18px; border-radius: 5px; font-size: 14px;  border: none; cursor: pointer; }
.btn.confirm { background-color: #007bff; color: white; }
.btn.cancel { background-color: #6c757d; color: white; }

</style>