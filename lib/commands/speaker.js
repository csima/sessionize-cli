const browser = require('../browser');
const auth = require('../auth');
const speakerScraper = require('../scraper/speaker');

async function search(options) {
  const { query } = options;

  if (!query) {
    return { success: false, error: 'Missing required: query' };
  }

  const { page } = await browser.connect(options);

  // Ensure logged in
  const loginResult = await auth.ensureLoggedIn(page, options);
  if (!loginResult.success) {
    return { success: false, error: loginResult.message };
  }

  // Navigate to evaluation page to search from there
  const { eventId, evaluationId } = options;
  if (eventId && evaluationId) {
    const baseUrl = `https://sessionize.com/app/organizer/event/evaluation/rate/${eventId}/${evaluationId}`;
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await browser.waitForStable(page);
  }

  const speakers = await speakerScraper.searchSpeakers(page, { query });

  await browser.disconnect();

  return {
    success: true,
    query,
    count: speakers.length,
    speakers
  };
}

module.exports = {
  search
};
