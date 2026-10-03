-- =====================================================================
--  SABOR DEL CHIPÁ — instalación de la base de datos
--  Copiá TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede correr más de una vez sin romper nada.
-- =====================================================================

-- ---------- 1. Quién es administrador ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- 2. Datos del negocio (una sola fila) ----------
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  whatsapp text not null default '',
  instagram text not null default '',
  zona text not null default 'CABA',
  dias jsonb not null default '[]'::jsonb,
  opciones_entrega jsonb not null default '[]'::jsonb,
  precios_actualizados text not null default '',
  aviso text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- 3. Productos ----------
create table if not exists public.products (
  id text primary key,
  nombre text not null,
  descripcion text not null default '',
  precio_medio integer,
  precio_kilo integer,
  unidades text not null default '',
  img text not null default '',
  tags text[] not null default '{}',
  opciones text[] not null default '{}',
  a_pedido boolean not null default false,
  disponible boolean not null default true,
  en_mix boolean not null default false,
  orden integer not null default 0,
  updated_at timestamptz not null default now()
);

-- fecha de modificación automática
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------- 4. Seguridad (Row Level Security) ----------
alter table public.admins   enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.settings, public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update on public.settings to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins: ver la propia fila" on public.admins;
create policy "admins: ver la propia fila" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "settings: lectura pública" on public.settings;
create policy "settings: lectura pública" on public.settings for select using (true);
drop policy if exists "settings: admin crea" on public.settings;
create policy "settings: admin crea" on public.settings for insert to authenticated with check (public.is_admin());
drop policy if exists "settings: admin edita" on public.settings;
create policy "settings: admin edita" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products: lectura pública" on public.products;
create policy "products: lectura pública" on public.products for select using (true);
drop policy if exists "products: admin crea" on public.products;
create policy "products: admin crea" on public.products for insert to authenticated with check (public.is_admin());
drop policy if exists "products: admin edita" on public.products;
create policy "products: admin edita" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "products: admin borra" on public.products;
create policy "products: admin borra" on public.products for delete to authenticated using (public.is_admin());

-- ---------- 5. Fotos (Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "fotos: admin sube" on storage.objects;
create policy "fotos: admin sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos: admin actualiza" on storage.objects;
create policy "fotos: admin actualiza" on storage.objects
  for update to authenticated using (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos: admin borra" on storage.objects;
create policy "fotos: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos' and public.is_admin());

-- ---------- 6. Datos iniciales (lo que hoy está en Instagram) ----------
insert into public.settings (id, whatsapp, instagram, zona, dias, opciones_entrega, precios_actualizados, aviso) values
  (1, '5491149896364', 'https://www.instagram.com/sabordelchipa/', 'CABA', '[{"dia":"Lunes, miércoles y viernes","detalle":"Entregas por la tarde"},{"dia":"Sábado y domingo","detalle":"Entregas a convenir"}]'::jsonb, '["Lunes por la tarde","Miércoles por la tarde","Viernes por la tarde","Sábado (a convenir)","Domingo (a convenir)"]'::jsonb, 'julio 2026', '')
on conflict (id) do nothing;

insert into public.products (id, nombre, descripcion, precio_medio, precio_kilo, unidades, img, tags, opciones, a_pedido, disponible, en_mix, orden) values
  ('clasico', 'Chipá clásico', 'El de siempre: tres quesos de verdad (parmesano, reggianito y pategrás). También sin sal agregada.', 12000, 20000, '≈ 15 unidades por ½ kg', 'img/clasicos.webp', array['Tres quesos']::text[], array['Con sal', 'Sin sal agregada']::text[], false, true, true, 1),
  ('relleno', 'Chipá relleno', 'Corazón de jamón Paladini y parmesano. A pedido: roquefort, caprese, salame y queso, panceta, cebolla caramelizada.', 15000, 25000, '≈ 10 unidades por ½ kg', 'img/rellenos.webp', array['Relleno']::text[], array['Jamón y queso', 'Roquefort', 'Caprese', 'Salame y queso', 'Panceta', 'Cebolla caramelizada y queso']::text[], false, true, true, 2),
  ('galletitas', 'Galletitas de chipá', 'Finitas y crocantes. Para el mate, la picada o una birra bien fría. Listas en 10 minutos.', 15000, 25000, '', 'img/galletitas-tapeo.webp', array['Para picar']::text[], array[]::text[], false, true, true, 3),
  ('pan', 'Pan de chipá', 'Piezas de 100 a 120 g para armar sánguches o tostados. Tamaño a pedido.', 15000, 25000, '≈ 5 unidades por ½ kg', 'img/pan-de-chipa-sandwich.webp', array['Sánguche']::text[], array[]::text[], false, true, true, 4),
  ('grisines', 'Grisines de chipá', '20 cm de sabor artesanal. Ideales para la picada y las salsitas.', 15000, 25000, '', 'img/grisines-plato.webp', array['A pedido']::text[], array[]::text[], true, true, true, 5),
  ('bolitas', 'Chipá bolita', 'Bocaditos de 5 g, puro queso. El snack para mirar el partido.', 15000, 25000, '', 'img/bolitas-mano.webp', array['A pedido']::text[], array[]::text[], true, true, true, 6),
  ('pepas', 'Pepas de chipá', 'Con centro de queso. Armá tu mix o pedí tu sabor favorito.', 18000, 28000, '', 'img/pepas.webp', array['A pedido']::text[], array['Queso azul, parmesano y nuez', 'Cheddar, parmesano y Finlandia', 'Salame y parmesano', 'Mix de sabores']::text[], true, true, false, 7),
  ('bohios', 'Bohíos de verdura', 'Acelga o espinaca según la estación, con queso crema, ricota y parmesano.', 18000, 28000, '≈ 5 unidades por ½ kg', 'img/bohio-verdura-corte.webp', array['Verdura']::text[], array[]::text[], false, true, false, 8),
  ('vegano', 'Chipá vegano', '100% vegetal: quesos Felices las Vacas, leche de almendras y margarina. Producción por encargo.', 18000, 28000, '', 'img/chipa-vegano.webp', array['Vegano', 'A pedido']::text[], array[]::text[], true, true, false, 9)
on conflict (id) do nothing;

-- =====================================================================
--  PASO FINAL (después de crear el usuario del dueño en
--  Authentication → Users → Add user): reemplazá el mail y corré
--  SOLO estas líneas.
-- =====================================================================
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'MAIL-DEL-DUEÑO@ejemplo.com'
-- on conflict do nothing;
