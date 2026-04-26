<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
      <p class="mt-1 text-sm text-muted">{{ description }}</p>
    </header>

    <div class="card p-12 text-center">
      <p class="text-sm text-muted">Este módulo será implementado em breve.</p>
    </div>
  </div>
</template>
