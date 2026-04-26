import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Notification } from '@/types/database'

export function useNotifications() {
  const auth = useAuthStore()
  const userId = computed(() => auth.user?.id)

  return useQuery({
    queryKey: ['notifications', userId],
    enabled: () => !!userId.value,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', userId.value!)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      return (data ?? []) as Notification[]
    },
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  const auth = useAuthStore()
  return useMutation({
    mutationFn: async () => {
      if (!auth.user?.id) return
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('profile_id', auth.user.id)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
