/* Trae el #estado GUARDADO EN VIVO al fragmento recien generado.

   Existe porque el equipo decide dentro de la pagina: el artefacto se
   republica a si mismo y la version publicada va adelante de la del disco.
   Publicar el fragmento nuevo tal cual BORRARIA esas decisiones. Ya paso una
   vez (v48) y por eso esto es un script y no un recuerdo.

   El primer <script id="estado"> es el bloque real; el segundo es el literal
   del propio tablero_app.js incrustado mas abajo. Solo se toca el primero.

   Uso: node fusiona_estado.js <en-vivo.html> <fragmento-nuevo.html>
*/
const fs = require("fs");

const RE = /(<script id="estado" type="application\/json">)([\s\S]*?)(<\/script>)/;

function estado(txt, quien) {
  const m = RE.exec(txt);
  if (!m) throw new Error("Sin bloque #estado en " + quien);
  return { json: m[2], re: m };
}

const [vivo, nuevo] = process.argv.slice(2);
if (!vivo || !nuevo) {
  console.error("Uso: node fusiona_estado.js <en-vivo.html> <fragmento-nuevo.html>");
  process.exit(1);
}

const enVivo = estado(fs.readFileSync(vivo, "utf8"), vivo);
const txtNuevo = fs.readFileSync(nuevo, "utf8");
const local = estado(txtNuevo, nuevo);

// Se valida antes de escribir: un JSON roto dejaria la pagina sin estado y sin
// error visible, que es justo el modo de falla que este proyecto no acepta.
const E = JSON.parse(enVivo.json);
const L = JSON.parse(local.json);

fs.writeFileSync(nuevo, txtNuevo.replace(RE, function (_, a, __, c) {
  return a + enVivo.json + c;
}));

const cuenta = function (o) { return Object.keys(o || {}).length; };
console.log("Estado fusionado en " + nuevo);
console.log("  version:      " + L.version + " (disco) -> " + E.version + " (en vivo)");
console.log("  decisiones:   " + cuenta(E.decisiones));
console.log("  aprobadas:    " + cuenta(E.aprobadas));
console.log("  ideas propias: " + cuenta(E.propias));
console.log("  estrategia:   " + (E.estrategia === null ? "sin elegir" : E.estrategia));
if (E.periodo !== L.periodo) {
  console.log("  ATENCION: el periodo cambio (" + E.periodo + " -> " + L.periodo +
              "). Las decisiones traidas son del periodo anterior.");
}
