-- Imitação mínima do ambiente do Supabase, usada SÓ nos testes locais (PGlite).
-- Não rode este arquivo no seu projeto Supabase: lá isso já existe.

create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id    uuid primary key,
  email text
);

-- No Supabase, auth.uid() lê o usuário do token JWT da requisição.
-- Aqui lemos de uma configuração da sessão que os testes definem.
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Privilégios padrão que o Supabase concede em tabelas/funções novas do schema public.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
