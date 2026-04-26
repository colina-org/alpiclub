<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useProfiles } from '@/composables/useProfiles'
import { useTeams } from '@/composables/useTeams'
import { useAgencies } from '@/composables/useAgencies'

const profilesQuery = useProfiles()
const teamsQuery = useTeams()
const agenciesQuery = useAgencies()

const search = ref('')
const teamFilter = ref<string>('all')
const agencyFilter = ref<string>('all')

// Teams filtered by selected agency, so the team dropdown only shows relevant options.
const teamsForFilter = computed(() => {
  const teams = teamsQuery.data.value ?? []
  if (agencyFilter.value === 'all' || agencyFilter.value === 'none') return teams
  return teams.filter((t) => t.agency_id === agencyFilter.value)
})

// Reset team filter when agency changes if the selected team no longer applies.
function onAgencyFilterChange() {
  if (teamFilter.value === 'all' || teamFilter.value === 'none') return
  if (!teamsForFilter.value.find((t) => t.id === teamFilter.value)) {
    teamFilter.value = 'all'
  }
}

const filteredProfiles = computed(() => {
  const list = profilesQuery.data.value ?? []
  const q = search.value.trim().toLowerCase()

  return list.filter((p) => {
    const matchesSearch =
      !q ||
      p.full_name?.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.position?.toLowerCase().includes(q)

    const matchesAgency =
      agencyFilter.value === 'all' ||
      (agencyFilter.value === 'none' && !p.team?.agency) ||
      p.team?.agency?.id === agencyFilter.value

    const matchesTeam =
      teamFilter.value === 'all' ||
      (teamFilter.value === 'none' && !p.team_id) ||
      p.team_id === teamFilter.value

    return matchesSearch && matchesAgency && matchesTeam
  })
})

function initials(name: string | null | undefined, fallback: string) {
  const source = (name?.trim() || fallback).split(/\s+/)
  const first = source[0]?.[0] ?? '?'
  const last = source.length > 1 ? source[source.length - 1][0] : ''
  return (first + last).toUpperCase()
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Pessoas</h1>
        <p class="mt-1 text-sm text-muted">
          Colaboradores e equipes da Colina Tech.
        </p>
      </div>
      <p class="text-sm text-muted">
        {{ filteredProfiles.length }}
        {{ filteredProfiles.length === 1 ? 'pessoa' : 'pessoas' }}
      </p>
    </header>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Buscar por nome, e-mail ou cargo..."
        class="input flex-1"
      />
      <select v-model="agencyFilter" class="input sm:w-56" @change="onAgencyFilterChange">
        <option value="all">Todas as agências</option>
        <option value="none">Sem agência</option>
        <option v-for="agency in agenciesQuery.data.value ?? []" :key="agency.id" :value="agency.id">
          {{ agency.name }}
        </option>
      </select>
      <select v-model="teamFilter" class="input sm:w-56">
        <option value="all">Todas as equipes</option>
        <option value="none">Sem equipe</option>
        <option v-for="team in teamsForFilter" :key="team.id" :value="team.id">
          {{ team.name }}
        </option>
      </select>
    </div>

    <!-- States -->
    <div v-if="profilesQuery.isLoading.value" class="card p-12 text-center text-sm text-muted">
      Carregando colaboradores...
    </div>

    <div
      v-else-if="profilesQuery.isError.value"
      class="card p-6 text-sm text-red-700 bg-red-50 border-red-200"
    >
      Erro ao carregar pessoas: {{ profilesQuery.error.value?.message }}
    </div>

    <div
      v-else-if="filteredProfiles.length === 0"
      class="card p-12 text-center text-sm text-muted"
    >
      Nenhum colaborador encontrado.
    </div>

    <!-- Grid -->
    <TransitionGroup
      v-else
      name="list"
      tag="div"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative"
    >
      <RouterLink
        v-for="person in filteredProfiles"
        :key="person.id"
        :to="{ name: 'profile', params: { id: person.id } }"
        class="card p-5 flex flex-col gap-4 hover:shadow-panel hover:border-brand-200 transition-all"
      >
        <div class="flex items-center gap-3">
          <div
            v-if="!person.avatar_url"
            class="h-12 w-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold"
          >
            {{ initials(person.full_name, person.email) }}
          </div>
          <img
            v-else
            :src="person.avatar_url"
            :alt="person.full_name ?? person.email"
            class="h-12 w-12 rounded-full object-cover"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold truncate">
              {{ person.full_name || person.email.split('@')[0] }}
            </p>
            <p class="text-xs text-muted truncate">{{ person.position || '—' }}</p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span
              v-if="person.team"
              class="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg"
              :style="{
                backgroundColor: (person.team.color ?? '#0d9b6c') + '15',
                color: person.team.color ?? '#0d9b6c',
              }"
            >
              <span class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: person.team.color ?? '#0d9b6c' }"></span>
              {{ person.team.name }}
            </span>
            <span
              v-if="person.team?.agency"
              class="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white"
              :style="{ backgroundColor: person.team.agency.color ?? '#0d9b6c' }"
              :title="person.team.agency.name"
            >
              {{ person.team.agency.name }}
            </span>
            <span v-if="!person.team" class="text-xs text-muted">Sem equipe</span>
          </div>

          <div class="flex items-center gap-1 flex-shrink-0">
            <span
              v-if="(person.partnerships?.length ?? 0) > 0"
              class="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md"
              title="Sócio"
            >
              Sócio
            </span>
            <span
              v-if="person.is_head"
              class="text-[10px] font-bold uppercase tracking-wider text-accent-soft bg-brand-700 px-2 py-0.5 rounded-md"
            >
              Head
            </span>
          </div>
        </div>
      </RouterLink>
    </TransitionGroup>
  </div>
</template>
