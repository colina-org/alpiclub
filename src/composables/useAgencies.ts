import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type { Agency } from '@/types/database'

export function useAgencies() {
  return useQuery({
    queryKey: ['agencies'],
    queryFn: async (): Promise<Agency[]> => {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as Agency[]
    },
  })
}

export function useAgency(idOrSlug: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['agency', idOrSlug],
    enabled: () => !!toValue(idOrSlug),
    queryFn: async (): Promise<Agency> => {
      const value = toValue(idOrSlug)!
      // Decide column by UUID-shape
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq(isUuid ? 'id' : 'slug', value)
        .single()

      if (error) throw error
      return data as Agency
    },
  })
}

export type AgencyInput = Partial<Omit<Agency, 'id' | 'created_at' | 'updated_at'>> & {
  name: string
  slug: string
}

export function useCreateAgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AgencyInput): Promise<Agency> => {
      const { data, error } = await supabase
        .from('agencies')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data as Agency
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencies'] })
    },
  })
}

export function useUpdateAgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AgencyInput> }) => {
      // Watchdog de 15s: se o request pendurar (lock/network), rejeita ao invés
      // de deixar o botão "Salvando..." para sempre.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo esgotado ao salvar. Tente novamente.')), 15000),
      )
      const op = supabase
        .from('agencies')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      const { data, error } = (await Promise.race([op, timeout])) as Awaited<typeof op>

      if (error) throw error
      return data as Agency
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencies'] })
      // Invalida TODAS as variações de useAgency (que aceita id OU slug),
      // não só a chaveada por UUID.
      qc.invalidateQueries({ queryKey: ['agency'] })
    },
  })
}

export function useDeleteAgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agencies').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencies'] })
      qc.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}
