import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import type { Profile } from '@/types/database'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!session.value)
  const isAdmin = computed(() => profile.value?.app_role === 'admin')

  // Tenta uma vez (com timeout). Retorna true se carregou, false se falhou/timeout.
  async function tryFetchProfileOnce(timeoutMs: number): Promise<boolean> {
    if (!user.value) {
      profile.value = null
      return true
    }
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', user.value.id).single(),
        timeoutMs,
        'carregar perfil',
      )
      if (error) return false
      profile.value = data as Profile
      return true
    } catch {
      return false
    }
  }

  // Carrega o profile com 1 retry depois de 5s. Não loga error (não-crítico —
  // se falhar, componentes reagem a profile=null e funcionam mesmo assim).
  async function fetchProfile() {
    const ok = await tryFetchProfileOnce(20000)
    if (ok) return
    // Primeira tentativa falhou — espera o auth chain se acalmar e tenta de novo.
    await new Promise((r) => setTimeout(r, 5000))
    const ok2 = await tryFetchProfileOnce(20000)
    if (!ok2) {
      console.warn('[auth] profile not loaded — refresh page if persists')
    }
  }

  async function initialize() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    loading.value = false

    // Carrega o profile em background — não bloqueia o boot do app.
    // Componentes reagem quando profile.value muda. Para rotas que dependem
    // do profile (ex.: /admin com adminOnly), o router guard chama
    // ensureProfileLoaded() explicitamente e aguarda.
    fetchProfile()

    supabase.auth.onAuthStateChange(async (event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await fetchProfile()
      } else if (event === 'SIGNED_OUT') {
        profile.value = null
      }
    })
  }

  // Garante que o profile foi carregado (usado pelo router guard adminOnly).
  // Se já está em cache, retorna imediatamente. Senão, espera a fetch.
  async function ensureProfileLoaded() {
    if (profile.value || !user.value) return
    await fetchProfile()
  }

  async function signInWithPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    session.value = data.session
    user.value = data.user
    await fetchProfile()
    return data
  }

  async function signOut() {
    try {
      await withTimeout(supabase.auth.signOut(), 8000, 'sair')
    } catch (err) {
      // Mesmo se falhar/travar, limpamos o estado local.
      console.error('[auth] signOut failed', err)
    }
    session.value = null
    user.value = null
    profile.value = null
  }

  return {
    session,
    user,
    profile,
    loading,
    isAuthenticated,
    isAdmin,
    initialize,
    fetchProfile,
    ensureProfileLoaded,
    signInWithPassword,
    signOut,
  }
})
