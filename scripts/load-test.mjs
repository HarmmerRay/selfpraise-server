#!/usr/bin/env node
/**
 * 简易压测：health / auth send-code
 * 用法：
 *   node scripts/load-test.mjs --target health --connections 100 --duration 10
 *   node scripts/load-test.mjs --target auth --connections 50 --duration 10
 */
import http from 'node:http';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const target = getArg('target', 'health');
const connections = parseInt(getArg('connections', '50'), 10);
const durationSec = parseInt(getArg('duration', '10'), 10);
const baseUrl = getArg('url', 'http://127.0.0.1:3000');

const path =
  target === 'auth'
    ? '/api/auth/send-code'
    : '/health/ready';

const body =
  target === 'auth'
    ? JSON.stringify({ phone: '13800138000' })
    : null;

let completed = 0;
let errors = 0;
let latencies = [];

function requestOnce() {
  return new Promise((resolve) => {
    const start = performance.now();
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: target === 'auth' ? 'POST' : 'GET',
        headers:
          target === 'auth'
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            : {},
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          const ms = performance.now() - start;
          latencies.push(ms);
          if (res.statusCode >= 400) errors += 1;
          completed += 1;
          resolve();
        });
      },
    );
    req.on('error', () => {
      errors += 1;
      completed += 1;
      resolve();
    });
    if (body) req.write(body);
    req.end();
  });
}

const endAt = Date.now() + durationSec * 1000;
const workers = Array.from({ length: connections }, async function loop() {
  while (Date.now() < endAt) {
    await requestOnce();
  }
});

await Promise.all(workers);

latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
const rps = (completed / durationSec).toFixed(1);

console.log(JSON.stringify({
  target,
  path,
  connections,
  durationSec,
  total: completed,
  errors,
  rps: Number(rps),
  latencyMs: { p50: Math.round(p50), p99: Math.round(p99) },
}, null, 2));
