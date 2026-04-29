<script setup lang="ts">
import { computed, ref } from 'vue'
import { Coins, ShoppingBag, Clock, CheckCircle2, XCircle, Plus, ChevronDown, ChevronUp, Trophy } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import {
  useAlpicoinsProducts,
  useMyAlpicoinsBalance,
  useMyAlpicoinsTransactions,
  useMyEarnRequests,
  useMyRedemptions,
  useCreateEarnRequest,
  useCreateRedemption,
  useAllEarnRequests,
  useAllRedemptions,
  useReviewEarnRequest,
  useReviewRedemption,
  useCreateAlpicoinsProduct,
  useUpdateAlpicoinsProduct,
  useDeleteAlpicoinsProduct,
  useAlpicoinsRanking,
} from '@/composables/useAlpicoins'
import type {
  AlpicoinsProduct,
  AlpicoinsRedemptionStatus,
  AlpicoinsEarnStatus,
} from '@/types/database'

const auth = useAuthStore()
const ui = useUiStore()

const uid = computed(() => auth.user?.id)

const productsQ    = useAlpicoinsProducts()
const balanceQ     = useMyAlpicoinsBalance(uid)
const transactionsQ = useMyAlpicoinsTransactions(uid)
const earnRequestsQ = useMyEarnRequests(uid)
const redemptionsQ  = useMyRedemptions(uid)

// Admin queries
const allEarnQ      = useAllEarnRequests()
const allRedeemQ    = useAllRedemptions()

const createEarn    = useCreateEarnRequest()
const createRedeem  = useCreateRedemption()
const reviewEarn    = useReviewEarnRequest()
const reviewRedeem  = useReviewRedemption()
const createProduct = useCreateAlpicoinsProduct()
const updateProduct = useUpdateAlpicoinsProduct()
const deleteProduct = useDeleteAlpicoinsProduct()

const rankingQ = useAlpicoinsRanking()

// ── Tabs ──────────────────────────────────────────────────────────────
type Tab = 'shop' | 'history' | 'ranking' | 'admin'
const tab = ref<Tab>('shop')

function setTab(key: string) {
  tab.value = key as Tab
}

const balance = computed(() => balanceQ.data.value ?? 0)

function canAfford(product: AlpicoinsProduct) {
  return balance.value >= product.price_coins
}

// ── Tabela de ações com valor fixo de coins ───────────────────────────
const EARN_ACTIONS = [
  { label: 'Participar de Treinamento Interno (Exceto Checkpoint)', coins: 3 },
  { label: 'Participar de Ação Social',                             coins: 5 },
  { label: 'Participar de Evento Externo',                          coins: 8 },
  { label: 'Escrever um Case de Sucesso',                           coins: 10 },
  { label: 'Ler um Livro',                                          coins: 20 },
  { label: 'Ministrar um Treinamento',                              coins: 25 },
  { label: 'Concluir um Curso (1h – 5h)',                           coins: 5 },
  { label: 'Concluir um Curso (5h – 10h)',                          coins: 10 },
  { label: 'Concluir um Curso (10h – 15h)',                         coins: 15 },
  { label: 'Concluir um Curso (15h+)',                              coins: 20 },
]

// ── Earn request form ─────────────────────────────────────────────────
const earnFormOpen = ref(false)
const earnForm = ref({ action: '', notes: '' })

const selectedAction = computed(() =>
  EARN_ACTIONS.find(a => a.label === earnForm.value.action) ?? null
)

async function submitEarnRequest() {
  if (!uid.value || !selectedAction.value) return
  const description = earnForm.value.notes.trim()
    ? `${selectedAction.value.label} — ${earnForm.value.notes.trim()}`
    : selectedAction.value.label
  await createEarn.mutateAsync({
    profile_id: uid.value,
    description,
    coins_requested: selectedAction.value.coins,
  })
  earnForm.value = { action: '', notes: '' }
  earnFormOpen.value = false
  ui.pushToast('Pedido enviado! Aguarde a aprovação.', 'success')
}

// ── Redeem ────────────────────────────────────────────────────────────
const redeemingId = ref<string | null>(null)

async function handleRedeem(product: AlpicoinsProduct) {
  if (!uid.value || !canAfford(product)) return
  if (!confirm(`Solicitar resgate de "${product.name}" por ${product.price_coins} Alpicoins?`)) return
  redeemingId.value = product.id
  try {
    await createRedeem.mutateAsync({ profile_id: uid.value, product_id: product.id })
    ui.pushToast('Pedido de resgate enviado! Aguarde a aprovação.', 'success')
  } finally {
    redeemingId.value = null
  }
}

// ── Admin: review earn ────────────────────────────────────────────────
const reviewingEarnId = ref<string | null>(null)
const earnReviewNote = ref<Record<string, string>>({})

async function handleReviewEarn(
  req: { id: string; profile_id: string; coins_requested: number; description: string },
  status: 'approved' | 'rejected',
) {
  if (!uid.value) return
  reviewingEarnId.value = req.id
  try {
    await reviewEarn.mutateAsync({
      id: req.id,
      profile_id: req.profile_id,
      status,
      coins_requested: req.coins_requested,
      description: req.description,
      reviewed_by: uid.value,
      review_note: earnReviewNote.value[req.id] ?? undefined,
    })
    ui.pushToast(status === 'approved' ? 'Aprovado! Coins creditados.' : 'Recusado.', 'success')
  } finally {
    reviewingEarnId.value = null
  }
}

// ── Admin: review redemption ──────────────────────────────────────────
const reviewingRedeemId = ref<string | null>(null)
const redeemReviewNote = ref<Record<string, string>>({})

type RedemptionReviewable = { id: string; profile_id: string; product_id: string; product: { price_coins: number; name: string } | null }

async function handleReviewRedeem(req: RedemptionReviewable, status: 'approved' | 'rejected' | 'delivered') {
  if (!uid.value || !req.product) return
  reviewingRedeemId.value = req.id
  try {
    await reviewRedeem.mutateAsync({
      id: req.id,
      profile_id: req.profile_id,
      product_id: req.product_id,
      price_coins: req.product.price_coins,
      product_name: req.product.name,
      status,
      reviewed_by: uid.value,
      review_note: redeemReviewNote.value[req.id] ?? undefined,
    })
    ui.pushToast(status === 'approved' ? 'Aprovado! Coins debitados.' : status === 'delivered' ? 'Marcado como entregue.' : 'Recusado.', 'success')
  } finally {
    reviewingRedeemId.value = null
  }
}

// ── Admin: product form ───────────────────────────────────────────────
const productFormOpen = ref(false)
const editingProduct = ref<AlpicoinsProduct | null>(null)
const productForm = ref({
  name: '',
  description: '',
  image_url: '',
  price_coins: '',
  stock: '',
})

function openNewProduct() {
  editingProduct.value = null
  productForm.value = { name: '', description: '', image_url: '', price_coins: '', stock: '' }
  productFormOpen.value = true
}

function openEditProduct(p: AlpicoinsProduct) {
  editingProduct.value = p
  productForm.value = {
    name: p.name,
    description: p.description ?? '',
    image_url: p.image_url ?? '',
    price_coins: String(p.price_coins),
    stock: p.stock != null ? String(p.stock) : '',
  }
  productFormOpen.value = true
}

async function submitProductForm() {
  if (!uid.value || !productForm.value.name.trim() || !productForm.value.price_coins) return
  const payload = {
    name: productForm.value.name.trim(),
    description: productForm.value.description.trim() || null,
    image_url: productForm.value.image_url.trim() || null,
    price_coins: Number(productForm.value.price_coins),
    stock: productForm.value.stock ? Number(productForm.value.stock) : null,
  }
  if (editingProduct.value) {
    await updateProduct.mutateAsync({ id: editingProduct.value.id, patch: payload })
    ui.pushToast('Produto atualizado.', 'success')
  } else {
    await createProduct.mutateAsync({ ...payload, created_by: uid.value })
    ui.pushToast('Produto criado.', 'success')
  }
  productFormOpen.value = false
}

async function handleDeleteProduct(id: string) {
  if (!confirm('Excluir este produto?')) return
  await deleteProduct.mutateAsync(id)
  ui.pushToast('Produto excluído.', 'success')
}

// ── Helpers ───────────────────────────────────────────────────────────
const EARN_STATUS_LABEL: Record<AlpicoinsEarnStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Recusado',
}
const EARN_STATUS_COLOR: Record<AlpicoinsEarnStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}
const REDEEM_STATUS_LABEL: Record<AlpicoinsRedemptionStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Recusado',
  delivered: 'Entregue',
}
const REDEEM_STATUS_COLOR: Record<AlpicoinsRedemptionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  delivered: 'bg-green-100 text-green-700',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const pendingEarnCount = computed(() => (allEarnQ.data.value ?? []).filter(r => r.status === 'pending').length)
const pendingRedeemCount = computed(() => (allRedeemQ.data.value ?? []).filter(r => r.status === 'pending').length)
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-ink flex items-center gap-2">
          <Coins class="w-7 h-7 text-brand-600" :stroke-width="1.75" />
          Alpicoins
        </h1>
        <p class="text-sm text-muted mt-0.5">Troque suas conquistas por prêmios</p>
      </div>

      <!-- Saldo -->
      <div class="bg-brand-50 border border-brand-200 rounded-2xl px-6 py-3 flex items-center gap-3">
        <Coins class="w-6 h-6 text-brand-600" :stroke-width="1.75" />
        <div>
          <p class="text-xs text-brand-600 font-medium uppercase tracking-wide">Seu saldo</p>
          <p class="text-2xl font-bold text-brand-700 leading-none">
            {{ balanceQ.isLoading.value ? '…' : balance.toLocaleString('pt-BR') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex flex-wrap gap-1 bg-surface rounded-xl p-1 w-fit">
      <button
        v-for="t in auth.isAdmin
          ? [{ key: 'shop', label: 'Lojinha' }, { key: 'history', label: 'Meu histórico' }, { key: 'ranking', label: 'Ranking' }, { key: 'admin', label: 'Administrar' }]
          : [{ key: 'shop', label: 'Lojinha' }, { key: 'history', label: 'Meu histórico' }, { key: 'ranking', label: 'Ranking' }]"
        :key="t.key"
        class="relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
        :class="tab === t.key ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'"
        @click="setTab(t.key)"
      >
        {{ t.label }}
        <span
          v-if="t.key === 'admin' && (pendingEarnCount + pendingRedeemCount) > 0"
          class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none"
        >
          {{ pendingEarnCount + pendingRedeemCount }}
        </span>
      </button>
    </div>

    <!-- ── TAB: LOJINHA ─────────────────────────────────────────────── -->
    <template v-if="tab === 'shop'">
      <!-- Solicitar coins -->
      <div class="card p-6">
        <button
          class="w-full flex items-center justify-between text-left"
          @click="earnFormOpen = !earnFormOpen"
        >
          <div class="flex items-center gap-2">
            <Plus class="w-4 h-4 text-brand-600" />
            <span class="font-medium text-ink text-sm">Solicitar Alpicoins</span>
          </div>
          <ChevronDown v-if="!earnFormOpen" class="w-4 h-4 text-muted" />
          <ChevronUp v-else class="w-4 h-4 text-muted" />
        </button>

        <div v-if="earnFormOpen" class="mt-5 pt-5 border-t border-line space-y-5">
          <div class="space-y-1.5">
            <label class="label">O que você fez?</label>
            <select v-model="earnForm.action" class="input">
              <option value="" disabled>Selecione uma ação…</option>
              <option v-for="a in EARN_ACTIONS" :key="a.label" :value="a.label">
                {{ a.label }} (+{{ a.coins }} coins)
              </option>
            </select>
          </div>

          <!-- Preview de coins -->
          <div
            v-if="selectedAction"
            class="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-xl px-4 py-2.5"
          >
            <Coins class="w-4 h-4 text-brand-600 shrink-0" />
            <span class="text-sm text-brand-700">
              Você receberá <strong>+{{ selectedAction.coins }} Alpicoins</strong> após aprovação.
            </span>
          </div>

          <div class="space-y-1.5">
            <label class="label">Detalhes adicionais <span class="text-muted font-normal">(opcional)</span></label>
            <textarea
              v-model="earnForm.notes"
              class="input resize-none"
              rows="2"
              placeholder="Ex: Nome do curso, link, data do evento…"
            />
          </div>

          <p class="text-xs text-muted">O time de Gente &amp; Gestão irá avaliar e aprovar seu pedido.</p>
          <div class="flex justify-end gap-2 pt-1">
            <button
              class="btn-ghost btn-sm"
              :disabled="createEarn.isPending.value"
              @click="earnFormOpen = false"
            >Cancelar</button>
            <button
              class="btn-primary btn-sm"
              :disabled="!selectedAction || createEarn.isPending.value"
              @click="submitEarnRequest"
            >
              {{ createEarn.isPending.value ? 'Enviando…' : 'Enviar pedido' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Produtos -->
      <div v-if="productsQ.isLoading.value" class="text-center py-12 text-muted text-sm">
        Carregando prêmios…
      </div>
      <div
        v-else-if="(productsQ.data.value ?? []).filter(p => p.is_active).length === 0"
        class="text-center py-16 text-muted"
      >
        <ShoppingBag class="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p class="text-sm">Nenhum prêmio disponível ainda.</p>
      </div>
      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="product in (productsQ.data.value ?? []).filter(p => p.is_active)"
          :key="product.id"
          class="card !p-0 overflow-hidden flex flex-col transition-all duration-200"
          :class="canAfford(product) ? '' : 'opacity-60'"
        >
          <!-- Imagem -->
          <div class="aspect-square bg-surface relative overflow-hidden">
            <img
              v-if="product.image_url"
              :src="product.image_url"
              :alt="product.name"
              class="w-full h-full object-cover transition-all duration-200"
              :class="canAfford(product) ? '' : 'grayscale'"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <ShoppingBag class="w-10 h-10 text-muted opacity-30" />
            </div>

            <!-- Badge disponível / insuficiente -->
            <span
              class="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full"
              :class="canAfford(product) ? 'bg-green-100 text-green-700' : 'bg-surface text-muted'"
            >
              {{ canAfford(product) ? 'Disponível' : 'Saldo insuficiente' }}
            </span>
          </div>

          <!-- Info -->
          <div class="p-3 flex flex-col gap-2 flex-1">
            <p class="text-sm font-semibold text-ink leading-snug">{{ product.name }}</p>
            <p v-if="product.description" class="text-xs text-muted leading-snug line-clamp-2">
              {{ product.description }}
            </p>
            <div class="flex items-center gap-1 mt-auto">
              <Coins class="w-3.5 h-3.5 text-brand-600" />
              <span class="text-sm font-bold text-brand-700">{{ product.price_coins.toLocaleString('pt-BR') }}</span>
            </div>
            <button
              class="btn-primary btn-sm w-full mt-1"
              :disabled="!canAfford(product) || redeemingId !== null"
              @click="handleRedeem(product)"
            >
              {{ redeemingId === product.id ? 'Enviando…' : 'Resgatar' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── TAB: HISTÓRICO ───────────────────────────────────────────── -->
    <template v-else-if="tab === 'history'">
      <div class="grid md:grid-cols-2 gap-6">

        <!-- Pedidos de coins -->
        <div class="card p-6 space-y-4">
          <h2 class="font-semibold text-ink text-sm flex items-center gap-2">
            <Coins class="w-4 h-4 text-brand-600" />
            Pedidos de coins
          </h2>
          <button class="btn-ghost btn-sm w-full" @click="earnFormOpen = !earnFormOpen; tab = 'shop'">
            <Plus class="w-3.5 h-3.5" /> Novo pedido
          </button>
          <div v-if="earnRequestsQ.isLoading.value" class="text-center py-6 text-muted text-sm">Carregando…</div>
          <div v-else-if="(earnRequestsQ.data.value ?? []).length === 0" class="text-center py-6 text-muted text-sm">
            Nenhum pedido ainda.
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="r in earnRequestsQ.data.value"
              :key="r.id"
              class="flex items-start justify-between gap-2 text-sm py-2 border-b border-line last:border-0"
            >
              <div class="flex-1 min-w-0">
                <p class="text-ink truncate">{{ r.description }}</p>
                <p class="text-xs text-muted">{{ formatDate(r.created_at) }}</p>
                <p v-if="r.review_note" class="text-xs text-muted italic mt-0.5">"{{ r.review_note }}"</p>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <span class="font-semibold text-brand-700">+{{ r.coins_requested }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full" :class="EARN_STATUS_COLOR[r.status]">
                  {{ EARN_STATUS_LABEL[r.status] }}
                </span>
              </div>
            </li>
          </ul>
        </div>

        <!-- Resgates -->
        <div class="card p-6 space-y-4">
          <h2 class="font-semibold text-ink text-sm flex items-center gap-2">
            <ShoppingBag class="w-4 h-4 text-brand-600" />
            Meus resgates
          </h2>
          <div v-if="redemptionsQ.isLoading.value" class="text-center py-6 text-muted text-sm">Carregando…</div>
          <div v-else-if="(redemptionsQ.data.value ?? []).length === 0" class="text-center py-6 text-muted text-sm">
            Nenhum resgate ainda.
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="r in redemptionsQ.data.value"
              :key="r.id"
              class="flex items-start justify-between gap-2 text-sm py-2 border-b border-line last:border-0"
            >
              <div class="flex-1 min-w-0">
                <p class="text-ink text-xs text-muted">{{ formatDate(r.created_at) }}</p>
                <p v-if="r.review_note" class="text-xs text-muted italic mt-0.5">"{{ r.review_note }}"</p>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full shrink-0" :class="REDEEM_STATUS_COLOR[r.status]">
                {{ REDEEM_STATUS_LABEL[r.status] }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Extrato -->
        <div class="card p-6 space-y-4 md:col-span-2">
          <h2 class="font-semibold text-ink text-sm flex items-center gap-2">
            <Clock class="w-4 h-4 text-brand-600" />
            Extrato de movimentações
          </h2>
          <div v-if="transactionsQ.isLoading.value" class="text-center py-6 text-muted text-sm">Carregando…</div>
          <div v-else-if="(transactionsQ.data.value ?? []).length === 0" class="text-center py-6 text-muted text-sm">
            Nenhuma movimentação ainda.
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="t in transactionsQ.data.value"
              :key="t.id"
              class="flex items-center justify-between gap-2 text-sm py-2 border-b border-line last:border-0"
            >
              <div class="flex-1 min-w-0">
                <p class="text-ink">{{ t.description }}</p>
                <p class="text-xs text-muted">{{ formatDate(t.created_at) }}</p>
              </div>
              <span class="font-bold" :class="t.coins > 0 ? 'text-green-600' : 'text-red-500'">
                {{ t.coins > 0 ? '+' : '' }}{{ t.coins.toLocaleString('pt-BR') }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <!-- ── TAB: RANKING ────────────────────────────────────────────── -->
    <template v-else-if="tab === 'ranking'">
      <div class="card p-6 space-y-5">
        <h2 class="font-semibold text-ink flex items-center gap-2">
          <Trophy class="w-4 h-4 text-brand-600" />
          Ranking de Alpicoins
        </h2>

        <div v-if="rankingQ.isLoading.value" class="text-center py-10 text-muted text-sm">
          Carregando ranking…
        </div>
        <div
          v-else-if="(rankingQ.data.value ?? []).length === 0"
          class="text-center py-10 text-muted"
        >
          <Trophy class="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p class="text-sm">Nenhum colaborador encontrado.</p>
        </div>

        <ol v-else class="space-y-2">
          <li
            v-for="(entry, index) in rankingQ.data.value"
            :key="entry.id"
            class="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors"
            :class="index === 0 ? 'bg-yellow-50 border border-yellow-200' : index === 1 ? 'bg-slate-50 border border-slate-200' : index === 2 ? 'bg-orange-50 border border-orange-200' : 'hover:bg-surface'"
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

            <!-- Saldo -->
            <div class="flex items-center gap-1.5 shrink-0">
              <Coins class="w-4 h-4 text-brand-600" :stroke-width="1.75" />
              <span class="text-base font-bold text-brand-700">
                {{ entry.balance.toLocaleString('pt-BR') }}
              </span>
            </div>
          </li>
        </ol>
      </div>
    </template>

    <!-- ── TAB: ADMIN ───────────────────────────────────────────────── -->
    <template v-else-if="tab === 'admin' && auth.isAdmin">
      <div class="space-y-6">

        <!-- Pedidos de ganho pendentes -->
        <div class="card p-6 space-y-5">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-ink flex items-center gap-2">
              <Coins class="w-4 h-4 text-brand-600" />
              Pedidos de Alpicoins
              <span v-if="pendingEarnCount > 0" class="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                {{ pendingEarnCount }} pendente{{ pendingEarnCount > 1 ? 's' : '' }}
              </span>
            </h2>
          </div>

          <div v-if="allEarnQ.isLoading.value" class="text-center py-6 text-muted text-sm">Carregando…</div>
          <div v-else-if="(allEarnQ.data.value ?? []).length === 0" class="text-center py-6 text-muted text-sm">
            Nenhum pedido.
          </div>
          <ul v-else class="space-y-4">
            <li
              v-for="r in allEarnQ.data.value"
              :key="r.id"
              class="border border-line rounded-2xl p-5 space-y-4"
              :class="r.status === 'pending' ? 'bg-yellow-50/40 border-yellow-200' : ''"
            >
              <div class="flex items-start gap-3">
                <img
                  v-if="r.profile?.avatar_url"
                  :src="r.profile.avatar_url"
                  class="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div class="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0" v-else>
                  {{ (r.profile?.full_name ?? '?')[0] }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-ink">{{ r.profile?.full_name ?? r.profile?.email }}</p>
                  <p class="text-sm text-muted mt-1 leading-relaxed">{{ r.description }}</p>
                  <p class="text-xs text-muted mt-1.5">{{ formatDate(r.created_at) }}</p>
                </div>
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <span class="font-bold text-brand-700 text-base">{{ r.coins_requested }} coins</span>
                  <span class="text-xs px-2.5 py-1 rounded-full font-medium" :class="EARN_STATUS_COLOR[r.status]">
                    {{ EARN_STATUS_LABEL[r.status] }}
                  </span>
                </div>
              </div>

              <template v-if="r.status === 'pending'">
                <div class="space-y-1.5">
                  <label class="label">Observação (opcional)</label>
                  <input
                    v-model="earnReviewNote[r.id]"
                    class="input"
                    placeholder="Motivo da recusa ou nota de aprovação"
                  />
                </div>
                <div class="flex gap-2 justify-end pt-1">
                  <button
                    class="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                    :disabled="reviewingEarnId === r.id"
                    @click="handleReviewEarn(r, 'rejected')"
                  >
                    <XCircle class="w-3.5 h-3.5" /> Recusar
                  </button>
                  <button
                    class="btn-primary btn-sm"
                    :disabled="reviewingEarnId === r.id"
                    @click="handleReviewEarn(r, 'approved')"
                  >
                    <CheckCircle2 class="w-3.5 h-3.5" /> Aprovar
                  </button>
                </div>
              </template>
            </li>
          </ul>
        </div>

        <!-- Resgates pendentes -->
        <div class="card p-6 space-y-5">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-ink flex items-center gap-2">
              <ShoppingBag class="w-4 h-4 text-brand-600" />
              Pedidos de resgate
              <span v-if="pendingRedeemCount > 0" class="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                {{ pendingRedeemCount }} pendente{{ pendingRedeemCount > 1 ? 's' : '' }}
              </span>
            </h2>
          </div>

          <div v-if="allRedeemQ.isLoading.value" class="text-center py-6 text-muted text-sm">Carregando…</div>
          <div v-else-if="(allRedeemQ.data.value ?? []).length === 0" class="text-center py-6 text-muted text-sm">
            Nenhum resgate.
          </div>
          <ul v-else class="space-y-4">
            <li
              v-for="r in allRedeemQ.data.value"
              :key="r.id"
              class="border border-line rounded-2xl p-5 space-y-4"
              :class="r.status === 'pending' ? 'bg-yellow-50/40 border-yellow-200' : r.status === 'approved' ? 'bg-blue-50/30 border-blue-200' : ''"
            >
              <div class="flex items-start gap-3">
                <img
                  v-if="r.profile?.avatar_url"
                  :src="r.profile.avatar_url"
                  class="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div class="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0" v-else>
                  {{ (r.profile?.full_name ?? '?')[0] }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-ink">{{ r.profile?.full_name ?? r.profile?.email }}</p>
                  <p class="text-sm text-muted mt-1">Prêmio: <span class="font-medium text-ink">{{ r.product?.name ?? '—' }}</span></p>
                  <p class="text-xs text-muted mt-1.5">{{ formatDate(r.created_at) }}</p>
                </div>
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <span class="font-bold text-red-600 text-base">-{{ r.product?.price_coins ?? 0 }} coins</span>
                  <span class="text-xs px-2.5 py-1 rounded-full font-medium" :class="REDEEM_STATUS_COLOR[r.status]">
                    {{ REDEEM_STATUS_LABEL[r.status] }}
                  </span>
                </div>
              </div>

              <template v-if="r.status === 'pending'">
                <div class="space-y-1.5">
                  <label class="label">Observação (opcional)</label>
                  <input
                    v-model="redeemReviewNote[r.id]"
                    class="input"
                    placeholder="Motivo da recusa ou nota de aprovação"
                  />
                </div>
                <div class="flex gap-2 justify-end pt-1">
                  <button
                    class="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                    :disabled="reviewingRedeemId === r.id"
                    @click="handleReviewRedeem(r, 'rejected')"
                  >
                    <XCircle class="w-3.5 h-3.5" /> Recusar
                  </button>
                  <button
                    class="btn-primary btn-sm"
                    :disabled="reviewingRedeemId === r.id"
                    @click="handleReviewRedeem(r, 'approved')"
                  >
                    <CheckCircle2 class="w-3.5 h-3.5" /> Aprovar
                  </button>
                </div>
              </template>
              <template v-else-if="r.status === 'approved'">
                <div class="flex justify-end pt-1">
                  <button
                    class="btn-primary btn-sm"
                    :disabled="reviewingRedeemId === r.id"
                    @click="handleReviewRedeem(r, 'delivered')"
                  >
                    <CheckCircle2 class="w-3.5 h-3.5" /> Marcar como entregue
                  </button>
                </div>
              </template>
            </li>
          </ul>
        </div>

        <!-- Catálogo de produtos -->
        <div class="card p-6 space-y-5">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-ink flex items-center gap-2">
              <ShoppingBag class="w-4 h-4 text-brand-600" />
              Catálogo de prêmios
            </h2>
            <button class="btn-primary btn-sm" @click="openNewProduct">
              <Plus class="w-3.5 h-3.5" /> Novo prêmio
            </button>
          </div>

          <!-- Formulário de produto -->
          <div v-if="productFormOpen" class="border border-brand-200 rounded-2xl p-6 space-y-5 bg-brand-50/40">
            <h3 class="text-base font-semibold text-ink pb-3 border-b border-line">
              {{ editingProduct ? 'Editar prêmio' : 'Novo prêmio' }}
            </h3>
            <div class="space-y-1.5">
              <label class="label">Nome</label>
              <input v-model="productForm.name" class="input" placeholder="Ex: Ingresso de cinema" />
            </div>
            <div class="space-y-1.5">
              <label class="label">Descrição</label>
              <textarea v-model="productForm.description" class="input resize-none" rows="3" placeholder="Descreva o prêmio brevemente" />
            </div>
            <div class="space-y-1.5">
              <label class="label">URL da imagem</label>
              <input v-model="productForm.image_url" class="input" placeholder="https://..." />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="label">Preço (coins)</label>
                <input v-model="productForm.price_coins" type="number" min="1" class="input" placeholder="100" />
              </div>
              <div class="space-y-1.5">
                <label class="label">Estoque <span class="text-muted font-normal">(vazio = ilimitado)</span></label>
                <input v-model="productForm.stock" type="number" min="1" class="input" placeholder="—" />
              </div>
            </div>
            <div class="flex gap-2 justify-end pt-1">
              <button
                class="btn-ghost btn-sm"
                :disabled="createProduct.isPending.value || updateProduct.isPending.value"
                @click="productFormOpen = false"
              >Cancelar</button>
              <button
                class="btn-primary btn-sm"
                :disabled="!productForm.name.trim() || !productForm.price_coins || createProduct.isPending.value || updateProduct.isPending.value"
                @click="submitProductForm"
              >
                {{ createProduct.isPending.value || updateProduct.isPending.value ? 'Salvando…' : 'Salvar prêmio' }}
              </button>
            </div>
          </div>

          <div v-if="productsQ.isLoading.value" class="text-center py-6 text-muted text-sm">Carregando…</div>
          <div v-else-if="(productsQ.data.value ?? []).length === 0" class="text-center py-6 text-muted text-sm">
            Nenhum produto cadastrado.
          </div>
          <ul v-else class="divide-y divide-line">
            <li
              v-for="p in productsQ.data.value"
              :key="p.id"
              class="flex items-center gap-4 py-4"
            >
              <img
                v-if="p.image_url"
                :src="p.image_url"
                class="w-12 h-12 rounded-xl object-cover shrink-0"
              />
              <div class="w-12 h-12 rounded-xl bg-surface border border-line flex items-center justify-center shrink-0" v-else>
                <ShoppingBag class="w-5 h-5 text-muted opacity-40" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-ink">{{ p.name }}</p>
                <p class="text-xs text-muted flex items-center gap-1 mt-0.5">
                  <Coins class="w-3 h-3" /> {{ p.price_coins.toLocaleString('pt-BR') }} coins
                  <span v-if="!p.is_active" class="ml-2 text-red-500 font-medium">(inativo)</span>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn-ghost btn-sm" @click="openEditProduct(p)">Editar</button>
                <button
                  class="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                  @click="handleDeleteProduct(p.id)"
                >Excluir</button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>

  </div>
</template>
