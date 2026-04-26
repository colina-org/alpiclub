<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center p-6">
    <div class="text-center max-w-md">
      <p class="text-sm font-semibold text-muted">404</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p class="mt-2 text-sm text-muted">A rota que você tentou acessar não existe.</p>
      <RouterLink to="/" class="btn-primary mt-6 inline-flex">Voltar ao início</RouterLink>
    </div>
  </div>
</template>
