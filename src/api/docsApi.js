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

/** ---------- Process Flow (step 0) ---------- */
// processFlow = {mode:'table'|'image', cols, header_json, items, file}
export async function saveProcessFlow(token, { tier_no = 1, sub_no = 0, processFlow }) {
  const { data } = await http.post(`/process-flow/save`, { token, tier_no, sub_no, processFlow });
  return data; // {success}
}

export async function loadProcessFlow(token) {
  const { data } = await http.get(`/${encodeURIComponent(token)}/process-flow`);
  // backend (recommended) shape: { success, processFlow: { mode, cols, header_json, items, file, tier_no, sub_no } }
  if (!data?.success) return data;

  const pf = data.processFlow || {};

  // ---- normalization, defensive against alternate shapes ----
  const norm = {
    mode: pf.mode === 'image' ? 'image' : 'table',
    cols: Number(pf.cols || 9),
    header_json: pf.header_json ?? null,
    items: Array.isArray(pf.items) ? pf.items : [],
    file: pf.file || null,
    tier_no: pf.tier_no ?? 1,
    sub_no: pf.sub_no ?? 0,
  };

  // if backend ever returned raw row fields (content_type/content_json/files), map them:
  if (!pf.mode && (pf.content_type != null)) {
    const ct = Number(pf.content_type);
    if (ct === 10) { // table
      norm.mode = 'table';
      try {
        const cj = (typeof pf.content_json === 'string') ? JSON.parse(pf.content_json || '{}') : (pf.content_json || {});
        norm.cols = Number(cj.cols || norm.cols);
        norm.items = Array.isArray(cj.items) ? cj.items : [];
      } catch (_) {}
      norm.file = null;
    } else if (ct === 11) { // image
      norm.mode = 'image';
      try {
        const cj = (typeof pf.content_json === 'string') ? JSON.parse(pf.content_json || '{}') : (pf.content_json || {});
        norm.file = cj.file || null;
      } catch (_) { norm.file = null; }
      norm.items = [];
    }
  }

  return { ...data, processFlow: norm };
}
