/**
 * Shared CDP session helper for the QA gates.
 *
 * Attaches to the Chrome already on :9222 (per CLAUDE.md, never launch one),
 * signs in as the seeded emulator driver, and hands back a tab that can reach
 * the authenticated surfaces.
 *
 * Signing in is done through the app's own sign-in form rather than by
 * injecting a token, so the session is exactly the one a real user gets and
 * the pages run their real auth paths.
 */

export const CDP = process.env.CDP_URL ?? 'http://localhost:9222';
export const APP = process.env.APP_URL ?? 'http://localhost:5202';
export const QA_EMAIL = process.env.QA_EMAIL ?? 'qa.driver@driiva.test';
export const QA_PASSWORD = process.env.QA_PASSWORD ?? 'qa-password-123';

export async function openTab(url) {
  const res = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`could not open a tab: ${res.status}`);
  return res.json();
}

export async function closeTab(id) {
  await fetch(`${CDP}/json/close/${id}`).catch(() => {});
}

export function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP socket failed')), { once: true });
  });

  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close(),
  };
}

export async function evaluate(client, expression, { awaitPromise = true } = {}) {
  const { result, exceptionDetails } = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? 'page threw');
  }
  return result.value;
}

/**
 * Polls until the page stops changing. Short probes from here rather than one
 * long in-page promise: any navigation destroys the page's execution context,
 * and a long wait inside the page is itself what throws when that happens.
 */
export async function settle(client, { timeoutMs = 20000 } = {}) {
  const SAMPLE = `(() => {
    const root = document.getElementById('root');
    return (root ? root.children.length : 0) + ':' +
           document.querySelectorAll('body *').length + ':' +
           document.body.innerText.length;
  })()`;

  let last = '';
  let stable = 0;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let now = '';
    try {
      now = await evaluate(client, SAMPLE);
    } catch {
      last = '';
      stable = 0;
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    const empty = now.startsWith('0:') || now.endsWith(':0');
    stable = !empty && now === last ? stable + 1 : 0;
    last = now;
    if (stable >= 3) return;
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Opens a tab, signs in through the real form, and returns { tab, client }.
 * The caller navigates onward and must call closeTab when finished.
 */
export async function signedInTab() {
  const tab = await openTab(`${APP}/signin`);
  const client = connect(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await settle(client);

  const signedIn = await evaluate(
    client,
    `(async () => {
      const email = document.querySelector('input[type="email"], input[placeholder*="you@" i]');
      const password = document.querySelector('input[type="password"]');
      if (!email || !password) return 'no-form';

      const setValue = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value',
        ).set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };

      setValue(email, ${JSON.stringify(QA_EMAIL)});
      setValue(password, ${JSON.stringify(QA_PASSWORD)});

      const button = [...document.querySelectorAll('button')].find((b) =>
        /sign in/i.test(b.textContent || ''));
      if (!button) return 'no-button';
      button.click();

      // Wait for the route to leave /signin.
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 250));
        if (!location.pathname.startsWith('/signin')) return 'ok';
      }
      return 'stuck:' + document.body.innerText.slice(0, 200);
    })()`,
  );

  await settle(client);

  /*
   * Wait for auth to finish ENRICHING, not merely to resolve.
   *
   * AuthContext returns a user quickly and fills in onboardingComplete from
   * Firestore a moment later. Navigating in that window sends ProtectedRoute
   * to /quick-onboarding, and the audit then silently skipped every
   * authenticated route and reported a suspiciously clean score. A gate that
   * measures nothing and says PASS is worse than one that fails.
   */
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await evaluate(
      client,
      `(() => { history.pushState({}, '', '/dashboard');
                dispatchEvent(new PopStateEvent('popstate')); return true; })()`,
      { awaitPromise: false },
    );
    await settle(client);
    const path = await evaluate(client, 'location.pathname');
    if (path === '/dashboard') break;
    await new Promise((r) => setTimeout(r, 500));
  }

  return { tab, client, signedIn };
}

/** Navigates an existing signed-in tab via the SPA router and settles. */
export async function goto(client, path) {
  await evaluate(
    client,
    `(() => {
       history.pushState({}, '', ${JSON.stringify(path)});
       dispatchEvent(new PopStateEvent('popstate'));
       return true;
     })()`,
    { awaitPromise: false },
  );
  await settle(client);
}

/**
 * Opens a tab in a FRESH, isolated browser context: no cookies, no IndexedDB,
 * so no signed-in session.
 *
 * Needed because the audit's public routes were being measured against a
 * profile that already had a session, so "/" and "/signin" both redirected to
 * the dashboard and got audited as if they were the signed-out pages. Three
 * routes were reporting the dashboard's violations under the wrong names.
 *
 * This creates a context, not a browser: CLAUDE.md's rule is never to launch a
 * second Chrome, and Target.createBrowserContext runs inside the one already
 * attached.
 */
export async function incognitoTab(url) {
  const browserWs = (await (await fetch(`${CDP}/json/version`)).json()).webSocketDebuggerUrl;
  const browser = connect(browserWs);
  await browser.ready;

  const { browserContextId } = await browser.send('Target.createBrowserContext', {
    disposeOnDetach: false,
  });
  const { targetId } = await browser.send('Target.createTarget', { url, browserContextId });

  const targets = await (await fetch(`${CDP}/json/list`)).json();
  const tab = targets.find((t) => t.id === targetId);
  if (!tab) throw new Error('could not find the isolated tab');

  const client = connect(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Runtime.enable');

  return {
    client,
    async dispose() {
      client.close();
      await browser.send('Target.closeTarget', { targetId }).catch(() => {});
      await browser.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
      browser.close();
    },
  };
}
