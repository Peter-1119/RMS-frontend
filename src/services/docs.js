// services/docs.js
import axios from 'axios'
const API = import.meta.env.VITE_APP_API_BASE_URL

export async function getSubmitted({
  userId, keyword = '', page = 1, pageSize = 20, sort = 'issue_date', order = 'desc'
}) {
  const { data } = await axios.get(`${API}/docs/submitted`, {
    params: { user_id: userId, keyword, page, page_size: pageSize, sort, order }
  })
  return {
    items: data?.items || [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
  }
}

export async function getRejected({
  userId, keyword = '', page = 1, pageSize = 20, sort = 'issue_date', order = 'desc'
}) {
  const { data } = await axios.get(`${API}/docs/rejected`, {
    params: { user_id: userId, keyword, page, page_size: pageSize, sort, order }
  })
  return {
    items: data?.items || [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
  }
}

/**
 * Get PASSED (status=2) documents, optionally filtered by document type.
 * @param {Object} opts
 * @param {string} opts.userId - required
 * @param {string} [opts.documentType] - 'Instruction', 'Specification', or comma-separated list
 * @param {string} [opts.keyword]
 * @param {number} [opts.page]
 * @param {number} [opts.pageSize]
 * @param {string} [opts.sort] - 'issue_date' | 'document_version' | 'document_name'
 * @param {string} [opts.order] - 'asc' | 'desc'
 */
export async function getPassed({
  userId,
  document_type = 0,       // e.g. 'Instruction', 'Specification', or 'Instruction,Specification'
  keyword = '',
  page = 1,
  pageSize = 20,
  sort = 'issue_date',
  order = 'desc',
}) {
  const params = {
    user_id: userId,
    keyword,
    page,
    page_size: pageSize,
    sort,
    order,
  }
  if (document_type) params.document_type = document_type

  const { data } = await axios.get(`${API}/docs/passed`, { params })
  return {
    items: data?.items || [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
  }
}

export async function createRevision(previousToken) {
  const { data } = await axios.post(`${API}/docs/revise`, {
    previous_token: previousToken,
  })
  return data
}


/**
 * Search across ALL authors' documents.
 * @param {Object} opts
 * @param {string} opts.status    - required, e.g. "0,1,2,3" or "2"
 * @param {string} [opts.documentType] - 'Instruction', 'Specification', or comma list
 * @param {string} [opts.keyword] - matches name/author/version/id
 * @param {number} [opts.page]
 * @param {number} [opts.pageSize]
 * @param {string} [opts.sort]  - 'issue_date' | 'document_version' | 'document_name'
 * @param {string} [opts.order] - 'asc' | 'desc'
 */
export async function getAllDocuments({
  status,                      // required, e.g. "2" or "0,1,2,3"
  keyword = '',
  page = 1,
  pageSize = 20,
  sort = 'issue_date',
  order = 'desc',
}) {
  if (!status) throw new Error('status is required')

  const params = { status, keyword, page, page_size: pageSize, sort, order }
  const { data } = await axios.get(`${API}/docs/all`, { params })
  return {
    items: data?.items || [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
  }
}

