// main.js
import { Command } from 'commander';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';

const program = new Command();

program
  .requiredOption('-H, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії для кешу');

program.parse(process.argv);
const options = program.opts();

// Перевірка та створення кешу (залишаємо як було)
try {
  await fs.access(options.cache);
  console.log(`Директорія кешу знайдена: ${options.cache}`);
} catch (error) {
  if (error.code === 'ENOENT') {
    await fs.mkdir(options.cache, { recursive: true });
    console.log(`Створено директорію кешу: ${options.cache}`);
  } else {
    console.error('Помилка доступу до директорії кешу:', error);
    process.exit(1);
  }
}

// ▼▼▼ ПОЧАТОК НОВОЇ ЛОГІКИ ▼▼▼
const server = http.createServer(async (req, res) => {
  try {
    // Парсимо URL, щоб отримати HTTP-код (наприклад, /200 -> '200')
    const match = req.url.match(/^\/(\d+)$/);

    if (!match) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: Некоректний URL. Використовуйте формат /<код>');
      return;
    }

    const httpCode = match[1];
    const fileName = `${httpCode}.jpeg`;

    const filePath = path.join(options.cache, fileName);

    switch (req.method) {
	      // --- (GET) ---
	      case 'GET':
	        try {
	          const data = await fs.readFile(filePath);
	          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
	          res.end(data);
	        } catch (error) {
	          if (error.code === 'ENOENT') {
	            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
	            res.end('404 Not Found: Картинку не знайдено в кеші');
	          } else {
	            throw error; // В загальний обробник 500
	          }
	        }
	        break;

      // --- (PUT) ---
      case 'PUT':
        try {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const data = Buffer.concat(chunks);

          await fs.writeFile(filePath, data);

          res.writeHead(201, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('201 Created: Картинку успішно збережено/оновлено');
        } catch (error) {
          throw error; // Кидаємо в загальний обробник 500
        }
        break;
// --- (DELETE) ---
      case 'DELETE':
        try {
          await fs.unlink(filePath);

          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('200 OK: Картинку успішно видалено з кешу');
        } catch (error) {
          if (error.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found: Картинку не знайдено в кеші');
          } else {
            throw error;
          }
        }
        break;
      default:
         res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
         res.end('405 Method Not Allowed');
         break;
    }
  } catch (error) {
    // Загальний обробник помилок
    console.error('Неочікувана помилка сервера:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`500 Internal Server Error: ${error.message}`);
  }
});

server.listen(options.port, options.host, () => {
  console.log(`Сервер запущено на http://${options.host}:${options.port}/`);
});