import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // ⬅️ 新增：導入 router 實例

// 補丁：讓舊版瀏覽器也認得 findLast 語法
if (!Array.prototype.findLast) {
  Array.prototype.findLast = function(predicate, thisArg) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate.call(thisArg, this[i], i, this)) {
        return this[i];
      }
    }
    return undefined;
  };
}

// 同理，通常舊版瀏覽器也會缺 findLastIndex，順手一起補上比較保險
if (!Array.prototype.findLastIndex) {
  Array.prototype.findLastIndex = function(predicate, thisArg) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate.call(thisArg, this[i], i, this)) {
        return i;
      }
    }
    return -1;
  };
}

const app = createApp(App)

app.use(router) // ⬅️ 新增：將 router 註冊到 Vue 應用程式

app.mount('#app')

