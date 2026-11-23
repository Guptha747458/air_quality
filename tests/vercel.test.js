import test from 'node:test';
import assert from 'node:assert/strict';
import healthHandler from '../api/health.js';
import planHandler from '../api/plan.js';
import qaHandler from '../api/qa.js';
import rootHandler from '../api/index.js';

test('Vercel API handlers export default functions', () => {
  assert.equal(typeof healthHandler, 'function');
  assert.equal(typeof planHandler, 'function');
  assert.equal(typeof qaHandler, 'function');
  assert.equal(typeof rootHandler, 'function');
});

test('Vercel health handler responds with 200 and ok status', async () => {
  let statusCode = null;
  let headers = {};
  let body = '';

  const mockReq = {
    method: 'GET',
    url: '/health',
  };

  const mockRes = {
    setHeader(key, val) {
      headers[key] = val;
    },
    writeHead(code, head = {}) {
      statusCode = code;
      Object.assign(headers, head);
    },
    end(content) {
      body = content;
    },
  };

  await healthHandler(mockReq, mockRes);
  assert.equal(statusCode, 200);
  const parsed = JSON.parse(body);
  assert.equal(parsed.status, 'ok');
});

test('Vercel root handler routes /health properly', async () => {
  let statusCode = null;
  let headers = {};
  let body = '';

  const mockReq = {
    method: 'GET',
    url: '/health',
  };

  const mockRes = {
    setHeader(key, val) {
      headers[key] = val;
    },
    writeHead(code, head = {}) {
      statusCode = code;
      Object.assign(headers, head);
    },
    end(content) {
      body = content;
    },
  };

  await rootHandler(mockReq, mockRes);
  assert.equal(statusCode, 200);
  const parsed = JSON.parse(body);
  assert.equal(parsed.status, 'ok');
});
