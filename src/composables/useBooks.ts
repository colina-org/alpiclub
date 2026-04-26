import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import type { Book, BookWithReads } from '@/types/database'

export function useBooks() {
  return useQuery({
    queryKey: ['books'],
    queryFn: async (): Promise<BookWithReads[]> => {
      const { data, error } = await supabase
        .from('books')
        .select(
          '*, reads:book_reads(id, profile_id, status, rating), borrowings:book_borrowings(id, profile_id, status)',
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as BookWithReads[]
    },
  })
}

export function useBook(id: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['book', id],
    enabled: () => !!toValue(id),
    queryFn: async (): Promise<Book> => {
      const bookId = toValue(id)
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId!)
        .single()

      if (error) throw error
      return data as Book
    },
  })
}

export interface BookInput {
  title: string
  author: string
  cover_url?: string | null
  url?: string | null
  description?: string | null
  category?: string | null
  available_at_bibliotech?: boolean
  added_by_id: string
}

export type BookUpdate = Partial<Omit<BookInput, 'added_by_id'>>

export function useCreateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: BookInput): Promise<Book> => {
      const op = supabase.from('books').insert(input).select().single()
      const { data, error } = await withTimeout(op, 15000, 'cadastrar livro')
      if (error) throw error
      return data as Book
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] })
    },
  })
}

export function useUpdateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: BookUpdate }): Promise<Book> => {
      const op = supabase.from('books').update(patch).eq('id', id).select().single()
      const { data, error } = await withTimeout(op, 15000, 'salvar livro')
      if (error) throw error
      return data as Book
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['book'] })
    },
  })
}

export function useDeleteBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('books').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] })
    },
  })
}
