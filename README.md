# BA-Transit MCP

MCP server providing real-time transit information for Buenos Aires Metropolitan Area (Subte + Trains).

## Quick Start

```bash
# Install dependencies
bun install

# Run with stdio (for IDEs like Claude Desktop, VSCode, etc.)
BA_CLIENT_ID=your_id BA_CLIENT_SECRET=your_secret bun run start

# Or run with HTTP transport
BA_CLIENT_ID=your_id BA_CLIENT_SECRET=your_secret TRANSPORT=http PORT=3000 bun run start
```

## MCP Tools

### `get_arrivals`
Query real-time arrivals at a station.

```json
{
  "station": "Retiro",
  "line": "Mitre",
  "limit": 5
}
```

### `get_status`
Get service status and alerts.

```json
{
  "type": "subte"
}
```

## Coverage

- **Subte**: Lines A, B, C, D, E, H, Premetro
- **Trains**: Mitre, Sarmiento, Roca, San Martín, Belgrano Sur, Belgrano Norte

## Development

```bash
bun run lint       # Run linter
bun run type-check # Check types
bun run test       # Run tests
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `BA_CLIENT_ID` | Yes | GCBA API client ID |
| `BA_CLIENT_SECRET` | Yes | GCBA API client secret |
| `TRANSPORT` | No | `stdio` (default) or `http` |
| `PORT` | No | HTTP port (default: 3000) |

Get API credentials at [data.buenosaires.gob.ar](https://data.buenosaires.gob.ar).

## License

MIT
