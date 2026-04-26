import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type { Course, CourseStatus } from '@/types/database'

export function useCourses(profileId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['courses', profileId],
    enabled: () => !!toValue(profileId),
    queryFn: async (): Promise<Course[]> => {
      const id = toValue(profileId)
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('profile_id', id!)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Course[]
    },
  })
}

export interface CourseInput {
  profile_id: string
  title: string
  provider?: string | null
  url?: string | null
  status: CourseStatus
  workload_hours?: number | null
  started_at?: string | null
  finished_at?: string | null
  certificate_url?: string | null
  notes?: string | null
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CourseInput): Promise<Course> => {
      const { data, error } = await supabase
        .from('courses')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data as Course
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['courses', vars.profile_id] })
    },
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<CourseInput>
      profileId: string
    }): Promise<Course> => {
      const { data, error } = await supabase
        .from('courses')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Course
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['courses', vars.profileId] })
    },
  })
}

export function useDeleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; profileId: string }) => {
      const { error } = await supabase.from('courses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['courses', vars.profileId] })
    },
  })
}
