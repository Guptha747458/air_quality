import { createServer } from 'http';
import { parse as parseUrl } from 'url';
import { sanitizeLocation, sanitizeProfile, sanitizeQuestion } from './services/sanitize.js';
import { fetchAirQualityByCity } from './services/geocoding.js';
import { generatePlan, answerQuestion } from './services/planner.js';
import { GEMINI } from './services/config.js';
import fs from 'fs';
import path from 'path';

const CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self'; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "frame-ancestors 'none'; " +
  "object-src 'none'; " +
  "base-uri 'self';";

const MIME_TYPES = Object.freeze({
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
});

function setSecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function respondJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req, maxBytes = 102400) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function routeHandler(request, response) {
  const { pathname, query } = parseUrl(request.url, true);
  const method = request.method.toUpperCase();
  setSecurityHeaders(response);

  if (!['GET', 'POST', 'HEAD', 'OPTIONS'].includes(method)) {
    return respondJson(response, 405, { error: 'Method not allowed' });
  }

  if (pathname === '/health' || pathname === '/api/health') {
    return respondJson(response, 200, { status: 'ok' });
  }

  async function getRequestPayload() {
    if (method === 'POST') {
      if (request.body !== undefined && request.body !== null) {
        if (typeof request.body === 'string') {
          return request.body ? JSON.parse(request.body) : {};
        }
        return request.body;
      }
      const body = await readBody(request);
      return body ? JSON.parse(body) : {};
    }
    return query;
  }

  if ((pathname === '/api/plan' || pathname === '/plan') && ['GET', 'POST'].includes(method)) {
    (async () => {
      try {
        const payload = await getRequestPayload();
        let rawHousehold = payload.household || {};
        if (typeof rawHousehold === 'string') rawHousehold = JSON.parse(rawHousehold);
        const location = sanitizeLocation(payload.location || '');
        const profile = sanitizeProfile(rawHousehold);
        const airQuality = await fetchAirQualityByCity(location, { language: profile.language });
        const result = await generatePlan(location, profile, airQuality, GEMINI);
        return respondJson(response, 200, {
          ...result,
          fallback: result.source === 'fallback' || result.geminiDisabled,
          safetyThresholds: result.safetyThresholds,
        });
      } catch (error) {
        return respondJson(response, 400, { error: error.message });
      }
    })();
    return;
  }

  if ((pathname === '/api/qa' || pathname === '/qa') && ['GET', 'POST'].includes(method)) {
    (async () => {
      try {
        const payload = await getRequestPayload();
        let rawHousehold = payload.household || {};
        if (typeof rawHousehold === 'string') rawHousehold = JSON.parse(rawHousehold);
        const location = sanitizeLocation(payload.location || '');
        const profile = sanitizeProfile(rawHousehold);
        const question = sanitizeQuestion(payload.question || '');
        const airQuality = await fetchAirQualityByCity(location, { language: profile.language });
        const answer = answerQuestion(question, airQuality, profile);
        return respondJson(response, 200, answer);
      } catch (error) {
        return respondJson(response, 400, { error: error.message });
      }
    })();
    return;
  }

  const publicFile = pathname === '/'
    ? 'public/react-build/index.html'
    : pathname.startsWith('/assets/')
      ? `public/react-build${pathname}`
      : pathname.replace(/^\//, '');
  const resolved = path.resolve(process.cwd(), publicFile);
  const publicRoot = path.resolve(process.cwd(), 'public');
  if (pathname === '/' || (resolved.startsWith(publicRoot + path.sep) && fs.existsSync(resolved))) {
    try {
      if (!fs.statSync(resolved).isFile()) throw new Error('Not found');
      const content = fs.readFileSync(resolved);
      const ext = path.extname(resolved).toLowerCase();
      response.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      response.end(content);
      return;
    } catch (error) {
      return respondJson(response, 404, { error: 'Not found' });
    }
  }

  respondJson(response, 404, { error: 'Not found' });
}

const port = process.env.PORT || 8787;
const server = createServer(routeHandler);
const isTestEnv = process.env.NODE_ENV === 'test' ||
  process.env.npm_lifecycle_event === 'test' ||
  process.argv.some(arg => arg.includes('test'));

if (!isTestEnv && !process.env.VERCEL) {
  server.listen(port, () => console.log(`Server running on port ${port}`));
}

export { routeHandler, CSP, respondJson, server };
