const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { program } = require('commander');
const superagent = require('superagent');

program
  .requiredOption('-H, --host <host>', 'Server host')
  .requiredOption('-p, --port <port>', 'Server port')
  .requiredOption('-c, --cache <cache>', 'Cache directory')

program.parse();

const { host, port, cache } = program.opts();

async function initCache() {
  try {
    await fs.access(cache);
  } catch {
    await fs.mkdir(cache, { recursive: true });
  }
}

const getFilePath = (code) => path.join(cache, `${code}.jpg`);

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = req.url.split('?')[0];
    const code = pathname.slice(1);

    if (!code || !/^\d+$/.test(code)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Bad Request');
    }

    const filePath = getFilePath(code);

    if (req.method === 'GET') {
      try {
        const file = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        return res.end(file);
      } catch {
        try {
          const response = await superagent
            .get(`https://http.cat/${code}`)
            .responseType('arraybuffer');

          const buffer = Buffer.from(response.body);

          await fs.writeFile(filePath, buffer);

          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          return res.end(buffer);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Not Found');
        }
      }
    }

    if (req.method === 'PUT') {
      try {
        const buffer = await readRequestBody(req);
        await fs.writeFile(filePath, buffer);
        res.writeHead(201, { 'Content-Type': 'text/plain' });
        return res.end('Created');
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Server Error');
      }
    }

    if (req.method === 'DELETE') {
      try {
        await fs.unlink(filePath);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('Deleted');
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
      }
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server Error');
  }
});

initCache().then(() => {
  server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
  });
});