// =====================================================================
// Alpiclub — archive-user Edge Function
//
// Arquiva (soft delete) ou desarquiva uma pessoa.
// - Atualiza profiles.archived_at (timestamp ou null)
// - Bana / desbana o usuário no auth.users (revogando o login)
//
// Apenas admin pode chamar.
//
// Body: { profile_id: string, archive: boolean }
//
// Deploy:
//   npx supabase functions deploy archive-user
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Duração arbitrariamente longa para "ban forever".
const BAN_FOREVER = '876600h' // ~100 anos

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') throw new Error('Método inválido. Use POST.')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Token de autenticação ausente.')
    const jwt = authHeader.replace('Bearer ', '')

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Valida o chamador.
    const { data: callerData, error: callerError } =
      await adminClient.auth.getUser(jwt)
    if (callerError || !callerData.user) {
      throw new Error('Não autenticado.')
    }

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('app_role')
      .eq('id', callerData.user.id)
      .single()
    if (profileError || callerProfile?.app_role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem arquivar pessoas.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Body
    const body = await req.json().catch(() => ({}))
    const profileId = (body?.profile_id ?? '').toString()
    const archive = !!body?.archive

    if (!profileId) throw new Error('profile_id obrigatório.')

    // Não permite arquivar a si mesmo (proteção).
    if (profileId === callerData.user.id) {
      throw new Error('Você não pode arquivar a si mesmo.')
    }

    // 1) Atualiza o profile (soft delete).
    const archivedAt = archive ? new Date().toISOString() : null
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ archived_at: archivedAt })
      .eq('id', profileId)
    if (updateError) throw updateError

    // 2) Bana / desbana o usuário no auth.
    const { error: banError } = await adminClient.auth.admin.updateUserById(
      profileId,
      { ban_duration: archive ? BAN_FOREVER : 'none' },
    )
    if (banError) {
      // Rollback do profile se o ban falhar.
      await adminClient
        .from('profiles')
        .update({ archived_at: archive ? null : archivedAt })
        .eq('id', profileId)
      throw banError
    }

    return new Response(
      JSON.stringify({ success: true, profile_id: profileId, archived: archive }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
