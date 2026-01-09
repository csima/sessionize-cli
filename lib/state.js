const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.env.HOME || '/tmp', '.sessionize-cli-state.json');

const DEFAULT_STATE = {
  browserbaseSessionId: null,
  loggedIn: false,
  currentSessionId: null,
  eventId: null,
  evaluationId: null
};

function load() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return { ...DEFAULT_STATE, ...data };
    }
  } catch (e) {
    // Corrupted state file, start fresh
  }
  return { ...DEFAULT_STATE };
}

function save(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function update(partial) {
  const current = load();
  const updated = { ...current, ...partial };
  save(updated);
  return updated;
}

function reset() {
  save(DEFAULT_STATE);
  return { ...DEFAULT_STATE };
}

function getStatePath() {
  return STATE_FILE;
}

module.exports = {
  load,
  save,
  update,
  reset,
  getStatePath,
  DEFAULT_STATE
};
