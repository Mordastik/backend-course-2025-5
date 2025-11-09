// main.js
import { Command } from 'commander';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import superagent from 'superagent'; // 👈 1. ДОДАЙ ЦЕЙ РЯДОК

const program = new Command();

program
  .requiredOption('-H, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії для кешу');

program.parse(process.argv);
const options = program.opts();

// ... (код для створення кешу залишається без змін)
try {
  await fs.access(options.cache);
  console.log(`📁 Директорія кешу знайдена: ${options.cache}`);
} catch (error) {
  if (error.code === 'ENOENT') {
    await fs.mkdir(options.cache, { recursive: true });
    console.log(`✅ Створено директорію кешу: ${options.cache}`);
  } else {
    console.error('Помилка доступу до директорії кешу:', error);
    process.exit(1);
  }
}

const server = http.createServer(async (req, res) => {
  try {
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
      
      // ▼▼▼ 2. ПОВНІСТЮ ЗАМІНИ БЛОК 'GET' НА ЦЕЙ ▼▼▼
      case 'GET':
        try {
          // 1. Намагаємося прочитати з кешу
          const data = await fs.readFile(filePath);
          
          // 2. Якщо вдалося (кеш є) - віддаємо
          console.log(`Cache hit for ${fileName}.`);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(data);

        } catch (error) {
          if (error.code === 'ENOENT') {
            // 3. Якщо файлу немає (ENOENT - Error NO ENTity) - це "cache miss"
            console.log(`Cache miss for ${fileName}. Fetching from http.cat...`);
            
            const catUrl = `https://http.cat/${httpCode}`;

            // 4. Робимо запит на http.cat
            try {
              const response = await superagent.get(catUrl);
              const imageData = response.body; // superagent автоматично дає нам 'body' як Buffer

              // 5. Відповідаємо користувачу картинкою
              res.writeHead(200, { 'Content-Type': 'image/jpeg' });
              res.end(imageData);

              // 6. Асинхронно зберігаємо в кеш (користувач не чекає)
              // Ми "забуваємо" про цей проміс, але ловимо помилку, 
              // щоб уникнути 'unhandled promise rejection'
              fs.writeFile(filePath, imageData).catch(saveError => {
                console.error(`Помилка збереження в кеш ${fileName}:`, saveError);
              });

            } catch (fetchError) {
              // 7. Якщо http.cat повернув помилку (напр, 404 для коду 999)
              console.error(`Failed to fetch from http.cat: ${fetchError.message}`);
              res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
              res.end('404 Not Found: Картинку не знайдено ні в кеші, ні на http.cat');
            }
          } else {
            // 8. Інші помилки (напр. права доступу)
            throw error; // Кидаємо в загальний обробник 500
          }
        }
        break;
      // ▲▲▲ КІНЕЦЬ БЛОКУ 'GET' ▲▲▲

      case 'PUT':
        // ... (код PUT залишається без змін)
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
          throw error; 
        }
        break;

      case 'DELETE':
        // ... (код DELETE залишається без змін)
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
    console.error('Неочікувана помилка сервера:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`500 Internal Server Error: ${error.message}`);
  }
});

server.listen(options.port, options.host, () => {
  console.log(`🚀 Сервер запущено на http://${options.host}:${options.port}/`);
});