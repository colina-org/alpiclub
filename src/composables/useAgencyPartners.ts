import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type { AgencyPartnerWithProfile } from '@/types/database'

const PROFILE_FIELDS = 'id, full_name, email, avatar_url, position'

// Todos os sócios (com profile joined). Pequeno volume — buscamos tudo de uma vez.
export function useAllPartners() {
  return useQuery({
    queryKey: ['agency-partners'],
    queryFn: async (): Promise<AgencyPartnerWithProfile[]> => {
      const { data, error } = await supabase
        .from('agency_partners')
        .select(`*, profile:profiles!agency_partners_profile_id_fkey(${PROFILE_FIELDS})`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as AgencyPartnerWithProfile[]
    },
  })
}

export function useAddPartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { agency_id: string; profile_id: string }) => {
      const { error } = await supabase.from('agency_partners').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-partners'] })
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

export function useRemovePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agency_partners').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-partners'] })
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
