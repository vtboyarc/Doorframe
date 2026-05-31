# DOORS Next Integration Research

Status: **research / planning** (no live integration shipped yet).

IBM Engineering Requirements Management DOORS Next (DNG) is a common system of
record for regulated requirements. This note captures how Doorframe can
interoperate with it while staying local-first.

## Options

### 1. ReqIF round-trip (recommended near-term)

DOORS Next can export a module or collection as **ReqIF** (`Export → ReqIF`).
Doorframe already imports ReqIF and `.reqifz` archives, and the parser is now
type-aware (it resolves attribute definitions, enumerations, and spec
hierarchies into requirement fields and parent links).

- **Pros:** no credentials, no network, works today, matches Doorframe's
  local-first stance, round-trips status/priority/type/verification attributes.
- **Cons:** manual export step; not real-time.

This is the recommended path and needs no further engineering.

### 2. OSLC RM client (future)

DOORS Next exposes an **OSLC Requirements Management** API:

- **Service discovery:** root services document → service provider catalog →
  service provider for the target project area.
- **Auth:** Jazz form-based auth or OAuth 1.0a/2.0 depending on server config;
  enterprise deployments often sit behind Jazz Authorization Server (JAS).
- **Querying:** OSLC Query (`oslc.where`, `oslc.select`) against the query
  capability to page through requirements; each result is an RDF/XML resource
  with `dcterms:title`, `dcterms:description`, and custom attributes.
- **Linking:** OSLC links (e.g. `oslc_rm:validatedBy`) could later map onto
  Doorframe trace links.

A connector scaffold exists at `packages/integrations/src/doors-next.ts`
(`fetchDoorsNextRequirements`) with the intended typed config. It throws until
the OSLC client is built, and is intentionally not surfaced in the CLI or UI.

## Recommendation

Ship the ReqIF path now (done) and defer the OSLC client until there is concrete
demand. When built, the OSLC client should reuse the injectable `HttpClient`
abstraction so it can be unit-tested with mocked responses, like the other
connectors.
