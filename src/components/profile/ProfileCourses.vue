<script setup lang="ts">
import { ref } from 'vue'
import {
  useCourses,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  type CourseInput,
} from '@/composables/useCourses'
import { useUiStore } from '@/stores/ui'
import { COURSE_STATUS, type Course, type CourseStatus } from '@/types/database'

const props = defineProps<{
  profileId: string
  canEdit: boolean
}>()

const ui = useUiStore()
const coursesQuery = useCourses(() => props.profileId)
const createCourse = useCreateCourse()
const updateCourse = useUpdateCourse()
const deleteCourse = useDeleteCourse()

type FormState = {
  id: string | null
  title: string
  provider: string
  url: string
  status: CourseStatus
  workload_hours: string | number
  started_at: string
  finished_at: string
  certificate_url: string
  notes: string
}

const emptyForm = (): FormState => ({
  id: null,
  title: '',
  provider: '',
  url: '',
  status: 'planned',
  workload_hours: '',
  started_at: '',
  finished_at: '',
  certificate_url: '',
  notes: '',
})

const formOpen = ref(false)
const form = ref<FormState>(emptyForm())

function openCreate() {
  form.value = emptyForm()
  formOpen.value = true
}

function openEdit(c: Course) {
  form.value = {
    id: c.id,
    title: c.title,
    provider: c.provider ?? '',
    url: c.url ?? '',
    status: c.status,
    workload_hours: c.workload_hours != null ? String(c.workload_hours) : '',
    started_at: c.started_at ?? '',
    finished_at: c.finished_at ?? '',
    certificate_url: c.certificate_url ?? '',
    notes: c.notes ?? '',
  }
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
}

function buildPayload(): Omit<CourseInput, 'profile_id'> {
  const wh = form.value.workload_hours
  const workload_hours =
    wh === '' || wh === null || wh === undefined ? null : Number(wh)

  return {
    title: form.value.title.trim(),
    provider: form.value.provider.trim() || null,
    url: form.value.url.trim() || null,
    status: form.value.status,
    workload_hours: Number.isFinite(workload_hours) ? workload_hours : null,
    started_at: form.value.started_at || null,
    finished_at: form.value.finished_at || null,
    certificate_url: form.value.certificate_url.trim() || null,
    notes: form.value.notes.trim() || null,
  }
}

async function handleSubmit() {
  if (!form.value.title.trim()) return
  try {
    if (form.value.id) {
      await updateCourse.mutateAsync({
        id: form.value.id,
        patch: buildPayload(),
        profileId: props.profileId,
      })
      ui.pushToast('Curso atualizado.', 'success')
    } else {
      await createCourse.mutateAsync({
        ...buildPayload(),
        profile_id: props.profileId,
      })
      ui.pushToast('Curso adicionado.', 'success')
    }
    formOpen.value = false
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao salvar curso.',
      'error',
    )
  }
}

async function handleDelete(c: Course) {
  if (!confirm(`Excluir o curso "${c.title}"?`)) return
  try {
    await deleteCourse.mutateAsync({ id: c.id, profileId: props.profileId })
    ui.pushToast('Curso excluído.', 'success')
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao excluir curso.',
      'error',
    )
  }
}

function formatDate(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const isMutating = () =>
  createCourse.isPending.value || updateCourse.isPending.value
</script>

<template>
  <section class="card p-6 space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold">Cursos</h2>
        <p class="mt-0.5 text-xs text-muted">
          Trilha de aprendizado e desenvolvimento.
        </p>
      </div>
      <button
        v-if="canEdit && !formOpen"
        class="btn-primary text-sm"
        @click="openCreate"
      >
        Adicionar curso
      </button>
    </div>

    <!-- Form -->
    <div v-if="formOpen" class="border border-line rounded-2xl p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">
          {{ form.id ? 'Editar curso' : 'Novo curso' }}
        </h3>
        <button class="btn-ghost text-sm" @click="closeForm">Cancelar</button>
      </div>

      <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="handleSubmit">
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">Título</label>
          <input
            v-model="form.title"
            type="text"
            required
            maxlength="180"
            class="input"
            placeholder="Ex.: Liderança de Times Remotos"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Provedor</label>
          <input
            v-model="form.provider"
            type="text"
            maxlength="80"
            class="input"
            placeholder="Udemy, Coursera, Alura..."
            list="course-providers"
          />
          <datalist id="course-providers">
            <option value="Udemy" />
            <option value="Coursera" />
            <option value="Alura" />
            <option value="Hotmart" />
            <option value="Rocketseat" />
            <option value="LinkedIn Learning" />
            <option value="YouTube" />
            <option value="Interno" />
          </datalist>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Status</label>
          <select v-model="form.status" class="input">
            <option v-for="(meta, key) in COURSE_STATUS" :key="key" :value="key">
              {{ meta.label }}
            </option>
          </select>
        </div>

        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">URL do curso</label>
          <input
            v-model="form.url"
            type="url"
            class="input"
            placeholder="https://..."
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Carga horária</label>
          <input
            v-model="form.workload_hours"
            type="number"
            min="0"
            step="0.5"
            class="input"
            placeholder="20"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Início</label>
          <input v-model="form.started_at" type="date" class="input" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Conclusão</label>
          <input v-model="form.finished_at" type="date" class="input" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1.5">Certificado (URL)</label>
          <input
            v-model="form.certificate_url"
            type="url"
            class="input"
            placeholder="https://..."
          />
        </div>

        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5">Observações</label>
          <textarea
            v-model="form.notes"
            rows="2"
            maxlength="500"
            class="input resize-none"
            placeholder="O que aprendeu, principais takeaways..."
          ></textarea>
        </div>

        <div class="sm:col-span-2 flex items-center justify-end gap-3">
          <button type="button" class="btn-secondary" :disabled="isMutating()" @click="closeForm">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="isMutating()">
            {{ isMutating() ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Adicionar curso' }}
          </button>
        </div>
      </form>
    </div>

    <!-- States -->
    <div v-if="coursesQuery.isLoading.value" class="text-sm text-muted text-center py-8">
      Carregando...
    </div>

    <div
      v-else-if="(coursesQuery.data.value?.length ?? 0) === 0"
      class="text-sm text-muted text-center py-12 border border-dashed border-line rounded-xl"
    >
      Nenhum curso cadastrado ainda.
    </div>

    <ul v-else class="divide-y divide-line">
      <li
        v-for="course in coursesQuery.data.value"
        :key="course.id"
        class="py-4 flex items-start gap-4"
      >
        <div class="flex-1 min-w-0 space-y-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
              :style="{ backgroundColor: COURSE_STATUS[course.status].color }"
            >
              {{ COURSE_STATUS[course.status].label }}
            </span>
            <p class="text-sm font-semibold">{{ course.title }}</p>
          </div>

          <div class="flex items-center gap-2 text-xs text-muted flex-wrap">
            <span v-if="course.provider">{{ course.provider }}</span>
            <span v-if="course.workload_hours">· {{ course.workload_hours }}h</span>
            <span v-if="course.started_at && course.finished_at">
              · {{ formatDate(course.started_at) }} → {{ formatDate(course.finished_at) }}
            </span>
            <span v-else-if="course.started_at">· Iniciado em {{ formatDate(course.started_at) }}</span>
            <span v-else-if="course.finished_at">· Concluído em {{ formatDate(course.finished_at) }}</span>
          </div>

          <p v-if="course.notes" class="text-sm text-ink/80 whitespace-pre-line">
            {{ course.notes }}
          </p>

          <div class="flex items-center gap-3 pt-1">
            <a
              v-if="course.url"
              :href="course.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              Acessar curso ↗
            </a>
            <a
              v-if="course.certificate_url"
              :href="course.certificate_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              Ver certificado ↗
            </a>
          </div>
        </div>

        <div v-if="canEdit" class="flex items-center gap-1 flex-shrink-0">
          <button class="btn-ghost text-xs" @click="openEdit(course)">Editar</button>
          <button
            class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            @click="handleDelete(course)"
          >
            Excluir
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
