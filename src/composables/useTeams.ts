import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type { TeamWithAgency } from '@/types/database'

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async (): Promise<TeamWithAgency[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('*, agency:agencies(id, name, slug, color, logo_url)')
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as TeamWithAgency[]
    },
  })
}

export interface TeamInput {
  name: string
  agency_id: string
  description?: string | null
  color?: string | null
  parent_team_id?: string | null
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TeamInput): Promise<TeamWithAgency> => {
      const { data, error } = await supabase
        .from('teams')
        .insert(input)
        .select('*, agency:agencies(id, name, slug, color, logo_url)')
        .single()

      if (error) throw error
      return data as TeamWithAgency
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TeamInput> }): Promise<TeamWithAgency> => {
      const { data, error } = await supabase
        .from('teams')
        .update(patch)
        .eq('id', id)
        .select('*, agency:agencies(id, name, slug, color, logo_url)')
        .single()

      if (error) throw error
      return data as TeamWithAgency
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
