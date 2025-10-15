<template>
    <div class="new-instruction-container">
        <div class="header">
            <h1>檢索</h1>
            <button @click="$router.push('/home')" class="back-btn">
                <img src="@/assets/home-icon.png" alt="首頁" class="icon"> 回首頁
            </button>
        </div>

        <div class="steps-navigation">
            <div class="search-container">
                <input type="text" v-model="keyword" placeholder="請輸入關鍵字" v-on:keyup.enter="filterDocuments(keyword)"/>
                <button class="btn search" @click="filterDocuments(keyword)">
                    <img src="@/assets/search-icon-white.png" alt="搜尋" class="icon search">
                </button>
            </div>
        </div>

        <div class="form-section">
            <table class="documents-table">
                <thead>
                    <tr style=" "> <th>編號</th> <th>文件名稱</th> <th>版本</th> <th>作者</th> <th>更新日期</th> <th>變更</th> </tr>
                </thead>
                <tbody>
                    <tr v-for="(item, index) in selectedData" :key="index">
                        <td>{{ item?.documentID }}</td>
                        <td>{{ item?.documentName }}</td>
                        <td>{{ item?.documentVersion }}</td>
                        <td>{{ item?.author }}</td>
                        <td>{{ item?.issueDate }}</td>
                        <td>
                            <button class="btn edit" @click="performSearch">
                                <img src="@/assets/edit-icon.png" alt="變更" class="icon edit">
                            </button>
                        </td>
                    </tr>
                    <tr v-if="searchData.length === 0">
                        <td colspan="6" style="text-align: center; padding: 20px;">沒有資料可顯示。</td>
                    </tr>
                </tbody>
            </table>      
        </div>
    </div>
</template>

<script>

export default {
    name: "SearchPage",
    data() {
        return {
            keyword: "",
            searchData: [
                {documentType: 0, documentID: "WMD051", documentName: "K#_RTR線路蝕刻剝膜線-01_製造條件指示書", documentVersion: "1.0", author: "許小予", issueDate: "2025.06.30"},
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', issueDate: '2025.07.01' },
            ],
            selectedData: []
        }
    },
    mounted() {
        this.filterDocuments("");
    },
    methods: {
        filterDocuments(keyword) {
            this.selectedData =  this.searchData.filter(data => {
                console.log("data: ", data)
                const document = data.documentID.includes(keyword) || data.documentName.includes(keyword) || data.author.includes(keyword) || data.issueDate.includes(keyword);
                console.log("data.documentID.includes(keyword): ", data.documentID.includes(keyword))
                return document;
            });
        }
    }
}

</script>

<style scoped>
.new-instruction-container {
  width: 90%;
  margin: 20px auto;
  padding: 25px;
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.header { display: flex; justify-content: space-between; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
.header h1 { margin: 0; font-size: 28px; color: #333; }

.back-btn {
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 15px;
  display: flex;
  align-items: center;
  transition: background-color 0.3s ease;
}
.back-btn:hover { background-color: #5a6268; }
.back-btn .icon { width: 18px; height: 18px; margin-right: 8px; filter: invert(100%); }

.steps-navigation {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30px;
  background-color: #e3f2fd;
  padding: 15px 10px;
  border-radius: 8px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 2px 5px rgba(0,0,0,0.7);
}

.form-section { padding: 20px 0; }

.search-container { display: flex; align-items: center; gap: 10px; }
.search-container .btn { width: 40px; height: 40px; border: none; padding: 10px 10px; border-radius: 5px; cursor: pointer; }
.search-container .btn:hover { background-color: #aaa; }
.search-container .icon { width: 100%; height: 100%; }
.search-container input { width: 400px; padding: 4px; border-radius: 5px; font-size: 16px; }

.documents-table { border-collapse: collapse; border: none; width: 100%; }
.documents-table th, .documents-table td { border: none; padding: 10px 20px; text-align: left; }
.documents-table .btn { background-color: #ffffff; width: 40px; height: 40px; padding: 8px 8px; border: none; border-radius: 5px; cursor: pointer; }
.documents-table .icon { width: 100%; height: 100%; }

</style>