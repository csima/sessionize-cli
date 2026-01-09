/**
 * Multi-strategy selector helpers for resilient scraping.
 * Each function tries multiple approaches to find elements.
 */

async function findElement(page, strategies) {
  for (const strategy of strategies) {
    try {
      const result = await page.evaluate(strategy.fn);
      if (result) return result;
    } catch (e) {
      // Try next strategy
    }
  }
  return null;
}

async function clickElement(page, strategies) {
  for (const strategy of strategies) {
    try {
      const clicked = await page.evaluate(strategy.fn);
      if (clicked) return true;
    } catch (e) {
      // Try next strategy
    }
  }
  return false;
}

// Rating widget selectors
const ratingWidgetStrategies = [
  {
    name: 'jquery-rateyo',
    fn: () => {
      const elements = document.querySelectorAll('.rating.jq-ry-container');
      return elements.length > 0 ? elements.length : null;
    }
  },
  {
    name: 'rateyo-class',
    fn: () => {
      const elements = document.querySelectorAll('[class*="rateyo"], [class*="rate-yo"]');
      return elements.length > 0 ? elements.length : null;
    }
  },
  {
    name: 'star-rating',
    fn: () => {
      const elements = document.querySelectorAll('[class*="star-rating"], [class*="rating"]');
      return elements.length > 0 ? elements.length : null;
    }
  }
];

// Save button selectors
const saveButtonStrategies = [
  {
    name: 'js-save-button',
    fn: () => {
      const btn = document.querySelector('.js-save-button');
      if (btn) {
        btn.classList.remove('disabled');
        btn.removeAttribute('disabled');
        btn.click();
        return true;
      }
      return false;
    }
  },
  {
    name: 'save-continue-text',
    fn: () => {
      const buttons = document.querySelectorAll('button, a, div[role="button"]');
      for (const btn of buttons) {
        if (btn.textContent.includes('Save and continue') ||
            btn.textContent.includes('Save & continue')) {
          btn.click();
          return true;
        }
      }
      return false;
    }
  },
  {
    name: 'submit-button',
    fn: () => {
      const btn = document.querySelector('button[type="submit"], input[type="submit"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }
  }
];

// Session ID extraction strategies
const sessionIdStrategies = [
  {
    name: 'url-param',
    fn: () => {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('sessionId');
    }
  },
  {
    name: 'track-link-pattern',
    fn: () => {
      const html = document.body.innerHTML;
      const pattern = /href="[^"]*sessionId=(\d+)[^"]*"[^>]*>\s*\[Track/;
      const match = html.match(pattern);
      return match ? match[1] : null;
    }
  },
  {
    name: 'any-sessionid-link',
    fn: () => {
      const links = document.querySelectorAll('a[href*="sessionId="]');
      for (const link of links) {
        if (link.textContent.includes('[Track')) {
          const match = link.href.match(/sessionId=(\d+)/);
          return match ? match[1] : null;
        }
      }
      return null;
    }
  },
  {
    name: 'first-sessionid',
    fn: () => {
      const link = document.querySelector('a[href*="sessionId="]');
      if (link) {
        const match = link.href.match(/sessionId=(\d+)/);
        return match ? match[1] : null;
      }
      return null;
    }
  }
];

// Session list selectors
const sessionListStrategies = [
  {
    name: 'sessionid-links',
    fn: () => {
      const links = Array.from(document.querySelectorAll('a[href*="sessionId="]'));
      return links.map(link => {
        const match = link.href.match(/sessionId=(\d+)/);
        return {
          sessionId: match ? match[1] : null,
          title: link.textContent.trim().substring(0, 150),
          href: link.href
        };
      }).filter(s => s.sessionId);
    }
  }
];

module.exports = {
  findElement,
  clickElement,
  ratingWidgetStrategies,
  saveButtonStrategies,
  sessionIdStrategies,
  sessionListStrategies
};
