# Sabor del Chipá Casereño — contexto para agentes

Web de un emprendimiento de chipá artesanal congelado en CABA, Argentina. Leé este contexto antes de tocar nada.

## Stack (no cambiarlo)

- Sitio 100% estático: HTML + CSS + JavaScript vanilla. Sin frameworks, sin npm, sin paso de build.
- Hosting: Cloudflare Pages, conectado al repo de GitHub `naserfer/Sabordelchipa` (rama `main`; cada push publica).
- Datos, login y fotos: Supabase (proyecto `trrjuhlmjuxaucqapxeg`, región us-east-1).
- Animaciones: anime.js v4.5.0, bundle UMD local en `vendor/anime.umd.min.js` (global `anime`).
  Usá la API de v4: `animate(targets, params)`, `createTimeline()`, `onScroll()`, `stagger()`, `svg.createDrawable()`, `utils`.
  No uses la API de v3 (`anime({targets})`).
- Tipografías autoalojadas en `fonts/` (Playfair Display y Montserrat).

## Estructura

- `index.html`: web pública con estas secciones: hero "del freezer al horno" con video, marquee, historia, mate y chipá, variedades (filtros por categoría + aviso de precio por más de 3 kg), mix, videos, anatomía, envíos, cómo pedir, FAQ, CTA final, carrito y aviso.
  - Hero (`#horno`): una "ventana de horno" con `video/horno-chipas.mp4` (+ `.webm`), 16:9 de 1280×720, sin audio. Se repite en bucle mientras se ve (al terminar se queda 1,8 s en el chipá dorado, fundido corto y vuelve a empezar; fuera de pantalla se pausa). El reloj (0 a 20 min), la barra y los 4 pasos siguen al video (`anim.js`, sección 1, no depende de anime.js). No hay botón "Ver de nuevo". Con `prefers-reduced-motion` o ahorro de datos no arranca solo: muestra `video/horno-listo.webp` y un botón "Ver cómo se hornea" (lo pasa una vez). Ese botón también aparece si el navegador no deja reproducir solo. El poster inicial es `video/horno-crudo.webp`. Sin scroll largo ni animación 3D.
  - Botón principal del hero: "Hacé tu pedido" (`.btn-order`, `data-order-cta`): botón oscuro de dos líneas ("Hacé tu pedido" + "Elegí tus chipás y te lo llevamos"), ícono de carrito en un círculo dorado (el mismo de "Mi pedido" y del botón flotante; la bolsa parecía un tacho de basura) y flecha. Sin animaciones (el dueño no las quiere). Al tocarlo aparece un cartelito "Elegí tus chipás y tocá «Sumar al pedido»" (`anim.js`, sección 2a). No volver a textos genéricos como "Ver variedades".
  - El catálogo se agrupa como la carta: Clásicos, Formas especiales y Especiales (`CATS` en `app.js`). Un grupo con un solo producto muestra la tarjeta ancha.
  - Filtros por categoría (`#catFilters`): en la compu es una barra con numeritos; en el celular (≤600px) los botones ocupan todo el ancho, sin numeritos y con texto en dos líneas si hace falta. Nunca tienen que quedar cortados ni obligar a deslizar.
  - Cada tarjeta puede tener varias fotos (`img` + `fotos`): se deslizan con el dedo o con flechas.
  - Sección `#videos`: los reels son HTML estático. Cada `<figure data-reel data-product="id" data-opt="sabor">` arma su botón "Sumar ½ kg" con el precio actual del producto. Se reproducen solos sin sonido al verse (no con `prefers-reduced-motion` ni ahorro de datos).
  - El carrito suma los kilos; con más de 3 kg avisa y el mensaje de WhatsApp pide precio por cantidad.
- `css/styles.css`: tokens de diseño en `:root`.
  - Paleta: crema, tinta, dorado y crust.
  - Identidad argentina: celeste `#74ACDF`, sol `#F6B40E`, rojo de filete `#C0392B`.
- `js/config.js`: `supabaseUrl` + `supabaseKey` (publishable key, es pública).
- `js/data.js`: datos de RESPALDO (`window.SABOR_DEFAULTS`). Se usan si Supabase no responde.
- `js/sb.js`: mini cliente de Supabase sin librerías.
  - Funciones: `SB.select / insert / update / remove / rpc / signIn / signOut / setPassword / upload / publicUrl`.
  - La sesión se guarda en localStorage y se refresca sola.
- `js/app.js`: lee settings y products de Supabase, con caché en localStorage y respaldo en `data.js`. Maneja catálogo, mix, carrito, aviso y el envío del pedido por WhatsApp (wa.me).
- `js/anim.js`: todas las animaciones. Expone `window.SaborFX` (fly, fab, drawer, toast).
- `admin/`: panel en `/admin`, pensado para usar desde el celular.
  - Login con email y contraseña.
  - CRUD de productos con subida de fotos (se achican en el navegador a 1400px JPG).
  - Datos del negocio y cambio de contraseña.
- `supabase/setup.sql`: esquema completo y políticas. Es la fuente de verdad de la base.
- `img/`: fotos del producto en webp + jpg (las nuevas, recortadas a 4:3 de 900×675).
- `video/`: reels verticales 540×960 sin audio: `.mp4` (H.264, va primero), `.webm` (VP9, respaldo) y `.webp` (poster). Los videos de WhatsApp vienen a veces en HEVC: siempre recodificarlos a H.264.
- Si una foto de producto no carga, la tarjeta muestra "Foto próximamente" en vez del ícono roto.

## Base de datos (Supabase)

- `settings` (una sola fila, `id=1`):
  `whatsapp`, `instagram`, `zona`, `dias jsonb [{dia, detalle}]`, `opciones_entrega jsonb [texto]`, `precios_actualizados`, `aviso`.
- `products`:
  - `id text` (slug), `nombre`, `descripcion`, `unidades`.
  - `precio_medio int` y `precio_kilo int`; si es null, la web muestra "Consultar".
  - `img`: foto principal, ruta relativa `"img/x.webp"` o URL pública del bucket.
  - `fotos text[]`: fotos extra (mismo formato que `img`).
  - `categoria text`: `clasicos` | `formas` | `especiales` (si viene otra cosa, se muestra en Especiales).
  - `tags text[]`, `opciones text[]`.
  - `a_pedido`, `disponible`, `en_mix` (bool), `orden int`.
- `admins(user_id → auth.users)` y función `is_admin()` (SECURITY INVOKER).
- Seguridad (RLS):
  - Lectura pública de settings y products.
  - Insertar, editar y borrar: solo si `is_admin()`.
  - Bucket `fotos` público para leer; subir y borrar solo admin.

## CRM del panel (`/admin`)

- Pestañas: Inicio (resumen), Pedidos, Clientes, Productos (con stock), Visitas y Ajustes (negocio + cuenta).
  - Celular: barra de pestañas fija abajo. Compu (≥900px): menú a la izquierda. La pestaña va en la dirección (`/admin#pedidos`).
  - Pedidos, clientes y stock se abren como hojas apilables (`Panel.openSheet / closeSheet`).
- Archivos:
  - `admin/admin.js`: núcleo (login, pestañas, productos, negocio, cuenta). Expone `window.Panel` (helpers, eventos `ready` / `tab` / `products` / `refresh` / `logout`, hojas).
  - `admin/crm.js`: Inicio, Pedidos y Clientes (estados, cobro, unir duplicados, CSV para Excel con `;` y BOM, aviso de pedidos nuevos cada 60 s).
  - `admin/stock.js`: stock en kg por producto (entradas, mermas, correcciones, aviso de mínimo).
  - `admin/visitas.js`: estadísticas de visitas. `admin/charts.js`: gráficos SVG propios (sin librerías).
  - `js/track.js` (solo en la web pública): contador anónimo. `SaborTrack.evento('carrito' | 'pedido' | 'whatsapp')`.
- La web guarda cada pedido al tocar «Enviar pedido por WhatsApp» (`crear_pedido_web`, con `keepalive`, sin frenar el envío). Campo opcional «Tu WhatsApp» en el formulario.
- Base (migración `supabase/migrations/20261004_crm.sql`):
  - `clientes` (nombre, telefono solo dígitos, email, direccion, cumple, etiquetas, notas, origen).
  - `pedidos` (codigo = el N.º del mensaje de WhatsApp, cliente_id, items jsonb `[{product_id, nombre, size, opt, qty, unit, mix?}]`, kg, envio, total, estado `nuevo|confirmado|entregado|cancelado`, pagado, origen `web|manual`).
  - `inventario` (stock_kg, minimo_kg) y `movimientos_stock` (delta, motivo `produccion|venta|devolucion|ajuste|merma`).
  - `eventos`: visitas anónimas (id al azar del navegador, sin IP). Se borran solas a los ~13 meses.
  - Triggers: al pasar un pedido a «entregado» se descuenta el stock (el mix se reparte entre sus variedades); si vuelve atrás, se cancela o se borra, se devuelve. Stock ≤ 0 → `products.disponible = false`; con stock → `true`.
  - Seguridad: RLS en todo; solo `is_admin()` lee o escribe. anon solo puede llamar a `crear_pedido_web` y `registrar_evento` (SECURITY DEFINER, validan y recortan todo, con freno anti-spam).
- Ventas = pedidos confirmados + entregados. Los «nuevo» de la web pueden no concretarse.
- El MCP de Supabase no puede aplicar sentencias `drop` / `delete` / `revoke` (piden una aprobación que no llega y se vencen): esas partes las corre el dueño en el SQL Editor.

## Reglas

1. NUNCA uses la secret key ni la service_role en el frontend ni la commitees. Solo va la publishable key.
2. Cualquier cambio en la base:
   - hacelo como migración nueva en `supabase/migrations/AAAAMMDD_nombre.sql`,
   - actualizá `supabase/setup.sql`,
   - mantené RLS activado y explicá el impacto en seguridad.
3. Si agregás un campo editable:
   - sumalo a la tabla, a `js/data.js` (respaldo), a `app.js` (render) y al panel admin;
   - escapá siempre el texto con `esc()` antes de meterlo en innerHTML.
4. Textos en español rioplatense (voseo: "pedí", "armá", "tenés").
5. No pongas "Sin TACC", "libre de gluten" ni "apto celíacos": el producto no está certificado.
6. Mobile-first. Probá en 390px de ancho.
   - Respetá `prefers-reduced-motion`: `anim.js` ya muestra el estado final sin animar.
7. Gotcha de anime.js con SVG: si un elemento SVG tiene `transform` como atributo (translate/rotate), no lo animes directo, porque anime pisa el transform. Envolvelo en un `<g>` y animá el de adentro. Usá `transform-box: fill-box`.
8. No agregues dependencias externas ni CDNs. Todo se sirve local.
9. Cambios chicos y explicados. No reescribas archivos enteros si alcanza con editar.
10. No toques `.git` ni `js/config.js` salvo que te lo pidan.
11. Antes de cada cambio, decí qué archivos vas a tocar y por qué.

## Pendientes

- Los precios, unidades y sabores salen de la carta de octubre 2026 (migración `20261004_carta_octubre.sql`).
- Confirmar con el dueño: en el bohío de calabaza la carta dice "queso por salud"; en la web quedó "Port Salut".
- Cuando haya dominio final: poner la URL absoluta en `og:image` de `index.html`.
- Mantener activa la base (plan gratis): configurar un ping cada 2 días con cron-job.org a `/rest/v1/settings?select=id` con header `apikey`.
