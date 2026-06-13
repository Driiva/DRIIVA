/**
 * Local / self-host entry point — used by `npm run dev` and by
 * `npm run build` + `npm start` (bundled to dist/index.js by esbuild).
 *
 * IMPORTANT: this file does NOT run on Vercel production. In prod, Vercel
 * serves /api/* through api/index.ts, which loads the SAME Express app
 * (server/app.ts, compiled to api/_server.js by the buildCommand in
 * vercel.json) and owns the HTTP server itself. So the createServer + listen
 * below, and the dist/index.js artefact, are the self-host path only —
 * editing this file has no effect on the Vercel deployment.
 *
 * server/app.ts is the single source of truth for the Express app; this file
 * only adds Vite middleware (dev) or static serving (self-host prod) and a
 * listening socket on top of it.
 */
import { createServer } from "http";
import { app, ready } from "./app";
import { setupVite, serveStatic, log } from "./vite";

(async () => {
  await ready;

  const server = createServer(app);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = parseInt(process.env.PORT || '3001', 10);

  server.listen(PORT, () => {
    log(`Server running on http://localhost:${PORT}`);
  });
})();
