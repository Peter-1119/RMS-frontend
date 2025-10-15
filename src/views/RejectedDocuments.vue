<template>
    <div class="new-instruction-container">
        <div class="header">
            <h1>已退回</h1>
            <button @click="$router.push('/home')" class="back-btn">
                <img src="@/assets/home-icon.png" alt="首頁" class="icon"> 回首頁
            </button>
        </div>

        <div class="form-section">
            <table class="rejected-documents-table">
                <thead CLASS="TABLE-HEADER">
                    <tr style=" "> <th>查看</th> <th>編號</th> <th>文件名稱</th> <th>版本</th> <th>作者</th> <th>退回日期</th> <th>退回者</th> <th>退回理由</th></tr>
                </thead>
                <tbody>
                    <tr v-for="(item, index) in searchData" :key="index">
                        <td>
                            <button class="btn doc" @click="performSearch">
                                <img src="@/assets/document-show-icon.png" alt="文件顯示" class="icon doc">
                            </button>
                        </td>
                        <td>{{ item?.documentID }}</td>
                        <td>{{ item?.documentName }}</td>
                        <td>{{ item?.documentVersion }}</td>
                        <td>{{ item?.author }}</td>
                        <td>{{ item?.issueDate }}</td>
                        <td>{{ item?.rejecter }}</td>
                        <td>
                            <button @click="performSearch" class="btn info">
                                <img src="@/assets/information.png" alt="訊息" class="icon info">
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
    name: "SubmittedDocuments",
    data() {
        return {
            searchData: [
                {documentType: 0, documentID: 'WMD051', documentName: 'K#_RTR線路蝕刻剝膜線-01_製造條件指示書', documentVersion: '1.0', author: '許小予', rejecter: "王大明", issueDate: '2025.06.30'},
                {documentType: 0, documentID: 'WMD052', documentName: 'K#_新產品開發流程_作業指導書', documentVersion: '2.0', author: '陳大明', rejecter: "王大明", issueDate: '2025.07.15'},
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', rejecter: "王大明", issueDate: '2025.07.01'},
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', rejecter: "王大明", issueDate: '2025.07.01'},
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', rejecter: "王大明", issueDate: '2025.07.01'},
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', rejecter: "王大明", issueDate: '2025.07.01'},
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', rejecter: "王大明", issueDate: '2025.07.01'},
                {documentType: 0, documentID: 'QAS003', documentName: '品質檢測標準_V2.0', documentVersion: '2.0', author: '李小美', rejecter: "王大明", issueDate: '2025.07.01'},
            ]
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
.header h1 { margin: 0; font-size: 28px; color: #333;}

.back-btn, .save-btn {
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

.form-section { padding: 20px 0; }

.rejected-documents-table { border-collapse: collapse; border: none; width: 100%; }
.rejected-documents-table th, .rejected-documents-table td { border: none; padding: 10px 20px; text-align: left; }
.rejected-documents-table .btn { background-color: #9e99a0; width: 40px; height: 40px; border: none; padding: 8px 8px; border-radius: 5px; cursor: pointer; }
.rejected-documents-table .icon { width: 100%; height: 100%; }

</style>