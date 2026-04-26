<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useReadsByProfile } from '@/composables/useBookReads'
import { BOOK_READ_STATUS, type BookReadStatus, type BookReadWithBook } from '@/types/database'

const props = defineProps<{ profileId: string }>()

const readsQuery = useReadsByProfile(() => props.profileId)

const grouped = computed(() => {
  const reads = readsQuery.data.value ?? []
  return {
    reading: reads.filter((r) => r.status === 'reading'),
    read: reads.filter((r) => r.status === 'read'),
    wishlist: reads.filter((r) => r.status === 'wishlist'),
  }
})

const sections: { key: BookReadStatus; emptyText: string }[] = [
  { key: 'reading', emptyText: 'Nada em leitura no momento.' },
  { key: 'read', emptyText: 'Nenhum livro marcado como lido.' },
  { key: 'wishlist', emptyText: 'A lista de desejos está vazia.' },
]

function isEmpty(group: BookReadWithBook[]) {
  return group.length === 0
}
</script>

<template>
  <section class="card p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold">Livros</h2>
        <p class="mt-0.5 text-xs text-muted">
          Leituras que fazem parte do desenvolvimento.
        </p>
      </div>
      <RouterLink
        :to="{ name: 'library' }"
        class="text-xs font-medium text-brand-700 hover:text-brand-800"
      >
        Ir para a biblioteca →
      </RouterLink>
    </div>

    <div v-if="readsQuery.isLoading.value" class="text-sm text-muted text-center py-8">
      Carregando...
    </div>

    <template v-else>
      <div v-for="section in sections" :key="section.key" class="space-y-3">
        <div class="flex items-center gap-3">
          <span
            class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
            :style="{ backgroundColor: BOOK_READ_STATUS[section.key].color }"
          >
            {{ BOOK_READ_STATUS[section.key].label }}
          </span>
          <span class="text-xs text-muted">{{ grouped[section.key].length }}</span>
          <span class="flex-1 h-px bg-line"></span>
        </div>

        <p v-if="isEmpty(grouped[section.key])" class="text-xs text-muted italic">
          {{ section.emptyText }}
        </p>

        <ul v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <li v-for="read in grouped[section.key]" :key="read.id">
            <RouterLink
              v-if="read.book"
              :to="{ name: 'book', params: { id: read.book.id } }"
              class="flex items-center gap-3 p-2.5 border border-line rounded-xl hover:border-brand-300 hover:bg-surface transition-all"
            >
              <div class="h-14 w-10 rounded-md overflow-hidden bg-surface flex-shrink-0">
                <img
                  v-if="read.book.cover_url"
                  :src="read.book.cover_url"
                  :alt="read.book.title"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center text-[9px] text-muted bg-gradient-to-br from-brand-50 to-surface text-center">
                  Sem capa
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-semibold truncate">{{ read.book.title }}</p>
                <p class="text-[11px] text-muted truncate">{{ read.book.author }}</p>
                <p v-if="read.rating" class="text-xs text-yellow-500 mt-0.5">
                  {{ '★'.repeat(read.rating) }}<span class="text-line">{{ '★'.repeat(5 - read.rating) }}</span>
                </p>
              </div>
            </RouterLink>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
