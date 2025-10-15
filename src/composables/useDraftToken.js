import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useDraftToken(storageKey = 'rms:draft:new-instruction') {
  const route = useRoute()
  const router = useRouter()

  // Prefer URL ?token=..., fall back to localStorage
  const token = ref(String(route.query.token || localStorage.getItem(storageKey) || ''))

  function setToken(t, opts = {}) {
    const { persist = true, updateUrl = true } = opts
    token.value = t || ''
    if (persist) {
      if (token.value) localStorage.setItem(storageKey, token.value)
      else localStorage.removeItem(storageKey)
    }
    if (updateUrl) {
      const q = { ...route.query, ...(token.value ? { token: token.value } : {}) }
      if (!token.value) delete q.token
      router.replace({ query: q })
    }
  }

  function clearToken(opts = {}) {
    const { keepUrl = false } = opts
    token.value = ''
    localStorage.removeItem(storageKey)
    if (!keepUrl) {
      const q = { ...route.query }
      delete q.token
      router.replace({ query: q })
    }
  }

  // cross-tab sync
  window.addEventListener('storage', (e) => {
    if (e.key === storageKey) token.value = e.newValue || ''
  })

  return { token, setToken, clearToken }
}