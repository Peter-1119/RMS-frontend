<!-- DocxPreviewPage.vue -->
<template>
  <div class="docx-preview-page" @contextmenu.prevent>
    <main class="preview-main">
      <div v-if="loading" class="status">載入中…</div>
      <div v-else-if="errorMsg" class="status error">{{ errorMsg }}</div>
      <WordPreview v-else-if="docxUrl" :file-url="docxUrl" :disableCopy="true" />
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
  const mode  = route.query.mode || 'view'
  const rmsId = route.query.rms_id || ''

  if (!token) {
    errorMsg.value = '缺少文件代碼'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    let url
    if (mode === 'snapshot') {
      // ★ 預覽指定 snapshot
      const q = rmsId ? `?rms_id=${encodeURIComponent(rmsId)}` : ''
      url = `${API_BASE_URL}/docs/preview/${encodeURIComponent(token)}${q}`
    } else {
      // 舊的 view：用當前主表狀態產 docx
      url = `${API_BASE_URL}/docs/view/${encodeURIComponent(token)}/docx`
    }

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
  user-select: none;
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
