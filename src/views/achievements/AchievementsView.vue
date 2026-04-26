<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  useAchievements,
  useCreateAchievement,
  useDeleteAchievement,
} from '@/composables/useAchievements'
import { useProfiles } from '@/composables/useProfiles'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ACHIEVEMENT_CATEGORIES, type AchievementCategory } from '@/types/database'
import { timeAgo, initials } from '@/lib/format'

const auth = useAuthStore()
const ui = useUiStore()
const achievementsQuery = useAchievements()
const profilesQuery = useProfiles()
const createAchievement = useCreateAchievement()
const deleteAchievement = useDeleteAchievement()

const categoryEntries = Object.entries(ACHIEVEMENT_CATEGORIES) as [
  AchievementCategory,
  { label: string; color: string },
][]

// Filters
const filterCategory = ref<AchievementCategory | 'all'>('all')
const filterRecipient = ref<string>('all')

const filtered = computed(() => {
  const all = achievementsQuery.data.value ?? []
  return all.filter((a) => {
    const matchesCat = filterCategory.value === 'all' || a.category === filterCategory.value
    const matchesRec =
      filterRecipient.value === 'all' || a.recipient_id === filterRecipient.value
    return matchesCat && matchesRec
  })
})

// Other people (cannot grant to self)
const otherProfiles = computed(() =>
  (profilesQuery.data.value ?? []).filter((p) => p.id !== auth.user?.id),
)

// Form state
const formOpen = ref(false)
const form = ref<{
  recipient_id: string
  category: AchievementCategory
  title: string
  message: string
}>({
  recipient_id: '',
  category: 'trabalho_em_equipe',
  title: '',
  message: '',
})

function resetForm() {
  form.value = {
    recipient_id: '',
    category: 'trabalho_em_equipe',
    title: '',
    message: '',
  }
}

function openForm() {
  resetForm()
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
}

async function handleSubmit() {
  if (!auth.user?.id) return
  if (!form.value.recipient_id || !form.value.title.trim()) return

  try {
    await createAchievement.mutateAsync({
      recipient_id: form.value.recipient_id,
      granted_by_id: auth.user.id,
      category: form.value.category,
      title: form.value.title.trim(),
      message: form.value.message.trim() || null,
    })
    ui.pushToast('Conquista registrada.', 'success')
    closeForm()
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao registrar conquista.',
      'error',
    )
  }
}

async function handleDelete(id: string) {
  if (!confirm('Excluir esta conquista?')) return
  try {
    await deleteAchievement.mutateAsync(id)
    ui.pushToast('Conquista excluída.', 'success')
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao excluir.',
      'error',
    )
  }
}

function canDelete(grantedById: string) {
  return auth.user?.id === grantedById
  // (admins also can per RLS; we don't check viewer's role on the client to keep it simple — server enforces)
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Conquistas & Premiações</h1>
        <p class="mt-1 text-sm text-muted">
          Reconhecimentos do time. Celebre alguém.
        </p>
      </div>
      <button v-if="!formOpen" class="btn-primary" @click="openForm">
        Nova conquista
      </button>
    </header>

    <!-- Form -->
    <Transition name="expand">
      <section v-if="formOpen" class="card p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold">Reconhecer alguém</h2>
        <button class="btn-ghost text-sm" @click="closeForm">Cancelar</button>
      </div>

      <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="handleSubmit">
        <div>
          <label class="block text-sm font-medium mb-1.5">Para quem?</label>
          <select v-model="form.recipient_id" required class="input">
            <option value="" disabled>Selecione uma pessoa</option>
            <option v-for="p in otherProfiles" :key="p.id" :value="p.id">
              {{ p.full_name || p.email.split('@')[0] }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Categoria</label>
          <select v-model="form.category" class="input">
            <option v-for="[key, meta] in categoryEntries" :key="key" :value="key">
              {{ meta.label }}
            </option>
          </select>
        </div>

        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">Título</label>
          <input
            v-model="form.title"
            type="text"
            required
            maxlength="120"
            class="input"
            placeholder="Ex.: Melhor entrega do trimestre"
          />
        </div>

        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">
            Mensagem <span class="text-muted font-normal">(opcional)</span>
          </label>
          <textarea
            v-model="form.message"
            rows="3"
            maxlength="500"
            class="input resize-none"
            placeholder="Conte por que essa pessoa merece esse reconhecimento..."
          ></textarea>
        </div>

        <div class="sm:col-span-2 flex items-center justify-end gap-3">
          <button type="button" class="btn-secondary" :disabled="createAchievement.isPending.value" @click="closeForm">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="createAchievement.isPending.value">
            {{ createAchievement.isPending.value ? 'Registrando...' : 'Registrar conquista' }}
          </button>
        </div>
      </form>
      </section>
    </Transition>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-3">
      <select v-model="filterCategory" class="input sm:w-64">
        <option value="all">Todas as categorias</option>
        <option v-for="[key, meta] in categoryEntries" :key="key" :value="key">
          {{ meta.label }}
        </option>
      </select>
      <select v-model="filterRecipient" class="input sm:w-64">
        <option value="all">Todas as pessoas</option>
        <option v-for="p in profilesQuery.data.value ?? []" :key="p.id" :value="p.id">
          {{ p.full_name || p.email.split('@')[0] }}
        </option>
      </select>
    </div>

    <!-- States -->
    <div
      v-if="achievementsQuery.isLoading.value"
      class="card p-12 text-center text-sm text-muted"
    >
      Carregando conquistas...
    </div>

    <div
      v-else-if="achievementsQuery.isError.value"
      class="card p-6 text-sm text-red-700 bg-red-50 border-red-200"
    >
      Erro ao carregar: {{ achievementsQuery.error.value?.message }}
    </div>

    <div
      v-else-if="filtered.length === 0"
      class="card p-12 text-center text-sm text-muted"
    >
      Nenhuma conquista por aqui ainda. Que tal reconhecer alguém?
    </div>

    <!-- Feed -->
    <TransitionGroup v-else name="list" tag="ul" class="space-y-3 relative">
      <li v-for="a in filtered" :key="a.id" class="card p-5">
        <div class="flex items-start gap-4">
          <RouterLink
            v-if="a.recipient"
            :to="{ name: 'profile', params: { id: a.recipient.id } }"
            class="flex-shrink-0"
          >
            <img
              v-if="a.recipient.avatar_url"
              :src="a.recipient.avatar_url"
              :alt="a.recipient.full_name ?? a.recipient.email"
              class="h-12 w-12 rounded-2xl object-cover"
            />
            <div
              v-else
              class="h-12 w-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center text-base font-bold"
            >
              {{ initials(a.recipient.full_name, a.recipient.email) }}
            </div>
          </RouterLink>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <RouterLink
                v-if="a.recipient"
                :to="{ name: 'profile', params: { id: a.recipient.id } }"
                class="text-sm font-semibold hover:text-brand-700"
              >
                {{ a.recipient.full_name || a.recipient.email.split('@')[0] }}
              </RouterLink>
              <span
                class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                :style="{
                  backgroundColor: ACHIEVEMENT_CATEGORIES[a.category].color + '15',
                  color: ACHIEVEMENT_CATEGORIES[a.category].color,
                }"
              >
                {{ ACHIEVEMENT_CATEGORIES[a.category].label }}
              </span>
            </div>

            <p class="mt-1.5 text-base font-medium">{{ a.title }}</p>

            <p v-if="a.message" class="mt-1 text-sm text-ink/80 whitespace-pre-line">
              {{ a.message }}
            </p>

            <div class="mt-3 flex items-center gap-2 text-xs text-muted">
              <span>Reconhecido por</span>
              <RouterLink
                v-if="a.granted_by"
                :to="{ name: 'profile', params: { id: a.granted_by.id } }"
                class="font-medium hover:text-ink"
              >
                {{ a.granted_by.full_name || a.granted_by.email.split('@')[0] }}
              </RouterLink>
              <span v-else class="italic">usuário removido</span>
              <span>·</span>
              <span>{{ timeAgo(a.granted_at) }}</span>
            </div>
          </div>

          <button
            v-if="canDelete(a.granted_by_id)"
            class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
            @click="handleDelete(a.id)"
          >
            Excluir
          </button>
        </div>
      </li>
    </TransitionGroup>
  </div>
</template>
