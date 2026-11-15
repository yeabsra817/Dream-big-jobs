import express, { Request, Response } from 'express';
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

const port = Number(getCliArg('--port') || process.env.PORT || 3000);
const host = getCliArg('--host') || process.env.HOST || '0.0.0.0';

async function setupServer() {
  const app = await getApiApp();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        allowedHosts: true as const,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
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
      })
    );
    app.get('*', (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, host, () => {
    console.log(`HOPELAND JOBS Server running on http://${host}:${port}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start HOPELAND JOBS server:', err);
  process.exit(1);
});
