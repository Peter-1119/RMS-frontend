<template>
    <div v-if="displayedUserName != '訪客'" class="side-menu" :class="{ 'collapsed': isCollapsed }">
        <div class="user-info">
            <span class="username">{{ displayedUserdeptDesc }} {{displayedUserName}}</span>
        </div>
        <nav class="menu-items">
            <details v-for="item in menuItems" :key="item.id" class="menu-item-wrapper" :open="isGroupActive(item)">
                <summary class="menu-item" :class="{ active: isGroupActive(item) }">{{ item.title }}</summary>
                <router-link v-for="subItem in item.children" :key="subItem.id" class="submenu" :class="{ active: isActive(subItem.link) }" :to="subItem.link">{{ subItem.title }}</router-link>
            </details>

        </nav>
    </div>
</template>

<script>
export default {
    name: 'SideMenu',
    props: { isCollapsed: {type: Boolean, default: false} },
    data() {
        return {
            displayedUserName: '訪客',
            displayedUserdeptDesc: '',
            menuItems: [
                {id: 1, title: '製造條件指示書', children: [
                    {id: 11, title: '文件建立', link: '/new-instruction'},
                    {id: 12, title: '文件變版', link: '/instruction-change'}
                ]},
                {id: 2, title: '製造式樣書', children: [
                    {id: 21, title: '文件建立', link: '/new-specification'},
                    {id: 22, title: '文件變版', link: '/specification-change'}
                ]},
                {id: 3, title: '資料設定', children: [
                    {id: 31, title: "規則一覽表", link: "/Specification"},
                    {id: 32, title: "適用工程一覽表", link: "/project-specification"}
                ]},
                {id: 4, title: '檢索', children: [
                    {id: 41, title: "文件檢索", link: '/SearchPage'},
                    {id: 42, title: "配方檢索", link: '/ParametersSearch'}
                ]},
                {id: 5, title: '文件管理', children: [
                    {id: 51, title: "草稿匣", link: '/DraftDocuments'},
                    {id: 52, title: "文件狀態", link: '/SubmittedDocuments'},
                ]},
            ],
        };
    },
    mounted() {
        // 一進來就更新一次顯示名稱
        this.updateUserName();
    },
    watch: {
        '$route'(to, from){
            this.updateUserName();
        }
    },
    methods: {
        updateUserName() {
            const userName = sessionStorage.getItem('loggedInUserName');
            const deptDesc = sessionStorage.getItem('loggedInUserdeptDesc');
            if (userName) {
                this.displayedUserName = userName;
                this.displayedUserdeptDesc = deptDesc;
                console.log('SideMenu.vue: 更新使用者名稱為:', userName,'更新使用者部門為:', deptDesc);
            } else {
                this.displayedUserName = '訪客';
                this.displayedUserdeptDesc = '';
                console.log('SideMenu.vue: localStorage 中無使用者名稱，顯示訪客。');
            }
        },
        isActive(link) {
            // 如果你的路由都像 '/new-instruction' 這樣可以直接比對 path
            return this.$route.path === link;

            // 如果想讓像 '/new-instruction?token=xxx' 也算同一個，可以用：
            // return this.$route.path.startsWith(link);
        },
        isGroupActive(group) {
            return group.children.some(child => this.isActive(child.link));
        }
    },
};
</script>

<style scoped>
.side-menu {
    display: flex;
    flex-direction: column;
    width: 250px;
    flex-grow: 1;
    background-color: #fff;
    border-right: 1px solid #e0e0e0;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
    position: sticky;
    transition: width 0.3s ease;
}
.side-menu.collapsed { width: 0px; overflow: hidden; }

.user-info { display: flex; align-items: center; padding: 20px 20px; min-height: 100px; border-bottom: 1px solid #e0e0e0; }
.username { font-size: 1.2rem; font-weight: bold; color: #333; margin-left: 15px; white-space: nowrap; }

.menu-items { flex-grow: 1; display: flex; flex-direction: column; }
.menu-item { align-items: center; padding: 15px 20px; cursor: pointer; transition: background-color 0.2s ease;}
.menu-item.active { background-color: #f1f3f5; font-weight: bold; }

.submenu { display: block; color: #000; text-decoration: none; padding: 10px 20px 10px 40px; }
.submenu:hover { background-color: #e9ecef;}
.submenu { display: block; color: #000; text-decoration: none; padding: 10px 20px 10px 40px; }
.submenu.active { background-color: #0d6efd; color: #fff; }
</style>