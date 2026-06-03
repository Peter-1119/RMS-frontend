// src/api/departmentApi.js
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
const http = axios.create({ baseURL: `${API_BASE_URL}/department` });

/**
 * 1. 課別樹狀結構（KJ 工程處），每節點含 processCount
 * @returns {Promise<{success:boolean, data?:{tree:Array}, error?:string}>}
 */
export async function getDepartmentTree() {
  const { data } = await http.get('/tree');
  return data; // { success, data: { tree: [...] } }
}

/**
 * 2. 課別平鋪清單（給 dropdown 用）
 * @returns {Promise<{success:boolean, data?:{items:Array}, error?:string}>}
 */
export async function getDepartments() {
  const { data } = await http.get('/');
  return data; // { success, data: { items: [...] } }
}

/**
 * 3. 某課別「已綁定」的製程
 * @param {string} deptCode 課別代碼，如 'KJ1100'
 */
export async function getDepartmentProcesses(deptCode) {
  const { data } = await http.get(`/${encodeURIComponent(deptCode)}/processes`);
  return data; // { success, data: { items: [{ processCode, processName }] } }
}

/**
 * 4. 某課別「還沒綁」的可用製程（綁定 modal 用）
 * @param {string} deptCode 課別代碼
 * @param {string} [keyword] 模糊比對 process_name（可選）
 */
export async function getUnassignedProcesses(deptCode, keyword = '') {
  const params = keyword ? { keyword } : {};
  const { data } = await http.get(`/${encodeURIComponent(deptCode)}/unassigned-processes`, { params });
  return data; // { success, data: { items: [...] } }
}

/**
 * 5. 批量綁定製程到課別（重複自動跳過）
 * @param {string} deptCode 課別代碼
 * @param {Array<{code:string, name:string}>} processes
 */
export async function bindProcesses(deptCode, processes) {
  const { data } = await http.post(`/${encodeURIComponent(deptCode)}/processes`, { processes });
  return data; // { success, data: { added } } 或 { success:false, error }
}

/**
 * 6. 解除單一綁定
 * @param {string} deptCode 課別代碼
 * @param {string} processCode 製程代碼
 */
export async function unbindProcess(deptCode, processCode) {
  const { data } = await http.delete(`/${encodeURIComponent(deptCode)}/processes/${encodeURIComponent(processCode)}`);
  return data; // { success, data: { deleted } }
}
