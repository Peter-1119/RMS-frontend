// services/docs.js
import axios from 'axios'
const API = import.meta.env.VITE_APP_API_BASE_URL

export async function getSubmitted({ userId, keyword = '', page = 1, pageSize = 20, sort = 'issue_date', order = 'desc' }) {
  const { data } = await axios.get(`${API}/docs/submitted`, { params: { user_id: userId, keyword, page, page_size: pageSize, sort, order } });
  return { items: data?.items || [], total: data?.total ?? 0, page: data?.page ?? page, pageSize: data?.pageSize ?? pageSize };
}

export async function getRejected({ userId, keyword = '', page = 1, pageSize = 20, sort = 'issue_date', order = 'desc' }) {
  const { data } = await axios.get(`${API}/docs/rejected`, { params: { user_id: userId, keyword, page, page_size: pageSize, sort, order } });
  return { items: data?.items || [], total: data?.total ?? 0, page: data?.page ?? page, pageSize: data?.pageSize ?? pageSize };
}

export async function getPassed({ userId, document_type = 0, keyword = '', page = 1, pageSize = 20, sort = 'issue_date', order = 'desc' }) {
  const params = { user_id: userId, keyword, page, page_size: pageSize, sort, order };
  if (document_type) params.document_type = document_type;

  const { data } = await axios.get(`${API}/docs/passed`, { params });
  return { items: data?.items || [], total: data?.total ?? 0, page: data?.page ?? page, pageSize: data?.pageSize ?? pageSize };
}

export async function createRevision(previousToken) {
  const { data } = await axios.post(`${API}/docs/revise`, { previous_token: previousToken });
  return data;
}
