-- 2026-10-04 · Pizzetas de chipá: foto (img/pizzetas-bolsa.webp viene en el repo) y descripción con salsa.
-- Aplicar DESPUÉS de publicar la web, así el archivo de la foto ya existe cuando la base lo pide.
-- Seguridad: solo datos; no cambia tablas ni permisos.
update public.products
set img = 'img/pizzetas-bolsa.webp',
    descripcion = 'Fina masa de chipá de 100 g con salsa de tomate, lista para que le pongas lo que quieras arriba. El tamaño se puede modificar.'
where id = 'pizzetas' and img = '';
