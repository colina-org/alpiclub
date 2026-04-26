<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProfile, useProfiles } from '@/composables/useProfiles'
import PdiPanel from '@/components/profile/PdiPanel.vue'

const auth = useAuthStore()

const myId = computed(() => auth.user?.id)
const myProfile = useProfile(myId)
const profilesQuery = useProfiles()

// Liderados seguem a hierarquia ESTRITA imediata:
//   - Sócio  → Heads das equipes da(s) agência(s) onde sou sócio
//   - Head   → Líderes da minha equipe
//   - Líder  → Membros (não-Head, não-Líder) da minha equipe
const ledPeople = computed(() => {
  const me = myProfile.data.value
  if (!me) return []
  const all = profilesQuery.data.value ?? []
  const myAgenciesAsPartner = (me.partnerships ?? []).map((p) => p.agency_id)

  const merged = new Map<string, (typeof all)[number]>()

  // Sócio → Heads (excluindo Heads que também são sócios da mesma agência —
  // sócios são pares, não se gerenciam).
  if (myAgenciesAsPartner.length > 0) {
    for (const p of all) {
      if (
        p.id !== me.id &&
        p.is_head &&
        p.team?.agency?.id &&
        myAgenciesAsPartner.includes(p.team.agency.id)
      ) {
        const targetIsPartnerOfSameAgency = (p.partnerships ?? []).some(
          (tp) => tp.agency_id === p.team!.agency!.id,
        )
        if (!targetIsPartnerOfSameAgency) merged.set(p.id, p)
      }
    }
  }

  // Head → Líderes da equipe
  if (me.is_head && me.team_id) {
    for (const p of all) {
      if (p.id !== me.id && p.team_id === me.team_id && p.is_lead) {
        merged.set(p.id, p)
      }
    }
  }

  // Líder → Membros da equipe
  if (me.is_lead && me.team_id) {
    for (const p of all) {
      if (
        p.id !== me.id &&
        p.team_id === me.team_id &&
        !p.is_head &&
        !p.is_lead
      ) {
        merged.set(p.id, p)
      }
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
  )
})

const isManager = computed(() => ledPeople.value.length > 0)

const selectedProfileId = ref<string | null>(null)

watch(myId, (id) => {
  if (id && !selectedProfileId.value) selectedProfileId.value = id
}, { immediate: true })

const selectedPerson = computed(() => {
  if (!selectedProfileId.value) return null
  if (selectedProfileId.value === myId.value) return myProfile.data.value
  return ledPeople.value.find((p) => p.id === selectedProfileId.value) ?? null
})

const isOwnSelection = computed(() => selectedProfileId.value === myId.value)
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ isOwnSelection ? 'Meu PDI' : `PDI de ${selectedPerson?.full_name || selectedPerson?.email?.split('@')[0] || ''}` }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          <template v-if="isOwnSelection">
            Plano de Desenvolvimento Individual. Visível para você, seus gestores e admin.
          </template>
          <template v-else>
            Acompanhe e gerencie o PDI de quem você lidera.
          </template>
        </p>
      </div>

      <div v-if="isManager" class="sm:w-64">
        <label class="block text-xs font-medium text-muted mb-1.5">Ver PDI de</label>
        <select v-model="selectedProfileId" class="input">
          <optgroup label="Você">
            <option :value="myId">Meu PDI</option>
          </optgroup>
          <optgroup label="Liderados">
            <option v-for="p in ledPeople" :key="p.id" :value="p.id">
              {{ p.full_name || p.email.split('@')[0] }}
            </option>
          </optgroup>
        </select>
      </div>
    </header>

    <PdiPanel
      v-if="selectedProfileId"
      :key="selectedProfileId"
      :profile-id="selectedProfileId"
      :can-manage="true"
      :is-own="isOwnSelection"
    />
  </div>
</template>
