-- Fotos dos pratos: bucket público para leitura; só admin envia, troca ou apaga.
-- Rode depois do 001 (usa a função public.is_admin).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket público: qualquer um abre a foto pelo endereço. Não criamos política de
-- "select" para não deixar ninguém LISTAR os arquivos do bucket.
create policy "fotos: admin envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu-images' and public.is_admin());

create policy "fotos: admin troca" on storage.objects
  for update to authenticated
  using (bucket_id = 'menu-images' and public.is_admin())
  with check (bucket_id = 'menu-images' and public.is_admin());

create policy "fotos: admin apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-images' and public.is_admin());
