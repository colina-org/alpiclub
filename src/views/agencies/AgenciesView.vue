<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAgencies } from '@/composables/useAgencies'
import { useTeams } from '@/composables/useTeams'
import { useProfile, useProfiles } from '@/composables/useProfiles'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const agenciesQuery = useAgencies()
const teamsQuery = useTeams()
const profilesQuery = useProfiles()

const me = useProfile(computed(() => auth.user?.id))
const isAdmin = computed(() => me.data.value?.app_role === 'admin')

// Pode editar a agência: admin OU sócio dessa agência OU Head de equipe nessa agência.
function canManageAgency(agencyId: string): boolean {
  if (isAdmin.value) return true
  const profile = me.data.value
  if (!profile) return false
  if ((profile.partnerships ?? []).some((p) => p.agency_id === agencyId)) return true
  if (profile.is_head && profile.team?.agency?.id === agencyId) return true
  return false
}

function editAgency(slug: string) {
  router.push({ name: 'agency', params: { idOrSlug: slug }, query: { edit: '1' } })
}

function statsFor(agencyId: string) {
  const teams = (teamsQuery.data.value ?? []).filter((t) => t.agency_id === agencyId)
  const teamIds = new Set(teams.map((t) => t.id))
  const people = (profilesQuery.data.value ?? []).filter(
    (p) => p.team_id && teamIds.has(p.team_id),
  )
  return { teams: teams.length, people: people.length }
}

const sortedAgencies = computed(() => {
  // Colina Tech first (a matriz/holding), then alphabetical.
  const list = [...(agenciesQuery.data.value ?? [])]
  return list.sort((a, b) => {
    if (a.slug === 'colina-tech') return -1
    if (b.slug === 'colina-tech') return 1
    return a.name.localeCompare(b.name)
  })
})
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">Agências</h1>
      <p class="mt-1 text-sm text-muted">
        As marcas que fazem parte da holding Colina Tech.
      </p>
    </header>

    <div v-if="agenciesQuery.isLoading.value" class="card p-12 text-center text-sm text-muted">
      Carregando agências...
    </div>

    <div
      v-else-if="(sortedAgencies.length ?? 0) === 0"
      class="card p-12 text-center text-sm text-muted"
    >
      Nenhuma agência cadastrada ainda.
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <RouterLink
        v-for="agency in sortedAgencies"
        :key="agency.id"
        :to="{ name: 'agency', params: { idOrSlug: agency.slug } }"
        class="card p-6 hover:shadow-panel hover:border-brand-200 transition-all flex flex-col gap-4 relative"
      >
        <button
          v-if="canManageAgency(agency.id)"
          type="button"
          class="absolute top-3 right-3 text-xs font-medium px-2 py-1 rounded-lg text-muted hover:text-ink hover:bg-surface transition-colors"
          aria-label="Editar agência"
          @click.prevent.stop="editAgency(agency.slug)"
        >
          Editar
        </button>
        <div class="flex items-center gap-4">
          <div
            class="h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-xl flex-shrink-0 text-white"
            :style="{ backgroundColor: agency.color ?? '#0d9b6c' }"
          >
            {{ agency.name[0]?.toUpperCase() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-base font-semibold truncate">{{ agency.name }}</p>
            <p v-if="agency.website_url" class="text-xs text-muted truncate">
              {{ agency.website_url.replace(/^https?:\/\//, '') }}
            </p>
          </div>
        </div>

        <p v-if="agency.description" class="text-sm text-ink/80 line-clamp-2">
          {{ agency.description }}
        </p>

        <div class="mt-auto pt-3 border-t border-line flex items-center justify-between text-xs text-muted">
          <span>
            <strong class="text-ink">{{ statsFor(agency.id).teams }}</strong>
            {{ statsFor(agency.id).teams === 1 ? 'equipe' : 'equipes' }}
          </span>
          <span>
            <strong class="text-ink">{{ statsFor(agency.id).people }}</strong>
            {{ statsFor(agency.id).people === 1 ? 'colaborador' : 'colaboradores' }}
          </span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
