/*
 * Сборка одного файла: index.html со встроенными стилями и скриптами.
 * Запуск: node tools/build.mjs → dist/political-process-uk.html
 * Такой файл можно переслать одним вложением и открыть где угодно офлайн.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let out = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return '<style>\n' + css + '\n</style>';
});

out = out.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(root, src), 'utf8');
  return '<script>\n/* ' + src + ' */\n' + js + '\n</script>';
});

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'political-process-uk.html');
fs.writeFileSync(outFile, out);

const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
console.log('Собрано: dist/political-process-uk.html (' + kb + ' КБ)');
if (/<script src=|<link rel="stylesheet"/.test(out)) {
  console.error('Внимание: остались внешние ссылки — файл не самодостаточен.');
  process.exit(1);
}
