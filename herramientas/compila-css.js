/* Compila el CSS de Tailwind del generador y lo incrusta en el HTML.
 *
 * Por que existe: la pagina carga el CDN de Tailwind para poder editar clases
 * en vivo, pero si ese CDN no carga —sin internet, o bloqueado por la red de
 * la oficina— la pagina quedaria sin ningun estilo. Con el CSS ya adentro,
 * el diseno se sostiene solo y el CDN pasa a ser lo que agrega las clases
 * NUEVAS que alguien escriba despues.
 *
 * Correr:  node herramientas/compila-css.js
 * Hace falta solo si se agregan clases de Tailwind al HTML y se quiere que
 * funcionen tambien sin internet.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const html = path.join(__dirname, 'generador-prompts-qpaypro.html');
const salida = path.join(require('os').tmpdir(), 'qp-tailwind.css');

const INICIO = '<!-- CSS-COMPILADO:INICIO -->';
const FIN = '<!-- CSS-COMPILADO:FIN -->';

execFileSync(path.join(raiz, 'node_modules/.bin/tailwindcss'), [
  '-c', path.join(__dirname, 'tailwind.config.js'),
  '-i', path.join(__dirname, 'tailwind-fuente.css'),
  '-o', salida, '--minify'
], { cwd: raiz, stdio: 'inherit' });

const css = fs.readFileSync(salida, 'utf8').trim();
let texto = fs.readFileSync(html, 'utf8');

const a = texto.indexOf(INICIO);
const b = texto.indexOf(FIN);
if (a < 0 || b < 0) throw new Error('No estan las marcas CSS-COMPILADO en el HTML.');

texto = texto.slice(0, a + INICIO.length) +
  '\n<style>' + css + '</style>\n' +
  texto.slice(b);

fs.writeFileSync(html, texto);
console.log('CSS incrustado: ' + (css.length / 1024).toFixed(1) + ' KB');
