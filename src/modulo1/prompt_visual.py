"""El prompt de imagen de una carta, derivado de la carta y nada mas.

Por que existe
--------------
La mesa pidio un boton para generar la referencia visual de una pieza sin
salir del tablero. Lo que hace falta para eso NO es acceso al generador —eso
lo da el conector— sino una traduccion: de la direccion visual que ya trae la
carta (`visual.mostrar`, `visual.no_mostrar`, `formato`, `mercado`, `red`, el
titular aprobado) al texto que entiende un modelo de imagen.

Esa traduccion vive AQUI y no en el navegador por la misma razon que
`params_de_carta`: si cada camino armara su prompt, dos personas pidiendo la
misma carta obtendrian referencias distintas y nadie sabria por que. El
navegador reenvia lo que este modulo arma; la prueba compara los dos.

Las tres reglas que gobiernan este archivo
------------------------------------------
1. **Nada inventado (regla 1).** Cada linea del prompt sale de un campo de la
   carta o de `config/tema.json`. No hay estilo de casa escrito a mano aqui:
   la tipografia y los tres tonos son los que el equipo de diseno controla en
   su archivo. Si un campo falta, el prompt sale sin esa linea y lo declara;
   no se rellena.

2. **Ninguna MEDICION entra a la imagen.** Un numero dentro de un arte no se
   puede trazar hasta su consulta: quien lo vea despues no tiene forma de
   saber de que corrida salio, y la imagen sobrevive a la corrida. La guardia
   es la misma `MEDICION` de `cartas.py` —«24 horas» si, porque es una promesa
   de producto que dice la landing; «$2.68» no, porque es una medicion (ADR-042)
   —. Si un campo la trae, este modulo se detiene: no la limpia en silencio,
   porque un prompt recortado a la mitad produce una imagen que nadie pidio.

3. **El logo NO se genera.** Un modelo de imagen inventaria un logotipo de
   QPayPro parecido y equivocado, y una marca falsa en una pieza de fintech es
   exactamente la clase de dato inventado que este proyecto no publica. El
   prompt lo prohibe explicitamente y el arte final lleva el logo real, que ya
   vive en `config/logo.svg`.

Uso:  python -m modulo1.prompt_visual --corrida <carpeta> [--carta <id>]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from base.convenciones import RAIZ
from base.errores import FallaRuidosa

from .cartas import MEDICION

# El modelo. Fijo y declarado, no elegido en cada llamada: dos corridas del
# mismo periodo tienen que pedir lo mismo. `gpt_image_2` se eligio porque su
# catalogo declara `text-rendering` y `typography` entre sus etiquetas, y la
# mesa pidio que el titular vaya DENTRO de la imagen.
MODELO = "gpt_image_2"

# 1k / medium: la resolucion basta para una referencia que se mira en una
# reunion, y la calidad media es la diferencia entre un titular legible y uno
# con las tildes deshechas. Verificado el costo antes de fijarlo.
RESOLUCION = "1k"
CALIDAD = "medium"

# La relacion de aspecto NO se adivina: sale del formato que la carta ya
# decidio con dato propio (reel contra feed, ADR-031). Un formato que no este
# en este mapa detiene la peticion en vez de caer en un cuadrado por defecto:
# un reel cuadrado no es un error de estilo, es otra pieza.
RELACION = {
    "Reel 9:16": "9:16",
    "Carrusel de 3 a 12 tarjetas": "1:1",
}

PAIS = {"GT": "Guatemala", "SV": "El Salvador",
        "GT y SV": "Guatemala y El Salvador"}


def _tema(raiz: Path) -> dict:
    """La tipografia y los tres tonos que controla el equipo de diseno.

    Se leen de `config/tema.json` y no se copian aqui: si Mercadeo cambia la
    paleta, la referencia generada cambia con ella sin tocar codigo. Es el
    mismo contrato que ya tiene el tablero.
    """
    try:
        t = json.loads((raiz / "config" / "tema.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise FallaRuidosa(
            f"No se pudo leer config/tema.json: {e}",
            remedio="El prompt de imagen usa la tipografia y la paleta de ese "
                    "archivo. Sin el, el estilo lo tendria que inventar este "
                    "modulo, que es justo lo que no hace.")
    g = t.get("paleta_graficos") or {}
    tonos = [g.get(k) for k in ("serie_1", "serie_2", "serie_3") if g.get(k)]
    return {
        "titulos": (t.get("tipografia") or {}).get("titulos") or "",
        "tonos": tonos,
    }


def relacion(carta: dict) -> str:
    """La relacion de aspecto de la carta, o falla diciendo cual no conoce."""
    etq = ((carta.get("formato") or {}).get("etiqueta") or "").strip()
    if etq in RELACION:
        return RELACION[etq]
    raise FallaRuidosa(
        f"El formato «{etq or 'sin formato'}» no tiene relacion de aspecto "
        f"declarada para la carta {carta.get('id')}",
        remedio="Agregar el formato a RELACION en modulo1/prompt_visual.py. NO "
                "se cae en 1:1 por defecto: un reel cuadrado es otra pieza, no "
                "un detalle de estilo.")


def _revisa(carta: dict, tramos: list[tuple[str, str]]) -> None:
    """Ninguna medicion viaja dentro de la imagen. Se detiene, no se limpia."""
    for donde, txt in tramos:
        hall = MEDICION.findall(txt or "")
        if hall:
            raise FallaRuidosa(
                f"La carta {carta.get('id')} lleva una medicion en «{donde}»: "
                f"{hall}",
                remedio="Un numero medido dentro de un arte no se puede trazar "
                        "hasta su consulta, y la imagen sobrevive a la corrida. "
                        "El numero va en la carta, que lo resuelve contra el "
                        "dato; en la imagen no entra (ADR-042).")


def peticion(carta: dict, raiz: Path | str | None = None, *,
             con_titular: bool = True) -> dict:
    """Los `params` EXACTOS de `generate_image` para esta carta.

    El navegador reenvia esto sin agregarle nada, igual que hace con el payload
    de Sprints. Devuelve tambien `_declara`: lo que la peticion NO pudo incluir,
    para que la tarjeta lo diga en vez de que el hueco se note en la imagen.
    """
    t = _tema(Path(raiz) if raiz else RAIZ)
    v = carta.get("visual") or {}
    cp = carta.get("copy") or {}
    declara: list[str] = []

    pais = PAIS.get(carta.get("mercado") or "", carta.get("mercado") or "")
    red = carta.get("red") or ""
    detalle = (carta.get("formato") or {}).get("detalle") or ""

    mostrar = [x for x in (v.get("mostrar") or []) if x]
    no_mostrar = [x for x in (v.get("no_mostrar") or []) if x]
    titular = (cp.get("titular") or "").strip()

    _revisa(carta, [("visual.mostrar", " ".join(mostrar)),
                    ("visual.no_mostrar", " ".join(no_mostrar)),
                    ("copy.titular", titular)])

    partes = [
        f"Referencia visual para un anuncio de {red} de una empresa de pagos "
        f"digitales en {pais}." if red and pais else
        "Referencia visual para un anuncio de una empresa de pagos digitales.",
        f"Formato: {detalle}." if detalle else "",
    ]

    # UNA imagen, UNA escena: la primera tarjeta del carrusel o el primer
    # cuadro del reel. Pedir las tres tarjetas de `mostrar` en una sola imagen
    # produce un collage, que no es ninguna de las tres piezas — se vio en la
    # primera version de este modulo. La pieza completa sigue descrita en la
    # carta; la referencia cubre su arranque, y lo dice.
    if mostrar:
        partes.append("Una sola escena: " + mostrar[0].rstrip(".") + ".")
        if len(mostrar) > 1:
            declara.append(
                f"la referencia cubre solo el arranque; la pieza sigue con "
                f"{len(mostrar) - 1} tramo(s) mas descritos en la carta")
    else:
        declara.append("la carta no trae direccion de que mostrar")

    if no_mostrar:
        # Solo el SUJETO de la prohibicion, no su justificacion. Cada entrada
        # de `no_mostrar` viene como «cosa: por que», y meter el porque entero
        # hace que el modelo lo ESCRIBA: «marcada REVISION LEGAL» terminaba
        # impresa dentro del arte. El porque se queda en la carta, donde una
        # persona lo lee; en el prompt va la cosa que no debe aparecer.
        sujetos = [x.split(":", 1)[0].strip().rstrip(".") for x in no_mostrar]
        partes.append("No incluir: " + "; ".join(x for x in sujetos if x) + ".")

    if con_titular and titular:
        partes.append(
            f'Texto exacto en espanol, con sus tildes y signos completos, sin '
            f'ninguna otra palabra escrita en la imagen: "{titular}".')
    elif con_titular:
        declara.append("la carta no trae titular, asi que la imagen sale sin texto")

    estilo = ["Estilo sobrio y corporativo, composicion limpia con aire "
              "alrededor del texto."]
    if t["titulos"]:
        estilo.append(f"Tipografia sans serif geometrica, del corte de "
                      f"{t['titulos']}.")
    else:
        declara.append("el tema no declara tipografia de titulos")
    if t["tonos"]:
        estilo.append("Paleta limitada a estos tonos y blanco: "
                      + ", ".join(t["tonos"]) + ".")
    else:
        declara.append("el tema no declara paleta de graficos")
    partes.append(" ".join(estilo))

    # Lo que NUNCA se genera. El logo real existe en el repositorio; uno
    # inventado seria una marca falsa en una pieza de fintech.
    partes.append("Sin ningun logotipo, marca de agua, nombre de empresa ni "
                  "isotipo: el logo real se agrega despues en diseno. Sin "
                  "personas reconocibles y sin simbolos de moneda de otros "
                  "paises.")

    return {
        "model": MODELO,
        "prompt": " ".join(x for x in partes if x),
        "aspect_ratio": relacion(carta),
        "resolution": RESOLUCION,
        "quality": CALIDAD,
        # Quien abre el tablero paga con SUS creditos, y se dice en la tarjeta.
        # `false` es explicito a proposito: omitirlo deja que el servidor
        # pregunte por la cuota gratuita, y una pagina no puede contestar esa
        # pregunta por una persona.
        "use_unlim": False,
        "_declara": declara,
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="El prompt de imagen de las cartas")
    ap.add_argument("--corrida", required=True, type=Path)
    ap.add_argument("--carta")
    ap.add_argument("--raiz", type=Path, default=None)
    a = ap.parse_args(argv)

    res = json.loads((a.corrida / "analisis" / "resultado.json")
                     .read_text(encoding="utf-8"))
    cartas = ((res.get("cartas") or {}).get("cartas") or [])
    if a.carta:
        cartas = [c for c in cartas if c["id"] == a.carta]
        if not cartas:
            raise FallaRuidosa(f"No hay carta con id {a.carta}")
    salida = []
    for c in cartas:
        p = peticion(c, a.raiz)
        salida.append({"id": c["id"], "titulo": c["titulo"], "peticion": p})
    print(json.dumps(salida, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
