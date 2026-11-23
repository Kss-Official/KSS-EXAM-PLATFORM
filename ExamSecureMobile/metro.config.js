const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Ensure Metro watches only this mobile project directory
config.watchFolders = [projectRoot];

// Resolve node_modules strictly from ExamSecureMobile
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Block parent directories using simple literal path regex (no negative lookahead)
const parentDir = path.resolve(projectRoot, '..');
function makeDirBlockRegex(dirName) {
  const fullPath = path.resolve(parentDir, dirName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + fullPath + '([\\\\/].*)?$');
}

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  makeDirBlockRegex('node_modules'),
  makeDirBlockRegex('Frontend'),
  makeDirBlockRegex('backend'),
  makeDirBlockRegex('.git'),
  makeDirBlockRegex('docs'),
  makeDirBlockRegex('nginx'),
  makeDirBlockRegex('scripts'),
];

// Fix: on Windows, jest-worker thread spawning (EINVAL) crashes Metro when maxWorkers > 1.
// Force single-worker mode so Metro uses require('./Worker') directly (no threads).
config.maxWorkers = 1;

// Forward /api requests through Metro (port 8081) to FastAPI (port 8000)
// This bypasses Windows Firewall blocks on port 8000 for mobile devices on the same Wi-Fi
const http = require('http');
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith('/api')) {
        const proxyReq = http.request(
          {
            hostname: '127.0.0.1',
            port: 8000,
            path: req.url,
            method: req.method,
            headers: {
              ...req.headers,
              host: '127.0.0.1:8000',
            },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        );
        proxyReq.on('error', (err) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Backend unreachable', error: err.message }));
        });
        req.pipe(proxyReq, { end: true });
        return;
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
