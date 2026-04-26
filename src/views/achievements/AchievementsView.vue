<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  useAchievements,
  useCreateAchievement,
  useUpdateAchievement,
  useDeleteAchievement,
  useToggleAchievementLike,
} from '@/composables/useAchievements'
import { Heart } from 'lucide-vue-next'
import { useProfiles } from '@/composables/useProfiles'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { supabase } from '@/lib/supabase'
import {
  ACHIEVEMENT_CATEGORIES,
  type AchievementCategory,
  type AchievementWithPeople,
} from '@/types/database'
import { timeAgo, initials } from '@/lib/format'

const auth = useAuthStore()
const ui = useUiStore()
const achievementsQuery = useAchievements()
const profilesQuery = useProfiles()
const createAchievement = useCreateAchievement()
const updateAchievement = useUpdateAchievement()
const deleteAchievement = useDeleteAchievement()
const toggleLike = useToggleAchievementLike()

function likeCount(a: AchievementWithPeople): number {
  return a.likes?.length ?? 0
}

function isLikedByMe(a: AchievementWithPeople): boolean {
  if (!auth.user?.id) return false
  return (a.likes ?? []).some((l) => l.profile_id === auth.user!.id)
}

async function handleToggleLike(a: AchievementWithPeople) {
  if (!auth.user?.id) return
  try {
    await toggleLike.mutateAsync({
      achievementId: a.id,
      profileId: auth.user.id,
      isLiked: isLikedByMe(a),
    })
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao curtir.', 'error')
  }
}

const categoryEntries = Object.entries(ACHIEVEMENT_CATEGORIES) as [
  AchievementCategory,
  { label: string; color: string },
][]

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

const otherProfiles = computed(() =>
  (profilesQuery.data.value ?? []).filter((p) => p.id !== auth.user?.id),
)

// ---------------------------------------------------------------------
// Form (create + edit)
// ---------------------------------------------------------------------
type FormState = {
  id: string | null
  recipient_id: string
  category: AchievementCategory
  title: string
  message: string
  // Imagem: nova selecionada, preview local, ou URL atual.
  imageFile: File | null
  imagePreview: string | null
  currentImageUrl: string | null
  removeImage: boolean
}

const emptyForm = (): FormState => ({
  id: null,
  recipient_id: '',
  category: 'trabalho_em_equipe',
  title: '',
  message: '',
  imageFile: null,
  imagePreview: null,
  currentImageUrl: null,
  removeImage: false,
})

const formOpen = ref(false)
const form = ref<FormState>(emptyForm())
const uploadingImage = ref(false)

function openCreate() {
  form.value = emptyForm()
  formOpen.value = true
}

function openEdit(a: AchievementWithPeople) {
  form.value = {
    id: a.id,
    recipient_id: a.recipient_id,
    category: a.category,
    title: a.title,
    message: a.message ?? '',
    imageFile: null,
    imagePreview: null,
    currentImageUrl: a.image_url,
    removeImage: false,
  }
  formOpen.value = true
}

function closeForm() {
  if (form.value.imagePreview) URL.revokeObjectURL(form.value.imagePreview)
  formOpen.value = false
}

const ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMG_BYTES = 3 * 1024 * 1024

function onImagePick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!ALLOWED_IMG.includes(file.type)) {
    ui.pushToast('Use JPG, PNG ou WebP.', 'error')
    return
  }
  if (file.size > MAX_IMG_BYTES) {
    ui.pushToast('Imagem muito grande. Limite de 3 MB.', 'error')
    return
  }
  if (form.value.imagePreview) URL.revokeObjectURL(form.value.imagePreview)
  form.value.imageFile = file
  form.value.imagePreview = URL.createObjectURL(file)
  form.value.removeImage = false
}

function clearImage() {
  if (form.value.imagePreview) URL.revokeObjectURL(form.value.imagePreview)
  form.value.imageFile = null
  form.value.imagePreview = null
  // Se já tinha imagem antes, marca pra remover no save.
  if (form.value.currentImageUrl) form.value.removeImage = true
}

async function uploadAchievementImage(file: File): Promise<string> {
  if (!auth.user?.id) throw new Error('Não autenticado')
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${auth.user.id}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('achievement_images')
    .upload(path, file, { contentType: file.type, cacheControl: '3600' })
  if (error) throw error
  const { data } = supabase.storage.from('achievement_images').getPublicUrl(path)
  return data.publicUrl
}

async function handleSubmit() {
  if (!auth.user?.id) return
  if (!form.value.recipient_id || !form.value.title.trim()) return

  try {
    // 1) Upload de imagem (se houver) — antes do save.
    let imageUrl: string | null | undefined
    if (form.value.imageFile) {
      uploadingImage.value = true
      try {
        imageUrl = await uploadAchievementImage(form.value.imageFile)
      } finally {
        uploadingImage.value = false
      }
    } else if (form.value.removeImage) {
      imageUrl = null
    } else if (form.value.id) {
      // Em edição sem mudar imagem, mantém a atual: não envio o campo.
      imageUrl = undefined
    } else {
      imageUrl = null
    }

    // 2) Create or update.
    if (form.value.id) {
      await updateAchievement.mutateAsync({
        id: form.value.id,
        patch: {
          recipient_id: form.value.recipient_id,
          category: form.value.category,
          title: form.value.title.trim(),
          message: form.value.message.trim() || null,
          ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
        },
      })
      ui.pushToast('Conquista atualizada.', 'success')
    } else {
      await createAchievement.mutateAsync({
        recipient_id: form.value.recipient_id,
        granted_by_id: auth.user.id,
        category: form.value.category,
        title: form.value.title.trim(),
        message: form.value.message.trim() || null,
        image_url: imageUrl ?? null,
      })
      ui.pushToast('Conquista registrada.', 'success')
    }
    closeForm()
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao salvar conquista.',
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

function canEditOrDelete(grantedById: string) {
  return auth.user?.id === grantedById
}

const isMutating = computed(
  () =>
    createAchievement.isPending.value ||
    updateAchievement.isPending.value ||
    uploadingImage.value,
)

// Imagem mostrada no form: preview novo > URL atual (em edição).
const currentFormImage = computed(
  () => form.value.imagePreview || (form.value.removeImage ? null : form.value.currentImageUrl),
)
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
      <button v-if="!formOpen" class="btn-primary" @click="openCreate">
        Nova conquista
      </button>
    </header>

    <!-- Form -->
    <Transition name="expand">
      <section v-if="formOpen" class="card p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold">
          {{ form.id ? 'Editar conquista' : 'Reconhecer alguém' }}
        </h2>
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

        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">
            Imagem <span class="text-muted font-normal">(opcional)</span>
          </label>
          <div v-if="currentFormImage" class="space-y-2">
            <img
              :src="currentFormImage"
              alt="Pré-visualização"
              class="rounded-xl max-h-64 w-auto border border-line"
            />
            <button
              type="button"
              class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              @click="clearImage"
            >
              Remover imagem
            </button>
          </div>
          <label
            v-else
            class="flex items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-8 px-4 cursor-pointer hover:border-brand-300 hover:bg-surface text-sm text-muted transition-colors"
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              @change="onImagePick"
            />
            <span>📷 Clique para escolher uma imagem (JPG/PNG/WebP, máx. 3 MB)</span>
          </label>
        </div>

        <div class="sm:col-span-2 flex items-center justify-end gap-3">
          <button type="button" class="btn-secondary" :disabled="isMutating" @click="closeForm">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="isMutating">
            {{
              uploadingImage
                ? 'Enviando imagem...'
                : isMutating
                  ? 'Salvando...'
                  : form.id
                    ? 'Salvar alterações'
                    : 'Registrar conquista'
            }}
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
        <article class="ach-grid">
          <!-- Avatar -->
          <RouterLink
            v-if="a.recipient"
            :to="{ name: 'profile', params: { id: a.recipient.id } }"
            class="ach-avatar"
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

          <!-- Header: nome + categoria (linha topo) -->
          <div class="ach-header flex items-center gap-2 flex-wrap">
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

          <!-- Body: título, mensagem, imagem, granter, ações mobile -->
          <div class="ach-body min-w-0">
            <p class="text-base font-medium">{{ a.title }}</p>

            <p v-if="a.message" class="mt-1 text-sm text-ink/80 whitespace-pre-line">
              {{ a.message }}
            </p>

            <img
              v-if="a.image_url"
              :src="a.image_url"
              :alt="a.title"
              class="mt-3 rounded-xl max-h-96 w-full sm:w-auto border border-line"
              loading="lazy"
            />

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

            <!-- Curtir -->
            <div class="mt-3 flex items-center gap-1">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-colors"
                :class="
                  isLikedByMe(a)
                    ? 'text-red-500 hover:bg-red-50'
                    : 'text-muted hover:text-red-500 hover:bg-red-50'
                "
                :disabled="toggleLike.isPending.value"
                :aria-label="isLikedByMe(a) ? 'Descurtir' : 'Curtir'"
                @click="handleToggleLike(a)"
              >
                <Heart
                  class="w-4 h-4 transition-transform"
                  :class="isLikedByMe(a) ? 'fill-current scale-110' : ''"
                  :stroke-width="2"
                />
                <span class="font-medium">{{ likeCount(a) || '' }}</span>
              </button>
            </div>

            <!-- Mobile only: ações abaixo do conteúdo -->
            <div
              v-if="canEditOrDelete(a.granted_by_id)"
              class="flex sm:hidden items-center justify-end gap-2 mt-3 pt-3 border-t border-line"
            >
              <button class="btn-ghost text-xs" @click="openEdit(a)">Editar</button>
              <button
                class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                @click="handleDelete(a.id)"
              >
                Excluir
              </button>
            </div>
          </div>

          <!-- Desktop only: ações à direita -->
          <div
            v-if="canEditOrDelete(a.granted_by_id)"
            class="ach-actions hidden sm:flex items-start gap-1"
          >
            <button class="btn-ghost text-xs" @click="openEdit(a)">Editar</button>
            <button
              class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              @click="handleDelete(a.id)"
            >
              Excluir
            </button>
          </div>
        </article>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.ach-grid {
  display: grid;
  gap: 0.5rem 0.75rem;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'avatar header'
    'body   body';
}
.ach-avatar { grid-area: avatar; }
.ach-header { grid-area: header; min-width: 0; align-self: center; }
.ach-body   { grid-area: body; }
.ach-actions { grid-area: actions; }

@media (min-width: 640px) {
  .ach-grid {
    gap: 0.25rem 1rem;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      'avatar header actions'
      'avatar body   actions';
  }
}
</style>
