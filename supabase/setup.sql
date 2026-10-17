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
  opciones_listas text[] not null default '{}',     -- gustos que ya están hechos (la web los marca «Hay hecho»)
  a_pedido boolean not null default false,
  disponible boolean not null default true,
  en_mix boolean not null default false,
  orden integer not null default 0,
  updated_at timestamptz not null default now()
);

-- columnas agregadas después (por si la tabla ya existía)
alter table public.products add column if not exists fotos text[] not null default '{}';
alter table public.products add column if not exists categoria text not null default 'especiales';
alter table public.products add column if not exists opciones_listas text[] not null default '{}';

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
  ('galletitas', 'formas', 'Galletitas de chipá', 'Finas galletas, crocantes por fuera y esponjosas por dentro. Para el mate, la picada o una birra bien fría.', 15000, 25000, '≈ 24 unidades por ½ kg', 'img/galletitas-tapeo.webp', array['img/galletitas-plato.webp']::text[], array['Para picar']::text[], '{}'::text[], false, true, true, 2),
  ('bolitas', 'formas', 'Chipá bolita', 'Pequeñas bolitas de 6 g, puro queso. El bocadito para mirar el partido o sumar a la picada.', 15000, 25000, '≈ 80 unidades por ½ kg', 'img/bolitas-mano.webp', array['img/picada-grisines-bolitas.webp']::text[], array['Bocaditos']::text[], '{}'::text[], true, true, true, 3),
  ('grisines', 'formas', 'Grisines de chipá', 'Palitos de 20 cm de largo, crocantes y con mucho queso. Ideales para la picada y las salsitas.', 15000, 25000, '≈ 16 unidades por ½ kg', 'img/grisines-plato.webp', array['img/grisines-bowl.webp', 'img/picada-grisines-bolitas.webp']::text[], array['Para picar']::text[], '{}'::text[], true, true, true, 4),
  ('relleno', 'especiales', 'Chipá relleno', 'Corazón de jamón Paladini y queso parmesano, siempre en stock. A pedido: roquefort, caprese, salame y queso, panceta, cebolla caramelizada con queso y más.', 15000, 25000, '≈ 10 unidades por ½ kg', 'img/rellenos.webp', '{}'::text[], array['Relleno']::text[], array['Jamón y queso', 'Roquefort', 'Caprese', 'Salame y queso', 'Panceta', 'Cebolla caramelizada y queso']::text[], false, true, true, 5),
  ('pan', 'especiales', 'Pan de chipá', 'Panes de 100 a 120 g, ideales para armar sánguches o tostados. La cantidad y el tamaño se pueden modificar.', 15000, 25000, '≈ 5 unidades por ½ kg', 'img/pan-de-chipa-sandwich.webp', array['img/pan-sandwich-lechuga.webp']::text[], array['Sánguche']::text[], '{}'::text[], false, true, true, 6),
  ('pepas', 'especiales', 'Pepas de chipá', 'Variedades gourmet con centro relleno: queso azul, parmesano y nuez; cheddar y Finlandia; o dulce de membrillo y queso.', 18000, 30000, '≈ 12 unidades por ½ kg', 'img/pepas.webp', '{}'::text[], array['Gourmet']::text[], array['Queso azul, parmesano y nuez', 'Cheddar y Finlandia', 'Dulce de membrillo y queso']::text[], true, true, false, 7),
  ('bohios', 'especiales', 'Bohíos de chipá', 'Bollos rellenos de 100 a 120 g. Verdura: acelga o espinaca, queso crema light, ricota magra y parmesano. Calabaza: zapallo, Finlandia y Port Salut. Caprese: tomate, pategrás y albahaca.', 18000, 30000, '≈ 5 unidades por ½ kg', 'img/bohio-verdura-corte.webp', array['img/bohio-calabaza.webp', 'img/bohios-verdura-plato.webp']::text[], array['Rellenos']::text[], array['Verdura y queso', 'Calabaza y queso', 'Caprese']::text[], true, true, false, 8),
  ('pizzetas', 'especiales', 'Pizzetas de chipá', 'Fina masa de chipá de 100 g con salsa de tomate, lista para que le pongas lo que quieras arriba. El tamaño se puede modificar.', 15000, 25000, '≈ 5 unidades por ½ kg', 'img/pizzetas-bolsa.webp', '{}'::text[], '{}'::text[], '{}'::text[], true, true, false, 9),
  ('vegano', 'especiales', 'Chipá vegano', 'Hecho especialmente con quesos Felices las Vacas, manteca vegetal, leche de almendras y levadura sabor queso.', 18000, 32000, '≈ 15 unidades por ½ kg', 'img/chipa-vegano.webp', '{}'::text[], array['Vegano']::text[], '{}'::text[], true, true, false, 10)
on conflict (id) do nothing;

-- ---------- 7. CRM: clientes, pedidos, stock y visitas (2026-10-04) ----------
--  Detalle y notas de seguridad en supabase/migrations/20261004_crm.sql

-- ---------- Clientes ----------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 80),
  telefono text not null default '' check (telefono ~ '^[0-9]{0,15}$'),
  email text not null default '' check (char_length(email) <= 120),
  direccion text not null default '' check (char_length(direccion) <= 200),
  cumple date,
  etiquetas text[] not null default '{}',
  notas text not null default '' check (char_length(notas) <= 2000),
  origen text not null default 'manual' check (char_length(origen) <= 30),   -- web | whatsapp | instagram | recomendacion | otro
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clientes_tel_idx on public.clientes (right(telefono, 10)) where telefono <> '';

-- ---------- Pedidos ----------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null default upper(substr(md5(random()::text), 1, 5)) check (char_length(codigo) between 1 and 12),
  cliente_id uuid references public.clientes (id) on delete set null,
  cliente_nombre text not null default '' check (char_length(cliente_nombre) <= 80),
  cliente_tel text not null default '' check (cliente_tel ~ '^[0-9]{0,15}$'),
  direccion text not null default '' check (char_length(direccion) <= 200),
  -- [{product_id, nombre, size: 'medio'|'kilo', opt, qty, unit, mix?: [product_id]}]
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  kg numeric(8,2) not null default 0,                 -- se calcula solo con los items
  envio integer not null default 0 check (envio >= 0),
  total integer not null default 0 check (total >= 0),
  precio_pendiente boolean not null default false,    -- hay algo "a confirmar" (mix, sin precio)
  entrega text not null default '' check (char_length(entrega) <= 120),
  fecha_entrega date,
  pago text not null default '' check (char_length(pago) <= 40),
  pagado boolean not null default false,
  notas text not null default '' check (char_length(notas) <= 1000),
  estado text not null default 'nuevo' check (estado in ('nuevo', 'confirmado', 'entregado', 'cancelado')),
  origen text not null default 'manual' check (origen in ('web', 'manual')),
  stock_descontado boolean not null default false,    -- lo maneja el trigger, no el panel
  visitante text not null default '' check (char_length(visitante) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pedidos_created_idx on public.pedidos (created_at desc);
create index if not exists pedidos_cliente_idx on public.pedidos (cliente_id);
create index if not exists pedidos_visitante_idx on public.pedidos (visitante, created_at) where visitante <> '';

-- ---------- Stock ----------
create table if not exists public.inventario (
  product_id text primary key references public.products (id) on delete cascade on update cascade,
  stock_kg numeric(10,3) not null default 0,
  minimo_kg numeric(10,3) not null default 1 check (minimo_kg >= 0),   -- aviso de "queda poco"
  updated_at timestamptz not null default now()
);

create table if not exists public.movimientos_stock (
  id bigint generated always as identity primary key,
  product_id text not null references public.products (id) on delete cascade on update cascade,
  delta numeric(10,3) not null check (delta <> 0),     -- kg: + entra, − sale
  motivo text not null default 'ajuste' check (motivo in ('produccion', 'venta', 'devolucion', 'ajuste', 'merma')),
  pedido_id uuid references public.pedidos (id) on delete set null deferrable initially deferred,
  nota text not null default '' check (char_length(nota) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists movimientos_producto_idx on public.movimientos_stock (product_id, created_at desc);
create index if not exists movimientos_pedido_idx on public.movimientos_stock (pedido_id);
create index if not exists movimientos_created_idx on public.movimientos_stock (created_at desc);

-- ---------- Visitas (anónimas) ----------
create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  evento text not null check (evento in ('visita', 'carrito', 'pedido', 'whatsapp')),
  visitante text not null check (char_length(visitante) between 8 and 40),   -- id al azar del navegador
  sesion text not null check (char_length(sesion) between 8 and 40),
  ruta text not null default '/' check (char_length(ruta) <= 120),
  fuente text not null default 'directo' check (char_length(fuente) <= 40),
  dispositivo text not null default 'movil' check (dispositivo in ('movil', 'tablet', 'compu'))
);
create index if not exists eventos_created_idx on public.eventos (created_at);
create index if not exists eventos_sesion_idx on public.eventos (sesion, created_at);
create index if not exists eventos_visitante_idx on public.eventos (visitante, created_at);

-- ---------- fechas de modificación ----------
drop trigger if exists clientes_touch on public.clientes;
create trigger clientes_touch before update on public.clientes
  for each row execute function public.touch_updated_at();
drop trigger if exists pedidos_touch on public.pedidos;
create trigger pedidos_touch before update on public.pedidos
  for each row execute function public.touch_updated_at();
drop trigger if exists inventario_touch on public.inventario;
create trigger inventario_touch before update on public.inventario
  for each row execute function public.touch_updated_at();

-- ---------- stock: lógica ----------
-- kilos de una lista de items (½ kg o 1 kg × cantidad)
create or replace function public.kg_items(p_items jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((case when it->>'size' = 'kilo' then 1 else 0.5 end)
                      * greatest(coalesce((it->>'qty')::numeric, 1), 0)), 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it;
$$;

-- mueve el stock de los items de un pedido: signo -1 descuenta, +1 devuelve.
-- El mix se reparte en partes iguales entre las variedades elegidas.
-- Solo toca productos que tienen control de stock (fila en inventario).
create or replace function public.mover_stock_pedido(p_items jsonb, p_signo integer, p_pedido uuid, p_codigo text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  it jsonb;
  v_kg numeric;
  v_ids text[];
  v_pid text;
  v_n integer;
begin
  for it in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_kg := (case when it->>'size' = 'kilo' then 1 else 0.5 end) * greatest(coalesce((it->>'qty')::numeric, 1), 0);
    continue when v_kg <= 0;
    if jsonb_typeof(it->'mix') = 'array' and jsonb_array_length(it->'mix') > 0 then
      select array_agg(t.v) into v_ids from jsonb_array_elements_text(it->'mix') as t(v);
    else
      v_ids := array[it->>'product_id'];
    end if;
    v_n := greatest(coalesce(array_length(v_ids, 1), 1), 1);
    foreach v_pid in array v_ids loop
      if v_pid is not null and exists (select 1 from public.inventario i where i.product_id = v_pid) then
        insert into public.movimientos_stock (product_id, delta, motivo, pedido_id, nota)
        values (v_pid, p_signo * round(v_kg / v_n, 3),
                case when p_signo < 0 then 'venta' else 'devolucion' end,
                p_pedido, left('Pedido ' || coalesce(p_codigo, ''), 200));
      end if;
    end loop;
  end loop;
end;
$$;

-- antes de guardar un pedido: calcula los kg y descuenta / devuelve stock
create or replace function public.pedidos_antes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.kg := public.kg_items(new.items);
  if tg_op = 'INSERT' then
    new.stock_descontado := false;
  else
    new.stock_descontado := old.stock_descontado;   -- el panel no lo puede pisar
    if old.stock_descontado and (new.estado <> 'entregado' or new.items is distinct from old.items) then
      perform public.mover_stock_pedido(old.items, 1, old.id, old.codigo);
      new.stock_descontado := false;
    end if;
  end if;
  if new.estado = 'entregado' and not new.stock_descontado then
    perform public.mover_stock_pedido(new.items, -1, new.id, new.codigo);
    new.stock_descontado := true;
  end if;
  return new;
end;
$$;
drop trigger if exists pedidos_antes on public.pedidos;
create trigger pedidos_antes before insert or update on public.pedidos
  for each row execute function public.pedidos_antes();

-- si se borra un pedido entregado, el stock vuelve
create or replace function public.pedidos_borrado()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.stock_descontado then
    perform public.mover_stock_pedido(old.items, 1, null, old.codigo || ' (borrado)');
  end if;
  return old;
end;
$$;
drop trigger if exists pedidos_borrado on public.pedidos;
create trigger pedidos_borrado after delete on public.pedidos
  for each row execute function public.pedidos_borrado();

-- cada movimiento suma o resta en el inventario (y si el producto no tenía
-- control de stock, lo empieza a tener)
create or replace function public.movimientos_aplicar()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.inventario as i (product_id, stock_kg) values (new.product_id, new.delta)
  on conflict (product_id) do update set stock_kg = i.stock_kg + excluded.stock_kg;
  return null;
end;
$$;
drop trigger if exists movimientos_aplicar on public.movimientos_stock;
create trigger movimientos_aplicar after insert on public.movimientos_stock
  for each row execute function public.movimientos_aplicar();

-- El stock es solo para el panel: ya no prende ni apaga productos en la web
-- (2026-10-17, ver migrations/20261017_stock_informativo.sql). «disponible»
-- es un interruptor manual («Se puede pedir»). La función queda sin efecto.
create or replace function public.inventario_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return null;
end;
$$;
drop trigger if exists inventario_sync on public.inventario;
create trigger inventario_sync after insert or update of stock_kg on public.inventario
  for each row execute function public.inventario_sync();

-- ---------- pedido desde la web ----------
create or replace function public.crear_pedido_web(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := left(btrim(coalesce(p->>'nombre', '')), 80);
  v_dir text := left(btrim(coalesce(p->>'direccion', '')), 200);
  v_tel text := left(regexp_replace(coalesce(p->>'telefono', ''), '\D', '', 'g'), 15);
  v_codigo text := left(regexp_replace(upper(coalesce(p->>'codigo', '')), '[^A-Z0-9]', '', 'g'), 12);
  v_vis text := left(regexp_replace(coalesce(p->>'visitante', ''), '[^A-Za-z0-9_-]', '', 'g'), 40);
  v_items jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_pend boolean := false;
  it jsonb;
  v_pid text;
  v_size text;
  v_qty integer;
  v_opt text;
  v_unit integer;
  v_mix jsonb;
  v_prod record;
  v_cliente uuid;
  v_prev text;
begin
  if v_nombre = '' or v_dir = '' then
    raise exception 'Faltan el nombre o la dirección.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p->'items'), '') <> 'array' then
    raise exception 'El pedido no tiene productos.' using errcode = '22023';
  end if;
  if jsonb_array_length(p->'items') not between 1 and 30 then
    raise exception 'El pedido no tiene productos.' using errcode = '22023';
  end if;

  -- doble toque o reenvío: el mismo navegador hace menos de 30 segundos
  if v_vis <> '' then
    select codigo into v_prev from public.pedidos
      where visitante = v_vis and created_at > now() - interval '30 seconds'
      order by created_at desc limit 1;
    if found then return jsonb_build_object('ok', true, 'codigo', v_prev, 'repetido', true); end if;
  end if;
  -- freno anti-spam global
  if (select count(*) from public.pedidos where origen = 'web' and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Hay demasiados pedidos seguidos. Probá en unos minutos.' using errcode = '54000';
  end if;

  for it in select value from jsonb_array_elements(p->'items') loop
    continue when jsonb_typeof(it) <> 'object';
    v_pid := left(coalesce(it->>'product_id', ''), 60);
    v_size := case when it->>'size' = 'kilo' then 'kilo' else 'medio' end;
    v_qty := least(greatest(coalesce(nullif(left(regexp_replace(coalesce(it->>'qty', '1'), '\D', '', 'g'), 3), '')::integer, 1), 1), 50);
    v_opt := left(btrim(coalesce(it->>'opt', '')), 200);
    if v_pid = 'mix' then
      select coalesce(jsonb_agg(pr.id order by pr.orden), '[]'::jsonb) into v_mix
        from public.products pr
        where jsonb_typeof(it->'mix') = 'array'
          and pr.id in (select t.v from jsonb_array_elements_text(it->'mix') as t(v));
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'product_id', 'mix', 'nombre', 'Mix ½ kg', 'size', 'medio', 'opt', v_opt, 'qty', v_qty, 'unit', null, 'mix', v_mix));
      v_pend := true;
    else
      select pr.id, pr.nombre, pr.precio_medio, pr.precio_kilo into v_prod from public.products pr where pr.id = v_pid;
      continue when not found;
      v_unit := case when v_size = 'kilo' then v_prod.precio_kilo else v_prod.precio_medio end;
      if v_unit is null then v_pend := true; else v_total := v_total + v_unit * v_qty; end if;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'product_id', v_prod.id, 'nombre', v_prod.nombre, 'size', v_size, 'opt', v_opt, 'qty', v_qty, 'unit', v_unit));
    end if;
  end loop;
  if jsonb_array_length(v_items) = 0 then
    raise exception 'El pedido no tiene productos válidos.' using errcode = '22023';
  end if;

  -- cliente: primero por teléfono (últimos 10 dígitos), después por nombre + dirección
  if length(v_tel) >= 8 then
    select c.id into v_cliente from public.clientes c
      where c.telefono <> '' and right(c.telefono, 10) = right(v_tel, 10)
      order by c.created_at limit 1;
  end if;
  if v_cliente is null then
    select c.id into v_cliente from public.clientes c
      where lower(c.nombre) = lower(v_nombre) and lower(c.direccion) = lower(v_dir)
      order by c.created_at limit 1;
  end if;
  if v_cliente is null then
    insert into public.clientes (nombre, telefono, direccion, origen)
    values (v_nombre, v_tel, v_dir, 'web') returning id into v_cliente;
  else
    update public.clientes c set
      telefono = case when c.telefono = '' then v_tel else c.telefono end,
      direccion = case when c.direccion = '' then v_dir else c.direccion end
    where c.id = v_cliente;
  end if;

  insert into public.pedidos (codigo, cliente_id, cliente_nombre, cliente_tel, direccion, items, total, precio_pendiente,
                              entrega, pago, notas, estado, origen, visitante)
  values (coalesce(nullif(v_codigo, ''), upper(substr(md5(random()::text), 1, 5))), v_cliente, v_nombre, v_tel, v_dir,
          v_items, v_total, v_pend,
          left(btrim(coalesce(p->>'entrega', '')), 120), left(btrim(coalesce(p->>'pago', '')), 40),
          left(btrim(coalesce(p->>'notas', '')), 500), 'nuevo', 'web', v_vis)
  returning codigo into v_prev;

  return jsonb_build_object('ok', true, 'codigo', v_prev);
end;
$$;

-- ---------- visitas desde la web ----------
create or replace function public.registrar_evento(
  p_evento text, p_visitante text, p_sesion text,
  p_ruta text default '/', p_fuente text default 'directo', p_dispositivo text default 'movil')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vis text := left(regexp_replace(coalesce(p_visitante, ''), '[^A-Za-z0-9_-]', '', 'g'), 40);
  v_ses text := left(regexp_replace(coalesce(p_sesion, ''), '[^A-Za-z0-9_-]', '', 'g'), 40);
begin
  if coalesce(p_evento, '') not in ('visita', 'carrito', 'pedido', 'whatsapp') or length(v_vis) < 8 or length(v_ses) < 8 then
    return;
  end if;
  -- la misma sesión no suma el mismo evento dos veces en 10 segundos (recargas, dobles toques)
  if exists (select 1 from public.eventos e where e.sesion = v_ses and e.evento = p_evento
             and e.created_at > now() - interval '10 seconds') then
    return;
  end if;
  -- freno anti-spam global
  if (select count(*) from (select 1 from public.eventos e where e.created_at > now() - interval '1 minute' limit 400) x) >= 400 then
    return;
  end if;
  insert into public.eventos (evento, visitante, sesion, ruta, fuente, dispositivo)
  values (p_evento, v_vis, v_ses,
          coalesce(nullif(left(regexp_replace(coalesce(p_ruta, '/'), '[^A-Za-z0-9/_.-]', '', 'g'), 120), ''), '/'),
          coalesce(nullif(left(lower(regexp_replace(coalesce(p_fuente, ''), '[^A-Za-z0-9._-]', '', 'g')), 40), ''), 'directo'),
          case when p_dispositivo in ('movil', 'tablet', 'compu') then p_dispositivo else 'movil' end);
  -- limpieza de vez en cuando: se guardan unos 13 meses
  if random() < 0.002 then
    delete from public.eventos e where e.created_at < now() - interval '400 days';
  end if;
end;
$$;

-- ---------- números de visitas para el panel (solo admin, por RLS) ----------
create or replace function public.estadisticas_visitas(p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz constant text := 'America/Argentina/Buenos_Aires';
  v_ini timestamptz := (p_desde::timestamp at time zone tz);
  v_fin timestamptz := ((p_hasta + 1)::timestamp at time zone tz);
  v_paso interval := case when p_desde = p_hasta then interval '1 hour' else interval '1 day' end;
  v_unidad text := case when p_desde = p_hasta then 'hour' else 'day' end;
  v_res jsonb;
begin
  if p_hasta < p_desde or p_hasta - p_desde > 400 then
    raise exception 'Rango de fechas inválido.' using errcode = '22023';
  end if;
  with ev as (
    select e.evento, e.visitante, e.sesion, e.fuente, e.dispositivo, (e.created_at at time zone tz) as local
    from public.eventos e
    where e.created_at >= v_ini and e.created_at < v_fin
  ),
  vis as (select distinct visitante from ev where evento = 'visita'),
  tot as (
    select
      count(distinct visitante) filter (where evento = 'visita') as personas,
      count(distinct sesion) filter (where evento = 'visita') as visitas,
      count(*) filter (where evento = 'visita') as vistas,
      count(distinct sesion) filter (where evento = 'carrito') as carrito,
      count(distinct sesion) filter (where evento = 'pedido') as pedidos,
      count(distinct sesion) filter (where evento = 'whatsapp') as whatsapp
    from ev
  ),
  vuelven as (
    select count(*) as n from vis
    where exists (select 1 from public.eventos e2 where e2.visitante = vis.visitante and e2.created_at < v_ini)
  ),
  pasos as (
    select g as t from generate_series(v_ini at time zone tz, (v_fin at time zone tz) - v_paso, v_paso) as g
  ),
  por_paso as (
    select date_trunc(v_unidad, local) as t,
      count(distinct visitante) filter (where evento = 'visita') as personas,
      count(distinct sesion) filter (where evento = 'visita') as visitas,
      count(distinct sesion) filter (where evento = 'carrito') as carrito,
      count(distinct sesion) filter (where evento = 'pedido') as pedidos
    from ev group by 1
  ),
  fuentes as (
    select fuente as k, count(distinct sesion) as n from ev where evento = 'visita' group by 1 order by 2 desc limit 8
  ),
  dispositivos as (
    select dispositivo as k, count(distinct sesion) as n from ev where evento = 'visita' group by 1 order by 2 desc
  ),
  horas as (
    select extract(hour from local)::int as h, count(distinct sesion) as n from ev where evento = 'visita' group by 1
  )
  select jsonb_build_object(
    'totales', (select to_jsonb(tot) || jsonb_build_object('vuelven', (select n from vuelven)) from tot),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
                't', to_char(p.t, case when v_unidad = 'hour' then 'YYYY-MM-DD"T"HH24' else 'YYYY-MM-DD' end),
                'personas', coalesce(x.personas, 0), 'visitas', coalesce(x.visitas, 0),
                'carrito', coalesce(x.carrito, 0), 'pedidos', coalesce(x.pedidos, 0)) order by p.t), '[]'::jsonb)
              from pasos p left join por_paso x on x.t = p.t),
    'fuentes', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from fuentes),
    'dispositivos', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from dispositivos),
    'horas', (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h), '[]'::jsonb) from horas)
  ) into v_res;
  return v_res;
end;
$$;

-- ---------- juntar dos clientes repetidos ----------
create or replace function public.unir_clientes(p_conservar uuid, p_borrar uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b public.clientes;
begin
  if not (select public.is_admin()) then
    raise exception 'Esta cuenta no tiene permiso.' using errcode = '42501';
  end if;
  if p_conservar is null or p_borrar is null or p_conservar = p_borrar then return; end if;
  select * into b from public.clientes c where c.id = p_borrar;
  if not found then return; end if;
  update public.pedidos set cliente_id = p_conservar where cliente_id = p_borrar;
  update public.clientes c set
    telefono = case when c.telefono = '' then b.telefono else c.telefono end,
    email = case when c.email = '' then b.email else c.email end,
    direccion = case when c.direccion = '' then b.direccion else c.direccion end,
    cumple = coalesce(c.cumple, b.cumple),
    etiquetas = (select coalesce(array_agg(distinct e.v), '{}') from unnest(c.etiquetas || b.etiquetas) as e(v)),
    notas = left(concat_ws(E'\n', nullif(c.notas, ''), nullif(b.notas, '')), 2000),
    created_at = least(c.created_at, b.created_at)
  where c.id = p_conservar;
  delete from public.clientes c where c.id = p_borrar;
end;
$$;

-- ---------- Seguridad (RLS + permisos) ----------
alter table public.clientes          enable row level security;
alter table public.pedidos           enable row level security;
alter table public.inventario        enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.eventos           enable row level security;

revoke all on public.clientes, public.pedidos, public.inventario, public.movimientos_stock, public.eventos from anon, authenticated;
grant select, insert, update, delete on public.clientes, public.pedidos, public.inventario, public.movimientos_stock to authenticated;
grant select, delete on public.eventos to authenticated;

drop policy if exists "clientes: solo admin" on public.clientes;
create policy "clientes: solo admin" on public.clientes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "pedidos: solo admin" on public.pedidos;
create policy "pedidos: solo admin" on public.pedidos for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "inventario: solo admin" on public.inventario;
create policy "inventario: solo admin" on public.inventario for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "movimientos: solo admin" on public.movimientos_stock;
create policy "movimientos: solo admin" on public.movimientos_stock for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "eventos: admin lee" on public.eventos;
create policy "eventos: admin lee" on public.eventos for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "eventos: admin borra" on public.eventos;
create policy "eventos: admin borra" on public.eventos for delete to authenticated
  using ((select public.is_admin()));

-- funciones: nadie por defecto, después solo lo necesario
revoke execute on function public.kg_items(jsonb) from public, anon, authenticated;
revoke execute on function public.mover_stock_pedido(jsonb, integer, uuid, text) from public, anon, authenticated;
revoke execute on function public.pedidos_antes() from public, anon, authenticated;
revoke execute on function public.pedidos_borrado() from public, anon, authenticated;
revoke execute on function public.movimientos_aplicar() from public, anon, authenticated;
revoke execute on function public.inventario_sync() from public, anon, authenticated;
revoke execute on function public.crear_pedido_web(jsonb) from public, anon, authenticated;
revoke execute on function public.registrar_evento(text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.estadisticas_visitas(date, date) from public, anon, authenticated;
revoke execute on function public.unir_clientes(uuid, uuid) from public, anon, authenticated;

-- los triggers corren con el usuario del panel: necesita poder llamar a estas dos
grant execute on function public.kg_items(jsonb) to authenticated;
grant execute on function public.mover_stock_pedido(jsonb, integer, uuid, text) to authenticated;
-- panel
grant execute on function public.estadisticas_visitas(date, date) to authenticated;
grant execute on function public.unir_clientes(uuid, uuid) to authenticated;
-- web pública
grant execute on function public.crear_pedido_web(jsonb) to anon, authenticated;
grant execute on function public.registrar_evento(text, text, text, text, text, text) to anon, authenticated;

-- =====================================================================
--  PASO FINAL (después de crear el usuario del dueño en
--  Authentication → Users → Add user): reemplazá el mail y corré
--  SOLO estas líneas.
-- =====================================================================
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'MAIL-DEL-DUEÑO@ejemplo.com'
-- on conflict do nothing;
