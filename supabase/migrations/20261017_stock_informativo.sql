-- =====================================================================
--  2026-10-17 · El stock ya no bloquea la web
--  Casi todo se hace a pedido (salvo clásicos y galletitas): con el stock
--  en 0 la web mostraba «Sin stock» y la gente no podía pedir.
--
--  - inventario_sync: deja de tocar products.disponible. El stock en kilos
--    queda solo para el panel (saber qué hay en el freezer y avisar si
--    queda poco). products.disponible pasa a ser un interruptor manual:
--    «Se puede pedir». Se reemplaza el cuerpo de la función en vez de
--    borrar el trigger porque el MCP de Supabase no aplica `drop`.
--  - products.opciones_listas: gustos que ya están hechos (subconjunto de
--    opciones). La web los marca con «Hay hecho»; el resto es a pedido.
--  - Vuelve «Galletitas de chipá» (se había borrado sin querer el
--    2026-10-17), como producto de stock (a_pedido = false), en su lugar
--    de antes (orden 3, después de las bolitas).
--
--  Seguridad: no cambia ningún permiso. opciones_listas es una columna
--  más de products: lectura pública (como el resto de la carta) y
--  escritura solo is_admin(), por las políticas que ya existen. RLS sigue
--  activo. inventario_sync conserva sus permisos (create or replace).
-- =====================================================================

create or replace function public.inventario_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- el stock ya no prende ni apaga productos en la web (ver encabezado)
  return null;
end;
$$;

alter table public.products add column if not exists opciones_listas text[] not null default '{}';

-- jamón y queso: la descripción del relleno ya dice «siempre en stock»
update public.products set opciones_listas = array['Jamón y queso']::text[]
where id = 'relleno' and opciones_listas = '{}' and 'Jamón y queso' = any(opciones);

insert into public.products (id, categoria, nombre, descripcion, precio_medio, precio_kilo, unidades, img, fotos, tags, opciones, a_pedido, disponible, en_mix, orden) values
  ('galletitas', 'formas', 'Galletitas de chipá', 'Finas galletas, crocantes por fuera y esponjosas por dentro. Para el mate, la picada o una birra bien fría.', 15000, 25000, '≈ 24 unidades por ½ kg', 'img/galletitas-tapeo.webp', array['img/galletitas-plato.webp']::text[], array['Para picar']::text[], '{}'::text[], false, true, true, 3)
on conflict (id) do nothing;
