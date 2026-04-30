<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { Crown, Star, Heart, Trophy, Lock } from 'lucide-vue-next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useProfiles } from '@/composables/useProfiles'
import type { ProfileWithTeam } from '@/types/database'
import {
  isFriday,
  useMyVoteThisWeek,
  useRecognitionRanking,
  useRecognitionFeed,
  useSubmitRecognitionVote,
} from '@/composables/useBingo'
import type { RecognitionType } from '@/types/database'

const auth = useAuthStore()
const ui = useUiStore()

const uid = computed(() => auth.user?.id)
const today = isFriday()

const isMarketingTeam = ref(false)
watchEffect(async () => {
  const teamId = auth.profile?.team_id
  if (!teamId || auth.isAdmin) return
  const { data } = await supabase.from('teams').select('name').eq('id', teamId).single()
  isMarketingTeam.value = data?.name?.toLowerCase().includes('marketing') ?? false
})
const canSeeFeed = computed(() => auth.isAdmin || isMarketingTeam.value)

const profilesQ   = useProfiles()
const myVoteQ     = useMyVoteThisWeek(uid)
const rankingQ    = useRecognitionRanking()
const feedQ       = useRecognitionFeed()
const submitVote  = useSubmitRecognitionVote()

// ── Tabs ──────────────────────────────────────────────────────────────
type Tab = 'vote' | 'feed' | 'ranking'
const tab = ref<Tab>('vote')
function setTab(key: string) { tab.value = key as Tab }

// ── Form ──────────────────────────────────────────────────────────────
const form = ref<{
  recipient_id: string
  type: RecognitionType | ''
  icon_count: number
  comment: string
}>({
  recipient_id: '',
  type: '',
  icon_count: 1,
  comment: '',
})

// Reset ao trocar de tipo
watch(() => form.value.type, () => { form.value.icon_count = 1 })

const recipients = computed(() =>
  (profilesQ.data.value ?? []).filter((p: ProfileWithTeam) => p.id !== uid.value)
)

const canSubmit = computed(() =>
  today &&
  !myVoteQ.data.value &&
  form.value.recipient_id &&
  form.value.type &&
  form.value.comment.trim().length > 0
)

async function handleSubmit() {
  if (!uid.value || !canSubmit.value || !form.value.type) return
  try {
    await submitVote.mutateAsync({
      voter_id: uid.value,
      recipient_id: form.value.recipient_id,
      type: form.value.type as RecognitionType,
      icon_count: form.value.icon_count,
      comment: form.value.comment.trim(),
    })
    ui.pushToast('Reconhecimento enviado! 🎉', 'success')
    form.value = { recipient_id: '', type: '', icon_count: 1, comment: '' }
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      ui.pushToast('Você já votou nesta semana.', 'error')
    } else {
      ui.pushToast('Erro ao enviar reconhecimento.', 'error')
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  })
}

</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">

    <!-- Header -->
    <div>
      <h1 class="text-xl font-bold text-ink flex items-center gap-2">
        <Crown class="w-7 h-7 text-brand-600" :stroke-width="1.75" />
        Bingo do Reconhecimento
      </h1>
      <p class="text-sm text-muted mt-0.5">Reconheça um colega por suas conquistas — toda sexta-feira</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-surface rounded-xl p-1 w-fit">
      <button
        v-for="t in [{ key: 'vote', label: 'Votar' }, ...(canSeeFeed ? [{ key: 'feed', label: 'Reconhecimentos' }] : []), { key: 'ranking', label: 'Ranking' }]"
        :key="t.key"
        class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
        :class="tab === t.key ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'"
        @click="setTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- ── TAB: VOTAR ─────────────────────────────────────────────────── -->
    <template v-if="tab === 'vote'">

      <!-- Bloqueio: não é sexta -->
      <div v-if="!today" class="card p-10 text-center space-y-4">
        <Lock class="w-12 h-12 mx-auto text-muted opacity-40" />
        <div>
          <p class="text-base font-semibold text-ink">Disponível apenas nas sextas-feiras</p>
          <p class="text-sm text-muted mt-1">
            Volte na próxima sexta para reconhecer um colega.
          </p>
        </div>
      </div>

      <!-- Já votou esta semana -->
      <div v-else-if="myVoteQ.data.value" class="card p-8 text-center space-y-4">
        <p class="text-4xl">🎉</p>
        <div>
          <p class="text-base font-semibold text-ink">Você já votou esta semana!</p>
          <p class="text-sm text-muted mt-1">
            Seu reconhecimento foi enviado em {{ formatDate(myVoteQ.data.value.week_date) }}.
          </p>
          <p class="text-sm text-muted mt-1">
            Tipo: {{ myVoteQ.data.value.type === 'professional' ? '⭐ Profissional' : '💚 Pessoal' }}
          </p>
        </div>
      </div>

      <!-- Formulário -->
      <div v-else class="card p-6 space-y-6">
        <!-- Regras -->
        <div class="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-1.5 text-sm text-brand-800">
          <p>• Cada colaborador tem direito a <strong>1 voto por semana</strong>, toda sexta-feira.</p>
          <p>• Escolha entre reconhecimento <strong>Profissional ⭐</strong> ou <strong>Pessoal 💚</strong>.</p>
          <p>• A quantidade de ícones é decorativa — apenas 1 reconhecimento é contabilizado.</p>
          <p>• O comentário explicando o motivo é <strong>obrigatório</strong>.</p>
        </div>

        <!-- Destinatário -->
        <div class="space-y-1.5">
          <label class="label">Quem você deseja reconhecer? <span class="text-red-500">*</span></label>
          <select v-model="form.recipient_id" class="input">
            <option value="" disabled>Selecione um alpinista…</option>
            <option
              v-for="p in recipients"
              :key="p.id"
              :value="p.id"
            >
              {{ p.full_name ?? p.email }}{{ p.position ? ` — ${p.position}` : '' }}
            </option>
          </select>
        </div>

        <!-- Tipo de reconhecimento -->
        <div class="space-y-3">
          <label class="label">Tipo de reconhecimento <span class="text-red-500">*</span></label>
          <div class="grid sm:grid-cols-2 gap-3">
            <!-- Profissional -->
            <button
              type="button"
              class="border-2 rounded-2xl p-4 text-left transition-all space-y-2"
              :class="form.type === 'professional'
                ? 'border-yellow-400 bg-yellow-50'
                : 'border-line hover:border-yellow-300 hover:bg-yellow-50/40'"
              @click="form.type = 'professional'"
            >
              <p class="font-semibold text-ink flex items-center gap-2">
                <Star class="w-4 h-4 text-yellow-500 fill-yellow-400" /> Reconhecimento Profissional
              </p>
              <p class="text-xs text-muted">Focado em entregas, metas, proatividade e técnica.</p>
              <!-- Ícones seletores -->
              <div v-if="form.type === 'professional'" class="flex gap-1 pt-1">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  class="text-xl transition-transform hover:scale-110"
                  @click.stop="form.icon_count = n"
                >
                  <Star
                    class="w-6 h-6 transition-colors"
                    :class="n <= form.icon_count ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'"
                  />
                </button>
              </div>
              <div v-else class="flex gap-1 pt-1 opacity-30">
                <Star v-for="n in 5" :key="n" class="w-6 h-6 text-slate-300" />
              </div>
            </button>

            <!-- Pessoal -->
            <button
              type="button"
              class="border-2 rounded-2xl p-4 text-left transition-all space-y-2"
              :class="form.type === 'personal'
                ? 'border-green-400 bg-green-50'
                : 'border-line hover:border-green-300 hover:bg-green-50/40'"
              @click="form.type = 'personal'"
            >
              <p class="font-semibold text-ink flex items-center gap-2">
                <Heart class="w-4 h-4 text-green-500 fill-green-400" /> Reconhecimento Pessoal
              </p>
              <p class="text-xs text-muted">Focado em empatia, apoio emocional, bom humor e integração.</p>
              <!-- Ícones seletores -->
              <div v-if="form.type === 'personal'" class="flex gap-1 pt-1">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  class="text-xl transition-transform hover:scale-110"
                  @click.stop="form.icon_count = n"
                >
                  <Heart
                    class="w-6 h-6 transition-colors"
                    :class="n <= form.icon_count ? 'text-green-400 fill-green-400' : 'text-slate-300'"
                  />
                </button>
              </div>
              <div v-else class="flex gap-1 pt-1 opacity-30">
                <Heart v-for="n in 5" :key="n" class="w-6 h-6 text-slate-300" />
              </div>
            </button>
          </div>
        </div>

        <!-- Comentário -->
        <div class="space-y-1.5">
          <label class="label">
            Por que você está reconhecendo esta pessoa? <span class="text-red-500">*</span>
          </label>
          <textarea
            v-model="form.comment"
            class="input resize-none"
            rows="3"
            placeholder="Conte brevemente o motivo desse reconhecimento…"
          />
        </div>

        <!-- Submit -->
        <div class="flex justify-end">
          <button
            class="btn-primary"
            :disabled="!canSubmit || submitVote.isPending.value"
            @click="handleSubmit"
          >
            <Crown class="w-4 h-4" />
            {{ submitVote.isPending.value ? 'Enviando…' : 'Reconhecer' }}
          </button>
        </div>
      </div>
    </template>

    <!-- ── TAB: FEED ─────────────────────────────────────────────────── -->
    <template v-else-if="tab === 'feed'">
      <div v-if="feedQ.isLoading.value" class="text-center py-12 text-muted text-sm">
        Carregando reconhecimentos…
      </div>
      <div v-else-if="(feedQ.data.value ?? []).length === 0" class="card p-12 text-center text-muted">
        <Crown class="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p class="text-sm">Nenhum reconhecimento ainda. Seja o primeiro!</p>
      </div>
      <div v-else class="space-y-4">
        <div
          v-for="v in feedQ.data.value"
          :key="v.id"
          class="card p-5 space-y-4"
          :class="v.type === 'professional' ? 'border-l-4 border-l-yellow-400' : 'border-l-4 border-l-green-400'"
        >
          <!-- Cabeçalho: quem recebeu -->
          <div class="flex items-start gap-3">
            <img
              v-if="v.recipient?.avatar_url"
              :src="v.recipient.avatar_url"
              class="w-12 h-12 rounded-full object-cover shrink-0"
            />
            <div
              v-else
              class="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-base font-semibold shrink-0"
            >
              {{ (v.recipient?.full_name ?? v.recipient?.email ?? '?')[0].toUpperCase() }}
            </div>

            <div class="flex items-start justify-between gap-2 flex-wrap flex-1 min-w-0">
              <!-- Esquerda: nome + cargo -->
              <div class="min-w-0 space-y-0.5">
                <p class="font-semibold text-ink leading-snug">
                  {{ v.recipient?.full_name ?? v.recipient?.email }}
                </p>
                <p v-if="v.recipient?.position" class="text-xs text-muted">
                  {{ v.recipient.position }}
                </p>
              </div>
              <!-- Direita: ícones + badge -->
              <div class="flex items-center gap-2 shrink-0">
                <div class="flex gap-0.5">
                  <template v-if="v.type === 'professional'">
                    <Star v-for="n in v.icon_count" :key="n" class="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  </template>
                  <template v-else>
                    <Heart v-for="n in v.icon_count" :key="n" class="w-4 h-4 text-green-400 fill-green-400" />
                  </template>
                </div>
                <span
                  class="text-xs font-medium px-2 py-0.5 rounded-full"
                  :class="v.type === 'professional' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'"
                >
                  {{ v.type === 'professional' ? '⭐ Profissional' : '💚 Pessoal' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Comentário -->
          <blockquote class="bg-surface rounded-xl px-4 py-3 text-sm text-ink leading-relaxed">
            "{{ v.comment }}"
          </blockquote>

          <!-- Rodapé: quem deu + data -->
          <div class="flex items-center justify-between gap-2 text-xs text-muted flex-wrap">
            <div class="flex items-center gap-2">
              <img
                v-if="v.voter?.avatar_url"
                :src="v.voter.avatar_url"
                class="w-5 h-5 rounded-full object-cover shrink-0"
              />
              <div
                v-else
                class="w-5 h-5 rounded-full bg-surface border border-line flex items-center justify-center text-xs font-semibold shrink-0"
              >
                {{ (v.voter?.full_name ?? '?')[0].toUpperCase() }}
              </div>
              <span>Reconhecido por <strong class="text-ink">{{ v.voter?.full_name ?? v.voter?.email }}</strong></span>
            </div>
            <span class="shrink-0">{{ formatDate(v.week_date) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── TAB: RANKING ───────────────────────────────────────────────── -->
    <template v-else-if="tab === 'ranking'">
      <div class="card p-6 space-y-5">
        <h2 class="font-semibold text-ink flex items-center gap-2">
          <Trophy class="w-4 h-4 text-brand-600" />
          Ranking de reconhecimentos
        </h2>

        <div v-if="rankingQ.isLoading.value" class="text-center py-10 text-muted text-sm">
          Carregando ranking…
        </div>
        <div v-else-if="(rankingQ.data.value ?? []).length === 0" class="text-center py-10 text-muted">
          <Trophy class="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p class="text-sm">Nenhum reconhecimento ainda.</p>
        </div>

        <ol v-else class="space-y-2">
          <li
            v-for="(entry, index) in rankingQ.data.value"
            :key="entry.id"
            class="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors"
            :class="index === 0 ? 'bg-yellow-50 border border-yellow-200'
              : index === 1 ? 'bg-slate-50 border border-slate-200'
              : index === 2 ? 'bg-orange-50 border border-orange-200'
              : 'hover:bg-surface'"
          >
            <!-- Posição -->
            <div class="w-8 text-center shrink-0">
              <span v-if="index === 0" class="text-xl">🥇</span>
              <span v-else-if="index === 1" class="text-xl">🥈</span>
              <span v-else-if="index === 2" class="text-xl">🥉</span>
              <span v-else class="text-sm font-semibold text-muted">{{ index + 1 }}º</span>
            </div>

            <!-- Avatar -->
            <img
              v-if="entry.avatar_url"
              :src="entry.avatar_url"
              class="w-10 h-10 rounded-full object-cover shrink-0"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0"
            >
              {{ (entry.full_name ?? entry.email)[0].toUpperCase() }}
            </div>

            <!-- Nome -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-ink truncate">
                {{ entry.full_name ?? entry.email }}
              </p>
              <p v-if="entry.position" class="text-xs text-muted truncate">{{ entry.position }}</p>
            </div>

            <!-- Contadores -->
            <div class="flex items-center gap-3 shrink-0 text-sm">
              <span class="flex items-center gap-1" title="Profissional">
                <Star class="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span class="font-semibold text-ink">{{ entry.professional_count }}</span>
              </span>
              <span class="flex items-center gap-1" title="Pessoal">
                <Heart class="w-3.5 h-3.5 text-green-400 fill-green-400" />
                <span class="font-semibold text-ink">{{ entry.personal_count }}</span>
              </span>
              <span class="text-xs text-muted font-medium bg-surface px-2 py-0.5 rounded-full">
                {{ entry.total_count }} total
              </span>
            </div>
          </li>
        </ol>
      </div>
    </template>

  </div>
</template>
