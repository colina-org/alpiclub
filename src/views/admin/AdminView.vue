<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from '@/composables/useTeams'
import {
  useAgencies,
  useCreateAgency,
  useUpdateAgency,
  useDeleteAgency,
} from '@/composables/useAgencies'
import {
  useAllPartners,
  useAddPartner,
  useRemovePartner,
} from '@/composables/useAgencyPartners'
import {
  useProfile,
  useProfiles,
  useArchivedProfiles,
} from '@/composables/useProfiles'
import { useArchiveUser } from '@/composables/useArchiveUser'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { supabase } from '@/lib/supabase'
import type { Agency } from '@/types/database'
import AgencyForm from '@/components/AgencyForm.vue'
import { initials } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

// ---------------------------------------------------------------------
// Permission gate — só admin
// ---------------------------------------------------------------------
const me = useProfile(computed(() => auth.user?.id))
const isAdmin = computed(() => me.data.value?.app_role === 'admin')

// ---------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------
const agenciesQuery = useAgencies()
const createAgency = useCreateAgency()
const updateAgency = useUpdateAgency()
const deleteAgency = useDeleteAgency()

const teamsQuery = useTeams()
const createTeam = useCreateTeam()
const updateTeam = useUpdateTeam()
const deleteTeam = useDeleteTeam()

const profilesQuery = useProfiles()
const partnersQuery = useAllPartners()
const addPartner = useAddPartner()
const removePartner = useRemovePartner()

// ---------------------------------------------------------------------
// Agency form
// ---------------------------------------------------------------------
const agencyFormOpen = ref(false)
const editingAgency = ref<Agency | null>(null)

function openCreateAgency() {
  editingAgency.value = null
  agencyFormOpen.value = true
}

function openEditAgency(a: Agency) {
  editingAgency.value = a
  agencyFormOpen.value = true
}

async function handleAgencySubmit(payload: Omit<Agency, 'id' | 'created_at' | 'updated_at'>) {
  try {
    if (editingAgency.value) {
      await updateAgency.mutateAsync({ id: editingAgency.value.id, patch: payload })
      ui.pushToast(`Agência "${payload.name}" atualizada.`, 'success')
    } else {
      await createAgency.mutateAsync(payload)
      ui.pushToast(`Agência "${payload.name}" criada.`, 'success')
    }
    agencyFormOpen.value = false
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao salvar agência.', 'error')
  }
}

async function handleDeleteAgency(a: Agency) {
  if (!confirm(`Excluir a agência "${a.name}"? Só funciona se não houver equipes vinculadas.`)) return
  try {
    await deleteAgency.mutateAsync(a.id)
    ui.pushToast(`Agência "${a.name}" excluída.`, 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao excluir agência.', 'error')
  }
}

// Auto-open edit when navigated with ?edit=<agency-id>
watch(
  [() => route.query.edit, () => agenciesQuery.data.value, isAdmin],
  ([editId, agencies, admin]) => {
    if (!admin || !editId || !agencies) return
    const target = agencies.find((a) => a.id === editId)
    if (target) {
      openEditAgency(target)
      router.replace({ name: 'admin' })
    }
  },
  { immediate: true },
)

// ---------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------
const emptyTeamForm = () => ({
  id: null as string | null,
  name: '',
  description: '',
  color: '#1ACDB8',
  agency_id: '',
  parent_team_id: '',
})

const teamForm = ref(emptyTeamForm())

function onTeamAgencyChange() {
  // Trocou de agência → limpa parent (parents são por agência).
  teamForm.value.parent_team_id = ''
}

function openEditTeam(team: { id: string; name: string; description: string | null; color: string | null; agency_id: string; parent_team_id: string | null }) {
  teamForm.value = {
    id: team.id,
    name: team.name,
    description: team.description ?? '',
    color: team.color ?? '#1ACDB8',
    agency_id: team.agency_id,
    parent_team_id: team.parent_team_id ?? '',
  }
  // Scroll suave para o form (que está logo acima da lista).
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      document.getElementById('team-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }
}

function cancelTeamEdit() {
  teamForm.value = emptyTeamForm()
}

async function handleSubmitTeam() {
  if (!teamForm.value.name.trim() || !teamForm.value.agency_id) return
  const payload = {
    name: teamForm.value.name.trim(),
    description: teamForm.value.description.trim() || null,
    color: teamForm.value.color,
    agency_id: teamForm.value.agency_id,
    parent_team_id: teamForm.value.parent_team_id || null,
  }
  try {
    if (teamForm.value.id) {
      await updateTeam.mutateAsync({ id: teamForm.value.id, patch: payload })
      ui.pushToast(`Equipe "${payload.name}" atualizada.`, 'success')
    } else {
      await createTeam.mutateAsync(payload)
      ui.pushToast(`Equipe "${payload.name}" criada.`, 'success')
    }
    teamForm.value = emptyTeamForm()
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao salvar equipe.', 'error')
  }
}

const isTeamMutating = computed(
  () => createTeam.isPending.value || updateTeam.isPending.value,
)

async function handleDeleteTeam(id: string, name: string) {
  if (!confirm(`Excluir a equipe "${name}"?`)) return
  try {
    await deleteTeam.mutateAsync(id)
    ui.pushToast(`Equipe "${name}" excluída.`, 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao excluir equipe.', 'error')
  }
}

// ---------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------
function partnersOfAgency(agencyId: string) {
  return (partnersQuery.data.value ?? []).filter((p) => p.agency_id === agencyId)
}

function eligibleProfilesFor(agencyId: string) {
  const existing = new Set(partnersOfAgency(agencyId).map((p) => p.profile_id))
  return (profilesQuery.data.value ?? []).filter((p) => !existing.has(p.id))
}

const partnerSelectedProfile = ref<Record<string, string>>({})

async function handleAddPartner(agencyId: string) {
  const profileId = partnerSelectedProfile.value[agencyId]
  if (!profileId) return
  try {
    await addPartner.mutateAsync({ agency_id: agencyId, profile_id: profileId })
    ui.pushToast('Sócio adicionado.', 'success')
    partnerSelectedProfile.value[agencyId] = ''
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao adicionar sócio.', 'error')
  }
}

async function handleRemovePartner(id: string, name: string) {
  if (!confirm(`Remover ${name} como sócio?`)) return
  try {
    await removePartner.mutateAsync(id)
    ui.pushToast('Sócio removido.', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao remover sócio.', 'error')
  }
}

const isAgencyMutating = computed(
  () => createAgency.isPending.value || updateAgency.isPending.value,
)

// ---------------------------------------------------------------------
// Team form helpers (sub-equipes)
// ---------------------------------------------------------------------
// Lista equipes-pai disponíveis para uma agência selecionada (somente top-level).
function topLevelTeamsOfAgency(agencyId: string) {
  return (teamsQuery.data.value ?? []).filter(
    (t) => t.agency_id === agencyId && t.parent_team_id == null,
  )
}

// ---------------------------------------------------------------------
// Archived people
// ---------------------------------------------------------------------
const archivedQuery = useArchivedProfiles()
const archiveUser = useArchiveUser()

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

async function handleUnarchive(profileId: string, name: string) {
  if (!confirm(`Desarquivar ${name}? O acesso será restaurado.`)) return
  try {
    await archiveUser.mutateAsync({ profileId, archive: false })
    ui.pushToast('Pessoa desarquivada.', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao desarquivar.', 'error')
  }
}

// ---------------------------------------------------------------------
// Invite user (chama a Edge Function 'invite-user')
// ---------------------------------------------------------------------
const inviteForm = ref({
  email: '',
  full_name: '',
  agency_id: '',
  team_id: '',
  position: '',
})
const inviting = ref(false)

const inviteTeamsForAgency = computed(() => {
  if (!inviteForm.value.agency_id) return []
  return (teamsQuery.data.value ?? []).filter(
    (t) => t.agency_id === inviteForm.value.agency_id,
  )
})

function onInviteAgencyChange() {
  // Limpa equipe se trocou de agência.
  if (inviteForm.value.team_id && !inviteTeamsForAgency.value.find((t) => t.id === inviteForm.value.team_id)) {
    inviteForm.value.team_id = ''
  }
}

async function handleInviteUser() {
  if (!inviteForm.value.email.trim() || !inviteForm.value.email.includes('@')) {
    ui.pushToast('Informe um e-mail válido.', 'error')
    return
  }
  inviting.value = true
  try {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email: inviteForm.value.email.trim(),
        full_name: inviteForm.value.full_name.trim(),
        team_id: inviteForm.value.team_id || undefined,
        position: inviteForm.value.position.trim() || undefined,
      },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    ui.pushToast(`Convite enviado para ${inviteForm.value.email}.`, 'success')
    inviteForm.value = {
      email: '',
      full_name: '',
      agency_id: '',
      team_id: '',
      position: '',
    }
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao enviar convite.',
      'error',
    )
  } finally {
    inviting.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">Administração</h1>
      <p class="mt-1 text-sm text-muted">
        Gestão de agências, sócios, equipes e configurações da plataforma.
      </p>
    </header>

    <!-- Permission gate -->
    <div
      v-if="!me.isLoading.value && !isAdmin"
      class="card p-12 text-center space-y-3"
    >
      <p class="text-base font-semibold">Sem permissão</p>
      <p class="text-sm text-muted max-w-md mx-auto">
        Esta área é restrita a administradores. Sócios e Heads podem editar suas
        próprias agências direto na página de cada agência.
      </p>
    </div>

    <template v-else-if="isAdmin">
      <!-- ===================================================== -->
      <!-- INVITE USER -->
      <!-- ===================================================== -->
      <section class="space-y-4">
        <div>
          <h2 class="text-lg font-semibold">Convidar usuário</h2>
          <p class="text-xs text-muted">
            Envie um convite por e-mail. A pessoa cria a senha no primeiro acesso.
          </p>
        </div>

        <form class="card p-6 space-y-4" @submit.prevent="handleInviteUser">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">E-mail</label>
              <input
                v-model="inviteForm.email"
                type="email"
                required
                class="input"
                placeholder="pessoa@colinatech.com.br"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">
                Nome <span class="text-muted font-normal">(opcional)</span>
              </label>
              <input
                v-model="inviteForm.full_name"
                type="text"
                maxlength="120"
                class="input"
                placeholder="Maria Silva"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">
                Agência <span class="text-muted font-normal">(opcional)</span>
              </label>
              <select
                v-model="inviteForm.agency_id"
                class="input"
                @change="onInviteAgencyChange"
              >
                <option value="">—</option>
                <option v-for="a in agenciesQuery.data.value ?? []" :key="a.id" :value="a.id">
                  {{ a.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">
                Equipe <span class="text-muted font-normal">(opcional)</span>
              </label>
              <select
                v-model="inviteForm.team_id"
                class="input"
                :disabled="!inviteForm.agency_id"
              >
                <option value="">—</option>
                <option v-for="t in inviteTeamsForAgency" :key="t.id" :value="t.id">
                  {{ t.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">
                Cargo <span class="text-muted font-normal">(opcional)</span>
              </label>
              <input
                v-model="inviteForm.position"
                type="text"
                maxlength="80"
                class="input"
                placeholder="Ex.: Tech Lead"
              />
            </div>
          </div>

          <div class="flex justify-end">
            <button type="submit" class="btn-primary" :disabled="inviting">
              {{ inviting ? 'Enviando...' : 'Enviar convite' }}
            </button>
          </div>
        </form>
      </section>

      <!-- ===================================================== -->
      <!-- AGENCIES -->
      <!-- ===================================================== -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">Agências</h2>
            <p class="text-xs text-muted">
              Marcas que compõem a holding (Colina Tech, Larco, Buzco...).
            </p>
          </div>
          <button v-if="!agencyFormOpen" class="btn-primary text-sm" @click="openCreateAgency">
            Nova agência
          </button>
        </div>

        <div v-if="agencyFormOpen" class="card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold">
              {{ editingAgency ? 'Editar agência' : 'Nova agência' }}
            </h3>
            <button class="btn-ghost text-sm" @click="agencyFormOpen = false">Cancelar</button>
          </div>
          <AgencyForm
            :agency="editingAgency"
            :pending="isAgencyMutating"
            @submit="handleAgencySubmit"
            @cancel="agencyFormOpen = false"
          />
        </div>

        <div class="card p-6">
          <p class="text-xs text-muted">
            {{ agenciesQuery.data.value?.length ?? 0 }}
            {{ agenciesQuery.data.value?.length === 1 ? 'agência cadastrada' : 'agências cadastradas' }}.
          </p>

          <div v-if="agenciesQuery.isLoading.value" class="mt-6 text-sm text-muted text-center py-8">
            Carregando...
          </div>

          <ul v-else class="mt-5 divide-y divide-line">
            <li
              v-for="agency in agenciesQuery.data.value"
              :key="agency.id"
              class="py-3 flex items-center gap-3"
            >
              <span
                class="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold flex-shrink-0 text-white"
                :style="{ backgroundColor: agency.color ?? '#1ACDB8' }"
              >
                {{ agency.name[0]?.toUpperCase() }}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ agency.name }}</p>
                <p class="text-xs text-muted truncate">/{{ agency.slug }}</p>
              </div>
              <button class="btn-ghost text-xs" @click="openEditAgency(agency)">Editar</button>
              <button
                class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                @click="handleDeleteAgency(agency)"
              >
                Excluir
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- ===================================================== -->
      <!-- PARTNERS -->
      <!-- ===================================================== -->
      <section class="space-y-4">
        <div>
          <h2 class="text-lg font-semibold">Sócios</h2>
          <p class="text-xs text-muted">
            Sócios de cada agência ganham permissões especiais (editar a agência, gerenciar PDI dos Heads).
          </p>
        </div>

        <div class="card p-6 space-y-5">
          <div
            v-if="(agenciesQuery.data.value?.length ?? 0) === 0"
            class="text-sm text-muted text-center py-8"
          >
            Cadastre uma agência primeiro.
          </div>

          <div
            v-for="agency in agenciesQuery.data.value"
            :key="agency.id"
            class="border border-line rounded-2xl p-4 space-y-3"
          >
            <div class="flex items-center gap-3">
              <span
                class="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                :style="{ backgroundColor: agency.color ?? '#1ACDB8' }"
              >
                {{ agency.name[0]?.toUpperCase() }}
              </span>
              <h3 class="text-sm font-semibold flex-1">{{ agency.name }}</h3>
              <span class="text-xs text-muted">
                {{ partnersOfAgency(agency.id).length }}
                {{ partnersOfAgency(agency.id).length === 1 ? 'sócio' : 'sócios' }}
              </span>
            </div>

            <ul v-if="partnersOfAgency(agency.id).length > 0" class="flex flex-wrap gap-2">
              <li
                v-for="p in partnersOfAgency(agency.id)"
                :key="p.id"
                class="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200"
              >
                <span class="font-medium">
                  {{ p.profile?.full_name || p.profile?.email?.split('@')[0] || 'Removido' }}
                </span>
                <button
                  class="text-amber-700 hover:text-amber-900"
                  title="Remover"
                  @click="handleRemovePartner(p.id, p.profile?.full_name ?? p.profile?.email ?? 'sócio')"
                >×</button>
              </li>
            </ul>

            <div class="flex gap-2">
              <select v-model="partnerSelectedProfile[agency.id]" class="input flex-1 text-sm">
                <option value="">Selecione uma pessoa...</option>
                <option v-for="p in eligibleProfilesFor(agency.id)" :key="p.id" :value="p.id">
                  {{ p.full_name || p.email.split('@')[0] }}
                </option>
              </select>
              <button
                class="btn-secondary text-sm"
                :disabled="!partnerSelectedProfile[agency.id] || addPartner.isPending.value"
                @click="handleAddPartner(agency.id)"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================================================== -->
      <!-- ARCHIVED PEOPLE -->
      <!-- ===================================================== -->
      <section class="space-y-4">
        <div>
          <h2 class="text-lg font-semibold">Pessoas arquivadas</h2>
          <p class="text-xs text-muted">
            Quem saiu da empresa. Histórico (conquistas, livros, PDIs) fica preservado, mas o acesso é revogado.
          </p>
        </div>

        <div class="card p-6">
          <div v-if="archivedQuery.isLoading.value" class="text-sm text-muted text-center py-8">
            Carregando...
          </div>

          <div
            v-else-if="(archivedQuery.data.value?.length ?? 0) === 0"
            class="text-sm text-muted text-center py-8"
          >
            Ninguém arquivado no momento.
          </div>

          <ul v-else class="divide-y divide-line">
            <li
              v-for="p in archivedQuery.data.value"
              :key="p.id"
              class="py-3 flex items-center gap-3"
            >
              <img
                v-if="p.avatar_url"
                :src="p.avatar_url"
                :alt="p.full_name ?? p.email"
                class="h-10 w-10 rounded-xl object-cover flex-shrink-0 grayscale opacity-70"
              />
              <div
                v-else
                class="h-10 w-10 rounded-xl bg-surface text-muted flex items-center justify-center text-sm font-bold flex-shrink-0"
              >
                {{ initials(p.full_name, p.email) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">
                  {{ p.full_name || p.email.split('@')[0] }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ p.position || '—' }} · arquivada em {{ formatDateTime(p.archived_at) }}
                </p>
              </div>
              <RouterLink
                :to="{ name: 'profile', params: { id: p.id } }"
                class="btn-ghost text-xs"
              >
                Ver perfil
              </RouterLink>
              <button
                class="btn-secondary text-xs"
                :disabled="archiveUser.isPending.value"
                @click="handleUnarchive(p.id, p.full_name ?? p.email)"
              >
                Desarquivar
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- ===================================================== -->
      <!-- TEAMS -->
      <!-- ===================================================== -->
      <section class="space-y-4">
        <div>
          <h2 class="text-lg font-semibold">Equipes</h2>
          <p class="text-xs text-muted">
            Operações dentro de cada agência (ex.: "Tecnologia" da Colina Tech).
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div id="team-form-card" class="card p-6 lg:col-span-1">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold">
                {{ teamForm.id ? 'Editar equipe' : 'Nova equipe' }}
              </h3>
              <button
                v-if="teamForm.id"
                class="btn-ghost text-xs"
                type="button"
                @click="cancelTeamEdit"
              >
                Cancelar
              </button>
            </div>

            <form class="mt-5 space-y-4" @submit.prevent="handleSubmitTeam">
              <div>
                <label class="block text-sm font-medium mb-1.5">Agência</label>
                <select
                  v-model="teamForm.agency_id"
                  required
                  class="input"
                  @change="onTeamAgencyChange"
                >
                  <option value="" disabled>Selecione uma agência</option>
                  <option v-for="a in agenciesQuery.data.value ?? []" :key="a.id" :value="a.id">{{ a.name }}</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1.5">
                  Equipe-pai <span class="text-muted font-normal">(opcional)</span>
                </label>
                <select
                  v-model="teamForm.parent_team_id"
                  class="input"
                  :disabled="!teamForm.agency_id"
                >
                  <option value="">— Equipe raiz</option>
                  <option
                    v-for="t in topLevelTeamsOfAgency(teamForm.agency_id)"
                    :key="t.id"
                    :value="t.id"
                  >
                    {{ t.name }}
                  </option>
                </select>
                <p class="mt-1 text-xs text-muted">
                  Selecione uma equipe para criar como sub-equipe dela.
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1.5">Nome</label>
                <input v-model="teamForm.name" type="text" required maxlength="60" class="input" placeholder="Tecnologia" />
              </div>

              <div>
                <label class="block text-sm font-medium mb-1.5">
                  Descrição <span class="text-muted font-normal">(opcional)</span>
                </label>
                <textarea v-model="teamForm.description" rows="2" class="input resize-none" placeholder="Time responsável por..."></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1.5">Cor</label>
                <div class="flex items-center gap-3">
                  <input v-model="teamForm.color" type="color" class="h-10 w-14 rounded-lg border border-line cursor-pointer bg-panel" />
                  <code class="text-xs text-muted">{{ teamForm.color }}</code>
                </div>
              </div>

              <button type="submit" class="btn-primary w-full" :disabled="isTeamMutating">
                {{
                  isTeamMutating
                    ? 'Salvando...'
                    : teamForm.id
                      ? 'Salvar alterações'
                      : 'Criar equipe'
                }}
              </button>
            </form>
          </div>

          <div class="card p-6 lg:col-span-2">
            <h3 class="text-base font-semibold">Equipes existentes</h3>
            <p class="mt-1 text-xs text-muted">
              {{ teamsQuery.data.value?.length ?? 0 }}
              {{ teamsQuery.data.value?.length === 1 ? 'equipe cadastrada' : 'equipes cadastradas' }}.
            </p>

            <div v-if="teamsQuery.isLoading.value" class="mt-6 text-sm text-muted text-center py-8">
              Carregando...
            </div>

            <div
              v-else-if="(teamsQuery.data.value?.length ?? 0) === 0"
              class="mt-6 text-sm text-muted text-center py-12 border border-dashed border-line rounded-xl"
            >
              Nenhuma equipe cadastrada ainda.
            </div>

            <ul v-else class="mt-5 divide-y divide-line">
              <li v-for="team in teamsQuery.data.value" :key="team.id" class="py-3 flex items-center gap-3">
                <span v-if="team.parent_team_id" class="text-muted text-xs ml-2">↳</span>
                <span
                  class="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  :style="{ backgroundColor: (team.color ?? '#1ACDB8') + '15', color: team.color ?? '#1ACDB8' }"
                >
                  {{ team.name[0]?.toUpperCase() }}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ team.name }}</p>
                  <p class="text-xs text-muted truncate">
                    {{ team.agency?.name ?? '—' }}
                    <template v-if="team.parent_team_id">
                      · sub de {{ teamsQuery.data.value?.find((t) => t.id === team.parent_team_id)?.name ?? '?' }}
                    </template>
                    <template v-if="team.description">· {{ team.description }}</template>
                  </p>
                </div>
                <button class="btn-ghost text-xs" @click="openEditTeam(team)">Editar</button>
                <button
                  class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  @click="handleDeleteTeam(team.id, team.name)"
                >
                  Excluir
                </button>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
