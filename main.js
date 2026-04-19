const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { program } = require('commander');
const superagent = require('superagent');

program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <cache>', 'Шлях до директорії кешу');

program.parse();
const options = program.opts();

async function initCache() {
  try {
    await fs.access(options.cache);
  } catch {
    await fs.mkdir(options.cache, { recursive: true });
    console.log(`Директорію створено: ${options.cache}`);
  }
}

const server = http.createServer(async (req, res) => {
  const statusCode = req.url.slice(1);

  if (!/^\d+$/.test(statusCode)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request');
  }

  const filePath = path.join(options.cache, `${statusCode}.jpg`);

  try {
    switch (req.method) {

      case 'GET': {
        try {
          const image = await fs.readFile(filePath);

          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': image.length,
          });
          return res.end(image);

        } catch {
          try {
            const url = `https://http.cat/${statusCode}`;

            const response = await superagent
              .get(url)
              .redirects(0)
              .buffer(true);

            if (!response.ok || !response.body) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              return res.end('Not Found');
            }

            await fs.writeFile(filePath, response.body);

            res.writeHead(200, {
              'Content-Type': response.type || 'image/jpeg',
              'Content-Length': response.body.length,
            });

            return res.end(response.body);

          } catch {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not Found');
          }
        }
      }

      case 'PUT': {
        const chunks = [];

        req.on('data', chunk => chunks.push(chunk));

        req.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);

            await fs.writeFile(filePath, buffer);

            res.writeHead(201, {
              'Content-Type': 'text/plain',
              'Content-Length': Buffer.byteLength('Created'),
            });

            res.end('Created');

          } catch {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
          }
        });

        break;
      }

      case 'DELETE': {
        try {
          await fs.unlink(filePath);

          res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Content-Length': Buffer.byteLength('Deleted'),
          });

          res.end('Deleted');

        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }

        break;
      }

      default:
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
    }

  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Critical Server Error');
  }
});

initCache().then(() => {
  server.listen(options.port, options.host, () => {
    console.log(`Сервер працює на http://${options.host}:${options.port}`);
  });
});