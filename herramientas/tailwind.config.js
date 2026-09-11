/** Config solo para compilar el CSS del generador de prompts.
 *  No toca el tailwind.config.js del tablero, que escanea otros archivos.
 *  Tailwind lee las clases como texto plano: si partís un literal de clases
 *  en varias lineas dentro del JS, cortalo SIEMPRE en un espacio o la clase
 *  no se genera y no da ningun error. */
module.exports = {
  content: ['./herramientas/generador-prompts-qpaypro.html'],
  theme: { extend: {} },
  plugins: []
};
