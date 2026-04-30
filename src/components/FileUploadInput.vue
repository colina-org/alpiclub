<script setup lang="ts">
import { ref } from 'vue'
import { Paperclip, FileText } from 'lucide-vue-next'

withDefaults(defineProps<{
  currentUrl?: string | null
  busy?: boolean
  accept?: string
  hint?: string
}>(), {
  accept: 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
  hint: 'JPG, PNG, WebP, GIF ou PDF. Máx. 10 MB.',
})

const emit = defineEmits<{
  select: [file: File]
  remove: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function openPicker() { fileInput.value?.click() }

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  emit('select', file)
}

function isImage(url: string) {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)
}
</script>

<template>
  <div class="flex items-center gap-4">
    <!-- Preview -->
    <div class="w-16 h-16 rounded-xl border border-line bg-surface flex items-center justify-center shrink-0 overflow-hidden relative">
      <img
        v-if="currentUrl && isImage(currentUrl)"
        :src="currentUrl"
        class="w-full h-full object-cover"
        alt="Pré-visualização"
      />
      <FileText v-else-if="currentUrl" class="w-7 h-7 text-brand-500" />
      <Paperclip v-else class="w-6 h-6 text-muted opacity-40" />

      <div
        v-if="busy"
        class="absolute inset-0 rounded-xl bg-ink/40 flex items-center justify-center text-xs text-white"
      >
        Enviando…
      </div>
    </div>

    <!-- Ações -->
    <div class="flex flex-col gap-2">
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        class="hidden"
        @change="handleFileChange"
      />
      <button
        type="button"
        class="btn-secondary text-sm"
        :disabled="busy"
        @click="openPicker"
      >
        {{ currentUrl ? 'Trocar arquivo' : 'Selecionar arquivo' }}
      </button>
      <button
        v-if="currentUrl"
        type="button"
        class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50 justify-start !px-2"
        :disabled="busy"
        @click="emit('remove')"
      >
        Remover
      </button>
      <p class="text-xs text-muted">{{ hint }}</p>
    </div>
  </div>
</template>
