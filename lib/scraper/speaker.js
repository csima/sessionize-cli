const { waitForStable } = require('../browser');

async function searchSpeakers(page, { query, baseUrl }) {
  // Navigate to speakers/submissions page and search
  // The exact URL structure depends on the event - we'll navigate from current context

  const speakers = await page.evaluate((searchQuery) => {
    const results = [];
    const bodyText = document.body.innerText || '';

    // Look for speaker names in the page
    // Pattern: Look for capitalized names near session entries
    const links = document.querySelectorAll('a[href*="speaker"], a[href*="profile"]');

    links.forEach(link => {
      const name = link.textContent.trim();
      if (name && name.toLowerCase().includes(searchQuery.toLowerCase())) {
        const href = link.href;
        const speakerIdMatch = href.match(/speakerId=(\d+)/) || href.match(/speaker\/(\d+)/);

        results.push({
          name,
          speakerId: speakerIdMatch ? speakerIdMatch[1] : null,
          url: href
        });
      }
    });

    // Also search in session cards/rows for speaker names
    const sessionCards = document.querySelectorAll('[class*="session"], [class*="submission"], tr');
    sessionCards.forEach(card => {
      const text = card.innerText || '';
      if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
        // Try to extract speaker name from card
        const nameMatch = text.match(/by\s+([A-Z][a-z]+ [A-Z][a-z]+)/i) ||
                         text.match(/Speaker:\s*([A-Z][a-z]+ [A-Z][a-z]+)/i);
        if (nameMatch) {
          const existingNames = results.map(r => r.name.toLowerCase());
          if (!existingNames.includes(nameMatch[1].toLowerCase())) {
            results.push({
              name: nameMatch[1],
              speakerId: null,
              url: null
            });
          }
        }
      }
    });

    return results;
  }, query);

  // Deduplicate by name
  const seen = new Set();
  const unique = speakers.filter(s => {
    const key = s.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

async function getSpeakerSessions(page, { speakerId, speakerName }) {
  // Get all sessions by a specific speaker
  const sessions = await page.evaluate(({ speakerId, speakerName }) => {
    const results = [];

    // Find all session links on the page
    const sessionLinks = document.querySelectorAll('a[href*="sessionId="]');

    sessionLinks.forEach(link => {
      const container = link.closest('[class*="session"], [class*="submission"], tr, div');
      if (!container) return;

      const containerText = container.innerText || '';

      // Check if this session belongs to the speaker
      const matchesSpeaker = speakerName &&
        containerText.toLowerCase().includes(speakerName.toLowerCase());

      if (matchesSpeaker) {
        const sessionIdMatch = link.href.match(/sessionId=(\d+)/);
        results.push({
          sessionId: sessionIdMatch ? sessionIdMatch[1] : null,
          title: link.textContent.trim(),
          url: link.href
        });
      }
    });

    return results;
  }, { speakerId, speakerName });

  return sessions;
}

module.exports = {
  searchSpeakers,
  getSpeakerSessions
};
