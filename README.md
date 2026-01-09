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
- Sessionize organizer account

## Installation

```bash
git clone <repo>
cd sessionize-cli
npm install
```

## Usage

All commands require authentication flags:

```bash
node bin/sessionize.js <command> <subcommand> [options] \
  --api-key <browserbase-api-key> \
  --project-id <browserbase-project-id> \
  --email <sessionize-email> \
  --password <sessionize-password> \
  --event-id <sessionize-event-id> \
  --evaluation-id <sessionize-evaluation-id>
```

### Commands

#### Session Commands

**Show current or specific session:**
```bash
# Show current session (from state)
node bin/sessionize.js session show [flags]

# Show specific session
node bin/sessionize.js session show --id 1100206 [flags]
```

**Rate a session:**
```bash
# Rate current session
node bin/sessionize.js session rate 4,3,5,4 [flags]

# Rate specific session
node bin/sessionize.js session rate 4,3,5,4 --id 1100206 [flags]

# Rate with a comment
node bin/sessionize.js session rate 4,3,5,4 --comment "Excellent proposal, very relevant" [flags]
```

Ratings are comma-separated values (typically 4 scores for Practical, Originality, Relevance, Clarity).
The `--comment` flag is optional and adds a reviewer comment to the session.

**Navigate to a session:**
```bash
node bin/sessionize.js session goto 1100206 [flags]
```

**List sessions:**
```bash
# List all sessions
node bin/sessionize.js session list [flags]

# Filter by track
node bin/sessionize.js session list --track "Track 1" [flags]
```

#### Speaker Commands

**Search speakers:**
```bash
node bin/sessionize.js speaker search "John" [flags]
```

#### Auth Commands

**Login:**
```bash
node bin/sessionize.js auth login [flags]
```

**Check status:**
```bash
node bin/sessionize.js auth status [flags]
```

**Reset state:**
```bash
node bin/sessionize.js auth reset
```

## Examples

### Full workflow example

```bash
# Set up aliases for brevity
FLAGS="--api-key bb_live_xxx --project-id xxx --email user@example.com --password xxx --event-id 22203 --evaluation-id 8184"

# View current session
node bin/sessionize.js session show $FLAGS

# Rate it and auto-advance to next
node bin/sessionize.js session rate 4,4,3,5 $FLAGS

# View a specific session
node bin/sessionize.js session show --id 1100206 $FLAGS

# Rate that specific session
node bin/sessionize.js session rate 3,3,4,4 --id 1100206 $FLAGS

# List all sessions
node bin/sessionize.js session list $FLAGS

# Check auth state
node bin/sessionize.js auth status $FLAGS
```

### Using with jq

```bash
# Get just the session title
node bin/sessionize.js session show $FLAGS | jq -r '.session.title'

# Get list of session IDs
node bin/sessionize.js session list $FLAGS | jq -r '.sessions[].sessionId'

# Pretty print current session
node bin/sessionize.js session show $FLAGS | jq '.session | {title, speaker, track, progress}'
```

### Shell script for batch review

```bash
#!/bin/bash
FLAGS="--api-key $BB_API_KEY --project-id $BB_PROJECT_ID --email $SZ_EMAIL --password $SZ_PASSWORD --event-id $EVENT_ID --evaluation-id $EVAL_ID"

while true; do
  # Show current session
  SESSION=$(node bin/sessionize.js session show $FLAGS)
  echo "$SESSION" | jq '{title: .session.title, speaker: .session.speaker.name, description: .session.description}'

  # Prompt for rating
  read -p "Enter ratings (e.g., 4,3,5,4) or 'skip' or 'quit': " INPUT

  if [ "$INPUT" = "quit" ]; then
    break
  elif [ "$INPUT" = "skip" ]; then
    # Get next session ID and goto it
    continue
  else
    node bin/sessionize.js session rate "$INPUT" $FLAGS
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
