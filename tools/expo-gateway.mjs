// Keep native bundles and the demo customer API on one HTTPS connection.
import { createServer, request } from 'node:http';
import { createConnection } from 'node:net';

export async function startGateway() {
  const sockets = new Set();
  const server = createServer((req, res) => {
    const isApi = /^\/api\/mobile(?:\/|\?|$)/.test(req.url || '');
    const upstream = request({
      hostname: '127.0.0.1',
      port: isApi ? 5000 : 3000,
      method: req.method,
      path: req.url,
      headers: req.headers,
    }, (reply) => {
      if (isApi && !String(reply.headers['content-type']).includes('application/json')) {
        reply.resume();
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'The demo customer API did not return JSON.' }));
        return;
      }
      res.writeHead(reply.statusCode || 502, {
        ...reply.headers,
        ...(isApi ? { 'cache-control': 'no-store' } : {}),
      });
      reply.pipe(res);
      reply.on('error', () => res.destroy());
    });
    upstream.on('error', () => {
      if (res.headersSent) return res.destroy();
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        error: isApi ? 'Jahiz is not reachable. Start its API Server workflow.' : 'Expo is starting. Try again shortly.',
      }));
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('upgrade', (req, socket, head) => {
    const upstream = createConnection({ host: '127.0.0.1', port: 3000 });
    upstream.on('connect', () => {
      const headers = [];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        headers.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      }
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers.join('\r\n')}\r\n\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.on('close', () => socket.destroy());
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close() {
      for (const socket of sockets) socket.destroy();
      server.close();
    },
  };
}
