#!/usr/bin/env bash
#
# Verifica lo que de `.rules/` es comprobable por máquina.
#
# El resto de esa carpeta es criterio y no hay forma de chequearlo, pero una
# parte son afirmaciones sobre el repo —cuántas migraciones hay, a qué archivo
# apunta un [[link]]— y esas sí se pueden atar. Es el mismo argumento que
# justifica los tests de paridad: lo que está escrito dos veces se desincroniza
# sin que nada avise. Ya pasó dos veces: el índice llegó a decir 12 migraciones
# con 13 en disco, y una sección de decisiones-de-diseno.md estuvo un mes
# describiendo el modelo anterior a la migración 007 mientras los otros tres
# archivos decían lo correcto.
#
# Esto no habría atrapado lo segundo —una contradicción de criterio no se
# detecta con grep— pero sí lo primero, que es el tipo de error que se cuela
# justamente por ser aburrido.
#
# Se corre solo:  .github/scripts/consistencia-rules.sh

set -uo pipefail
cd "$(dirname "$0")/../.."

fallas=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

quejarse() {
  # En CI sale como anotación en el diff; local, como texto normal.
  if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::error::$1"; else echo "  ✗ $1"; fi
  fallas=$((fallas + 1))
}

# Los `while` van siempre leyendo de un archivo y nunca de un pipe: un `while`
# al final de una tubería corre en un subshell y ahí `fallas` se incrementa en
# una copia que se descarta al terminar. El chequeo pasaría siempre.

echo "== Enlaces [[...]] =="
grep -roh '\[\[[^]]*\]\]' .rules --include='*.md' | tr -d '[]' | sort -u > "$tmp/enlaces"
: > "$tmp/rotos"
while read -r destino; do
  [ -z "$destino" ] && continue
  find .rules -name "$destino.md" | grep -q . || echo "$destino" >> "$tmp/rotos"
done < "$tmp/enlaces"
if [ -s "$tmp/rotos" ]; then
  while read -r destino; do
    quejarse "El enlace [[$destino]] no apunta a ningún archivo de .rules/."
  done < "$tmp/rotos"
else
  echo "  ✓ los $(wc -l < "$tmp/enlaces" | tr -d ' ') destinos enlazados existen"
fi

echo "== Los cinco archivos que enumera el índice =="
for f in tech-stack reglas-de-negocio decisiones-de-diseno esquema-base-datos pendientes; do
  find .rules -name "$f.md" | grep -q . || quejarse "El índice enumera $f y el archivo no está."
done
echo "  ✓ están los cinco"

echo "== Migraciones =="
en_disco=$(find backend/db/migrations -name '*.sql' | wc -l | tr -d ' ')
documentadas=$(grep -cE '^\| `[0-9]{3}_' .rules/memories/esquema-base-datos.md || true)
echo "  en disco: $en_disco   con fila propia en esquema-base-datos.md: $documentadas"
if [ "$en_disco" != "$documentadas" ]; then
  quejarse "Hay $en_disco migraciones y $documentadas documentadas. Cada una necesita su fila: el .md es donde vive el porqué."
fi

# Que ningún .md afirme un número de migraciones que no sea el real. Es
# exactamente el error que tenía el índice.
grep -rn "[0-9]\+ migraciones" .rules --include='*.md' | grep -v "$en_disco migraciones" > "$tmp/conteos" || true
if [ -s "$tmp/conteos" ]; then
  while read -r linea; do
    quejarse "Dice un número de migraciones distinto de $en_disco → $linea"
  done < "$tmp/conteos"
else
  echo "  ✓ ningún .md afirma otro número"
fi

echo "== Rutas de código que los .md nombran =="
# Solo las escritas entre backticks con ruta completa: si un archivo se renombra,
# la referencia queda mintiendo y leyendo no hay forma de notarlo.
grep -rohE '`(backend|frontend)/[a-zA-Z0-9_./-]+\.(js|jsx|sql|css|json)`' .rules --include='*.md' \
  | tr -d '`' | sort -u > "$tmp/rutas"
: > "$tmp/faltantes"
while read -r ruta; do
  [ -e "$ruta" ] || echo "$ruta" >> "$tmp/faltantes"
done < "$tmp/rutas"
if [ -s "$tmp/faltantes" ]; then
  while read -r ruta; do
    quejarse "Los .md mencionan \`$ruta\` y no existe."
  done < "$tmp/faltantes"
else
  echo "  ✓ las $(wc -l < "$tmp/rutas" | tr -d ' ') rutas mencionadas existen"
fi

echo
if [ "$fallas" -gt 0 ]; then
  echo "$fallas inconsistencia(s) entre .rules/ y el repo."
  exit 1
fi
echo "✓ .rules/ y el repo dicen lo mismo."
