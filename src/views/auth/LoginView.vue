<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { isSupabaseConfigured } from '@/lib/supabase'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

async function handleSubmit() {
  errorMessage.value = null
  submitting.value = true
  try {
    await auth.signInWithPassword(email.value, password.value)
    ui.pushToast('Bem-vindo ao Alpiclub.', 'success')
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Falha ao entrar.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Brand panel -->
    <div class="hidden lg:flex lg:w-1/2 bg-brand-600 text-white relative overflow-hidden">
      <div class="absolute inset-0 opacity-20">
        <div class="absolute top-10 left-10 h-64 w-64 rounded-full bg-accent blur-3xl"></div>
        <div class="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-brand-300 blur-3xl"></div>
      </div>
      <div class="relative z-10 flex flex-col justify-between p-12 w-full">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center font-bold text-lg">
            A
          </div>
          <span class="text-lg font-semibold tracking-tight">Alpiclub</span>
        </div>
        <div>
          <h2 class="text-3xl font-semibold leading-tight max-w-md">
            O lugar onde nossa cultura, pessoas e conquistas se encontram.
          </h2>
          <p class="mt-3 text-white/70 max-w-md">
            Plataforma interna da Colina Tech.
          </p>
        </div>
        <p class="text-xs text-white/50">© {{ new Date().getFullYear() }} Colina Tech</p>
      </div>
    </div>

    <!-- Form -->
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-sm">
        <div class="lg:hidden mb-8 flex items-center gap-2.5">
          <div class="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
            A
          </div>
          <span class="text-base font-semibold tracking-tight">Alpiclub</span>
        </div>

        <h1 class="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p class="mt-1.5 text-sm text-muted">
          Acesse com seu e-mail corporativo.
        </p>

        <div
          v-if="!isSupabaseConfigured"
          class="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800"
        >
          <p class="font-medium">Supabase não configurado.</p>
          <p class="mt-1 text-xs leading-relaxed">
            Crie um arquivo <code class="font-mono">.env</code> na raiz do projeto
            (use <code class="font-mono">.env.example</code> como base), preencha as
            chaves do Supabase e reinicie <code class="font-mono">pnpm dev</code>.
          </p>
        </div>

        <form class="mt-8 space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label class="block text-sm font-medium mb-1.5" for="email">E-mail</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="input"
              placeholder="voce@colinatech.com.br"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5" for="password">Senha</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              class="input"
              placeholder="••••••••"
            />
          </div>

          <p v-if="errorMessage" class="text-sm text-red-600">
            {{ errorMessage }}
          </p>

          <button
            type="submit"
            class="btn-primary w-full"
            :disabled="submitting"
          >
            {{ submitting ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <p class="mt-6 text-xs text-muted text-center">
          Problemas para acessar? Fale com o RH.
        </p>
      </div>
    </div>
  </div>
</template>
