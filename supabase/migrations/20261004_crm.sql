-- =====================================================================
--  2026-10-04 · CRM del panel: clientes, pedidos, stock y visitas
--
--  Tablas nuevas:
--   - clientes: datos de cada cliente (se crean solos con los pedidos de
--     la web o a mano desde el panel).
--   - pedidos: cada pedido con sus productos, estado y pago.
--   - inventario: stock en kg de los productos que se controlan.
--   - movimientos_stock: historial de entradas y salidas de stock.
--   - eventos: visitas anónimas a la web (sin IP ni datos personales:
--     un id al azar que guarda el navegador).
--
--  Funciones:
--   - crear_pedido_web(p): la web guarda el pedido cuando el cliente toca
--     «Enviar pedido por WhatsApp». Recalcula los precios con la base.
--   - registrar_evento(...): la web cuenta visitas, carritos y pedidos.
--   - estadisticas_visitas(desde, hasta): números para el panel.
--   - unir_clientes(conservar, borrar): junta dos clientes repetidos.
--   - Triggers: al pasar un pedido a «entregado» se descuenta el stock;
--     si vuelve atrás, se cancela o se borra, el stock se devuelve.
--     Con stock en 0 el producto pasa a «Sin stock» en la web, y vuelve
--     a «Hay stock» cuando se carga más.
--
--  Seguridad:
--   - RLS activo en todas las tablas nuevas. Leer, crear, editar y borrar
--     clientes, pedidos, inventario, movimientos y eventos: solo is_admin().
--   - anon no tiene ningún permiso sobre esas tablas.
--   - Las dos únicas puertas públicas son crear_pedido_web y
--     registrar_evento (SECURITY DEFINER, search_path vacío). Solo pueden
--     INSERTAR con datos validados y recortados; no devuelven datos de
--     otros clientes. Tienen freno anti-spam (por visitante y global).
--     Supabase las marca como "función SECURITY DEFINER ejecutable por
--     anon": es a propósito.
--   - No cambia ningún permiso de products, settings ni admins.
-- =====================================================================

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

-- stock en 0 (o menos) → «Sin stock» en la web; con stock → «Hay stock»
create or replace function public.inventario_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.products p set disponible = (new.stock_kg > 0)
  where p.id = new.product_id and p.disponible is distinct from (new.stock_kg > 0);
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
