<template>
  <div id="app" :class="{ 'menu-collapsed': isMenuCollapsed }">
    <div class="app-wrapper">
      <SideMenu :is-collapsed="isMenuCollapsed" @toggle-menu="toggleMenu"/>
      <div class="page-content-container">
        <header class="top-bar">
          <div class="top-header">
            <button class="menu-toggle-btn" @click="toggleMenu">
              <span class="bar"></span>
              <span class="bar"></span>
              <span class="bar"></span>
            </button>
            <div class="logo">製造文件管理系統</div>
          </div>
          <div class="top-function">
            <button @click="handleLogout" class="logout-btn" v-if="displayedUserName !== '訪客'">登出</button>
            <button @click="handleLogout" class="logout-btn" v-else-if="displayedUserName === '訪客' && currentPath !== '/login'">登入</button>
          </div>
        </header>

        <div class="content-container">
          <router-view/>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SideMenu from './components/SideMenu.vue';

export default {
  name: 'App',
  components: {
    SideMenu,
  },
  data() {
    return {
      isMenuCollapsed: false, // 初始狀態為展開
      displayedUserName: '訪客',
      displayedUserdeptDesc: '',
      currentPath: "/"
    };
  },
  mounted() {
    this.loginPageCheck();
    this.getUserName();
  },
  watch: {
    '$route'(to, from) {
      this.currentPath = to.fullPath
      this.getUserName(); // 正確調用 methods 中的函數
    }
  },
  methods: {
    toggleMenu() {
      this.isMenuCollapsed = !this.isMenuCollapsed;
      console.log("meanu collapsed: ", this.isMenuCollapsed);
    },
    handleLogout() {
      sessionStorage.removeItem('loggedInUserName');
      sessionStorage.removeItem('loggedInUserdeptDesc');
      sessionStorage.removeItem('userToken');
      // localStorage.removeItem('loggedInUserName'); // 清除儲存的使用者名稱
      // localStorage.removeItem('loggedInUserdeptDesc');
      // localStorage.removeItem('userToken'); // 清除儲存的 Token

      alert('您已登出！');
      this.$router.push('/'); // 重定向到登入頁面
    },
    loginPageCheck() {
      // const userName = localStorage.getItem('loggedInUserName');
      // const deptDesc = localStorage.getItem('loggedInUserdeptDesc');

      // console.log("userName: ", userName);
      // console.log("deptDesc: ", deptDesc);

      // if (this.$route.path == "/login") {
      //   localStorage.removeItem('loggedInUserName'); // 清除儲存的使用者名稱
      //   localStorage.removeItem('loggedInUserdeptDesc');
      //   localStorage.removeItem('userToken'); // 清除儲存的 Token
      // }
      const userName = sessionStorage.getItem('loggedInUserName');
      const deptDesc = sessionStorage.getItem('loggedInUserdeptDesc');

      console.log("userName: ", userName);
      console.log("deptDesc: ", deptDesc);

      if (this.$route.path == "/login") {
        sessionStorage.removeItem('loggedInUserName');
        sessionStorage.removeItem('loggedInUserdeptDesc');
        sessionStorage.removeItem('userToken');
      }
    },
    getUserName() {
      const userName = sessionStorage.getItem('loggedInUserName');
      const deptDesc = sessionStorage.getItem('loggedInUserdeptDesc');
      
      if (!userName || this.$route.path == "/login") {
        this.displayedUserName = '訪客';
        this.displayedUserdeptDesc = '';
        console.log('App.vue: sessionStorage 中無使用者名稱，顯示訪客。');
      }
      else if (userName) {
        this.displayedUserName = userName;
        this.displayedUserdeptDesc = deptDesc;
        console.log('App.vue: 更新使用者名稱為:', userName,'更新使用者部門為:', deptDesc);
      }

      // const userName = localStorage.getItem('loggedInUserName');
      // const deptDesc = localStorage.getItem('loggedInUserdeptDesc');
      
      // if (!userName || this.$route.path == "/login") {
      //   this.displayedUserName = '訪客';
      //   this.displayedUserdeptDesc = '';
      //   console.log('App.vue: localStorage 中無使用者名稱，顯示訪客。');
      // }
      // else if (userName) {
      //   this.displayedUserName = userName;
      //   this.displayedUserdeptDesc = deptDesc;
      //   console.log('App.vue: 更新使用者名稱為:', userName,'更新使用者部門為:', deptDesc);
      // }
    }
  },
};
</script>

<style>

.app-wrapper {
  display: flex;
  flex-direction: row;
}

.page-content-container {
  width: 100%;
}

.top-bar {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: #023b64;
  color: white;
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.top-header {
  display: flex;
  flex-direction: row;
}

.logo {
  font-size: 20px;
  font-weight: bold;
  margin: 0px 10px;
}

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

.menu-toggle-btn .bar {
  width: 100%;
  height: 3px;
  background-color: white;
}

.content-container {
  padding: 10px;
}

/* 這是全局樣式，可以根據需要調整 */
body, html {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}
</style>