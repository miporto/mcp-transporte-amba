# Security Hardening Plan

## Overview

This document outlines security improvements for the Cloudflare Workers deployment of the MCP Transporte AMBA server. The server is now publicly accessible and requires hardening against abuse and attacks.

**Current endpoint:** `https://mcp-transporte-amba.manu-porto94.workers.dev`

---

## 1. Current State Assessment

| Aspect | Current Status | Risk Level |
|--------|----------------|------------|
| Content-Type validation | ❌ Not validated | High |
| Request size limits | ❌ No limits | High |
| Error handling | ❌ May leak internal errors | High |
| Security headers | ❌ Missing | Medium |
| Rate limiting | ❌ None | Medium |
| CORS | ✅ Disabled (good default) | Low |
| Method validation | ✅ POST only on /mcp | Low |

---

## 2. Code-Level Changes (src/worker.ts)

### 2.1 Content-Type Validation

**Problem:** The `/mcp` endpoint accepts any content type, allowing non-JSON payloads.

**Solution:** Reject requests without `application/json` content type.

```typescript
const contentType = request.headers.get("content-type") || "";
if (!contentType.toLowerCase().includes("application/json")) {
    return new Response(
        JSON.stringify({ error: "Unsupported Media Type. Use application/json." }),
        {
            status: 415,
            headers: {
                "Content-Type": "application/json",
                "X-Content-Type-Options": "nosniff",
            },
        }
    );
}
```

### 2.2 Request Size Limit

**Problem:** No limit on request body size, allowing attackers to send large payloads.

**Solution:** Reject requests larger than 64KB (MCP JSON-RPC payloads are typically small).

```typescript
const MAX_BODY_BYTES = 64 * 1024; // 64 KB
const contentLength = request.headers.get("content-length");
if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return new Response(
        JSON.stringify({ error: "Request body too large." }),
        {
            status: 413,
            headers: {
                "Content-Type": "application/json",
                "X-Content-Type-Options": "nosniff",
            },
        }
    );
}
```

### 2.3 Error Handling

**Problem:** Unhandled exceptions may leak internal error messages or stack traces.

**Solution:** Wrap MCP handling in try/catch, return generic 500 error, log details server-side.

```typescript
try {
    // ... MCP handling code ...
} catch (err) {
    console.error("Error handling /mcp request", err);
    return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store",
            },
        }
    );
}
```

### 2.4 Security Headers

**Problem:** Responses lack security headers.

**Solution:** Add standard security headers to all JSON responses.

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `Cache-Control` | `no-store` | Prevent caching of API responses |

Apply to all endpoints: `/`, `/health`, `/mcp`, and 404 responses.

### 2.5 Consistent JSON 404 Response

**Problem:** 404 returns plain text, inconsistent with other endpoints.

**Solution:** Return JSON 404 with security headers.

```typescript
return new Response(
    JSON.stringify({ error: "Not Found" }),
    {
        status: 404,
        headers: {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
        },
    }
);
```

---

## 3. Cloudflare Dashboard Configuration

These settings are configured in the Cloudflare dashboard, not in code.

### 3.1 Rate Limiting (Recommended)

**Location:** Security → WAF → Rate limiting rules

| Setting | Value |
|---------|-------|
| Rule name | `MCP endpoint rate limit` |
| Expression | `http.request.uri.path eq "/mcp" and http.request.method eq "POST"` |
| Requests | 100 per minute |
| Per | IP address |
| Action | Block (or Managed Challenge) |
| Duration | 60 seconds |

**Rationale:** Prevents abuse of the upstream BA transit API and protects Worker CPU quota.

### 3.2 Bot Protection (Optional)

**Location:** Security → Bots

- Enable **Bot Fight Mode** (free tier)
- Consider **Super Bot Fight Mode** if abuse increases

### 3.3 Geo Restrictions (Optional)

If the service is only for Argentina-based users:

**Location:** Security → WAF → Custom rules

| Setting | Value |
|---------|-------|
| Expression | `http.request.uri.path eq "/mcp" and not ip.geoip.country in {"AR" "UY"}` |
| Action | Block or Managed Challenge |

---

## 4. Implementation Checklist

### Phase 1: Code Changes (Priority: High)

- [ ] Add Content-Type validation for `/mcp` POST requests
- [ ] Add request body size limit (64KB max)
- [ ] Wrap MCP handling in try/catch with generic error response
- [ ] Add security headers to all responses (`X-Content-Type-Options`, `Cache-Control`)
- [ ] Convert 404 response to JSON format
- [ ] Run tests, lint, and type-check
- [ ] Deploy to production

### Phase 2: Cloudflare Configuration (Priority: Medium)

- [ ] Create rate limiting rule for `/mcp` endpoint
- [ ] Enable Bot Fight Mode
- [ ] (Optional) Add geo-restriction rule

### Phase 3: Monitoring (Priority: Low)

- [ ] Review Workers analytics for unusual traffic patterns
- [ ] Adjust rate limits based on observed usage
- [ ] Set up alerting for high error rates (if needed)

---

## 5. Future Considerations

These are **not needed now** but may be relevant if the service grows:

| Feature | When to Consider |
|---------|------------------|
| API key authentication | If you need to track/limit specific clients |
| Per-client rate limits | If different clients need different quotas |
| Request schema validation | If you see malformed JSON-RPC abuse |
| Cloudflare API Shield | For advanced API monitoring and protection |

---

## 6. Files Modified

| File | Changes |
|------|---------|
| `src/worker.ts` | Add validation, error handling, security headers |
| Cloudflare Dashboard | Rate limiting rule, bot protection |

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Rate limits too aggressive | Start conservative (100/min), monitor and adjust |
| Legitimate large requests blocked | 64KB is generous for MCP; increase if needed |
| Geo-blocking blocks valid users | Only enable if abuse comes from specific regions |
