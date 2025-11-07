import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import NewInstruction from '@/views/NewInstruction.vue'; // 新增的組件
import LoginPage from '@/components/LoginPage.vue';
import SearchPage from '@/views/SearchPage.vue';
import DraftDocuments from '@/views/DraftDocuments.vue';
import SubmittedDocuments from '@/views/SubmittedDocuments.vue';
import RejectedDocuments from '@/views/RejectedDocuments.vue';
import SpecificationParamPage from '@/views/SpecificationParamPage.vue';
import NewSpecification from "@/views/NewSpecification.vue"
import ParametersSearch from '@/views/ParametersSearch.vue';
import SpecificationViewPage from '@/views/SpecificationViewPage.vue';

const routes = [
  {path: '/',                       redirect: '/login',},
  {path: '/login',                  name: 'Login',                  component: LoginPage},
  {path: '/home',                   name: 'home-alias',             component: HomeView,                    meta: { requiresAuth: true }},
  {path: '/Specification',          name: 'Specification',          component: SpecificationParamPage,      meta: { requiresAuth: true }},
  {path: '/new-instruction',        name: 'new-instruction',        component: NewInstruction,              meta: { requiresAuth: true }},
  {path: "/new-specification",      name: "new-specification",      component: NewSpecification,            meta: { requiresAyth: true }},
  {path: '/SearchPage',             name: 'SearchPage',             component: SearchPage,                  meta: { requiresAuth: true }},
  {path: '/DraftDocuments',         name: 'DraftDocuments',         component: DraftDocuments,              meta: { requiresAuth: true }},
  {path: '/SubmittedDocuments',     name: 'SubmittedDocuments',     component: SubmittedDocuments,          meta: { requiresAuth: true }},
  {path: '/RejectedDocuments',      name: 'RejectedDocuments',      component: RejectedDocuments,           meta: { requiresAuth: true }},
  {path: '/ParametersSearch',       name: 'ParametersSearch',       component: ParametersSearch,            meta: { requiresAuth: true }},
  {path: '/project-specification',  name: 'SpecificationViewPage',  component: SpecificationViewPage,       meta: { requiresAuth: true }}
];

// ---- add this small helper at the top (file scope) ----

const router = createRouter({
  // 保持使用 import.meta.env.BASE_URL
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// 假設您有一個全局物件來儲存用戶狀態
window.userGlobalData = {
  loggedInUserName: '訪客',
  loggedInUserdeptDesc:'您沒有部門',
  isAuthenticated: false // 新增一個標誌來明確表示是否已認證
};

function isReloadNavigation() {
  // Modern browsers
  const nav = performance.getEntriesByType?.('navigation')?.[0]
  return nav ? nav.type === 'reload' : performance.navigation?.type === 1
}

// *** 全局前置守衛 ***
router.beforeEach((to, from, next) => {
  // 1) auth bookkeeping
  const userName = sessionStorage.getItem('loggedInUserName')
  const deptDesc = sessionStorage.getItem('loggedInUserdeptDesc')
  if (userName) {
    window.userGlobalData.loggedInUserName = userName
    window.userGlobalData.loggedInUserdeptDesc = deptDesc
    window.userGlobalData.isAuthenticated = true
  } else {
    window.userGlobalData.loggedInUserName = '訪客'
    window.userGlobalData.loggedInUserdeptDesc = 'N/A'
    window.userGlobalData.isAuthenticated = false
  }

  // 2) auth decision
  if (to.meta.requiresAuth && !window.userGlobalData.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  // 3) token lifecycle
  // leaving new-instruction → clear
  if (from?.name === 'new-instruction' && to?.name !== 'new-instruction') {
    localStorage.removeItem('rms:draft:new-instruction')
  }

  if (from?.name === 'new-specification' && to?.name !== 'new-specification') {
    localStorage.removeItem('rms:draft:new-specification')
  }

  // entering new-instruction WITHOUT ?token
  if (to?.name === 'new-instruction' && !to.query.token) {
    if (!isReloadNavigation()) {
      // a normal click (not F5) → start fresh
      localStorage.removeItem('rms:draft:new-instruction')
      next() // let it proceed
      return
    }
    // reload → keep whatever’s in URL/localStorage
  }

  next()
})


export default router;