import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import { useAuthStore } from '@/stores/auth'
import type { Profile, ProfileWithTeam } from '@/types/database'

const PROFILE_WITH_TEAM_SELECT =
  '*, team:teams(id, name, color, agency:agencies(id, name, slug, color)), partnerships:agency_partners(agency_id)'

export function useProfiles(options: { includeArchived?: boolean } = {}) {
  const includeArchived = !!options.includeArchived
  return useQuery({
    queryKey: ['profiles', { includeArchived }],
    queryFn: async (): Promise<ProfileWithTeam[]> => {
      let query = supabase
        .from('profiles')
        .select(PROFILE_WITH_TEAM_SELECT)
        .order('full_name', { ascending: true })

      if (!includeArchived) query = query.is('archived_at', null)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ProfileWithTeam[]
    },
  })
}

export function useArchivedProfiles() {
  return useQuery({
    queryKey: ['profiles', { archivedOnly: true }],
    queryFn: async (): Promise<ProfileWithTeam[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_WITH_TEAM_SELECT)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as ProfileWithTeam[]
    },
  })
}

export function useProfile(id: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['profile', id],
    enabled: () => !!toValue(id),
    queryFn: async (): Promise<ProfileWithTeam> => {
      const profileId = toValue(id)
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_WITH_TEAM_SELECT)
        .eq('id', profileId!)
        .single()

      if (error) throw error
      return data as ProfileWithTeam
    },
  })
}

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | 'full_name'
    | 'nickname'
    | 'avatar_url'
    | 'position'
    | 'bio'
    | 'birthday'
    | 'joined_at'
    | 'team_id'
    | 'is_head'
    | 'is_lead'
    | 'app_role'
    | 'instagram_url'
    | 'linkedin_url'
    | 'github_url'
    | 'website_url'
  >
>

export function useUpdateProfile() {
  const qc = useQueryClient()
  const auth = useAuthStore()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ProfileUpdate }): Promise<Profile> => {
      const op = supabase.from('profiles').update(patch).eq('id', id).select().single()
      const { data, error } = await withTimeout(op, 15000, 'salvar perfil')
      if (error) throw error
      return data as Profile
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['profile', id] })
      // Se o perfil atualizado é o usuário logado, atualiza o cache do auth
      // store para refletir mudanças em saudação, isAdmin, etc.
      if (auth.user?.id === id) auth.fetchProfile()
    },
  })
}
