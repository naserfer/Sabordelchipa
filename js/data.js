/* =========================================================
   DATOS DE RESPALDO
   La web toma los datos del panel /admin (Supabase).
   Esto solo se usa si la base todavía no está configurada
   o si no responde, para que la página nunca quede vacía.
   Mantenelo igual a la carta vigente (octubre 2026).
   ========================================================= */
window.SABOR_DEFAULTS = {
  settings: {
    whatsapp: '5491149896364',
    instagram: 'https://www.instagram.com/sabordelchipa/',
    zona: 'CABA',
    dias: [
      { dia: 'Lunes, miércoles y viernes', detalle: 'Entregas por la tarde' },
      { dia: 'Sábado y domingo', detalle: 'Entregas a convenir' }
    ],
    opciones_entrega: ['Lunes por la tarde', 'Miércoles por la tarde', 'Viernes por la tarde', 'Sábado (a convenir)', 'Domingo (a convenir)'],
    precios_actualizados: 'octubre 2026',
    aviso: ''
  },
  /* categoria: 'clasicos' | 'formas' | 'especiales'  ·  fotos: fotos extra (la principal es img) */
  products: [
    { id: 'clasico', categoria: 'clasicos', nombre: 'Chipá clásico',
      descripcion: 'Tres quesos (600 g por kilo de masa), fécula de mandioca Femag, leche deslactosada y manteca La Serenísima, huevos de granja, sal y un toque de pimienta. La base de todas nuestras variedades.',
      precio_medio: 12000, precio_kilo: 22000, unidades: '≈ 15 unidades por ½ kg', img: 'img/clasicos.webp', fotos: ['img/textura-chipa.webp'],
      tags: ['Siempre disponible'], opciones: ['Con sal', 'Sin sal agregada'], a_pedido: false, disponible: true, en_mix: true, orden: 1 },
    { id: 'galletitas', categoria: 'formas', nombre: 'Galletitas de chipá',
      descripcion: 'Finas galletas, crocantes por fuera y esponjosas por dentro. Para el mate, la picada o una birra bien fría.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '≈ 24 unidades por ½ kg', img: 'img/galletitas-tapeo.webp', fotos: ['img/galletitas-plato.webp'],
      tags: ['Para picar'], opciones: [], a_pedido: true, disponible: true, en_mix: true, orden: 2 },
    { id: 'bolitas', categoria: 'formas', nombre: 'Chipá bolita',
      descripcion: 'Pequeñas bolitas de 6 g, puro queso. El bocadito para mirar el partido o sumar a la picada.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '≈ 80 unidades por ½ kg', img: 'img/bolitas-mano.webp', fotos: ['img/picada-grisines-bolitas.webp'],
      tags: ['Bocaditos'], opciones: [], a_pedido: true, disponible: true, en_mix: true, orden: 3 },
    { id: 'grisines', categoria: 'formas', nombre: 'Grisines de chipá',
      descripcion: 'Palitos de 20 cm de largo, crocantes y con mucho queso. Ideales para la picada y las salsitas.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '≈ 16 unidades por ½ kg', img: 'img/grisines-plato.webp', fotos: ['img/grisines-bowl.webp', 'img/picada-grisines-bolitas.webp'],
      tags: ['Para picar'], opciones: [], a_pedido: true, disponible: true, en_mix: true, orden: 4 },
    { id: 'relleno', categoria: 'especiales', nombre: 'Chipá relleno',
      descripcion: 'Corazón de jamón Paladini y queso parmesano, siempre en stock. A pedido: roquefort, caprese, salame y queso, panceta, cebolla caramelizada con queso y más.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '≈ 10 unidades por ½ kg', img: 'img/rellenos.webp', fotos: [],
      tags: ['Relleno'], opciones: ['Jamón y queso', 'Roquefort', 'Caprese', 'Salame y queso', 'Panceta', 'Cebolla caramelizada y queso'], a_pedido: false, disponible: true, en_mix: true, orden: 5 },
    { id: 'pan', categoria: 'especiales', nombre: 'Pan de chipá',
      descripcion: 'Panes de 100 a 120 g, ideales para armar sánguches o tostados. La cantidad y el tamaño se pueden modificar.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '≈ 5 unidades por ½ kg', img: 'img/pan-de-chipa-sandwich.webp', fotos: ['img/pan-sandwich-lechuga.webp'],
      tags: ['Sánguche'], opciones: [], a_pedido: false, disponible: true, en_mix: true, orden: 6 },
    { id: 'pepas', categoria: 'especiales', nombre: 'Pepas de chipá',
      descripcion: 'Variedades gourmet con centro relleno: queso azul, parmesano y nuez; cheddar y Finlandia; o dulce de membrillo y queso.',
      precio_medio: 18000, precio_kilo: 30000, unidades: '≈ 12 unidades por ½ kg', img: 'img/pepas.webp', fotos: [],
      tags: ['Gourmet'], opciones: ['Queso azul, parmesano y nuez', 'Cheddar y Finlandia', 'Dulce de membrillo y queso'], a_pedido: true, disponible: true, en_mix: false, orden: 7 },
    { id: 'bohios', categoria: 'especiales', nombre: 'Bohíos de chipá',
      descripcion: 'Bollos rellenos de 100 a 120 g. Verdura: acelga o espinaca, queso crema light, ricota magra y parmesano. Calabaza: zapallo, Finlandia y Port Salut. Caprese: tomate, pategrás y albahaca.',
      precio_medio: 18000, precio_kilo: 30000, unidades: '≈ 5 unidades por ½ kg', img: 'img/bohio-verdura-corte.webp', fotos: ['img/bohio-calabaza.webp', 'img/bohios-verdura-plato.webp'],
      tags: ['Rellenos'], opciones: ['Verdura y queso', 'Calabaza y queso', 'Caprese'], a_pedido: true, disponible: true, en_mix: false, orden: 8 },
    { id: 'pizzetas', categoria: 'especiales', nombre: 'Pizzetas de chipá',
      descripcion: 'Fina masa de chipá de 100 g con salsa de tomate, lista para que le pongas lo que quieras arriba. El tamaño se puede modificar.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '≈ 5 unidades por ½ kg', img: 'img/pizzetas-bolsa.webp', fotos: [],
      tags: [], opciones: [], a_pedido: true, disponible: true, en_mix: false, orden: 9 },
    { id: 'vegano', categoria: 'especiales', nombre: 'Chipá vegano',
      descripcion: 'Hecho especialmente con quesos Felices las Vacas, manteca vegetal, leche de almendras y levadura sabor queso.',
      precio_medio: 18000, precio_kilo: 32000, unidades: '≈ 15 unidades por ½ kg', img: 'img/chipa-vegano.webp', fotos: [],
      tags: ['Vegano'], opciones: [], a_pedido: true, disponible: true, en_mix: false, orden: 10 }
  ]
};
