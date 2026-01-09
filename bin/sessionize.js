#!/usr/bin/env node

const sessionCommands = require('../lib/commands/session');
const speakerCommands = require('../lib/commands/speaker');
const authCommands = require('../lib/commands/auth');
const config = require('../lib/config');

function parseArgs(args) {
  const parsed = {
    command: null,
    subcommand: null,
    positional: [],
    flags: {}
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];

      // Handle --flag=value syntax
      if (key.includes('=')) {
        const [k, v] = key.split('=');
        parsed.flags[kebabToCamel(k)] = v;
      } else if (next && !next.startsWith('--')) {
        parsed.flags[kebabToCamel(key)] = next;
        i++;
      } else {
        parsed.flags[kebabToCamel(key)] = true;
      }
    } else if (!parsed.command) {
      parsed.command = arg;
    } else if (!parsed.subcommand) {
      parsed.subcommand = arg;
    } else {
      parsed.positional.push(arg);
    }
    i++;
  }

  return parsed;
}

function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function printUsage() {
  const configPath = config.getConfigPath();
  console.log(`
sessionize-cli - Interact with Sessionize as a conference organizer

USAGE:
  node sessionize.js <command> <subcommand> [options]

COMMANDS:
  session show [--id <sessionId>]
    Show current or specific session details

  session rate <ratings> [--id <sessionId>] [--comment <text>]
    Rate a session (e.g., 4,3,5,4) with optional comment

  session goto <sessionId>
    Navigate to a specific session

  session list [--track <name>] [--status pending|rated]
    List sessions with optional filters

  speaker search <query>
    Search for speakers by name

  auth login
    Log in to Sessionize

  auth status
    Check authentication state

  auth reset
    Clear all state

  config show
    Show current configuration

  config path
    Show config file path

CONFIGURATION:
  Settings are loaded from: ${configPath}
  CLI flags override config file values.

  Config file format (JSON):
  {
    "apiKey": "bb_live_xxx",
    "projectId": "xxx",
    "email": "user@example.com",
    "password": "xxx",
    "eventId": "22203",
    "evaluationId": "8184"
  }

OPTIONAL FLAGS (override config):
  --api-key <key>         Browserbase API key
  --project-id <id>       Browserbase project ID
  --email <email>         Sessionize email
  --password <password>   Sessionize password
  --event-id <id>         Sessionize event ID
  --evaluation-id <id>    Sessionize evaluation ID

EXAMPLES:
  # Show current session (uses config file)
  node sessionize.js session show

  # Rate current session
  node sessionize.js session rate 4,3,5,4

  # Rate with a comment
  node sessionize.js session rate 4,3,5,4 --comment "Great talk proposal!"

  # Rate specific session
  node sessionize.js session rate 4,3,5,4 --id 1234567

  # Override config with flags
  node sessionize.js session show --event-id 99999

  # Check auth status
  node sessionize.js auth status
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const parsed = parseArgs(args);
  const { command, subcommand, positional, flags } = parsed;

  // Load config and merge with CLI flags (flags override config)
  const configData = config.load();
  const options = {
    apiKey: flags.apiKey || configData.apiKey,
    projectId: flags.projectId || configData.projectId,
    email: flags.email || configData.email,
    password: flags.password || configData.password,
    eventId: flags.eventId || configData.eventId,
    evaluationId: flags.evaluationId || configData.evaluationId,
    ...flags
  };

  // Handle positional arguments based on command
  if (command === 'session' && subcommand === 'rate' && positional[0]) {
    options.ratings = positional[0];
  }
  if (command === 'session' && subcommand === 'goto' && positional[0]) {
    options.sessionId = positional[0];
  }
  if (command === 'speaker' && subcommand === 'search' && positional[0]) {
    options.query = positional[0];
  }

  let result;

  try {
    switch (command) {
      case 'session':
        switch (subcommand) {
          case 'show':
            result = await sessionCommands.show(options);
            break;
          case 'rate':
            result = await sessionCommands.rate(options);
            break;
          case 'goto':
            result = await sessionCommands.goto(options);
            break;
          case 'list':
            result = await sessionCommands.list(options);
            break;
          default:
            console.error(`Unknown session subcommand: ${subcommand}`);
            printUsage();
            process.exit(1);
        }
        break;

      case 'speaker':
        switch (subcommand) {
          case 'search':
            result = await speakerCommands.search(options);
            break;
          default:
            console.error(`Unknown speaker subcommand: ${subcommand}`);
            printUsage();
            process.exit(1);
        }
        break;

      case 'auth':
        switch (subcommand) {
          case 'login':
            result = await authCommands.login(options);
            break;
          case 'status':
            result = await authCommands.status(options);
            break;
          case 'reset':
            result = await authCommands.reset();
            break;
          default:
            console.error(`Unknown auth subcommand: ${subcommand}`);
            printUsage();
            process.exit(1);
        }
        break;

      case 'config':
        switch (subcommand) {
          case 'show':
            const currentConfig = config.load();
            // Mask password for display
            const displayConfig = { ...currentConfig };
            if (displayConfig.password) {
              displayConfig.password = '***' + displayConfig.password.slice(-4);
            }
            result = {
              success: true,
              configPath: config.getConfigPath(),
              config: displayConfig
            };
            break;
          case 'path':
            result = {
              success: true,
              configPath: config.getConfigPath(),
              exists: config.exists()
            };
            break;
          default:
            console.error(`Unknown config subcommand: ${subcommand}`);
            printUsage();
            process.exit(1);
        }
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }

    // Output JSON
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error.message,
      stack: process.env.DEBUG ? error.stack : undefined
    }, null, 2));
    process.exit(1);
  }
}

main();
