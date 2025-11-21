<template>
  <!-- 外層容器：可以捲動，但禁止右鍵 -->
  <div
    class="word-preview-wrapper"
    ref="container"
    @contextmenu.prevent
  >
    <!-- 內層真正渲染 docx 的地方 -->
    <div ref="inner" class="word-preview-inner"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { renderAsync } from 'docx-preview'

const props = defineProps({
  fileUrl: {
    type: String,
    required: true,
  },
})

const container = ref(null)
const inner = ref(null)

async function renderDocx(url) {
  if (!url || !inner.value) return

  try {
    // 把舊內容清掉
    inner.value.innerHTML = ''

    const resp = await fetch(url)
    const blob = await resp.blob()

    // docx-preview 直接把 Word 渲染成 HTML
    await renderAsync(blob, inner.value, null, {
      className: 'docx-preview', // 會套在最外層 wrapper 上
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,         // 分頁
      useBase64URL: false,
      useMathMLPolyfill: false,
    })
  } catch (err) {
    console.error('[WordPreview] renderDocx error:', err)
  }
}

onMounted(() => {
  if (props.fileUrl) {
    renderDocx(props.fileUrl)
  }
})

watch(
  () => props.fileUrl,
  (newUrl, oldUrl) => {
    if (!newUrl || newUrl === oldUrl) return
    renderDocx(newUrl)
  },
)
</script>

<style scoped>
.word-preview-wrapper {
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  background: #f3f3f3;
  border: 1px solid #ddd;
  border-radius: 4px;

  /* 禁止選取文字 */
  user-select: none;
  -webkit-user-select: none;
}

/* 內層整個 Word 頁面區塊 */
.word-preview-inner {
  padding: 12px 8px;
}

/* 讓 docx-preview 渲染出來的內容不能被操作（點擊/拖曳）*/
.word-preview-inner * {
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  -moz-user-select: none;
}

/* 如果 docx-preview 用 wrapper class（在 options 裡設 className） */
.docx-preview {
  margin: 0 auto;
  pointer-events: none; /* 禁止點擊（避免右鍵另存圖片、超連結等）*/
}
</style>
