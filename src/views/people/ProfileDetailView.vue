<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useProfile, useUpdateProfile, type ProfileUpdate } from '@/composables/useProfiles'
import { useTeams } from '@/composables/useTeams'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { supabase } from '@/lib/supabase'
import { useArchiveUser } from '@/composables/useArchiveUser'
import AvatarUpload from '@/components/AvatarUpload.vue'
import ProfileBookReads from '@/components/profile/ProfileBookReads.vue'
import ProfileBorrowings from '@/components/profile/ProfileBorrowings.vue'
import ProfileCourses from '@/components/profile/ProfileCourses.vue'
import PdiPanel from '@/components/profile/PdiPanel.vue'

const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()

const profileId = computed(() => route.params.id as string)
const profileQuery = useProfile(profileId)
const teamsQuery = useTeams()
const updateProfile = useUpdateProfile()

const isOwnProfile = computed(() => auth.user?.id === profileId.value)
const currentUserProfile = useProfile(computed(() => auth.user?.id))
const viewerIsAdmin = computed(() => currentUserProfile.data.value?.app_role === 'admin')

const canEditPersonal = computed(() => isOwnProfile.value || viewerIsAdmin.value)
const canEditOrg = computed(() => viewerIsAdmin.value)

// PDI visibility (espelha can_view_pdi do SQL):
// - Próprio dono
// - Admin
// - Sócio da agência da equipe do target, e target é Head
// - Head da mesma equipe do target, e target é Líder
// - Líder da mesma equipe do target, e target é Membro (não-Head, não-Líder)
const canViewPdi = computed(() => {
  const me = currentUserProfile.data.value
  const target = profileQuery.data.value
  if (!me || !target) return false
  if (isOwnProfile.value) return true
  if (viewerIsAdmin.value) return true

  const targetAgencyId = target.team?.agency?.id ?? null
  const myPartnerships = (me.partnerships ?? []).map((p) => p.agency_id)
  const targetIsPartnerOfSameAgency = !!targetAgencyId &&
    (target.partnerships ?? []).some((p) => p.agency_id === targetAgencyId)
  if (
    targetAgencyId &&
    myPartnerships.includes(targetAgencyId) &&
    target.is_head &&
    !targetIsPartnerOfSameAgency // sócios são pares, não se gerenciam
  ) return true

  const sameTeam = !!me.team_id && me.team_id === target.team_id
  if (sameTeam && me.is_head && target.is_lead) return true
  if (sameTeam && me.is_lead && !target.is_head && !target.is_lead) return true

  return false
})

const canManagePdi = canViewPdi

// Editable form state
const editing = ref(false)
const form = ref<ProfileUpdate>({})

watch(profileQuery.data, (p) => {
  if (!p) return
  form.value = {
    full_name: p.full_name,
    nickname: p.nickname,
    position: p.position,
    bio: p.bio,
    birthday: p.birthday,
    joined_at: p.joined_at,
    avatar_url: p.avatar_url,
    team_id: p.team_id,
    is_head: p.is_head,
    is_lead: p.is_lead,
    app_role: p.app_role,
    instagram_url: p.instagram_url,
    linkedin_url: p.linkedin_url,
    github_url: p.github_url,
    website_url: p.website_url,
  }
}, { immediate: true })

function startEditing() {
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  // Reset by re-applying the loaded profile
  const p = profileQuery.data.value
  if (p) {
    form.value = {
      full_name: p.full_name,
      nickname: p.nickname,
      position: p.position,
      bio: p.bio,
      birthday: p.birthday,
      joined_at: p.joined_at,
      avatar_url: p.avatar_url,
      team_id: p.team_id,
      is_head: p.is_head,
      is_lead: p.is_lead,
      app_role: p.app_role,
      instagram_url: p.instagram_url,
      linkedin_url: p.linkedin_url,
      github_url: p.github_url,
      website_url: p.website_url,
    }
  }
}

async function handleSave() {
  try {
    // Only send fields the viewer is allowed to change
    const patch: ProfileUpdate = {}
    if (canEditPersonal.value) {
      patch.full_name = form.value.full_name
      patch.nickname = form.value.nickname?.trim() || null
      patch.position = form.value.position
      patch.bio = form.value.bio
      patch.birthday = form.value.birthday || null
      patch.joined_at = form.value.joined_at || null
      patch.avatar_url = form.value.avatar_url || null
      patch.instagram_url = form.value.instagram_url?.trim() || null
      patch.linkedin_url = form.value.linkedin_url?.trim() || null
      patch.github_url = form.value.github_url?.trim() || null
      patch.website_url = form.value.website_url?.trim() || null
    }
    if (canEditOrg.value) {
      patch.team_id = form.value.team_id || null
      patch.is_head = !!form.value.is_head
      patch.is_lead = !!form.value.is_lead && !form.value.is_head
      patch.app_role = form.value.app_role
    }

    await updateProfile.mutateAsync({ id: profileId.value, patch })
    ui.pushToast('Perfil atualizado.', 'success')
    editing.value = false
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao atualizar perfil.',
      'error',
    )
  }
}

function initials(name: string | null | undefined, fallback: string) {
  const source = (name?.trim() || fallback).split(/\s+/)
  const first = source[0]?.[0] ?? '?'
  const last = source.length > 1 ? source[source.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ---------------------------------------------------------------------
// Password change (own profile only)
// ---------------------------------------------------------------------
const passwordForm = ref({ next: '', confirm: '' })
const changingPassword = ref(false)

// ---------------------------------------------------------------------
// Archive / Unarchive (admin only)
// ---------------------------------------------------------------------
const archiveUser = useArchiveUser()

async function handleArchive() {
  if (!profileQuery.data.value) return
  const target = profileQuery.data.value
  const willArchive = !target.archived_at
  const action = willArchive ? 'arquivar' : 'desarquivar'
  const verbose = willArchive
    ? `Arquivar ${target.full_name || target.email}? O acesso será revogado e a pessoa some das listas ativas, mas o histórico fica preservado.`
    : `Desarquivar ${target.full_name || target.email}? O acesso será restaurado.`
  if (!confirm(verbose)) return

  try {
    await archiveUser.mutateAsync({
      profileId: target.id,
      archive: willArchive,
    })
    ui.pushToast(
      willArchive ? 'Pessoa arquivada.' : 'Pessoa desarquivada.',
      'success',
    )
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : `Erro ao ${action}.`,
      'error',
    )
  }
}

async function handleChangePassword() {
  if (!passwordForm.value.next || passwordForm.value.next.length < 6) {
    ui.pushToast('A senha deve ter ao menos 6 caracteres.', 'error')
    return
  }
  if (passwordForm.value.next !== passwordForm.value.confirm) {
    ui.pushToast('As senhas não conferem.', 'error')
    return
  }
  changingPassword.value = true
  try {
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.value.next,
    })
    if (error) throw error
    ui.pushToast('Senha alterada com sucesso.', 'success')
    passwordForm.value = { next: '', confirm: '' }
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao alterar senha.',
      'error',
    )
  } finally {
    changingPassword.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <!-- Back link -->
    <RouterLink
      :to="{ name: 'people' }"
      class="text-sm text-muted hover:text-ink inline-flex items-center gap-1.5"
    >
      ← Voltar para Pessoas
    </RouterLink>

    <!-- Loading -->
    <div v-if="profileQuery.isLoading.value" class="card p-12 text-center text-sm text-muted">
      Carregando perfil...
    </div>

    <!-- Error -->
    <div
      v-else-if="profileQuery.isError.value"
      class="card p-6 text-sm text-red-700 bg-red-50 border-red-200"
    >
      Erro ao carregar perfil: {{ profileQuery.error.value?.message }}
    </div>

    <!-- Loaded -->
    <template v-else-if="profileQuery.data.value">
      <!-- Header -->
      <header class="card p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div
          v-if="!profileQuery.data.value.avatar_url"
          class="h-20 w-20 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center text-2xl font-bold flex-shrink-0"
        >
          {{ initials(profileQuery.data.value.full_name, profileQuery.data.value.email) }}
        </div>
        <img
          v-else
          :src="profileQuery.data.value.avatar_url"
          :alt="profileQuery.data.value.full_name ?? profileQuery.data.value.email"
          class="h-20 w-20 rounded-2xl object-cover flex-shrink-0"
        />

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl font-semibold tracking-tight">
              {{ profileQuery.data.value.full_name || profileQuery.data.value.email.split('@')[0] }}
              <span v-if="profileQuery.data.value.nickname" class="text-muted font-normal">
                ({{ profileQuery.data.value.nickname }})
              </span>
            </h1>
            <span
              v-if="profileQuery.data.value.is_head"
              class="text-[10px] font-bold uppercase tracking-wider text-accent-soft bg-brand-700 px-2 py-0.5 rounded-md"
            >
              Head
            </span>
            <span
              v-if="profileQuery.data.value.is_lead"
              class="text-[10px] font-bold uppercase tracking-wider text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-md"
            >
              Líder
            </span>
            <span
              v-if="(profileQuery.data.value.partnerships?.length ?? 0) > 0"
              class="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md"
            >
              Sócio
            </span>
            <span
              v-if="profileQuery.data.value.app_role === 'admin'"
              class="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-100 px-2 py-0.5 rounded-md"
            >
              Admin
            </span>
          </div>
          <p class="mt-0.5 text-sm text-muted">
            {{ profileQuery.data.value.position || 'Sem cargo definido' }}
          </p>
          <div class="mt-2 flex items-center gap-3 flex-wrap">
            <span
              v-if="profileQuery.data.value.team"
              class="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg"
              :style="{
                backgroundColor: (profileQuery.data.value.team.color ?? '#0d9b6c') + '15',
                color: profileQuery.data.value.team.color ?? '#0d9b6c',
              }"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :style="{ backgroundColor: profileQuery.data.value.team.color ?? '#0d9b6c' }"
              ></span>
              {{ profileQuery.data.value.team.name }}
            </span>
            <a
              :href="`mailto:${profileQuery.data.value.email}`"
              class="text-xs text-muted hover:text-ink"
            >
              {{ profileQuery.data.value.email }}
            </a>
          </div>

          <!-- Social links -->
          <div
            v-if="profileQuery.data.value.instagram_url || profileQuery.data.value.linkedin_url || profileQuery.data.value.github_url || profileQuery.data.value.website_url"
            class="mt-3 flex items-center gap-2 flex-wrap"
          >
            <a
              v-if="profileQuery.data.value.website_url"
              :href="profileQuery.data.value.website_url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-line text-muted hover:text-ink hover:border-brand-300 transition-colors"
            >
              🌐 Site
            </a>
            <a
              v-if="profileQuery.data.value.instagram_url"
              :href="profileQuery.data.value.instagram_url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-line text-muted hover:text-ink hover:border-brand-300 transition-colors"
            >
              📷 Instagram
            </a>
            <a
              v-if="profileQuery.data.value.linkedin_url"
              :href="profileQuery.data.value.linkedin_url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-line text-muted hover:text-ink hover:border-brand-300 transition-colors"
            >
              💼 LinkedIn
            </a>
            <a
              v-if="profileQuery.data.value.github_url"
              :href="profileQuery.data.value.github_url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-line text-muted hover:text-ink hover:border-brand-300 transition-colors"
            >
              ⌨️ GitHub
            </a>
          </div>
        </div>

        <div v-if="!editing" class="flex-shrink-0 flex items-center gap-2">
          <button v-if="canEditPersonal" class="btn-secondary" @click="startEditing">
            Editar
          </button>
          <button
            v-if="viewerIsAdmin && !isOwnProfile"
            class="btn-ghost text-sm"
            :class="
              profileQuery.data.value.archived_at
                ? 'text-brand-700 hover:bg-brand-50'
                : 'text-red-600 hover:bg-red-50'
            "
            :disabled="archiveUser.isPending.value"
            @click="handleArchive"
          >
            {{ profileQuery.data.value.archived_at ? 'Desarquivar' : 'Arquivar' }}
          </button>
        </div>
      </header>

      <!-- Archived banner -->
      <div
        v-if="profileQuery.data.value.archived_at"
        class="card p-4 bg-amber-50 border-amber-200 text-amber-900 text-sm flex items-center gap-3"
      >
        <span class="text-base">⚠️</span>
        <div class="flex-1">
          <strong>Pessoa arquivada.</strong>
          O acesso à plataforma foi revogado. Esta página é mantida para preservar o histórico.
        </div>
      </div>

      <!-- VIEW MODE -->
      <template v-if="!editing">
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="card p-6 lg:col-span-2">
            <h2 class="text-base font-semibold">Sobre</h2>
            <p class="mt-3 text-sm text-ink/80 whitespace-pre-line">
              {{ profileQuery.data.value.bio || 'Sem descrição.' }}
            </p>
          </div>

          <div class="card p-6">
            <h2 class="text-base font-semibold">Informações</h2>
            <dl class="mt-4 space-y-3 text-sm">
              <div>
                <dt class="text-xs text-muted">Aniversário</dt>
                <dd class="mt-0.5">{{ formatDate(profileQuery.data.value.birthday) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">Entrou na empresa</dt>
                <dd class="mt-0.5">{{ formatDate(profileQuery.data.value.joined_at) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">E-mail</dt>
                <dd class="mt-0.5 truncate">{{ profileQuery.data.value.email }}</dd>
              </div>
            </dl>
          </div>
        </section>

        <PdiPanel
          v-if="canViewPdi"
          :profile-id="profileId"
          :can-manage="canManagePdi"
          :is-own="isOwnProfile"
        />

        <ProfileCourses :profile-id="profileId" :can-edit="canEditPersonal" />

        <ProfileBorrowings :profile-id="profileId" :is-own="isOwnProfile" />

        <ProfileBookReads :profile-id="profileId" />
      </template>

      <!-- EDIT MODE -->
      <section v-else class="space-y-4">
        <div class="card p-6 space-y-5">
          <h2 class="text-base font-semibold">Dados pessoais</h2>

          <div>
            <label class="block text-sm font-medium mb-2">Foto de perfil</label>
            <AvatarUpload
              :profile-id="profileId"
              :current-url="profileQuery.data.value.avatar_url"
              :fallback-initials="initials(profileQuery.data.value.full_name, profileQuery.data.value.email)"
              size="lg"
              @updated="(url) => (form.avatar_url = url)"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">Nome completo</label>
              <input v-model="form.full_name" type="text" class="input" maxlength="120" />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5">
                Apelido <span class="text-muted font-normal">(opcional)</span>
              </label>
              <input
                v-model="form.nickname"
                type="text"
                class="input"
                maxlength="40"
                placeholder="Como gosta de ser chamado(a)"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-sm font-medium mb-1.5">Cargo</label>
              <input
                v-model="form.position"
                type="text"
                class="input"
                placeholder="Ex.: Desenvolvedor, Tech Lead, Designer"
                maxlength="80"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5">Aniversário</label>
              <input v-model="form.birthday" type="date" class="input" />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5">Entrou na empresa</label>
              <input v-model="form.joined_at" type="date" class="input" />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-sm font-medium mb-1.5">Bio</label>
              <textarea v-model="form.bio" rows="4" class="input resize-none" maxlength="600"></textarea>
            </div>
          </div>

          <div class="pt-2 space-y-3">
            <p class="text-sm font-medium">Site e redes sociais</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                v-model="form.website_url"
                type="url"
                class="input"
                placeholder="🌐 Site pessoal"
              />
              <input
                v-model="form.instagram_url"
                type="url"
                class="input"
                placeholder="📷 Instagram"
              />
              <input
                v-model="form.linkedin_url"
                type="url"
                class="input"
                placeholder="💼 LinkedIn"
              />
              <input
                v-model="form.github_url"
                type="url"
                class="input"
                placeholder="⌨️ GitHub"
              />
            </div>
          </div>
        </div>

        <div v-if="canEditOrg" class="card p-6 space-y-4">
          <div>
            <h2 class="text-base font-semibold">Estrutura organizacional</h2>
            <p class="mt-1 text-xs text-muted">Visível apenas para administradores.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">Equipe</label>
              <select v-model="form.team_id" class="input">
                <option :value="null">Sem equipe</option>
                <option v-for="team in teamsQuery.data.value ?? []" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5">Permissão</label>
              <select v-model="form.app_role" class="input">
                <option value="member">Membro</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div class="sm:col-span-2 space-y-3">
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  v-model="form.is_head"
                  type="checkbox"
                  class="rounded text-brand-600 focus:ring-brand-600"
                  @change="form.is_head && (form.is_lead = false)"
                />
                <span>É o <strong>Head</strong> da equipe</span>
              </label>
              <label
                class="flex items-center gap-2 text-sm cursor-pointer"
                :class="form.is_head ? 'opacity-50 cursor-not-allowed' : ''"
              >
                <input
                  v-model="form.is_lead"
                  type="checkbox"
                  :disabled="!!form.is_head"
                  class="rounded text-brand-600 focus:ring-brand-600 disabled:opacity-50"
                />
                <span>É <strong>Líder</strong> de uma sub-área</span>
              </label>
              <p class="text-xs text-muted">Head e Líder são mutuamente exclusivos.</p>
            </div>
          </div>
        </div>

        <div v-if="isOwnProfile" class="card p-6 space-y-5">
          <div>
            <h2 class="text-base font-semibold">Segurança</h2>
            <p class="mt-1 text-xs text-muted">Alterar sua senha de acesso.</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">Nova senha</label>
              <input
                v-model="passwordForm.next"
                type="password"
                minlength="6"
                autocomplete="new-password"
                class="input"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">Confirmar nova senha</label>
              <input
                v-model="passwordForm.confirm"
                type="password"
                minlength="6"
                autocomplete="new-password"
                class="input"
              />
            </div>
          </div>
          <div class="flex justify-end">
            <button
              type="button"
              class="btn-primary"
              :disabled="changingPassword || !passwordForm.next || !passwordForm.confirm"
              @click="handleChangePassword"
            >
              {{ changingPassword ? 'Alterando...' : 'Alterar senha' }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3">
          <button class="btn-secondary" :disabled="updateProfile.isPending.value" @click="cancelEditing">
            Cancelar
          </button>
          <button class="btn-primary" :disabled="updateProfile.isPending.value" @click="handleSave">
            {{ updateProfile.isPending.value ? 'Salvando...' : 'Salvar alterações' }}
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
