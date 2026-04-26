import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import type { BookBorrowingWithBook, BookBorrowingWithProfile } from '@/types/database'

const PROFILE_FIELDS = 'id, full_name, email, avatar_url'

// Histórico completo de empréstimos de um livro (mais recentes primeiro).
export function useBookBorrowings(bookId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['book-borrowings', bookId],
    enabled: () => !!toValue(bookId),
    queryFn: async (): Promise<BookBorrowingWithProfile[]> => {
      const id = toValue(bookId)
      const { data, error } = await supabase
        .from('book_borrowings')
        .select(`*, profile:profiles!book_borrowings_profile_id_fkey(${PROFILE_FIELDS})`)
        .eq('book_id', id!)
        .order('borrowed_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as BookBorrowingWithProfile[]
    },
  })
}

// Helper reativo: o empréstimo ativo (status='borrowed') + a fila do livro.
export function useActiveBorrowing(bookId: MaybeRefOrGetter<string | undefined>) {
  const borrowingsQuery = useBookBorrowings(bookId)
  const active = computed(() =>
    borrowingsQuery.data.value?.find((b) => b.status === 'borrowed') ?? null,
  )
  // Fila ordenada por created_at asc (FIFO).
  const queue = computed(() =>
    [...(borrowingsQuery.data.value ?? [])]
      .filter((b) => b.status === 'queued')
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  )
  return { active, queue, borrowingsQuery }
}

// Empréstimos atuais (borrowed + queued) de uma pessoa, com o livro joined.
const BOOK_FIELDS = 'id, title, author, cover_url'
export function useBorrowingsByProfile(
  profileId: MaybeRefOrGetter<string | undefined>,
) {
  return useQuery({
    queryKey: ['borrowings-by-profile', profileId],
    enabled: () => !!toValue(profileId),
    queryFn: async (): Promise<BookBorrowingWithBook[]> => {
      const id = toValue(profileId)
      const { data, error } = await supabase
        .from('book_borrowings')
        .select(`*, book:books(${BOOK_FIELDS})`)
        .eq('profile_id', id!)
        .in('status', ['borrowed', 'queued'])
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as BookBorrowingWithBook[]
    },
  })
}

export function useBorrowBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { book_id: string; profile_id: string }) => {
      const op = supabase
        .from('book_borrowings')
        .insert({
          book_id: input.book_id,
          profile_id: input.profile_id,
          status: 'borrowed',
        })
        .select()
        .single()
      const { data, error } = await withTimeout(op, 15000, 'pegar livro')
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['book-borrowings', vars.book_id] })
      qc.invalidateQueries({ queryKey: ['borrowings-by-profile', vars.profile_id] })
    },
  })
}

export function useJoinQueue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { book_id: string; profile_id: string }) => {
      const op = supabase
        .from('book_borrowings')
        .insert({
          book_id: input.book_id,
          profile_id: input.profile_id,
          status: 'queued',
        })
        .select()
        .single()
      const { data, error } = await withTimeout(op, 15000, 'entrar na fila')
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['book-borrowings', vars.book_id] })
      qc.invalidateQueries({ queryKey: ['borrowings-by-profile', vars.profile_id] })
    },
  })
}

export function useLeaveQueue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; bookId: string; profileId: string }) => {
      const op = supabase.from('book_borrowings').delete().eq('id', id)
      const { error } = await withTimeout(op, 15000, 'sair da fila')
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['book-borrowings', vars.bookId] })
      qc.invalidateQueries({ queryKey: ['borrowings-by-profile', vars.profileId] })
    },
  })
}

export function useReturnBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; bookId: string; profileId: string }) => {
      const op = supabase
        .from('book_borrowings')
        .update({
          status: 'returned',
          returned_at: new Date().toISOString(),
        })
        .eq('id', id)
      const { error } = await withTimeout(op, 15000, 'devolver livro')
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['book-borrowings', vars.bookId] })
      qc.invalidateQueries({ queryKey: ['borrowings-by-profile', vars.profileId] })
      // Próximo da fila pode virar borrowed → invalida tudo de borrowings
      qc.invalidateQueries({ queryKey: ['borrowings-by-profile'] })
    },
  })
}
