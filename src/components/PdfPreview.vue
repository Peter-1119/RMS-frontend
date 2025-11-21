<template>
  <div class="pdf-preview" @contextmenu.prevent>
    <!-- 沒有 src 時 -->
    <div v-if="!src" class="pdf-empty">
      尚未產生預覽
    </div>

    <!-- 有 src -->
    <div v-else>
      <div v-if="loading" class="pdf-loading">
        PDF 載入中…
      </div>

      <div v-else class="pdf-pages">
        <div
          v-for="pageNum in pages"
          :key="pageNum"
          class="pdf-page"
        >
          <canvas :ref="el => setCanvasRef(el, pageNum)"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'

// ✅ 用 legacy build（給 bundler 用的入口）
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
// ✅ 讓 Vite 幫你處理 worker 檔的 URL
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'

// 🔑 一定要設定 workerSrc
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const props = defineProps({
  // blob URL
  src: {
    type: String,
    default: null,
  },
  scale: {
    type: Number,
    default: 1.2,
  },
})

const loading = ref(false)
const pages   = ref([])       // [1, 2, 3, ...]
const pdfDoc  = ref(null)

const canvasMap = new Map()   // pageNum -> canvas element

function setCanvasRef(el, pageNum) {
  if (el) {
    console.log('[PdfPreview] setCanvasRef page=', pageNum, 'el=', el)
    canvasMap.set(pageNum, el)
  } else {
    canvasMap.delete(pageNum)
  }
}

async function renderDocument(url) {
  if (!url) {
    pages.value = []
    pdfDoc.value = null
    canvasMap.clear()
    return
  }

  console.log('[PdfPreview] start renderDocument, url =', url)

  loading.value = true
  pages.value = []
  pdfDoc.value = null
  canvasMap.clear()

  try {
    // 1) 把 blob URL 讀成 ArrayBuffer
    const resp = await fetch(url)
    const buf  = await resp.arrayBuffer()
    const data = new Uint8Array(buf)

    // 2) 交給 pdf.js
    const loadingTask = pdfjsLib.getDocument({ data })
    const pdf = await loadingTask.promise
    pdfDoc.value = pdf

    console.log('[PdfPreview] loaded pdf, numPages =', pdf.numPages)

    const total = pdf.numPages
    pages.value = Array.from({ length: total }, (_, i) => i + 1)

    // 🔥 這裡就先關掉 loading，讓 template 出現 <canvas>
    loading.value = false

    // 等 canvas 真的掛到 DOM（v-for 渲染 + ref callback 都跑完）
    await nextTick()
    // 如果你想更穩，可以再加一個：
    // await nextTick()

    console.log(
      '[PdfPreview] start render pages, count =',
      pages.value.length,
      'canvasMap size =',
      canvasMap.size
    )

    for (const pageNum of pages.value) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: props.scale })

      const canvas = canvasMap.get(pageNum)
      if (!canvas) {
        console.warn('[PdfPreview] canvas not found for page', pageNum)
        continue
      }

      const ctx = canvas.getContext('2d')

      canvas.width  = viewport.width
      canvas.height = viewport.height

      // 先畫個淺灰底，確認真的有畫到
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      canvas.style.userSelect    = 'none'
      canvas.style.pointerEvents = 'none'

      await page.render({ canvasContext: ctx, viewport }).promise

      console.log(
        '[PdfPreview] rendered page',
        pageNum,
        'size=',
        canvas.width,
        'x',
        canvas.height
      )
    }
  } catch (err) {
    console.error('[PdfPreview] renderDocument error:', err)
  } finally {
    // 這裡就不要再動 loading 了，避免把上面設定蓋掉
    // loading.value = false
  }
}

// 🔁 src 改變時再重畫
watch(
  () => props.src,
  (newSrc, oldSrc) => {
    console.log('[PdfPreview] src changed:', newSrc)
    if (!newSrc || newSrc === oldSrc) return
    renderDocument(newSrc)
  },
)

// ✅ 掛載完，如果一開始就有 src，也畫一次
onMounted(() => {
  console.log('[PdfPreview] mounted, initial src =', props.src)
  if (props.src) {
    renderDocument(props.src)
  }
})

onBeforeUnmount(() => {
  canvasMap.clear()
})
</script>

<style scoped>
.pdf-preview {
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f8f8f8;
  user-select: none;
}

.pdf-loading {
  padding: 0.75rem;
  font-size: 0.9rem;
  color: #555;
}

.pdf-empty {
  padding: 0.75rem;
  font-size: 0.9rem;
  color: #999;
}

.pdf-pages {
  padding: 0.5rem;
}

.pdf-page {
  margin: 0 auto 1rem auto;
  background: white;
  box-shadow: 0 0 4px rgba(0,0,0,0.15);
  max-width: 100%;
}

.pdf-page canvas {
  display: block;
  width: 100%;
  height: auto;
}
</style>
