import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type {
  AchievementCategory,
  AchievementWithPeople,
} from '@/types/database'

const PROFILE_FIELDS = 'id, full_name, email, avatar_url, position'

export interface AchievementsQueryOptions {
  limit?: number
}

export function useAchievements(options: AchievementsQueryOptions = {}) {
  const { limit } = options
  return useQuery({
    queryKey: ['achievements', { limit: limit ?? null }],
    queryFn: async (): Promise<AchievementWithPeople[]> => {
      let query = supabase
        .from('achievements')
        .select(
          `*, recipient:profiles!achievements_recipient_id_fkey(${PROFILE_FIELDS}),
              granted_by:profiles!achievements_granted_by_id_fkey(${PROFILE_FIELDS}),
              likes:achievement_likes(profile_id)`,
        )
        .order('granted_at', { ascending: false })

      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as AchievementWithPeople[]
    },
  })
}

import type { Achievement } from '@/types/database'

// Achievements where this profile is the recipient. Used by PDI resource picker.
export function useAchievementsByRecipient(
  recipientId: import('vue').MaybeRefOrGetter<string | undefined>,
) {
  return useQuery({
    queryKey: ['achievements-by-recipient', recipientId],
    enabled: () => !!(typeof recipientId === 'function' ? recipientId() : (recipientId as { value?: string })?.value ?? recipientId),
    queryFn: async (): Promise<Achievement[]> => {
      const id =
        typeof recipientId === 'function'
          ? recipientId()
          : (recipientId as { value?: string })?.value ?? (recipientId as string)
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('recipient_id', id!)
        .order('granted_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Achievement[]
    },
  })
}

export interface AchievementInput {
  recipient_id: string
  granted_by_id: string
  category: AchievementCategory
  title: string
  message?: string | null
  image_url?: string | null
}

export function useCreateAchievement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AchievementInput) => {
      const { data, error } = await supabase
        .from('achievements')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['achievements'] })
    },
  })
}

export function useUpdateAchievement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Omit<AchievementInput, 'granted_by_id'>>
    }) => {
      const { data, error } = await supabase
        .from('achievements')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['achievements'] })
    },
  })
}

export function useToggleAchievementLike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      achievementId: string
      profileId: string
      isLiked: boolean
    }) => {
      if (input.isLiked) {
        const { error } = await supabase
          .from('achievement_likes')
          .delete()
          .eq('achievement_id', input.achievementId)
          .eq('profile_id', input.profileId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('achievement_likes')
          .insert({
            achievement_id: input.achievementId,
            profile_id: input.profileId,
          })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['achievements'] })
    },
  })
}

export function useDeleteAchievement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('achievements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['achievements'] })
    },
  })
}
