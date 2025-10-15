<template>
  <div class="search-block" :style="{ backgroundColor: blockColor }">
    <div class="block-header">
      <img src="@/assets/search-icon.png" alt="檢索" class="block-icon">
      <h2>檢索</h2>
    </div>
    <div class="search-input-group">
      <label for="keyword">關鍵字</label>
      <input type="text" id="keyword" v-model="keyword" placeholder="請輸入關鍵字">
      <button class="search-btn" @click="performSearch">
        <img src="@/assets/search-icon-white.png" alt="搜尋" class="search-icon">
      </button>
    </div>
    <p class="search-hint">
      查詢方式：依文件編號、文件名稱、品目、關鍵字查詢
    </p>
  </div>
</template>

<script>
export default {
  name: 'SearchBlock',
  props: {
    blockColor: {
      type: String,
      default: '#d1c4e9' // 預設背景色
    }
  },
  data() {
    return {
      keyword: ''
    };
  },
  methods: {
    performSearch() {
      console.log('執行檢索:', this.keyword);
      this.$router.push('/SearchPage')
      // 未來在這裡實作檢索邏輯，可以觸發一個事件或呼叫 API
      // this.$emit('search-performed', this.keyword);
    }
  }
}
</script>

<style scoped>
.search-block {
  flex: 1;
  border-radius: 10px;
  padding: 20px;
  margin: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.block-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.block-icon {
  width: 60px;
  height: 60px;
  margin-right: 15px;
  filter: invert(20%) sepia(100%) saturate(600%) hue-rotate(270deg) brightness(90%) contrast(90%); /* 調整圖標顏色 */
}

h2 {
  font-size: 24px;
  color: #333;
  margin: 0;
}

.search-input-group {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.search-input-group label {
  font-size: 18px;
  margin-right: 10px;
  min-width: 70px; /* 固定標籤寬度 */
}

.search-input-group input[type="text"] {
  flex-grow: 1;
  padding: 10px 15px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-size: 16px;
  outline: none;
}

.search-btn {
  background-color: #673ab7; /* 紫色 */
  border: none;
  padding: 10px 15px;
  border-radius: 5px;
  cursor: pointer;
  margin-left: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn:hover {
  background-color: #512da8;
}

.search-btn .search-icon {
  width: 20px;
  height: 20px;
  filter: invert(100%); /* 將圖標變為白色 */
}

.search-hint {
  font-size: 14px;
  color: #666;
  text-align: left;
}
</style>