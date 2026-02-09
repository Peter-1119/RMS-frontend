<template>
  <div class="eip-overlay">
    <div class="eip-dialog">
      <div class="eip-header">
        <h3>電子簽核表單 (模擬預覽)</h3>
        <button class="close-btn" @click="$emit('cancel')">×</button>
      </div>
      
      <div class="eip-content">
        <table class="eip-table">
          <tbody>
            <tr>
              <th class="yellow-bg">文件編號</th>
              <td>{{ formData.documentID || '系統自動產生' }}</td>
            </tr>
            <tr>
              <th>文件生效日</th>
              <td>{{ todayStr }} (立即生效)</td>
            </tr>
            <tr>
              <th>文件過期日</th>
              <td>永不過期</td>
            </tr>
            <tr>
              <th>允許共同編輯</th>
              <td>是</td>
            </tr>
            <tr>
              <th>機密</th>
              <td>一般</td>
            </tr>
            <tr>
              <th class="yellow-bg">建立日</th>
              <td>{{ nowTimeStr }}</td>
            </tr>
            <tr>
              <th>文件類別</th>
              <td>{{ formData.documentType === 1 ? '規範文件' : '指導文件' }}</td>
            </tr>
            <tr>
              <th class="yellow-bg">發佈/變更原因</th>
              <td>{{ formData.reviseReason || '(無)' }}</td>
            </tr>
            <tr>
              <th class="yellow-bg">發佈/變更通知</th>
              <td>
                 <label><input type="checkbox" checked disabled> 發行單位</label>
                 <label><input type="checkbox" checked disabled> 保管者</label>
                 <label><input type="checkbox" checked disabled> 權責部門</label>
                 <label><input type="checkbox" checked disabled> 適用部門</label>
              </td>
            </tr>
            <tr>
              <th>文件版本</th>
              <td>{{ Number(formData.documentVersion).toFixed(1) }}</td>
            </tr>
            
            <tr class="section-row">
              <td colspan="2">
                <div class="grid-box">
                  <div class="box-item">
                    <div class="box-label yellow-bg">發行單位</div>
                    <div class="box-val">{{ formData.department }}</div>
                  </div>
                  <div class="box-item">
                    <div class="box-label yellow-bg">保管者</div>
                    <div class="box-val">{{ formData.author }} ({{ formData.author_id }})</div>
                  </div>
                </div>
              </td>
            </tr>
            <tr class="section-row">
              <td colspan="2">
                <div class="grid-box">
                  <div class="box-item">
                    <div class="box-label yellow-bg">權責部門</div>
                    <div class="box-val">{{ formData.department }}</div>
                  </div>
                  <div class="box-item">
                    <div class="box-label yellow-bg">適用部門</div>
                    <div class="box-val">{{ formData.attribute.scopeUnits || '依機台自動帶入' }}</div>
                  </div>
                </div>
              </td>
            </tr>
            
            <tr>
              <th>文件審核者</th>
              <td>
                <div class="sign-flow">
                  <span class="sign-step">申請人: {{ formData.author }}</span> → 
                  <span class="sign-step">確認者: {{ formData.confirmer }}</span> → 
                  <span class="sign-step">承認者: {{ formData.approver }}</span>
                </div>
              </td>
            </tr>

          </tbody>
        </table>
      </div>

      <div class="eip-footer">
        <button class="btn confirm" @click="$emit('confirm')">確認送出 (轉拋 EIP)</button>
        <button class="btn cancel" @click="$emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  formData: { type: Object, default: () => ({}) }
})

const todayStr = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
})

const nowTimeStr = computed(() => {
  const d = new Date()
  return `${todayStr.value} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
})
</script>

<style scoped>
.eip-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.6); /* 半透明黑色背景 */
  display: flex; justify-content: center; align-items: center;
  z-index: 9999;
}
.eip-dialog {
  background: #fff; width: 800px; max-height: 90vh;
  border-radius: 8px; display: flex; flex-direction: column;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.eip-header {
  padding: 15px 20px; border-bottom: 1px solid #ddd;
  display: flex; justify-content: space-between; align-items: center;
  background-color: #f5f5f5; border-radius: 8px 8px 0 0;
}
.eip-header h3 { margin: 0; color: #333; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }

.eip-content { padding: 20px; overflow-y: auto; }

.eip-table {
  width: 100%; border-collapse: collapse; border: 1px solid #81d4fa; /* 淺藍邊框 */
}
.eip-table th, .eip-table td {
  border: 1px solid #81d4fa; padding: 8px 12px; font-size: 14px;
}
.eip-table th {
  background-color: #e1f5fe; /* 淺藍底色 */
  text-align: right; width: 180px; color: #0277bd;
}
.eip-table th.yellow-bg {
  background-color: #fff176; /* 黃色底色 - 必填/重點 */
  color: #333;
}
.eip-table td { background-color: #fff; }

/* Grid 區塊樣式 (仿照下半部左右分割) */
.section-row td { padding: 0; border: none; }
.grid-box { display: flex; width: 100%; border-bottom: 1px solid #81d4fa; }
.box-item { flex: 1; display: flex; border-right: 1px solid #81d4fa; }
.box-item:last-child { border-right: none; }
.box-label {
  width: 120px; padding: 8px; display: flex; align-items: center; justify-content: center;
  border-right: 1px solid #81d4fa; font-weight: bold;
}
.box-val { padding: 8px; flex: 1; display: flex; align-items: center; }

.eip-footer {
  padding: 15px 20px; border-top: 1px solid #ddd;
  display: flex; justify-content: flex-end; gap: 10px;
}
.btn { padding: 8px 20px; border-radius: 4px; border: none; cursor: pointer; font-size: 14px; }
.btn.confirm { background-color: #1976d2; color: #fff; }
.btn.confirm:hover { background-color: #1565c0; }
.btn.cancel { background-color: #e0e0e0; color: #333; }
.btn.cancel:hover { background-color: #d5d5d5; }
</style>