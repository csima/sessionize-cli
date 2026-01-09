const state = require('./state');
const { waitForStable, withRetry } = require('./browser');
const selectors = require('./scraper/selectors');

const LOGIN_URL = 'https://sessionize.com/login';

async function isLoggedIn(page) {
  const url = page.url();

  // Check URL pattern
  if (url.includes('sessionize.com/app')) {
    return true;
  }

  // Check for logged-in indicators on page
  const indicators = await page.evaluate(() => {
    const body = document.body.innerText || '';
    return {
      hasLogout: body.includes('Log out') || body.includes('Logout'),
      hasMyEvents: body.includes('My events'),
      hasOrganizer: body.includes('Organizer')
    };
  });

  return indicators.hasLogout || indicators.hasMyEvents || indicators.hasOrganizer;
}

async function login(page, { email, password }) {
  if (!email || !password) {
    throw new Error('Missing required: --email and --password');
  }

  // Navigate to login page
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await waitForStable(page);

  // Check if already logged in
  if (await isLoggedIn(page)) {
    state.update({ loggedIn: true });
    return { success: true, message: 'Already logged in' };
  }

  // Click Classic Login using multiple selector strategies
  const classicLoginClicked = await withRetry(async () => {
    const clicked = await page.evaluate(() => {
      // Strategy 1: Look for text content
      const elements = document.querySelectorAll('a, button, div, span');
      for (const el of elements) {
        if (el.textContent.trim() === 'Classic Login' ||
            el.textContent.includes('Classic Login')) {
          el.click();
          return true;
        }
      }

      // Strategy 2: Look for specific class patterns
      const classicBtn = document.querySelector('[class*="classic"], [class*="email-login"]');
      if (classicBtn) {
        classicBtn.click();
        return true;
      }

      return false;
    });

    if (!clicked) throw new Error('Classic Login button not found');
    return clicked;
  }, { maxRetries: 3, delayMs: 1000 });

  await waitForStable(page);

  // Fill credentials using multiple selector strategies
  await withRetry(async () => {
    const filled = await page.evaluate(({ email, password }) => {
      // Strategy 1: By ID
      let usernameField = document.querySelector('#Username');
      let passwordField = document.querySelector('#Password');

      // Strategy 2: By name
      if (!usernameField) usernameField = document.querySelector('[name="Username"]');
      if (!passwordField) passwordField = document.querySelector('[name="Password"]');

      // Strategy 3: By type and placeholder
      if (!usernameField) usernameField = document.querySelector('input[type="email"], input[placeholder*="email" i]');
      if (!passwordField) passwordField = document.querySelector('input[type="password"]');

      if (!usernameField || !passwordField) {
        return { success: false, error: 'Could not find login fields' };
      }

      usernameField.value = email;
      passwordField.value = password;

      // Trigger input events for React/Vue forms
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));
      usernameField.dispatchEvent(new Event('change', { bubbles: true }));
      passwordField.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true };
    }, { email, password });

    if (!filled.success) throw new Error(filled.error);
    return filled;
  });

  await page.waitForTimeout(500);

  // Submit form
  await withRetry(async () => {
    const submitted = await page.evaluate(() => {
      // Strategy 1: Find submit button in form
      const form = document.querySelector('#Username')?.closest('form') ||
                   document.querySelector('input[type="password"]')?.closest('form');

      if (form) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
          return true;
        }
        form.submit();
        return true;
      }

      // Strategy 2: Find any login/submit button
      const buttons = document.querySelectorAll('button, input[type="submit"]');
      for (const btn of buttons) {
        if (btn.textContent.toLowerCase().includes('log in') ||
            btn.textContent.toLowerCase().includes('sign in') ||
            btn.value?.toLowerCase().includes('log in')) {
          btn.click();
          return true;
        }
      }

      return false;
    });

    if (!submitted) throw new Error('Could not find submit button');
    return submitted;
  });

  // Wait for login to complete
  await page.waitForTimeout(5000);
  await waitForStable(page);

  // Verify login success
  const loggedIn = await isLoggedIn(page);

  if (loggedIn) {
    state.update({ loggedIn: true });
    return { success: true, message: 'Login successful', url: page.url() };
  } else {
    state.update({ loggedIn: false });
    return { success: false, message: 'Login failed - check credentials', url: page.url() };
  }
}

async function ensureLoggedIn(page, credentials) {
  const currentState = state.load();

  // If we think we're logged in, verify
  if (currentState.loggedIn) {
    if (await isLoggedIn(page)) {
      return { success: true, message: 'Session valid' };
    }
    // Session expired
    state.update({ loggedIn: false });
  }

  // Need to log in
  return await login(page, credentials);
}

module.exports = {
  login,
  isLoggedIn,
  ensureLoggedIn
};
