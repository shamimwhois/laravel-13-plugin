# Changelog

All notable changes to **[Laravel 13 & Modern PHP 8.6+ Antigravity Plugin](https://github.com/shamimwhois/laravel-13-plugin)** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.2.0] - 2026-11-28

### Added
- **Authoritative Inertia.js v3 Upgrade (`@inertiajs/*` v3.11.0 & `inertiajs/inertia-laravel` v3.8.0)** (verified live against `inertiajs.com/docs/v3/*`, `inertiajs/inertia` `v3.11.0`, and `inertiajs/inertia-laravel` `v3.8.0`):
  - Complete overhaul of `skills/laravel-inertia-spa/SKILL.md` and Master Architectural Guide `docs/architecture/inertia-and-frontend-stacks.md` covering `@inertiajs/vite` zero-config setup & out-of-the-box Dev SSR (Vite 7/8, Node 22+ prod SSR, ES2022 ESM-only), built-in XHR client & `http.onRequest/onResponse/onError` interceptors (Axios, `qs`, and `lodash-es` removed; optional `axiosAdapter()`), standalone `useHttp()` hook, first-class Optimistic Updates with automatic partial-key rollback, Instant Visits (`component` / Wayfinder `instant`), Persistent Layouts & Layout Props (`setLayoutProps()`, `resetLayoutProps()`, `[Layout, props]`, React `[ArrowLayout]` wrapper rule), `<Form>` component with built-in Precognition (`createForm<T>()`, `<Form<T>>`, `useFormContext<T>()`), `<Deferred>` (`#rescue` slot with `Inertia::defer(..., rescue: true)`), `Inertia::optional()`, `Inertia::once()`/`shareOnce()`, `Inertia::scroll()` + `<InfiniteScroll>`, `<WhenMounted>`, `usePoll()` (`mode`, `background`, `polling`), `QUERY` HTTP method, Live Props (`Inertia::live()` + `Inertia::broadcastProps()` + `echo()`/`pusher()`/`actionCable()` + `useProp()`), `Inertia::flash()`/`forgetFlashed()` (preserved across `Inertia::location()` in v3.8.0), `preserveBigIntegers()`, `<x-inertia::head>` (with SSR fallback slot) & `<x-inertia::app />` Blade components, `Inertia::handleExceptionsUsing()`, `config/inertia.php` v3.8.0 reference, Pest 3 assertions (`loadDeferredProps()`, `hasFlash()`, `assertInertiaFlash()`), and complete **Inertia v2 → v3** upgrade & anti-hallucination checklist.
  - Updated `rules/AGENTS.md` (Sections 18, 19, 25), `skills/laravel-error-handling-and-pages/SKILL.md`, `docs/architecture/error-handling-pages-and-components.md`, `docs/architecture/blade-and-livewire.md`, `docs/architecture/frontend-layouts-components-and-pages.md`, `skills/laravel-best-practices/SKILL.md`, `skills/laravel-frontend-design-craft/SKILL.md`, `skills/laravel-frontend-layouts-and-pages/SKILL.md`, `plugin.json` (`3.2.0`), `README.md`, and refreshed `assets/banner.png` (`v3.2.0`, `Inertia v3`).

### Fixed
- Replaced removed Inertia v2 `Inertia::lazy()` with `Inertia::optional()` in `skills/laravel-inertia-spa/SKILL.md`.
- Replaced renamed Inertia v2 client event `router.on('exception', ...)` with verified Inertia v3 `router.on('networkError', ...)` and `router.on('httpException', ...)` in `skills/laravel-error-handling-and-pages/SKILL.md`.
- Removed dropped React 18 references across Inertia v3 docs and rules (React 19+ and Svelte 5+ strictly required in Inertia v3).

### Hardened (CodeRabbit CLI Review Findings Resolved — 10/10)
- Replaced string channel names with `new PrivateChannel("team.{$teamId}")` in `Inertia::live()` examples (since Inertia v3.8 treats string channels as public) and added `configureEcho({ broadcaster: 'reverb' })` before `live: echo()`.
- Guarded `document.querySelector(...)` CSP nonce lookup with `typeof document !== 'undefined'` for `@inertiajs/vite` SSR execution, and moved `prefetch: { cacheFor: '1m' }` into `createInertiaApp({ defaults: ... })` so initialization does not reset it.
- Corrected the history encryption middleware alias to `'inertia.encrypt'`, removed React-only `strictMode` from the Vue `@inertiajs/vue3` bootstrap example, consumed the CSV `download_url` response in the Svelte 5 `useHttp` example, scoped optimistic note updates to `notesCount` instead of `pendingCount`, and added `Team`/`RevenueMetric` fixtures + `user.name` assertions to Pest 3 deferred-prop tests.

---

## [3.1.0] - 2026-11-28

### Added
- **Authoritative PHP 8.5.0 GA & PHP 8.6.0 GA Syntax & Cumulative Migration Overhaul** (verified live against `php.net/releases/8.5/en.php`, `php.net/releases/8.6/en.php`, `php.watch/versions/8.5`, `php.watch/versions/8.6`, `php/php-src` `PHP-8.5/UPGRADING` & `PHP-8.6/UPGRADING`, and `wiki.php.net/rfc`):
  - New **Master Architectural Guide #28**: `docs/architecture/php-8-6-modern-syntax-and-migration.md` covering every shipped PHP 8.5.0 GA and PHP 8.6.0 GA feature, full standard-library API synopses (`Uri\Rfc3986\Uri`, `Uri\WhatWg\Url`, `Time\Duration`, `Io\Poll\*`, `StreamError*`), engine/compiler optimizations, Laravel 13 integration blueprints, a cumulative **PHP 8.4 → 8.5 → 8.6** upgrade runbook, and an anti-hallucination & version-boundary table.
  - Complete overhaul of `skills/php-modern-syntax/SKILL.md`:
    - **PHP 8.6.0 GA**: Partial Function Application (`?` required placeholder, trailing `...` variadic placeholder, named placeholders, strict ordering & optionality rules), `clamp()` on numbers and comparable objects (`Time\Duration`, `DateTimeImmutable`), Readonly Property Defaults (single-initialization invariant), `#[Override]` on class/interface/trait constants & enum cases, Object Property Writes on Constants (`const_object_property_write`, with Octane safety warning), Debugable Enums (`__debugInfo(): array`), Parameter DocComments (`ReflectionParameter::getDocComment()`), `WeakMap` reference assignment, global `SortDirection` enum, structured Stream Error Handling (`StreamErrorMode`, `StreamErrorStore`, `StreamError`, `StreamException`, `stream_last_errors()`), Reflection additions (`isReadable`/`isWritable`, `ReflectionAttribute` namespace methods), `UriBuilder`/`UrlBuilder`, Session Security Defaults, Sodium IPcrypt/XOF/Post-Quantum KEM, and complete PHP 8.6 deprecation & BC matrix.
    - **PHP 8.5.0 GA**: Pipe Operator (`|>`, exact precedence, parenthesized RHS arrow-function/`??`/`?:` rules, by-ref constraints), Clone With v2 (`clone($obj, [...])`, `__clone()` execution order, `clone(...)` FCC, `readonly` unlocking & visibility enforcement), `#[NoDiscard]` + statement-only `(void)` cast (`T_VOID_CAST`), `#[DelayedTargetValidation]`, `#[Override]` on properties, `#[Deprecated]` on traits & compile-time non-class constants, attributes on constants, `final` constructor property promotion, asymmetric visibility for static properties, static closures/FCCs/casts in constant expressions, native `Uri\Rfc3986\Uri` & `Uri\WhatWg\Url` extension, `array_first()`/`array_last()`, `Closure::getCurrent()`, `get_error_handler()`/`get_exception_handler()`, `FILTER_THROW_ON_FAILURE`, `IntlListFormatter`, `Locale::isRightToLeft()`, `grapheme_levenshtein()`, `curl_multi_get_handles()`, `curl_share_init_persistent()`, `Pdo\Sqlite::setAuthorizer()`, `"partitioned"` CHIPS cookies, built-in OPcache, `fatal_error_backtraces`, `max_memory_limit`, `php --ini=diff`, and complete PHP 8.5 deprecation & BC matrix.
  - Updated `rules/AGENTS.md` (Section 1), `agents/laravel-architect.md` (Section 9), `docs/architecture/clean-code-and-concerns.md`, `docs/architecture/enums.md` (adopting native global `SortDirection`, `__debugInfo(): array`, and `#[Override]` on enum constants/cases), and `docs/architecture/namespace-import-class-standards.md`.
- **README Architectural Overview Header Poster (`assets/banner.png`)**: Added a custom dark Swiss-grid bento overview banner (`1280×714` rounded-corner PNG) showcasing the plugin's key architecture, security guard, PHP 8.5/8.6 GA capabilities, and KPIs (`31 Skills`, `28 Architecture Guides`, `26 Always-On Rules`, `19 Security Guards`) at the top of `README.md`.

### Fixed
- **PHP 8.5 Clone With v2 Syntax**: Corrected invalid `clone $obj with (prop: $val)` to the shipped `clone($obj, ['prop' => $val])` syntax across `skills/php-modern-syntax/SKILL.md`, `rules/AGENTS.md`, `agents/laravel-architect.md`, `docs/architecture/clean-code-and-concerns.md`, and `README.md`.
- **Exact `Time\Duration` API**: Replaced fabricated `Duration::ofSeconds()`, `toIsoString()`, and `toSeconds()` calls with verified `Duration::fromSeconds()`, `fromIso8601DurationString()`, `static compare()`, and readonly `$seconds` / `$nanoseconds` / `$negative` properties.
- **Exact `Io\Poll\*` API**: Replaced fabricated `new Io\Poll()` / `Poll::READ` / `wait(timeoutMs: ...)` with verified `Io\Poll\Context`, global `StreamPollHandle`, `Io\Poll\Event`, `Io\Poll\Backend`, `Io\Poll\Watcher`, and `wait(timeout: Duration::fromSeconds(...), maxEvents: ...)`.
- **Exact JSON Error Location API**: Replaced fabricated `JsonException::getOffset()` with verified `json_last_error_msg()` / `JsonException::getMessage()` (`near location {line}:{column}`).
- **Repo-Wide Zero Inline Backslashes & PHP 8.5/8.6 Hygiene**: Replaced all 49 remaining PHP-block occurrences of `#[\Override]` and `#[\NoDiscard]` plus 8 inline leading-backslash FQCNs across 26 `skills/` and `docs/` files with explicit alphabetically sorted top-level `use` imports; removed an invalid `#[NoDiscard]` on a `: void` method in `docs/architecture/oop-pillars-and-organization.md` (compile-time error in PHP 8.5+); and removed stray unbalanced fence lines in `docs/architecture/senior-developer-code-review-and-refactoring.md`.

### Hardened (CodeRabbit CLI Review Findings Resolved)
- Updated `Io\Poll\Context::wait()` across `SKILL.md`, `php-8-6-modern-syntax-and-migration.md`, `rules/AGENTS.md`, and `CHANGELOG.md` to PHP 8.6.0 GA's shipped `wait(?Time\Duration $timeout = null, ?int $maxEvents = null): array` signature.
- Nested `error_mode` and `error_store` under `'stream' => [...]` inside `stream_context_create()` in `SKILL.md` and `rules/AGENTS.md` to prevent top-level `ValueError`.
- Kept the PHP 8.5 pipe-operator example in `SKILL.md` strictly PHP 8.5-parseable (using a closure instead of PHP 8.6 `?`).
- Fixed `Duration::add(Duration $duration)` / `sub(Duration $duration)` parameter names for named-argument compatibility and fixed class constant object initialization in `php-8-6-modern-syntax-and-migration.md` to reference a global constant instead of an unsupported class-constant `new` expression.
- Clarified in `enums.md`, `SKILL.md`, `php-8-6-modern-syntax-and-migration.md`, and `rules/AGENTS.md` that enum `__debugInfo(): array` redacts debug dumps (`var_dump()`/`dd()`), whereas Monolog JSON normalization requires separate log scrubbing.
- Added explicit PHP 8.5 vs PHP 8.6 version-gating in `rules/AGENTS.md` and `agents/laravel-architect.md` so PHP 8.6-only syntax is required only on PHP 8.6+ projects; documented value-object invariant preservation with `clone($obj, [...])`; replaced invalid `fn(...)` FCC placeholder examples with `strlen(...)`/`trim(...)`.
- Hardened `SafeUrlNormalizer` in `skills/php-modern-syntax/SKILL.md` so `canonicalHttpsOrigin()` returns only `scheme://host[:port]` and `resolveWebhookCallback()` enforces a strict same-origin HTTPS check without userinfo; updated `DATE_RFC7231` replacement guidance to require converting to UTC before formatting.
- Fixed the PHP 8.5/8.6 pre-upgrade audit `grep` regex in `docs/architecture/php-8-6-modern-syntax-and-migration.md` to match full `MHASH_*` / `PDO::MYSQL_ATTR_*` / `PDO::PGSQL_*` / `PDO::SQLITE_*` / `mb_ereg*` symbol names, and added explicit `use NoDiscard;` imports in `docs/architecture/patterns.md` and `docs/architecture/senior-developer-code-review-and-refactoring.md`.

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
