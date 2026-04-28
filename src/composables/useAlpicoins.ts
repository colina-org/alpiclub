import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type {
  AlpicoinsProduct,
  AlpicoinsEarnRequest,
  AlpicoinsEarnRequestWithProfile,
  AlpicoinsTransaction,
  AlpicoinsRedemption,
  AlpicoinsRedemptionWithDetails,
} from '@/types/database'

// ── Produtos ──────────────────────────────────────────────────────────

export function useAlpicoinsProducts() {
  return useQuery({
    queryKey: ['alpicoins-products'],
    queryFn: async (): Promise<AlpicoinsProduct[]> => {
      const { data, error } = await supabase
        .from('alpicoins_products')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AlpicoinsProduct[]
    },
  })
}

export function useCreateAlpicoinsProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      description?: string | null
      image_url?: string | null
      price_coins: number
      stock?: number | null
      created_by: string
    }) => {
      const { data, error } = await supabase
        .from('alpicoins_products')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alpicoins-products'] }),
  })
}

export function useUpdateAlpicoinsProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: {
      id: string
      patch: Partial<Omit<AlpicoinsProduct, 'id' | 'created_at' | 'updated_at' | 'created_by'>>
    }) => {
      const { data, error } = await supabase
        .from('alpicoins_products')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alpicoins-products'] }),
  })
}

export function useDeleteAlpicoinsProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alpicoins_products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alpicoins-products'] }),
  })
}

// ── Saldo do usuário ──────────────────────────────────────────────────

export function useMyAlpicoinsBalance(profileId: import('vue').MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['alpicoins-balance', profileId],
    enabled: () => !!(typeof profileId === 'function' ? profileId() : (profileId as { value?: string })?.value ?? profileId),
    queryFn: async (): Promise<number> => {
      const id = typeof profileId === 'function'
        ? profileId()
        : (profileId as { value?: string })?.value ?? (profileId as string)
      const { data, error } = await supabase
        .from('alpicoins_transactions')
        .select('coins')
        .eq('profile_id', id!)
      if (error) throw error
      return (data ?? []).reduce((sum, t) => sum + t.coins, 0)
    },
  })
}

// ── Transações do usuário ─────────────────────────────────────────────

export function useMyAlpicoinsTransactions(profileId: import('vue').MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['alpicoins-transactions', profileId],
    enabled: () => !!(typeof profileId === 'function' ? profileId() : (profileId as { value?: string })?.value ?? profileId),
    queryFn: async (): Promise<AlpicoinsTransaction[]> => {
      const id = typeof profileId === 'function'
        ? profileId()
        : (profileId as { value?: string })?.value ?? (profileId as string)
      const { data, error } = await supabase
        .from('alpicoins_transactions')
        .select('*')
        .eq('profile_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AlpicoinsTransaction[]
    },
  })
}

// ── Pedidos de ganho ──────────────────────────────────────────────────

export function useMyEarnRequests(profileId: import('vue').MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['alpicoins-earn-requests', profileId],
    enabled: () => !!(typeof profileId === 'function' ? profileId() : (profileId as { value?: string })?.value ?? profileId),
    queryFn: async (): Promise<AlpicoinsEarnRequest[]> => {
      const id = typeof profileId === 'function'
        ? profileId()
        : (profileId as { value?: string })?.value ?? (profileId as string)
      const { data, error } = await supabase
        .from('alpicoins_earn_requests')
        .select('*')
        .eq('profile_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AlpicoinsEarnRequest[]
    },
  })
}

export function useAllEarnRequests() {
  return useQuery({
    queryKey: ['alpicoins-earn-requests-all'],
    queryFn: async (): Promise<AlpicoinsEarnRequestWithProfile[]> => {
      const { data, error } = await supabase
        .from('alpicoins_earn_requests')
        .select('*, profile:profiles!alpicoins_earn_requests_profile_id_fkey(id, full_name, email, avatar_url, position)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AlpicoinsEarnRequestWithProfile[]
    },
  })
}

export function useCreateEarnRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { profile_id: string; description: string; coins_requested: number }) => {
      const { data, error } = await supabase
        .from('alpicoins_earn_requests')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['alpicoins-earn-requests', v.profile_id] })
      qc.invalidateQueries({ queryKey: ['alpicoins-earn-requests-all'] })
    },
  })
}

export function useReviewEarnRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      profile_id: string
      status: 'approved' | 'rejected'
      coins_requested: number
      description: string
      reviewed_by: string
      review_note?: string
    }) => {
      const { error: upErr } = await supabase
        .from('alpicoins_earn_requests')
        .update({
          status: input.status,
          reviewed_by: input.reviewed_by,
          reviewed_at: new Date().toISOString(),
          review_note: input.review_note ?? null,
        })
        .eq('id', input.id)
      if (upErr) throw upErr

      if (input.status === 'approved') {
        const { error: txErr } = await supabase
          .from('alpicoins_transactions')
          .insert({
            profile_id: input.profile_id,
            coins: input.coins_requested,
            description: input.description,
            source_type: 'earn',
            source_id: input.id,
            created_by: input.reviewed_by,
          })
        if (txErr) throw txErr
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alpicoins-earn-requests'] })
      qc.invalidateQueries({ queryKey: ['alpicoins-earn-requests-all'] })
      qc.invalidateQueries({ queryKey: ['alpicoins-balance'] })
      qc.invalidateQueries({ queryKey: ['alpicoins-transactions'] })
    },
  })
}

// ── Resgates ──────────────────────────────────────────────────────────

export function useMyRedemptions(profileId: import('vue').MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['alpicoins-redemptions', profileId],
    enabled: () => !!(typeof profileId === 'function' ? profileId() : (profileId as { value?: string })?.value ?? profileId),
    queryFn: async (): Promise<AlpicoinsRedemption[]> => {
      const id = typeof profileId === 'function'
        ? profileId()
        : (profileId as { value?: string })?.value ?? (profileId as string)
      const { data, error } = await supabase
        .from('alpicoins_redemptions')
        .select('*')
        .eq('profile_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AlpicoinsRedemption[]
    },
  })
}

export function useAllRedemptions() {
  return useQuery({
    queryKey: ['alpicoins-redemptions-all'],
    queryFn: async (): Promise<AlpicoinsRedemptionWithDetails[]> => {
      const { data, error } = await supabase
        .from('alpicoins_redemptions')
        .select(`
          *,
          profile:profiles!alpicoins_redemptions_profile_id_fkey(id, full_name, email, avatar_url),
          product:alpicoins_products!alpicoins_redemptions_product_id_fkey(id, name, image_url, price_coins)
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AlpicoinsRedemptionWithDetails[]
    },
  })
}

export function useCreateRedemption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { profile_id: string; product_id: string }) => {
      const { data, error } = await supabase
        .from('alpicoins_redemptions')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['alpicoins-redemptions', v.profile_id] })
      qc.invalidateQueries({ queryKey: ['alpicoins-redemptions-all'] })
    },
  })
}

export function useReviewRedemption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      profile_id: string
      product_id: string
      price_coins: number
      product_name: string
      status: 'approved' | 'rejected' | 'delivered'
      reviewed_by: string
      review_note?: string
    }) => {
      const { error: upErr } = await supabase
        .from('alpicoins_redemptions')
        .update({
          status: input.status,
          reviewed_by: input.reviewed_by,
          reviewed_at: new Date().toISOString(),
          review_note: input.review_note ?? null,
        })
        .eq('id', input.id)
      if (upErr) throw upErr

      if (input.status === 'approved') {
        const { error: txErr } = await supabase
          .from('alpicoins_transactions')
          .insert({
            profile_id: input.profile_id,
            coins: -input.price_coins,
            description: `Resgate: ${input.product_name}`,
            source_type: 'redemption',
            source_id: input.id,
            created_by: input.reviewed_by,
          })
        if (txErr) throw txErr
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alpicoins-redemptions'] })
      qc.invalidateQueries({ queryKey: ['alpicoins-redemptions-all'] })
      qc.invalidateQueries({ queryKey: ['alpicoins-balance'] })
      qc.invalidateQueries({ queryKey: ['alpicoins-transactions'] })
    },
  })
}
