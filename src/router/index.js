// router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
// import NewInstruction from '@/views/NewInstruction.vue';
import NewInstruction from '@/views/NewInstruction_.vue';
import InstructionChangePage from '@/views/InstructionChangePage.vue';
import LoginPage from '@/components/LoginPage.vue';
import SearchPage from '@/views/SearchPage.vue';
import DraftDocuments from '@/views/DraftDocuments.vue';
import SubmittedDocuments from '@/views/SubmittedDocuments.vue';
import SpecificationParamPage from '@/views/SpecificationParamPage.vue';
// import NewSpecification from "@/views/NewSpecification.vue"
import NewSpecification from "@/views/NewSpecification_.vue"
import SpecificationChangePage from '@/views/SpecificationChangePage.vue';
import ParametersSearch from '@/views/ParametersSearch.vue';
import SpecificationViewPage from '@/views/SpecificationViewPage.vue';
import DocxPreviewPage from '@/views/DocxPreviewPage.vue'
import ItemViewPage from '@/views/ItemViewPage.vue'
import DepartmentProcessPage from '@/views/DepartmentProcessPage.vue'
import DevBlockTreeHarness from '@/views/DevBlockTreeHarness.vue' // TEMP — P1 harness，prod 前移除

const routes = [
  { path: '/',                       redirect: '/login' },

  // 不進 tab、也不需要 chrome
  { path: '/login',                  name: 'Login',                 component: LoginPage,               meta: { hideChrome: true, title: '登入' } },

  // 會出現在 tab 的頁面（有 requiresAuth）
  { path: '/home',                   name: 'home-alias',            component: HomeView,                meta: { requiresAuth: true, title: '首頁', noTab: true } },
  { path: '/Specification',          name: 'Specification',         component: SpecificationParamPage,  meta: { requiresAuth: true, title: '規則一覽表', keepAlive: true, } },
  { path: '/new-instruction',        name: 'new-instruction',       component: NewInstruction,          meta: { requiresAuth: true, title: '製造條件指示書-新建', keepAlive: true } },
  { path: '/instruction-change',     name: 'instruction-change',    component: InstructionChangePage,   meta: { requiresAuth: true, title: '製造條件指示書-變版' } },
  { path: "/new-specification",      name: "new-specification",     component: NewSpecification,        meta: { requiresAuth: true, title: '製造式樣書-新建', keepAlive: true } },
  { path: '/specification-change',   name: 'specification-change',  component: SpecificationChangePage, meta: { requiresAuth: true, title: '製造式樣書-變版' } },
  { path: '/SearchPage',             name: 'SearchPage',            component: SearchPage,              meta: { requiresAuth: true, title: '文件檢索' } },
  { path: '/DraftDocuments',         name: 'DraftDocuments',        component: DraftDocuments,          meta: { requiresAuth: true, title: '草稿匣', keepAlive: true } },
  { path: '/SubmittedDocuments',     name: 'SubmittedDocuments',    component: SubmittedDocuments,      meta: { requiresAuth: true, title: '文件狀態' } },
  { path: '/ParametersSearch',       name: 'ParametersSearch',      component: ParametersSearch,        meta: { requiresAuth: true, title: '配方檢索', keepAlive: true, } },
  { path: '/project-specification',  name: 'SpecificationViewPage', component: SpecificationViewPage,   meta: { requiresAuth: true, title: '適用工程一覽表', keepAlive: true, } },
  { path: '/item-view',              name: 'ItemViewPage',          component: ItemViewPage,            meta: { requiresAuth: true, title: '式樣書確認一覽表', keepAlive: true } },
  { path: '/department-process',     name: 'DepartmentProcessPage', component: DepartmentProcessPage,   meta: { requiresAuth: true, title: '課別製程管理', keepAlive: true } },

  // 預覽畫面：隱藏 chrome + 不放進 tab
  { path: '/docs/preview/:token',    name: 'docx-preview',          component: DocxPreviewPage,        meta: { hideChrome: true, title: '文件預覽' }, props: true },

  // TEMP — P1 遞迴區塊編輯器驗證用，prod 前連同 DevBlockTreeHarness.vue 一起移除
  { path: '/dev/block-tree',         name: 'dev-block-tree',        component: DevBlockTreeHarness,     meta: { hideChrome: true, title: 'P1 Harness' } },
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

  next()
})

export default router;
