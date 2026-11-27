# Changelog

All notable changes to **[Laravel 13 & Modern PHP 8.6+ Antigravity Plugin](https://github.com/shamimwhois/laravel-13-plugin)** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] - 2026-11-27

### Added
- **Merged [`shamimwhois/laravel-security-guard`](https://github.com/shamimwhois/laravel-security-guard)** directly into `laravel-13-plugin`:
  - **Active `PreToolUse` Security Guard Hook** (`hooks.json` + `scripts/pre-write-guard.mjs`) inspecting Laravel PHP, Blade, `.env*`, and proxy `.conf` edits across 19 vulnerability classes plus `#19b HTTPS / TLS Verification Disabled` (`withoutVerifying()`, `verify => false`, `CURLOPT_SSL_VERIFYPEER => false`), hardened with canonical `path.resolve` + `path.relative` allow-list containment checks.
  - **Zero-Dependency 19-Point + TLS Static Security Scanner** (`skills/laravel-security-guard/scripts/laravel-security-scan.mjs`) with `--json`, `--fail-on-high`, and `--category=<slug>` CLI modes.
  - **Dedicated AppSec Subagent** (`agents/laravel-security-auditor.md`) alongside upgraded `agents/laravel-architect.md`.
  - **4 Security Skills**: `laravel-security-guard`, `laravel-injection-and-input-guard`, `laravel-auth-and-access-guard`, `laravel-edge-and-supply-chain-guard`, plus `references/pest-security-tests.md` and `assets/logo.svg`.
- **Error Handling, Error Pages & HTTP/HTTPS Transport Error Components**:
  - New Skill `skills/laravel-error-handling-and-pages/SKILL.md` and Master Guide `docs/architecture/error-handling-pages-and-components.md`.
  - Unified Laravel 13 `bootstrap/app.php` `withExceptions()`, RFC 7807 `ProblemDetailsFactory`, ULID `X-Request-Id` Trace IDs, strict `Cache-Control: no-store, private` on `4xx`/`5xx`, zero stack-trace exposure in production.
  - Complete custom Error Pages (`400, 401, 402, 403, 404, 419, 422, 429, 500, 502, 503, 504`) across Blade, Livewire v3/v4, and Inertia.js v2 (Vue 3 TS, React 19 TS, Svelte 5 Runes) with zero-DB-query discoverable error layout (`resources/views/components/layouts/error.blade.php`).
  - Reusable UI validation & boundary error components (`field`, `summary`, `inline-fallback`, React `ErrorBoundary`, Svelte `<svelte:boundary>`) and dedicated **HTTP & HTTPS Transport Error Components** (`http-status`, `https-transport`, `EnsureHttpsRequest` `426`/`308` middleware, live `429` retry countdown, `419` CSRF refresh, offline/TLS alerts).
- **Resilient Request Handling & Cache Handling**:
  - New Skill `skills/laravel-request-and-cache-handling/SKILL.md` and Master Guide `docs/architecture/request-and-cache-resilience.md`.
  - Inbound pipeline: `AttachRequestContextMiddleware`, strict Form Requests + DTOs, authoritative DB-backed `EnforceIdempotencyKeyMiddleware` (authenticated user scoping + `2xx` replay), tiered `RateLimiter`, `TrustProxies` $\rightarrow$ `TrustHosts` $\rightarrow$ `AttachRequestContext` $\rightarrow$ `EnsureHttpsRequest` ordering.
  - Outbound resilience: `Http::resilient()` macro with timeouts/jittered retries, transient-status-aware `CircuitBreaker` with atomic `Cache::add()` counter initialization, strict TLS verification, and parser-differential-safe `SafeHttpClient` with multi-IP `CURLOPT_RESOLVE` pinning.
  - Resilient caching: Laravel 13 `failover` cache store reserved for recomputable cached data, `ResilientCache` preserving callback exceptions without double invocation, eviction/race-safe ULID `TenantCacheKey`, and HTTP `Cache-Control` / `ETag` / `no-store` policies.
- **Always-On Rules (`rules/AGENTS.md`)**: Upgraded Section 13 to all 19 mandatory security guardrails and added Section 25 (Error Handling/Pages & HTTP/HTTPS Components) and Section 26 (Resilient Request & Cache Handling).
- **Repository Hygiene**: Added `CHANGELOG.md` and `.github/pull_request_template.md`.

### Hardened (CodeRabbit CLI Review Findings Resolved)
- Separated authoritative idempotency storage (`Cache::store('database')`) from best-effort `failover` cache reads and limited replay caching to `2xx` responses with authenticated user scoping.
- Fixed middleware ordering so `TrustProxies` and `TrustHosts` execute before `AttachRequestContextMiddleware` and `EnsureHttpsRequest`.
- Hardened `CircuitBreaker` to initialize counters atomically via `Cache::add($failKey, 0, ...)` and ignore non-transient client `400`/`404`/`422` errors.
- Fixed `ResilientCache::flexible()` and `ResilientCache::withLock()` so exceptions thrown inside the inner callback propagate rather than double-invoking or falling back to `$onTimeout()`.
- Made `TenantCacheKey` eviction- and race-safe using a non-evicting authoritative store, lock-serialized updates, and ULID generation tokens.
- Placed Blade error layout at discoverable `resources/views/components/layouts/error.blade.php` and serialized `$resolvedTrace` in Alpine attributes with `Js::from()`.
- Hardened `SafePath::safeExtractZip()` against ZIP symlink attacks (`getExternalAttributesIndex`) while permitting legitimate filenames containing `..`.
- Hardened `SafeHttpClient` to reconstruct canonical URLs from validated components and pin all validated A/AAAA IPs in `CURLOPT_RESOLVE`.
- Hardened `scripts/pre-write-guard.mjs` allow-lists using `path.resolve()` + `path.relative()` containment checks and expanded written-text key extraction with stderr diagnostics.

---

## [2.17.0] - 2026-11-19
- Added `laravel-frontend-design-craft` skill, Master Guide (`frontend-design-craft-and-anti-ai-slop.md`), and Rule Section 24 synthesizing Impeccable, Taste Skill, and Hallmark anti-AI-slop standards.

## [2.16.0] - 2026-11-19
- Added `laravel-database-architecture` skill, Master Guide (`database-schema-design-and-indexing.md`), and Rule Section 23 covering PHP 8 model attributes, typed relationship generics, ULID PKs, FK cascades, ESR composite indexing, and `pgvector` HNSW.

## [2.15.0] - 2026-11-18
- Hardened `laravel-payment-gateways` with replay defense ($\pm 300\text{s}$ window + Redis nonces), double-entry ledgers, payment FSM guards, Monolog PCI card scrubbers, and zero-float integer cents.

## [2.14.0] - 2026-11-18
- Added `laravel-payment-gateways` skill, Master Guide, and Rule Section 22 covering Top 10 payment gateways (Stripe, bKash Tokenized Checkout, Binance Pay Crypto, PayPal, Razorpay, Paddle, Mollie, Adyen, Square, SSLCommerz).
