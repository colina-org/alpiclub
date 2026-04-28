<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  Building2,
  Users,
  Network,
  Trophy,
  Target,
  BookOpen,
  Coins,
  Settings,
  UserCircle2,
  LogOut,
  Menu,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import AppToaster from '@/components/AppToaster.vue'
import NotificationBell from '@/components/NotificationBell.vue'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

// Mobile: ao navegar, fecha o drawer.
router.afterEach(() => ui.closeMobileMenu())

// Hamburger: no mobile abre/fecha o drawer; no desktop colapsa/expande.
function onMenuClick() {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    ui.toggleMobileMenu()
  } else {
    ui.toggleSidebar()
  }
}

const navItems = [
  { name: 'Dashboard', to: { name: 'dashboard' }, icon: LayoutDashboard },
  { name: 'Agências', to: { name: 'agencies' }, icon: Building2 },
  { name: 'Pessoas', to: { name: 'people' }, icon: Users },
  { name: 'Estrutura', to: { name: 'structure' }, icon: Network },
  { name: 'Conquistas', to: { name: 'achievements' }, icon: Trophy },
  { name: 'PDI', to: { name: 'pdi' }, icon: Target },
  { name: 'Biblioteca', to: { name: 'library' }, icon: BookOpen },
  { name: 'Alpicoins', to: { name: 'alpicoins' }, icon: Coins },
  { name: 'Administração', to: { name: 'admin' }, icon: Settings },
]

async function handleSignOut() {
  await auth.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Mobile backdrop -->
    <div
      v-if="ui.mobileMenuOpen"
      class="fixed inset-0 z-40 bg-ink/40 md:hidden"
      @click="ui.closeMobileMenu"
    ></div>

    <!-- Sidebar -->
    <!--
      Mobile: fixed drawer que entra deslizando da esquerda.
      Desktop (md+): bloco no fluxo normal, largura controlada por sidebarOpen.
    -->
    <aside
      class="bg-panel border-r border-line transition-all duration-200 fixed inset-y-0 left-0 z-50 w-64 flex flex-col md:relative md:translate-x-0 md:flex"
      :class="[
        ui.mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        ui.sidebarOpen ? 'md:w-64' : 'md:w-20',
      ]"
    >
      <div class="h-16 flex items-center px-5 border-b border-line">
        <div class="flex items-center gap-2.5">
          <div class="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
            A
          </div>
          <!-- No mobile sempre mostra texto; no desktop, depende do sidebarOpen. -->
          <span class="text-base font-semibold tracking-tight md:hidden">Alpiclub</span>
          <span v-if="ui.sidebarOpen" class="text-base font-semibold tracking-tight hidden md:inline">
            Alpiclub
          </span>
        </div>
      </div>

      <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-surface hover:text-ink transition-colors"
          active-class="!bg-brand-50 !text-brand-700"
        >
          <component :is="item.icon" class="w-5 h-5 flex-shrink-0" :stroke-width="1.75" />
          <span class="md:hidden">{{ item.name }}</span>
          <span v-if="ui.sidebarOpen" class="hidden md:inline">{{ item.name }}</span>
        </RouterLink>
      </nav>

      <div class="p-3 border-t border-line space-y-1">
        <RouterLink
          v-if="auth.user"
          :to="{ name: 'profile', params: { id: auth.user.id } }"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-surface hover:text-ink transition-colors"
          active-class="!bg-brand-50 !text-brand-700"
        >
          <UserCircle2 class="w-5 h-5 flex-shrink-0" :stroke-width="1.75" />
          <span class="md:hidden">Meu perfil</span>
          <span v-if="ui.sidebarOpen" class="hidden md:inline">Meu perfil</span>
        </RouterLink>
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-surface hover:text-ink transition-colors"
          @click="handleSignOut"
        >
          <LogOut class="w-5 h-5 flex-shrink-0" :stroke-width="1.75" />
          <span class="md:hidden">Sair</span>
          <span v-if="ui.sidebarOpen" class="hidden md:inline">Sair</span>
        </button>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 bg-panel border-b border-line flex items-center justify-between px-6">
        <div class="flex items-center gap-3">
          <button
            class="btn-ghost h-9 w-9 !p-0 rounded-lg flex items-center justify-center"
            aria-label="Alternar menu"
            @click="onMenuClick"
          >
            <Menu class="w-5 h-5" :stroke-width="2" />
          </button>
          <h1 class="text-sm font-medium text-muted">
            {{ $route.name === 'dashboard' ? 'Visão geral' : $route.name }}
          </h1>
        </div>

        <div class="flex items-center gap-2">
          <NotificationBell />
          <span class="text-sm text-muted hidden sm:block ml-1">
            {{ auth.user?.email }}
          </span>
          <div
            class="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold"
          >
            {{ (auth.user?.email ?? '?')[0]?.toUpperCase() }}
          </div>
        </div>
      </header>

      <main class="flex-1 p-6 overflow-y-auto">
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="r.fullPath" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <AppToaster />
  </div>
</template>
