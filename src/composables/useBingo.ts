import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type { RecognitionVote, RecognitionRankingEntry, RecognitionVoteWithPeople } from '@/types/database'

// Retorna a data da sexta-feira mais recente (ISO date string).
// Se hoje é sexta, retorna hoje. Caso contrário, retorna a última sexta.
// Fórmula: daysBack = (getDay() - 5 + 7) % 7
// dom=2, seg=3, ter=4, qua=5, qui=6, sex=0, sab=1
export function currentWeekFriday(): string {
  const today = new Date()
  const daysBack = (today.getDay() - 5 + 7) % 7
  const friday = new Date(today)
  friday.setDate(today.getDate() - daysBack)
  return friday.toISOString().slice(0, 10)
}

export function isFriday(): boolean {
  return new Date().getDay() === 5
}

// Voto da semana atual do usuário
export function useMyVoteThisWeek(voterId: import('vue').MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['bingo-my-vote', voterId],
    enabled: () => !!(typeof voterId === 'function' ? voterId() : (voterId as { value?: string })?.value ?? voterId),
    queryFn: async (): Promise<RecognitionVote | null> => {
      const id = typeof voterId === 'function'
        ? voterId()
        : (voterId as { value?: string })?.value ?? (voterId as string)
      const friday = currentWeekFriday()
      const { data, error } = await supabase
        .from('recognition_votes')
        .select('*')
        .eq('voter_id', id!)
        .eq('week_date', friday)
        .maybeSingle()
      if (error) throw error
      return data as RecognitionVote | null
    },
  })
}

// Ranking geral
export function useRecognitionRanking() {
  return useQuery({
    queryKey: ['recognition-ranking'],
    queryFn: async (): Promise<RecognitionRankingEntry[]> => {
      const { data, error } = await supabase
        .from('recognition_ranking')
        .select('*')
      if (error) throw error
      return (data ?? []) as RecognitionRankingEntry[]
    },
  })
}

// Feed: reconhecimentos da semana atual
export function useRecognitionFeed() {
  return useQuery({
    queryKey: ['recognition-feed'],
    queryFn: async (): Promise<RecognitionVoteWithPeople[]> => {
      const { data, error } = await supabase
        .from('recognition_votes')
        .select(`
          *,
          voter:profiles!recognition_votes_voter_id_fkey(id, full_name, email, avatar_url, position),
          recipient:profiles!recognition_votes_recipient_id_fkey(id, full_name, email, avatar_url, position)
        `)
        .eq('week_date', currentWeekFriday())
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as RecognitionVoteWithPeople[]
    },
  })
}

// Submeter voto
export function useSubmitRecognitionVote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      voter_id: string
      recipient_id: string
      type: 'professional' | 'personal'
      icon_count: number
      comment: string
    }) => {
      const { data, error } = await supabase
        .from('recognition_votes')
        .insert({ ...input, week_date: currentWeekFriday() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bingo-my-vote'] })
      qc.invalidateQueries({ queryKey: ['recognition-ranking'] })
    },
  })
}
