# Edge Function: invite-user

Envia convite por e-mail para um novo usuário, criando sua conta no Supabase Auth.
O e-mail tem link mágico que leva para `/setup-password`, onde o usuário define a
senha e entra na plataforma.

Apenas administradores podem chamar (verificação dupla: front oculta o botão e a
function valida `profiles.app_role = 'admin'` antes de processar).

## Deploy

Pré-requisito: Supabase CLI instalada (`npm i -g supabase` ou `npx supabase`).

1. **Login na CLI** (uma vez):
   ```bash
   npx supabase login
   ```

2. **Linkar com o projeto**:
   ```bash
   npx supabase link --project-ref <seu-project-ref>
   ```
   O `project-ref` está na URL do dashboard: `https://supabase.com/dashboard/project/<project-ref>`.

3. **Configurar secrets** (no dashboard: Settings → Edge Functions → Secrets, ou via CLI):
   ```bash
   npx supabase secrets set SITE_URL=https://seu-dominio.com
   ```
   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são preenchidos automaticamente.

4. **Deploy**:
   ```bash
   npx supabase functions deploy invite-user
   ```

## Configuração de e-mail no Supabase

Por padrão o Supabase usa um SMTP compartilhado com **rate limits agressivos** (algumas dezenas de e-mails/dia, e e-mails podem ir para spam). Para uso real:

- **Settings → Authentication → SMTP Settings**
- Configurar com um provedor próprio (Resend, SendGrid, AWS SES, etc.)

## Personalizar o template do e-mail

- **Settings → Authentication → Email Templates → Invite user**
- Pode alterar assunto e corpo, com variáveis tipo `{{ .ConfirmationURL }}`.
