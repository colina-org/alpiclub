import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(true)
  const mobileMenuOpen = ref(false)
  const toasts = ref<Toast[]>([])
  let nextId = 1

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function toggleMobileMenu() {
    mobileMenuOpen.value = !mobileMenuOpen.value
  }

  function closeMobileMenu() {
    mobileMenuOpen.value = false
  }

  function pushToast(message: string, variant: ToastVariant = 'info') {
    const id = nextId++
    toasts.value.push({ id, message, variant })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, 4000)
  }

  return {
    sidebarOpen,
    mobileMenuOpen,
    toasts,
    toggleSidebar,
    toggleMobileMenu,
    closeMobileMenu,
    pushToast,
  }
})
