import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/stores/auth'

export interface Quote {
  text: string
  author: string
}

// Fallback local — se a API falhar, escolhe uma daqui de forma determinística
// (mesmo usuário + mesmo dia → mesma frase; usuários diferentes → frases diferentes).
const FALLBACK_QUOTES: Quote[] = [
  { text: 'A jornada de mil milhas começa com um único passo.', author: 'Lao Tsé' },
  { text: 'Acredite que você pode e você já está no meio do caminho.', author: 'Theodore Roosevelt' },
  { text: 'O sucesso é a soma de pequenos esforços repetidos dia após dia.', author: 'Robert Collier' },
  { text: 'A inovação distingue o líder do seguidor.', author: 'Steve Jobs' },
  { text: 'Comece onde você está. Use o que você tem. Faça o que você pode.', author: 'Arthur Ashe' },
  { text: 'Aprender nunca esgota a mente.', author: 'Leonardo da Vinci' },
  { text: 'Disciplina é a ponte entre objetivos e realizações.', author: 'Jim Rohn' },
  { text: 'A melhor maneira de prever o futuro é criá-lo.', author: 'Peter Drucker' },
  { text: 'Sucesso é ir de fracasso em fracasso sem perder o entusiasmo.', author: 'Winston Churchill' },
  { text: 'Não conte os dias, faça os dias contarem.', author: 'Muhammad Ali' },
  { text: 'Foco no progresso, não na perfeição.', author: 'Anônimo' },
  { text: 'O que você faz hoje pode melhorar todos os seus amanhãs.', author: 'Ralph Marston' },
  { text: 'Trabalhe duro em silêncio, deixe seu sucesso fazer o barulho.', author: 'Frank Ocean' },
  { text: 'Quem deixa de ser melhor, deixa de ser bom.', author: 'Oliver Cromwell' },
  { text: 'Pequenas atitudes, grandes mudanças.', author: 'Anônimo' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function cacheKey(userId: string) {
  return `alpiclub:quote:${userId}:${todayISO()}`
}

function readCached(userId: string): Quote | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as Quote
  } catch {
    return null
  }
}

function writeCached(userId: string, quote: Quote) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(quote))
  } catch {
    /* ignora quota / privacy mode */
  }
}

function pickFallback(userId: string): Quote {
  // Hash determinístico simples a partir de userId + data.
  const seed = (userId + todayISO())
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return FALLBACK_QUOTES[seed % FALLBACK_QUOTES.length]
}

export function useDailyQuote() {
  const auth = useAuthStore()
  const userId = computed(() => auth.user?.id ?? '')

  return useQuery({
    queryKey: ['daily-quote', userId, todayISO()],
    enabled: () => !!userId.value,
    staleTime: 1000 * 60 * 60 * 24,
    retry: 0,
    queryFn: async (): Promise<Quote> => {
      const uid = userId.value

      // 1) Cache local para hoje? Reusa.
      const cached = readCached(uid)
      if (cached) return cached

      // 2) Tenta a API ZenQuotes (random retorna uma frase aleatória por chamada).
      try {
        const res = await fetch('https://zenquotes.io/api/random')
        if (!res.ok) throw new Error('http error')
        const data = (await res.json()) as Array<{ q?: string; a?: string }>
        const first = data?.[0]
        if (first?.q) {
          const quote: Quote = { text: first.q, author: first.a ?? 'Anônimo' }
          writeCached(uid, quote)
          return quote
        }
        throw new Error('empty response')
      } catch {
        // 3) Fallback determinístico — diferente por usuário+dia.
        const quote = pickFallback(uid)
        writeCached(uid, quote)
        return quote
      }
    },
  })
}
