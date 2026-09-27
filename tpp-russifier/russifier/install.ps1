# Установщик русификатора The Political Process.
# Добавляет в index.html игры одну строку, которая подключает russifier/russifier.js.
# Совместим с Windows PowerShell 5.1 и PowerShell 7.
param([string]$GameDir)

$ErrorActionPreference = 'Stop'
if (-not $GameDir) { $GameDir = Split-Path -Parent $PSScriptRoot }

Write-Host ''
Write-Host 'Русификатор The Political Process — установка' -ForegroundColor Cyan
Write-Host ''

try { $GameDir = (Resolve-Path -LiteralPath $GameDir).Path } catch {
    Write-Host "Папка не найдена: $GameDir" -ForegroundColor Red
    exit 1
}

$index = Join-Path $GameDir 'index.html'
$core = Join-Path $GameDir 'russifier\russifier.js'

if (-not (Test-Path -LiteralPath $index)) {
    Write-Host "В папке нет index.html: $GameDir" -ForegroundColor Red
    Write-Host 'Скопируйте папку russifier и install-russifier.bat в папку игры —'
    Write-Host 'туда, где лежат index.html и package.json.'
    Write-Host 'Steam: ПКМ по игре -> Управление -> Просмотреть локальные файлы.'
    exit 1
}
if (-not (Test-Path -LiteralPath $core)) {
    Write-Host "Не найден файл $core" -ForegroundColor Red
    Write-Host 'Папка russifier должна лежать рядом с index.html.'
    exit 1
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$html = [System.IO.File]::ReadAllText($index, $utf8)

$tag = '<!--tpp-russifier--><script src="russifier/russifier.js"></script><!--/tpp-russifier-->'
$old = '<!--tpp-russifier-->.*?<!--/tpp-russifier-->\r?\n?'
$clean = [regex]::Replace($html, $old, '')

# Резервная копия исходного index.html (без русификатора).
$backup = "$index.bak-russifier"
[System.IO.File]::WriteAllText($backup, $clean, $utf8)

$nl = "`n"
if ($clean.Contains("`r`n")) { $nl = "`r`n" }

$head = [regex]::Match($clean, '(?i)<head(\s[^>]*)?>')
if ($head.Success) {
    $pos = $head.Index + $head.Length
    $patched = $clean.Substring(0, $pos) + $nl + $tag + $clean.Substring($pos)
} else {
    $script = [regex]::Match($clean, '(?i)<script')
    if ($script.Success) {
        $patched = $clean.Substring(0, $script.Index) + $tag + $nl + $clean.Substring($script.Index)
    } else {
        $patched = $tag + $nl + $clean
    }
}

try {
    [System.IO.File]::WriteAllText($index, $patched, $utf8)
} catch [System.UnauthorizedAccessException] {
    Write-Host 'Нет прав на запись в папку игры.' -ForegroundColor Red
    Write-Host 'Запустите install-russifier.bat от имени администратора (ПКМ -> Запуск от имени администратора).'
    exit 1
}

$check = [System.IO.File]::ReadAllText($index, $utf8)
$count = [regex]::Matches($check, [regex]::Escape($tag)).Count
if ($count -ne 1) {
    Write-Host 'Не удалось проверить установку: строка русификатора не найдена в index.html.' -ForegroundColor Red
    exit 1
}

Write-Host 'Готово! Русификатор установлен.' -ForegroundColor Green
Write-Host ''
Write-Host "Игра: $GameDir"
Write-Host "Резервная копия index.html: $backup"
Write-Host ''
Write-Host 'В игре:'
Write-Host '  F9        — включить/выключить перевод'
Write-Host '  Shift+F9  — перечитать словарь ru.json без перезапуска'
Write-Host '  F10       — статистика русификатора'
Write-Host ''
Write-Host 'Новые строки переводятся онлайн при первом появлении и сохраняются'
Write-Host 'в russifier\cache.json — дальше интернет для них не нужен.'
Write-Host 'После обновления игры в Steam запустите install-russifier.bat ещё раз.'
exit 0
