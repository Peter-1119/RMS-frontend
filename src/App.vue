<template>
  <div id="app" :class="{ 'menu-collapsed': isMenuCollapsed }">
    <div class="app-wrapper">
      <SideMenu v-if="!$route.meta.hideChrome" :is-collapsed="isMenuCollapsed" :tabs="tabs" @toggle-menu="toggleMenu"/>
      <div class="page-content-container">
        <header class="top-bar" v-if="!$route.meta.hideChrome">
          <div class="top-header">
            <button class="menu-toggle-btn" @click="toggleMenu">
              <span class="bar"></span>
              <span class="bar"></span>
              <span class="bar"></span>
            </button>
            <div class="logo">參數管理系統</div>
          </div>
          <div class="top-function">
            <button class="btn home" @click="$router.push('/home')">回首頁</button>
            <button @click="handleLogout" class="btn logout" v-if="displayedUserName !== '訪客'">登出</button>
            <button @click="$router.push('/login')" class="btn logout" v-else-if="displayedUserName === '訪客' && currentPath !== '/login'">登入</button>
          </div>
        </header>

        <div class="content-container">
          <!-- ✅ 分頁列：只在非 hideChrome 的頁面顯示 -->
          <div v-if="!$route.meta.hideChrome && tabs.length" class="tab-bar">
            <div v-for="(tab, idx) in tabs" :key="tab.key" class="tab-item" :class="{ active: tab.fullPath === activeTabFullPath }" @click="activateTab(tab)">
            <!-- <div v-for="(tab, idx) in tabs" :key="tab.fullPath" class="tab-item" :class="{ active: tab.fullPath === activeTabFullPath }" @click="activateTab(tab)"> -->
              <span class="tab-title">{{ tab.title }}</span>
              <button v-if="tab.closable" class="tab-close" @click.stop="closeTab(tab, idx)">✕</button>
            </div>
          </div>

          <!-- ✅ 用 keep-alive 包 router-view，讓每個 tab 保持各自 state -->
          <router-view v-slot="{ Component, route }">
            <keep-alive :include="cachedViews">
              <component :is="Component" :key="getRouterKey(route)" v-if="route.meta.keepAlive"/>
            </keep-alive>
            <component :is="Component" :key="route.fullPath" v-if="!route.meta.keepAlive" />
          </router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SideMenu from './components/SideMenu.vue';
import { getDraftTab } from '@/composables/draftTabRegistry';

export default {
  name: 'App',
  components: { SideMenu },
  data() {
    return {
      isMenuCollapsed: false,
      displayedUserName: '訪客',
      displayedUserdeptDesc: '',
      currentPath: "/",
      // ✅ 分頁管理
      tabs: [],             // [{ fullPath, path, name, title, closable }]
      activeTabFullPath: '', // 目前啟用的 tab fullPath
      cachedViews: [] // ★ 新增：用來控制 keep-alive include 的陣列
    };
  },
  mounted() {
    this.loginPageCheck();
    this.getUserName();
    // 進站時依照當前 route 建立初始 tab（例如重新整理 /new-instruction?token=xxx）
    this.syncTabsWithRoute(this.$route);
  },
  watch: {
    '$route'(to, from) {
      this.currentPath = to.fullPath;
      this.getUserName();
      this.syncTabsWithRoute(to);
    }
  },
  methods: {
    getRouterKey(route) {
      // 如果不是這些特定頁面，就回傳正常的 fullPath
      if (route.name !== 'new-instruction' && route.name !== 'new-specification') return route.fullPath;

      const page = (route.name == "new-instruction") ? "instruction" : "specification"
      const mode = route.query.mode || 'new';
      const token = route.query.token || '';

      // console.log("getRouterKey page: ", page);
      // console.log("getRouterKey mode: ", mode);
      // console.log("getRouterKey token: ", token);

      if (mode === 'new') return `${page}_new`; 
      else if (mode === 'draft') return `${page}_${mode}_${token}`;
      else if (mode === 'revision') return `${page}_${mode}_${token}`;
      else if (mode === 'copy') return `${page}_${mode}_${token}`;
    },
    // === Layout / 登出 ==================================
    toggleMenu() {
      this.isMenuCollapsed = !this.isMenuCollapsed;
      console.log("menu collapsed: ", this.isMenuCollapsed);
    },
    handleLogout() {
      sessionStorage.removeItem('loggedInUserName');
      sessionStorage.removeItem('loggedInUserdeptDesc');
      sessionStorage.removeItem('userToken');

      localStorage.removeItem('rms:draft:new-instruction');
      localStorage.removeItem('rms:draft:new-specification'); // 假設這是式樣書的 key

      // ✅ 登出時順便清空 tabs
      this.tabs = [];
      this.activeTabFullPath = '';

      this.cachedViews = [];

      alert('您已登出！');
      this.$router.push('/login');
    },
    loginPageCheck() {
      const userName = sessionStorage.getItem('loggedInUserName');
      const deptDesc = sessionStorage.getItem('loggedInUserdeptDesc');

      console.log("userName: ", userName);
      console.log("deptDesc: ", deptDesc);

      if (this.$route.path === "/login") {
        sessionStorage.removeItem('loggedInUserName');
        sessionStorage.removeItem('loggedInUserdeptDesc');
        sessionStorage.removeItem('userToken');
      }
    },
    getUserName() {
      const userName = sessionStorage.getItem('loggedInUserName');
      const deptDesc = sessionStorage.getItem('loggedInUserdeptDesc');

      if (!userName || this.$route.path === "/login") {
        this.displayedUserName = '訪客';
        this.displayedUserdeptDesc = '';
        console.log('App.vue: sessionStorage 中無使用者名稱，顯示訪客。');
      } else {
        this.displayedUserName = userName;
        this.displayedUserdeptDesc = deptDesc;
        console.log('App.vue: 更新使用者名稱為:', userName,'更新使用者部門為:', deptDesc);
      }
    },

    // === 分頁核心邏輯 ==================================
    syncTabsWithRoute(route) {
      if (route.meta.hideChrome || !route.meta.requiresAuth || route.meta.noTab) {
        this.activeTabFullPath = '';
        return;
      }

      // ★ 補回這段：如果路由需要快取，就把它的「組件名稱」加入 VIP 名單
      if (route.meta.keepAlive && route.name) {
        if (!this.cachedViews.includes(route.name)) {
          this.cachedViews.push(route.name);
        }
      }

      // 使用剛才設計的穩定 Key
      const tabKey = this.getRouterKey(route); 
      const existTab = this.tabs.find(t => t.key === tabKey);

      if (existTab) {
        // 如果頁籤已經存在，我們只更新它的 fullPath (例如把加上 token 的新網址存起來)
        // 這樣下次點擊這個 Tab 時，就會帶上正確的 token
        existTab.fullPath = route.fullPath;
        this.activeTabFullPath = route.fullPath;
        return;
      }

      // 建立新頁籤
      let title = route.meta.title;
      if (route.name === 'new-instruction') {
        if (route.query.mode === 'draft') title = `製造條件指示書-草稿`;
        if (route.query.mode === 'revision') title = `製造條件指示書-變版`;
        if (route.query.mode === 'copy') title = `製造條件指示書-複製`; // ★ 補上指示書的複製標題
      }
      if (route.name === 'new-specification') {
        if (route.query.mode === 'draft') title = `製造式樣書-草稿`;
        if (route.query.mode === 'revision') title = `製造式樣書-變版`;
        if (route.query.mode === 'copy') title = `製造式樣書-複製`; // ★ 補上式樣書的複製標題
      }

      this.tabs.push({ key: tabKey, fullPath: route.fullPath, path: route.path, name: route.name, title: title, closable: true });
      this.activeTabFullPath = route.fullPath;
    },

    activateTab(tab) {
      if (tab.fullPath === this.$route.fullPath) return;
      this.$router.push(tab.fullPath);
    },
    closeTab(tab, index) {
      const isActive = (tab.fullPath === this.activeTabFullPath);

      const urlParams = new URLSearchParams(tab.fullPath.split('?')[1]);
      const tabMode = urlParams.get('mode') || 'new';
      const tabToken = urlParams.get('token');

      // ★ 點頁簽 ✕ 的當下就詢問是否儲存對應草稿（用 token 查 registry，精準對應到那一份文件）
      const draftEntry = tabToken ? getDraftTab(tabToken) : null;
      if (draftEntry && confirm(`關閉「${draftEntry.label}」前，是否要儲存草稿？`)) {
        draftEntry.save();
      }

      // 1. 精準刪除對應的 LocalStorage (你的這段寫得很好)
      if (tabMode !== 'new' && tabToken) localStorage.removeItem(`rms:draft:${tabToken}`);
      else if (tabMode === 'new') localStorage.removeItem('rms:draft:new-instruction');
      
      if (tab.name === 'new-specification') {
        localStorage.removeItem('rms:draft:new-specification');
      }

      // 2. 先把頁籤從視覺的 tabs 陣列中移除
      this.tabs.splice(index, 1);

      const cleanupCache = () => {
        if (tab.name) {
          const isNameStillUsed = this.tabs.some(t => t.name === tab.name);
          if (!isNameStillUsed) {
            this.cachedViews = this.cachedViews.filter(name => name !== tab.name);
          }
        }
      };

      // 4. 原本的跳轉邏輯
      if (!isActive) {
        cleanupCache();
        return; 
      }

      if (this.tabs.length === 0) {
        this.activeTabFullPath = '';
        this.$router.push('/home').then(() => { cleanupCache(); });
        return;
      }

      const newIndex = index > 0 ? index - 1 : 0;
      const newTab = this.tabs[newIndex];
      this.activeTabFullPath = newTab.fullPath;
      this.$router.push(newTab.fullPath).then(() => { cleanupCache(); });
    }
  },
};
</script>

<style scoped>

.app-wrapper { display: flex; flex-direction: row; min-height: 100vh}
.page-content-container { width: 100%; }
.top-bar { display: flex; flex-direction: row; justify-content: space-between; align-items: center; background-color: #023b64; color: white; padding: 15px; border-bottom: 1px solid #e0e0e0; }
.top-header { display: flex; flex-direction: row; }
.logo { font-size: 20px; font-weight: bold; margin: 0px 10px; }

/* 漢堡菜單按鈕樣式 */
.menu-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 25px;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  transition: transform 0.3s ease;
  margin: 0px 10px;
}
.menu-toggle-btn .bar { width: 100%; height: 3px; background-color: white; }

.content-container { padding: 10px; }
body, html { margin: 0; padding: 0; font-family: Arial, sans-serif; }
.btn { margin: 0px 4px; padding: 6px 8px; font-size: 14px }

/* ✅ tab bar */
.tab-bar { display: flex; border-bottom: 1px solid #ddd; margin-bottom: 8px; overflow-x: auto; white-space: nowrap; }
.tab-item {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  margin-right: 4px;
  border: 1px solid #ddd;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 14px;
}
.tab-item.active { background: #ffffff; border-bottom-color: #ffffff; font-weight: bold; }
.tab-title { margin-right: 6px; }
.tab-close { border: none; background: transparent; cursor: pointer; font-size: 12px; line-height: 1; }
</style>

<style>
body { font-family: "Microsoft JhengHei", "微軟正黑體", sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; margin: 0px; }
input, button, textarea, select { font-family: inherit; }
</style>