import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDatabase, syncEnvAdminAccount } from './server/db';
import { hashPassword } from './server/auth';
import { createApiRouter } from './server/routes';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  initDatabase();
  syncEnvAdminAccount(hashPassword);

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // Long-lived browser caching for supplied brand & splash assets for fast loading
  app.use(
    '/assets',
    express.static(path.resolve(process.cwd(), 'public/assets'), {
      maxAge: '7d',
      immutable: true,
    })
  );

  app.use('/api', createApiRouter());

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { maxAge: '1d' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const htmlPath = path.resolve(process.cwd(), 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (SANDBOX_MODE=${process.env.SANDBOX_MODE !== 'false'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
