-- =====================================================================
--  2026-10-04 · Carta de octubre 2026
--  - products.categoria: agrupa el catálogo como en la carta
--    ('clasicos' | 'formas' | 'especiales').
--  - products.fotos: fotos extra de cada producto (la principal sigue en img).
--  - Precios, unidades y sabores nuevos + producto nuevo: Pizzetas de chipá.
--
--  Seguridad: solo se agregan columnas a public.products. RLS sigue activo
--  y las políticas existentes las cubren (lectura pública, escritura solo
--  is_admin()). No cambia ningún permiso.
--  No pisa el stock (disponible) de los productos que ya existen.
-- =====================================================================

alter table public.products add column if not exists categoria text not null default 'especiales';
alter table public.products add column if not exists fotos text[] not null default '{}';

insert into public.products (id, categoria, nombre, descripcion, precio_medio, precio_kilo, unidades, img, fotos, tags, opciones, a_pedido, disponible, en_mix, orden) values
  ('clasico', 'clasicos', 'Chipá clásico', 'Tres quesos (600 g por kilo de masa), fécula de mandioca Femag, leche deslactosada y manteca La Serenísima, huevos de granja, sal y un toque de pimienta. La base de todas nuestras variedades.', 12000, 22000, '≈ 15 unidades por ½ kg', 'img/clasicos.webp', array['img/textura-chipa.webp']::text[], array['Siempre disponible']::text[], array['Con sal', 'Sin sal agregada']::text[], false, true, true, 1),
  ('galletitas', 'formas', 'Galletitas de chipá', 'Finas galletas, crocantes por fuera y esponjosas por dentro. Para el mate, la picada o una birra bien fría.', 15000, 25000, '≈ 24 unidades por ½ kg', 'img/galletitas-tapeo.webp', array['img/galletitas-plato.webp']::text[], array['Para picar']::text[], '{}'::text[], true, true, true, 2),
  ('bolitas', 'formas', 'Chipá bolita', 'Pequeñas bolitas de 6 g, puro queso. El bocadito para mirar el partido o sumar a la picada.', 15000, 25000, '≈ 80 unidades por ½ kg', 'img/bolitas-mano.webp', array['img/picada-grisines-bolitas.webp']::text[], array['Bocaditos']::text[], '{}'::text[], true, true, true, 3),
  ('grisines', 'formas', 'Grisines de chipá', 'Palitos de 20 cm de largo, crocantes y con mucho queso. Ideales para la picada y las salsitas.', 15000, 25000, '≈ 16 unidades por ½ kg', 'img/grisines-plato.webp', array['img/grisines-bowl.webp', 'img/picada-grisines-bolitas.webp']::text[], array['Para picar']::text[], '{}'::text[], true, true, true, 4),
  ('relleno', 'especiales', 'Chipá relleno', 'Corazón de jamón Paladini y queso parmesano, siempre en stock. A pedido: roquefort, caprese, salame y queso, panceta, cebolla caramelizada con queso y más.', 15000, 25000, '≈ 10 unidades por ½ kg', 'img/rellenos.webp', '{}'::text[], array['Relleno']::text[], array['Jamón y queso', 'Roquefort', 'Caprese', 'Salame y queso', 'Panceta', 'Cebolla caramelizada y queso']::text[], false, true, true, 5),
  ('pan', 'especiales', 'Pan de chipá', 'Panes de 100 a 120 g, ideales para armar sánguches o tostados. La cantidad y el tamaño se pueden modificar.', 15000, 25000, '≈ 5 unidades por ½ kg', 'img/pan-de-chipa-sandwich.webp', array['img/pan-sandwich-lechuga.webp']::text[], array['Sánguche']::text[], '{}'::text[], false, true, true, 6),
  ('pepas', 'especiales', 'Pepas de chipá', 'Variedades gourmet con centro relleno: queso azul, parmesano y nuez; cheddar y Finlandia; o dulce de membrillo y queso.', 18000, 30000, '≈ 12 unidades por ½ kg', 'img/pepas.webp', '{}'::text[], array['Gourmet']::text[], array['Queso azul, parmesano y nuez', 'Cheddar y Finlandia', 'Dulce de membrillo y queso']::text[], true, true, false, 7),
  ('bohios', 'especiales', 'Bohíos de chipá', 'Bollos rellenos de 100 a 120 g. Verdura: acelga o espinaca, queso crema light, ricota magra y parmesano. Calabaza: zapallo, Finlandia y Port Salut. Caprese: tomate, pategrás y albahaca.', 18000, 30000, '≈ 5 unidades por ½ kg', 'img/bohio-verdura-corte.webp', array['img/bohio-calabaza.webp', 'img/bohios-verdura-plato.webp']::text[], array['Rellenos']::text[], array['Verdura y queso', 'Calabaza y queso', 'Caprese']::text[], true, true, false, 8),
  ('pizzetas', 'especiales', 'Pizzetas de chipá', 'Fina masa de chipá de 100 g, lista para que le pongas lo que quieras arriba. El tamaño se puede modificar.', 15000, 25000, '≈ 5 unidades por ½ kg', '', '{}'::text[], '{}'::text[], '{}'::text[], true, true, false, 9),
  ('vegano', 'especiales', 'Chipá vegano', 'Hecho especialmente con quesos Felices las Vacas, manteca vegetal, leche de almendras y levadura sabor queso.', 18000, 32000, '≈ 15 unidades por ½ kg', 'img/chipa-vegano.webp', '{}'::text[], array['Vegano']::text[], '{}'::text[], true, true, false, 10)
on conflict (id) do update set
  categoria = excluded.categoria,
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  precio_medio = excluded.precio_medio,
  precio_kilo = excluded.precio_kilo,
  unidades = excluded.unidades,
  img = excluded.img,
  fotos = excluded.fotos,
  tags = excluded.tags,
  opciones = excluded.opciones,
  a_pedido = excluded.a_pedido,
  en_mix = excluded.en_mix,
  orden = excluded.orden;

update public.settings set precios_actualizados = 'octubre 2026' where id = 1;
