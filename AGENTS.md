# AGENTS.md

This file contains guidelines for agentic coding working on the mcp-transporte-amba repository.

## Commands

### Development
```bash
bun install              # Install dependencies
bun run dev             # Watch mode for development
bun run start           # Run the server
```

### Code Quality
```bash
bun run lint            # Run oxlint linter (fix auto-fixable issues)
bun run type-check      # TypeScript type checking (noEmit)
```

### Testing
```bash
bun run test            # Run all tests once
bun run test:watch      # Run tests in watch mode
```

### Run Single Test
```bash
# Run a specific test file
vitest run src/client/BAClient.test.ts

# Run tests matching a pattern
vitest run -t "getArrivals"
vitest run --reporter=verbose src/client/BAClient.test.ts
```

**IMPORTANT**: After completing any coding task, run `bun run lint` and `bun run type-check` to ensure code quality.

## Code Style Guidelines

### File Structure
- Organize by domain: `client/`, `server/`, `transport/`
- Keep types in `types.ts` files alongside implementation
- Test files: `<filename>.test.ts` next to implementation
- Use `index.ts` for public API exports in each directory

### Imports
- Always use `.js` extension for imports (required by `verbatimModuleSyntax`)
- Import types first, then values
- Use `import type { ... }` for type-only imports
- Example:
  ```ts
  import type { Arrival, Station } from "./types.js";
  import { BAClient } from "./BAClient.js";
  ```

### Types
- Strong typing required (strict mode enabled)
- Use Zod schemas for runtime validation
- Define types in separate `types.ts` files
- Use `as const` for readonly configuration objects
- Example:
  ```ts
  export const TOOLS = {
    get_arrivals: { name: "get_arrivals", ... }
  } as const;
  ```

### Naming Conventions
- **Classes**: PascalCase (`BAClient`)
- **Interfaces**: PascalCase (`Arrival`, `Station`)
- **Functions/Methods**: camelCase (`getArrivals`, `buildUrl`)
- **Variables**: camelCase (`clientId`, `subteData`)
- **Constants**: SCREAMING_SNAKE_CASE (`SUBTE_ROUTE_MAP`, `DEFAULT_BASE_URL`)
- **Private methods**: Use `private` keyword explicitly
- **Type definitions**: PascalCase with `type` or `interface` keywords

### Error Handling
- Throw `Error` objects with descriptive messages
- Always check `response.ok` status before parsing
- Validate `content-type` headers for JSON responses
- Wrap JSON parsing in try-catch blocks
- Example:
  ```ts
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  ```

### Comments
- JSDoc-style file headers at top of every file
- Keep comments concise and relevant
- Use `//` for inline explanations
- Don't comment obvious code
- Example:
  ```ts
  /**
   * BAClient - API client for GCBA Unified Transit API
   *
   * Handles authentication and fetches real-time transit data
   */

  // Fetch subte GTFS-RT forecast data
  private async fetchSubteForecasts(): Promise<GCBASubteForecastResponse> {
  ```

### Testing
- Use vitest with `describe`/`it` structure
- Mock global `fetch` with `vi.fn()` and `@ts-expect-error`
- Create helper functions for mock responses
- Test both happy paths and error cases
- Example:
  ```ts
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - mocking global fetch
    globalThis.fetch = mockFetch;
  });
  ```

### Formatting
- Use 4 spaces indentation (Oxlint default)
- No trailing whitespace
- Use semicolons
- Prefer single quotes for strings
- Max line length: unspecified but keep readable

### TypeScript Config
- Target: ESNext
- Module: Preserve (for Bun)
- Strict mode enabled
- `verbatimModuleSyntax`: true
- `noUncheckedIndexedAccess`: true
- `noUnusedLocals` and `noUnusedParameters`: true
- Paths: `@/*` maps to `src/*`

### Linting (Oxlint)
- `no-unused-vars`: warn (not error)
- `no-console`: off (allowed)
- `eqeqeq`: error (use ===/!==)
- Run `bun run lint` before committing

## Patterns

### Constants
Define at top of file, after imports:
```ts
const DEFAULT_BASE_URL = "https://apitransporte.buenosaires.gob.ar";
const SUBTE_ROUTE_MAP: Record<string, TransitLine> = { ... };
```

### Async/Await
Always use `async/await` over Promises
Include return type annotations: `Promise<Arrival[]>`

### Null Checks
Use optional chaining (`?.`) and nullish coalescing (`??`)
Example: `data.entity ?? []`

### Map/Filter
Use Array methods over for-loops when appropriate
Keep transformations readable

## Environment Variables
Required: `BA_CLIENT_ID`, `BA_CLIENT_SECRET`
Optional: `TRANSPORT` (stdio/http), `PORT` (3000), `BA_API_URL`

See `.env.example` for template.
