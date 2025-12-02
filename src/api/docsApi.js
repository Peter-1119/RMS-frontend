// src/api/docsApi.js
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
const http = axios.create({ baseURL: `${API_BASE_URL}/docs` });

/** ---------- Attributes ---------- */
export async function loadPersonnel(emp_id) {
    const { data } = await http.get(`/get-personnel`, { params: { emp_id } });
    return data;
}

export async function initDoc(document_type = 0) {
  const { data } = await http.post(`/init`, { document_type });
  return data; // {success, token}
}

export async function saveAttributes(token, form) {
  const { data } = await http.post(`/attributes/save`, { token, form });
  return data; // {success, token, issueTime, form}
}

export async function loadAttributes(token) {
  const { data } = await http.get(`/${encodeURIComponent(token)}/attributes`);
  return data; // {success, token, status, issueTime, form}
}

/** ---------- Generic Blocks (any step) ---------- */
// blocks payload shape: [{ tier, data:[ { option(0/1/2), jsonHeader, jsonContent, files } ] }]
export async function saveBlocks(token, step_type, blocks) {
  const { data } = await http.post(`/blocks/save`, { token, step_type, blocks });
  return data; // {success, count}
}

export async function loadBlocks(token, step_type) {
  const { data } = await http.get(`/${encodeURIComponent(token)}/blocks`, { params: { step_type } });
  return data; // {success, blocks:[{id, step, tier, data:[...]}]}
}

/** ---------- Parameters (defaults to step 5, overridable) ---------- */
// blocks shape: [{ tier_no, code, machineGroup?, machine?, table: string[][] }]
export async function saveParams(token, blocks, step_type = 2) {
  const { data } = await http.post(`/params/save`, { token, blocks, step_type });
  return data; // {success, count}
}

export async function loadParams(token, step_type = 2) {
  const { data } = await http.get(`/${encodeURIComponent(token)}/params`, { params: { step_type } });
  return data; // {success, blocks:[{id, code, machineGroup, machine, table}]}
}

/** ---------- References ---------- */
export async function saveReferences(token, { documents = [], forms = [] }) {
  const { data } = await http.post(`/references/save`, { token, documents, forms });
  return data; // {success}
}

export async function loadReferences(token) {
  const { data } = await http.get(`/${encodeURIComponent(token)}/references`);
  return data; // {success, documents, forms}
}

/** ---------- Batch draft APIs ---------- */
export async function saveDraftAll(token, { form, blockRequests = [], paramRequests = [], references = {} }) {
  const payload = { token, form, blockRequests, paramRequests, references }
  const { data } = await http.post('/draft/save-all', payload)
  return data   // { success, token, issueTime, form }
}

export async function loadDraftAll(token, { blocks = [], params = [], attrs = true, refs = true } = {}) {
  const query = {}
  if (attrs === false) query.attrs = 0
  if (refs === false) query.refs = 0
  if (blocks && blocks.length) query.blocks = blocks.join(',')
  if (params && params.length) query.params = params.join(',')

  const { data } = await http.get(`/${encodeURIComponent(token)}/draft-all`, { params: query })
  return data   // 結構見上面後端註解
}

// ⭐ 新增：抓 snapshot 的版本
export async function loadSnapshotDraftAll(
  token,
  { blocks = [], params = [], attrs = true, refs = true, rms_id = '' } = {},
) {
  const search = new URLSearchParams()
  if (!attrs) search.set('attrs', '0')
  if (!refs) search.set('refs', '0')
  if (blocks.length) search.set('blocks', blocks.join(','))
  if (params.length) search.set('params', params.join(','))
  if (rms_id) search.set('rms_id', rms_id)

  const url = `${API_BASE_URL}/docs/${token}/snapshot-draft-all?${search.toString()}`
  const { data } = await axios.get(url)
  return data
}

// 如果你原本有 loadRejectedSnapshotDraftAll，可以直接變成 wrapper：
export function loadRejectedSnapshotDraftAll(token, options = {}) {
  return loadSnapshotDraftAll(token, options)
}


// docsApi.js
export async function clearDocId(token) {
  const { data } = await http.post(`/clear-doc-id`, { token })
  return data  // {success: true}
}

/** ---------- Manufacturing Parameter Program API ---------- */
export async function allocateProgramCode(specCode, documentToken) {
  const body = { specCode, document_token: documentToken };
  const res = await http.post('/program-codes/allocate', body);
  // 後端 send_response: { success, message, data }
  if (!res.data?.success) {
    throw new Error(res.data?.message || '程式號碼配號失敗');
  }
  return res.data.data; // { specCode, programCode, prefix, serial }
}

export async function releaseProgramCode(programCode) {
  const body = { programCode };
  const res = await http.post('/program-codes/release', body);
  if (!res.data?.success) {
    throw new Error(res.data?.message || '程式號碼釋放失敗');
  }
  return res.data.data; // { programCode }
}

// 如果之後要用到「刪除草稿時釋放全部程式碼」，可以先準備好
export async function releaseProgramCodesByDocument(documentToken) {
  const body = { document_token: documentToken };
  const res = await http.post('/program-codes/release-by-document', body);
  if (!res.data?.success) {
    throw new Error(res.data?.message || '程式號碼釋放失敗');
  }
  return res.data.data; // { document_token }
}

export function copySpecParamFromCode(programCode) {
  // 對應後端新路徑
  return http.post('/parameters/copy-spec-source', { program_code: programCode })
    .then(res => res.data)
}

export function copyMcrFromCode(payload) {
  // payload = { program_code: 'RE...', base_machine_code: 'xxxx' }
  return http.post('/parameters/copy-source', payload).then(res => res.data)  // 回傳 { success, message, data }
}
