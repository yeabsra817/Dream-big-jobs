import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getApiApp } from './serverApp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function getCliArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  const eqArg = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eqArg) {
    return eqArg.slice(flag.length + 1);
  }
  return undefined;
}

const cliPort = getCliArg('--port');
const defaultPort = process.env.DEFAULT_APP_PORT || '3000';
const envPort =
  process.env.PORT &&
  process.env.PORT !== process.env.NGINX_PORT &&
  process.env.PORT !== process.env.CONTROL_PLANE_PORT
    ? process.env.PORT
    : undefined;
const port = Number(cliPort || (process.env.NODE_ENV === 'production' ? envPort || defaultPort : defaultPort));
const host = getCliArg('--host') || process.env.HOST || '0.0.0.0';

let isShuttingDown = false;

process.on('unhandledRejection', (reason) => {
  console.warn('[HOPELAND SERVER] Handled background promise rejection:', reason instanceof Error ? reason.message : reason);
});

process.on('uncaughtException', (err: any) => {
  if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
    console.error('[HOPELAND SERVER] Fatal bind error:', err);
    process.exit(1);
  }
  console.warn('[HOPELAND SERVER] Recovered from uncaught exception:', err?.message || err);
});

async function setupServer() {
  const app = await getApiApp();

  if (process.env.NODE_ENV !== 'production') {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    if (disableHmr) {
      const noHmrViteClient = [
        'const sheetsMap = new Map();',
        'export function updateStyle(id, content) {',
        '  let style = sheetsMap.get(id);',
        '  if (!style) {',
        '    style = document.createElement("style");',
        '    style.setAttribute("type", "text/css");',
        '    style.setAttribute("data-vite-dev-id", id);',
        '    style.textContent = content;',
        '    document.head.appendChild(style);',
        '  } else if (style.textContent !== content) {',
        '    style.textContent = content;',
        '  }',
        '  sheetsMap.set(id, style);',
        '}',
        'export function removeStyle(id) {',
        '  const style = sheetsMap.get(id);',
        '  if (style) {',
        '    style.remove();',
        '    sheetsMap.delete(id);',
        '  }',
        '}',
        'export function createHotContext() {',
        '  return { data: {}, accept() {}, acceptExports() {}, dispose() {}, prune() {}, decline() {}, invalidate() {}, on() {}, off() {}, send() {} };',
        '}',
        'export function injectQuery(url, queryToInject) {',
        '  if (!url || (url[0] !== "." && url[0] !== "/")) return url;',
        '  const pathname = url.replace(/[?#].*$/, "");',
        '  const { search, hash } = new URL(url, "http://vite.dev");',
        '  return `${pathname}?${queryToInject}${search ? "&" + search.slice(1) : ""}${hash || ""}`;',
        '}',
        'export class ErrorOverlay extends HTMLElement {',
        '  close() { this.parentNode?.removeChild(this); }',
        '}',
        'if (globalThis.customElements && !globalThis.customElements.get("vite-error-overlay")) {',
        '  globalThis.customElements.define("vite-error-overlay", ErrorOverlay);',
        '}',
      ].join('\n');

      app.get('/@vite/client', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(noHmrViteClient);
      });
    }

    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        allowedHosts: true as const,
        hmr: !disableHmr,
        ws: disableHmr ? (false as const) : undefined,
        watch: disableHmr ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      '/assets',
      express.static(path.join(__dirname, 'dist', 'assets'), {
        maxAge: '1y',
        immutable: true,
        etag: true,
      })
    );
    app.use(
      express.static(path.join(__dirname, 'dist'), {
        maxAge: '1h',
        etag: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(`${path.sep}sw.js`) || filePath.endsWith('/sw.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Service-Worker-Allowed', '/');
          } else if (filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const httpServer = app.listen(port, host, () => {
    console.log(`HOPELAND JOBS Server running on http://${host}:${port}`);
  });

  httpServer.on('error', (err: any) => {
    console.error('HOPELAND JOBS HTTP server error:', err);
    if (err?.code === 'EADDRINUSE' || err?.code === 'EACCES') {
      process.exit(1);
    }
  });

  const gracefulShutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2500).unref();
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

setupServer().catch((err) => {
  console.error('Failed to start HOPELAND JOBS server:', err);
  process.exit(1);
});
