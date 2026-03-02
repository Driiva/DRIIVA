/**
 * Vercel serverless entry point.
 * server/app.ts is pre-compiled to api/_server.js by the build command in vercel.json.
 * We dynamically import it so Node.js loads compiled JS (not raw TypeScript).
 */
import type { IncomingMessage, ServerResponse } from "http";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type AppHandler = (req: any, res: any) => void;
let handler: AppHandler | null = null;
let initError: string | null = null;

const initPromise = (async () => {
  try {
    const serverPath = path.join(__dirname, "_server.js");
    const mod = await import(serverPath);
    await mod.ready;
    handler = mod.app as AppHandler;
  } catch (e: unknown) {
    initError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    console.error("[api] init failed:", initError);
  }
})();

export default async function apiHandler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  await initPromise;

  if (!handler) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Server init failed", detail: initError }));
    return;
  }

  handler(req, res);
}
