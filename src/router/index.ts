import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { public: true, layout: 'blank' },
    },
    {
      path: '/setup-password',
      name: 'setup-password',
      component: () => import('@/views/auth/SetupPasswordView.vue'),
      meta: { public: true, layout: 'blank' },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'agencias',
          name: 'agencies',
          component: () => import('@/views/agencies/AgenciesView.vue'),
        },
        {
          path: 'agencias/:idOrSlug',
          name: 'agency',
          component: () => import('@/views/agencies/AgencyDetailView.vue'),
        },
        {
          path: 'pessoas',
          name: 'people',
          component: () => import('@/views/people/PeopleView.vue'),
        },
        {
          path: 'pessoas/:id',
          name: 'profile',
          component: () => import('@/views/people/ProfileDetailView.vue'),
        },
        {
          path: 'estrutura',
          name: 'structure',
          component: () => import('@/views/structure/StructureView.vue'),
        },
        {
          path: 'conquistas',
          name: 'achievements',
          component: () => import('@/views/achievements/AchievementsView.vue'),
        },
        {
          path: 'pdi',
          name: 'pdi',
          component: () => import('@/views/pdi/PdiView.vue'),
        },
        {
          path: 'biblioteca',
          name: 'library',
          component: () => import('@/views/library/LibraryView.vue'),
        },
        {
          path: 'biblioteca/:id',
          name: 'book',
          component: () => import('@/views/library/BookDetailView.vue'),
        },
        {
          path: 'admin',
          name: 'admin',
          component: () => import('@/views/admin/AdminView.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'sem-permissao',
          name: 'forbidden',
          component: () => import('@/views/ForbiddenView.vue'),
        },
        // Catch-all DENTRO do layout — 404 mantém sidebar/header quando autenticado.
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: () => import('@/views/NotFoundView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.loading) {
    await auth.initialize()
  }

  // Não autenticado tentando rota privada → login
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Já logado tentando ir pro login → dashboard
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  // Rota só de admin → garante que o profile está carregado e checa papel.
  // Como fetchProfile roda em background no boot, pode ainda não ter chegado
  // quando o usuário navega rapidamente para /admin.
  if (to.meta.adminOnly) {
    await auth.ensureProfileLoaded()
    if (!auth.isAdmin) return { name: 'forbidden' }
  }
})

export default router
