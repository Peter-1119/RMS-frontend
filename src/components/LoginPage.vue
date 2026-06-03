<template>
  <div class="login-container">
    <div class="login-form">
      <h2>您好 歡迎使用RMS系統</h2>
      <form @submit.prevent="handleSubmit">
        <div class="login-form-group">
          <label for="username">使用者</label>
          <input type="text" id="username" v-model="username" placeholder="請輸入工號" required/>
        </div>
        <div class="login-form-group">
          <label for="password">密碼</label>
          <input type="password" id="password" v-model="password" placeholder="請輸入密碼" required/>
        </div>
        <button type="submit">登入</button>
        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      </form>
    </div>
  </div>
</template>

<script>

import axios from "axios";

export default {
  name: "LoginPage",
  data() {
    return {
      username: "",
      password: "",
      errorMessage: "",
    }
  },
  methods: {
    async handleSubmit() {
      const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
      try{
        // const response = await axios.post(API_BASE_URL + "/api/loginTest", {empNo: this.username, empPw: this.password});
        const response = await axios.post(API_BASE_URL + "/api/login", {empNo: this.username, empPw: this.password});

        if (response.data.success) {
          this.errorMessage = "";
          this.$router.push({path: '/home'});

          const userNo = response.data.data.empNo.toString();
          const userNameFromBackend = response.data.data.empName;
          const userDeptNameFromBackend = response.data.data.deptName;
          const userDeptDescFromBackend = response.data.data.deptDesc;
          const userToken = response.data.data.token;

          sessionStorage.setItem('loggedInUserNo', userNo);
          sessionStorage.setItem('loggedInUserName', userNameFromBackend);
          sessionStorage.setItem('loggedInUserdeptName', userDeptNameFromBackend);
          sessionStorage.setItem('loggedInUserdeptDesc', userDeptDescFromBackend);
          sessionStorage.setItem('userToken', userToken);
        }
        else if (response.status == 401){
          alert(`${response.data}`);
        }
      }
      catch(error) {
        console.error('登入請求失敗:', error);

        if (error.response) {
          // 伺服器有響應，但狀態碼不在 2xx 範圍內 (例如 401, 403, 404, 500)
          if (error.response.status === 401) {
            // alert('用戶名或密碼不正確，請重試。');
            alert(`${error.response.data.message}`);
          }
          else if (error.response.status === 404) {
            // alert('登入服務器路徑錯誤或服務未啟動，請聯繫管理員。');
            alert(`${error.response.data.message}`);
          }
          else {
            // 其他伺服器錯誤
            alert(`登入失敗，伺服器錯誤：${error.response.status} - ${error.response.statusText}`);
          }
          console.log('伺服器響應數據:', error.response.data);
          console.log('伺服器響應狀態:', error.response.status);
          console.log('伺服器響應頭:', error.response.headers);
        }
        else if (error.request) {
          alert('無法連接到服務器，請檢查您的網路連接。');
          console.log('請求對象:', error.request);
        }
        else {
          alert('發生未知錯誤，請重試。');
          console.log('錯誤訊息:', error.message);
        }
      }
    }
  }
}

</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f4f4f4;
}

.login-form {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  width: 300px;
}

h2 {
  text-align: center;
  margin-bottom: 1rem;
}

.login-form-group {
  display: flex;
  margin-bottom: 1rem;
  padding: 10px 10px;
  align-items: center;
}

.login-form-group label {
  width: 40%;
}

.login-form-group input {
  width: 100%;
  border-radius: 4px;
  border: 1px solid #ccc;
  padding: 10px 10px;
}

button {
  width: 100%;
  padding: 0.8rem;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 1rem;
}

button:hover {
  background-color: #367d56;
}

.error-message {
  color: red;
  font-size: 0.9rem;
  margin-top: 1rem;
  text-align: center;
}
</style>
