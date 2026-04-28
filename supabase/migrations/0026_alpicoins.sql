-- =====================================================================
-- Alpiclub — Alpicoins
-- Sistema de moeda interna: pedidos de ganho, catálogo de prêmios e resgates.
-- =====================================================================

-- ── Produtos (catálogo de prêmios) ───────────────────────────────────
create table public.alpicoins_products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  image_url   text,
  price_coins integer not null check (price_coins > 0),
  stock       integer,                 -- null = ilimitado
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.alpicoins_products is
  'Catálogo de prêmios disponíveis na lojinha de Alpicoins.';

alter table public.alpicoins_products enable row level security;

create policy "alpicoins_products_select"
  on public.alpicoins_products for select
  to authenticated using (true);

create policy "alpicoins_products_admin_all"
  on public.alpicoins_products for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and app_role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and app_role = 'admin'
    )
  );

-- ── Pedidos de ganho de coins ─────────────────────────────────────────
create table public.alpicoins_earn_requests (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  description  text not null,           -- o que o usuário fez
  coins_requested integer not null check (coins_requested > 0),
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.alpicoins_earn_requests is
  'Pedidos de crédito de coins enviados pelos colaboradores para aprovação.';

create index alpicoins_earn_requests_profile_idx on public.alpicoins_earn_requests (profile_id);
create index alpicoins_earn_requests_status_idx  on public.alpicoins_earn_requests (status);

alter table public.alpicoins_earn_requests enable row level security;

create policy "alpicoins_earn_requests_own_select"
  on public.alpicoins_earn_requests for select
  to authenticated
  using (profile_id = auth.uid());

create policy "alpicoins_earn_requests_admin_select"
  on public.alpicoins_earn_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and app_role = 'admin'
    )
  );

create policy "alpicoins_earn_requests_own_insert"
  on public.alpicoins_earn_requests for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "alpicoins_earn_requests_admin_update"
  on public.alpicoins_earn_requests for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and app_role = 'admin'
    )
  );

-- ── Transações (extrato real de saldo) ───────────────────────────────
create table public.alpicoins_transactions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  coins        integer not null,       -- positivo = crédito, negativo = débito
  description  text not null,
  source_type  text not null check (source_type in ('earn', 'redemption', 'manual')),
  source_id    uuid,                   -- earn_request ou redemption id
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.alpicoins_transactions is
  'Extrato de movimentações de Alpicoins. Saldo = sum(coins) por perfil.';

create index alpicoins_transactions_profile_idx on public.alpicoins_transactions (profile_id);

alter table public.alpicoins_transactions enable row level security;

create policy "alpicoins_transactions_own_select"
  on public.alpicoins_transactions for select
  to authenticated
  using (profile_id = auth.uid());

create policy "alpicoins_transactions_admin_select"
  on public.alpicoins_transactions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and app_role = 'admin'
    )
  );

create policy "alpicoins_transactions_admin_insert"
  on public.alpicoins_transactions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and app_role = 'admin'
    )
  );

-- ── Pedidos de resgate ────────────────────────────────────────────────
create table public.alpicoins_redemptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  product_id  uuid not null references public.alpicoins_products(id) on delete restrict,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'delivered')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.alpicoins_redemptions is
  'Pedidos de resgate de prêmios usando Alpicoins.';

create index alpicoins_redemptions_profile_idx on public.alpicoins_redemptions (profile_id);
create index alpicoins_redemptions_status_idx  on public.alpicoins_redemptions (status);

alter table public.alpicoins_redemptions enable row level security;

create policy "alpicoins_redemptions_own_select"
  on public.alpicoins_redemptions for select
  to authenticated
  using (profile_id = auth.uid());

create policy "alpicoins_redemptions_admin_select"
  on public.alpicoins_redemptions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and app_role = 'admin'
    )
  );

create policy "alpicoins_redemptions_own_insert"
  on public.alpicoins_redemptions for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "alpicoins_redemptions_admin_update"
  on public.alpicoins_redemptions for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and app_role = 'admin'
    )
  );
