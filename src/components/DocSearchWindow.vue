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
                        <tr v-for="docInfo in paginatedDocInfos" :key="docInfo.id" @click="selectDoc(docInfo)" :class="{'selected-row': docInfo.id === selectedDocId}">
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
                    <input type="number" class="page-input" :showSpinButton="false" v-model.number="currentPage" min="1" :max="totalPage" @change="changePage(currentPage)"/>
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

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || '';

export default{
    name: "DocSearchWindow",
    props: {
        headerName: {type: String, default: ""},
        existingDocs: {type: Array, default: () => []},  // [{ docId, docName }]
    },
    data() {
        return {
            docInfos: [],
            results: [],
            totalCount: 0,
            selectedDocId: null,

            docName: "",
            docId: null,

            currentPage: 1,
            pageRows: 8,
            searchKeyword: '',
        }
    },
    computed: {
        totalPage() {
            if (!this.totalCount)
                return 1;
            return Math.ceil(this.totalCount / this.pageRows);
        },
        paginatedDocInfos() {
            return this.results;
        },
    },
    mounted() {
        this.fetchDocs('');
    },
    methods: {
        async fetchDocs(keyword = '') {
            try {
                const resp = await axios.get(`${API_BASE_URL}/dcc/docs`, {
                    params: {
                        keyword,
                        page: this.currentPage,
                        page_size: this.pageRows,
                    }
                });

                if (!resp.data || !resp.data.success) {
                    console.error('取得文件清單失敗:', resp.data);
                    alert('取得文件清單失敗');
                    return;
                }

                const rows = resp.data.data || [];
                this.totalCount = resp.data.total || 0;

                const existingIds = new Set(this.existingDocs.map(d => d.docId));

                this.results = rows
                    .filter(r => !existingIds.has(r.dccno))
                    .map((r, index) => ({
                        id: index,
                        docId: r.dccno,
                        docName: r.dccname,
                    }));

                this.docInfos = this.results;
                this.selectedDocId = null;
                this.docId = null;
                this.docName = "";
            } catch (err) {
                console.error('呼叫 /dcc/docs 發生錯誤:', err);
                alert('無法連線到伺服器 (文件搜尋)');
            }
        },

        searchDoc(searchKeyword) {
            this.searchKeyword = searchKeyword || '';
            this.currentPage = 1;
            this.fetchDocs(this.searchKeyword);
        },

        selectDoc(docInfo) {
            this.selectedDocId = docInfo.id;
            this.docId = docInfo.docId;
            this.docName = docInfo.docName;
        },

        changePage(page) {
            if (page < 1 || page > this.totalPage) return;
            this.currentPage = page;
            this.fetchDocs(this.searchKeyword);
        },

        addNewDoc() {
            if (!this.docName || this.docName == ""){
                alert("文件名稱不能為空");
                return;
            }
            if (!this.docId || this.docId == ""){
                alert("請選擇表單");
                return;
            }
            this.$emit("add-new-doc", {docId: this.docId, docName: this.docName});
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