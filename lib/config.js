const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.env.HOME || '/tmp', '.sessionize-cli.json');

const DEFAULT_CONFIG = {
  apiKey: null,
  projectId: null,
  email: null,
  password: null,
  eventId: null,
  evaluationId: null
};

function load() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (e) {
    // Corrupted config file
  }
  return { ...DEFAULT_CONFIG };
}

function save(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function getConfigPath() {
  return CONFIG_FILE;
}

function exists() {
  return fs.existsSync(CONFIG_FILE);
}

module.exports = {
  load,
  save,
  getConfigPath,
  exists,
  DEFAULT_CONFIG
};
