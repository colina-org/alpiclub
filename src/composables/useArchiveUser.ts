import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'

export function useArchiveUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      profileId,
      archive,
    }: {
      profileId: string
      archive: boolean
    }) => {
      const { data, error } = await supabase.functions.invoke('archive-user', {
        body: { profile_id: profileId, archive },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['profile', vars.profileId] })
    },
  })
}
