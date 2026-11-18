# Laravel 13 Routing Master Guide (`Route.md`)

This guide details the modern architectural patterns for routing in Laravel 13 applications targeting PHP 8.5+, standard naming conventions, and advanced organization patterns for multi-tier grouping, middleware stacks, and modular files.

---

## 📋 Standard Routing Conventions

All routes, URLs, controllers, and parameters must strictly adhere to these conventions across the application:

| Component | Convention | Example | Notes |
| :--- | :--- | :--- | :--- |
| **URL** | `kebab-case` | `/user-profiles` | Lowercase words separated by hyphens. Never use camelCase or snake_case in URLs. |
| **Route name** | `dot notation` | `admin.users.index` | Hierarchical namespace separated by dots (`prefix.resource.action`). |
| **Controller** | `PascalCase` | `UserController` | UpperCamelCase with `Controller` suffix. |
| **Controller method** | `camelCase` | `showProfile()` | Standard PHP method naming; `__invoke` for single-action controllers. |
| **Resource** | `plural noun` | `users` | Plural noun representing the entity collection in URI segments. |
| **Route parameter** | `singular` | `{user}` | Singular noun matching model binding or controller argument. |
| **API version** | `URL versioning` | `/api/v1/users` | Explicit path prefix (`/api/v1/...`, `/api/v2/...`). |

---

## ⚖️ Side-by-Side: Traditional vs. Latest Routing

| Concept | Traditional Style (Laravel 8 – 10) | Latest Style (Laravel 13 & PHP 8.5+) |
| :--- | :--- | :--- |
| **Bootstrapping** | `RouteServiceProvider` + `app/Http/Kernel.php` | `bootstrap/app.php` using `withRouting()` & `withMiddleware()` |
| **Controller Actions** | String `'ArticleController@show'` or `[ArticleController::class, 'show']` | Single-Action Invokable `ShowArticleController::class` |
| **Model Binding** | Manual `Route::bind()` in provider or default IDs | Inline custom keys `{article:slug}` and `->scopeBindings()` |
| **Constraints** | Raw regex: `->where('id', '[0-9a-f]{8}-...')` | Built-in helpers: `->whereUlid('id')`, `->whereUuid('id')` |
| **Health Check** | Custom controller with manual database ping | Native `health: '/up'` registered in `bootstrap/app.php` |
| **Throttling** | Static per-minute limits in `RouteServiceProvider` | Dynamic `RateLimiter::perSecond()` & `Limit::perMinute()` |
| **Middleware Aliases** | Protected `$routeMiddleware` array in `Kernel.php` | Fluent `$middleware->alias([...])` in `bootstrap/app.php` |

---

## 🏛️ Advanced Architecture: Prefix, Grouping & Modular Organization

As an application scales, a monolithic `routes/api.php` file quickly becomes unmaintainable. Modern Laravel organizes routes using **multi-tier hierarchies**, **scoped middleware stacks**, and **modular route files**.

### 1. Multi-Tier Hierarchical Grouping Pattern

Structure your routes in logical concentric rings:
1. **API Versioning Ring** (`api/v1`)
2. **Access & Authentication Ring** (`public` vs `protected` vs `admin`)
3. **Domain / Resource Ring** (`orders`, `subscriptions`, `users`)

```php
<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Orders\IndexOrderController;
use App\Http\Controllers\Orders\ShowOrderController;
use App\Http\Controllers\Orders\StoreOrderController;
use App\Http\Controllers\Admin\AnalyticsController;
use Illuminate\Support\Facades\Route;

// Top-Level Tier: API Versioning (v1)
Route::prefix('v1')->name('api.v1.')->group(function (): void {

    // Tier 2: Public Guests (Throttled, No Auth)
    Route::prefix('auth')->name('auth.')->middleware('throttle:10,1')->group(function (): void {
        Route::post('/login', LoginController::class)->name('login');
        Route::post('/register', RegisterController::class)->name('register');
    });

    // Tier 2: Authenticated Users (auth:sanctum + verified)
    Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {

        // Tier 3: Orders Domain
        Route::prefix('orders')->name('orders.')->group(function (): void {
            Route::get('/', IndexOrderController::class)->name('index');
            Route::post('/', StoreOrderController::class)->middleware('throttle:30,1')->name('store');
            Route::get('/{order:ulid}', ShowOrderController::class)->name('show');
        });

        // Tier 3: Admin Domain (Restricted by Role Middleware)
        Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function (): void {
            Route::get('/analytics', AnalyticsController::class)->name('analytics');
        });
    });
});
```

---

### 2. Middleware Inheritance, Scoping & `withoutMiddleware()`

When nesting groups, inner routes inherit all middleware from outer groups.

#### Selective Middleware Bypassing:
```php
Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
    // Normal authenticated route (requires verified email)
    Route::get('/profile', ShowProfileController::class);

    // Bypass email verification for a specific onboarding endpoint (imported at top)
    Route::post('/resend-verification', ResendVerificationController::class)
        ->withoutMiddleware([EnsureEmailIsVerified::class]);
});
```

#### Middleware with Parameters:
```php
// Pass roles, permissions, or guard names directly
Route::middleware(['role:admin,editor', 'auth:sanctum'])->group(function (): void {
    Route::post('/articles', StoreArticleController::class);
});
```

---

### 3. Modularizing Route Files (Domain-Driven Splitting)

Instead of keeping 1,000+ lines in `routes/api.php`, split routes by business bounded context into dedicated files:

```text
routes/
├── web.php
├── api.php                  # Main entry point
└── api/
    └── v1/
        ├── auth.php         # Authentication & passwords
        ├── users.php        # User accounts & settings
        ├── orders.php       # Orders, payments & checkout
        ├── articles.php     # Publishing, comments & tags
        └── admin.php        # Backoffice & administrative tools
```

#### Approach A: Modern Laravel 13 `bootstrap/app.php` (`withRouting(then: ...)`):
Register isolated route files with their own middleware and prefixes directly in `bootstrap/app.php`:

```php
<?php

declare(strict_types=1);

use App\Http\Middleware\CheckRole;
use App\Http\Middleware\VerifyWebhookSignature;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            // Modular Admin API
            Route::middleware(['api', 'auth:sanctum', 'role:admin'])
                ->prefix('api/v1/admin')
                ->name('api.v1.admin.')
                ->group(base_path('routes/api/v1/admin.php'));

            // Modular Webhook Ingestion (Unthrottled, Signature verified)
            Route::middleware(['api', 'webhook.signature'])
                ->prefix('api/webhooks')
                ->name('api.webhooks.')
                ->group(base_path('routes/api/webhooks.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => CheckRole::class,
            'webhook.signature' => VerifyWebhookSignature::class,
        ]);
    })->create();
```

#### Approach B: Inclusion from `routes/api.php`:
If keeping all API routes centralized under the base API middleware stack:

```php
<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    // Auth routes (public)
    require __DIR__.'/api/v1/auth.php';

    // Authenticated application routes
    Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
        require __DIR__.'/api/v1/users.php';
        require __DIR__.'/api/v1/articles.php';
        require __DIR__.'/api/v1/orders.php';
    });
});
```

---

### 4. Controller Groups (For Resourceful Multi-Action Controllers)

When resourceful actions belong to the same controller, use `Route::controller()` to avoid repeating the controller class:

```php
use App\Http\Controllers\Orders\OrderController;

Route::controller(OrderController::class)
    ->prefix('orders')
    ->name('orders.')
    ->group(function (): void {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->name('store');
        Route::get('/{order:ulid}', 'show')->name('show');
        Route::put('/{order:ulid}', 'update')->name('update');
        Route::delete('/{order:ulid}', 'destroy')->name('destroy');
    });
```

---

### 5. Subdomain & Multi-Tenant Route Groups

Route requests based on subdomains or wildcards:

```php
// Multi-tenant routing
Route::domain('{tenant}.yourapp.com')
    ->middleware(['web', 'tenant.identify'])
    ->name('tenant.')
    ->group(function (): void {
        Route::get('/dashboard', TenantDashboardController::class)->name('dashboard');
        Route::get('/billing', TenantBillingController::class)->name('billing');
    });
```

---

## 🏛️ Routing Design Mapped to Architectural Decisions

Your route file design should directly reflect the architectural pattern chosen in the **[Architectural Decision Matrix](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/Architectural.md)**. Below is how routing is designed across the primary architectural patterns:

---

### Pattern 1: Action-Driven Monolith Routing (Default Standard)

In an Action-Driven architecture, every route maps to a single-action **invokable controller** (`__invoke`), completely eliminating fat multi-action controllers.

```php
<?php

declare(strict_types=1);

use App\Http\Controllers\Orders\CancelOrderController;
use App\Http\Controllers\Orders\IndexOrderController;
use App\Http\Controllers\Orders\ShowOrderController;
use App\Http\Controllers\Orders\StoreOrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/orders')->name('api.v1.orders.')->group(function (): void {
    // Each route points to an isolated, dedicated single-action controller
    Route::get('/', IndexOrderController::class)->name('index');
    Route::post('/', StoreOrderController::class)->name('store');
    Route::get('/{order:ulid}', ShowOrderController::class)->name('show');
    Route::put('/{order:ulid}/cancel', CancelOrderController::class)->name('cancel');
});
```
- **Controller Design**: The controller unpacks input via Form Request, invokes `#[\NoDiscard]` Action class, and returns `JsonResource`.
- **Key Advantage**: Zero merge conflicts; every endpoint is independently testable in Pest.

---

### Pattern 2: Modular Monolith Routing (Enterprise Scale)

In a Modular Monolith, routes are partitioned by business domain inside `app/Modules/{Domain}/routes/`. The root route files act strictly as **Module Aggregators**, while `bootstrap/app.php` registers standalone boundaries.

#### Root Aggregator (`routes/api.php`):
```php
<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    // 1. Identity Domain Module (Public)
    require app_path('Modules/Identity/routes/api.php');

    // 2. Authenticated Domain Modules
    Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
        require app_path('Modules/User/routes/api.php');
        require app_path('Modules/Order/routes/api.php');
        require app_path('Modules/Billing/routes/api.php');
    });
});
```

#### Module Route File (`app/Modules/Order/routes/api.php`):
```php
<?php

declare(strict_types=1);

use App\Modules\Order\Http\Controllers\IndexOrderController;
use App\Modules\Order\Http\Controllers\ShowOrderController;
use App\Modules\Order\Http\Controllers\StoreOrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('orders')->name('orders.')->group(function (): void {
    Route::get('/', IndexOrderController::class)->name('index');
    Route::post('/', StoreOrderController::class)->name('store');
    Route::get('/{order:ulid}', ShowOrderController::class)->name('show');
});
```
- **Key Advantage**: Domain teams operate in complete isolation without stepping on each other's route files.

---

### Pattern 3: CQRS Routing (Command Query Responsibility Segregation)

In CQRS, routing is deliberately segregated between **State-Mutating Commands** (Write Path) and **High-Speed Projections** (Read Path).

```php
<?php

declare(strict_types=1);

use App\Http\Controllers\Orders\Commands\CancelOrderCommandController;
use App\Http\Controllers\Orders\Commands\PlaceOrderCommandController;
use App\Http\Controllers\Orders\Queries\GetOrderMetricsQueryController;
use App\Http\Controllers\Orders\Queries\GetOrderSummaryQueryController;
use App\Http\Controllers\Orders\Queries\ListOrdersQueryController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/orders')->name('api.v1.orders.')->group(function (): void {

    // === WRITE PATH: Commands (Transactions, State Mutations, Events) ===
    Route::post('/', PlaceOrderCommandController::class)
        ->middleware('throttle:30,1')
        ->name('commands.place');

    Route::post('/{order:ulid}/cancel', CancelOrderCommandController::class)
        ->name('commands.cancel');

    // === READ PATH: Queries (High-Speed Direct SQL Projections, Caching) ===
    Route::get('/', ListOrdersQueryController::class)
        ->name('queries.list');

    Route::get('/{order:ulid}/summary', GetOrderSummaryQueryController::class)
        ->name('queries.summary');

    Route::get('/metrics', GetOrderMetricsQueryController::class)
        ->middleware('cache.headers:public;max_age=300;etag')
        ->name('queries.metrics');
});
```
- **Key Advantage**: Read queries completely bypass heavy Eloquent model hydration and connect to read replicas or cache layers, while commands run through strict business validation and database transactions.

---

### Pattern 4: Hexagonal Architecture Routing (Inbound Driving Adapters)

In Hexagonal Architecture, the route file acts as the configuration for **Inbound (Driving) Adapters**. HTTP controllers never contain domain logic—they map HTTP inputs to the Inbound Port (Use Case contract).

```php
<?php

declare(strict_types=1);

use App\Adapters\Inbound\Http\Articles\PublishArticleHttpAdapter;
use Illuminate\Support\Facades\Route;

// Route maps HTTP trigger to the Driving Adapter
Route::post('/articles/{article:ulid}/publish', PublishArticleHttpAdapter::class)
    ->middleware(['auth:sanctum', 'can:publish,article'])
    ->name('articles.publish');
```

```php
// app/Adapters/Inbound/Http/Articles/PublishArticleHttpAdapter.php
final readonly class PublishArticleHttpAdapter
{
    public function __construct(
        private PublishArticleUseCaseInterface $useCase, // Inbound Port
    ) {}

    public function __invoke(PublishArticleRequest $request, string $articleId): JsonResponse
    {
        // Convert HTTP input into domain command object
        $command = new PublishArticleCommand(
            articleId: $articleId,
            publishedBy: $request->userOrFail()->id,
        );

        $result = $this->useCase->execute($command);

        return response()->json(['published_at' => $result->publishedAt]);
    }
}
```

---

### Pattern 5: Event-Driven & Webhook Routing

Webhooks require isolated routing with signature verification, replay protection, and asynchronous processing.

#### Dedicated Webhook Registration (`bootstrap/app.php`):
```php
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            Route::middleware(['api', 'webhook.signature'])
                ->prefix('webhooks')
                ->name('webhooks.')
                ->group(base_path('routes/webhooks.php'));
        },
    )->create();
```

#### Webhook Router (`routes/webhooks.php`):
```php
<?php

declare(strict_types=1);

use App\Http\Controllers\Webhooks\StripeWebhookController;
use App\Http\Controllers\Webhooks\GitHubWebhookController;
use Illuminate\Support\Facades\Route;

// All endpoints automatically inherit 'api' and 'webhook.signature' middleware
Route::post('/stripe', StripeWebhookController::class)->name('stripe');
Route::post('/github', GitHubWebhookController::class)->name('github');
```

---

## 📌 Summary: The Clean Routing Checklist

1. ✅ **URLs**: Always lowercase `kebab-case` (`/user-profiles`).
2. ✅ **Route Names**: Always hierarchical `dot notation` (`api.v1.orders.store`).
3. ✅ **Prefixing**: Group by API version, then access tier, then domain resource.
4. ✅ **Middleware**: Apply at the group level; use `withoutMiddleware()` sparingly for exceptions.
5. ✅ **File Modularization**: Break `routes/api.php` into `routes/api/v1/*.php` domain files.
6. ✅ **Registration**: Use `withRouting(then: ...)` in `bootstrap/app.php` for isolated sub-routers.
