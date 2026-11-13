import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getApiApp } from './serverApp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT || 3000;

async function setupServer() {
  const app = await getApiApp();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
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

  app.listen(port, () => {
    console.log(`HOPELAND JOBS Server running on port ${port}`);
  });
}

setupServer();
