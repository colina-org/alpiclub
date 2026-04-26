<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useBook, useDeleteBook, useUpdateBook } from '@/composables/useBooks'
import { useBookReads, useMyRead, useUpsertRead, useDeleteRead } from '@/composables/useBookReads'
import {
  useActiveBorrowing,
  useBorrowBook,
  useReturnBook,
  useJoinQueue,
  useLeaveQueue,
} from '@/composables/useBookBorrowings'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { BookReadStatus } from '@/types/database'
import { BOOK_READ_STATUS } from '@/types/database'
import { initials, timeAgo } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const bookId = computed(() => route.params.id as string)
const profileId = computed(() => auth.user?.id)

const bookQuery = useBook(bookId)
const readsQuery = useBookReads(bookId)
const myReadQuery = useMyRead(bookId, profileId)
const upsertRead = useUpsertRead()
const deleteRead = useDeleteRead()
const deleteBook = useDeleteBook()
const updateBook = useUpdateBook()

// ---------------------------------------------------------------------
// Bibliotech: empréstimos
// ---------------------------------------------------------------------
const { active: activeBorrowing, queue, borrowingsQuery } = useActiveBorrowing(bookId)
const borrowBook = useBorrowBook()
const returnBook = useReturnBook()
const joinQueue = useJoinQueue()
const leaveQueue = useLeaveQueue()

const isBorrowedByMe = computed(
  () => !!activeBorrowing.value && activeBorrowing.value.profile_id === profileId.value,
)

const myQueueEntry = computed(
  () => queue.value.find((b) => b.profile_id === profileId.value) ?? null,
)

const isBibliotech = computed(
  () => !!bookQuery.data.value?.available_at_bibliotech,
)

const borrowingHistory = computed(() =>
  (borrowingsQuery.data.value ?? []).filter((b) => b.status === 'returned'),
)

async function handleBorrow() {
  if (!profileId.value) return
  try {
    await borrowBook.mutateAsync({
      book_id: bookId.value,
      profile_id: profileId.value,
    })
    ui.pushToast('Livro pego emprestado. Boa leitura!', 'success')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao pegar emprestado.'
    // Erro mais comum: someone else has it (unique constraint).
    if (/unique|duplicate/i.test(msg)) {
      ui.pushToast('Outra pessoa pegou o livro nesse instante. Recarregue.', 'error')
    } else {
      ui.pushToast(msg, 'error')
    }
  }
}

async function handleReturn() {
  if (!activeBorrowing.value || !profileId.value) return
  try {
    await returnBook.mutateAsync({
      id: activeBorrowing.value.id,
      bookId: bookId.value,
      profileId: profileId.value,
    })
    ui.pushToast('Devolução registrada. Obrigado!', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao devolver.', 'error')
  }
}

async function handleJoinQueue() {
  if (!profileId.value) return
  try {
    await joinQueue.mutateAsync({
      book_id: bookId.value,
      profile_id: profileId.value,
    })
    ui.pushToast('Você entrou na fila. Avisaremos quando for sua vez 📬', 'success')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao entrar na fila.'
    if (/unique|duplicate/i.test(msg)) {
      ui.pushToast('Você já está na fila ou tem este livro.', 'error')
    } else {
      ui.pushToast(msg, 'error')
    }
  }
}

async function handleLeaveQueue() {
  if (!myQueueEntry.value || !profileId.value) return
  if (!confirm('Sair da fila deste livro?')) return
  try {
    await leaveQueue.mutateAsync({
      id: myQueueEntry.value.id,
      bookId: bookId.value,
      profileId: profileId.value,
    })
    ui.pushToast('Você saiu da fila.', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao sair.', 'error')
  }
}

// Editable form for "my read"
const form = ref<{
  status: BookReadStatus
  rating: number | null
  review: string
  finished_at: string
}>({
  status: 'wishlist',
  rating: null,
  review: '',
  finished_at: '',
})

watch(myReadQuery.data, (myRead) => {
  if (myRead) {
    form.value = {
      status: myRead.status,
      rating: myRead.rating,
      review: myRead.review ?? '',
      finished_at: myRead.finished_at ?? '',
    }
  } else {
    form.value = { status: 'wishlist', rating: null, review: '', finished_at: '' }
  }
}, { immediate: true })

const otherReads = computed(() =>
  (readsQuery.data.value ?? []).filter((r) => r.profile_id !== profileId.value),
)

const stats = computed(() => {
  const reads = readsQuery.data.value ?? []
  const rated = reads.filter((r) => typeof r.rating === 'number')
  const avg = rated.length > 0
    ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length
    : null
  return {
    readers: reads.filter((r) => r.status === 'read').length,
    reading: reads.filter((r) => r.status === 'reading').length,
    wishlist: reads.filter((r) => r.status === 'wishlist').length,
    avg,
    ratings: rated.length,
  }
})

const canEditBook = computed(
  () => !!bookQuery.data.value && bookQuery.data.value.added_by_id === profileId.value,
)
// Mantido para compat: comportamento idêntico (mesma RLS de quem adicionou).
const canDeleteBook = canEditBook

// ---------------------------------------------------------------------
// Edit book form
// ---------------------------------------------------------------------
const editingBook = ref(false)
const bookForm = ref({
  title: '',
  author: '',
  cover_url: '',
  url: '',
  category: '',
  description: '',
  available_at_bibliotech: false,
})

watch(
  bookQuery.data,
  (b) => {
    if (b) {
      bookForm.value = {
        title: b.title,
        author: b.author,
        cover_url: b.cover_url ?? '',
        url: b.url ?? '',
        category: b.category ?? '',
        description: b.description ?? '',
        available_at_bibliotech: b.available_at_bibliotech ?? false,
      }
    }
  },
  { immediate: true },
)

function startEditBook() {
  editingBook.value = true
}

function cancelEditBook() {
  editingBook.value = false
  const b = bookQuery.data.value
  if (b) {
    bookForm.value = {
      title: b.title,
      author: b.author,
      cover_url: b.cover_url ?? '',
      url: b.url ?? '',
      category: b.category ?? '',
      description: b.description ?? '',
      available_at_bibliotech: b.available_at_bibliotech ?? false,
    }
  }
}

async function handleSaveBook() {
  if (!bookQuery.data.value) return
  if (!bookForm.value.title.trim() || !bookForm.value.author.trim()) return
  try {
    await updateBook.mutateAsync({
      id: bookQuery.data.value.id,
      patch: {
        title: bookForm.value.title.trim(),
        author: bookForm.value.author.trim(),
        cover_url: bookForm.value.cover_url.trim() || null,
        url: bookForm.value.url.trim() || null,
        category: bookForm.value.category.trim() || null,
        description: bookForm.value.description.trim() || null,
        available_at_bibliotech: bookForm.value.available_at_bibliotech,
      },
    })
    ui.pushToast('Livro atualizado.', 'success')
    editingBook.value = false
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao salvar livro.', 'error')
  }
}

async function saveMyRead() {
  if (!profileId.value) return
  try {
    await upsertRead.mutateAsync({
      profile_id: profileId.value,
      book_id: bookId.value,
      status: form.value.status,
      rating: form.value.status === 'read' ? form.value.rating : null,
      review: form.value.status === 'read' ? (form.value.review.trim() || null) : null,
      finished_at: form.value.status === 'read' ? (form.value.finished_at || null) : null,
    })
    ui.pushToast('Estante atualizada.', 'success')
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao salvar.',
      'error',
    )
  }
}

async function removeMyRead() {
  const myRead = myReadQuery.data.value
  if (!myRead || !profileId.value) return
  if (!confirm('Remover este livro da sua estante?')) return

  try {
    await deleteRead.mutateAsync({
      id: myRead.id,
      bookId: bookId.value,
      profileId: profileId.value,
    })
    ui.pushToast('Removido da estante.', 'success')
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao remover.',
      'error',
    )
  }
}

async function handleDeleteBook() {
  if (!confirm('Excluir este livro do catálogo? Todas as resenhas serão perdidas.')) return
  try {
    await deleteBook.mutateAsync(bookId.value)
    ui.pushToast('Livro excluído.', 'success')
    router.push({ name: 'library' })
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao excluir.',
      'error',
    )
  }
}
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <RouterLink
      :to="{ name: 'library' }"
      class="text-sm text-muted hover:text-ink inline-flex items-center gap-1.5"
    >
      ← Voltar para a Biblioteca
    </RouterLink>

    <div v-if="bookQuery.isLoading.value" class="card p-12 text-center text-sm text-muted">
      Carregando livro...
    </div>

    <div
      v-else-if="bookQuery.isError.value"
      class="card p-6 text-sm text-red-700 bg-red-50 border-red-200"
    >
      Erro ao carregar: {{ bookQuery.error.value?.message }}
    </div>

    <template v-else-if="bookQuery.data.value">
      <!-- Inline edit form -->
      <div v-if="editingBook" class="card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold">Editar livro</h2>
          <button class="btn-ghost text-sm" @click="cancelEditBook">Cancelar</button>
        </div>

        <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="handleSaveBook">
          <div>
            <label class="block text-sm font-medium mb-1.5">Título</label>
            <input v-model="bookForm.title" type="text" required maxlength="180" class="input" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5">Autor(a)</label>
            <input v-model="bookForm.author" type="text" required maxlength="120" class="input" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5">
              Capa <span class="text-muted font-normal">(URL)</span>
            </label>
            <input v-model="bookForm.cover_url" type="url" class="input" placeholder="https://..." />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5">
              Link do livro <span class="text-muted font-normal">(opcional)</span>
            </label>
            <input v-model="bookForm.url" type="url" class="input" placeholder="Amazon, Goodreads..." />
          </div>

          <div class="sm:col-span-2">
            <label class="block text-sm font-medium mb-1.5">
              Categoria <span class="text-muted font-normal">(opcional)</span>
            </label>
            <input
              v-model="bookForm.category"
              type="text"
              maxlength="60"
              class="input"
              placeholder="Liderança, Tecnologia..."
            />
          </div>

          <div class="sm:col-span-2">
            <label class="block text-sm font-medium mb-1.5">
              Descrição <span class="text-muted font-normal">(opcional)</span>
            </label>
            <textarea
              v-model="bookForm.description"
              rows="3"
              maxlength="800"
              class="input resize-none"
            ></textarea>
          </div>

          <div class="sm:col-span-2">
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                v-model="bookForm.available_at_bibliotech"
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
            <button type="button" class="btn-secondary" :disabled="updateBook.isPending.value" @click="cancelEditBook">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" :disabled="updateBook.isPending.value">
              {{ updateBook.isPending.value ? 'Salvando...' : 'Salvar alterações' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Header -->
      <div class="card p-6 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6">
        <div class="aspect-[2/3] sm:w-40 rounded-xl bg-surface overflow-hidden flex-shrink-0">
          <img
            v-if="bookQuery.data.value.cover_url"
            :src="bookQuery.data.value.cover_url"
            :alt="bookQuery.data.value.title"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-xs text-muted bg-gradient-to-br from-brand-50 to-surface">
            Sem capa
          </div>
        </div>

        <div class="min-w-0 flex flex-col gap-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-2xl font-semibold tracking-tight">
                {{ bookQuery.data.value.title }}
              </h1>
              <p class="text-sm text-muted mt-0.5">por {{ bookQuery.data.value.author }}</p>
            </div>
            <button
              v-if="canEditBook && !editingBook"
              class="btn-secondary text-sm flex-shrink-0"
              @click="startEditBook"
            >
              Editar
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            <span
              v-if="bookQuery.data.value.category"
              class="text-xs font-medium px-2 py-1 rounded-lg bg-brand-50 text-brand-700"
            >
              {{ bookQuery.data.value.category }}
            </span>
            <span
              v-if="bookQuery.data.value.available_at_bibliotech"
              class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-brand-100 text-brand-700"
              title="Disponível fisicamente na empresa"
            >
              📚 Disponível na Bibliotech
            </span>
          </div>

          <p v-if="bookQuery.data.value.description" class="text-sm text-ink/80 whitespace-pre-line">
            {{ bookQuery.data.value.description }}
          </p>

          <a
            v-if="bookQuery.data.value.url"
            :href="bookQuery.data.value.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800 self-start"
          >
            🔗 Acessar livro ↗
          </a>

          <div class="flex items-center gap-5 text-sm text-muted pt-2 mt-auto flex-wrap">
            <span v-if="stats.avg !== null" class="flex items-center gap-1.5">
              <span class="text-yellow-500">★</span>
              <strong class="text-ink">{{ stats.avg.toFixed(1) }}</strong>
              <span>({{ stats.ratings }})</span>
            </span>
            <span>{{ stats.readers }} {{ stats.readers === 1 ? 'leitor' : 'leitores' }}</span>
            <span>{{ stats.reading }} lendo</span>
            <span>{{ stats.wishlist }} querem ler</span>

            <button
              v-if="canDeleteBook"
              class="ml-auto text-xs text-red-600 hover:text-red-700"
              @click="handleDeleteBook"
            >
              Excluir livro
            </button>
          </div>
        </div>
      </div>

      <!-- Bibliotech borrowing -->
      <div v-if="isBibliotech" class="card p-6 space-y-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-base font-semibold">📚 Bibliotech</h2>
            <p class="mt-0.5 text-xs text-muted">
              Empréstimo físico do exemplar disponível na empresa.
            </p>
          </div>

          <!-- Estado: ninguém pegou -->
          <button
            v-if="!activeBorrowing"
            class="btn-primary text-sm"
            :disabled="borrowBook.isPending.value"
            @click="handleBorrow"
          >
            {{ borrowBook.isPending.value ? '...' : 'Pegar emprestado' }}
          </button>

          <!-- Estado: eu peguei -->
          <button
            v-else-if="isBorrowedByMe"
            class="btn-primary text-sm"
            :disabled="returnBook.isPending.value"
            @click="handleReturn"
          >
            {{ returnBook.isPending.value ? '...' : 'Devolver livro' }}
          </button>

          <!-- Estado: alguém pegou e eu já estou na fila -->
          <button
            v-else-if="myQueueEntry"
            class="btn-secondary text-sm"
            :disabled="leaveQueue.isPending.value"
            @click="handleLeaveQueue"
          >
            {{ leaveQueue.isPending.value ? '...' : 'Sair da fila' }}
          </button>

          <!-- Estado: alguém pegou e eu não estou na fila -->
          <button
            v-else
            class="btn-secondary text-sm"
            :disabled="joinQueue.isPending.value"
            @click="handleJoinQueue"
          >
            {{ joinQueue.isPending.value ? '...' : 'Entrar na fila' }}
          </button>
        </div>

        <!-- Quem está com o livro -->
        <div
          v-if="activeBorrowing && activeBorrowing.profile"
          class="flex items-center gap-3 p-3 border border-line rounded-xl bg-amber-50/40"
        >
          <RouterLink
            :to="{ name: 'profile', params: { id: activeBorrowing.profile.id } }"
            class="flex-shrink-0"
          >
            <img
              v-if="activeBorrowing.profile.avatar_url"
              :src="activeBorrowing.profile.avatar_url"
              :alt="activeBorrowing.profile.full_name ?? activeBorrowing.profile.email"
              class="h-10 w-10 rounded-xl object-cover"
            />
            <div
              v-else
              class="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold"
            >
              {{ initials(activeBorrowing.profile.full_name, activeBorrowing.profile.email) }}
            </div>
          </RouterLink>
          <div class="flex-1 min-w-0">
            <p class="text-sm">
              <strong>
                {{ isBorrowedByMe ? 'Você' : activeBorrowing.profile.full_name || activeBorrowing.profile.email.split('@')[0] }}
              </strong>
              está com o livro
            </p>
            <p class="text-xs text-muted">desde {{ timeAgo(activeBorrowing.borrowed_at) }}</p>
          </div>
        </div>

        <!-- Fila de espera -->
        <div v-if="queue.length > 0" class="border border-line rounded-xl p-3 space-y-2">
          <p class="text-xs font-semibold text-muted uppercase tracking-wider">
            Fila de espera ({{ queue.length }})
          </p>
          <ol class="space-y-2">
            <li
              v-for="(entry, idx) in queue"
              :key="entry.id"
              class="flex items-center gap-3 text-sm"
            >
              <span
                class="h-5 w-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0"
              >
                {{ idx + 1 }}
              </span>
              <RouterLink
                v-if="entry.profile"
                :to="{ name: 'profile', params: { id: entry.profile.id } }"
                class="flex items-center gap-2 hover:text-brand-700 min-w-0 flex-1"
              >
                <img
                  v-if="entry.profile.avatar_url"
                  :src="entry.profile.avatar_url"
                  alt=""
                  class="h-7 w-7 rounded-lg object-cover"
                />
                <div
                  v-else
                  class="h-7 w-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold"
                >
                  {{ initials(entry.profile.full_name, entry.profile.email) }}
                </div>
                <span class="truncate">
                  {{ entry.profile.full_name || entry.profile.email.split('@')[0] }}
                  <span v-if="entry.profile_id === profileId" class="text-muted">(você)</span>
                </span>
              </RouterLink>
              <span class="text-xs text-muted flex-shrink-0">
                desde {{ timeAgo(entry.created_at) }}
              </span>
            </li>
          </ol>
        </div>

        <!-- Histórico -->
        <details v-if="borrowingHistory.length > 0" class="text-sm">
          <summary class="cursor-pointer text-xs font-medium text-muted hover:text-ink">
            Ver histórico ({{ borrowingHistory.length }})
          </summary>
          <ul class="mt-3 space-y-2">
            <li
              v-for="b in borrowingHistory"
              :key="b.id"
              class="flex items-center gap-3 text-xs"
            >
              <RouterLink
                v-if="b.profile"
                :to="{ name: 'profile', params: { id: b.profile.id } }"
                class="flex items-center gap-2 text-ink/80 hover:text-brand-700"
              >
                <div
                  v-if="!b.profile.avatar_url"
                  class="h-6 w-6 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold"
                >
                  {{ initials(b.profile.full_name, b.profile.email) }}
                </div>
                <img
                  v-else
                  :src="b.profile.avatar_url"
                  class="h-6 w-6 rounded-md object-cover"
                  alt=""
                />
                <span class="font-medium">
                  {{ b.profile.full_name || b.profile.email.split('@')[0] }}
                </span>
              </RouterLink>
              <span class="text-muted">
                pegou {{ timeAgo(b.borrowed_at) }}<span v-if="b.returned_at"> · devolveu {{ timeAgo(b.returned_at) }}</span>
              </span>
            </li>
          </ul>
        </details>
      </div>

      <!-- My read editor -->
      <div class="card p-6 space-y-4">
        <h2 class="text-base font-semibold">Minha estante</h2>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="(meta, key) in BOOK_READ_STATUS"
            :key="key"
            class="px-3 py-2 rounded-xl text-sm font-medium border transition-all"
            :class="
              form.status === key
                ? 'border-transparent text-white'
                : 'border-line text-muted hover:text-ink hover:bg-surface'
            "
            :style="form.status === key ? { backgroundColor: meta.color } : {}"
            @click="form.status = key"
          >
            {{ meta.label }}
          </button>
        </div>

        <div v-if="form.status === 'read'" class="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
          <div>
            <label class="block text-sm font-medium mb-1.5">Sua resenha (opcional)</label>
            <textarea
              v-model="form.review"
              rows="4"
              maxlength="800"
              class="input resize-none"
              placeholder="O que achou? Recomenda?"
            ></textarea>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">Nota</label>
              <div class="flex gap-1">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  class="text-2xl transition-transform hover:scale-110"
                  :class="(form.rating ?? 0) >= n ? 'text-yellow-500' : 'text-line'"
                  @click="form.rating = form.rating === n ? null : n"
                >
                  ★
                </button>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">Concluído em</label>
              <input v-model="form.finished_at" type="date" class="input" />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 pt-2">
          <button
            v-if="myReadQuery.data.value"
            class="btn-ghost text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
            :disabled="deleteRead.isPending.value"
            @click="removeMyRead"
          >
            Remover da estante
          </button>
          <button
            class="btn-primary ml-auto"
            :disabled="upsertRead.isPending.value"
            @click="saveMyRead"
          >
            {{ upsertRead.isPending.value ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>

      <!-- Team reviews -->
      <div class="card p-6">
        <h2 class="text-base font-semibold">Resenhas do time</h2>
        <p class="mt-0.5 text-xs text-muted">
          O que outras pessoas da Colina Tech estão lendo ou já leram.
        </p>

        <div v-if="readsQuery.isLoading.value" class="mt-6 text-sm text-muted text-center py-8">
          Carregando...
        </div>

        <div
          v-else-if="otherReads.length === 0"
          class="mt-6 text-sm text-muted text-center py-12 border border-dashed border-line rounded-xl"
        >
          Ninguém mais marcou este livro ainda.
        </div>

        <ul v-else class="mt-5 divide-y divide-line">
          <li
            v-for="r in otherReads"
            :key="r.id"
            class="py-4 flex items-start gap-3"
          >
            <RouterLink
              v-if="r.profile"
              :to="{ name: 'profile', params: { id: r.profile.id } }"
              class="flex-shrink-0"
            >
              <img
                v-if="r.profile.avatar_url"
                :src="r.profile.avatar_url"
                :alt="r.profile.full_name ?? r.profile.email"
                class="h-10 w-10 rounded-xl object-cover"
              />
              <div
                v-else
                class="h-10 w-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold"
              >
                {{ initials(r.profile.full_name, r.profile.email) }}
              </div>
            </RouterLink>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <RouterLink
                  v-if="r.profile"
                  :to="{ name: 'profile', params: { id: r.profile.id } }"
                  class="text-sm font-semibold hover:text-brand-700"
                >
                  {{ r.profile.full_name || r.profile.email.split('@')[0] }}
                </RouterLink>
                <span
                  class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
                  :style="{ backgroundColor: BOOK_READ_STATUS[r.status].color }"
                >
                  {{ BOOK_READ_STATUS[r.status].label }}
                </span>
                <span v-if="r.rating" class="text-sm text-yellow-500">
                  {{ '★'.repeat(r.rating) }}<span class="text-line">{{ '★'.repeat(5 - r.rating) }}</span>
                </span>
              </div>
              <p v-if="r.review" class="mt-1.5 text-sm text-ink/80 whitespace-pre-line">
                {{ r.review }}
              </p>
              <p class="mt-1 text-xs text-muted">{{ timeAgo(r.updated_at) }}</p>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
