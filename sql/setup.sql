-- ============================================================
-- PORTAFOLIO ULA - DESARROLLO DE APLICACIONES
-- Ejecuta este archivo en Supabase > SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

-- 1) Perfiles/roles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  university_code text,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Solo cada usuario puede consultar su propio perfil.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- Función segura para comprobar si el usuario actual es admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2) Crear perfil automáticamente al registrar una cuenta.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, university_code, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    null,
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 3) Trabajos académicos
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  unit integer not null check (unit between 1 and 4),
  week integer not null check (week between 1 and 4),
  work_type text not null default 'archivo',
  external_url text,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.works enable row level security;

-- Público: cualquiera puede ver los trabajos.
drop policy if exists "works_public_read" on public.works;
create policy "works_public_read"
on public.works for select
to anon, authenticated
using (true);

-- Solo admins pueden crear, editar o borrar.
drop policy if exists "works_admin_insert" on public.works;
create policy "works_admin_insert"
on public.works for insert
to authenticated
with check (public.is_admin());

drop policy if exists "works_admin_update" on public.works;
create policy "works_admin_update"
on public.works for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "works_admin_delete" on public.works;
create policy "works_admin_delete"
on public.works for delete
to authenticated
using (public.is_admin());

-- 4) Bucket de archivos.
insert into storage.buckets (id, name, public, file_size_limit)
values ('trabajos', 'trabajos', true, 52428800)
on conflict (id) do update
set public = true, file_size_limit = 52428800;

-- Público: visualizar/descargar archivos.
drop policy if exists "trabajos_public_read" on storage.objects;
create policy "trabajos_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'trabajos');

-- Admin: subir archivos.
drop policy if exists "trabajos_admin_insert" on storage.objects;
create policy "trabajos_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'trabajos' and public.is_admin());

-- Admin: actualizar objetos.
drop policy if exists "trabajos_admin_update" on storage.objects;
create policy "trabajos_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'trabajos' and public.is_admin())
with check (bucket_id = 'trabajos' and public.is_admin());

-- Admin: borrar objetos.
drop policy if exists "trabajos_admin_delete" on storage.objects;
create policy "trabajos_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'trabajos' and public.is_admin());

-- ============================================================
-- DESPUÉS DE CREAR TU CUENTA:
-- 1. Ve a Authentication > Users y copia el UUID de tu usuario.
-- 2. Ejecuta:
--
-- update public.profiles
-- set role = 'admin',
--     full_name = 'ESPINAL HUAMAN LUIS',
--     university_code = 'P01898G'
-- where id = 'PEGA-AQUI-TU-UUID';
--
-- Con eso tu cuenta tendrá acceso al panel Admin.
-- ============================================================
