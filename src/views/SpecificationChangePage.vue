<template>
  <div class="new-instruction-container">
    <div class="header">
      <h1>製造式樣書變版</h1>
      <div class="right">
        <input v-model="keyword" type="text" placeholder="搜尋名稱/編號" class="search-input" @input="onKeywordInput"/>
      </div>
    </div>

    <div class="form-section">
      <table class="speicifcation-change-documents-table">
        <thead class="TABLE-HEADER">
          <tr>
            <th>編輯</th>
            <th>編號</th>
            <th>文件名稱</th>
            <th>版本</th>
            <th>作者</th>
            <th>更新日期</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(item, index) in searchData" :key="item.documentToken || index">
            <td>
              <button class="btn doc" @click="performSearch(item)">
                <img src="@/assets/document-show-icon.png" alt="顯示文件" class="icon doc" />
              </button>
            </td>
            <td>{{ item.documentId }}</td>
            <td>{{ item.documentName }}</td>
            <td>{{ item.documentVersion }}</td>
            <td>{{ item.author }}</td>
            <td>{{ item.issueDate }}</td>
          </tr>

          <tr v-if="!loading && searchData.length === 0">
            <td colspan="6" style="text-align:center; padding:20px;">沒有資料可顯示。</td>
          </tr>
          <tr v-if="loading">
            <td colspan="6" style="text-align:center; padding:20px;">讀取中…</td>
          </tr>
        </tbody>
      </table>

      <div class="pager">
        <button :disabled="page===1 || loading" @click="changePage(page-1)">上一頁</button>
        <span class="page-info">{{ page }} / {{ total }}</span>
        <button :disabled="page===total || loading" @click="changePage(page+1)">下一頁</button>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { createRevision } from '@/services/docs'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL

export default {
  name: 'SpecificationChangePage',
  data() {
    return {
      searchData: [],
      loading: false,
      errorMsg: '',
      page: 1,
      pageSize: 20,
      total: 0,
      keyword: '',
    }
  },
  computed: {
    effectiveUserId() {
      return sessionStorage.getItem('loggedInUserNo') || ''
    },
  },
  methods: {
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
    async getPagesAndLoad() {
      const {status, data} = await axios.get(`${API_BASE_URL}/docs/passed`, {
        params: { userId: this.effectiveUserId, documentType: 1, keyword: this.keyword, pageSize: this.pageSize, getPages: true }
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
        const { status, data } = await axios.get(`${API_BASE_URL}/docs/passed`, {
          params: { userId: this.effectiveUserId, documentType: 1, keyword: this.keyword, page: this.page, pageSize: this.pageSize }
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
    changePage(p) {
      if (p < 1 || p > this.totalPages) return
      this.page = p
      this.load()
    },
    // open detail/draft editor route based on type
    async performSearch(item) {
      if (!item) return

      try {
        this.loading = true
        // 1) 建立新一版
        const res = await createRevision(item.documentToken)
        if (!res?.success || !res.token) {
          alert(res?.message || '建立變版草稿失敗')
          return
        }

        const newToken = res.token
        const routeName = item.documentType === 1 ? 'new-specification' : 'new-instruction'

        // 2) 導到新的草稿 token
        this.$router.push({
          name: routeName,
          query: { token: newToken, mode: 'revision' },
        })
      } catch (e) {
        console.error(e)
        alert('建立變版草稿失敗')
      } finally {
        this.loading = false
      }
    },
    // debounce keyword input
    onKeywordInput() {
      clearTimeout(this.__kwTimer)
      this.__kwTimer = setTimeout(() => {
        this.page = 1
        this.load()
      }, 300)
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
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}
.header { display:flex; align-items:center; justify-content:space-between; margin-bottom: 20px; }
.header h1 { margin:0; font-size:28px; color:#333; }
.right { display:flex; gap:10px; align-items:center; }
.search-input { border:1px solid #ccc; border-radius:6px; padding:8px 10px; width:240px; }
.back-btn { background:#6c757d; color:#fff; border:none; padding:10px 14px; border-radius:6px; cursor:pointer; display:flex; align-items:center; }
.back-btn .icon { width:18px; height:18px; margin-right:8px; filter: invert(100%); }

.pager { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
.page-info { min-width: 60px; text-align:center; }

.speicifcation-change-documents-table { 
  border-collapse: collapse;
  width: 100%;
  border: none;

  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.speicifcation-change-documents-table th { 
  border: 1px solid #e0e0e0; 
  padding: 12px 20px; 
  text-align: center; 
  
  background-color: #f0f2f5;
  color: #333333;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.speicifcation-change-documents-table td { border: 1px solid #e0e0e0; padding: 12px 20px; text-align: center; color: #555555; }
.speicifcation-change-documents-table td:nth-child(3) { text-align: left; }

/* 斑馬線效果 (可選，但強烈建議) */
.speicifcation-change-documents-table tbody tr:nth-child(even) { background-color: #fafafa; }
.speicifcation-change-documents-table tbody tr:hover { background-color: #e6f7ff; transition: background-color 0.3s ease; }
.speicifcation-change-documents-table .btn { 
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
.speicifcation-change-documents-table .btn:hover {background-color: rgba(0, 0, 0, 0.05); }
.speicifcation-change-documents-table .icon { width: 100%; height: 100%; background-color: none; }
</style>
