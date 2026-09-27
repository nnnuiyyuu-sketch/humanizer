#!/usr/bin/env bash
# Собирает архив для игроков: dist/TPP-Russifier-<версия>.zip
set -euo pipefail
cd "$(dirname "$0")"
python3 - <<'PY'
import os, re, zipfile
version = re.search(r"var VERSION = '([^']+)'", open('russifier/russifier.js', encoding='utf-8').read()).group(1)
os.makedirs('dist', exist_ok=True)
out = f'dist/TPP-Russifier-{version}.zip'

def crlf(data):
    return data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')

files = [
    ('install-russifier.bat', 'install-russifier.bat', True),
    ('uninstall-russifier.bat', 'uninstall-russifier.bat', True),
    ('russifier/russifier.js', 'russifier/russifier.js', False),
    ('russifier/ru.json', 'russifier/ru.json', False),
    ('russifier/fixes.json', 'russifier/fixes.json', False),
    ('russifier/settings.json', 'russifier/settings.json', False),
    ('russifier/install.ps1', 'russifier/install.ps1', True),
    ('russifier/uninstall.ps1', 'russifier/uninstall.ps1', True),
]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for src, dst, win in files:
        data = open(src, 'rb').read()
        z.writestr(dst, crlf(data) if win else data)
    readme = open('README.md', 'rb').read()
    z.writestr('README-RU.txt', b'\xef\xbb\xbf' + crlf(readme))
print(out, os.path.getsize(out), 'bytes')
PY
