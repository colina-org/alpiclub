-- =====================================================================
-- Alpiclub — Bingo: novo tipo de notificação
-- Separado pois ALTER TYPE ADD VALUE não pode ser usado na mesma
-- transação que o consome (restrição do PostgreSQL).
-- =====================================================================

alter type public.notification_type add value if not exists 'bingo_friday_reminder';
