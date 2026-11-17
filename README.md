# @nqhd3v/coros-connect

Connect to the [COROS](https://coros.com) MCP server (`https://mcpus.coros.com/mcp`) and query your health and training data — sleep, HRV, training load, activities, workouts, and more.

`coros-connect` wraps the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and handles the OAuth flow (dynamic client registration, PKCE, token refresh) for you.

You can try this: https://github.com/nqhd3v/coros-connect-example

## Install

```bash
npm install @nqhd3v/coros-connect
# or
yarn add @nqhd3v/coros-connect
```


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
| `login(): Promise<URL>` | Registers the client (if needed) and returns the COROS authorization URL to open. Uses its own connection, so an open session stays open. Throws if COROS is already connected. |
| `verifyLoginCode(code)` | Exchanges the `code` from the redirect for tokens. |
| `connect(): Promise<Client>` | Opens an MCP session using stored tokens. Throws `UnauthorizedError` if a new login is needed. |
| `tools()` | Lists available COROS tools (`name`, `description`, `inputSchema`). |
| `useTool(name, args)` | Calls a COROS tool and returns the MCP result. |
| `close()` | Closes the MCP session. |
| `availableTools` | Tools that have a typed method below: `{ tools, handler }`, where `handler` maps a tool name to its method name. |

### Typed queries

These call a COROS tool and parse its text response into an object. Call `connect()` first.

| Method | COROS tool | `parsed` type |
| --- | --- | --- |
| `getUserInfo()` | `queryUserInfo` | `CorosUserInfo` |
| `getDevices()` | `queryDevices` | `CorosDeviceParsed[]` |
| `getDailyHealthData(days?)` | `queryDailyHealthData` | `CorosDailyHealthParsed` |
| `getRecoveryStatus()` | `queryRecoveryStatus` | `CorosRecoveryStatus` |
| `getTrainingSchedule({ startDate?, endDate? })` | `queryTrainingSchedule` | `CorosTraining[]` |

Every method resolves to the same shape:

```ts
{
  parsed: T | null;    // null when the response is not in the expected format
  originalData: CorosToolResult; // raw MCP result, for anything the parser does not cover
}
```

## Notes

- **Tool names & arguments** come from the COROS MCP server. Call `coros.tools()` to see the current list and each tool's `inputSchema`.
- **Parsed results** depend on the text format COROS returns. If COROS changes it, `parsed` may be `null` or miss fields — `originalData` always has the raw response.
- **Token refresh** is automatic; `onCredentials` fires with the new tokens so you can persist them.
- **Expired / revoked credentials** are cleared automatically, and `connect()` throws — call `login()` again.

## License

ISC
