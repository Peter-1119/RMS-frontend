import axios from 'axios'
const API = import.meta.env.VITE_APP_API_BASE_URL

export async function getEngineeringList({ keyword='', page=1, pageSize=20 }) {
  const { data } = await axios.get(`${API}/mes/engineering`, { params: { keyword, page, pageSize } })
  return data?.data || { items: [], total: 0, page, pageSize }
}

export async function getEngineeringProcesses(projectId) {
  const { data } = await axios.get(`${API}/mes/engineering/${encodeURIComponent(projectId)}/processes`)
  return data?.data || []
}

export async function getUnassignedProcesses({ projectCode, keyword='', page=1, pageSize=20 }) {
  const { data } = await axios.get(
    `${API}/mes/engineering/unassigned-processes`,
    { params: { keyword, page, pageSize } }
  )
  return data?.data || { items: [], total: 0, page, pageSize }
}

export async function addProcessesToProject({ projectCode, processIds }) {
  await axios.post(`${API}/mes/engineering/${encodeURIComponent(projectCode)}/processes`, { processIds })
}

export async function deleteProcessFromEngineering(projectId, specCode) {
  await axios.delete(`${API}/mes/engineering/${encodeURIComponent(projectId)}/processes/${encodeURIComponent(specCode)}`)
}
