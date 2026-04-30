<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProfiles } from '@/composables/useProfiles'
import { useTeams } from '@/composables/useTeams'
import { useAchievements } from '@/composables/useAchievements'
import { useBooks } from '@/composables/useBooks'
import { ACHIEVEMENT_CATEGORIES } from '@/types/database'
import { timeAgo, initials } from '@/lib/format'
import DailyQuote from '@/components/DailyQuote.vue'

const auth = useAuthStore()

// Nome amigável: primeiro nome > apelido > prefixo do e-mail.
const greetingName = computed(() => {
  const fullName = auth.profile?.full_name?.trim()
  if (fullName) return fullName.split(/\s+/)[0]
  const nickname = auth.profile?.nickname?.trim()
  if (nickname) return nickname
  const email = auth.user?.email
  if (email) return email.split('@')[0]
  return 'colaborador'
})

const profilesQuery = useProfiles()
const teamsQuery = useTeams()
const recentAchievements = useAchievements({ limit: 5 })
const booksQuery = useBooks()

// Top livros mais lidos pelo time (status = 'read').
const topReadBooks = computed(() => {
  const books = booksQuery.data.value ?? []
  return books
    .map((b) => {
      const readReaders = b.reads.filter((r) => r.status === 'read')
      const rated = b.reads.filter((r) => typeof r.rating === 'number')
      const avg =
        rated.length > 0
          ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
          : null
      return { book: b, readers: readReaders.length, avg }
    })
    .filter((x) => x.readers > 0)
    .sort((a, b) => {
      if (b.readers !== a.readers) return b.readers - a.readers
      return (b.avg ?? 0) - (a.avg ?? 0)
    })
    .slice(0, 5)
})

const stats = computed(() => {
  const profiles = profilesQuery.data.value ?? []
  const teams = teamsQuery.data.value ?? []
  const achievements = recentAchievements.data.value ?? []

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const thisMonth = achievements.filter(
    (a) => new Date(a.granted_at).getTime() >= monthStart,
  ).length

  return [
    { label: 'Colaboradores', value: profiles.length, hint: 'Total ativo' },
    { label: 'Equipes', value: teams.length, hint: 'Em operação' },
    { label: 'Heads', value: profiles.filter((p) => p.is_head).length, hint: 'Liderando equipes' },
    { label: 'Conquistas', value: thisMonth, hint: 'Este mês' },
  ]
})

// Retorna a próxima ocorrência de MM-DD a partir de hoje, e quantos dias faltam.
function nextAnnualOccurrence(month: number, day: number) {
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  let next = new Date(todayMidnight.getFullYear(), month - 1, day)
  if (next < todayMidnight) next = new Date(todayMidnight.getFullYear() + 1, month - 1, day)
  const diffDays = Math.round((next.getTime() - todayMidnight.getTime()) / 86400000)
  return { next, diffDays }
}

const birthdaysThisWeek = computed(() => {
  const list = profilesQuery.data.value ?? []
  return list
    .filter((p) => p.birthday)
    .map((p) => {
      const [, m, d] = (p.birthday as string).split('-').map(Number)
      const { diffDays } = nextAnnualOccurrence(m, d)
      return { profile: p, diffDays, day: d, month: m }
    })
    .filter((x) => x.diffDays >= 0 && x.diffDays <= 7)
    .sort((a, b) => a.diffDays - b.diffDays)
})

const companyAnniversariesThisWeek = computed(() => {
  const list = profilesQuery.data.value ?? []
  return list
    .filter((p) => p.joined_at)
    .map((p) => {
      const [joinedYear, m, d] = (p.joined_at as string).split('-').map(Number)
      const { next, diffDays } = nextAnnualOccurrence(m, d)
      const years = next.getFullYear() - joinedYear
      return { profile: p, diffDays, day: d, month: m, years }
    })
    .filter((x) => x.diffDays >= 0 && x.diffDays <= 7 && x.years >= 1)
    .sort((a, b) => a.diffDays - b.diffDays)
})

const hasAnyAnniversary = computed(() =>
  birthdaysThisWeek.value.length > 0 || companyAnniversariesThisWeek.value.length > 0
)
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">
        Olá, {{ greetingName }}.
      </h1>
      <p class="mt-1 text-sm text-muted">
        Aqui está um resumo do que está acontecendo na Colina Tech.
      </p>
    </header>

    <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="stat in stats" :key="stat.label" class="card p-5">
        <p class="text-xs font-medium text-muted uppercase tracking-wide">
          {{ stat.label }}
        </p>
        <p class="mt-2 text-3xl font-semibold">{{ stat.value }}</p>
        <p class="mt-1 text-xs text-muted">{{ stat.hint }}</p>
      </div>
    </section>

    <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Recent achievements -->
      <div class="card p-6 lg:col-span-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold">Conquistas recentes</h2>
            <p class="mt-0.5 text-xs text-muted">Os últimos reconhecimentos do time.</p>
          </div>
          <RouterLink
            :to="{ name: 'achievements' }"
            class="text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            Ver todas →
          </RouterLink>
        </div>

        <div v-if="recentAchievements.isLoading.value" class="mt-6 text-sm text-muted text-center py-8">
          Carregando...
        </div>

        <div
          v-else-if="(recentAchievements.data.value?.length ?? 0) === 0"
          class="mt-6 text-sm text-muted text-center py-12 border border-dashed border-line rounded-xl"
        >
          Sem conquistas registradas ainda.
        </div>

        <ul v-else class="mt-5 space-y-3">
          <li
            v-for="a in recentAchievements.data.value"
            :key="a.id"
            class="flex items-start gap-3 py-2"
          >
            <RouterLink
              v-if="a.recipient"
              :to="{ name: 'profile', params: { id: a.recipient.id } }"
              class="flex-shrink-0"
            >
              <img
                v-if="a.recipient.avatar_url"
                :src="a.recipient.avatar_url"
                :alt="a.recipient.full_name ?? a.recipient.email"
                class="h-10 w-10 rounded-xl object-cover"
              />
              <div
                v-else
                class="h-10 w-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold"
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
              <p class="text-sm text-ink/90 truncate">{{ a.title }}</p>
              <p class="text-xs text-muted mt-0.5">{{ timeAgo(a.granted_at) }}</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- Right column: Birthdays + Daily Quote stacked -->
      <div class="space-y-4">
        <div class="card p-6">
          <h2 class="text-base font-semibold">Aniversários da semana</h2>
          <p class="mt-0.5 text-xs text-muted">Lembre-se de parabenizar.</p>

          <div v-if="profilesQuery.isLoading.value" class="mt-6 text-sm text-muted text-center py-8">
            Carregando...
          </div>

          <div
            v-else-if="!hasAnyAnniversary"
            class="mt-6 text-sm text-muted text-center py-12 border border-dashed border-line rounded-xl"
          >
            Nenhum aniversário próximo.
          </div>

          <template v-else>
            <!-- Aniversários de nascimento -->
            <template v-if="birthdaysThisWeek.length > 0">
              <p class="mt-5 mb-2 text-xs font-semibold text-muted uppercase tracking-wide">🎂 Nascimento</p>
              <ul class="space-y-3">
                <li
                  v-for="b in birthdaysThisWeek"
                  :key="b.profile.id"
                  class="flex items-center gap-3"
                >
                  <RouterLink :to="{ name: 'profile', params: { id: b.profile.id } }" class="flex-shrink-0">
                    <img
                      v-if="b.profile.avatar_url"
                      :src="b.profile.avatar_url"
                      :alt="b.profile.full_name ?? b.profile.email"
                      class="h-10 w-10 rounded-xl object-cover"
                    />
                    <div v-else class="h-10 w-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                      {{ initials(b.profile.full_name, b.profile.email) }}
                    </div>
                  </RouterLink>
                  <div class="flex-1 min-w-0">
                    <RouterLink
                      :to="{ name: 'profile', params: { id: b.profile.id } }"
                      class="text-sm font-medium hover:text-brand-700 truncate block"
                    >
                      {{ b.profile.full_name || b.profile.email.split('@')[0] }}
                    </RouterLink>
                    <p class="text-xs text-muted">
                      {{ b.diffDays === 0 ? 'Hoje 🎉' : b.diffDays === 1 ? 'Amanhã' : `Em ${b.diffDays} dias` }}
                      · {{ String(b.day).padStart(2, '0') }}/{{ String(b.month).padStart(2, '0') }}
                    </p>
                  </div>
                </li>
              </ul>
            </template>

            <!-- Aniversários de empresa -->
            <template v-if="companyAnniversariesThisWeek.length > 0">
              <p class="mt-5 mb-2 text-xs font-semibold text-muted uppercase tracking-wide">🏢 Tempo de empresa</p>
              <ul class="space-y-3">
                <li
                  v-for="c in companyAnniversariesThisWeek"
                  :key="c.profile.id"
                  class="flex items-center gap-3"
                >
                  <RouterLink :to="{ name: 'profile', params: { id: c.profile.id } }" class="flex-shrink-0">
                    <img
                      v-if="c.profile.avatar_url"
                      :src="c.profile.avatar_url"
                      :alt="c.profile.full_name ?? c.profile.email"
                      class="h-10 w-10 rounded-xl object-cover"
                    />
                    <div v-else class="h-10 w-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                      {{ initials(c.profile.full_name, c.profile.email) }}
                    </div>
                  </RouterLink>
                  <div class="flex-1 min-w-0">
                    <RouterLink
                      :to="{ name: 'profile', params: { id: c.profile.id } }"
                      class="text-sm font-medium hover:text-brand-700 truncate block"
                    >
                      {{ c.profile.full_name || c.profile.email.split('@')[0] }}
                    </RouterLink>
                    <p class="text-xs text-muted">
                      {{ c.diffDays === 0 ? 'Hoje 🎉' : c.diffDays === 1 ? 'Amanhã' : `Em ${c.diffDays} dias` }}
                      ·
                      <span class="font-medium text-brand-600">
                        {{ c.years }} {{ c.years === 1 ? 'ano' : 'anos' }} de empresa
                      </span>
                    </p>
                  </div>
                </li>
              </ul>
            </template>
          </template>
        </div>

        <DailyQuote />
      </div>
    </section>

    <!-- Most read books -->
    <section class="card p-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold">Mais lidos no time</h2>
          <p class="mt-0.5 text-xs text-muted">Livros que mais pessoas concluíram.</p>
        </div>
        <RouterLink
          :to="{ name: 'library' }"
          class="text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          Ir para a biblioteca →
        </RouterLink>
      </div>

      <div v-if="booksQuery.isLoading.value" class="mt-6 text-sm text-muted text-center py-8">
        Carregando...
      </div>

      <div
        v-else-if="topReadBooks.length === 0"
        class="mt-6 text-sm text-muted text-center py-12 border border-dashed border-line rounded-xl"
      >
        Ainda ninguém marcou nenhum livro como lido.
      </div>

      <ul v-else class="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <li v-for="(item, idx) in topReadBooks" :key="item.book.id">
          <RouterLink
            :to="{ name: 'book', params: { id: item.book.id } }"
            class="block group"
          >
            <div class="aspect-[2/3] rounded-xl overflow-hidden bg-surface relative border border-line group-hover:border-brand-300 transition-colors">
              <img
                v-if="item.book.cover_url"
                :src="item.book.cover_url"
                :alt="item.book.title"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-[10px] text-muted text-center p-2 bg-gradient-to-br from-brand-50 to-surface"
              >
                Sem capa
              </div>
              <span
                class="absolute top-2 left-2 h-6 w-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shadow-soft"
              >
                {{ idx + 1 }}
              </span>
            </div>
            <div class="mt-2 space-y-0.5">
              <p class="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-brand-700">
                {{ item.book.title }}
              </p>
              <p class="text-xs text-muted truncate">{{ item.book.author }}</p>
              <div class="flex items-center justify-between text-xs pt-1">
                <span class="text-muted">
                  {{ item.readers }} {{ item.readers === 1 ? 'leitor' : 'leitores' }}
                </span>
                <span v-if="item.avg !== null" class="flex items-center gap-1 text-muted">
                  <span class="text-yellow-500">★</span>
                  <span class="font-medium text-ink">{{ item.avg.toFixed(1) }}</span>
                </span>
              </div>
            </div>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
