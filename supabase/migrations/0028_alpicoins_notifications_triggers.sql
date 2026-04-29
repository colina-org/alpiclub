-- =====================================================================
-- Alpiclub — Alpicoins: triggers de notificação para admins
-- Quando alguém submete pedido de earn ou resgate, todos os admins
-- recebem uma notificação no sino.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Trigger: novo pedido de coins → notifica todos os admins
-- ---------------------------------------------------------------------
create or replace function public.notify_alpicoins_earn_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_name text;
  admin_id       uuid;
begin
  select coalesce(full_name, split_part(email, '@', 1))
    into requester_name
    from public.profiles
    where id = new.profile_id;

  for admin_id in
    select id from public.profiles
    where app_role = 'admin'
      and archived_at is null
      and id <> new.profile_id   -- não notifica o próprio solicitante
  loop
    insert into public.notifications (profile_id, type, title, message, link)
    values (
      admin_id,
      'alpicoins_earn_request',
      'Novo pedido de Alpicoins',
      coalesce(requester_name, 'Alguém') || ' solicitou ' || new.coins_requested || ' coins: ' || left(new.description, 80),
      '/alpicoins'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists on_alpicoins_earn_request_inserted on public.alpicoins_earn_requests;
create trigger on_alpicoins_earn_request_inserted
  after insert on public.alpicoins_earn_requests
  for each row execute function public.notify_alpicoins_earn_request();

-- ---------------------------------------------------------------------
-- 2. Trigger: novo pedido de resgate → notifica todos os admins
-- ---------------------------------------------------------------------
create or replace function public.notify_alpicoins_redemption_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_name text;
  product_name   text;
  admin_id       uuid;
begin
  select coalesce(full_name, split_part(email, '@', 1))
    into requester_name
    from public.profiles
    where id = new.profile_id;

  select name
    into product_name
    from public.alpicoins_products
    where id = new.product_id;

  for admin_id in
    select id from public.profiles
    where app_role = 'admin'
      and archived_at is null
      and id <> new.profile_id
  loop
    insert into public.notifications (profile_id, type, title, message, link)
    values (
      admin_id,
      'alpicoins_redemption_request',
      'Novo pedido de resgate',
      coalesce(requester_name, 'Alguém') || ' quer resgatar: ' || coalesce(product_name, 'produto'),
      '/alpicoins'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists on_alpicoins_redemption_inserted on public.alpicoins_redemptions;
create trigger on_alpicoins_redemption_inserted
  after insert on public.alpicoins_redemptions
  for each row execute function public.notify_alpicoins_redemption_request();
