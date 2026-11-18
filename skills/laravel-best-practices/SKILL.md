---
name: laravel-best-practices
description: Comprehensive architecture, request lifecycle, performance, security, PHPStan static analysis, and testing patterns for Laravel 13 & PHP 8.5+ applications.
---

# Laravel 13 Best Practices & Architecture Guide

This guide establishes the production-grade architectural patterns for building resilient, type-safe, and high-performance Laravel 13 applications targeting PHP 8.5+.

> 🏛️ **Architecture Patterns Reference**: For an in-depth breakdown of the Top 10 Software Architecture Patterns (Classic Monolith, Action-Driven, Modular Monolith, DDD, Hexagonal, CQRS, etc.), see **[docs/architecture/patterns.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/patterns.md)**.
> 🧹 **Clean Code & Concerns Guide**: For DRY principles, trait organization (`app/Concerns/`), DTOs, and Pint formatting, see **[docs/architecture/clean-code-and-concerns.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/clean-code-and-concerns.md)**.
> 💎 **Modern OOP 4 Pillars & App Organization**: For Encapsulation, Abstraction, Composition over Inheritance, Polymorphism, and optimal directory architecture, see **[docs/architecture/oop-pillars-and-organization.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/oop-pillars-and-organization.md)**.
> 🏷️ **Namespace, Import & Class Standards**: For PSR-4, explicit root imports, canonical class member ordering, and Pint rules, see **[docs/architecture/namespace-import-class-standards.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/namespace-import-class-standards.md)**.
> 🔢 **Enum Architecture & Directory Design**: For domain-based enums, `php artisan make:enum`, state transitions, and traits, see **[docs/architecture/enums.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/enums.md)**.
> 🛠️ **Codebase Organization & Maintenance**: For modern exception/event handlers, replacing `helpers.php` with `app/Support/`, model pruning, and Pest `arch()` tests, see **[docs/architecture/codebase-organization-and-maintenance.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/codebase-organization-and-maintenance.md)**.
> 🧙 **Senior Architect's Refactoring Guide**: For dead code purging, flattening arrow code with guard clauses, Rector automation, and code smell elimination, see **[docs/architecture/senior-developer-code-review-and-refactoring.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/senior-developer-code-review-and-refactoring.md)**.
> 🛡️ **Memory Safety & High-Throughput Resource Guide**: For Octane concurrency safety, $O(1)$ cursor streaming, chunkById mutations, WeakMap caching, and queue recycling, see **[docs/architecture/memory-safety-and-performance.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/memory-safety-and-performance.md)**.
> ⚡ **Caching Architecture & Speed Tuning**: For Redis payload compression (igbinary + zstd), Stale-While-Revalidate (`Cache::flexible`), atomic locks, and Cached Repository Decorators, see **[docs/architecture/caching-and-performance.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/caching-and-performance.md)**.
> 🔒 **Security Hardening & Anti-Hacking**: For OWASP Top 10 defense, SSRF filtering, timing attack immunity (`hash_equals`), binary upload verification, IDOR scoped bindings, and Pest security tests, see **[docs/architecture/security-and-hacker-protection.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/security-and-hacker-protection.md)**.
> 🛡️ **2026 CVE Auditing & Supply Chain**: For finding and remediating all CVEs with `composer audit`, OSV-Scanner, Semgrep, and CVSS SLA management, see **[docs/architecture/cve-management.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/cve-management.md)**.
> 🎛️ **Controllers & Middleware Architecture**: For single-action invokables (`__invoke`), fluent middleware in `bootstrap/app.php`, terminable background middleware, and Pest 3 tests, see **[docs/architecture/controllers-and-middleware.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/controllers-and-middleware.md)**.
> 🤖 **Generative AI & LLM SDK Integration**: For multi-provider orchestration (`prism-php/prism`), SSE streaming, structured output DTO schemas, RAG with vector search (`whereVectorSimilarTo`), and prompt injection defense, see **[docs/architecture/ai-sdk-and-llm-integration.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/ai-sdk-and-llm-integration.md)**.
> 🔌 **Model Context Protocol (MCP) Architecture**: For first-party MCP Servers (`laravel/mcp`), Tools, Resources, Prompts, Web SSE (`routes/ai.php`), and stdio transports, see **[docs/architecture/mcp-and-ai-protocols.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/mcp-and-ai-protocols.md)**.
> 💻 **Console Commands & Scheduling**: For CLI signature syntax, concurrency isolation (`Isolatable`), Laravel Prompts, memory safety, and `routes/console.php`, see **[docs/architecture/console-commands-and-scheduling.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/console-commands-and-scheduling.md)**.
> 💳 **Database Transactions & Concurrency**: For ACID boundaries, deadlock retry (`attempts: 3`), pessimistic row locking (`lockForUpdate`), and `afterCommit` hooks, see **[docs/architecture/database-transactions-and-concurrency.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/database-transactions-and-concurrency.md)**.
> 🎨 **Blade & Livewire (v3 & v4)**: For Blade components, slots, Alpine.js, Livewire reactive state, wire:stream AI token streaming, and Pest 3 tests, see **[docs/architecture/blade-and-livewire.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/blade-and-livewire.md)**.
> ⚡ **Inertia.js v2 Multi-Frontend SPAs**: For Vue 3 (TS), React 19/18 (TS), Svelte 5 (Runes), Deferred Props, Vite SSR, and Pest 3 tests, see **[docs/architecture/inertia-and-frontend-stacks.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/inertia-and-frontend-stacks.md)**.

---

## 1. Application Architecture: Thin Controllers & Form Requests

### The Thin Controller Contract
Controllers exist exclusively to coordinate HTTP requests. They should never:
- Execute SQL queries or call Eloquent queries directly.
- Contain business logic or calculation algorithms.
- Run inline validation (`$request->validate()`).

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Orders;

use App\Actions\Orders\CreateOrderAction;
use App\Data\CreateOrderDto;
use App\Http\Requests\Orders\CreateOrderRequest;
use App\Http\Resources\Orders\OrderResource;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

final class StoreOrderController
{
    public function __invoke(
        CreateOrderRequest $request,
        CreateOrderAction $action,
    ): JsonResponse {
        $order = $action->execute(
            user: $request->userOrFail(),
            dto: $request->toDto(),
        );

        return OrderResource::make($order)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
```

### Dedicated Form Requests
Always encapsulate input rules, authorization, and type-safe DTO conversion inside Form Requests:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Orders;

use App\Data\CreateOrderDto;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var User|null $user */
        $user = $this->user();
        return $user !== null && $user->can('create', Order::class);
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'uuid', Rule::exists('products', 'id')],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'payment_method_id' => ['required', 'string'],
        ];
    }

    public function userOrFail(): User
    {
        /** @var User|null $user */
        $user = $this->user();
        if ($user === null) {
            abort(401, 'Unauthenticated');
        }
        return $user;
    }

    public function toDto(): CreateOrderDto
    {
        /** @var array{items: list<array{product_id: string, quantity: int}>, payment_method_id: string} $data */
        $data = $this->validated();

        return CreateOrderDto::fromArray($data);
    }
}
```

---

## 2. Service Layer with PHP 8.5+ Patterns

Encapsulate domain rules inside Action classes using transactions and modern PHP 8.5 idioms:

```php
<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Data\CreateOrderDto;
use App\Enums\OrderStatus;
use App\Events\OrderCreated;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class CreateOrderAction
{
    #[\NoDiscard]
    public function execute(User $user, CreateOrderDto $dto): Order
    {
        return DB::transaction(function () use ($user, $dto): Order {
            $order = Order::query()->create([
                'user_id' => $user->id,
                'status' => OrderStatus::Pending,
                'total_amount' => $dto->calculateTotal(),
            ]);

            foreach ($dto->items as $item) {
                $order->items()->create([
                    'product_id' => $item->productId,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unitPrice,
                ]);
            }

            OrderCreated::dispatch($order);

            return $order;
        });
    }
}
```

---

## 3. Eager Loading & Preventing N+1 Queries

### Strict Global Prevention in `AppServiceProvider`
Ensure lazy loading throws exceptions in non-production environments:

```php
namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;

final class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Model::preventLazyLoading(! $this->app->isProduction());
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());
        Model::preventAccessingMissingAttributes(! $this->app->isProduction());
    }
}
```

### Eager Loading Patterns
```php
// Good: Nested eager loading with selective columns and subquery constraints
$orders = Order::query()
    ->with([
        'user:id,name,email',
        'items.product' => fn($query) => $query->select('id', 'name', 'sku'),
    ])
    ->withExists('refunds as has_refund')
    ->withCount('items')
    ->latest()
    ->paginate(20);
```

---

## 4. PHPStan / Larastan Configuration & Standards (Level 8 / Max)

All production code must pass PHPStan Level 8 or `max` with zero errors.

### Sample `phpstan.neon`
```neon
includes:
    - vendor/larastan/larastan/extension.neon

parameters:
    paths:
        - app
        - bootstrap/app.php
        - routes
    level: 8
    checkGenericClassInNonGenericObjectType: true
    checkMissingIterableValueType: true
```

### Essential PHPStan Annotations
```php
/**
 * Generic Eloquent Builder annotation
 * @extends \Illuminate\Database\Eloquent\Builder<\App\Models\Order>
 */
final class OrderQueryBuilder extends Builder {}

/**
 * Generic Collection parameter and return annotations
 * @param \Illuminate\Support\Collection<int, \App\Models\OrderItem> $items
 * @return \Illuminate\Support\Collection<string, int>
 */
public function summarizeQuantities(Collection $items): Collection {}
```

---

## 5. Background Jobs & Caching

### Job Configuration via PHP Attributes (`#[WithQueue]`)
```php
#[WithQueue(connection: 'redis', queue: 'payments', tries: 3, timeout: 120)]
final class ProcessPaymentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly Order $order) {}

    public function handle(PaymentGateway $gateway): void
    {
        $gateway->charge($this->order);
    }
}
```

### Cache Optimization with `Cache::touch()`
```php
// Refresh TTL without deserializing and re-saving
Cache::touch("session:{$sessionId}", now()->addHour());
```

---

## 6. Testing with Pest 3

```php
test('an authenticated user can create an order', function () {
    $user = User::factory()->create();
    $product = Product::factory()->create(['price' => 2000]);

    actingAs($user)
        ->postJson('/api/orders', [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
            'payment_method_id' => 'pm_card_test',
        ])
        ->assertCreated()
        ->assertJsonPath('data.total_amount', 4000);
});

arch('strict types are declared in all app files')
    ->expect('App')
    ->toUseStrictTypes();

arch('controllers must be invokable and thin')
    ->expect('App\Http\Controllers')
    ->toHaveSuffix('Controller')
    ->toBeInvokable();
```
