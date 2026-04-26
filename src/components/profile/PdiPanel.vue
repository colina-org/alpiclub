<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  usePdiCycles,
  useCreatePdiCycle,
  useUpdatePdiCycle,
  useDeletePdiCycle,
  usePdiGoals,
  useCreatePdiGoal,
  useUpdatePdiGoal,
  useDeletePdiGoal,
  usePdiCheckIns,
  useCreatePdiCheckIn,
  useDeletePdiCheckIn,
  useGoalResources,
  useAttachResource,
  useDetachResource,
} from '@/composables/usePdi'
import { useReadsByProfile } from '@/composables/useBookReads'
import { useCourses } from '@/composables/useCourses'
import { useAchievementsByRecipient } from '@/composables/useAchievements'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import {
  PDI_CYCLE_STATUS,
  PDI_GOAL_CATEGORY,
  PDI_GOAL_STATUS,
  PDI_RESOURCE_TYPE,
  type PdiCycle,
  type PdiCycleStatus,
  type PdiGoal,
  type PdiGoalCategory,
  type PdiGoalStatus,
  type PdiResourceType,
} from '@/types/database'
import { initials, timeAgo } from '@/lib/format'

const props = defineProps<{
  profileId: string
  // True para Head/Líder/admin/dono — pode editar ciclos, metas, recursos e avaliação do gestor.
  canManage: boolean
  // True só para a própria pessoa — pode editar a auto-avaliação.
  isOwn: boolean
}>()

const auth = useAuthStore()
const ui = useUiStore()

const cyclesQuery = usePdiCycles(() => props.profileId)
const createCycle = useCreatePdiCycle()
const updateCycle = useUpdatePdiCycle()
const deleteCycle = useDeletePdiCycle()

const selectedCycleId = ref<string | null>(null)

watch(cyclesQuery.data, (cycles) => {
  if (!cycles || cycles.length === 0) {
    selectedCycleId.value = null
    return
  }
  if (selectedCycleId.value && cycles.find((c) => c.id === selectedCycleId.value)) return
  const active = cycles.find((c) => c.status === 'active')
  selectedCycleId.value = active?.id ?? cycles[0].id
}, { immediate: true })

const selectedCycle = computed<PdiCycle | null>(() =>
  cyclesQuery.data.value?.find((c) => c.id === selectedCycleId.value) ?? null,
)

// ---------------------------------------------------------------------
// Cycle form
// ---------------------------------------------------------------------
type CycleFormState = {
  id: string | null
  title: string
  status: PdiCycleStatus
  started_at: string
  ends_at: string
  summary: string
}

const emptyCycleForm = (): CycleFormState => ({
  id: null,
  title: '',
  status: 'active',
  started_at: '',
  ends_at: '',
  summary: '',
})

const cycleFormOpen = ref(false)
const cycleForm = ref<CycleFormState>(emptyCycleForm())

function openCreateCycle() {
  cycleForm.value = emptyCycleForm()
  cycleFormOpen.value = true
}

function openEditCycle(c: PdiCycle) {
  cycleForm.value = {
    id: c.id,
    title: c.title,
    status: c.status,
    started_at: c.started_at ?? '',
    ends_at: c.ends_at ?? '',
    summary: c.summary ?? '',
  }
  cycleFormOpen.value = true
}

async function handleSubmitCycle() {
  if (!cycleForm.value.title.trim()) return
  const payload = {
    title: cycleForm.value.title.trim(),
    status: cycleForm.value.status,
    started_at: cycleForm.value.started_at || null,
    ends_at: cycleForm.value.ends_at || null,
    summary: cycleForm.value.summary.trim() || null,
  }
  try {
    if (cycleForm.value.id) {
      await updateCycle.mutateAsync({
        id: cycleForm.value.id,
        patch: payload,
        profileId: props.profileId,
      })
      ui.pushToast('Ciclo atualizado.', 'success')
    } else {
      const created = await createCycle.mutateAsync({
        ...payload,
        profile_id: props.profileId,
      })
      ui.pushToast('Ciclo criado.', 'success')
      selectedCycleId.value = created.id
    }
    cycleFormOpen.value = false
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao salvar ciclo.', 'error')
  }
}

async function handleDeleteCycle() {
  if (!selectedCycle.value) return
  if (!confirm(`Excluir o ciclo "${selectedCycle.value.title}"? Todas as metas, recursos e check-ins serão removidos.`))
    return
  try {
    await deleteCycle.mutateAsync({
      id: selectedCycle.value.id,
      profileId: props.profileId,
    })
    ui.pushToast('Ciclo excluído.', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao excluir ciclo.', 'error')
  }
}

// ---------------------------------------------------------------------
// Close / reopen cycle
// ---------------------------------------------------------------------
async function handleCloseCycle() {
  if (!selectedCycle.value) return
  if (!confirm('Encerrar este ciclo? Você ainda poderá editar as avaliações depois.')) return
  try {
    await updateCycle.mutateAsync({
      id: selectedCycle.value.id,
      patch: { status: 'completed', closed_at: new Date().toISOString() },
      profileId: props.profileId,
    })
    ui.pushToast('Ciclo encerrado.', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao encerrar.', 'error')
  }
}

async function handleReopenCycle() {
  if (!selectedCycle.value) return
  try {
    await updateCycle.mutateAsync({
      id: selectedCycle.value.id,
      patch: { status: 'active', closed_at: null },
      profileId: props.profileId,
    })
    ui.pushToast('Ciclo reaberto.', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao reabrir.', 'error')
  }
}

// ---------------------------------------------------------------------
// Snapshot (assessments)
// ---------------------------------------------------------------------
const editingSelf = ref(false)
const editingManager = ref(false)
const selfDraft = ref<{ text: string; score: number | null }>({ text: '', score: null })
const managerDraft = ref<{ text: string; score: number | null }>({ text: '', score: null })

watch(selectedCycle, (c) => {
  if (!c) return
  selfDraft.value = { text: c.self_assessment ?? '', score: c.self_assessment_score }
  managerDraft.value = { text: c.manager_assessment ?? '', score: c.manager_assessment_score }
  editingSelf.value = false
  editingManager.value = false
}, { immediate: true })

async function saveSelfAssessment() {
  if (!selectedCycle.value) return
  try {
    await updateCycle.mutateAsync({
      id: selectedCycle.value.id,
      patch: {
        self_assessment: selfDraft.value.text.trim() || null,
        self_assessment_score: selfDraft.value.score,
      },
      profileId: props.profileId,
    })
    ui.pushToast('Auto-avaliação salva.', 'success')
    editingSelf.value = false
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error')
  }
}

async function saveManagerAssessment() {
  if (!selectedCycle.value || !auth.user?.id) return
  try {
    await updateCycle.mutateAsync({
      id: selectedCycle.value.id,
      patch: {
        manager_assessment: managerDraft.value.text.trim() || null,
        manager_assessment_score: managerDraft.value.score,
        manager_assessment_by_id: managerDraft.value.text.trim()
          ? auth.user.id
          : selectedCycle.value.manager_assessment_by_id,
      },
      profileId: props.profileId,
    })
    ui.pushToast('Avaliação do gestor salva.', 'success')
    editingManager.value = false
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error')
  }
}

const showAssessments = computed(() => {
  const c = selectedCycle.value
  if (!c) return false
  return (
    c.status === 'completed' ||
    !!c.self_assessment ||
    !!c.manager_assessment
  )
})

// ---------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------
const goalsQuery = usePdiGoals(() => selectedCycleId.value ?? undefined)
const createGoal = useCreatePdiGoal()
const updateGoal = useUpdatePdiGoal()
const deleteGoal = useDeletePdiGoal()

type GoalFormState = {
  id: string | null
  title: string
  description: string
  category: PdiGoalCategory
  status: PdiGoalStatus
  progress: number | string
  target_date: string
  priority: number | string
}

const emptyGoalForm = (): GoalFormState => ({
  id: null,
  title: '',
  description: '',
  category: 'hard_skill',
  status: 'not_started',
  progress: 0,
  target_date: '',
  priority: 0,
})

const goalFormOpen = ref(false)
const goalForm = ref<GoalFormState>(emptyGoalForm())

function openCreateGoal() {
  goalForm.value = emptyGoalForm()
  goalFormOpen.value = true
}

function openEditGoal(g: PdiGoal) {
  goalForm.value = {
    id: g.id,
    title: g.title,
    description: g.description ?? '',
    category: g.category,
    status: g.status,
    progress: g.progress,
    target_date: g.target_date ?? '',
    priority: g.priority,
  }
  goalFormOpen.value = true
}

function buildGoalPayload() {
  const progress = Number(goalForm.value.progress)
  const priority = Number(goalForm.value.priority)
  return {
    title: goalForm.value.title.trim(),
    description: goalForm.value.description.trim() || null,
    category: goalForm.value.category,
    status: goalForm.value.status,
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0,
    target_date: goalForm.value.target_date || null,
    priority: Number.isFinite(priority) ? priority : 0,
  }
}

async function handleSubmitGoal() {
  if (!selectedCycleId.value || !goalForm.value.title.trim()) return
  try {
    if (goalForm.value.id) {
      await updateGoal.mutateAsync({
        id: goalForm.value.id,
        patch: buildGoalPayload(),
        cycleId: selectedCycleId.value,
      })
      ui.pushToast('Meta atualizada.', 'success')
    } else {
      await createGoal.mutateAsync({
        ...buildGoalPayload(),
        cycle_id: selectedCycleId.value,
      })
      ui.pushToast('Meta adicionada.', 'success')
    }
    goalFormOpen.value = false
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao salvar meta.', 'error')
  }
}

async function handleDeleteGoal(g: PdiGoal) {
  if (!confirm(`Excluir a meta "${g.title}"?`)) return
  try {
    await deleteGoal.mutateAsync({ id: g.id, cycleId: g.cycle_id })
    ui.pushToast('Meta excluída.', 'success')
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao excluir meta.', 'error')
  }
}

async function quickUpdateGoal(g: PdiGoal, patch: Partial<PdiGoal>) {
  try {
    await updateGoal.mutateAsync({
      id: g.id,
      patch: patch as never,
      cycleId: g.cycle_id,
    })
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao atualizar meta.', 'error')
  }
}

// ---------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------
const resourcesQuery = useGoalResources(() => selectedCycleId.value ?? undefined)
const attachResource = useAttachResource()
const detachResource = useDetachResource()

const resourcePickerGoalId = ref<string | null>(null)
const pickerTab = ref<PdiResourceType>('book')

const personReads = useReadsByProfile(() => props.profileId)
const personCourses = useCourses(() => props.profileId)
const personAchievements = useAchievementsByRecipient(() => props.profileId)

function openResourcePicker(goalId: string) {
  resourcePickerGoalId.value = goalId
  pickerTab.value = 'book'
}

function closeResourcePicker() {
  resourcePickerGoalId.value = null
}

function isAttached(goalId: string, type: PdiResourceType, resourceId: string) {
  return (resourcesQuery.data.value?.[goalId] ?? []).some(
    (r) => r.resource_type === type && r.resource_id === resourceId,
  )
}

async function handleAttach(goalId: string, type: PdiResourceType, resourceId: string) {
  if (!selectedCycleId.value) return
  try {
    await attachResource.mutateAsync({
      goal_id: goalId,
      resource_type: type,
      resource_id: resourceId,
      cycleId: selectedCycleId.value,
    })
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao anexar recurso.', 'error')
  }
}

async function handleDetach(linkId: string) {
  if (!selectedCycleId.value) return
  try {
    await detachResource.mutateAsync({ id: linkId, cycleId: selectedCycleId.value })
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao remover recurso.', 'error')
  }
}

// ---------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------
const checkInsQuery = usePdiCheckIns(() => selectedCycleId.value ?? undefined)
const createCheckIn = useCreatePdiCheckIn()
const deleteCheckIn = useDeletePdiCheckIn()

const newComment = ref('')

async function handleSubmitCheckIn() {
  if (!selectedCycleId.value || !newComment.value.trim() || !auth.user?.id) return
  try {
    await createCheckIn.mutateAsync({
      cycle_id: selectedCycleId.value,
      author_id: auth.user.id,
      message: newComment.value.trim(),
    })
    newComment.value = ''
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao comentar.', 'error')
  }
}

async function handleDeleteCheckIn(id: string) {
  if (!selectedCycleId.value) return
  if (!confirm('Excluir este comentário?')) return
  try {
    await deleteCheckIn.mutateAsync({ id, cycleId: selectedCycleId.value })
  } catch (err) {
    ui.pushToast(err instanceof Error ? err.message : 'Erro ao excluir.', 'error')
  }
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function formatDate(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const isMutatingCycle = () =>
  createCycle.isPending.value || updateCycle.isPending.value
const isMutatingGoal = () =>
  createGoal.isPending.value || updateGoal.isPending.value

const goalProgress = computed(() => {
  const goals = goalsQuery.data.value ?? []
  if (goals.length === 0) return null
  const total = goals.reduce((sum, g) => sum + (g.progress ?? 0), 0)
  return Math.round(total / goals.length)
})
</script>

<template>
  <section class="card p-6 space-y-6">
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h2 class="text-base font-semibold">PDI</h2>
        <p class="mt-0.5 text-xs text-muted">
          Plano de Desenvolvimento Individual. Visível para a pessoa, gestores da equipe e admin.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-if="(cyclesQuery.data.value?.length ?? 0) > 0"
          v-model="selectedCycleId"
          class="input sm:w-56"
        >
          <option v-for="c in cyclesQuery.data.value" :key="c.id" :value="c.id">
            {{ c.title }} · {{ PDI_CYCLE_STATUS[c.status].label }}
          </option>
        </select>
        <button v-if="canManage" class="btn-primary text-sm" @click="openCreateCycle">
          Novo ciclo
        </button>
      </div>
    </header>

    <!-- Cycle form -->
    <div v-if="cycleFormOpen" class="border border-line rounded-2xl p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">{{ cycleForm.id ? 'Editar ciclo' : 'Novo ciclo' }}</h3>
        <button class="btn-ghost text-sm" @click="cycleFormOpen = false">Cancelar</button>
      </div>

      <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="handleSubmitCycle">
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">Título</label>
          <input v-model="cycleForm.title" type="text" required maxlength="120" class="input" placeholder="Ex.: PDI 2026 H1" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Status</label>
          <select v-model="cycleForm.status" class="input">
            <option v-for="(meta, key) in PDI_CYCLE_STATUS" :key="key" :value="key">{{ meta.label }}</option>
          </select>
        </div>
        <div></div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Início</label>
          <input v-model="cycleForm.started_at" type="date" class="input" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1.5">Término previsto</label>
          <input v-model="cycleForm.ends_at" type="date" class="input" />
        </div>

        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">Resumo</label>
          <textarea v-model="cycleForm.summary" rows="2" maxlength="600" class="input resize-none" placeholder="Foco do ciclo, contexto, prioridades..."></textarea>
        </div>

        <div class="sm:col-span-2 flex items-center justify-end gap-3">
          <button type="button" class="btn-secondary" :disabled="isMutatingCycle()" @click="cycleFormOpen = false">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="isMutatingCycle()">
            {{ isMutatingCycle() ? 'Salvando...' : cycleForm.id ? 'Salvar alterações' : 'Criar ciclo' }}
          </button>
        </div>
      </form>
    </div>

    <!-- No cycles -->
    <div
      v-if="!cyclesQuery.isLoading.value && (cyclesQuery.data.value?.length ?? 0) === 0"
      class="text-sm text-muted text-center py-12 border border-dashed border-line rounded-xl"
    >
      <template v-if="canManage">Nenhum ciclo de PDI ainda. Crie um para começar.</template>
      <template v-else>Esta pessoa ainda não tem nenhum ciclo de PDI.</template>
    </div>

    <!-- Cycle detail -->
    <template v-else-if="selectedCycle">
      <!-- Cycle header -->
      <div class="border border-line rounded-2xl p-5 space-y-3">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-base font-semibold">{{ selectedCycle.title }}</h3>
              <span
                class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
                :style="{ backgroundColor: PDI_CYCLE_STATUS[selectedCycle.status].color }"
              >
                {{ PDI_CYCLE_STATUS[selectedCycle.status].label }}
              </span>
            </div>
            <p class="text-xs text-muted mt-1">
              <span v-if="selectedCycle.started_at && selectedCycle.ends_at">
                {{ formatDate(selectedCycle.started_at) }} → {{ formatDate(selectedCycle.ends_at) }}
              </span>
              <span v-else-if="selectedCycle.started_at">Iniciado em {{ formatDate(selectedCycle.started_at) }}</span>
              <span v-else-if="selectedCycle.ends_at">Termina em {{ formatDate(selectedCycle.ends_at) }}</span>
              <span v-else>Sem datas definidas</span>
              <span v-if="selectedCycle.closed_at"> · Encerrado em {{ formatDate(selectedCycle.closed_at.slice(0,10)) }}</span>
            </p>
          </div>

          <div v-if="canManage" class="flex items-center gap-1 flex-wrap">
            <button
              v-if="selectedCycle.status === 'active'"
              class="btn-secondary text-xs"
              @click="handleCloseCycle"
            >
              Encerrar ciclo
            </button>
            <button
              v-else-if="selectedCycle.status === 'completed'"
              class="btn-secondary text-xs"
              @click="handleReopenCycle"
            >
              Reabrir ciclo
            </button>
            <button class="btn-ghost text-xs" @click="openEditCycle(selectedCycle)">Editar</button>
            <button class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50" @click="handleDeleteCycle">
              Excluir
            </button>
          </div>
        </div>

        <p v-if="selectedCycle.summary" class="text-sm text-ink/80 whitespace-pre-line">{{ selectedCycle.summary }}</p>

        <div v-if="goalProgress !== null" class="pt-1">
          <div class="flex items-center justify-between text-xs text-muted mb-1">
            <span>Progresso geral do ciclo</span>
            <span class="font-medium text-ink">{{ goalProgress }}%</span>
          </div>
          <div class="h-2 bg-surface rounded-full overflow-hidden">
            <div class="h-full bg-brand-600 transition-all" :style="{ width: goalProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Snapshot / avaliações finais -->
      <div
        v-if="showAssessments || canManage || isOwn"
        class="border border-line rounded-2xl p-5 space-y-4"
      >
        <div>
          <h3 class="text-sm font-semibold">Avaliação final</h3>
          <p class="mt-0.5 text-xs text-muted">
            Auto-avaliação fica com a pessoa. Avaliação do gestor com Head/Líder/admin.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- SELF -->
          <div class="border border-line rounded-xl p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold">Auto-avaliação</h4>
              <button
                v-if="isOwn && !editingSelf"
                class="btn-ghost text-xs"
                @click="editingSelf = true"
              >
                {{ selectedCycle.self_assessment ? 'Editar' : 'Preencher' }}
              </button>
            </div>

            <template v-if="!editingSelf">
              <div v-if="selectedCycle.self_assessment_score" class="flex items-center gap-1 text-yellow-500">
                <span>{{ '★'.repeat(selectedCycle.self_assessment_score) }}</span>
                <span class="text-line">{{ '★'.repeat(5 - selectedCycle.self_assessment_score) }}</span>
              </div>
              <p v-if="selectedCycle.self_assessment" class="text-sm text-ink/80 whitespace-pre-line">
                {{ selectedCycle.self_assessment }}
              </p>
              <p v-else class="text-xs text-muted italic">Aguardando auto-avaliação.</p>
            </template>

            <template v-else>
              <div>
                <label class="block text-xs font-medium text-muted mb-1.5">Nota (1-5)</label>
                <div class="flex gap-1">
                  <button
                    v-for="n in 5"
                    :key="n"
                    type="button"
                    class="text-2xl transition-transform hover:scale-110"
                    :class="(selfDraft.score ?? 0) >= n ? 'text-yellow-500' : 'text-line'"
                    @click="selfDraft.score = selfDraft.score === n ? null : n"
                  >
                    ★
                  </button>
                </div>
              </div>
              <textarea
                v-model="selfDraft.text"
                rows="4"
                maxlength="1000"
                class="input resize-none"
                placeholder="O que aprendeu? O que foi mais marcante?"
              ></textarea>
              <div class="flex items-center justify-end gap-2">
                <button class="btn-ghost text-xs" @click="editingSelf = false">Cancelar</button>
                <button class="btn-primary text-xs" :disabled="updateCycle.isPending.value" @click="saveSelfAssessment">
                  Salvar
                </button>
              </div>
            </template>
          </div>

          <!-- MANAGER -->
          <div class="border border-line rounded-xl p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold">Avaliação do gestor</h4>
              <button
                v-if="canManage && !isOwn && !editingManager"
                class="btn-ghost text-xs"
                @click="editingManager = true"
              >
                {{ selectedCycle.manager_assessment ? 'Editar' : 'Preencher' }}
              </button>
              <button
                v-else-if="canManage && isOwn && !editingManager"
                class="btn-ghost text-xs"
                @click="editingManager = true"
                title="Você é gestor desta equipe"
              >
                {{ selectedCycle.manager_assessment ? 'Editar' : 'Preencher' }}
              </button>
            </div>

            <template v-if="!editingManager">
              <div v-if="selectedCycle.manager_assessment_score" class="flex items-center gap-1 text-yellow-500">
                <span>{{ '★'.repeat(selectedCycle.manager_assessment_score) }}</span>
                <span class="text-line">{{ '★'.repeat(5 - selectedCycle.manager_assessment_score) }}</span>
              </div>
              <p v-if="selectedCycle.manager_assessment" class="text-sm text-ink/80 whitespace-pre-line">
                {{ selectedCycle.manager_assessment }}
              </p>
              <p v-else class="text-xs text-muted italic">Aguardando avaliação do gestor.</p>
            </template>

            <template v-else>
              <div>
                <label class="block text-xs font-medium text-muted mb-1.5">Nota (1-5)</label>
                <div class="flex gap-1">
                  <button
                    v-for="n in 5"
                    :key="n"
                    type="button"
                    class="text-2xl transition-transform hover:scale-110"
                    :class="(managerDraft.score ?? 0) >= n ? 'text-yellow-500' : 'text-line'"
                    @click="managerDraft.score = managerDraft.score === n ? null : n"
                  >
                    ★
                  </button>
                </div>
              </div>
              <textarea
                v-model="managerDraft.text"
                rows="4"
                maxlength="1000"
                class="input resize-none"
                placeholder="Pontos fortes, evolução, áreas a desenvolver..."
              ></textarea>
              <div class="flex items-center justify-end gap-2">
                <button class="btn-ghost text-xs" @click="editingManager = false">Cancelar</button>
                <button class="btn-primary text-xs" :disabled="updateCycle.isPending.value" @click="saveManagerAssessment">
                  Salvar
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Goals -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Metas</h3>
          <button v-if="canManage && !goalFormOpen" class="btn-secondary text-xs" @click="openCreateGoal">
            Adicionar meta
          </button>
        </div>

        <!-- Goal form -->
        <div v-if="goalFormOpen" class="border border-line rounded-2xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold">{{ goalForm.id ? 'Editar meta' : 'Nova meta' }}</h4>
            <button class="btn-ghost text-sm" @click="goalFormOpen = false">Cancelar</button>
          </div>

          <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="handleSubmitGoal">
            <div class="sm:col-span-2">
              <label class="block text-sm font-medium mb-1.5">Título</label>
              <input v-model="goalForm.title" type="text" required maxlength="180" class="input" placeholder="Ex.: Aprofundar em arquitetura de microsserviços" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">Categoria</label>
              <select v-model="goalForm.category" class="input">
                <option v-for="(meta, key) in PDI_GOAL_CATEGORY" :key="key" :value="key">{{ meta.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">Status</label>
              <select v-model="goalForm.status" class="input">
                <option v-for="(meta, key) in PDI_GOAL_STATUS" :key="key" :value="key">{{ meta.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">Progresso (%)</label>
              <input v-model="goalForm.progress" type="number" min="0" max="100" class="input" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">Data alvo</label>
              <input v-model="goalForm.target_date" type="date" class="input" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-sm font-medium mb-1.5">Descrição</label>
              <textarea v-model="goalForm.description" rows="3" maxlength="600" class="input resize-none" placeholder="Como vai mensurar? Quais ações? Quais recursos?"></textarea>
            </div>
            <div class="sm:col-span-2 flex items-center justify-end gap-3">
              <button type="button" class="btn-secondary" :disabled="isMutatingGoal()" @click="goalFormOpen = false">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="isMutatingGoal()">
                {{ isMutatingGoal() ? 'Salvando...' : goalForm.id ? 'Salvar alterações' : 'Adicionar meta' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Goals list -->
        <div v-if="goalsQuery.isLoading.value" class="text-sm text-muted text-center py-8">Carregando metas...</div>
        <div
          v-else-if="(goalsQuery.data.value?.length ?? 0) === 0"
          class="text-sm text-muted text-center py-12 border border-dashed border-line rounded-xl"
        >
          Nenhuma meta neste ciclo ainda.
        </div>

        <ul v-else class="space-y-3">
          <li
            v-for="goal in goalsQuery.data.value"
            :key="goal.id"
            class="border border-line rounded-2xl p-4 space-y-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
                    :style="{ backgroundColor: PDI_GOAL_CATEGORY[goal.category].color }"
                  >
                    {{ PDI_GOAL_CATEGORY[goal.category].label }}
                  </span>
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
                    :style="{
                      backgroundColor: PDI_GOAL_STATUS[goal.status].color + '20',
                      color: PDI_GOAL_STATUS[goal.status].color,
                    }"
                  >
                    {{ PDI_GOAL_STATUS[goal.status].label }}
                  </span>
                  <span v-if="goal.target_date" class="text-xs text-muted">
                    Alvo: {{ formatDate(goal.target_date) }}
                  </span>
                </div>
                <p class="mt-2 text-sm font-semibold">{{ goal.title }}</p>
                <p v-if="goal.description" class="text-sm text-ink/80 whitespace-pre-line mt-1">
                  {{ goal.description }}
                </p>
              </div>

              <div v-if="canManage" class="flex items-center gap-1 flex-shrink-0">
                <button class="btn-ghost text-xs" @click="openEditGoal(goal)">Editar</button>
                <button class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50" @click="handleDeleteGoal(goal)">
                  Excluir
                </button>
              </div>
            </div>

            <!-- Resources chips -->
            <div class="flex items-center gap-2 flex-wrap">
              <component
                :is="r.link ? 'router-link' : 'span'"
                v-for="r in (resourcesQuery.data.value?.[goal.id] ?? [])"
                :key="r.id"
                :to="r.link ?? undefined"
                class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-surface border border-line hover:border-brand-300 transition-colors"
                :title="r.subtitle ?? ''"
              >
                <span>{{ PDI_RESOURCE_TYPE[r.resource_type].icon }}</span>
                <span class="font-medium truncate max-w-[200px]">{{ r.title }}</span>
                <button
                  v-if="canManage"
                  class="text-muted hover:text-red-600 ml-1"
                  title="Remover"
                  @click.prevent.stop="handleDetach(r.id)"
                >×</button>
              </component>

              <button
                v-if="canManage && resourcePickerGoalId !== goal.id"
                class="text-xs px-2 py-1 rounded-lg border border-dashed border-line text-muted hover:text-ink hover:border-brand-300"
                @click="openResourcePicker(goal.id)"
              >
                + Anexar recurso
              </button>
            </div>

            <!-- Resource picker -->
            <div
              v-if="resourcePickerGoalId === goal.id"
              class="border border-line rounded-xl p-3 space-y-3 bg-surface/50"
            >
              <div class="flex items-center justify-between">
                <div class="flex gap-1">
                  <button
                    v-for="(meta, key) in PDI_RESOURCE_TYPE"
                    :key="key"
                    class="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                    :class="pickerTab === key ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink'"
                    @click="pickerTab = key"
                  >
                    {{ meta.icon }} {{ meta.label }}
                  </button>
                </div>
                <button class="btn-ghost text-xs" @click="closeResourcePicker">Fechar</button>
              </div>

              <!-- Books -->
              <div v-if="pickerTab === 'book'">
                <p v-if="(personReads.data.value?.length ?? 0) === 0" class="text-xs text-muted italic py-2">
                  Esta pessoa ainda não marcou livros na biblioteca.
                </p>
                <ul v-else class="max-h-48 overflow-y-auto divide-y divide-line">
                  <li
                    v-for="r in personReads.data.value"
                    :key="r.id"
                    class="py-2 flex items-center gap-3"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{{ r.book?.title ?? '—' }}</p>
                      <p class="text-xs text-muted truncate">{{ r.book?.author ?? '' }}</p>
                    </div>
                    <button
                      class="text-xs px-2 py-1 rounded-lg"
                      :class="
                        isAttached(goal.id, 'book', r.book?.id ?? '')
                          ? 'bg-surface text-muted cursor-not-allowed'
                          : 'btn-secondary'
                      "
                      :disabled="isAttached(goal.id, 'book', r.book?.id ?? '') || !r.book"
                      @click="r.book && handleAttach(goal.id, 'book', r.book.id)"
                    >
                      {{ isAttached(goal.id, 'book', r.book?.id ?? '') ? 'Anexado' : 'Anexar' }}
                    </button>
                  </li>
                </ul>
              </div>

              <!-- Courses -->
              <div v-if="pickerTab === 'course'">
                <p v-if="(personCourses.data.value?.length ?? 0) === 0" class="text-xs text-muted italic py-2">
                  Esta pessoa ainda não cadastrou cursos.
                </p>
                <ul v-else class="max-h-48 overflow-y-auto divide-y divide-line">
                  <li
                    v-for="c in personCourses.data.value"
                    :key="c.id"
                    class="py-2 flex items-center gap-3"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{{ c.title }}</p>
                      <p class="text-xs text-muted truncate">{{ c.provider ?? '—' }}</p>
                    </div>
                    <button
                      class="text-xs px-2 py-1 rounded-lg"
                      :class="
                        isAttached(goal.id, 'course', c.id)
                          ? 'bg-surface text-muted cursor-not-allowed'
                          : 'btn-secondary'
                      "
                      :disabled="isAttached(goal.id, 'course', c.id)"
                      @click="handleAttach(goal.id, 'course', c.id)"
                    >
                      {{ isAttached(goal.id, 'course', c.id) ? 'Anexado' : 'Anexar' }}
                    </button>
                  </li>
                </ul>
              </div>

              <!-- Achievements -->
              <div v-if="pickerTab === 'achievement'">
                <p v-if="(personAchievements.data.value?.length ?? 0) === 0" class="text-xs text-muted italic py-2">
                  Esta pessoa ainda não recebeu conquistas.
                </p>
                <ul v-else class="max-h-48 overflow-y-auto divide-y divide-line">
                  <li
                    v-for="a in personAchievements.data.value"
                    :key="a.id"
                    class="py-2 flex items-center gap-3"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{{ a.title }}</p>
                      <p class="text-xs text-muted truncate">{{ a.category }}</p>
                    </div>
                    <button
                      class="text-xs px-2 py-1 rounded-lg"
                      :class="
                        isAttached(goal.id, 'achievement', a.id)
                          ? 'bg-surface text-muted cursor-not-allowed'
                          : 'btn-secondary'
                      "
                      :disabled="isAttached(goal.id, 'achievement', a.id)"
                      @click="handleAttach(goal.id, 'achievement', a.id)"
                    >
                      {{ isAttached(goal.id, 'achievement', a.id) ? 'Anexado' : 'Anexar' }}
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Progress bar + quick controls -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted">Progresso</span>
                <span class="font-medium">{{ goal.progress }}%</span>
              </div>
              <div class="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  class="h-full transition-all"
                  :style="{ width: goal.progress + '%', backgroundColor: PDI_GOAL_STATUS[goal.status].color }"
                ></div>
              </div>
              <div v-if="canManage" class="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  :value="goal.progress"
                  class="flex-1 accent-brand-600"
                  @change="quickUpdateGoal(goal, { progress: Number(($event.target as HTMLInputElement).value) })"
                />
                <select
                  :value="goal.status"
                  class="input !py-1 text-xs w-36"
                  @change="quickUpdateGoal(goal, { status: ($event.target as HTMLSelectElement).value as PdiGoalStatus })"
                >
                  <option v-for="(meta, key) in PDI_GOAL_STATUS" :key="key" :value="key">{{ meta.label }}</option>
                </select>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Check-ins -->
      <div class="space-y-4">
        <h3 class="text-sm font-semibold">Comentários</h3>

        <form class="flex gap-2" @submit.prevent="handleSubmitCheckIn">
          <textarea
            v-model="newComment"
            rows="2"
            maxlength="800"
            class="input resize-none flex-1"
            placeholder="Deixe um feedback ou registre um check-in..."
          ></textarea>
          <button
            type="submit"
            class="btn-primary text-sm self-end"
            :disabled="createCheckIn.isPending.value || !newComment.trim()"
          >
            {{ createCheckIn.isPending.value ? '...' : 'Comentar' }}
          </button>
        </form>

        <div v-if="checkInsQuery.isLoading.value" class="text-sm text-muted text-center py-4">Carregando...</div>
        <div v-else-if="(checkInsQuery.data.value?.length ?? 0) === 0" class="text-xs text-muted italic">
          Nenhum comentário ainda.
        </div>

        <ul v-else class="space-y-3">
          <li v-for="ci in checkInsQuery.data.value" :key="ci.id" class="flex items-start gap-3">
            <img
              v-if="ci.author?.avatar_url"
              :src="ci.author.avatar_url"
              :alt="ci.author.full_name ?? ci.author.email"
              class="h-9 w-9 rounded-xl object-cover flex-shrink-0"
            />
            <div
              v-else
              class="h-9 w-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0"
            >
              {{ ci.author ? initials(ci.author.full_name, ci.author.email) : '?' }}
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-semibold">
                  {{ ci.author?.full_name || ci.author?.email?.split('@')[0] || 'Usuário removido' }}
                </p>
                <span class="text-xs text-muted">{{ timeAgo(ci.created_at) }}</span>
              </div>
              <p class="mt-1 text-sm text-ink/90 whitespace-pre-line">{{ ci.message }}</p>
            </div>

            <button
              v-if="ci.author_id === auth.user?.id"
              class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
              @click="handleDeleteCheckIn(ci.id)"
            >
              Excluir
            </button>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
