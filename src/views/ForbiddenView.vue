<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center p-6">
    <div class="text-center max-w-md">
      <p class="text-sm font-semibold text-amber-700">403</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight">Sem permissão</h1>
      <p class="mt-2 text-sm text-muted">
        Você não tem acesso a esta página. Se acha que deveria, fale com um
        administrador da plataforma.
      </p>
      <RouterLink :to="{ name: 'dashboard' }" class="btn-primary mt-6 inline-flex">
        Voltar ao início
      </RouterLink>
    </div>
  </div>
</template>
