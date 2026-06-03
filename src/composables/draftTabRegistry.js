// src/composables/draftTabRegistry.js
//
// 草稿頁面（製造條件指示書 / 製造式樣書）以 document token 為 key，註冊各自的「儲存草稿」動作。
// 用途：App.vue 在「點頁簽 ✕ 的當下」就能用該頁簽的 token 查到對應頁面、即時詢問並儲存，
//      不必依賴 keep-alive 的 unmount（同名頁簽存在時實例不會被 evict，會導致詢問延後又一次全跳）。

const registry = new Map(); // token -> { save: () => any, label: string }

export function registerDraftTab(token, entry) {
  if (token) registry.set(token, entry);
}

export function unregisterDraftTab(token) {
  if (token) registry.delete(token);
}

export function getDraftTab(token) {
  return token ? registry.get(token) : undefined;
}
