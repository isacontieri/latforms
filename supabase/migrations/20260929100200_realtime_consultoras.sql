-- v3: acompanhamento ao vivo por Supabase Realtime (Broadcast em canal PRIVADO).
-- O servidor publica depois de gravar; só consultoras autenticadas recebem. O cliente nunca conecta.
-- Canais: ficha:<id> (uma ficha) e fichas:lista (lista do painel).
-- No painel do Supabase: Realtime → Settings → desligar "Allow public access".

create policy consultoras_recebem_broadcast on realtime.messages
for select to authenticated
using (
  (realtime.topic() like 'ficha:%' or realtime.topic() = 'fichas:lista')
  and public.is_consultora()
);
