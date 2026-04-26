<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50 space-y-2">
    <Transition
      v-for="toast in ui.toasts"
      :key="toast.id"
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        class="card px-4 py-3 text-sm shadow-panel min-w-[260px]"
        :class="{
          'border-l-4 border-l-brand-600': toast.variant === 'success',
          'border-l-4 border-l-red-500': toast.variant === 'error',
          'border-l-4 border-l-slate-400': toast.variant === 'info',
        }"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>
