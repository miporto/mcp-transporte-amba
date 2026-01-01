---
title: Train system design and implementation (SOFSE)
---

# Train system design and implementation (SOFSE)

This document describes the **current** design and implementation used by this repository to obtain and present Buenos Aires metropolitan **train** information.

## Data sources

### SOFSE (Trenes Argentinos) API

- Used for **all train data** (infrastructure, arrivals, and service status).
- Implemented in `src/client/sofse/SOFSEClient.ts`.
- Base URL: `https://api-servicios.sofse.gob.ar/v1`.

Core endpoints currently used:

- `POST /auth/authorize` (token)
- `GET /infraestructura/gerencias?idEmpresa=1` (train “lines”)
- `GET /infraestructura/ramales?idGerencia=<lineId>` (ramales for a line)
- `GET /infraestructura/estaciones?nombre=<query>` (station search)
- `GET /infraestructura/estaciones?idRamal=<ramalId>` (stations for a ramal)
- `GET /arribos/estacion/<stationId>?cantidad=<n>&ramal=<ramalId?>` (arrivals)

### GCBA API

- **Not used for trains**.
- Still used for **subte** (GTFS-RT forecast + alerts).

## Domain model mapping

SOFSE’s model is hierarchical:

```
Empresa (idEmpresa=1 for AMBA)
  └─ Línea (SOFSE: Gerencia)
      └─ Ramal (branch)
          └─ Estación
```

Repository naming conventions:

- **`line`** (tool/user-facing) = SOFSE **gerencia** (e.g. “Mitre”, “Roca”).
- **`ramalId`** = SOFSE **ramal** identifier.
- **`stationId`** = SOFSE station identifier.

Key types:

- `TrainLineInfo`, `TrainRamalInfo`, `TrainStationCandidate` in `src/client/types.ts`.
- Train-specific arrival metadata is included in `Arrival` as optional fields:
  - `ramalId`, `ramalName`, `platform`, `status`, `inTravel`.
- Train statuses can optionally include per-ramal breakdown via `LineStatus.ramales`.

## Client architecture

### `SOFSEClient` (low-level HTTP + auth)

File: `src/client/sofse/SOFSEClient.ts`

- Maintains an in-memory SOFSE auth token (`token` + `tokenExpiration`).
- Auth flow:
  - Generates credentials using `generateCredentials()`.
  - Calls `POST /auth/authorize`.
  - Parses JWT `exp` to compute expiration; falls back to `+1h`.
- Request flow:
  - Adds `Authorization: <token>` header.
  - Validates `content-type` includes `application/json`.
  - If it receives `403` once, it clears token and retries exactly once.

### `BAClient` (domain-level aggregation)

File: `src/client/BAClient.ts`

`BAClient` is the main entrypoint used by MCP handlers.

#### Train network index (line↔ramal mapping)

- Built and cached in-memory via `getTrainIndex()`.
- TTL: `TRAIN_INDEX_TTL_MS = 15 minutes`.
- Contents:
  - `ramalIdToLine: Map<number, TrainLine>`
  - `ramalIdToRamalName: Map<number, string>`
  - `ramalIdsByLine: Map<TrainLine, number[]>`
  - `lineIdByLine: Map<TrainLine, number>`

How it is built:

1. Fetch all gerencias (`getGerencias`).
2. Filter to known AMBA lines using `SOFSE_LINE_MAP` + `TRAIN_LINES`.
3. For each line, fetch all ramales (`getRamales(lineId)`) and fill maps.

Notes:

- This removes the previous brittle approach of hardcoding a `ramalId → line` mapping.
- The initial index build is potentially expensive (N+1 requests); the TTL reduces repeated work.

#### Station search and disambiguation

- `searchTrainStations({ query, line?, ramalId?, limit? })`
  - Calls SOFSE station search.
  - Normalizes strings using `normalizeStationString`.
  - Filters candidates by:
    - `ramalId` membership (`station.incluida_en_ramales.includes(ramalId)`)
    - `line` membership (intersection of `incluida_en_ramales` with `ramalIdsByLine[line]`).
- `resolveTrainStation({ station, line?, ramalId? })`
  - Returns a single station if uniquely resolvable.
  - Otherwise returns `issues[]` + `candidates[]` for explicit disambiguation.

Important behavior difference:

- `BAClient.getArrivals()` (generic subte+train method) will return **no train arrivals** on ambiguity because it currently drops unresolved station queries (it does not surface the issues).
- The MCP tool `get_train_arrivals` *does* surface ambiguity and candidates to the user/agent.

#### Train arrivals

- Deterministic entrypoint: `BAClient.getTrainArrivals({ stationId, line?, ramalId?, direction?, limit? })`.
- Calls SOFSE `GET /arribos/estacion/<stationId>` with:
  - `cantidad = limit`
  - optional `ramal = ramalId`
- Uses the train index to map `arribo.ramal_id → line` and enrich:
  - `ramalName` (prefer index name, fallback to SOFSE payload `ramal_nombre`)
  - `platform` (SOFSE `anden`)
  - `status` (SOFSE `estado`)
  - `inTravel` (SOFSE `en_viaje`)

Time handling:

- Parses `hora_llegada` (`HH:MM`/`HH:MM:SS`) into a `Date`.
- If the computed time is earlier than now, it assumes the arrival is **tomorrow**.
- `delaySeconds` is currently always `0` for trains.

Direction filtering:

- If `direction` is provided, it is matched by normalized substring against `destino`/`cabecera`.

#### Train status (line + optional ramal breakdown)

- `BAClient.getTrainStatus({ line?, includeRamales? })`.
- Gerencia (line) status:
  - `isOperational = gerencia.estado.id !== 1` (current heuristic)
  - Alerts come from `gerencia.alerta`.
- Ramal status (optional):
  - Fetched via `getRamales(gerenciaId)`.
  - `isOperational = ramal.operativo === 1`.
  - Alerts come from `ramal.alerta`.

## MCP tools (presentation layer)

Files:

- Schemas/metadata: `src/server/tools.ts`
- Handlers/formatting: `src/server/mcp.ts`

### Discovery tools

- `list_train_lines` → `BAClient.listTrainLines()`
  - Schema includes `empresaId` (defaults to 1) but the handler currently ignores it.
- `list_train_ramales` → `BAClient.listTrainRamales({ line | lineId })`
- `list_train_stations` → `BAClient.listTrainStations(ramalId)`
- `search_train_stations` → `BAClient.searchTrainStations({ query, line?, ramalId?, limit })`

### Train arrivals tool

- `get_train_arrivals`
  - Recommended input: `stationId` (optionally `ramalId`).
  - If only `station` is provided, the handler uses `resolveTrainStation()` and:
    - returns candidates on ambiguity
    - returns an error-style message when no matches exist

### Train status tool

- `get_train_status`
  - Defaults `includeRamales = true` when `line` is provided.
  - Otherwise can include ramales via `includeRamales: true`.

### Formatting

- Arrivals output includes line + optional ramal name and platform:
  - `• Mitre / Retiro - Tigre → Tigre: 5 min (andén 1)`
- Status output includes per-line status, alert details, and optional per-ramal lines.

## Operational considerations and limitations

1. **Index build cost**: `getTrainIndex()` fetches gerencias + ramales per line; first call after TTL expiry can be slow.
2. **Ambiguity handling**: only `get_train_arrivals` surfaces disambiguation; `BAClient.getArrivals()` silently drops ambiguous train queries.
3. **Mixed language UX**: subte resolver messages are Spanish; some train tool outputs are English.
4. **`empresaId` is not actually parameterized**: the tool accepts it, but `SOFSEClient.getGerencias()` is hardcoded to `idEmpresa=1`.
5. **Operational heuristic**: `gerencia.estado.id !== 1` is a heuristic; if SOFSE semantics differ, operational flags may invert.
6. **Delay modeling**: train delays are not computed; `delaySeconds=0` even if SOFSE indicates disruption via `estado`/alerts.

## Test coverage

- Train tool schemas are covered in `src/server/tools.test.ts`.
- SOFSE auth/client behavior is covered in `src/client/sofse/SOFSEClient.test.ts`.
- Train arrival mapping via index is covered in `src/client/BAClient.test.ts` (ramal→line mapping derived from live index build, not hardcoded).
