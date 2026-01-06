<template>
  <div id="app" :class="{ 'menu-collapsed': isMenuCollapsed }">
    <div class="app-wrapper">
      <SideMenu v-if="!$route.meta.hideChrome" :is-collapsed="isMenuCollapsed" @toggle-menu="toggleMenu"/>
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
            <!-- 對有 tab 的頁面啟用 keep-alive，其餘照常顯示 -->
            <keep-alive>
              <component :is="Component" :key="route.fullPath" v-if="route.meta.keepAlive" />
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
      activeTabFullPath: '' // 目前啟用的 tab fullPath
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
    // === Layout / 登出 ==================================
    toggleMenu() {
      this.isMenuCollapsed = !this.isMenuCollapsed;
      console.log("menu collapsed: ", this.isMenuCollapsed);
    },
    handleLogout() {
      sessionStorage.removeItem('loggedInUserName');
      sessionStorage.removeItem('loggedInUserdeptDesc');
      sessionStorage.removeItem('userToken');

      // ✅ 登出時順便清空 tabs
      this.tabs = [];
      this.activeTabFullPath = '';

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

      const fullPath = route.fullPath;
      const key = route.name || fullPath;   // 👈 tab 的「識別 key」

      const exist = this.tabs.find(t => t.key === key);

      if (exist) {
        // 👇 同一個頁面（例如 new-instruction），只更新 fullPath（讓點 tab 時會帶上最新的 token）
        exist.fullPath = fullPath;
        this.activeTabFullPath = fullPath;
        return;
      }

      const title = route.meta.title || route.name || route.path;
      const closable = route.name !== 'home-alias';

      this.tabs.push({
        key,
        fullPath,
        path: route.path,
        name: route.name,
        title,
        closable,
      });
      this.activeTabFullPath = fullPath;
    },

    activateTab(tab) {
      if (tab.fullPath === this.$route.fullPath) return;
      this.$router.push(tab.fullPath);
    },
    closeTab(tab, index) {
      const isActive = (tab.fullPath === this.activeTabFullPath);
      this.tabs.splice(index, 1);

      if (!isActive) return; // 關閉的不是當前 tab → 不需要導航

      if (this.tabs.length === 0) {
        this.activeTabFullPath = '';
        this.$router.push('/home');
        return;
      }

      // 優先切到左邊的 tab，如果沒有就右邊
      const newIndex = index > 0 ? index - 1 : 0;
      const newTab = this.tabs[newIndex];
      this.activeTabFullPath = newTab.fullPath;
      this.$router.push(newTab.fullPath);
    }
  },
};
</script>

<style scoped>

.app-wrapper { display: flex; flex-direction: row;}
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
body { font-family: "Microsoft JhengHei", "微軟正黑體", sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
input, button, textarea, select { font-family: inherit; }
</style>