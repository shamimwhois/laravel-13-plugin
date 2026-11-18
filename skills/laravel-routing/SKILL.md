---
name: laravel-routing
description: Master guide to Laravel 13 routing architecture: single-action invokable controllers, route groups & prefixes, route model binding & scoped bindings, parameter constraints (`whereUlid`, `whereUuid`), per-second rate limiting, and `/up` health checks.
---

# Laravel 13 Routing Architecture Guide (Latest vs Traditional)

This skill provides the comprehensive reference for routing design in Laravel 13 applications targeting PHP 8.5+, comparing modern standards against traditional legacy approaches.

---

## 📋 Standard Routing Conventions

All routes, URLs, controllers, and parameters must strictly adhere to these conventions across the application:

| Component | Convention | Example |
| :--- | :--- | :--- |
| **URL** | `kebab-case` | `/user-profiles` |
| **Route name** | `dot notation` | `admin.users.index` |
| **Controller** | `PascalCase` | `UserController` |
| **Controller method** | `camelCase` | `showProfile()` |
| **Resource** | `plural noun` | `users` |
| **Route parameter** | `singular` | `{user}` |
| **API version** | `URL versioning` | `/api/v1/users` |

---

## ⚖️ At a Glance: Traditional vs. Latest

| Architectural Area | Traditional (Laravel 8 – 10) | Latest (Laravel 13 & PHP 8.5+) |
| :--- | :--- | :--- |
| **Bootstrapping** | `RouteServiceProvider` + `app/Http/Kernel.php` | `bootstrap/app.php` with `withRouting()` & `health: '/up'` |
| **Controllers** | `[ArticleController::class, 'show']` | Invokable `ShowArticleController::class` |
| **Model Binding** | Manual resolution or default integer IDs | Inline custom keys `{article:slug}` and `scopeBindings()` |
| **Constraints** | Manual regex strings | Built-in helpers (`whereUlid`, `whereUuid`, `whereIn`) |
| **Rate Limiting** | Coarse static per-minute limit | Per-second (`Limit::perSecond(5)`) and dynamic user limits |
| **Health Check** | Custom ping endpoint controller | Built-in `/up` health routing in `bootstrap/app.php` |

---

## The 5 Core Routing Pillars

1. **Route Declarations & Controller Mapping**: Invokable controllers, direct class references, API resources.
2. **Route Grouping, Prefixes & Middleware Stacks**: Hierarchical prefixes (version $\rightarrow$ auth $\rightarrow$ resource), middleware stacks, and selective bypass via `withoutMiddleware()`.
3. **Modular Route Files & Organization**: Domain-based route splitting (`routes/api/v1/*.php`) registered cleanly in `bootstrap/app.php` via `withRouting(then: ...)`.
4. **Route Model Binding & Custom Keys**: Implicit binding, custom column keys (`{article:slug}`), scoped bindings, and `withTrashed()`.
5. **Parameter Constraints, Rate Limiting & Health**: Built-in helpers (`whereUlid`, `whereUuid`, `whereIn`), `Limit::perSecond()`, and `/up` health checks.

---

## 🏛️ Routing Designs Mapped to Architecture Choices

| Architectural Decision | Route Strategy | Implementation |
| :--- | :--- | :--- |
| **Action-Driven Monolith** | Single-Action Invokables | Each route points to `SomeController::class` (`__invoke`) |
| **Modular Monolith** | Domain Route Ownership | `routes/api.php` aggregates `app/Modules/{Domain}/routes/*` |
| **CQRS Architecture** | Write vs Read Split | Separate `Commands.*` (POST/PUT) from `Queries.*` (GET) |
| **Hexagonal Architecture**| Inbound Driving Adapters | Routes map to HTTP Driving Adapters executing Inbound Ports |
| **Event-Driven / Webhooks**| Isolated Signature Routers | Standalone `routes/webhooks.php` in `bootstrap/app.php` |

---

## Complete Guide Reference

The full reference manuals with side-by-side code comparisons, modular monolith architecture, and production templates are available in:
- 🏛️ **Enterprise Architecture**: 👉 **[docs/architecture/routing.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/routing.md)**
- 📄 **Route Cheat Sheet & Guide**: 👉 **[Route.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/Route.md)**
