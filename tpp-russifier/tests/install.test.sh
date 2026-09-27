#!/usr/bin/env bash
# Проверка install.ps1 / uninstall.ps1. Нужен PowerShell (pwsh) в PATH или в $PWSH.
set -u
PWSH="${PWSH:-pwsh}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
GAME="$TMP/The Political Process"
pass=0; fail=0
ok()   { echo "  ok   $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL $1"; fail=$((fail+1)); }
chk()  { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

setup() {
  rm -rf "$GAME"; mkdir -p "$GAME"
  cp -r "$ROOT/russifier" "$GAME/russifier"
  cp "$ROOT/install-russifier.bat" "$ROOT/uninstall-russifier.bat" "$GAME/"
}
run() { "$PWSH" -NoProfile -ExecutionPolicy Bypass -File "$GAME/russifier/$1" -GameDir "$GAME/." >"$TMP/out.txt" 2>&1; echo $?; }
TAG='<!--tpp-russifier--><script src="russifier/russifier.js"></script><!--/tpp-russifier-->'

echo 'Установка (путь с пробелами)'
setup
sed 's/$/\r/' "$ROOT/tests/fixture-game/index.html" > "$GAME/index.html"   # CRLF, как в Windows
cp "$GAME/index.html" "$TMP/orig.html"
code=$(run install.ps1)
chk 'код выхода 0' '[ "$code" = 0 ]'
chk 'строка подключения ровно одна' '[ "$(grep -c -F "$TAG" "$GAME/index.html")" = 1 ]'
chk 'вставлена сразу после <head>' 'grep -A1 "^<head>" "$GAME/index.html" | tail -1 | grep -q -F "$TAG"'
chk 'переводы строк CRLF сохранены' '[ "$(grep -c $'"'"'\r$'"'"' "$GAME/index.html")" = "$(wc -l < "$GAME/index.html")" ]'
chk 'резервная копия = исходный файл' 'cmp -s "$TMP/orig.html" "$GAME/index.html.bak-russifier"'
chk 'сообщение об успехе' 'grep -q "Готово" "$TMP/out.txt"'
code=$(run install.ps1)
chk 'повторная установка: строка всё ещё одна' '[ "$code" = 0 ] && [ "$(grep -c -F "$TAG" "$GAME/index.html")" = 1 ]'
chk 'повторная установка: копия не испорчена' 'cmp -s "$TMP/orig.html" "$GAME/index.html.bak-russifier"'

echo; echo 'Удаление'
code=$(run uninstall.ps1)
chk 'код выхода 0' '[ "$code" = 0 ]'
chk 'index.html побайтно как до установки' 'cmp -s "$TMP/orig.html" "$GAME/index.html"'
code=$(run uninstall.ps1)
chk 'повторное удаление — «удалять нечего», код 0' '[ "$code" = 0 ] && grep -q "не найден" "$TMP/out.txt"'

echo; echo 'Нестандартные случаи'
setup
printf '<html><body><div id="x">New Game</div>\n<script>\nvar a=1;\n</script></body></html>\n' > "$GAME/index.html"
code=$(run install.ps1)
chk 'без <head>: вставка перед первым <script>' '[ "$code" = 0 ] && grep -q -F "${TAG}" "$GAME/index.html" && [ "$(grep -n -F "$TAG" "$GAME/index.html" | cut -d: -f1)" -lt "$(grep -n "var a=1" "$GAME/index.html" | cut -d: -f1)" ]'
setup
code=$(run install.ps1)
chk 'нет index.html → код 1 и понятное сообщение' '[ "$code" = 1 ] && grep -q "нет index.html" "$TMP/out.txt"'
setup
cp "$ROOT/tests/fixture-game/index.html" "$GAME/index.html"; rm "$GAME/russifier/russifier.js"
code=$(run install.ps1)
chk 'нет russifier.js → код 1' '[ "$code" = 1 ] && [ "$(grep -c -F "$TAG" "$GAME/index.html")" = 0 ]'

echo; echo 'Кодировка скриптов'
chk 'install.ps1 в UTF-8 с BOM (для PowerShell 5.1)' '[ "$(head -c3 "$ROOT/russifier/install.ps1" | od -An -tx1 | tr -d " \n")" = efbbbf ]'
chk 'uninstall.ps1 в UTF-8 с BOM' '[ "$(head -c3 "$ROOT/russifier/uninstall.ps1" | od -An -tx1 | tr -d " \n")" = efbbbf ]'
chk '.bat только ASCII' '! grep -P "[^\x00-\x7F]" "$ROOT/install-russifier.bat" "$ROOT/uninstall-russifier.bat" >/dev/null'

rm -rf "$TMP"
echo; echo "install: $pass passed, $fail failed"
[ "$fail" = 0 ]
