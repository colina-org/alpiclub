<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAgency, useUpdateAgency, useDeleteAgency } from '@/composables/useAgencies'
import { useTeams } from '@/composables/useTeams'
import { useProfile, useProfiles } from '@/composables/useProfiles'
import { useAllPartners } from '@/composables/useAgencyPartners'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { initials } from '@/lib/format'
import AgencyForm from '@/components/AgencyForm.vue'
import type { Agency } from '@/types/database'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const idOrSlug = computed(() => route.params.idOrSlug as string)

const agencyQuery = useAgency(idOrSlug)
const teamsQuery = useTeams()
const profilesQuery = useProfiles()
const partnersQuery = useAllPartners()
const me = useProfile(computed(() => auth.user?.id))
const updateAgency = useUpdateAgency()
const deleteAgency = useDeleteAgency()

const agencyPartners = computed(() => {
  if (!agencyQuery.data.value) return []
  return (partnersQuery.data.value ?? []).filter(
    (p) => p.agency_id === agencyQuery.data.value!.id,
  )
})

const canManageThisAgency = computed(() => {
  const a = agencyQuery.data.value
  const profile = me.data.value
  if (!a || !profile) return false
  if (profile.app_role === 'admin') return true
  if ((profile.partnerships ?? []).some((p) => p.agency_id === a.id)) return true
  if (profile.is_head && profile.team?.agency?.id === a.id) return true
  return false
})

// Inline edit form
const editFormOpen = ref(false)

function openEdit() {
  editFormOpen.value = true
}

function closeEdit() {
  editFormOpen.value = false
}

async function handleEditSubmit(payload: Omit<Agency, 'id' | 'created_at' | 'updated_at'>) {
  if (!agencyQuery.data.value) return
  try {
    const result = await updateAgency.mutateAsync({
      id: agencyQuery.data.value.id,
      patch: payload,
    })
    ui.pushToast(`Agência "${result.name}" atualizada.`, 'success')
    editFormOpen.value = false
    // If the slug changed, redirect to the new URL.
    if (result.slug !== idOrSlug.value) {
      router.replace({ name: 'agency', params: { idOrSlug: result.slug } })
    }
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error')
  }
}

async function handleDelete() {
  if (!agencyQuery.data.value) return
  const a = agencyQuery.data.value
  if (!confirm(`Excluir a agência "${a.name}"? Só funciona se não houver equipes vinculadas.`)) return
  try {
    await deleteAgency.mutateAsync(a.id)
    ui.pushToast(`Agência "${a.name}" excluída.`, 'success')
    router.push({ name: 'agencies' })
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao excluir.', 'error')
  }
}

// Auto-open form if navigated with ?edit=1
watch(
  [() => route.query.edit, canManageThisAgency],
  ([editFlag, canManage]) => {
    if (editFlag === '1' && canManage) {
      editFormOpen.value = true
      router.replace({ name: 'agency', params: { idOrSlug: idOrSlug.value } })
    }
  },
  { immediate: true },
)

const agencyTeams = computed(() => {
  if (!agencyQuery.data.value) return []
  return (teamsQuery.data.value ?? []).filter(
    (t) => t.agency_id === agencyQuery.data.value!.id,
  )
})

// Top-level teams + their sub-teams (1 nível).
const teamGroups = computed(() => {
  const top = agencyTeams.value.filter((t) => !t.parent_team_id)
  return top.map((parent) => ({
    parent,
    subs: agencyTeams.value.filter((t) => t.parent_team_id === parent.id),
  }))
})

const agencyPeople = computed(() => {
  const teamIds = new Set(agencyTeams.value.map((t) => t.id))
  return (profilesQuery.data.value ?? []).filter(
    (p) => p.team_id && teamIds.has(p.team_id),
  )
})

const headPeople = computed(() => agencyPeople.value.filter((p) => p.is_head))

const accent = computed(() => agencyQuery.data.value?.color ?? '#0d9b6c')

const socialLinks = computed(() => {
  const a = agencyQuery.data.value
  if (!a) return []
  return [
    { label: 'Site', url: a.website_url, icon: '🌐' },
    { label: 'Instagram', url: a.instagram_url, icon: '📷' },
    { label: 'LinkedIn', url: a.linkedin_url, icon: '💼' },
    { label: 'Facebook', url: a.facebook_url, icon: '📘' },
    { label: 'YouTube', url: a.youtube_url, icon: '▶️' },
  ].filter((s) => !!s.url)
})
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <RouterLink
      :to="{ name: 'agencies' }"
      class="text-sm text-muted hover:text-ink inline-flex items-center gap-1.5"
    >
      ← Voltar para Agências
    </RouterLink>

    <div v-if="agencyQuery.isLoading.value" class="card p-12 text-center text-sm text-muted">
      Carregando agência...
    </div>

    <div
      v-else-if="agencyQuery.isError.value"
      class="card p-6 text-sm text-red-700 bg-red-50 border-red-200"
    >
      Erro ao carregar: {{ agencyQuery.error.value?.message }}
    </div>

    <template v-else-if="agencyQuery.data.value">
      <!-- Inline edit form -->
      <div v-if="editFormOpen" class="card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold">Editar agência</h2>
          <button class="btn-ghost text-sm" @click="closeEdit">Cancelar</button>
        </div>
        <AgencyForm
          :agency="agencyQuery.data.value"
          :pending="updateAgency.isPending.value"
          @submit="handleEditSubmit"
          @cancel="closeEdit"
        />
      </div>

      <!-- Institutional header -->
      <header
        class="card p-8 relative overflow-hidden"
        :style="{ borderColor: accent + '30' }"
      >
        <div
          class="absolute inset-0 opacity-5"
          :style="{ background: `radial-gradient(circle at top right, ${accent}, transparent 60%)` }"
        ></div>

        <div class="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div
            class="h-24 w-24 rounded-2xl flex items-center justify-center text-3xl font-bold flex-shrink-0 text-white"
            :style="{ backgroundColor: accent }"
          >
            {{ agencyQuery.data.value.name[0]?.toUpperCase() }}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <h1 class="text-3xl font-semibold tracking-tight">
                {{ agencyQuery.data.value.name }}
              </h1>
              <div v-if="canManageThisAgency" class="flex items-center gap-2">
                <button class="btn-secondary text-sm" @click="openEdit">
                  Editar agência
                </button>
                <button
                  class="btn-ghost text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                  @click="handleDelete"
                >
                  Excluir
                </button>
              </div>
            </div>
            <p
              v-if="agencyQuery.data.value.description"
              class="mt-2 text-sm text-ink/80 max-w-2xl"
            >
              {{ agencyQuery.data.value.description }}
            </p>

            <div v-if="socialLinks.length > 0" class="mt-4 flex flex-wrap gap-2">
              <a
                v-for="link in socialLinks"
                :key="link.label"
                :href="link.url ?? '#'"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-line text-muted hover:text-ink hover:border-brand-300 hover:bg-surface transition-colors"
              >
                <span>{{ link.icon }}</span>
                {{ link.label }}
              </a>
            </div>
          </div>
        </div>
      </header>

      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="card p-5">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Equipes</p>
          <p class="mt-2 text-3xl font-semibold">{{ agencyTeams.length }}</p>
        </div>
        <div class="card p-5">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Colaboradores</p>
          <p class="mt-2 text-3xl font-semibold">{{ agencyPeople.length }}</p>
        </div>
        <div class="card p-5">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Heads</p>
          <p class="mt-2 text-3xl font-semibold">{{ headPeople.length }}</p>
        </div>
      </div>

      <!-- Partners (Sócios) -->
      <section v-if="agencyPartners.length > 0" class="card p-6">
        <h2 class="text-base font-semibold">Sócios</h2>
        <p class="mt-0.5 text-xs text-muted">
          Pessoas que respondem pela agência.
        </p>
        <ul class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <li v-for="p in agencyPartners" :key="p.id">
            <RouterLink
              v-if="p.profile"
              :to="{ name: 'profile', params: { id: p.profile.id } }"
              class="flex items-center gap-3 p-3 border border-amber-200 bg-amber-50/40 rounded-xl hover:border-amber-400 transition-all"
            >
              <img
                v-if="p.profile.avatar_url"
                :src="p.profile.avatar_url"
                :alt="p.profile.full_name ?? p.profile.email"
                class="h-10 w-10 rounded-xl object-cover flex-shrink-0"
              />
              <div
                v-else
                class="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold flex-shrink-0"
              >
                {{ initials(p.profile.full_name, p.profile.email) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium truncate">
                  {{ p.profile.full_name || p.profile.email.split('@')[0] }}
                </p>
                <p class="text-xs text-amber-800">Sócio</p>
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>

      <!-- Teams -->
      <section class="card p-6">
        <h2 class="text-base font-semibold">Equipes</h2>
        <div
          v-if="agencyTeams.length === 0"
          class="mt-4 text-sm text-muted text-center py-8 border border-dashed border-line rounded-xl"
        >
          Nenhuma equipe nesta agência.
        </div>
        <ul v-else class="mt-4 space-y-3">
          <li v-for="group in teamGroups" :key="group.parent.id" class="space-y-2">
            <RouterLink
              :to="{ name: 'structure', query: { team: group.parent.id } }"
              class="block border border-line rounded-xl p-4 hover:border-brand-300 hover:bg-surface transition-all"
            >
              <div class="flex items-center gap-3">
                <span
                  class="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  :style="{
                    backgroundColor: (group.parent.color ?? '#1ACDB8') + '15',
                    color: group.parent.color ?? '#1ACDB8',
                  }"
                >
                  {{ group.parent.name[0]?.toUpperCase() }}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold truncate">{{ group.parent.name }}</p>
                  <p v-if="group.parent.description" class="text-xs text-muted truncate">
                    {{ group.parent.description }}
                  </p>
                </div>
                <span class="text-muted text-xs">Ver estrutura →</span>
              </div>
            </RouterLink>

            <ul v-if="group.subs.length > 0" class="ml-4 pl-4 border-l-2 border-line space-y-2">
              <li v-for="sub in group.subs" :key="sub.id">
                <RouterLink
                  :to="{ name: 'structure', query: { team: sub.id } }"
                  class="block border border-line rounded-xl p-3 hover:border-brand-300 hover:bg-surface transition-all"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-muted text-xs">↳</span>
                    <span
                      class="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      :style="{
                        backgroundColor: (sub.color ?? '#1ACDB8') + '15',
                        color: sub.color ?? '#1ACDB8',
                      }"
                    >
                      {{ sub.name[0]?.toUpperCase() }}
                    </span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{{ sub.name }}</p>
                      <p v-if="sub.description" class="text-xs text-muted truncate">
                        {{ sub.description }}
                      </p>
                    </div>
                    <span class="text-muted text-[11px]">Ver →</span>
                  </div>
                </RouterLink>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <!-- People -->
      <section class="card p-6">
        <h2 class="text-base font-semibold">Pessoas</h2>
        <div
          v-if="agencyPeople.length === 0"
          class="mt-4 text-sm text-muted text-center py-8 border border-dashed border-line rounded-xl"
        >
          Nenhum colaborador nesta agência.
        </div>
        <ul v-else class="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <li v-for="person in agencyPeople" :key="person.id">
            <RouterLink
              :to="{ name: 'profile', params: { id: person.id } }"
              class="flex items-center gap-3 p-3 border border-line rounded-xl hover:border-brand-300 hover:bg-surface transition-all"
            >
              <img
                v-if="person.avatar_url"
                :src="person.avatar_url"
                :alt="person.full_name ?? person.email"
                class="h-10 w-10 rounded-xl object-cover flex-shrink-0"
              />
              <div
                v-else
                class="h-10 w-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold flex-shrink-0"
              >
                {{ initials(person.full_name, person.email) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium truncate">
                  {{ person.full_name || person.email.split('@')[0] }}
                </p>
                <p class="text-xs text-muted truncate">{{ person.position || '—' }}</p>
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
