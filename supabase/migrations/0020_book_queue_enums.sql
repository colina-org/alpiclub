-- =====================================================================
-- Alpiclub — Fila de espera (PARTE 1 de 2)
-- Adiciona valores aos enums. Roda PRIMEIRO. PostgreSQL não permite usar
-- valor novo de enum na mesma transação em que foi criado, então a parte
-- de índice/trigger/função fica em 0021.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

alter type public.book_borrow_status add value if not exists 'queued';
alter type public.notification_type add value if not exists 'book_available_for_you';
