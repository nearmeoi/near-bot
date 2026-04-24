# GEMINI.md - near-bot Instructional Context

This file provides the foundational context and operational mandates for the `near-bot` project.

## Project Overview
`near-bot` is a sophisticated, modular WhatsApp bot built using the **baileys** library. It follows a senior-level architecture designed for stability, extensibility, and ease of maintenance.

### Key Technologies
- **Runtime:** Node.js (ES Modules)
- **WhatsApp Library:** `baileys` (WhiskeySockets fork)
- **Database:** SQLite (via `sqlite` and `sqlite3` packages)
- **AI Integration:** `@google/genai` (Gemini), OpenRouter, Groq, etc.
- **Logging:** `pino` for structured, high-performance logging.
- **Process Management:** Custom `launcher.js` for auto-restarts.

## Architecture and Design

### 1. Process Lifecycle
- **`launcher.js`**: The main entry point for the user. It spawns the bot as a child process and handles automatic restarts if the bot crashes or requests a reboot (exit code 69).
- **`index.js`**: The core application logic. It handles the WhatsApp connection, session management (pairing code/QR), event listeners (groups, contacts, participants), and initializes the shared state.

### 2. Core Managers (`system/`)
The bot uses a manager-based pattern to handle specific domains of logic:
- **`PluginManager`**: Dynamically loads and validates plugins from `system/plugins/` and `user/`. It handles command registration and menu building.
- **`UserManager`**: Manages identity and access. It maintains `trustedJids` (admins) and `blockedJids`, implementing a role-based permission system (`TRUSTED`, `AUTH`, `BLOCKED`, `NOT_ALLOWED`).
- **`PrefixManager`**: Handles command prefix detection and normalization.
- **`StateManager`**: Manages runtime states like "Locked" mode and the AFK system.

### 3. Messaging Pipeline
- **`system/serialize.js`**: Normalizes complex Baileys message objects into a simplified, developer-friendly format (`m`).
- **`system/handler/message-upsert.js`**: The heart of the bot. It processes incoming messages, checks permissions, applies "middleware" (like lock checks and AFK detection), and dispatches commands to the appropriate plugins.

### 4. Shared State
- **`system/shared-state.js`**: Implements a singleton-like pattern using Proxy objects. This allows managers and stores to be accessed globally across the codebase without creating circular dependencies.

## Development Conventions

### Plugin Structure
Plugins are exported as asynchronous functions with specific metadata attached:
```javascript
async function handler({ sock, m, q, text, jid, command, prefix }) {
    // Implementation
}
handler.pluginName = 'example';
handler.command = ['example', 'ex']; // Command triggers
handler.category = ['utility'];
handler.config = {
    bypassPrefix: false, // Whether to require a prefix
    withoutContext: false, // Run even if no command matches
};
export default handler;
```

### Key Practices
- **ES Modules:** Strictly use `import/export`.
- **Asynchronous Execution:** Use `async/await` and `try-catch` blocks for all I/O and plugin logic.
- **Surgical Logging:** Use `console.log` for process-level events and `pino` for detailed debugging.
- **Shared Helpers:** Prioritize using utilities from `system/helper.js` (e.g., `sendText`, `safeRunAsync`).

## Building and Running

### Commands
- **Install Dependencies:** `npm install`
- **Start Bot:** `npm start` (runs `launcher.js`)
- **Debug/Test:** `npm test` (runs `index.js` directly with GC exposure)

### Environment Configuration
Key variables in `.env`:
- `ADMIN_NUMBERS`: JIDs of bot administrators.
- `PAIRING_NUMBER`: The bot's WhatsApp number for pairing code login.
- `GEMINI_API_KEY`: Required for Gemini AI features.

## Security Mandates
- **Eval Plugins:** `eval.js` and `shell.js` are restricted to `trustedJids`. NEVER relax these permissions.
- **Auth Folder:** `auth/` contains sensitive session credentials. It is git-ignored and must be protected.
- **Dynamic Loading:** The `PluginManager` performs basic structure checks; however, manually review any plugins added to the `user/` directory.
