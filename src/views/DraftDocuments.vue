<template>
  <div class="new-instruction-container">
    <div class="header">
      <h1>草稿匣</h1>
    </div>

    <div class="form-section">
      <table class="document-table">
        <thead CLASS="TABLE-HEADER">
          <tr> <th>文件名稱</th> <th>版本</th> <th>作者</th> <th>更新日期</th> <th>變更</th> <th>刪除</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in searchData" :key="index">
            <td v-if="item?.documentName && item?.documentName.length > 0">{{ item?.documentName }}</td>
            <td v-else>{{ item?.documentToken }}</td>
            <td>{{ item?.documentVersion }}</td>
            <td>{{ item?.author }}</td>
            <td>{{ item?.issueDate }}</td>
            <td>
              <button class="btn edit" @click="performSearch(item)"><img src="@/assets/edit-icon.png" alt="變更" class="icon edit"></button>
            </td>
            <td>
              <button @click="deleteDraft(item)" style="border: none; background: none; cursor: pointer;">
                <img src="@/assets/delete-icon.png" alt="刪除" class="btn delete">
              </button>
            </td>
          </tr>
          <tr v-if="searchData.length === 0">
              <td colspan="6" style="text-align: center; padding: 20px;">
              沒有資料可顯示。
            </td>
          </tr>
        </tbody>
      </table>   
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
        <button :disabled="page===1" @click="changePage(page-1)">上一頁</button>
        <span>{{ page }} / {{ total }}</span>
        <button :disabled="page===total" @click="changePage(page+1)">下一頁</button>
      </div>   
    </div>
  </div>
</template>

<script>
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ''

export default {
  name: "DraftDocuments",
  props: {
    userId: { type: String, default: '' },
  },
  data() {
    return {
      searchData: [],
      loading: false,
      errorMsg: '',
      page: 1,
      pageSize: 10,
      total: 0,
      keyword: '',
    }
  },
  computed: {
    totalPages() {
      return Math.max(1, Math.ceil(this.total / this.pageSize))
    },
    effectiveUserId() {
      return this.userId || sessionStorage.getItem('loggedInUserNo') || ''
    }
  },
  methods: {
    async getPagesAndLoad() {
      const {status, data} = await axios.get(`${API_BASE_URL}/docs/drafts`, {
        params: { userId: this.effectiveUserId, keyword: this.keyword, pageSize: this.pageSize, getPages: true }
      })

      if (status != 200) {
        alert("取得資料庫發生問題，請重新確認網路")
        return
      }

      this.total = data.data.pages
      this.load()
    },
    async load() {
      if (!this.effectiveUserId) {
        this.errorMsg = '缺少 user_id，請先登入'
        this.searchData = []
        this.total = 0
        return
      }
      this.loading = true
      try {
        const { status, data } = await axios.get(`${API_BASE_URL}/docs/drafts`, {
          params: { userId: this.effectiveUserId, keyword: this.keyword, page: this.page, pageSize: this.pageSize }
        })

        if (status != 200) {
          alert("訪問資料庫發生問題，請重新確認網路連接")
          return
        }

        this.searchData = (data.data.items || []).map(x => ({...x, issueDate: this.formatDate(x.issueDate),}))
      } catch (e) {
        console.error(e)
        this.searchData = []
        this.total = 0
        this.errorMsg = e?.message || '讀取失敗'
      } finally {
        this.loading = false
      }
    },
    formatDate(iso) {
      if (!iso) return ''
      try {
        const d = new Date(iso)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}.${m}.${day}`
      } catch {
        return iso
      }
    },

    // called by the Edit (變更) button
    performSearch(item) {
      if (!item || !item.documentToken) return
      // Decide destination by documentType
      const routeName = item.documentType === 1 ? 'new-specification' : 'new-instruction'
      // Push with token in query (your pages read via useDraftToken)
      this.$router.push({ name: routeName, query: { token: item.documentToken } })
    },

    // optional: delete handler
    async deleteDraft(item) {
      if (!item?.documentToken) return
      if (!confirm(`確定刪除「${item.documentName || item.documentToken}」草稿？`)) return
      try {
        await axios.delete(`${API_BASE_URL}/docs/${encodeURIComponent(item.documentToken)}`)
        await this.getPagesAndLoad()
      } catch (e) {
        const msg = e?.response?.data?.error || e.message || '刪除失敗'
        alert(msg)
      }
    },
    // Pagination helpers (add buttons in template if desired)
    changePage(p) {
      if (p < 1 || p > this.totalPages) return
      this.page = p
      this.loadDrafts()
    },
  },
  mounted() {
    this.getPagesAndLoad()
  },
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
.header { display: flex; justify-content: space-between; margin-bottom: 20px; }
.header h1 { margin: 0; font-size: 28px; color: #333; }

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

.document-table { 
  border-collapse: collapse;
  width: 100%;
  border: none;

  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.document-table th { 
  border: 1px solid #e0e0e0; 
  padding: 12px 20px; 
  text-align: center; 
  
  background-color: #f0f2f5;
  color: #333333;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.document-table td { border: 1px solid #e0e0e0; padding: 12px 20px; text-align: center; color: #555555; }
.document-table td:first-child { text-align: left; }

/* 斑馬線效果 (可選，但強烈建議) */
.document-table tbody tr:nth-child(even) { background-color: #fafafa; }
.document-table tbody tr:hover { background-color: #e6f7ff; transition: background-color 0.3s ease; }
.document-table .btn { 
  width: 30px; 
  height: 30px; 
  margin: 0px; 
  padding: 2px; 
  border: none; 
  border-radius: 5px; 
  cursor: pointer; 
  background-color: transparent; /* 讓按鈕背景透明化，更融入表格 */
  transition: background-color 0.2s;
}
.document-table .btn:hover {background-color: rgba(0, 0, 0, 0.05); }
.document-table .icon { width: 100%; height: 100%; background-color: none; }

</style>