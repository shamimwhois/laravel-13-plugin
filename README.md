# Laravel 13 & Modern PHP 8.5+ Plugin

[![GitHub Repository](https://img.shields.io/badge/GitHub-shamimwhois%2Flaravel--13--plugin-181717?style=flat&logo=github)](https://github.com/shamimwhois/laravel-13-plugin)
[![Version](https://img.shields.io/badge/version-2.6.0-red.svg)](https://github.com/shamimwhois/laravel-13-plugin/releases)
[![Laravel](https://img.shields.io/badge/Laravel-13.x-FF2D20?logo=laravel)](https://laravel.com)
[![PHP](https://img.shields.io/badge/PHP-8.5%2B-777BB4?logo=php)](https://php.net)
[![Pest](https://img.shields.io/badge/Tested%20with-Pest%203-9333EA)](https://pestphp.com)

A complete toolkit for developing, refactoring, and architecting modern PHP (8.4 & **PHP 8.5+**) and **Laravel 13** applications with the Antigravity assistant.

---

## 🚀 Features & Capabilities

- **Always-On Quality Rules (`rules/AGENTS.md`)**: Automatically enforces:
  - `declare(strict_types=1);` on every PHP file.
  - PHP 8.4 property hooks & asymmetric visibility (`public private(set)`).
  - PHP 8.5 pipe operator (`|>`), `clone $obj with (...)`, and `#[\NoDiscard]`.
  - Fullstack consistency across Migrations, Models, Factories, Seeders, Controllers, and Routes.
  - Standardized routing conventions: kebab-case URLs (`/user-profiles`), dot notation names (`admin.users.index`), plural resources, and singular parameters.
  - Thin controllers & dedicated Form Requests (zero inline `$request->validate()`).
  - Strict eager loading & N+1 query prevention (`with()`, `loadMissing()`, `withExists()`, `withCount()`).
  - Strict PHPStan / Larastan Level 8 / `max` type annotations, generics, and null safety.
  - Official Laravel AI SDK standards (`laravel/ai`): Agent architecture, `schema()` validation, structured output DTOs, SSE streaming, XML prompt injection boundaries, and async queue execution.
  - Model Context Protocol (MCP) standards (`laravel/mcp`): Server coordinators, typed tool schemas, read-only resource URI templates, reusable prompt templates, Sanctum security, and stdio/web transports.
  - Console command isolation (`Isolatable`) & query log memory defense (`DB::disableQueryLog()`).
  - ACID transaction boundaries with automatic deadlock retries (`DB::transaction(..., attempts: 3)`), row locking (`lockForUpdate()`), and `afterCommit` hooks.
- **`laravel-console-and-scheduling` Skill & [`docs/architecture/console-commands-and-scheduling.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/console-commands-and-scheduling.md)**: Master guide for Artisan console commands (`make:command`), CLI signature DSL, concurrency locking (`implements Isolatable`), interactive UX via Laravel Prompts, memory safety in batch loops, and centralized scheduling in `routes/console.php`.
- **`docs/architecture/database-transactions-and-concurrency.md`**: Master architecture guide for database concurrency: ACID boundaries, deadlock auto-recovery (`attempts: 3`), pessimistic row locking (`lockForUpdate()`), lock-order deadlock prevention, HTTP transaction call prohibition, and `ShouldHandleEventsAfterCommit`.
- **`laravel-mcp` Skill & [`docs/architecture/mcp-and-ai-protocols.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/mcp-and-ai-protocols.md)**: Master guide for Model Context Protocol in Laravel 13 (`composer require laravel/mcp`):
  - Server Coordinators (`make:mcp-server`) with `#[Name]`, `#[Version]`, and `#[Instructions]` attributes.
  - Actionable Tools (`make:mcp-tool`) with JSON Schema parameter validation and domain action dispatching.
  - Read-Only Resources (`make:mcp-resource`) with dynamic URI templates (`HasUriTemplate`).
  - Standardized Prompts (`make:mcp-prompt`) for reproducible AI workflows.
  - Dual transports: Web SSE (`routes/ai.php` via `Mcp::web()`) and stdio (`php artisan mcp:serve`).
  - Sanctum token authentication, rate limiting, IDOR defenses, and Pest 3 tests with `Mcp::server()`.
- **`laravel-ai-sdk` Skill & [`docs/architecture/ai-sdk-and-llm-integration.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/ai-sdk-and-llm-integration.md)**: Master guide for Laravel's official AI SDK (`composer require laravel/ai`) covering the 8 Core Pillars:
  1. **Prompts**: Dedicated Agent classes (`make:agent`), instructions, dynamic prompting.
  2. **Context**: Conversational memory (`RemembersConversations`, `Conversational`), database chat history, scoped keys.
  3. **Tools**: Local application function calling (`make:tool`), parameter schema contracts, typed handlers.
  4. **Provider Tools**: Cloud-side tools (`WebSearch`, `WebFetch`, `FileSearch`, `CodeExecution`) running natively on AI infrastructure.
  5. **Structured Output**: `HasStructuredOutput` schemas hydrated into PHP 8.5+ immutable DTOs (`final readonly class`).
  6. **Streaming**: Real-time token streaming via SSE, Livewire `wire:stream`, and Vercel AI Data Protocol.
  7. **Async**: Background queue jobs (`#[WithQueue]`), rate limit exponential backoff (`[10, 30, 90]`), and Laravel Echo WebSockets broadcasting.
  8. **Attachments**: Multimodal payloads (`Laravel\Ai\Files\Image`, `Document`, `Audio`, HTTP uploads), prompt injection defense, and Pest 3 tests with `Agent::fake()`.
- **`laravel-controllers-and-middleware` Skill & [`docs/architecture/controllers-and-middleware.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/controllers-and-middleware.md)**: Modern controller and middleware architecture: Single-Action Invokables (`__invoke`), Form Request to DTO pipeline, fluent middleware in `bootstrap/app.php` (append, prepend, aliases, priority), Terminable Middleware for zero-latency background logging, and isolated Pest 3 unit/arch tests.
- **`laravel-security-and-hardening` Skill & [`docs/architecture/security-and-hacker-protection.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/security-and-hacker-protection.md)**: Enterprise security hardening & hacker defense: CVE continuous scanning (`composer audit`, OSV-Scanner, Semgrep), OWASP Top 10 mitigation, SSRF private IP defense, timing attack immunity (`hash_equals()`), hardened binary file uploads, IDOR scoped bindings, SQL parameterization, and supply chain protection detailed in **[`docs/architecture/cve-management.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/cve-management.md)**.
- **`laravel-performance-and-caching` Skill & [`docs/architecture/caching-and-performance.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/caching-and-performance.md)**: High-speed caching, payload compression (`igbinary`, `zstd` saving up to 85% Redis RAM), Cache Stampede defense via `Cache::flexible()` (Stale-While-Revalidate), atomic distributed locks (`Cache::lock()->block()`), OPcache/JIT execution tuning, and refactoring messy caching into Cached Repository Decorators.
- **`laravel-memory-safety` Skill & [`docs/architecture/memory-safety-and-performance.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/memory-safety-and-performance.md)**: Production memory safety, leak prevention, and high-throughput resource management: constant $O(1)$ database streaming with `cursor()`, mutation safety with `chunkById()`, Octane/FrankenPHP concurrency state safety, `WeakMap` object caching, zero-memory file downloads via `streamDownload()`, and queue worker recycling.
- **`laravel-api-design` Skill & [`docs/api/design.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/api/design.md)**: Production-grade RESTful API architecture: URL versioning (`/api/v1/`), kebab-case URIs, shallow nesting, strict HTTP semantics (201, 204, 422), unified RFC 7807 problem details, mandatory `JsonResource` serialization, Form Request to DTO pipeline, Sanctum token abilities, tiered rate limiting, and idempotency keys.
- **`architectural-decision-matrix` Skill & [`docs/architecture/Architectural.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/Architectural.md)**: Comprehensive evaluation framework covering the Top 10 software architecture patterns (Classic MVC, Action-Driven, Modular Monolith, DDD, Hexagonal, CQRS, EDA, Clean Architecture, etc.) across complexity, velocity, testability, blast radius, team size, and Conway's Law.
- **`laravel-routing` Skill & [`docs/Route.md`](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/Route.md)**: Master routing guide organized in 5 core styles:
  1. Route Declarations & Controller Mapping (Invokable controllers, direct classes, API resources)
  2. Route Grouping & Prefixes (Hierarchies, prefixes, middleware stacks)
  3. Route Model Binding & Custom Keys (Slugs, scoped bindings, `withTrashed()`)
  4. Parameter Constraints & Fallbacks (`whereUlid`, `whereUuid`, regex, fallbacks)
  5. Rate Limiting & Health Routing (`Limit::perSecond()`, throttles, `/up` check)
- **`pest-testing` Skill**: Comprehensive testing guide for Pest 3: Feature & API endpoint tests, Unit tests, Architectural boundary testing (`arch()`), first-party Mocking & Fakes (`Event::fake()`, `Http::fake()`), time travel, parameterized datasets, and type coverage verification.
- **`artisan-make-commands` Skill**: Complete catalog of all 30+ `php artisan make:*` generator commands, compound flags (`php artisan make:model -mfs --controller --requests --resource --pest`), and stub customization (`stub:publish`).
- **`laravel-scaffolding` Skill**: Complete end-to-end blueprint for scaffolding all 6 core layers of a feature (Migration $\rightarrow$ Route).
- **`phpstan-larastan` Skill**: Guide and patterns for configuring `phpstan.neon`, using Larastan extensions, writing generic annotations, and CI workflows.
- **`laravel-eloquent-orm` Skill**: Master guide for Laravel 13 Eloquent ORM, attributes, custom builders, casts, and AI vector similarity queries (`whereVectorSimilarTo`).
- **`laravel-best-practices` Skill**: Architecture guidelines covering lean `bootstrap/app.php` bootstrapping, Actions, Form Requests, Resources, and Pest 3 testing.
- **`php-modern-syntax` Skill**: Reference for PHP 8.4 and PHP 8.5+ features including property hooks, asymmetric visibility, pipe operator, clone-with, and `#[\NoDiscard]`.
- **`laravel-architect` Agent**: Dedicated subagent to perform code reviews, query audits, and Pest test suite design.

---

## 📂 Plugin Structure

```text
~/.gemini/config/plugins/laravel/
├── plugin.json
├── README.md
├── docs/
│   ├── Route.md
│   ├── api/
│   │   └── design.md
│   ├── testing/
│   │   ├── assertions.md
│   │   └── database-testing.md
│   └── architecture/
│       ├── routing.md
│       ├── patterns.md
│       ├── Architectural.md
│       ├── clean-code-and-concerns.md
│       ├── oop-pillars-and-organization.md
│       ├── namespace-import-class-standards.md
│       ├── enums.md
│       ├── codebase-organization-and-maintenance.md
│       ├── senior-developer-code-review-and-refactoring.md
│       ├── memory-safety-and-performance.md
│       ├── caching-and-performance.md
│       ├── security-and-hacker-protection.md
│       ├── cve-management.md
│       ├── controllers-and-middleware.md
│       ├── ai-sdk-and-llm-integration.md
│       ├── mcp-and-ai-protocols.md
│       ├── console-commands-and-scheduling.md
│       └── database-transactions-and-concurrency.md
├── rules/
│   └── AGENTS.md
├── skills/
│   ├── laravel-console-and-scheduling/
│   │   └── SKILL.md
│   ├── laravel-mcp/
│   │   └── SKILL.md
│   ├── laravel-ai-sdk/
│   │   └── SKILL.md
│   ├── laravel-controllers-and-middleware/
│   │   └── SKILL.md
│   ├── laravel-security-and-hardening/
│   │   └── SKILL.md
│   ├── laravel-performance-and-caching/
│   │   └── SKILL.md
│   ├── laravel-memory-safety/
│   │   └── SKILL.md
│   ├── laravel-api-design/
│   │   └── SKILL.md
│   ├── pest-testing/
│   │   └── SKILL.md
│   ├── architectural-decision-matrix/
│   │   └── SKILL.md
│   ├── laravel-routing/
│   │   └── SKILL.md
│   ├── artisan-make-commands/
│   │   └── SKILL.md
│   ├── laravel-scaffolding/
│   │   └── SKILL.md
│   ├── phpstan-larastan/
│   │   └── SKILL.md
│   ├── laravel-best-practices/
│   │   └── SKILL.md
│   ├── laravel-eloquent-orm/
│   │   └── SKILL.md
│   └── php-modern-syntax/
│       └── SKILL.md
└── agents/
    └── laravel-architect.md
```
