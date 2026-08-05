import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Dev-only plugin: mounts the API surface as middleware so the local
 * Vite dev server (npm run dev) exercises the same code path as the
 * deployed Vercel functions. In production the files under /api/ are
 * picked up by Vercel directly; this plugin does not ship.
 */
function devApiPlugin(): Plugin {
  return {
    name: 'driiva-dev-api',
    apply: 'serve',
    async configureServer(server) {
      const { processWaitlist, getWaitlistCount } = await import(
        './api/lib/waitlist-core'
      );

      server.middlewares.use('/api/waitlist', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Allow', 'POST, OPTIONS');
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          next();
          return;
        }
        const body = await readJsonBody(req);
        if (
          body &&
          typeof body === 'object' &&
          'company' in (body as Record<string, unknown>) &&
          (body as Record<string, unknown>).company
        ) {
          jsonResponse(res, 200, { success: true });
          return;
        }
        const { status, payload } = await processWaitlist(
          (body as Record<string, unknown>) ?? {},
        );
        jsonResponse(res, status, payload);
      });

      server.middlewares.use('/api/waitlist-count', async (req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }
        try {
          const count = await getWaitlistCount();
          jsonResponse(res, 200, { count });
        } catch {
          jsonResponse(res, 200, { count: 117 });
        }
      });

      server.middlewares.use('/api/health', (req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }
        jsonResponse(res, 200, { status: 'ok', service: 'driiva-marketing-dev' });
      });
    },
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString();
      if (data.length > 100_000) {
        // 100 kB cap — abort runaway bodies
        data = '';
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function jsonResponse(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), devApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      // manualChunks is a client-bundle concern. React and friends are external
      // in the SSR build, and Rollup errors out if you try to chunk an external.
      output: isSsrBuild
        ? {}
        : {
            manualChunks: {
              react: ['react', 'react-dom'],
              anime: ['animejs'],
              lenis: ['@studio-freight/lenis'],
            },
          },
    },
  },
  // Bundle every dependency into the prerender build instead of leaving them
  // external. This is a pnpm workspace, so an externalised `react` resolves to
  // the hoisted root copy while `react-dom` resolves to the app copy, and two
  // React instances means "Cannot read properties of null (reading useEffect)".
  // Bundling guarantees one instance. Only affects the throwaway dist-ssr
  // output, never the shipped client bundle.
  ssr: {
    noExternal: true,
  },
  server: {
    port: 5173,
  },
}));
