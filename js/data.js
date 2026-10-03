/* =========================================================
   DATOS DE RESPALDO
   La web toma los datos del panel /admin (Supabase).
   Esto solo se usa si la base todavía no está configurada
   o si no responde, para que la página nunca quede vacía.
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
    precios_actualizados: 'julio 2026',
    aviso: ''
  },
  products: [
    { id: 'clasico', nombre: 'Chipá clásico', descripcion: 'El de siempre: tres quesos de verdad (parmesano, reggianito y pategrás). También sin sal agregada.',
      precio_medio: 12000, precio_kilo: 20000, unidades: '≈ 15 unidades por ½ kg', img: 'img/clasicos.webp',
      tags: ['Tres quesos'], opciones: ['Con sal', 'Sin sal agregada'], a_pedido: false, disponible: true, en_mix: true, orden: 1 },
    { id: 'relleno', nombre: 'Chipá relleno', descripcion: 'Corazón de jamón Paladini y parmesano. A pedido: roquefort, caprese, salame y queso, panceta, cebolla caramelizada.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '≈ 10 unidades por ½ kg', img: 'img/rellenos.webp',
      tags: ['Relleno'], opciones: ['Jamón y queso', 'Roquefort', 'Caprese', 'Salame y queso', 'Panceta', 'Cebolla caramelizada y queso'], a_pedido: false, disponible: true, en_mix: true, orden: 2 },
    { id: 'galletitas', nombre: 'Galletitas de chipá', descripcion: 'Finitas y crocantes. Para el mate, la picada o una birra bien fría. Listas en 10 minutos.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '', img: 'img/galletitas-tapeo.webp',
      tags: ['Para picar'], opciones: [], a_pedido: false, disponible: true, en_mix: true, orden: 3 },
    { id: 'pan', nombre: 'Pan de chipá', descripcion: 'Piezas de 100 a 120 g para armar sánguches o tostados. Tamaño a pedido.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '≈ 5 unidades por ½ kg', img: 'img/pan-de-chipa-sandwich.webp',
      tags: ['Sánguche'], opciones: [], a_pedido: false, disponible: true, en_mix: true, orden: 4 },
    { id: 'grisines', nombre: 'Grisines de chipá', descripcion: '20 cm de sabor artesanal. Ideales para la picada y las salsitas.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '', img: 'img/grisines-plato.webp',
      tags: ['A pedido'], opciones: [], a_pedido: true, disponible: true, en_mix: true, orden: 5 },
    { id: 'bolitas', nombre: 'Chipá bolita', descripcion: 'Bocaditos de 5 g, puro queso. El snack para mirar el partido.',
      precio_medio: 15000, precio_kilo: 25000, unidades: '', img: 'img/bolitas-mano.webp',
      tags: ['A pedido'], opciones: [], a_pedido: true, disponible: true, en_mix: true, orden: 6 },
    { id: 'pepas', nombre: 'Pepas de chipá', descripcion: 'Con centro de queso. Armá tu mix o pedí tu sabor favorito.',
      precio_medio: 18000, precio_kilo: 28000, unidades: '', img: 'img/pepas.webp',
      tags: ['A pedido'], opciones: ['Queso azul, parmesano y nuez', 'Cheddar, parmesano y Finlandia', 'Salame y parmesano', 'Mix de sabores'], a_pedido: true, disponible: true, en_mix: false, orden: 7 },
    { id: 'bohios', nombre: 'Bohíos de verdura', descripcion: 'Acelga o espinaca según la estación, con queso crema, ricota y parmesano.',
      precio_medio: 18000, precio_kilo: 28000, unidades: '≈ 5 unidades por ½ kg', img: 'img/bohio-verdura-corte.webp',
      tags: ['Verdura'], opciones: [], a_pedido: false, disponible: true, en_mix: false, orden: 8 },
    { id: 'vegano', nombre: 'Chipá vegano', descripcion: '100% vegetal: quesos Felices las Vacas, leche de almendras y margarina. Producción por encargo.',
      precio_medio: 18000, precio_kilo: 28000, unidades: '', img: 'img/chipa-vegano.webp',
      tags: ['Vegano', 'A pedido'], opciones: [], a_pedido: true, disponible: true, en_mix: false, orden: 9 }
  ]
};
