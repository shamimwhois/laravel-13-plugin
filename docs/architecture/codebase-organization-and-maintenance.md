# Modern Laravel 13 & PHP 8.5+ Codebase Organization, Handlers & Maintenance

> **Document**: `docs/architecture/codebase-organization-and-maintenance.md`  
> **Framework**: Laravel 13 & PHP 8.5+  
> **Scope**: Modern Handlers (Exceptions, Events, Webhooks), The Death of `helpers.php` (Support Utilities & Value Objects), Database Maintenance (Pruning), Architecture Guards (`arch()`), and the Complete Enterprise Codebase Blueprint.

---

## 🏛️ Executive Summary

As a Laravel codebase grows, two common failure modes emerge:
1. **The "Helpers" Trap**: Dumping untyped procedural functions into an uncontrolled `app/helpers.php` file.
2. **Architectural Erosion**: Business logic leaking into controllers, models bloating into 2,000-line God objects, and unhandled exceptions leaking sensitive stack traces.

This guide details the modern Laravel 13 & PHP 8.5+ standard to keep large codebases clean, maintainable, and resilient over years of production deployment.

---

## 1. Modern Handlers: Exceptions, Events & Webhooks

### A. Exception Handling in `bootstrap/app.php` (Zero Legacy `Handler.php`)

In Laravel 11, 12, and 13, `app/Exceptions/Handler.php` is deprecated and removed. All global exception handling, rendering, and reporting are configured in `bootstrap/app.php` using fluent closures:

```php
// bootstrap/app.php
use App\Exceptions\DomainException;
use App\Exceptions\InsufficientBalanceException;
use App\Exceptions\OrderAlreadyProcessedException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // 1. Render custom Domain Exceptions with RFC 7807 problem details
        $exceptions->render(function (InsufficientBalanceException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'type' => 'https://api.example.com/errors/insufficient-balance',
                    'title' => 'Insufficient Account Balance',
                    'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                    'detail' => $e->getMessage(),
                    'code' => 'INSUFFICIENT_FUNDS',
                    'instance' => $request->path(),
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        });

        // 2. Custom reporting (e.g. Sentry / Bugsnag filtering)
        $exceptions->dontReportDuplicates();
        $exceptions->stopIgnoring(DomainException::class);
    })
    ->create();
```

#### Self-Rendering Domain Exceptions:
Domain exceptions can also implement `render()` and `report()` directly to encapsulate their own HTTP translation:

```php
<?php

declare(strict_types=1);

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class InsufficientBalanceException extends Exception
{
    public function __construct(
        public readonly int $requiredCents,
        public readonly int $availableCents,
    ) {
        parent::__construct(
            sprintf('Operation requires %d cents, but only %d cents are available.', $requiredCents, $availableCents)
        );
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'type' => 'https://api.example.com/errors/insufficient-balance',
            'title' => 'Insufficient Balance',
            'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
            'detail' => $this->getMessage(),
            'code' => 'INSUFFICIENT_FUNDS',
            'meta' => [
                'required_cents' => $this->requiredCents,
                'available_cents' => $this->availableCents,
            ],
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
```

---

### B. Event Handlers & Listeners (`app/Listeners/`)

Events should represent facts (*"OrderWasPlaced"*, *"PaymentReceived"*). Listeners execute asynchronous side effects (sending notifications, recalculating inventory):

```php
<?php

declare(strict_types=1);

namespace App\Listeners\Orders;

use App\Events\Orders\OrderPlacedEvent;
use App\Notifications\Orders\OrderConfirmationNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

final class SendOrderConfirmationListener implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'notifications';
    public int $tries = 3;

    public function handle(OrderPlacedEvent $event): void
    {
        $order = $event->order;
        $order->customer->notify(new OrderConfirmationNotification($order));
    }
}
```

---

### C. Webhook Handlers (`app/Http/Controllers/Webhooks/`)

Always verify signatures and process payloads idempotently through single-action controllers:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Webhooks;

use App\Actions\Billing\ProcessStripeWebhookAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class StripeWebhookController
{
    public function __invoke(
        Request $request,
        ProcessStripeWebhookAction $action,
    ): JsonResponse {
        $signature = $request->header('Stripe-Signature');
        if (! is_string($signature)) {
            abort(Response::HTTP_BAD_REQUEST, 'Missing webhook signature');
        }

        $action->execute(
            payload: (string) $request->getContent(),
            signature: $signature,
        );

        return response()->json(['status' => 'received'], Response::HTTP_OK);
    }
}
```

---

## 2. The Death of `helpers.php`: Modern Support Utilities & Value Objects

### ❌ The Legacy Anti-Pattern: `app/helpers.php`
Dumping functions into a procedural file loaded via `composer.json`'s `files` array creates serious architectural issues:
- Pollutes the global namespace with functions like `format_money()`, `clean_phone()`.
- Cannot be mocked, stubbed, or dependency-injected in unit tests.
- Violates encapsulation; encourages procedural spaghetti across controllers and views.

---

### ✅ The Modern Replacement 1: Static Pure Utilities (`app/Support/`)

Place pure, stateless utility functions in dedicated, final classes with private constructors:

```php
<?php

declare(strict_types=1);

namespace App\Support;

final class Money
{
    // Prevent instantiation of purely static utility
    private function __construct() {}

    #[\NoDiscard]
    public static function formatCents(int $cents, string $currency = 'USD'): string
    {
        $dollars = $cents / 100;
        return sprintf('%s $%0.2f', $currency, $dollars);
    }

    #[\NoDiscard]
    public static function dollarsToCents(float|string $dollars): int
    {
        return (int) round(((float) $dollars) * 100);
    }
}
```

**Usage**:
```php
use App\Support\Money;

$formatted = Money::formatCents(4500); // "USD $45.00"
```

---

### ✅ The Modern Replacement 2: Immutable Value Objects (`app/Data/` or `app/ValueObjects/`)

When data has identity or validation rules, encapsulate it in an immutable Value Object instead of raw primitives:

```php
<?php

declare(strict_types=1);

namespace App\Data;

use InvalidArgumentException;
use Stringable;

final readonly class PhoneNumber implements Stringable
{
    public string $e164Format;

    public function __construct(string $rawNumber)
    {
        // Strip non-digits
        $cleaned = preg_replace('/[^\d+]/', '', $rawNumber) ?? '';

        if (! str_starts_with($cleaned, '+') || strlen($cleaned) < 10) {
            throw new InvalidArgumentException("Invalid E.164 phone number: [{$rawNumber}]");
        }

        $this->e164Format = $cleaned;
    }

    public function countryCode(): string
    {
        return substr($this->e164Format, 0, 2);
    }

    public function __toString(): string
    {
        return $this->e164Format;
    }
}
```

---

## 3. Automated Codebase Maintenance & Pruning

### A. Database Model Pruning (`Prunable` & `MassPrunable`)

Prevent database bloat (audit logs, webhook deliveries, soft-deleted records, expired tokens) from degrading query performance over time using Laravel's native pruning:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;

final class WebhookDelivery extends Model
{
    use MassPrunable;

    /**
     * Determine the prunable query: delete deliveries older than 30 days.
     *
     * @return Builder<$this>
     */
    public function prunable(): Builder
    {
        return static::where('created_at', '<=', now()->subDays(30));
    }
}
```

#### Scheduled Maintenance in `routes/console.php`:
```php
use Illuminate\Support\Facades\Schedule;

// Automatically prune models daily
Schedule::command('model:prune')->dailyAt('02:00');

// Prune expired Sanctum tokens
Schedule::command('sanctum:prune-expired --hours=48')->dailyAt('03:00');

// Clear failed jobs older than 7 days
Schedule::command('queue:prune-failed --hours=168')->weekly();
```

---

### B. Architectural Boundary Enforcement with Pest 3 (`arch()`)

Protect your architecture against drift and erosion automatically in CI:

```php
// tests/ArchTest.php

arch('globals and debugging functions are prohibited')
    ->expect(['dd', 'dump', 'ray', 'var_dump'])
    ->not->toBeUsed();

arch('controllers must be final, thin, and invokable')
    ->expect('App\Http\Controllers')
    ->classes()
    ->toBeFinal()
    ->toHaveSuffix('Controller')
    ->toBeInvokable();

arch('actions must be final and single-action')
    ->expect('App\Actions')
    ->classes()
    ->toBeFinal()
    ->toHaveMethod('execute');

arch('domain models do not leak into controllers directly')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Database\Eloquent\Model');

arch('all classes have strict types declared')
    ->expect('App')
    ->toUseStrictTypes();
```

---

## 4. The Complete Enterprise Codebase Blueprint

Here is the authoritative directory layout for an enterprise Laravel 13 application:

```text
app/
├── Actions/                        # [Domain] Single-purpose write operations (CreateOrderAction)
├── Concerns/                       # [Traits] Cross-cutting reusable behavior
│   ├── Enums/                      # Enum helpers (HasOptions, HasValues)
│   └── InteractsWithTenant.php
├── Contracts/                      # [Interfaces] Decoupled domain boundaries (PaymentGatewayInterface)
├── Data/                           # [DTOs & Value Objects] Immutable data containers (PhoneNumber)
├── Enums/                          # [Domain Enums] Domain-partitioned enums (Orders/OrderStatus)
│   ├── Common/
│   ├── Identity/
│   └── Orders/
├── Events/                         # [Domain Events] Historical system occurrences (OrderPlacedEvent)
├── Exceptions/                     # [Domain Exceptions] Custom business errors (InsufficientBalanceException)
├── Http/
│   ├── Controllers/                # Thin, single-action invokable controllers
│   │   ├── Api/V1/Orders/
│   │   └── Webhooks/
│   ├── Middleware/                 # Custom route middlewares
│   ├── Requests/                   # Dedicated Form Requests with DTO mapping
│   └── Resources/                  # JsonResource & ResourceCollection serializers
├── Jobs/                           # [Queue] Background tasks with #[WithQueue] attributes
├── Listeners/                      # [Events] Asynchronous event handlers
├── Models/                         # [Eloquent] Entities with #[Table], casts(), and custom builders
│   └── Concerns/                   # Model-specific traits (HasSlug, HasUlid)
├── Notifications/                  # User alerts via Mail, SMS, Database, WebPush
├── Policies/                       # Granular authorization gates (OrderPolicy)
├── Providers/
│   └── AppServiceProvider.php     # Unified service container bindings
├── Services/                       # External SDK integrations & vendor API clients
└── Support/                        # Static pure utilities replacing legacy helpers (Money, Str)

bootstrap/
└── app.php                         # Unified Application Builder (Routes, Middleware, Exceptions)

config/                             # Application configurations

database/
├── factories/                      # Model factories for testing
├── migrations/                     # Anonymous database migrations
└── seeders/                        # Database seeders

routes/
├── api.php                         # Versioned API routes
├── console.php                     # Scheduled cron jobs & artisan commands
└── web.php                         # Web application routes
```

---

## 📌 Codebase Organization Checklist

1. ✅ **No `helpers.php`**: Use pure static utilities in `app/Support/` or typed Value Objects in `app/Data/`.
2. ✅ **Unified `bootstrap/app.php`**: Configure all exception rendering and reporting in `bootstrap/app.php`.
3. ✅ **Self-Rendering Exceptions**: Implement `render(Request $request)` on domain exceptions for RFC 7807 responses.
4. ✅ **Queued Event Listeners**: Always implement `ShouldQueue` on event listeners performing external I/O.
5. ✅ **Scheduled Model Pruning**: Register `model:prune` in `routes/console.php` with `MassPrunable` models.
6. ✅ **Architecture Tests**: Maintain a strict `tests/ArchTest.php` suite enforcing thin controllers and strict types.
7. ✅ **Clean Directory Separation**: Strictly respect the boundaries between `Actions/`, `Services/`, `Data/`, and `Support/`.
