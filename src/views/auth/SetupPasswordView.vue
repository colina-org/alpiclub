<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useUiStore } from '@/stores/ui'

const router = useRouter()
const ui = useUiStore()

const status = ref<'checking' | 'ready' | 'no-session'>('checking')
const passwordForm = ref({ next: '', confirm: '' })
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  // O cliente Supabase tem detectSessionInUrl=true, então o token do magic
  // link no fragmento (#access_token=...) já vira sessão automaticamente.
  // Esperamos um tick para garantir que isso aconteça antes de checar.
  await new Promise((r) => setTimeout(r, 200))

  const { data } = await supabase.auth.getSession()
  if (data.session) {
    status.value = 'ready'
  } else {
    status.value = 'no-session'
  }
})

async function handleSubmit() {
  errorMessage.value = null
  if (!passwordForm.value.next || passwordForm.value.next.length < 6) {
    errorMessage.value = 'A senha deve ter ao menos 6 caracteres.'
    return
  }
  if (passwordForm.value.next !== passwordForm.value.confirm) {
    errorMessage.value = 'As senhas não conferem.'
    return
  }
  submitting.value = true
  try {
    // Retry transparente para conflitos de lock do supabase-js (acontece
    // quando o processamento do magic link ainda está em curso).
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.value.next,
      })
      if (!error) {
        lastError = null
        break
      }
      lastError = error
      const transient = /lock|stolen|released/i.test(error.message)
      if (!transient) break
      await new Promise((r) => setTimeout(r, 700))
    }
    if (lastError) throw lastError
    // O onAuthStateChange (USER_UPDATED) cuida do fetchProfile.
    ui.pushToast('Senha definida. Bem-vindo ao Alpiclub.', 'success')
    router.push({ name: 'dashboard' })
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Erro ao definir senha.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-sm">
      <div class="mb-8 flex items-center gap-2.5">
        <div class="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
          A
        </div>
        <span class="text-base font-semibold tracking-tight">Alpiclub</span>
      </div>

      <div v-if="status === 'checking'" class="card p-8 text-center text-sm text-muted">
        Validando convite...
      </div>

      <div v-else-if="status === 'no-session'" class="card p-8 text-center space-y-3">
        <p class="text-base font-semibold">Convite inválido ou expirado</p>
        <p class="text-sm text-muted">
          O link de convite expirou ou já foi usado. Peça para um administrador
          enviar um novo convite.
        </p>
        <RouterLink :to="{ name: 'login' }" class="btn-secondary inline-flex">
          Ir para o login
        </RouterLink>
      </div>

      <template v-else>
        <h1 class="text-2xl font-semibold tracking-tight">Defina sua senha</h1>
        <p class="mt-1.5 text-sm text-muted">
          Bem-vindo! Para finalizar sua conta, escolha uma senha de acesso.
        </p>

        <form class="mt-8 space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label class="block text-sm font-medium mb-1.5" for="password">Senha</label>
            <input
              id="password"
              v-model="passwordForm.next"
              type="password"
              required
              minlength="6"
              autocomplete="new-password"
              class="input"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1.5" for="confirm">Confirmar senha</label>
            <input
              id="confirm"
              v-model="passwordForm.confirm"
              type="password"
              required
              minlength="6"
              autocomplete="new-password"
              class="input"
            />
          </div>

          <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

          <button type="submit" class="btn-primary w-full" :disabled="submitting">
            {{ submitting ? 'Salvando...' : 'Definir senha e entrar' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>
