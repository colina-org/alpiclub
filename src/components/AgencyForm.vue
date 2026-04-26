<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Agency } from '@/types/database'

const props = defineProps<{
  agency: Agency | null
  pending?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', payload: Omit<Agency, 'id' | 'created_at' | 'updated_at'>): void
  (e: 'cancel'): void
}>()

type FormState = {
  name: string
  slug: string
  description: string
  color: string
  website_url: string
  instagram_url: string
  linkedin_url: string
  facebook_url: string
  youtube_url: string
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const form = ref<FormState>({
  name: '',
  slug: '',
  description: '',
  color: '#1ACDB8',
  website_url: '',
  instagram_url: '',
  linkedin_url: '',
  facebook_url: '',
  youtube_url: '',
})

const slugTouched = ref(false)

watch(() => props.agency, (a) => {
  if (a) {
    form.value = {
      name: a.name,
      slug: a.slug,
      description: a.description ?? '',
      color: a.color ?? '#1ACDB8',
      website_url: a.website_url ?? '',
      instagram_url: a.instagram_url ?? '',
      linkedin_url: a.linkedin_url ?? '',
      facebook_url: a.facebook_url ?? '',
      youtube_url: a.youtube_url ?? '',
    }
    slugTouched.value = true
  } else {
    form.value = {
      name: '',
      slug: '',
      description: '',
      color: '#1ACDB8',
      website_url: '',
      instagram_url: '',
      linkedin_url: '',
      facebook_url: '',
      youtube_url: '',
    }
    slugTouched.value = false
  }
}, { immediate: true })

function onNameInput() {
  if (!slugTouched.value) form.value.slug = slugify(form.value.name)
}

function onSlugInput() {
  slugTouched.value = true
  form.value.slug = slugify(form.value.slug)
}

function handleSubmit() {
  if (!form.value.name.trim() || !form.value.slug.trim()) return
  emit('submit', {
    name: form.value.name.trim(),
    slug: form.value.slug.trim(),
    description: form.value.description.trim() || null,
    logo_url: null,
    color: form.value.color,
    website_url: form.value.website_url.trim() || null,
    instagram_url: form.value.instagram_url.trim() || null,
    linkedin_url: form.value.linkedin_url.trim() || null,
    facebook_url: form.value.facebook_url.trim() || null,
    youtube_url: form.value.youtube_url.trim() || null,
  })
}
</script>

<template>
  <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="handleSubmit">
    <div>
      <label class="block text-sm font-medium mb-1.5">Nome</label>
      <input
        v-model="form.name"
        type="text"
        required
        maxlength="80"
        class="input"
        placeholder="Larco"
        @input="onNameInput"
      />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1.5">
        Slug <span class="text-muted font-normal">(URL)</span>
      </label>
      <input
        v-model="form.slug"
        type="text"
        required
        maxlength="60"
        class="input"
        placeholder="larco"
        @input="onSlugInput"
      />
    </div>

    <div class="sm:col-span-2">
      <label class="block text-sm font-medium mb-1.5">Descrição</label>
      <textarea
        v-model="form.description"
        rows="2"
        maxlength="400"
        class="input resize-none"
        placeholder="Agência focada em..."
      ></textarea>
    </div>

    <div class="sm:col-span-2">
      <label class="block text-sm font-medium mb-1.5">Cor da agência</label>
      <div class="flex items-center gap-3">
        <input
          v-model="form.color"
          type="color"
          class="h-10 w-14 rounded-lg border border-line cursor-pointer bg-panel"
        />
        <code class="text-xs text-muted">{{ form.color }}</code>
        <span
          class="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-base text-white"
          :style="{ backgroundColor: form.color }"
        >
          {{ form.name[0]?.toUpperCase() || 'A' }}
        </span>
      </div>
      <p class="mt-1.5 text-xs text-muted">
        A agência aparece sempre como um círculo colorido com a inicial do nome.
      </p>
    </div>

    <div class="sm:col-span-2 pt-2">
      <p class="text-sm font-medium mb-2">Site e redes sociais</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input v-model="form.website_url" type="url" class="input" placeholder="🌐 Site (https://...)" />
        <input v-model="form.instagram_url" type="url" class="input" placeholder="📷 Instagram" />
        <input v-model="form.linkedin_url" type="url" class="input" placeholder="💼 LinkedIn" />
        <input v-model="form.facebook_url" type="url" class="input" placeholder="📘 Facebook" />
        <input v-model="form.youtube_url" type="url" class="input" placeholder="▶️ YouTube" />
      </div>
    </div>

    <div class="sm:col-span-2 flex items-center justify-end gap-3 pt-2">
      <button type="button" class="btn-secondary" :disabled="pending" @click="emit('cancel')">
        Cancelar
      </button>
      <button type="submit" class="btn-primary" :disabled="pending">
        {{ pending ? 'Salvando...' : agency ? 'Salvar alterações' : 'Criar agência' }}
      </button>
    </div>
  </form>
</template>
