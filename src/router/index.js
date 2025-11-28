// router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import NewInstruction from '@/views/NewInstruction.vue';
import InstructionChangePage from '@/views/InstructionChangePage.vue';
import LoginPage from '@/components/LoginPage.vue';
import SearchPage from '@/views/SearchPage.vue';
import DraftDocuments from '@/views/DraftDocuments.vue';
import SubmittedDocuments from '@/views/SubmittedDocuments.vue';
import RejectedDocuments from '@/views/RejectedDocuments.vue';
import SpecificationParamPage from '@/views/SpecificationParamPage.vue';
import NewSpecification from "@/views/NewSpecification.vue"
import SpecificationChangePage from '@/views/SpecificationChangePage.vue';
import ParametersSearch from '@/views/ParametersSearch.vue';
import SpecificationViewPage from '@/views/SpecificationViewPage.vue';
import DocxPreviewPage from '@/views/DocxPreviewPage.vue'

const routes = [
  { path: '/',                       redirect: '/login' },

  // 不進 tab、也不需要 chrome
  { path: '/login',                  name: 'Login', component: LoginPage, meta: { hideChrome: true, title: '登入' } },

  // 會出現在 tab 的頁面（有 requiresAuth）
  { path: '/home',                   name: 'home-alias',            component: HomeView,               meta: { requiresAuth: true, title: '首頁', noTab: true } },
  { path: '/Specification',          name: 'Specification',         component: SpecificationParamPage, meta: { requiresAuth: true, title: '規則一覽表' } },
  { path: '/new-instruction',        name: 'new-instruction',       component: NewInstruction,         meta: { requiresAuth: true, title: '製造條件指示書-新建' } },
  { path: '/instruction-change',     name: 'instruction-change',    component: InstructionChangePage,  meta: { requiresAuth: true, title: '製造條件指示書-變版' } },
  { path: "/new-specification",      name: "new-specification",     component: NewSpecification,       meta: { requiresAuth: true, title: '製造式樣書-新建' } },
  { path: '/specification-change',   name: 'specification-change',  component: SpecificationChangePage,meta: { requiresAuth: true, title: '製造式樣書-變版' } },
  { path: '/SearchPage',             name: 'SearchPage',            component: SearchPage,             meta: { requiresAuth: true, title: '文件檢索' } },
  { path: '/DraftDocuments',         name: 'DraftDocuments',        component: DraftDocuments,         meta: { requiresAuth: true, title: '草稿匣' } },
  { path: '/SubmittedDocuments',     name: 'SubmittedDocuments',    component: SubmittedDocuments,     meta: { requiresAuth: true, title: '已送審' } },
  { path: '/RejectedDocuments',      name: 'RejectedDocuments',     component: RejectedDocuments,      meta: { requiresAuth: true, title: '已退回' } },
  { path: '/ParametersSearch',       name: 'ParametersSearch',      component: ParametersSearch,       meta: { requiresAuth: true, title: '配方檢索' } },
  { path: '/project-specification',  name: 'SpecificationViewPage', component: SpecificationViewPage,  meta: { requiresAuth: true, title: '適用工程一覽表' } },

  // 預覽畫面：隱藏 chrome + 不放進 tab
  { path: '/docs/preview/:token',    name: 'docx-preview',          component: DocxPreviewPage,        meta: { hideChrome: true, title: '文件預覽' }, props: true },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// --- 後面你的 beforeEach 原樣貼回，只要放在這裡就好 ---
window.userGlobalData = {
  loggedInUserName: '訪客',
  loggedInUserdeptDesc:'您沒有部門',
  isAuthenticated: false
};

function isReloadNavigation() {
  const nav = performance.getEntriesByType?.('navigation')?.[0]
  return nav ? nav.type === 'reload' : performance.navigation?.type === 1
}

router.beforeEach((to, from, next) => {
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

  if (to.meta.requiresAuth && !window.userGlobalData.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  // token lifecycle 一樣保留
  if (from?.name === 'new-instruction' && to?.name !== 'new-instruction') {
    localStorage.removeItem('rms:draft:new-instruction')
  }

  if (from?.name === 'new-specification' && to?.name !== 'new-specification') {
    localStorage.removeItem('rms:draft:new-specification')
  }

  if (to?.name === 'new-instruction' && !to.query.token) {
    if (!isReloadNavigation()) {
      localStorage.removeItem('rms:draft:new-instruction')
      next()
      return
    }
  }

  next()
})

export default router;
