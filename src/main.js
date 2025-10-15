import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // ⬅️ 新增：導入 router 實例

const app = createApp(App)

app.use(router) // ⬅️ 新增：將 router 註冊到 Vue 應用程式

app.mount('#app')

