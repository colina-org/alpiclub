// =====================================================================
// Alpiclub — invite-user Edge Function
//
// Convida um novo usuário por e-mail. Apenas admins podem chamar.
// Pode pré-preencher equipe e cargo (lidos pelo trigger handle_new_user
// quando o profile é criado).
//
// Body: {
//   email: string,
//   full_name?: string,
//   team_id?: string,     // UUID da equipe
//   position?: string,    // Cargo livre (Ex.: "Tech Lead")
// }
//
// Deploy:
//   npx supabase functions deploy invite-user
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Método inválido. Use POST.')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Token de autenticação ausente.')
    const jwt = authHeader.replace('Bearer ', '')

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const SITE_URL = Deno.env.get('SITE_URL') ?? ''

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

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
        JSON.stringify({ error: 'Apenas administradores podem convidar usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const email = (body?.email ?? '').toString().trim().toLowerCase()
    const fullName = (body?.full_name ?? '').toString().trim()
    const teamId = (body?.team_id ?? '').toString().trim()
    const position = (body?.position ?? '').toString().trim()

    if (!email || !email.includes('@')) {
      throw new Error('E-mail inválido.')
    }

    // Metadata: o trigger handle_new_user lê esses campos ao criar o profile.
    const metadata: Record<string, string> = {}
    if (fullName) metadata.full_name = fullName
    if (teamId) metadata.team_id = teamId
    if (position) metadata.position = position

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: Object.keys(metadata).length > 0 ? metadata : undefined,
        redirectTo: SITE_URL ? `${SITE_URL}/setup-password` : undefined,
      },
    )
    if (inviteError) throw inviteError

    return new Response(
      JSON.stringify({ success: true, email }),
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
