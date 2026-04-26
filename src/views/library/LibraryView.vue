<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useBooks, useCreateBook } from '@/composables/useBooks'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { BookReadStatus, BookWithReads } from '@/types/database'
import { BOOK_READ_STATUS } from '@/types/database'

const auth = useAuthStore()
const ui = useUiStore()
const booksQuery = useBooks()
const createBook = useCreateBook()

type StatusFilter = 'all' | BookReadStatus
const statusFilter = ref<StatusFilter>('all')
const search = ref('')

const tabs: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'wishlist', label: 'Quero ler' },
  { key: 'reading', label: 'Lendo' },
  { key: 'read', label: 'Lidos' },
]

function myStatus(book: BookWithReads): BookReadStatus | null {
  const myRead = book.reads.find((r) => r.profile_id === auth.user?.id)
  return myRead?.status ?? null
}

function myStatusMeta(book: BookWithReads) {
  const status = myStatus(book)
  return status ? BOOK_READ_STATUS[status] : null
}

function avgRating(book: BookWithReads): { value: number; count: number } | null {
  const rated = book.reads.filter((r) => typeof r.rating === 'number')
  if (rated.length === 0) return null
  const total = rated.reduce((sum, r) => sum + (r.rating ?? 0), 0)
  return { value: total / rated.length, count: rated.length }
}

function readCount(book: BookWithReads): number {
  return book.reads.filter((r) => r.status === 'read').length
}

const filtered = computed(() => {
  const list = booksQuery.data.value ?? []
  const q = search.value.trim().toLowerCase()

  return list.filter((b) => {
    const matchesSearch =
      !q ||
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.category?.toLowerCase().includes(q)

    const matchesStatus =
      statusFilter.value === 'all' || myStatus(b) === statusFilter.value

    return matchesSearch && matchesStatus
  })
})

// Form state
const formOpen = ref(false)
const form = ref({
  title: '',
  author: '',
  cover_url: '',
  url: '',
  category: '',
  description: '',
  available_at_bibliotech: false,
})

function openForm() {
  form.value = {
    title: '',
    author: '',
    cover_url: '',
    url: '',
    category: '',
    description: '',
    available_at_bibliotech: false,
  }
  formOpen.value = true
}

async function handleCreate() {
  if (!auth.user?.id) return
  if (!form.value.title.trim() || !form.value.author.trim()) return

  try {
    await createBook.mutateAsync({
      title: form.value.title.trim(),
      author: form.value.author.trim(),
      cover_url: form.value.cover_url.trim() || null,
      url: form.value.url.trim() || null,
      category: form.value.category.trim() || null,
      description: form.value.description.trim() || null,
      available_at_bibliotech: form.value.available_at_bibliotech,
      added_by_id: auth.user.id,
    })
    ui.pushToast('Livro adicionado ao catálogo.', 'success')
    formOpen.value = false
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao adicionar livro.',
      'error',
    )
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Biblioteca</h1>
        <p class="mt-1 text-sm text-muted">
          Catálogo compartilhado da Colina Tech.
        </p>
      </div>
      <button v-if="!formOpen" class="btn-primary" @click="openForm">
        Adicionar livro
      </button>
    </header>

    <!-- Form -->
    <Transition name="expand">
      <section v-if="formOpen" class="card p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold">Novo livro</h2>
        <button class="btn-ghost text-sm" @click="formOpen = false">Cancelar</button>
      </div>

      <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="handleCreate">
        <div>
          <label class="block text-sm font-medium mb-1.5">Título</label>
          <input v-model="form.title" type="text" required maxlength="180" class="input" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Autor(a)</label>
          <input v-model="form.author" type="text" required maxlength="120" class="input" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">
            Capa <span class="text-muted font-normal">(URL)</span>
          </label>
          <input
            v-model="form.cover_url"
            type="url"
            class="input"
            placeholder="https://..."
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">
            Link do livro <span class="text-muted font-normal">(opcional)</span>
          </label>
          <input
            v-model="form.url"
            type="url"
            class="input"
            placeholder="Amazon, Goodreads, editora..."
          />
        </div>

        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">
            Categoria <span class="text-muted font-normal">(opcional)</span>
          </label>
          <input
            v-model="form.category"
            type="text"
            class="input"
            placeholder="Ex.: Liderança, Tecnologia, Cultura"
            maxlength="60"
          />
        </div>

        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">
            Descrição <span class="text-muted font-normal">(opcional)</span>
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            maxlength="800"
            class="input resize-none"
            placeholder="Sinopse ou comentário..."
          ></textarea>
        </div>

        <div class="sm:col-span-2">
          <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              v-model="form.available_at_bibliotech"
              type="checkbox"
              class="rounded text-brand-600 focus:ring-brand-600"
            />
            <span>📚 Disponível na Bibliotech</span>
          </label>
          <p class="mt-1 text-xs text-muted">
            Marque se o livro está fisicamente na empresa e pode ser reservado pelos colaboradores.
          </p>
        </div>

        <div class="sm:col-span-2 flex items-center justify-end gap-3">
          <button type="button" class="btn-secondary" :disabled="createBook.isPending.value" @click="formOpen = false">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="createBook.isPending.value">
            {{ createBook.isPending.value ? 'Adicionando...' : 'Adicionar livro' }}
          </button>
        </div>
      </form>
      </section>
    </Transition>

    <!-- Tabs + search -->
    <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
      <div class="flex gap-1 p-1 bg-panel border border-line rounded-xl w-fit">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
          :class="
            statusFilter === tab.key
              ? 'bg-brand-600 text-white'
              : 'text-muted hover:text-ink'
          "
          @click="statusFilter = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <input
        v-model="search"
        type="search"
        placeholder="Buscar por título, autor ou categoria..."
        class="input flex-1"
      />
    </div>

    <!-- States -->
    <div v-if="booksQuery.isLoading.value" class="card p-12 text-center text-sm text-muted">
      Carregando catálogo...
    </div>

    <div
      v-else-if="booksQuery.isError.value"
      class="card p-6 text-sm text-red-700 bg-red-50 border-red-200"
    >
      Erro ao carregar: {{ booksQuery.error.value?.message }}
    </div>

    <div
      v-else-if="filtered.length === 0"
      class="card p-12 text-center text-sm text-muted"
    >
      <template v-if="(booksQuery.data.value?.length ?? 0) === 0">
        Nenhum livro no catálogo ainda. Adicione o primeiro!
      </template>
      <template v-else>
        Nenhum livro corresponde a esse filtro.
      </template>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <RouterLink
        v-for="book in filtered"
        :key="book.id"
        :to="{ name: 'book', params: { id: book.id } }"
        class="card overflow-hidden hover:shadow-panel hover:border-brand-200 transition-all flex flex-col"
      >
        <div class="aspect-[2/3] bg-surface relative overflow-hidden">
          <img
            v-if="book.cover_url"
            :src="book.cover_url"
            :alt="book.title"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-muted text-xs p-3 text-center bg-gradient-to-br from-brand-50 to-surface"
          >
            Sem capa
          </div>

          <span
            v-if="myStatusMeta(book)"
            class="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white shadow-soft"
            :style="{ backgroundColor: myStatusMeta(book)?.color }"
          >
            {{ myStatusMeta(book)?.label }}
          </span>
        </div>

        <div class="p-3 flex-1 flex flex-col gap-1">
          <p class="text-sm font-semibold leading-tight line-clamp-2">{{ book.title }}</p>
          <p class="text-xs text-muted truncate">{{ book.author }}</p>

          <span
            v-if="book.available_at_bibliotech"
            class="mt-1 inline-flex items-center gap-1 self-start text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
            :class="
              (book.borrowings ?? []).some((b) => b.status === 'borrowed')
                ? 'bg-amber-100 text-amber-800'
                : 'bg-brand-100 text-brand-700'
            "
            :title="
              (book.borrowings ?? []).some((b) => b.status === 'borrowed')
                ? 'Emprestado no momento'
                : 'Disponível na Bibliotech'
            "
          >
            📚
            {{
              (book.borrowings ?? []).some((b) => b.status === 'borrowed')
                ? 'Emprestado'
                : 'Bibliotech'
            }}
          </span>

          <div class="mt-auto pt-2 flex items-center justify-between text-xs">
            <span v-if="avgRating(book)" class="flex items-center gap-1 text-muted">
              <span class="text-yellow-500">★</span>
              <span class="font-medium text-ink">{{ avgRating(book)?.value.toFixed(1) }}</span>
              <span class="text-muted">({{ avgRating(book)?.count }})</span>
            </span>
            <span v-else class="text-muted">Sem avaliações</span>
            <span v-if="readCount(book) > 0" class="text-muted">
              {{ readCount(book) }} {{ readCount(book) === 1 ? 'leitor' : 'leitores' }}
            </span>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
