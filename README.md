# sessionize-cli

A CLI tool for interacting with Sessionize as a conference organizer. Built for reviewing and rating session submissions.

## Features

- **Session Management**: View, rate, and navigate session submissions
- **Batch Operations**: List and filter sessions by track
- **Speaker Search**: Find speakers by name
- **Persistent Sessions**: Reuses Browserbase browser sessions for faster subsequent commands
- **JSON Output**: All commands output JSON for easy scripting and piping

## Prerequisites

- Node.js 18+
- [Browserbase](https://browserbase.com) account (for cloud browser automation)
  - Sign up at browserbase.com
  - Get your **API Key** and **Project ID** from the Browserbase dashboard under Settings
- Sessionize organizer account with access to an event's evaluation/rating page

## Installation

```bash
git clone <repo>
cd sessionize-cli
npm install
```

## Configuration

Create a config file at `~/.sessionize-cli.json`:

```json
{
  "apiKey": "bb_live_xxx",
  "projectId": "your-browserbase-project-id",
  "email": "your-sessionize-email",
  "password": "your-sessionize-password",
  "eventId": "12345",
  "evaluationId": "6789"
}
```

Set permissions: `chmod 600 ~/.sessionize-cli.json`

### Finding your Sessionize Event ID and Evaluation ID

1. Log in to Sessionize and navigate to your event
2. Go to **Evaluation** > **Rate Sessions**
3. Look at the URL in your browser - it will look like:
   ```
   https://sessionize.com/app/organizer/event/evaluation/rate/12345/6789
   ```
4. The first number (`12345`) is your **eventId**
5. The second number (`6789`) is your **evaluationId**

CLI flags override config file values when provided.

## Usage

```bash
node bin/sessionize.js <command> <subcommand> [options]
```

### Commands

#### Session Commands

**Show current or specific session:**
```bash
# Show current session (from state)
node bin/sessionize.js session show

# Show specific session
node bin/sessionize.js session show --id 1100206
```

**Rate a session:**
```bash
# Rate current session
node bin/sessionize.js session rate 4,3,5,4

# Rate specific session
node bin/sessionize.js session rate 4,3,5,4 --id 1100206

# Rate with a comment
node bin/sessionize.js session rate 4,3,5,4 --comment "Excellent proposal, very relevant"
```

Ratings are comma-separated values (typically 4 scores for Practical, Originality, Relevance, Clarity).
The `--comment` flag is optional and adds a reviewer comment to the session.

**Navigate to a session:**
```bash
node bin/sessionize.js session goto 1100206
```

**List sessions:**
```bash
# List all sessions
node bin/sessionize.js session list

# Filter by track
node bin/sessionize.js session list --track "Track 1"
```

#### Speaker Commands

**Search speakers:**
```bash
node bin/sessionize.js speaker search "John"
```

#### Auth Commands

**Login:**
```bash
node bin/sessionize.js auth login
```

**Check status:**
```bash
node bin/sessionize.js auth status
```

#### Config Commands

**Show current configuration:**
```bash
node bin/sessionize.js config show
```

**Show config file path:**
```bash
node bin/sessionize.js config path
```

**Reset state:**
```bash
node bin/sessionize.js auth reset
```

## Examples

### Full workflow example

```bash
# View current session
node bin/sessionize.js session show

# Rate it and auto-advance to next
node bin/sessionize.js session rate 4,4,3,5

# Rate with a comment
node bin/sessionize.js session rate 4,4,3,5 --comment "Great proposal"

# View a specific session
node bin/sessionize.js session show --id 1100206

# Rate that specific session
node bin/sessionize.js session rate 3,3,4,4 --id 1100206

# List all sessions
node bin/sessionize.js session list

# Check auth state
node bin/sessionize.js auth status
```

### Using with jq

```bash
# Get just the session title
node bin/sessionize.js session show | jq -r '.session.title'

# Get list of session IDs
node bin/sessionize.js session list | jq -r '.sessions[].sessionId'

# Pretty print current session
node bin/sessionize.js session show | jq '.session | {title, speaker, track, progress}'
```

### Shell script for batch review

```bash
#!/bin/bash
while true; do
  # Show current session
  SESSION=$(node bin/sessionize.js session show)
  echo "$SESSION" | jq '{title: .session.title, speaker: .session.speaker.name, description: .session.description}'

  # Prompt for rating
  read -p "Enter ratings (e.g., 4,3,5,4) or 'skip' or 'quit': " INPUT

  if [ "$INPUT" = "quit" ]; then
    break
  elif [ "$INPUT" = "skip" ]; then
    continue
  else
    node bin/sessionize.js session rate "$INPUT"
  fi
done
```

## Output Format

All commands return JSON with a consistent structure:

```json
{
  "success": true,
  "session": {
    "sessionId": "1100206",
    "title": "[Track 1] Example Session Title",
    "description": "Session description...",
    "track": "TRACK 1: Building Secure AI Systems",
    "level": "Intermediate",
    "speaker": {
      "name": "Speaker Name"
    },
    "progress": 8.3,
    "ratings": null,
    "ratingCriteria": ["Practical", "Originality", "Relevance", "Clarity"],
    "comments": "Reviewer comments...",
    "status": "pending",
    "url": "https://sessionize.com/..."
  }
}
```

For rate commands, the response includes both the rated session and the next session:

```json
{
  "success": true,
  "rated": {
    "sessionId": "1100206",
    "title": "...",
    "ratings": [4, 3, 5, 4]
  },
  "next": {
    "sessionId": "1100207",
    "title": "...",
    ...
  }
}
```

## State Management

The CLI maintains state in `~/.sessionize-cli-state.json`:

- `browserbaseSessionId`: Reused browser session for faster commands
- `loggedIn`: Whether currently authenticated
- `currentSessionId`: Last viewed session (used when no `--id` specified)

Reset with:
```bash
node bin/sessionize.js auth reset
```

## Project Structure

```
sessionize-cli/
├── bin/
│   └── sessionize.js          # CLI entry point
├── lib/
│   ├── state.js               # Persistent state management
│   ├── browser.js             # Browserbase connection + retry logic
│   ├── auth.js                # Login with fallback selectors
│   ├── scraper/
│   │   ├── selectors.js       # Multi-strategy element selectors
│   │   ├── session.js         # Session data extraction
│   │   └── speaker.js         # Speaker search
│   └── commands/
│       ├── session.js         # session subcommands
│       ├── speaker.js         # speaker subcommands
│       └── auth.js            # auth subcommands
└── package.json
```

## Troubleshooting

**"Missing required: --api-key and --project-id"**
All commands except `auth reset` and `auth status` (without verification) require Browserbase credentials.

**"Login failed"**
The Browserbase session may have expired. Run `auth reset` and try again.

**"No rating widgets found"**
The page structure may have changed. Check that you're on a valid evaluation page.

**Session not advancing after rate**
Verify the ratings were applied by checking the response. The `next` field shows the new current session.

## License

MIT
