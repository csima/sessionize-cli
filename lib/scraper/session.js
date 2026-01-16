const selectors = require('./selectors');
const { withRetry, waitForStable } = require('../browser');

async function extractSessionId(page) {
  for (const strategy of selectors.sessionIdStrategies) {
    try {
      const result = await page.evaluate(strategy.fn);
      if (result) return result;
    } catch (e) {
      // Try next strategy
    }
  }
  return null;
}

async function extractSessionDetails(page) {
  return await page.evaluate(() => {
    const bodyText = document.body.innerText || '';
    const html = document.body.innerHTML || '';

    // Extract title - look for [Track X] pattern
    const trackMatch = bodyText.match(/\[Track \d+\][^\n]+/);
    const title = trackMatch ? trackMatch[0].trim() : null;

    // Extract description
    let description = '';
    if (title) {
      const startIdx = bodyText.indexOf(title) + title.length;
      const endMarkers = ['Talk Outline', 'Session format', 'Additional Notes', 'Level', 'Track'];
      let endIdx = bodyText.length;
      for (const marker of endMarkers) {
        const idx = bodyText.indexOf(marker, startIdx);
        if (idx > startIdx && idx < endIdx) endIdx = idx;
      }
      description = bodyText.substring(startIdx, endIdx).trim();
    }

    // Extract talk outline
    let talkOutline = '';
    const talkOutlineMarker = 'Talk Outline';
    const talkOutlineIdx = bodyText.indexOf(talkOutlineMarker);
    if (talkOutlineIdx > -1) {
      const outlineStart = talkOutlineIdx + talkOutlineMarker.length;
      const outlineEndMarkers = ['Session format', 'Additional Notes', 'Level', 'Track', 'All comments'];
      let outlineEnd = bodyText.length;
      for (const marker of outlineEndMarkers) {
        const idx = bodyText.indexOf(marker, outlineStart);
        if (idx > outlineStart && idx < outlineEnd) outlineEnd = idx;
      }
      talkOutline = bodyText.substring(outlineStart, outlineEnd).trim();
    }

    // Extract track and level
    const trackInfo = bodyText.match(/Track\s*\n\s*([^\n]+)/);
    const levelInfo = bodyText.match(/Level\s*\n\s*([^\n]+)/);

    // Extract progress
    const progressMatch = bodyText.match(/(\d+\.?\d*)%/);
    const progress = progressMatch ? parseFloat(progressMatch[1]) : null;

    // Extract current ratings
    const ratingElements = document.querySelectorAll('.rating.jq-ry-container');
    const currentRatings = [];
    ratingElements.forEach((el) => {
      if (window.jQuery && jQuery(el).rateYo) {
        currentRatings.push(jQuery(el).rateYo('rating'));
      }
    });

    // Extract rating criteria labels
    const criteriaLabels = [];
    ratingElements.forEach((el) => {
      const parent = el.closest('div[class*="criteria"], div[class*="rating-row"], tr, .form-group');
      if (parent) {
        const label = parent.querySelector('label, th, .criteria-name');
        if (label) criteriaLabels.push(label.textContent.trim());
      }
    });

    // Extract comments
    const commentsSection = bodyText.indexOf('All comments');
    let comments = '';
    if (commentsSection > -1) {
      const saveIdx = bodyText.indexOf('Save and continue', commentsSection);
      if (saveIdx > commentsSection) {
        comments = bodyText.substring(commentsSection + 12, saveIdx).trim();
      }
    }

    // Extract speaker info
    const speakerMatch = bodyText.match(/Level\s*\n\s*[^\n]+\s*\n\s*([A-Z][a-z]+ [A-Z][a-z]+)/);
    const speaker = speakerMatch ? speakerMatch[1] : null;

    // Determine status
    const hasRatings = currentRatings.some(r => r > 0);
    const status = hasRatings ? 'rated' : 'pending';

    return {
      title,
      description: description.substring(0, 2000),
      talkOutline: talkOutline.substring(0, 5000) || null,
      track: trackInfo ? trackInfo[1].trim() : null,
      level: levelInfo ? levelInfo[1].trim() : null,
      speaker: speaker ? { name: speaker } : null,
      progress,
      ratings: hasRatings ? currentRatings : null,
      ratingCriteria: criteriaLabels.length > 0 ? criteriaLabels : ['Practical', 'Originality', 'Relevance', 'Clarity'],
      comments: comments || null,
      status,
      url: window.location.href
    };
  });
}

async function getSessionList(page) {
  const strategy = selectors.sessionListStrategies[0];
  return await page.evaluate(strategy.fn);
}

async function setRatings(page, ratings) {
  if (!Array.isArray(ratings) || ratings.length === 0) {
    throw new Error('Ratings must be a non-empty array');
  }

  const result = await page.evaluate((ratings) => {
    const ratingElements = document.querySelectorAll('.rating.jq-ry-container');

    if (ratingElements.length === 0) {
      return { success: false, error: 'No rating widgets found' };
    }

    if (ratings.length !== ratingElements.length) {
      return {
        success: false,
        error: `Expected ${ratingElements.length} ratings, got ${ratings.length}`
      };
    }

    const applied = [];
    ratingElements.forEach((el, idx) => {
      if (window.jQuery && jQuery(el).rateYo) {
        jQuery(el).rateYo('rating', ratings[idx]);
        applied.push({ index: idx, rating: ratings[idx] });
      }
    });

    return { success: true, applied };
  }, ratings);

  return result;
}

async function setComment(page, comment) {
  if (!comment) return { success: true, skipped: true };

  const result = await page.evaluate((commentText) => {
    // Strategy 1: Look for textarea with comment-related attributes
    let textarea = document.querySelector('textarea[name*="comment" i]') ||
                   document.querySelector('textarea[id*="comment" i]') ||
                   document.querySelector('textarea[placeholder*="comment" i]');

    // Strategy 2: Look for textarea near "Add comment" or "Your comment" labels
    if (!textarea) {
      const labels = document.querySelectorAll('label, span, div');
      for (const label of labels) {
        if (label.textContent.toLowerCase().includes('comment') ||
            label.textContent.toLowerCase().includes('note')) {
          const parent = label.closest('div, section, form');
          if (parent) {
            textarea = parent.querySelector('textarea');
            if (textarea) break;
          }
        }
      }
    }

    // Strategy 3: Find any textarea on the page (usually only one for comments)
    if (!textarea) {
      const textareas = document.querySelectorAll('textarea');
      if (textareas.length === 1) {
        textarea = textareas[0];
      } else if (textareas.length > 1) {
        // Pick the one that's visible and not tiny
        for (const ta of textareas) {
          const rect = ta.getBoundingClientRect();
          if (rect.height > 50 && rect.width > 100) {
            textarea = ta;
            break;
          }
        }
      }
    }

    if (!textarea) {
      return { success: false, error: 'Could not find comment textarea' };
    }

    // Set the comment value only - don't dispatch events that may trigger auto-add
    textarea.value = commentText;

    return { success: true };
  }, comment);

  return result;
}

async function saveAndContinue(page) {
  // Try each save button strategy
  const clicked = await selectors.clickElement(page, selectors.saveButtonStrategies);

  if (!clicked) {
    throw new Error('Could not find save button');
  }

  // Wait for navigation/update
  await page.waitForTimeout(3000);
  await waitForStable(page);

  return { success: true };
}

async function navigateToSession(page, { baseUrl, sessionId }) {
  const url = sessionId ? `${baseUrl}?sessionId=${sessionId}` : baseUrl;

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForStable(page);

  const currentSessionId = await extractSessionId(page);
  const details = await extractSessionDetails(page);

  return {
    sessionId: currentSessionId,
    ...details
  };
}

module.exports = {
  extractSessionId,
  extractSessionDetails,
  getSessionList,
  setRatings,
  setComment,
  saveAndContinue,
  navigateToSession
};
