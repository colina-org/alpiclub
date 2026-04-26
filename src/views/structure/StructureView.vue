<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useProfiles } from '@/composables/useProfiles'
import { useTeams } from '@/composables/useTeams'
import { useAgencies } from '@/composables/useAgencies'
import { useAuthStore } from '@/stores/auth'
import type { ProfileWithTeam } from '@/types/database'

const route = useRoute()
const auth = useAuthStore()
const profilesQuery = useProfiles()
const teamsQuery = useTeams()
const agenciesQuery = useAgencies()

const selectedAgencyId = ref<string | null>(null)
const selectedTeamId = ref<string | null>(null)

// Auto-seleção: prioriza ?team=<id> da URL > equipe do próprio usuário > primeira agência.
watch(
  [
    agenciesQuery.data,
    teamsQuery.data,
    () => route.query.team,
    () => auth.profile?.team_id,
  ],
  ([agencies, teams, queryTeamId, myTeamId]) => {
    // Caso 1: vem com ?team=<id> da URL (link explícito de outra tela).
    if (queryTeamId && teams) {
      const team = teams.find((t) => t.id === queryTeamId)
      if (team) {
        selectedAgencyId.value = team.agency_id
        selectedTeamId.value = team.id
        return
      }
    }
    // Caso 2: usuário está numa equipe → abre na equipe dele.
    if (!selectedAgencyId.value && myTeamId && teams) {
      const myTeam = teams.find((t) => t.id === myTeamId)
      if (myTeam) {
        selectedAgencyId.value = myTeam.agency_id
        selectedTeamId.value = myTeam.id
        return
      }
    }
    // Caso 3: fallback — primeira agência (Colina Tech).
    if (!selectedAgencyId.value && agencies && agencies.length > 0) {
      const sorted = [...agencies].sort((a, b) => {
        if (a.slug === 'colina-tech') return -1
        if (b.slug === 'colina-tech') return 1
        return a.name.localeCompare(b.name)
      })
      selectedAgencyId.value = sorted[0].id
    }
  },
  { immediate: true },
)

// Teams that belong to the selected agency.
const teamsInAgency = computed(() => {
  if (!selectedAgencyId.value) return []
  return (teamsQuery.data.value ?? []).filter(
    (t) => t.agency_id === selectedAgencyId.value,
  )
})

// Equipes da agência ordenadas por hierarquia (raiz seguida de suas sub-equipes).
const teamsInAgencyOrdered = computed(() => {
  const all = teamsInAgency.value
  const tops = all.filter((t) => !t.parent_team_id)
  const result: Array<{ team: typeof all[number]; depth: number }> = []
  for (const top of tops) {
    result.push({ team: top, depth: 0 })
    for (const sub of all.filter((t) => t.parent_team_id === top.id)) {
      result.push({ team: sub, depth: 1 })
    }
  }
  // Equipes órfãs (parent não está na agência — não deveria acontecer, mas seguro).
  for (const orphan of all.filter(
    (t) => t.parent_team_id && !tops.find((p) => p.id === t.parent_team_id),
  )) {
    result.push({ team: orphan, depth: 1 })
  }
  return result
})

// Auto-select the first team of the selected agency.
watch(
  [() => selectedAgencyId.value, teamsInAgency],
  ([_, teams]) => {
    if (teams.length === 0) {
      selectedTeamId.value = null
      return
    }
    if (!selectedTeamId.value || !teams.find((t) => t.id === selectedTeamId.value)) {
      selectedTeamId.value = teams[0].id
    }
  },
  { immediate: true },
)

const selectedAgency = computed(
  () => agenciesQuery.data.value?.find((a) => a.id === selectedAgencyId.value) ?? null,
)

const selectedTeam = computed(() => {
  return teamsInAgency.value.find((t) => t.id === selectedTeamId.value) ?? null
})

const teamMembers = computed<ProfileWithTeam[]>(() => {
  if (!selectedTeamId.value) return []
  return (profilesQuery.data.value ?? []).filter((p) => p.team_id === selectedTeamId.value)
})

const head = computed(() => teamMembers.value.find((p) => p.is_head) ?? null)
const leads = computed(() => teamMembers.value.filter((p) => p.is_lead))
const members = computed(() =>
  teamMembers.value.filter((p) => !p.is_head && !p.is_lead),
)

function initials(name: string | null | undefined, fallback: string) {
  const source = (name?.trim() || fallback).split(/\s+/)
  const first = source[0]?.[0] ?? '?'
  const last = source.length > 1 ? source[source.length - 1][0] : ''
  return (first + last).toUpperCase()
}

const accentColor = computed(() => selectedTeam.value?.color ?? '#0d9b6c')
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Estrutura</h1>
        <p class="mt-1 text-sm text-muted">
          Organograma das equipes e operações.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div class="sm:w-56">
          <label class="block text-xs font-medium text-muted mb-1.5">Agência</label>
          <select v-model="selectedAgencyId" class="input">
            <option :value="null" disabled>Selecione uma agência</option>
            <option v-for="agency in agenciesQuery.data.value ?? []" :key="agency.id" :value="agency.id">
              {{ agency.name }}
            </option>
          </select>
        </div>
        <div class="sm:w-56">
          <label class="block text-xs font-medium text-muted mb-1.5">Equipe</label>
          <select v-model="selectedTeamId" class="input" :disabled="teamsInAgency.length === 0">
            <option v-if="teamsInAgency.length === 0" :value="null" disabled>
              Sem equipes nesta agência
            </option>
            <option :value="null" disabled>Selecione uma equipe</option>
            <option
              v-for="entry in teamsInAgencyOrdered"
              :key="entry.team.id"
              :value="entry.team.id"
            >
              {{ entry.depth > 0 ? '↳ ' : '' }}{{ entry.team.name }}
            </option>
          </select>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div
      v-if="profilesQuery.isLoading.value || teamsQuery.isLoading.value"
      class="card p-12 text-center text-sm text-muted"
    >
      Carregando organograma...
    </div>

    <!-- No teams at all -->
    <div
      v-else-if="(teamsQuery.data.value?.length ?? 0) === 0"
      class="card p-12 text-center"
    >
      <p class="text-sm text-muted">Nenhuma equipe cadastrada ainda.</p>
      <RouterLink :to="{ name: 'admin' }" class="btn-primary mt-4 inline-flex">
        Criar primeira equipe
      </RouterLink>
    </div>

    <!-- Team selected, render org chart -->
    <template v-else-if="selectedTeam">
      <div
        class="card p-6 lg:p-10"
        :style="{ borderColor: accentColor + '30' }"
      >
        <!-- Team header -->
        <div class="text-center mb-10">
          <div class="flex items-center justify-center gap-2 flex-wrap">
            <span
              v-if="selectedAgency"
              class="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
              :style="{ backgroundColor: selectedAgency.color ?? '#0d9b6c' }"
            >
              {{ selectedAgency.name }}
            </span>
            <span
              class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full"
              :style="{
                backgroundColor: accentColor + '15',
                color: accentColor,
              }"
            >
              <span class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: accentColor }"></span>
              {{ selectedTeam.name }}
            </span>
          </div>
          <p v-if="selectedTeam.description" class="mt-3 text-sm text-muted max-w-md mx-auto">
            {{ selectedTeam.description }}
          </p>
        </div>

        <!-- Empty team -->
        <div
          v-if="teamMembers.length === 0"
          class="text-center text-sm text-muted py-12 border border-dashed border-line rounded-xl"
        >
          Nenhum colaborador atribuído a esta equipe.
        </div>

        <template v-else>
          <!-- HEAD -->
          <div class="flex flex-col items-center">
            <template v-if="head">
              <RouterLink
                :to="{ name: 'profile', params: { id: head.id } }"
                class="org-card org-card--head group"
                :style="{ borderColor: accentColor }"
              >
                <div
                  v-if="!head.avatar_url"
                  class="org-avatar org-avatar--lg"
                  :style="{ backgroundColor: accentColor + '20', color: accentColor }"
                >
                  {{ initials(head.full_name, head.email) }}
                </div>
                <img
                  v-else
                  :src="head.avatar_url"
                  :alt="head.full_name ?? head.email"
                  class="org-avatar org-avatar--lg !p-0 object-cover"
                />
                <div class="text-center mt-3">
                  <p class="text-sm font-semibold">
                    {{ head.full_name || head.email.split('@')[0] }}
                  </p>
                  <p class="text-xs text-muted mt-0.5">{{ head.position || '—' }}</p>
                </div>
                <span
                  class="mt-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                  :style="{ backgroundColor: accentColor, color: '#fff' }"
                >
                  Head
                </span>
              </RouterLink>
            </template>
            <div
              v-else
              class="org-card org-card--head border-dashed text-center text-xs text-muted py-8 px-10"
            >
              Sem Head definido
            </div>
          </div>

          <!-- LEADS -->
          <div v-if="leads.length > 0" class="mt-2">
            <!-- vertical connector from head -->
            <div class="flex justify-center">
              <span class="block w-px h-8 bg-line"></span>
            </div>
            <!-- horizontal connector + leads row -->
            <div class="relative pt-8">
              <div class="absolute top-0 left-0 right-0 flex justify-center">
                <div class="h-px bg-line" :style="{ width: leads.length > 1 ? '70%' : '0' }"></div>
              </div>
              <div class="flex flex-wrap justify-center gap-6">
                <div
                  v-for="lead in leads"
                  :key="lead.id"
                  class="flex flex-col items-center"
                >
                  <span class="block w-px h-8 bg-line -mt-8"></span>
                  <RouterLink
                    :to="{ name: 'profile', params: { id: lead.id } }"
                    class="org-card org-card--lead"
                  >
                    <div
                      v-if="!lead.avatar_url"
                      class="org-avatar org-avatar--md"
                      :style="{ backgroundColor: accentColor + '15', color: accentColor }"
                    >
                      {{ initials(lead.full_name, lead.email) }}
                    </div>
                    <img
                      v-else
                      :src="lead.avatar_url"
                      :alt="lead.full_name ?? lead.email"
                      class="org-avatar org-avatar--md !p-0 object-cover"
                    />
                    <div class="text-center mt-2">
                      <p class="text-sm font-semibold">
                        {{ lead.full_name || lead.email.split('@')[0] }}
                      </p>
                      <p class="text-xs text-muted mt-0.5">{{ lead.position || '—' }}</p>
                    </div>
                    <span
                      class="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted bg-surface px-2 py-0.5 rounded-md"
                    >
                      Líder
                    </span>
                  </RouterLink>
                </div>
              </div>
            </div>
          </div>

          <!-- MEMBERS -->
          <div v-if="members.length > 0" class="mt-12">
            <div class="flex items-center gap-3 mb-5">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted">
                Membros
              </span>
              <span class="text-xs text-muted">{{ members.length }}</span>
              <span class="flex-1 h-px bg-line"></span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <RouterLink
                v-for="member in members"
                :key="member.id"
                :to="{ name: 'profile', params: { id: member.id } }"
                class="org-card org-card--member"
              >
                <div
                  v-if="!member.avatar_url"
                  class="org-avatar org-avatar--sm"
                >
                  {{ initials(member.full_name, member.email) }}
                </div>
                <img
                  v-else
                  :src="member.avatar_url"
                  :alt="member.full_name ?? member.email"
                  class="org-avatar org-avatar--sm !p-0 object-cover"
                />
                <p class="mt-2 text-xs font-medium text-center truncate w-full">
                  {{ member.full_name || member.email.split('@')[0] }}
                </p>
                <p class="text-[11px] text-muted text-center truncate w-full">
                  {{ member.position || '—' }}
                </p>
              </RouterLink>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.org-card {
  @apply flex flex-col items-center p-4 rounded-2xl bg-panel border border-line transition-all hover:shadow-panel;
}
.org-card--head {
  @apply border-2 px-8 py-5 min-w-[220px];
}
.org-card--lead {
  @apply px-5 py-4 min-w-[180px];
}
.org-card--member {
  @apply p-3;
}
.org-avatar {
  @apply rounded-2xl flex items-center justify-center font-bold bg-brand-100 text-brand-700;
}
.org-avatar--lg {
  @apply h-16 w-16 text-xl;
}
.org-avatar--md {
  @apply h-12 w-12 text-base;
}
.org-avatar--sm {
  @apply h-10 w-10 text-sm;
}
</style>
