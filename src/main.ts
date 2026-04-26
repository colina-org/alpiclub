import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import './styles/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  },
})

app.mount('#app')

// ---------------------------------------------------------------------
// Bloqueia zoom no iOS Safari/Chrome.
// Desde iOS 10 o user-scalable=no do meta viewport é ignorado.
// Cancelamos os eventos de gesto + double-tap manualmente.
// ---------------------------------------------------------------------
function preventGesture(e: Event) {
  e.preventDefault()
}
document.addEventListener('gesturestart', preventGesture)
document.addEventListener('gesturechange', preventGesture)
document.addEventListener('gestureend', preventGesture)

let lastTouchEnd = 0
document.addEventListener(
  'touchend',
  (e: TouchEvent) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) e.preventDefault()
    lastTouchEnd = now
  },
  { passive: false },
)
