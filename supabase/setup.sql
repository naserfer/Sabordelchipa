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
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
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
  fotos text[] not null default '{}',              -- fotos extra (la principal es img)
  categoria text not null default 'especiales',    -- 'clasicos' | 'formas' | 'especiales'
  tags text[] not null default '{}',
  opciones text[] not null default '{}',
  a_pedido boolean not null default false,
  disponible boolean not null default true,
  en_mix boolean not null default false,
  orden integer not null default 0,
  updated_at timestamptz not null default now()
);

-- columnas agregadas después (por si la tabla ya existía)
alter table public.products add column if not exists fotos text[] not null default '{}';
alter table public.products add column if not exists categoria text not null default 'especiales';

-- fecha de modificación automática
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists products_touch on public.products;
create or replace trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create or replace trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------- 4. Seguridad (Row Level Security) ----------
alter table public.admins   enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.settings, public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update on public.settings to authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant select on public.admins to authenticated;

drop policy if exists "admins: ver la propia fila" on public.admins;
create policy "admins: ver la propia fila" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "settings: lectura pública" on public.settings;
create policy "settings: lectura pública" on public.settings for select using (true);
drop policy if exists "settings: admin crea" on public.settings;
create policy "settings: admin crea" on public.settings for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "settings: admin edita" on public.settings;
create policy "settings: admin edita" on public.settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "products: lectura pública" on public.products;
create policy "products: lectura pública" on public.products for select using (true);
drop policy if exists "products: admin crea" on public.products;
create policy "products: admin crea" on public.products for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "products: admin edita" on public.products;
create policy "products: admin edita" on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "products: admin borra" on public.products;
create policy "products: admin borra" on public.products for delete to authenticated using ((select public.is_admin()));

-- ---------- 5. Fotos (Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "fotos: admin sube" on storage.objects;
create policy "fotos: admin sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos' and (select public.is_admin()));
drop policy if exists "fotos: admin actualiza" on storage.objects;
create policy "fotos: admin actualiza" on storage.objects
  for update to authenticated using (bucket_id = 'fotos' and (select public.is_admin()));
drop policy if exists "fotos: admin borra" on storage.objects;
create policy "fotos: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos' and (select public.is_admin()));

-- ---------- 6. Datos iniciales (carta de octubre 2026) ----------
insert into public.settings (id, whatsapp, instagram, zona, dias, opciones_entrega, precios_actualizados, aviso) values
  (1, '5491149896364', 'https://www.instagram.com/sabordelchipa/', 'CABA', '[{"dia":"Lunes, miércoles y viernes","detalle":"Entregas por la tarde"},{"dia":"Sábado y domingo","detalle":"Entregas a convenir"}]'::jsonb, '["Lunes por la tarde","Miércoles por la tarde","Viernes por la tarde","Sábado (a convenir)","Domingo (a convenir)"]'::jsonb, 'octubre 2026', '')
on conflict (id) do nothing;

insert into public.products (id, categoria, nombre, descripcion, precio_medio, precio_kilo, unidades, img, fotos, tags, opciones, a_pedido, disponible, en_mix, orden) values
  ('clasico', 'clasicos', 'Chipá clásico', 'Tres quesos (600 g por kilo de masa), fécula de mandioca Femag, leche deslactosada y manteca La Serenísima, huevos de granja, sal y un toque de pimienta. La base de todas nuestras variedades.', 12000, 22000, '≈ 15 unidades por ½ kg', 'img/clasicos.webp', array['img/textura-chipa.webp']::text[], array['Siempre disponible']::text[], array['Con sal', 'Sin sal agregada']::text[], false, true, true, 1),
  ('galletitas', 'formas', 'Galletitas de chipá', 'Finas galletas, crocantes por fuera y esponjosas por dentro. Para el mate, la picada o una birra bien fría.', 15000, 25000, '≈ 24 unidades por ½ kg', 'img/galletitas-tapeo.webp', array['img/galletitas-plato.webp']::text[], array['Para picar']::text[], '{}'::text[], true, true, true, 2),
  ('bolitas', 'formas', 'Chipá bolita', 'Pequeñas bolitas de 6 g, puro queso. El bocadito para mirar el partido o sumar a la picada.', 15000, 25000, '≈ 80 unidades por ½ kg', 'img/bolitas-mano.webp', array['img/picada-grisines-bolitas.webp']::text[], array['Bocaditos']::text[], '{}'::text[], true, true, true, 3),
  ('grisines', 'formas', 'Grisines de chipá', 'Palitos de 20 cm de largo, crocantes y con mucho queso. Ideales para la picada y las salsitas.', 15000, 25000, '≈ 16 unidades por ½ kg', 'img/grisines-plato.webp', array['img/grisines-bowl.webp', 'img/picada-grisines-bolitas.webp']::text[], array['Para picar']::text[], '{}'::text[], true, true, true, 4),
  ('relleno', 'especiales', 'Chipá relleno', 'Corazón de jamón Paladini y queso parmesano, siempre en stock. A pedido: roquefort, caprese, salame y queso, panceta, cebolla caramelizada con queso y más.', 15000, 25000, '≈ 10 unidades por ½ kg', 'img/rellenos.webp', '{}'::text[], array['Relleno']::text[], array['Jamón y queso', 'Roquefort', 'Caprese', 'Salame y queso', 'Panceta', 'Cebolla caramelizada y queso']::text[], false, true, true, 5),
  ('pan', 'especiales', 'Pan de chipá', 'Panes de 100 a 120 g, ideales para armar sánguches o tostados. La cantidad y el tamaño se pueden modificar.', 15000, 25000, '≈ 5 unidades por ½ kg', 'img/pan-de-chipa-sandwich.webp', array['img/pan-sandwich-lechuga.webp']::text[], array['Sánguche']::text[], '{}'::text[], false, true, true, 6),
  ('pepas', 'especiales', 'Pepas de chipá', 'Variedades gourmet con centro relleno: queso azul, parmesano y nuez; cheddar y Finlandia; o dulce de membrillo y queso.', 18000, 30000, '≈ 12 unidades por ½ kg', 'img/pepas.webp', '{}'::text[], array['Gourmet']::text[], array['Queso azul, parmesano y nuez', 'Cheddar y Finlandia', 'Dulce de membrillo y queso']::text[], true, true, false, 7),
  ('bohios', 'especiales', 'Bohíos de chipá', 'Bollos rellenos de 100 a 120 g. Verdura: acelga o espinaca, queso crema light, ricota magra y parmesano. Calabaza: zapallo, Finlandia y Port Salut. Caprese: tomate, pategrás y albahaca.', 18000, 30000, '≈ 5 unidades por ½ kg', 'img/bohio-verdura-corte.webp', array['img/bohio-calabaza.webp', 'img/bohios-verdura-plato.webp']::text[], array['Rellenos']::text[], array['Verdura y queso', 'Calabaza y queso', 'Caprese']::text[], true, true, false, 8),
  ('pizzetas', 'especiales', 'Pizzetas de chipá', 'Fina masa de chipá de 100 g con salsa de tomate, lista para que le pongas lo que quieras arriba. El tamaño se puede modificar.', 15000, 25000, '≈ 5 unidades por ½ kg', 'img/pizzetas-bolsa.webp', '{}'::text[], '{}'::text[], '{}'::text[], true, true, false, 9),
  ('vegano', 'especiales', 'Chipá vegano', 'Hecho especialmente con quesos Felices las Vacas, manteca vegetal, leche de almendras y levadura sabor queso.', 18000, 32000, '≈ 15 unidades por ½ kg', 'img/chipa-vegano.webp', '{}'::text[], array['Vegano']::text[], '{}'::text[], true, true, false, 10)
on conflict (id) do nothing;

-- =====================================================================
--  PASO FINAL (después de crear el usuario del dueño en
--  Authentication → Users → Add user): reemplazá el mail y corré
--  SOLO estas líneas.
-- =====================================================================
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'MAIL-DEL-DUEÑO@ejemplo.com'
-- on conflict do nothing;
