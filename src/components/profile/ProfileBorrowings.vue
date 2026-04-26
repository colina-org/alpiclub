<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  useBorrowingsByProfile,
  useReturnBook,
  useLeaveQueue,
} from '@/composables/useBookBorrowings'
import { useUiStore } from '@/stores/ui'
import { timeAgo } from '@/lib/format'

const props = defineProps<{
  profileId: string
  isOwn: boolean
}>()

const ui = useUiStore()
const borrowingsQuery = useBorrowingsByProfile(() => props.profileId)
const returnBook = useReturnBook()
const leaveQueue = useLeaveQueue()

const activeBorrowings = computed(
  () => (borrowingsQuery.data.value ?? []).filter((b) => b.status === 'borrowed'),
)
const queuedBorrowings = computed(
  () => (borrowingsQuery.data.value ?? []).filter((b) => b.status === 'queued'),
)

async function handleReturn(id: string, bookId: string) {
  try {
    await returnBook.mutateAsync({ id, bookId, profileId: props.profileId })
    ui.pushToast('Devolução registrada.', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao devolver.', 'error')
  }
}

async function handleLeaveQueue(id: string, bookId: string) {
  if (!confirm('Sair da fila deste livro?')) return
  try {
    await leaveQueue.mutateAsync({ id, bookId, profileId: props.profileId })
    ui.pushToast('Você saiu da fila.', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao sair.', 'error')
  }
}
</script>

<template>
  <section class="card p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold">📚 Bibliotech</h2>
        <p class="mt-0.5 text-xs text-muted">
          Livros que está com {{ isOwn ? 'você' : 'a pessoa' }} ou esperando.
        </p>
      </div>
      <RouterLink
        :to="{ name: 'library' }"
        class="text-xs font-medium text-brand-700 hover:text-brand-800"
      >
        Ir para a biblioteca →
      </RouterLink>
    </div>

    <div v-if="borrowingsQuery.isLoading.value" class="text-sm text-muted text-center py-6">
      Carregando...
    </div>

    <template v-else>
      <!-- Está com -->
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand-600 text-white">
            Com {{ isOwn ? 'você' : 'a pessoa' }}
          </span>
          <span class="text-xs text-muted">{{ activeBorrowings.length }}</span>
          <span class="flex-1 h-px bg-line"></span>
        </div>

        <p
          v-if="activeBorrowings.length === 0"
          class="text-xs text-muted italic"
        >
          Nenhum livro emprestado no momento.
        </p>

        <ul v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <li v-for="b in activeBorrowings" :key="b.id">
            <div
              class="flex items-center gap-3 p-2.5 border border-line rounded-xl hover:border-brand-300 transition-all"
            >
              <RouterLink
                v-if="b.book"
                :to="{ name: 'book', params: { id: b.book.id } }"
                class="h-14 w-10 rounded-md overflow-hidden bg-surface flex-shrink-0"
              >
                <img
                  v-if="b.book.cover_url"
                  :src="b.book.cover_url"
                  :alt="b.book.title"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-[9px] text-muted bg-gradient-to-br from-brand-50 to-surface"
                >
                  Sem capa
                </div>
              </RouterLink>
              <div class="min-w-0 flex-1">
                <RouterLink
                  v-if="b.book"
                  :to="{ name: 'book', params: { id: b.book.id } }"
                  class="text-xs font-semibold truncate block hover:text-brand-700"
                >
                  {{ b.book.title }}
                </RouterLink>
                <p v-if="b.book" class="text-[11px] text-muted truncate">{{ b.book.author }}</p>
                <p class="text-[11px] text-muted mt-0.5">
                  desde {{ timeAgo(b.borrowed_at) }}
                </p>
              </div>
              <button
                v-if="isOwn && b.book"
                class="btn-ghost text-xs flex-shrink-0"
                @click="handleReturn(b.id, b.book.id)"
              >
                Devolver
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Na fila -->
      <div v-if="queuedBorrowings.length > 0" class="space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
            Na fila
          </span>
          <span class="text-xs text-muted">{{ queuedBorrowings.length }}</span>
          <span class="flex-1 h-px bg-line"></span>
        </div>

        <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <li v-for="b in queuedBorrowings" :key="b.id">
            <div
              class="flex items-center gap-3 p-2.5 border border-line rounded-xl hover:border-amber-300 transition-all"
            >
              <RouterLink
                v-if="b.book"
                :to="{ name: 'book', params: { id: b.book.id } }"
                class="h-14 w-10 rounded-md overflow-hidden bg-surface flex-shrink-0"
              >
                <img
                  v-if="b.book.cover_url"
                  :src="b.book.cover_url"
                  :alt="b.book.title"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-[9px] text-muted bg-gradient-to-br from-brand-50 to-surface"
                >
                  Sem capa
                </div>
              </RouterLink>
              <div class="min-w-0 flex-1">
                <RouterLink
                  v-if="b.book"
                  :to="{ name: 'book', params: { id: b.book.id } }"
                  class="text-xs font-semibold truncate block hover:text-brand-700"
                >
                  {{ b.book.title }}
                </RouterLink>
                <p v-if="b.book" class="text-[11px] text-muted truncate">{{ b.book.author }}</p>
                <p class="text-[11px] text-muted mt-0.5">
                  na fila desde {{ timeAgo(b.created_at) }}
                </p>
              </div>
              <button
                v-if="isOwn && b.book"
                class="btn-ghost text-xs flex-shrink-0"
                @click="handleLeaveQueue(b.id, b.book.id)"
              >
                Sair
              </button>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
