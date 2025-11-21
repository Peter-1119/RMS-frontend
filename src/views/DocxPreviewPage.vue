<template>
  <div class="docx-preview-page" @contextmenu.prevent>
    <!-- <header class="preview-header">
      <h2>文件預覽</h2>
      <div class="actions">
        <button class="btn" @click="downloadDocx" :disabled="loading || !docxBlob">{{ loading ? '處理中…' : '下載 Word 檔' }}</button>
        <button class="btn" @click="closeWindow">關閉視窗</button>
      </div>
    </header> -->

    <main class="preview-main">
      <div v-if="loading" class="status">載入中…</div>
      <div v-else-if="errorMsg" class="status error">{{ errorMsg }}</div>
      <WordPreview v-else-if="docxUrl" :file-url="docxUrl" :disableCopy="true"/>
      <div v-else class="status">尚未載入文件。</div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import WordPreview from '@/components/WordPreview.vue'

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || ''

const route = useRoute()
const loading = ref(false)
const errorMsg = ref('')
const docxUrl = ref('')
const docxBlob = ref(null)
let lastUrl = null

async function fetchDocx() {
  const token = route.params.token
  if (!token) {
    errorMsg.value = '缺少文件代碼'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const url = `${API_BASE_URL}/docs/view/${encodeURIComponent(token)}/docx`
    const res = await axios.get(url, { responseType: 'blob' })

    if (lastUrl) {
      URL.revokeObjectURL(lastUrl)
      lastUrl = null
    }
    docxBlob.value = res.data
    const blobUrl = URL.createObjectURL(res.data)
    docxUrl.value = blobUrl
    lastUrl = blobUrl
  } catch (e) {
    console.error(e)
    errorMsg.value = e?.message || '載入文件失敗'
  } finally {
    loading.value = false
  }
}

function downloadDocx() {
  if (!docxBlob.value) return
  const a = document.createElement('a')
  const url = URL.createObjectURL(docxBlob.value)
  a.href = url
  a.download = 'document.docx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function closeWindow() {
  window.close()
}

onMounted(() => {
  fetchDocx()
})

onBeforeUnmount(() => {
  if (lastUrl) URL.revokeObjectURL(lastUrl)
})
</script>

<style scoped>
.docx-preview-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
  user-select: none;         /* 盡量禁止選取 */
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #111827;
  color: #f9fafb;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  background: #374151;
  color: #f9fafb;
  cursor: pointer;
  font-size: 14px;
}
.btn:hover:not(:disabled) {
  background: #4b5563;
}
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.preview-main { height: 100%; flex: 1; padding: 12px; }

.status {
  padding: 20px;
  text-align: center;
  color: #4b5563;
}
.status.error {
  color: #b91c1c;
}
</style>
