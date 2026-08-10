#!/usr/bin/env node
/**
 * Screenshots the authenticated surfaces, signed in as the seeded QA driver.
 *
 * The signed-out shell was the only thing anyone could capture before the
 * emulator path existed, so every visual claim about the dashboard was really
 * a claim about /signin. This uses the same session helper as the axe and
 * design-law runs so all three see the same pixels.
 *
 * Usage:
 *   node tests/qa-screenshot.mjs /dashboard /trips
 *   OUT_DIR=docs/premium-lift/screenshots node tests/qa-screenshot.mjs /dashboard
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { closeTab, evaluate, goto, settle, signedInTab } from './qa-session.mjs';

const OUT = process.env.OUT_DIR ?? '/tmp/driiva-shots';
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : ['/dashboard'];

/** iPhone-ish width. This product is phone first, so it is judged at phone width.
 *  The height is deliberately tall rather than relying on captureBeyondViewport:
 *  the app scrolls inside a fixed container, so beyond-viewport capture returns
 *  the background and none of the cards. */
const VIEWPORT = { width: 402, height: 874, deviceScaleFactor: 2, mobile: true };
const TALL = Number(process.env.SHOT_HEIGHT ?? 2600);

const { tab, client } = await signedInTab();
mkdirSync(OUT, { recursive: true });

try {
  await client.send('Emulation.setDeviceMetricsOverride', VIEWPORT);

  for (const route of ROUTES) {
    await goto(client, route);
    await settle(client);

    const landed = await evaluate(client, 'location.pathname');
    if (landed !== route) {
      console.log(`SKIP ${route}: landed on ${landed}`);
      continue;
    }

    const order = await evaluate(
      client,
      `JSON.stringify([...document.querySelectorAll('h1, h2')]
        .map((h) => h.textContent.trim()).filter(Boolean))`,
    );

    await client.send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, height: TALL });
    await new Promise((r) => setTimeout(r, 1200));
    const shot = await client.send('Page.captureScreenshot', { format: 'png' });
    await client.send('Emulation.setDeviceMetricsOverride', VIEWPORT);
    const name = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
    const file = path.join(OUT, `${name}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));

    console.log(`${route} -> ${file}`);
    console.log(`  headings: ${order}`);
  }
} finally {
  client.close();
  await closeTab(tab.id);
}
