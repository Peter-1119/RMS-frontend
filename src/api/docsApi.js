// src/api/docsApi.js
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
const http = axios.create({ baseURL: `${API_BASE_URL}/docs` });

/** ---------- Attributes ---------- */
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

// docsApi.js
export async function clearDocId(token) {
  const { data } = await http.post(`/clear-doc-id`, { token })
  return data  // {success: true}
}
