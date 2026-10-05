# Sabor del Chipá — web + panel de administración

- **La web** (`/`): animación "Del freezer al horno", catálogo, armá tu mix, pedido por WhatsApp, mate y chipá, envíos y preguntas frecuentes.
- **El panel** (`/admin`): el dueño entra con su mail y contraseña y cambia productos, fotos, precios, stock, orden, WhatsApp, Instagram, días de envío, zona y el cartel de avisos. No hace falta tocar código.
- **Base de datos, login y fotos**: Supabase, plan gratis.
- **Hosting**: Cloudflare Pages, plan gratis. Es una web estática: se publica arrastrando la carpeta.

Mientras la base no esté conectada, la web funciona igual con los datos de `js/data.js`.

Para ver la web en tu compu antes de publicarla: doble clic en **`abrir-local.bat`** (usa Python o Node, lo que tengas) y se abre en http://localhost:8000.

---

## 1. Crear la base de datos gratis (Supabase)

1. Creá una cuenta en https://supabase.com y tocá **New project**.
2. Elegí un nombre (por ejemplo `sabor-del-chipa`) y una contraseña para la base (guardala). En **Region** elegí **South America (São Paulo)**, que es la más cercana a Buenos Aires.
3. Cuando el proyecto esté listo, andá a **SQL Editor → New query**. Pegá **todo** el contenido de `supabase/setup.sql` y tocá **Run**. Esto crea:
   - las tablas,
   - la seguridad (cualquiera puede ver la web, pero solo el admin puede modificar),
   - el espacio para las fotos,
   - los productos actuales.

## 2. Crear el usuario del dueño

1. Andá a **Authentication → Users → Add user → Create new user**.
2. Poné el mail y la contraseña del dueño y marcá **Auto Confirm User**.
3. Volvé a **SQL Editor**. Corré esto, poniendo su mail:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'MAIL-DEL-DUEÑO@ejemplo.com'
   on conflict do nothing;
   ```

4. **Importante:** en **Authentication → Sign In / Providers**, desactivá **Allow new users to sign up**, para que nadie más pueda crearse una cuenta. Igual, aunque alguien se registrara, no podría modificar nada: solo pueden los usuarios de la tabla `admins`.

## 3. Conectar la web con la base

1. En Supabase tocá **Connect** (o andá a **Project Settings → API Keys**).
2. Copiá la **Project URL** (por ejemplo `https://abcdefgh.supabase.co`) y la **Publishable key** (empieza con `sb_publishable_`).
3. Abrí `js/config.js` y pegalas:

   ```js
   supabaseUrl: 'https://abcdefgh.supabase.co',
   supabaseKey: 'sb_publishable_xxxxxxxx',
   ```

   La publishable key es pública por diseño: lo que protege los datos son las reglas de la base. **Nunca** pongas acá la `secret` ni la `service_role`.

## 4. Publicar gratis en Cloudflare Pages

1. Creá una cuenta en https://dash.cloudflare.com.
2. Andá a **Workers & Pages → Create → Pages → Upload assets**.
3. Ponele de nombre `sabordelchipa`. La web va a quedar en `https://sabordelchipa.pages.dev` y el panel en `https://sabordelchipa.pages.dev/admin`.
4. Arrastrá **esta carpeta completa** y tocá **Deploy**.

Solo hay que volver a subir la carpeta si cambiás el diseño o el código. Los precios, fotos y demás datos se cambian desde el panel y se ven al instante.

Usamos Cloudflare Pages y no Vercel porque el plan gratis de Vercel (Hobby) no permite uso comercial.

## 5. Mantener la base activa

En el plan gratis, Supabase pausa el proyecto si pasa unos 7 días sin actividad. Las visitas a la web cuentan como actividad. Para asegurarte:

- Creá una tarea gratis en https://cron-job.org que cada 2 días abra esta dirección:
  `https://TU-PROYECTO.supabase.co/rest/v1/settings?select=id`
  En **Advanced → Headers** agregá un encabezado `apikey` con tu publishable key.
- Si alguna vez se pausa, entrá a Supabase y tocá **Restore project**. Mientras tanto la web sigue andando con la última información que tenía guardada cada visitante, o con la de `js/data.js`.

## 6. Cómo usa el panel el dueño (desde el celular)

- **Productos**:
  - tocá uno para editar nombre, categoría (Clásicos, Formas especiales o Especiales), descripción, precios, variedades, etiquetas y fotos;
  - **Más fotos**: podés sumar varias por producto; en la web se pasan deslizando. ★ pone una como principal y ✕ la saca;
  - el interruptor verde marca si hay stock;
  - ▲ ▼ cambian el orden en la web;
  - **＋ Nuevo** crea un producto;
  - si dejás un precio vacío, en la web aparece «Consultar».
- **Fotos**: se pueden sacar con la cámara del celular. Se achican solas antes de subirse.
- **Negocio**: WhatsApp, Instagram, zona, días de entrega, opciones del formulario, fecha de precios y el **cartel de aviso** (aparece arriba de la web; si lo dejás vacío, no se muestra).
- **Cuenta**: cambiar la contraseña y cerrar sesión.

### CRM (pedidos, clientes, stock y visitas)

- **Inicio**: lo que hay que hacer hoy (pedidos para confirmar, para entregar y para cobrar, cumpleaños de clientes), ventas de los últimos 30 días, lo más vendido, stock bajo y cuánta gente entró a la web.
- **Pedidos**: los de la web entran solos cuando el cliente toca «Enviar pedido por WhatsApp». Los que llegan por Instagram o teléfono se cargan con **＋ Nuevo**. Cada pedido pasa por *Nuevo → Confirmado → Entregado* (o *Cancelado*) y se marca si ya está cobrado. Desde el pedido hay un botón para escribirle al cliente por WhatsApp con el mensaje armado.
- **Clientes**: se crean solos con cada pedido. Muestra cuánto gastó cada uno, cuántos pedidos hizo, qué pide más y cuándo fue su último pedido. Filtros: nuevos, frecuentes, para reactivar (más de 45 días sin pedir) y cumpleaños del mes. Si un cliente quedó repetido, se une con otro desde su ficha.
- **Stock** (en Productos, botón «Stock»): se carga en kilos. Al marcar un pedido como *Entregado* se descuenta solo; si llega a 0, la web muestra «Sin stock», y cuando cargás más vuelve a aparecer.
- **Visitas**: cuántas personas entraron (hoy, 7, 30 o 90 días), cuántas sumaron algo al carrito y cuántas mandaron el pedido, de dónde vienen (Instagram, Google…), con qué dispositivo y a qué hora. Es anónimo y no cuenta tus visitas desde el navegador donde usás el panel.
- **⬇ CSV** en Pedidos y Clientes baja una planilla que se abre con Excel o Google Sheets.
- Tip: en el link de la bio de Instagram poné `?utm_source=instagram` al final de la dirección para que esas visitas salgan como «Instagram».

**Instalar el CRM en una base que ya existía:** Supabase → **SQL Editor → New query**, pegá todo `supabase/migrations/20261004_crm.sql` y tocá **Run** (si avisa «destructive operation», tocá **Run this query**: no borra datos). Se puede correr más de una vez.

## Otros detalles

- **Dominio propio**: `sabordelchipa.com.ar` cuesta AR$ 8.500 por año en NIC Argentina y se conecta en Cloudflare Pages → **Custom domains**.
- **Foto al compartir el link**: cuando tengas la dirección final, en `index.html` cambiá `img/clasicos.jpg` (en `og:image`) por la dirección completa. Así sale la foto cuando alguien comparte el link por WhatsApp.
- **Precios para confirmar**: en Instagram hay diferencias en las unidades de galletitas y grisines y en el kilo de bohíos ($28.000 o $32.000).
- **«Sin TACC»**: la web no lo dice a propósito, porque en Argentina esa leyenda necesita certificación.

## Créditos

- Animaciones: [anime.js](https://animejs.com) v4.5.0 (licencia MIT), incluido en `vendor/`.
- Tipografías: Playfair Display y Montserrat (licencia SIL Open Font), incluidas en `fonts/`.
- Fotos: de las publicaciones de @sabordelchipa.
- Ilustraciones (horno, sol, fileteado, mate, Obelisco): dibujadas a mano en SVG para este sitio.
