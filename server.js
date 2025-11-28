const http = require('http');
const fs = require('fs');
const path = require('path');

const FRONTEND_PORT = 5173;
const BACKEND_URL = 'http://127.0.0.1:8000';

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Proxy /api requests to backend
  if (req.url.startsWith('/api')) {
    const backendUrl = BACKEND_URL + req.url;
    console.log(`📡 Proxying: ${req.method} ${req.url} -> ${backendUrl}`);

    const backendReq = (backendUrl.startsWith('https') ? require('https') : require('http')).request(
      backendUrl,
      {
        method: req.method,
        headers: req.headers
      },
      (backendRes) => {
        res.writeHead(backendRes.statusCode, backendRes.headers);
        backendRes.pipe(res);
      }
    );

    backendReq.on('error', (error) => {
      console.error('❌ Backend error:', error.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        detail: `Backend error: ${error.message}`
      }));
    });

    req.pipe(backendReq);
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, req.url === '/' ? 'login.html' : req.url);

  // Try to serve file
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>500 - Server Error</h1>');
    }
  }
});

server.listen(FRONTEND_PORT, '127.0.0.1', () => {
  console.log(`
╔═══════════════════════════════════╗
║   Frontend + API Proxy Server     ║
╚═══════════════════════════════════╝

🌐 Frontend: http://127.0.0.1:${FRONTEND_PORT}
📡 Backend Proxy: http://127.0.0.1:${FRONTEND_PORT}/api -> ${BACKEND_URL}/api
🔗 Backend: ${BACKEND_URL}

Press CTRL+C to stop
  `);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${FRONTEND_PORT} is already in use!`);
    console.error(`Kill process: netstat -ano | findstr :${FRONTEND_PORT}`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});
