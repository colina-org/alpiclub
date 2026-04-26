import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type {
  PdiCheckInWithAuthor,
  PdiCycle,
  PdiCycleStatus,
  PdiGoal,
  PdiGoalCategory,
  PdiGoalResource,
  PdiGoalStatus,
  PdiResourceType,
  ResolvedGoalResource,
} from '@/types/database'

// ---------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------
export function usePdiCycles(profileId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['pdi-cycles', profileId],
    enabled: () => !!toValue(profileId),
    queryFn: async (): Promise<PdiCycle[]> => {
      const id = toValue(profileId)
      const { data, error } = await supabase
        .from('pdi_cycles')
        .select('*')
        .eq('profile_id', id!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as PdiCycle[]
    },
  })
}

export interface PdiCycleInput {
  profile_id: string
  title: string
  status?: PdiCycleStatus
  started_at?: string | null
  ends_at?: string | null
  summary?: string | null
  self_assessment?: string | null
  self_assessment_score?: number | null
  manager_assessment?: string | null
  manager_assessment_score?: number | null
  manager_assessment_by_id?: string | null
  closed_at?: string | null
}

export function useCreatePdiCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PdiCycleInput): Promise<PdiCycle> => {
      const { data, error } = await supabase
        .from('pdi_cycles')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data as PdiCycle
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-cycles', vars.profile_id] })
    },
  })
}

export function useUpdatePdiCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<PdiCycleInput>
      profileId: string
    }): Promise<PdiCycle> => {
      const { data, error } = await supabase
        .from('pdi_cycles')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as PdiCycle
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-cycles', vars.profileId] })
    },
  })
}

export function useDeletePdiCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; profileId: string }) => {
      const { error } = await supabase.from('pdi_cycles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-cycles', vars.profileId] })
    },
  })
}

// ---------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------
export function usePdiGoals(cycleId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['pdi-goals', cycleId],
    enabled: () => !!toValue(cycleId),
    queryFn: async (): Promise<PdiGoal[]> => {
      const id = toValue(cycleId)
      const { data, error } = await supabase
        .from('pdi_goals')
        .select('*')
        .eq('cycle_id', id!)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as PdiGoal[]
    },
  })
}

export interface PdiGoalInput {
  cycle_id: string
  title: string
  description?: string | null
  category: PdiGoalCategory
  status?: PdiGoalStatus
  progress?: number
  target_date?: string | null
  priority?: number
}

export function useCreatePdiGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PdiGoalInput): Promise<PdiGoal> => {
      const { data, error } = await supabase
        .from('pdi_goals')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data as PdiGoal
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-goals', vars.cycle_id] })
    },
  })
}

export function useUpdatePdiGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<PdiGoalInput>
      cycleId: string
    }): Promise<PdiGoal> => {
      const { data, error } = await supabase
        .from('pdi_goals')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as PdiGoal
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-goals', vars.cycleId] })
    },
  })
}

export function useDeletePdiGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; cycleId: string }) => {
      const { error } = await supabase.from('pdi_goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-goals', vars.cycleId] })
    },
  })
}

// ---------------------------------------------------------------------
// Check-ins (comments)
// ---------------------------------------------------------------------
export function usePdiCheckIns(cycleId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['pdi-check-ins', cycleId],
    enabled: () => !!toValue(cycleId),
    queryFn: async (): Promise<PdiCheckInWithAuthor[]> => {
      const id = toValue(cycleId)
      const { data, error } = await supabase
        .from('pdi_check_ins')
        .select(
          '*, author:profiles!pdi_check_ins_author_id_fkey(id, full_name, email, avatar_url)',
        )
        .eq('cycle_id', id!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as PdiCheckInWithAuthor[]
    },
  })
}

export interface PdiCheckInInput {
  cycle_id: string
  author_id: string
  message: string
}

export function useCreatePdiCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PdiCheckInInput) => {
      const { data, error } = await supabase
        .from('pdi_check_ins')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-check-ins', vars.cycle_id] })
    },
  })
}

export function useDeletePdiCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; cycleId: string }) => {
      const { error } = await supabase.from('pdi_check_ins').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-check-ins', vars.cycleId] })
    },
  })
}

// ---------------------------------------------------------------------
// Goal resources (links to books / courses / achievements)
// ---------------------------------------------------------------------

// Fetch all resources for a cycle's goals + resolve titles in 3 follow-up queries.
export function useGoalResources(cycleId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['pdi-goal-resources', cycleId],
    enabled: () => !!toValue(cycleId),
    queryFn: async (): Promise<Record<string, ResolvedGoalResource[]>> => {
      const id = toValue(cycleId)

      // Get goal ids in this cycle.
      const { data: goals, error: gErr } = await supabase
        .from('pdi_goals')
        .select('id')
        .eq('cycle_id', id!)
      if (gErr) throw gErr
      const goalIds = (goals ?? []).map((g) => g.id)
      if (goalIds.length === 0) return {}

      // Get all resource links for these goals.
      const { data: links, error: rErr } = await supabase
        .from('pdi_goal_resources')
        .select('*')
        .in('goal_id', goalIds)
      if (rErr) throw rErr
      const allLinks = (links ?? []) as PdiGoalResource[]
      if (allLinks.length === 0) return {}

      const bookIds = allLinks.filter((l) => l.resource_type === 'book').map((l) => l.resource_id)
      const courseIds = allLinks.filter((l) => l.resource_type === 'course').map((l) => l.resource_id)
      const achievementIds = allLinks
        .filter((l) => l.resource_type === 'achievement')
        .map((l) => l.resource_id)

      // Resolve titles in parallel.
      const [booksRes, coursesRes, achievementsRes] = await Promise.all([
        bookIds.length
          ? supabase.from('books').select('id, title, author').in('id', bookIds)
          : Promise.resolve({ data: [], error: null }),
        courseIds.length
          ? supabase.from('courses').select('id, title, provider').in('id', courseIds)
          : Promise.resolve({ data: [], error: null }),
        achievementIds.length
          ? supabase.from('achievements').select('id, title, category').in('id', achievementIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      const books = new Map<string, { title: string; subtitle: string | null }>()
      ;(booksRes.data ?? []).forEach((b) =>
        books.set(b.id, { title: b.title, subtitle: b.author }),
      )
      const courses = new Map<string, { title: string; subtitle: string | null }>()
      ;(coursesRes.data ?? []).forEach((c) =>
        courses.set(c.id, { title: c.title, subtitle: c.provider ?? null }),
      )
      const achievements = new Map<string, { title: string; subtitle: string | null }>()
      ;(achievementsRes.data ?? []).forEach((a) =>
        achievements.set(a.id, { title: a.title, subtitle: a.category ?? null }),
      )

      // Group by goal_id and enrich.
      const grouped: Record<string, ResolvedGoalResource[]> = {}
      for (const link of allLinks) {
        const detail =
          link.resource_type === 'book'
            ? books.get(link.resource_id)
            : link.resource_type === 'course'
              ? courses.get(link.resource_id)
              : achievements.get(link.resource_id)

        const resolved: ResolvedGoalResource = {
          ...link,
          title: detail?.title ?? '(removido)',
          subtitle: detail?.subtitle ?? null,
          link:
            link.resource_type === 'book'
              ? { name: 'book', params: { id: link.resource_id } }
              : link.resource_type === 'achievement'
                ? { name: 'achievements', params: {} }
                : null,
        }

        if (!grouped[link.goal_id]) grouped[link.goal_id] = []
        grouped[link.goal_id].push(resolved)
      }
      return grouped
    },
  })
}

export function useAttachResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      goal_id: string
      resource_type: PdiResourceType
      resource_id: string
      cycleId: string
    }) => {
      const { error } = await supabase.from('pdi_goal_resources').insert({
        goal_id: input.goal_id,
        resource_type: input.resource_type,
        resource_id: input.resource_id,
      })
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-goal-resources', vars.cycleId] })
    },
  })
}

export function useDetachResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; cycleId: string }) => {
      const { error } = await supabase.from('pdi_goal_resources').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pdi-goal-resources', vars.cycleId] })
    },
  })
}
