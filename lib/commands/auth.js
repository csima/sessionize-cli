const state = require('../state');
const browser = require('../browser');
const authLib = require('../auth');

async function login(options) {
  const { page, sessionId } = await browser.connect(options);

  const result = await authLib.login(page, options);

  await browser.disconnect();

  return {
    success: result.success,
    message: result.message,
    browserbaseSessionId: sessionId
  };
}

async function status(options) {
  const currentState = state.load();

  const result = {
    success: true,
    state: {
      browserbaseSessionId: currentState.browserbaseSessionId,
      loggedIn: currentState.loggedIn,
      currentSessionId: currentState.currentSessionId,
      stateFile: state.getStatePath()
    }
  };

  // If we have a browser session, verify it's still valid
  if (currentState.browserbaseSessionId && options.apiKey && options.projectId) {
    try {
      const { page, reused } = await browser.connect(options);
      const isLoggedIn = await authLib.isLoggedIn(page);

      result.state.browserSessionValid = true;
      result.state.browserSessionReused = reused;
      result.state.actuallyLoggedIn = isLoggedIn;

      if (isLoggedIn !== currentState.loggedIn) {
        state.update({ loggedIn: isLoggedIn });
        result.state.loggedIn = isLoggedIn;
        result.message = 'Login state updated';
      }

      await browser.disconnect();
    } catch (e) {
      result.state.browserSessionValid = false;
      result.state.browserSessionError = e.message;
    }
  }

  return result;
}

async function reset() {
  const newState = state.reset();

  return {
    success: true,
    message: 'State reset',
    state: newState
  };
}

module.exports = {
  login,
  status,
  reset
};
