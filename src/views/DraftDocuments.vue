<template>
  <div class="new-instruction-container">
    <div class="header">
      <h1>草稿匣</h1>
      <button @click="$router.push('/home');" class="back-btn">
        <img src="@/assets/home-icon.png" alt="首頁" class="icon"> 回首頁
      </button>
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
              <button class="btn edit" @click="performSearch(item)">
                <img src="@/assets/edit-icon.png" alt="變更" class="icon edit">
              </button>
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
        <span>{{ page }} / {{ totalPages }}</span>
        <button :disabled="page===totalPages" @click="changePage(page+1)">下一頁</button>
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
      sort: 'issue_date',
      order: 'desc',
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
    async loadDrafts() {
      if (!this.effectiveUserId) {
        this.errorMsg = '缺少 user_id，請先登入或從 props 傳入 userId'
        this.searchData = []
        this.total = 0
        return
      }
      this.loading = true
      this.errorMsg = ''
      try {
        // console.log("API_BASE_URL: ", API_BASE_URL)
        // console.log("API_BASE_URL: ", API_BASE_URL)
        const res = await axios.get(`${API_BASE_URL}/docs/drafts`, {
          params: {
            user_id: this.effectiveUserId,
            status: 0,
            page: this.page,
            page_size: this.pageSize,
            keyword: this.keyword || undefined,
            sort: this.sort,
            order: this.order,
          },
        })
        const { success, items, total } = res.data || {}
        if (!success) throw new Error(res.data?.error || 'drafts api failed')

        this.searchData = (items || []).map(x => ({
          ...x,
          issueDate: this.formatDate(x.issueDate),
        }))
        this.total = total || 0
      } catch (e) {
        console.error(e)
        this.errorMsg = e?.message || '讀取草稿失敗'
        this.searchData = []
        this.total = 0
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
        await this.loadDrafts()
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
    this.loadDrafts()
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
.header { display: flex; justify-content: space-between; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
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

.form-section { padding: 20px 0; }

.document-table { border-collapse: collapse; border: none; width: 100%; }
.document-table th, .document-table td { border: none; padding: 10px 20px; text-align: left; }
.document-table .btn { width: 40px; height: 40px; margin: 0px; padding: 8px 8px; border: none; border-radius: 5px; cursor: pointer; }
.document-table .icon { width: 100%; height: 100%; background-color: none; }

</style>