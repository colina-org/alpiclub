import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type {
  BookRead,
  BookReadStatus,
  BookReadWithBook,
  BookReadWithProfile,
} from '@/types/database'

const PROFILE_FIELDS = 'id, full_name, email, avatar_url, position'

// All reads for a given profile, with the book joined. Used in profile pages.
export function useReadsByProfile(profileId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['reads-by-profile', profileId],
    enabled: () => !!toValue(profileId),
    queryFn: async (): Promise<BookReadWithBook[]> => {
      const id = toValue(profileId)
      const { data, error } = await supabase
        .from('book_reads')
        .select('*, book:books(id, title, author, cover_url, category)')
        .eq('profile_id', id!)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as BookReadWithBook[]
    },
  })
}

// All reads for a given book, with the profile attached. Used in BookDetailView.
export function useBookReads(bookId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['book-reads', bookId],
    enabled: () => !!toValue(bookId),
    queryFn: async (): Promise<BookReadWithProfile[]> => {
      const id = toValue(bookId)
      const { data, error } = await supabase
        .from('book_reads')
        .select(`*, profile:profiles!book_reads_profile_id_fkey(${PROFILE_FIELDS})`)
        .eq('book_id', id!)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as BookReadWithProfile[]
    },
  })
}

// My read for a given book (or null if I haven't marked it yet).
export function useMyRead(
  bookId: MaybeRefOrGetter<string | undefined>,
  profileId: MaybeRefOrGetter<string | undefined>,
) {
  return useQuery({
    queryKey: ['my-read', bookId, profileId],
    enabled: () => !!toValue(bookId) && !!toValue(profileId),
    queryFn: async (): Promise<BookRead | null> => {
      const b = toValue(bookId)
      const p = toValue(profileId)
      const { data, error } = await supabase
        .from('book_reads')
        .select('*')
        .eq('book_id', b!)
        .eq('profile_id', p!)
        .maybeSingle()

      if (error) throw error
      return (data ?? null) as BookRead | null
    },
  })
}

export interface UpsertReadInput {
  profile_id: string
  book_id: string
  status: BookReadStatus
  rating?: number | null
  review?: string | null
  finished_at?: string | null
}

export function useUpsertRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpsertReadInput): Promise<BookRead> => {
      const { data, error } = await supabase
        .from('book_reads')
        .upsert(input, { onConflict: 'profile_id,book_id' })
        .select()
        .single()

      if (error) throw error
      return data as BookRead
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['book-reads', variables.book_id] })
      qc.invalidateQueries({ queryKey: ['my-read', variables.book_id, variables.profile_id] })
    },
  })
}

export function useDeleteRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; bookId: string; profileId: string }) => {
      const { error } = await supabase.from('book_reads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['book-reads', variables.bookId] })
      qc.invalidateQueries({ queryKey: ['my-read', variables.bookId, variables.profileId] })
    },
  })
}
