# @nqhd3v/coros-connect

Connect to the [COROS](https://coros.com) MCP server (`https://mcpus.coros.com/mcp`) and query your health and training data — sleep, HRV, training load, activities, workouts, and more.

`coros-connect` wraps the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and handles the OAuth flow (dynamic client registration, PKCE, token refresh) for you. You only need to:

1. Send the user to a COROS login URL.
2. Exchange the `code` COROS sends back to your redirect URL.
3. Persist the credentials you receive, and pass them back next time.

Works in **Node.js** and in the **browser** (React, Vue, plain JS).

## Install

```bash
npm install @nqhd3v/coros-connect
# or
yarn add @nqhd3v/coros-connect
```

ESM only (`"type": "module"`, `.mjs`, or any modern bundler).

## API

```ts
import CorosConnect from "@nqhd3v/coros-connect";

const coros = new CorosConnect({
  redirect: "http://localhost:3000/callback", // OAuth redirect URI
  credentials,   // optional: { clientInfo, tokens, codeVerifier } saved earlier
  onCredentials, // optional: called whenever credentials change — persist them here
});
```

| Method | Description |
| --- | --- |
| `login(): Promise<URL>` | Registers the client (if needed) and returns the COROS authorization URL to open. Throws if COROS is already connected. |
| `verifyLoginCode(code)` | Exchanges the `code` from the redirect for tokens. |
| `connect(): Promise<Client>` | Opens an MCP session using stored tokens. Throws `UnauthorizedError` if a new login is needed. |
| `tools()` | Lists available COROS tools (`name`, `description`, `inputSchema`). |
| `useTool(name, args)` | Calls a COROS tool and returns the MCP result. |
| `close()` | Closes the MCP session. |

### Credentials

`onCredentials` receives `{ clientInfo, tokens, codeVerifier }`. Save the whole object and pass it back as `credentials` when you create a new instance.

`codeVerifier` is the PKCE secret created by `login()`. It is included so a login can be finished by a **different instance** — after a page reload in the browser, or on another server process. It is cleared once tokens are issued.

### Crypto helpers (Node.js only)

For encrypting credentials at rest on a server, import from the `/crypto` subpath. It uses `node:crypto`, so it is kept out of the main entry and never ends up in browser bundles.

```ts
import { encrypt, decrypt, randomToken, sha256, secretsMatch } from "@nqhd3v/coros-connect/crypto";
```

`encrypt` / `decrypt` use AES-256-GCM with a 32-byte base64 key — generate one with `openssl rand -base64 32`.

---

## Example

A CLI script that logs in once, saves the credentials to an encrypted file, and reuses them afterwards.

```js
// coros.mjs
import http from "node:http";
import fs from "node:fs/promises";
import CorosConnect from "@nqhd3v/coros-connect";
import { encrypt, decrypt } from "@nqhd3v/coros-connect/crypto";

const REDIRECT = "http://localhost:8787/callback";
const CREDENTIALS_FILE = "./coros-credentials.enc";
const SECRET = process.env.ENCRYPTION_KEY; // openssl rand -base64 32

async function loadCredentials() {
  try {
    const payload = await fs.readFile(CREDENTIALS_FILE, "utf8");
    return JSON.parse(decrypt(payload, SECRET));
  } catch {
    return undefined;
  }
}

async function saveCredentials(credentials) {
  await fs.writeFile(CREDENTIALS_FILE, encrypt(JSON.stringify(credentials), SECRET));
}

// Wait for COROS to redirect back with ?code=...
function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT);
      const code = url.searchParams.get("code");
      res.end(code ? "Connected to COROS. You can close this tab." : "Missing code");
      server.close();
      code ? resolve(code) : reject(new Error("No code in redirect"));
    });
    server.listen(new URL(REDIRECT).port);
  });
}

const coros = new CorosConnect({
  redirect: REDIRECT,
  credentials: await loadCredentials(),
  onCredentials: saveCredentials,
});

try {
  await coros.connect();
} catch {
  const url = await coros.login();
  console.log("Authorize URL:", url.href);
  const code = await waitForCode();
  await coros.verifyLoginCode(code);
  await coros.connect();
}

try {
  const tools = await coros.tools();
  console.log("Tools:", tools.map((t) => t.name));

  const user = await coros.useTool("queryUserInfo", {});
  console.log(user.content);
} finally {
  await coros.close();
}
```

```bash
ENCRYPTION_KEY="$(openssl rand -base64 32)" node coros.mjs
```

> Keep `ENCRYPTION_KEY` stable between runs, otherwise the saved credentials can't be decrypted.

---

## Notes

- **Tool names & arguments** come from the COROS MCP server. Call `coros.tools()` to see the current list and each tool's `inputSchema`.
- **Token refresh** is automatic; `onCredentials` fires with the new tokens so you can persist them.
- **Expired / revoked credentials** are cleared automatically, and `connect()` throws — call `login()` again.

## License

ISC
