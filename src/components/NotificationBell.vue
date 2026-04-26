<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { onClickOutside } from '@vueuse/core'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/composables/useNotifications'
import { NOTIFICATION_ICON, type Notification } from '@/types/database'
import { timeAgo } from '@/lib/format'

const router = useRouter()
const notifsQuery = useNotifications()
const markRead = useMarkNotificationRead()
const markAllRead = useMarkAllNotificationsRead()

const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
onClickOutside(dropdownRef, () => (open.value = false))

const unreadCount = computed(
  () => (notifsQuery.data.value ?? []).filter((n) => !n.read_at).length,
)

async function handleClick(n: Notification) {
  if (!n.read_at) {
    try {
      await markRead.mutateAsync(n.id)
    } catch {
      /* silencioso */
    }
  }
  open.value = false
  if (n.link) router.push(n.link)
}

async function handleMarkAll() {
  try {
    await markAllRead.mutateAsync()
  } catch {
    /* silencioso */
  }
}
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      type="button"
      class="relative h-9 w-9 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
      aria-label="Notificações"
      @click="open = !open"
    >
      <!-- Bell icon -->
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
      </svg>
      <span
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        v-if="open"
        class="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-panel border border-line rounded-2xl shadow-panel overflow-hidden z-50"
      >
        <header class="flex items-center justify-between px-4 py-3 border-b border-line">
          <p class="text-sm font-semibold">Notificações</p>
          <button
            v-if="unreadCount > 0"
            class="text-xs text-brand-700 hover:text-brand-800 font-medium"
            @click="handleMarkAll"
          >
            Marcar todas como lidas
          </button>
        </header>

        <div class="max-h-96 overflow-y-auto">
          <div v-if="notifsQuery.isLoading.value" class="p-6 text-center text-sm text-muted">
            Carregando...
          </div>

          <div
            v-else-if="(notifsQuery.data.value?.length ?? 0) === 0"
            class="p-8 text-center text-sm text-muted"
          >
            Nenhuma notificação por aqui.
          </div>

          <ul v-else class="divide-y divide-line">
            <li
              v-for="n in notifsQuery.data.value"
              :key="n.id"
              class="p-3 hover:bg-surface cursor-pointer transition-colors"
              :class="{ 'bg-brand-50/40': !n.read_at }"
              @click="handleClick(n)"
            >
              <div class="flex items-start gap-3">
                <div
                  class="h-8 w-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-base flex-shrink-0"
                >
                  {{ NOTIFICATION_ICON[n.type] }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-sm font-semibold truncate">{{ n.title }}</p>
                    <span
                      v-if="!n.read_at"
                      class="h-1.5 w-1.5 rounded-full bg-brand-600 flex-shrink-0"
                    ></span>
                  </div>
                  <p v-if="n.message" class="text-xs text-muted mt-0.5 line-clamp-2">
                    {{ n.message }}
                  </p>
                  <p class="text-[11px] text-muted mt-1">{{ timeAgo(n.created_at) }}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </div>
</template>
