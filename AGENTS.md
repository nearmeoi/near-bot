# AGENTS.md — Coding Guidelines for near-bot

## Project Overview

near-bot is a WhatsApp bot built with Node.js (ES Modules) using the [Baileys](https://github.com/WhiskeySockets/Baileys) library. It features a plugin-based architecture with command routing, user/session management, and integrations with external APIs (MagangHub/Kemnaker, AI services).

---

## Build / Run Commands

```bash
npm start          # Production — runs node launcher.js
npm test           # Debug mode — runs node --inspect --expose-gc index.js
```

**No test framework or linting is currently configured.** If you add tests, prefer Vitest or Node's built-in test runner (`node --test`). If you add linting, use ESLint flat config.

---

## Code Style

### Language & Modules

- **Pure JavaScript** — no TypeScript.
- **ES Modules** (`"type": "module"` in package.json). Always use `import`/`export`, never `require`.
- Node built-in modules: use `node:` prefix — `import fs from 'node:fs'`, `import path from 'node:path'`.
- Import path alias: `#helper` maps to `./system/helper.js` (defined in package.json `imports`).
- Service-to-service imports use relative paths: `import { smartChat } from '../../system/services/ai-service.js'`.

### Naming

| Scope | Convention | Example |
|---|---|---|
| Functions / variables | camelCase | `sendText`, `checkAttendanceStatus` |
| Constants | SCREAMING_SNAKE_CASE | `SESSION_TIMEOUT_MS`, `DB_PATH` |
| Classes (if any) | PascalCase | `CookieJar` |
| Plugin file names | kebab-case | `ai-near.js`, `auto-sticker.js` |

### Formatting

- **2-space indentation**.
- Use semicolons (codebase is inconsistent but semicolons are preferred).
- Strings: single or double quotes are both used — stay consistent within a file.
- Blank line between logical sections.

### Imports Order (recommended)

1. Node built-ins (`node:fs`)
2. Third-party packages (`axios`, `baileys`)
3. Internal system imports (`#helper`, `../../system/services/...`)

---

## Plugin Structure

Every plugin in `user/plugins/` or `system/plugins/` exports a handler function as the default export. Structure:

```js
// Example: user/plugins/example.js

async function handler({ sock, m, jid, text, command }) {
    // ... handler logic ...
}

handler.pluginName = 'example'
handler.command = ['example', 'ex']
handler.category = ['utility']
handler.description = 'What this plugin does.'

handler.config = {
    systemPlugin: false,   // true for system/built-in plugins
    bypassPrefix: false,   // true if command works without prefix
}

handler.meta = {
    fileName: 'example.js',
    version: '1.0.0',
    author: 'YourName',
}

export default handler
```

### Handler Parameters (`HandlerParams`)

| Param | Type | Description |
|---|---|---|
| `sock` | `WASocket` | Baileys socket instance |
| `m` | `Message` | Serialized message object |
| `jid` | `string` | Chat JID (group or DM) |
| `text` | `string \| undefined` | Text after command |
| `command` | `string \| undefined` | The command that triggered this |
| `prefix` | `string \| undefined` | Prefix used (`.` or `#`) |

---

## Error Handling

- Wrap risky operations in try/catch blocks.
- Log errors with a prefixed tag: `console.error('[PLUGIN-NAME] Error:', err.message)`
- Return user-friendly error messages via `sendText(sock, jid, '❌ Error: ...', m)`.
- API services return a result object pattern:
  ```js
  return { success: true, data, ... }
  return { success: false, pesan: 'message' }
  ```

### Safe Wrapper Helpers

Use `safeRunAsync` / `safeRunSync` from `#helper` for non-critical operations that should not throw:

```js
import { safeRunAsync } from '#helper'
const result = await safeRunAsync(someAsyncFn, arg1, arg2)
if (result.ok) { /* result.data */ }
```

---

## Database

- SQLite via `sqlite` + `sqlite3` packages.
- Open DB with `sqlite.open({ filename: DB_PATH, driver: sqlite3.Database })`.
- Use `CREATE TABLE IF NOT EXISTS` for idempotent initialization.
- Use parameterized queries: `db.get('SELECT ... WHERE id = ?', [id])`.

---

## Sending Messages

- Use helpers from `#helper`:
  - `sendText(sock, jid, text, quotedMsg)` — send plain text reply.
  - `textOnlyMessage(m)` — guard to skip non-text messages.
- Always quote the original message (`{ quoted: m }` equivalent via helper).

---

## Environment Variables

- Loaded via `dotenv` — define secrets in `.env` (never commit this file).
- Access via `process.env.VARIABLE_NAME`.
- Required keys vary by service (AI_API_KEY, GITHUB_TOKEN, etc.).

---

## File Organization

```
near-bot/
├── system/              # Core bot framework
│   ├── plugins/         # Built-in system plugins
│   ├── services/        # API clients, background services
│   ├── helper/          # Utility functions
│   ├── types/           # JSDoc type definitions
│   └── handler/         # Message/presence event handlers
├── user/
│   ├── plugins/         # User-facing command plugins
│   ├── data/            # Persistent JSON stores (users, settings)
│   └── temp/            # Temporary files
├── .env                 # Secrets (gitignored)
├── package.json         # Project config (ESM)
└── launcher.js          # Entry point
```

---

## Key Conventions

- **Do NOT** add comments unless explicitly asked by the user.
- **Do NOT** commit secrets or `.env` files.
- Keep plugin handlers self-contained; share logic via `system/services/`.
- Indonesian comments/strings are common — follow existing convention per file.
- When adding a service, export named functions and return `{ success, ... }` objects.
