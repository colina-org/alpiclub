-- =====================================================================
-- Alpiclub — PDI: sócios não gerenciam outros sócios
-- Refina can_view_pdi: a regra "Sócio → Head" agora exclui Heads que
-- também são sócios da mesma agência (sócios são pares).
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

create or replace function public.can_view_pdi(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    -- Próprio dono
    auth.uid() = target_profile_id
    -- Admin
    or public.is_admin()
    -- Sócio gerencia PDI do Head (da agência da equipe do target),
    -- DESDE QUE o target NÃO seja também sócio da mesma agência.
    or exists (
      select 1
      from public.profiles target
      join public.teams t on t.id = target.team_id
      where target.id = target_profile_id
        and target.is_head
        and public.is_partner_of(t.agency_id)
        and not exists (
          select 1 from public.agency_partners
          where profile_id = target_profile_id
            and agency_id = t.agency_id
        )
    )
    -- Head da equipe gerencia PDI do Líder
    or exists (
      select 1
      from public.profiles me, public.profiles target
      where me.id = auth.uid()
        and target.id = target_profile_id
        and me.team_id is not null
        and me.team_id = target.team_id
        and me.is_head
        and target.is_lead
    )
    -- Líder da equipe gerencia PDI do Membro (não-Head, não-Líder)
    or exists (
      select 1
      from public.profiles me, public.profiles target
      where me.id = auth.uid()
        and target.id = target_profile_id
        and me.team_id is not null
        and me.team_id = target.team_id
        and me.is_lead
        and not target.is_head
        and not target.is_lead
    );
$$;
