# Удаление русификатора The Political Process: убирает строку подключения из index.html.
param([string]$GameDir)

$ErrorActionPreference = 'Stop'
if (-not $GameDir) { $GameDir = Split-Path -Parent $PSScriptRoot }

Write-Host ''
Write-Host 'Русификатор The Political Process — удаление' -ForegroundColor Cyan
Write-Host ''

try { $GameDir = (Resolve-Path -LiteralPath $GameDir).Path } catch {
    Write-Host "Папка не найдена: $GameDir" -ForegroundColor Red
    exit 1
}

$index = Join-Path $GameDir 'index.html'
if (-not (Test-Path -LiteralPath $index)) {
    Write-Host "В папке нет index.html: $GameDir" -ForegroundColor Red
    exit 1
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$html = [System.IO.File]::ReadAllText($index, $utf8)
$clean = [regex]::Replace($html, '<!--tpp-russifier-->.*?<!--/tpp-russifier-->\r?\n?', '')

if ($clean -eq $html) {
    Write-Host 'Русификатор в index.html не найден — удалять нечего.' -ForegroundColor Yellow
    exit 0
}

try {
    [System.IO.File]::WriteAllText($index, $clean, $utf8)
} catch [System.UnauthorizedAccessException] {
    Write-Host 'Нет прав на запись в папку игры. Запустите от имени администратора.' -ForegroundColor Red
    exit 1
}

Write-Host 'Русификатор отключён, игра снова на английском.' -ForegroundColor Green
Write-Host 'Папку russifier можно удалить (в ней лежит накопленный перевод cache.json).'
exit 0
