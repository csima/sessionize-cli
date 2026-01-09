const { chromium } = require('playwright-core');
const Browserbase = require('@browserbasehq/sdk').default;
const state = require('./state');

let browserInstance = null;
let pageInstance = null;

async function connect(options = {}) {
  const { apiKey, projectId } = options;

  if (!apiKey || !projectId) {
    throw new Error('Missing required: --api-key and --project-id');
  }

  const bb = new Browserbase({ apiKey });
  const currentState = state.load();

  // Try to reuse existing session
  if (currentState.browserbaseSessionId) {
    try {
      const session = await bb.sessions.retrieve(currentState.browserbaseSessionId);
      if (session.status === 'RUNNING') {
        browserInstance = await chromium.connectOverCDP(session.connectUrl);
        pageInstance = browserInstance.contexts()[0].pages()[0];
        return { browser: browserInstance, page: pageInstance, sessionId: session.id, reused: true };
      }
    } catch (e) {
      // Session expired or invalid, create new one
      state.update({ browserbaseSessionId: null, loggedIn: false });
    }
  }

  // Create new session
  const session = await bb.sessions.create({
    projectId,
    keepAlive: true
  });

  state.update({ browserbaseSessionId: session.id });

  browserInstance = await chromium.connectOverCDP(session.connectUrl);
  pageInstance = browserInstance.contexts()[0].pages()[0];

  return { browser: browserInstance, page: pageInstance, sessionId: session.id, reused: false };
}

async function disconnect() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    pageInstance = null;
  }
}

function getPage() {
  return pageInstance;
}

function getBrowser() {
  return browserInstance;
}

async function withRetry(fn, { maxRetries = 3, delayMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayMs * attempt));
      }
    }
  }
  throw lastError;
}

async function waitForStable(page, { timeout = 5000 } = {}) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  await page.waitForTimeout(500);
}

module.exports = {
  connect,
  disconnect,
  getPage,
  getBrowser,
  withRetry,
  waitForStable
};
