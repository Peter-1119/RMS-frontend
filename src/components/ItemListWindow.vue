<template>
    <div class="window-wrapper" @click.self="closeWindow">
        <div class="dialog">
            <div class="header"><h3>品目選取</h3></div>
            <div class="content">
                <div class="search-block">
                    <p>關鍵字：</p>
                    <input type="text" class="search-keyword-input" v-model="keyword" placeholder="請輸入關鍵字" @keyup.enter="requestItemsFromAPI(keyword)"/>
                    <button class="btn-search" @click="requestItemsFromAPI(keyword)">搜尋</button>
                </div>
                <table class="item_table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>廠別</th>
                            <th>品目代碼</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in paginatedItemsInfos" :key="p.code">
                            <td><input type="radio" :value="p" v-model="selectedItem"/></td>
                            <td>{{ p.factoryCode }}</td>
                            <td>{{ p.itemCode }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="footer">
                <div class="page-action-block">
                    <span class="icon-item prev" @click="currentPage = (currentPage > 1) ? currentPage - 1 : currentPage" :class="{'disabled': currentPage === 1}">&lt;</span>
                    <label>第</label>
                    <input type="number" class="page-input" :showSpinButton="false" v-model.number="currentPage" min="1" :max="totalPage"/>
                    <label>頁, 共{{ totalPage }}頁</label>
                    <span class="icon-item next" @click="currentPage = (currentPage < totalPage) ? currentPage + 1 : currentPage" :class="{'disabled': currentPage === totalPage}">&gt;</span>
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
import axios from 'axios';

export default {
    name: "ItemListWindow",
    props: {
        // items: {type: Array, default: () => []},
    },
    data() {
        return {
            filterItems: [],
            keyword: "",
            items: {},
            pageRows: 8,
            currentPage: 1,
            selectedItem: null,
            warningText: "",
        }
    },
    computed: {
        totalPage() {
            if (!this.filterItems.length)
                return 1;
            return Math.ceil(this.filterItems.length / this.pageRows);
        },
        paginatedItemsInfos() {
            const start = (this.currentPage - 1) * this.pageRows;
            const end = start + this.pageRows;
            return this.filterItems.slice(start, end);
        },
    },
    methods: {
        async requestItemsFromAPI(keyword) {
            try {
                this.warningText = "";
                if (keyword.length == 0) {
                    this.warningText = "請輸入關鍵字";
                    return;
                }

                const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
                const response = await axios.get(API_BASE_URL + "/MES-get-machines", {params: {keyword}});

                this.items = {};
                Object.entries(response.data.data.machines).forEach(([mn, mi]) => { this.machines[mn] = mi; })
            } catch (error) {
                console.error("Error fetching Specifics: ", error);
                this.Specifics = [];
            }
        },
        selectItem() {
            this.$emit("selectItem", this.selectedItem);
            this.$emit("cancel");
        },
        closeWindow() {
            this.$emit("cancel");
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
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1001;
}

.dialog { background-color: white; width: 50%; padding: 0px; border-radius: 8px; box-shadow: 0 4px 6px; padding: 0; overflow: hidden; }
.header, .footer { display: flex; justify-content: space-between; background-color: #61a5d6; width: 100%; margin: 0; padding: 8px 20px;  align-items: center; box-sizing: border-box;}
.footer { display: flex; justify-content: space-between; background-color: white; width: 100%; margin: 0; padding: 8px 20px; align-items: center; border-top: 1px solid #ddd; }
.header h3 { margin: 0; padding: 0; }

.content { padding: 12px; }
.content input { padding: 4px; font-size: 15px; border-radius: 4px; }

.search-block { display: flex; align-items: center; justify-content: center; }
.search-block p { margin: 0; }
.search-block input { width: 50%; margin-right: 10px; }
.search-block button { padding: 4px 8px; font-size: 14px; }

.item_table { width: 100%; margin: 12px 0; border-collapse: collapse; table-layout: auto; }
.item_table th, .item_table td { border: 1px solid #ddd; padding: 8px; word-wrap: break-word; text-align: center; }

.icon-item { background-color: #eee; padding: 4px; margin: 0px 10px; border-radius: 4px; cursor: pointer; transition: background-color 0.3s ease;}
.icon-item:hover { background-color: #ccc;}

.window-action-block .btn { margin: 4px; padding: 8px 18px; border-radius: 5px; font-size: 14px;  border: none; cursor: pointer; }
.btn.confirm { background-color: #007bff; color: white; }
.btn.cancel { background-color: #6c757d; color: white; }

</style>