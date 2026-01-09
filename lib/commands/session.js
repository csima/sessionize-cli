const state = require('../state');
const browser = require('../browser');
const auth = require('../auth');
const sessionScraper = require('../scraper/session');

function buildBaseUrl(options) {
  const { eventId, evaluationId } = options;
  if (!eventId || !evaluationId) {
    throw new Error('Missing required: --event-id and --evaluation-id');
  }
  return `https://sessionize.com/app/organizer/event/evaluation/rate/${eventId}/${evaluationId}`;
}

async function show(options) {
  const { page } = await browser.connect(options);

  // Ensure logged in
  const loginResult = await auth.ensureLoggedIn(page, options);
  if (!loginResult.success) {
    return { success: false, error: loginResult.message };
  }

  const baseUrl = buildBaseUrl(options);
  const currentState = state.load();
  const targetSessionId = options.id || currentState.currentSessionId;

  const session = await sessionScraper.navigateToSession(page, {
    baseUrl,
    sessionId: targetSessionId
  });

  // Update state with current session
  if (session.sessionId) {
    state.update({ currentSessionId: session.sessionId });
  }

  await browser.disconnect();

  return {
    success: true,
    session
  };
}

async function rate(options) {
  const { ratings } = options;

  if (!ratings) {
    return { success: false, error: 'Missing required: ratings (e.g., 4,3,5,4)' };
  }

  // Parse ratings
  const ratingValues = ratings.split(',').map(r => {
    const n = parseFloat(r.trim());
    if (isNaN(n) || n < 0 || n > 5) {
      throw new Error(`Invalid rating value: ${r}`);
    }
    return n;
  });

  const { page } = await browser.connect(options);

  // Ensure logged in
  const loginResult = await auth.ensureLoggedIn(page, options);
  if (!loginResult.success) {
    return { success: false, error: loginResult.message };
  }

  const baseUrl = buildBaseUrl(options);
  const currentState = state.load();
  const targetSessionId = options.id || currentState.currentSessionId;

  if (!targetSessionId && !options.id) {
    // Navigate to base URL to get first session
  }

  // Navigate to target session
  const session = await sessionScraper.navigateToSession(page, {
    baseUrl,
    sessionId: targetSessionId
  });

  // Apply ratings
  const ratingResult = await sessionScraper.setRatings(page, ratingValues);
  if (!ratingResult.success) {
    await browser.disconnect();
    return { success: false, error: ratingResult.error };
  }

  // Add comment if provided
  if (options.comment) {
    const commentResult = await sessionScraper.setComment(page, options.comment);
    if (!commentResult.success) {
      await browser.disconnect();
      return { success: false, error: commentResult.error };
    }
  }

  // Save and continue
  await sessionScraper.saveAndContinue(page);

  // Get next session info
  const nextSession = await sessionScraper.extractSessionDetails(page);
  const nextSessionId = await sessionScraper.extractSessionId(page);

  // Update state
  state.update({ currentSessionId: nextSessionId });

  await browser.disconnect();

  return {
    success: true,
    rated: {
      sessionId: session.sessionId,
      title: session.title,
      ratings: ratingValues,
      comment: options.comment || null
    },
    next: {
      sessionId: nextSessionId,
      ...nextSession
    }
  };
}

async function goto(options) {
  const { sessionId } = options;

  if (!sessionId) {
    return { success: false, error: 'Missing required: sessionId' };
  }

  const { page } = await browser.connect(options);

  // Ensure logged in
  const loginResult = await auth.ensureLoggedIn(page, options);
  if (!loginResult.success) {
    return { success: false, error: loginResult.message };
  }

  const baseUrl = buildBaseUrl(options);

  const session = await sessionScraper.navigateToSession(page, {
    baseUrl,
    sessionId
  });

  state.update({ currentSessionId: session.sessionId });

  await browser.disconnect();

  return {
    success: true,
    session
  };
}

async function list(options) {
  const { page } = await browser.connect(options);

  // Ensure logged in
  const loginResult = await auth.ensureLoggedIn(page, options);
  if (!loginResult.success) {
    return { success: false, error: loginResult.message };
  }

  const baseUrl = buildBaseUrl(options);

  // Navigate to evaluation page
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await browser.waitForStable(page);

  // Get all sessions
  let sessions = await sessionScraper.getSessionList(page);

  // Apply filters
  if (options.track) {
    sessions = sessions.filter(s =>
      s.title.toLowerCase().includes(options.track.toLowerCase())
    );
  }

  if (options.status) {
    // Would need to check each session's rating status
    // For now, we include all
  }

  await browser.disconnect();

  return {
    success: true,
    count: sessions.length,
    sessions
  };
}

module.exports = {
  show,
  rate,
  goto,
  list
};
