#!/usr/bin/env python3
"""Sonda de la API de Pinterest. NO analiza nada: solo mide qué se puede.

Existe porque en este proyecto ya van tres veces que se declaró imposible algo
que solo estaba apagado. Antes de construir sobre Pinterest hay que saber, con
respuestas de la API y no de memoria, tres cosas distintas que se confunden
entre sí:

  · el dominio está bloqueado por la política de egreso del entorno
  · el token es inválido o venció
  · el token es válido pero le falta el permiso para ESE endpoint

Los tres se ven igual si uno mira nada más «no funcionó». Aquí se separan.

El token se lee de la variable de entorno PINTEREST_TOKEN y NUNCA se escribe:
no al disco, no al log, no al repo. Si apareciera dentro de un mensaje de error
de la API, se tapa antes de imprimir.

Uso:
    export PINTEREST_TOKEN='pina_...'
    python3 src/modulo1/pinterest_sonda.py
    python3 src/modulo1/pinterest_sonda.py --json salidas/pinterest_sonda.json
"""

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

BASE = "https://api.pinterest.com/v5"
TIEMPO = 20

# Cada entrada: (clave, método, ruta, para qué sirve, qué significa si falla).
# El orden importa: los primeros descubren ids que usan los siguientes.
SONDAS = [
    ("cuenta", "/user_account",
     "Quién es el token",
     "Sin esto no se sabe ni si el token vive. Todo lo demás es ruido."),
    ("tableros", "/boards?page_size=25",
     "Los tableros PROPIOS de la cuenta",
     "Es la fuente de una curaduría honesta: lo que Mercadeo ya guardó."),
    ("pines_propios", "/pins?page_size=25",
     "Los pines PROPIOS",
     "Sirve para enriquecer un link que el equipo pega, si es de la cuenta."),
    ("busca_propio", "/search/pins?query=punto+de+venta",
     "Búsqueda DENTRO de lo propio",
     "Acota la curaduría a lo ya guardado. No es el catálogo de Pinterest."),
    ("busca_catalogo", "/search/partner/pins?query=punto+de+venta&country_code=GT",
     "Búsqueda del catálogo PÚBLICO",
     "Esta es la que decide todo. Si no responde, «traeme los mejores pines "
     "de Pinterest» no existe y hay que curar contra nuestra propia evidencia."),
]


def _tapa(txt, token):
    """El token no sale impreso ni dentro de un mensaje de error."""
    if not token:
        return txt
    return txt.replace(token, "pina_<TAPADO>")


def _pide(ruta, token):
    """Devuelve (clase, http, cuerpo). `clase` separa los tres fracasos."""
    req = urllib.request.Request(
        BASE + ruta,
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIEMPO,
                                    context=ssl.create_default_context()) as r:
            return "ok", r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            cuerpo = json.loads(e.read().decode("utf-8"))
        except Exception:
            cuerpo = None
        if e.code == 401:
            return "token", e.code, cuerpo
        if e.code in (403, 429):
            return "permiso", e.code, cuerpo
        return "http", e.code, cuerpo
    except urllib.error.URLError as e:
        # El 403 del CONNECT del proxy llega aquí, no como HTTPError: el túnel
        # nunca se abrió, así que no hay respuesta HTTP que leer.
        return "red", None, {"error": str(e.reason)}
    except Exception as e:  # noqa: BLE001
        return "red", None, {"error": str(e)}


LETRERO = {
    "ok": "OK",
    "red": "BLOQUEADO POR RED",
    "token": "TOKEN RECHAZADO",
    "permiso": "SIN PERMISO",
    "http": "ERROR HTTP",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="dónde guardar el resultado crudo")
    args = ap.parse_args()

    token = os.environ.get("PINTEREST_TOKEN", "").strip()
    if not token:
        print("Falta PINTEREST_TOKEN en el entorno.\n\n"
              "  export PINTEREST_TOKEN='pina_...'\n\n"
              "No se pasa por argumento a propósito: los argumentos quedan en "
              "el historial del shell y en la lista de procesos.", file=sys.stderr)
        return 2

    print("Sonda de Pinterest API v5 · " + BASE)
    print("El token no se imprime.\n")

    res, ids = {}, {}
    for clave, ruta, para, sentido in SONDAS:
        clase, http, cuerpo = _pide(ruta, token)
        res[clave] = {"ruta": ruta, "clase": clase, "http": http,
                      "para": para, "sentido": sentido, "cuerpo": cuerpo}

        print("[" + LETRERO[clase] + "] " + clave +
              ("  HTTP " + str(http) if http else ""))
        print("   " + para)

        if clase == "ok" and isinstance(cuerpo, dict):
            items = cuerpo.get("items")
            if isinstance(items, list):
                print("   devolvió " + str(len(items)) + " elemento(s)" +
                      ("  · hay más páginas" if cuerpo.get("bookmark") else ""))
                for it in items[:5]:
                    nom = it.get("name") or it.get("title") or it.get("id")
                    print("     · " + _tapa(str(nom)[:70], token))
                if items and clave == "tableros":
                    ids["tablero"] = items[0].get("id")
            else:
                # /user_account no devuelve items sino el objeto de la cuenta.
                campos = ", ".join(sorted(cuerpo.keys())[:8])
                print("   campos: " + _tapa(campos, token))
        elif cuerpo:
            msg = cuerpo.get("message") or cuerpo.get("error") or str(cuerpo)
            print("   respuesta: " + _tapa(str(msg)[:180], token))

        if clase != "ok":
            print("   por qué importa: " + sentido)
        print()

    # Los pines de un tablero solo se pueden pedir si hubo un tablero.
    if ids.get("tablero"):
        ruta = "/boards/" + str(ids["tablero"]) + "/pins?page_size=25"
        clase, http, cuerpo = _pide(ruta, token)
        res["pines_de_tablero"] = {"ruta": ruta, "clase": clase, "http": http,
                                   "cuerpo": cuerpo}
        n = len((cuerpo or {}).get("items", []) or []) if clase == "ok" else 0
        print("[" + LETRERO[clase] + "] pines del primer tablero" +
              ("  " + str(n) + " pin(es)" if clase == "ok" else ""))
        print()
    else:
        res["pines_de_tablero"] = {"clase": "no_alcanzado",
                                   "por_que": "no hubo ningún tablero que abrir"}
        print("[NO ALCANZADO] pines de un tablero · no hubo tablero que abrir\n")

    # ---- El veredicto. Es lo único que hay que leer. ----
    clases = {k: v["clase"] for k, v in res.items()}
    # «no_alcanzado» no es un resultado: es una sonda que no se corrió porque la
    # anterior no dio el id que necesitaba. Contarla como resultado hacía que
    # «todo bloqueado» se reportara como «mezcla», que es justo el renglon que
    # hay que leer. Lo encontro la prueba contra el dominio cerrado.
    medidas = [c for c in clases.values() if c != "no_alcanzado"]
    print("=" * 66)
    if medidas and all(c == "red" for c in medidas):
        print("VEREDICTO · el dominio sigue bloqueado por la política del "
              "entorno.\nNo se midió nada del token. Si ya lo habilitaste, "
              "puede que la política\nse aplique al CREAR el entorno: haría "
              "falta una sesión nueva.")
    elif clases.get("cuenta") == "token":
        print("VEREDICTO · la red abre pero el token no sirve (401).\n"
              "Hay que generar uno nuevo. Este quedó expuesto en el chat.")
    elif clases.get("cuenta") == "ok":
        cat = clases.get("busca_catalogo")
        print("VEREDICTO · el token vive.")
        if cat == "ok":
            print("Y la búsqueda del catálogo público RESPONDE. Eso cambia el "
                  "alcance:\nse pueden proponer pines que la cuenta no tiene "
                  "guardados.")
        else:
            print("La búsqueda del catálogo público NO responde (" +
                  LETRERO.get(cat, str(cat)) + ").\n"
                  "Entonces «traeme los mejores pines de Pinterest» no está "
                  "disponible, y la\ncuraduría va contra los tableros propios "
                  "puntuados con NUESTRA evidencia.")
        print("\nOJO · ni con catálogo hay analíticas de pines ajenos: la API "
              "no da\nsaves ni impresiones de un pin que no es tuyo. «El mejor "
              "pin» no tiene\ndenominador propio de Pinterest. Regla 1.")
    else:
        print("VEREDICTO · mezcla. Revisar arriba renglón por renglón.")
    print("=" * 66)

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=2)
        print("\nCrudo en " + args.json + " (sin el token)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
