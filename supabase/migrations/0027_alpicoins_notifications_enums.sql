-- =====================================================================
-- Alpiclub — Alpicoins: novos tipos de notificação
-- Adicionado em migration separada pois ALTER TYPE ADD VALUE não pode
-- ser usado na mesma transação que o consome (restrição do PostgreSQL).
-- =====================================================================

alter type public.notification_type add value if not exists 'alpicoins_earn_request';
alter type public.notification_type add value if not exists 'alpicoins_redemption_request';
