<script setup lang="ts">
import { useDailyQuote } from '@/composables/useDailyQuote'

const quoteQuery = useDailyQuote()
</script>

<template>
  <div
    class="card p-6 flex flex-col justify-between min-h-[140px] relative overflow-hidden"
  >
    <div
      class="absolute -top-6 -right-6 text-[120px] leading-none text-brand-100 font-serif select-none pointer-events-none"
    >
      “
    </div>

    <div class="relative">
      <p class="text-xs font-semibold uppercase tracking-wider text-brand-700">
        Frase do dia
      </p>

      <template v-if="quoteQuery.isLoading.value">
        <p class="mt-3 text-sm text-muted italic">Carregando...</p>
      </template>

      <template v-else-if="quoteQuery.data.value">
        <p class="mt-3 text-sm text-ink leading-relaxed">
          {{ quoteQuery.data.value.text }}
        </p>
        <p class="mt-2 text-xs text-muted">— {{ quoteQuery.data.value.author }}</p>
      </template>
    </div>
  </div>
</template>
