/* Una prueba tiene que controlar su estado de partida.

   Las suites corren contra `salidas/tablero-mesa-creativa.html`, que es el
   MISMO archivo que se publica —y que, después de `fusiona_estado.js`, lleva
   dentro el `#estado` en vivo: las decisiones del equipo, la estrategia que
   alguien eligió, los items ya creados en Sprints.

   El 2026-09-09 eso puso rojas dos suites sin que hubiera un solo error de
   código: la página abría en `disputar-el-flanco` porque una persona la había
   elegido, y `prueba:boton` pulsaba ACEPTAR sobre una carta ya aceptada, que
   es un toggle y no llama a nada. Los dos casos eran comportamiento correcto.

   Lo grave es el caso simétrico: un estado en vivo puede poner una suite
   VERDE por la razón equivocada, y eso no avisa. Así que se blanquea, y se
   conserva solo `periodo`, que no es una decisión de nadie.
*/
const RE = /(<script id="estado" type="application\/json">)([\s\S]*?)(<\/script>)/;

function sinEstado(html) {
  const m = RE.exec(html);
  if (!m) throw new Error("Sin bloque #estado: el archivo no es un tablero");
  let periodo = "";
  try { periodo = (JSON.parse(m[2]) || {}).periodo || ""; } catch (e) { /* vacío */ }
  const limpio = JSON.stringify({
    aprobadas: {}, decisiones: {}, version: 1, periodo: periodo,
    propias: {}, estrategia: null, sprint: {},
  });
  /* Solo el PRIMERO. El segundo es el literal del propio tablero_app.js
     incrustado más abajo; tocarlo cambiaría el código, no el estado. */
  return html.replace(RE, (_, a, __, c) => a + limpio + c);
}

module.exports = { sinEstado };
