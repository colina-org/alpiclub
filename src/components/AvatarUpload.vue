<script setup lang="ts">
import { ref } from 'vue'
import { useAvatarUpload } from '@/composables/useAvatarUpload'
import { useUpdateProfile } from '@/composables/useProfiles'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{
  profileId: string
  currentUrl: string | null
  fallbackInitials: string
  size?: 'md' | 'lg'
}>()

const emit = defineEmits<{
  (e: 'updated', newUrl: string | null): void
}>()

const ui = useUiStore()
const { upload, uploading } = useAvatarUpload()
const updateProfile = useUpdateProfile()

const fileInput = ref<HTMLInputElement | null>(null)
const sizeClasses = props.size === 'lg' ? 'h-24 w-24 text-3xl' : 'h-16 w-16 text-xl'

function openPicker() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // reset so the same file can be re-selected
  if (!file) return

  try {
    const url = await upload(props.profileId, file)
    await updateProfile.mutateAsync({
      id: props.profileId,
      patch: { avatar_url: url },
    })
    ui.pushToast('Foto atualizada.', 'success')
    emit('updated', url)
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao enviar foto.',
      'error',
    )
  }
}

async function handleRemove() {
  if (!confirm('Remover foto de perfil?')) return
  try {
    await updateProfile.mutateAsync({
      id: props.profileId,
      patch: { avatar_url: null },
    })
    ui.pushToast('Foto removida.', 'success')
    emit('updated', null)
  } catch (err) {
    ui.pushToast(
      err instanceof Error ? err.message : 'Erro ao remover foto.',
      'error',
    )
  }
}

const busy = uploading
</script>

<template>
  <div class="flex items-center gap-4">
    <div class="relative flex-shrink-0">
      <img
        v-if="currentUrl"
        :src="currentUrl"
        alt="Foto de perfil"
        class="rounded-2xl object-cover"
        :class="sizeClasses"
      />
      <div
        v-else
        class="rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold"
        :class="sizeClasses"
      >
        {{ fallbackInitials }}
      </div>

      <div
        v-if="busy"
        class="absolute inset-0 rounded-2xl bg-ink/40 flex items-center justify-center text-xs text-white"
      >
        Enviando...
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        @change="handleFileChange"
      />
      <button type="button" class="btn-secondary text-sm" :disabled="busy" @click="openPicker">
        {{ currentUrl ? 'Trocar foto' : 'Enviar foto' }}
      </button>
      <button
        v-if="currentUrl"
        type="button"
        class="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50 justify-start !px-2"
        :disabled="busy"
        @click="handleRemove"
      >
        Remover
      </button>
      <p class="text-xs text-muted">JPG, PNG ou WebP. Máx. 2 MB.</p>
    </div>
  </div>
</template>
