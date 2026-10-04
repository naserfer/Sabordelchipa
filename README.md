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
