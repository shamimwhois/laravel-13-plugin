# Changelog

All notable changes to **[Laravel 13 & Modern PHP 8.6+ Antigravity Plugin](https://github.com/shamimwhois/laravel-13-plugin)** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.1.0] - 2026-11-28

### Added
- **Authoritative PHP 8.6.0 GA Syntax & Migration Overhaul** (verified live against `php.net/releases/8.6/en.php`, `php.watch/versions/8.6`, `php/php-src` `PHP-8.6/UPGRADING`, and `wiki.php.net/rfc`):
  - New **Master Architectural Guide #28**: `docs/architecture/php-8-6-modern-syntax-and-migration.md` covering every shipped PHP 8.6.0 GA RFC, full standard-library API synopses, engine/compiler optimizations, Laravel 13 integration blueprints, PHP 8.5 → 8.6 upgrade runbook, and an anti-hallucination table of declined/pending RFCs.
  - Complete overhaul of `skills/php-modern-syntax/SKILL.md` with Partial Function Application (`?` required placeholder, trailing `...` variadic placeholder, named placeholders, strict ordering & optionality rules), `clamp()` on numbers and comparable objects (`Time\Duration`, `DateTimeImmutable`), Readonly Property Defaults (single-initialization invariant), `#[Override]` on class/interface/trait constants & enum cases, Object Property Writes on Constants (`const_object_property_write`, with Octane safety warning), Debugable Enums (`__debugInfo(): array`), Parameter DocComments (`ReflectionParameter::getDocComment()`), `WeakMap` reference assignment, global `SortDirection` enum, structured Stream Error Handling (`StreamErrorMode`, `StreamErrorStore`, `StreamError`, `StreamException`, `stream_last_errors()`), Reflection additions (`isReadable`/`isWritable`, `ReflectionAttribute` namespace methods), `UriBuilder`/`UrlBuilder`, Session Security Defaults, Sodium IPcrypt/XOF/Post-Quantum KEM, and complete PHP 8.6 deprecation & BC matrix.
  - Updated `rules/AGENTS.md` (Section 1), `agents/laravel-architect.md` (Section 9), `docs/architecture/clean-code-and-concerns.md`, `docs/architecture/enums.md` (adopting native global `SortDirection`, `__debugInfo(): array`, and `#[Override]` on enum constants/cases), and `docs/architecture/namespace-import-class-standards.md`.

### Fixed
- **PHP 8.5 Clone With v2 Syntax**: Corrected invalid `clone $obj with (prop: $val)` to the shipped `clone($obj, ['prop' => $val])` syntax across `skills/php-modern-syntax/SKILL.md`, `rules/AGENTS.md`, `agents/laravel-architect.md`, `docs/architecture/clean-code-and-concerns.md`, and `README.md`.
- **Exact `Time\Duration` API**: Replaced fabricated `Duration::ofSeconds()`, `toIsoString()`, and `toSeconds()` calls with verified `Duration::fromSeconds()`, `fromIso8601DurationString()`, `static compare()`, and readonly `$seconds` / `$nanoseconds` / `$negative` properties.
- **Exact `Io\Poll\*` API**: Replaced fabricated `new Io\Poll()` / `Poll::READ` / `wait(timeoutMs: ...)` with verified `Io\Poll\Context`, global `StreamPollHandle`, `Io\Poll\Event`, `Io\Poll\Backend`, `Io\Poll\Watcher`, and `wait(timeout: Duration::fromSeconds(...), maxEvents: ...)`.
- **Exact JSON Error Location API**: Replaced fabricated `JsonException::getOffset()` with verified `json_last_error_msg()` / `JsonException::getMessage()` (`near location {line}:{column}`).
- **Zero Inline Backslashes Consistency**: Standardized `#[\Override]` and `#[\NoDiscard]` to explicit top-level `use Override;` / `use NoDiscard;` across core PHP syntax guides, `rules/AGENTS.md`, `agents/laravel-architect.md`, and `README.md`.

### Hardened (CodeRabbit CLI Review Findings Resolved)
- Updated `Io\Poll\Context::wait()` across `SKILL.md`, `php-8-6-modern-syntax-and-migration.md`, `rules/AGENTS.md`, and `CHANGELOG.md` to PHP 8.6.0 GA's shipped `wait(?Time\Duration $timeout = null, ?int $maxEvents = null): array` signature.
- Nested `error_mode` and `error_store` under `'stream' => [...]` inside `stream_context_create()` in `SKILL.md` and `rules/AGENTS.md` to prevent top-level `ValueError`.
- Kept the PHP 8.5 pipe-operator example in `SKILL.md` strictly PHP 8.5-parseable (using a closure instead of PHP 8.6 `?`).
- Fixed `Duration::add(Duration $duration)` / `sub(Duration $duration)` parameter names for named-argument compatibility and fixed class constant object initialization in `php-8-6-modern-syntax-and-migration.md` to reference a global constant instead of an unsupported class-constant `new` expression.
- Clarified in `enums.md`, `SKILL.md`, `php-8-6-modern-syntax-and-migration.md`, and `rules/AGENTS.md` that enum `__debugInfo(): array` redacts debug dumps (`var_dump()`/`dd()`), whereas Monolog JSON normalization requires separate log scrubbing.

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
