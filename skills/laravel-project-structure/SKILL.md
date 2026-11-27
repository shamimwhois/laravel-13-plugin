---
name: laravel-project-structure
description: Master blueprints, directory tree patterns, and canonical folder hierarchies for Laravel 13 & PHP 8.6+ architectural paradigms (Action-Driven Monolith, Domain-Driven Design, Modular Monolith, Hexagonal/Ports & Adapters, CQRS, and Clean Architecture).
---

# Architectural Base Project Directory Tree Patterns & Guidelines

This skill provides production-grade directory tree patterns and codebase organization blueprints for **Laravel 13** and **PHP 8.6+**. It eliminates structural ambiguity by codifying where every class, configuration, contract, and asset belongs across all major software architecture paradigms.

---

## 🧭 Architectural Paradigm Directory Matrix

| Architecture Pattern | Root Codebase Namespace | Primary Business Logic Location | Data Transfer Layer | Infrastructure & Persistence |
| :--- | :--- | :--- | :--- | :--- |
| **Action-Driven Monolith** *(Default)* | `App\` under `app/` | `app/Actions/<Domain>/` | `app/Data/<Domain>/` | `app/Models/` + `app/Builders/` |
| **Service-Class Oriented Monolith** | `App\` under `app/` | `app/Services/<Domain>/` | `app/Data/<Domain>/` | `app/Models/` + `app/Repositories/` (or Builders) |
| **Modular Monolith** | `Modules\<Domain>\` under `modules/` | `modules/<Domain>/src/Actions/` | `modules/<Domain>/src/Data/` | `modules/<Domain>/src/Models/` |
| **Domain-Driven Design (DDD)** | `Domain\` & `Application\` under `src/` | `src/Domain/<Domain>/` & `src/Application/<Domain>/` | `src/Application/<Domain>/Data/` | `src/Infrastructure/<Domain>/` |
| **Hexagonal (Ports & Adapters)** | `Core\` & `Adapters\` under `src/` | `src/Core/Domain/` & `src/Core/UseCases/` | `src/Core/DTO/` | `src/Adapters/Secondary/` |
| **CQRS Architecture** | `App\` under `app/` | `app/Commands/` & `app/Queries/` | `app/Data/` (Command/Query DTOs) | `app/Projections/` & `app/ReadModels/` |

---

## 1. Pattern A: Modern Action-Driven Monolith (Default Standard)

This is the canonical, battle-tested standard for modern Laravel 13 applications. It replaces bloated controllers and God services with granular, single-responsibility **Action classes** and strongly-typed **DTOs**.

### Complete Canonical Tree

```text
my-laravel-app/
├── app/
│   ├── Actions/                        # Single-responsibility business logic units
│   │   ├── Auth/
│   │   │   ├── RegisterUserAction.php
│   │   │   └── ResetPasswordAction.php
│   │   └── Orders/
│   │       ├── CreateOrderAction.php
│   │       ├── ProcessPaymentAction.php
│   │       └── CancelOrderAction.php
│   ├── Ai/                             # First-party laravel/ai autonomous agents & tools
│   │   ├── Agents/
│   │   │   ├── SupportAssistant.php
│   │   │   └── OrderAuditorAgent.php
│   │   └── Tools/
│   │       ├── LookupInventoryTool.php
│   │       └── RefundPaymentTool.php
│   ├── Builders/                       # Dedicated Eloquent custom query builders
│   │   ├── OrderQueryBuilder.php
│   │   └── UserQueryBuilder.php
│   ├── Concerns/                       # Pure reusable traits isolated by capability
│   │   ├── HasUlids.php
│   │   ├── InteractsWithStripe.php
│   │   └── LogsActivity.php
│   ├── Contracts/                      # Domain & infrastructure interface abstractions
│   │   ├── PaymentGatewayInterface.php
│   │   └── TaxCalculatorInterface.php
│   ├── Data/                           # Strongly-typed immutable DTOs (final readonly class)
│   │   ├── Auth/
│   │   │   └── RegisterUserData.php
│   │   └── Orders/
│   │       ├── CreateOrderData.php
│   │       ├── OrderItemData.php
│   │       └── PaymentDetailsData.php
│   ├── Enums/                          # Backed enums with domain methods
│   │   ├── OrderStatus.php
│   │   ├── PaymentMethod.php
│   │   └── UserRole.php
│   ├── Events/                         # Domain event payloads
│   │   └── Orders/
│   │       ├── OrderCreated.php
│   │       └── OrderCancelled.php
│   ├── Exceptions/                     # Domain & application-specific exceptions
│   │   ├── Orders/
│   │   │   ├── OrderNotFoundException.php
│   │   │   └── InsufficientInventoryException.php
│   │   └── Payments/
│   │       └── PaymentGatewayUnavailableException.php
│   ├── Http/
│   │   ├── Controllers/                # Single-Action Invokables (__invoke) ONLY
│   │   │   ├── Api/
│   │   │   │   └── V1/
│   │   │   │       └── Orders/
│   │   │   │           ├── StoreOrderController.php
│   │   │   │           ├── ShowOrderController.php
│   │   │   │           └── CancelOrderController.php
│   │   │   └── Web/
│   │   │       ├── CheckoutController.php
│   │   │       └── DashboardController.php
│   │   ├── Middleware/                 # Terminable & request transformation middleware
│   │   │   ├── EnsureAccountIsActive.php
│   │   │   └── SetTenantContext.php
│   │   ├── Requests/                   # Form requests with authorize() & rules()
│   │   │   ├── Api/
│   │   │   │   └── V1/
│   │   │   │       └── Orders/
│   │   │   │           ├── StoreOrderRequest.php
│   │   │   │           └── CancelOrderRequest.php
│   │   │   └── Web/
│   │   │       └── CheckoutRequest.php
│   │   └── Resources/                  # JsonResource transformations
│   │       └── V1/
│   │           └── Orders/
│   │               ├── OrderResource.php
│   │               └── OrderItemResource.php
│   ├── Jobs/                           # Queued asynchronous background tasks
│   │   └── Orders/
│   │       ├── GenerateOrderPdfJob.php
│   │       └── SyncOrderToErpJob.php
│   ├── Listeners/                      # Asynchronous event listeners
│   │   └── Orders/
│   │       ├── SendOrderConfirmationNotification.php
│   │       └── NotifyWarehouseListener.php
│   ├── Mail/                           # Mailable classes
│   │   └── OrderReceiptMailable.php
│   ├── Mcp/                            # First-party laravel/mcp Server & Tools
│   │   ├── Prompts/
│   │   │   └── OrderAnalysisPrompt.php
│   │   ├── Resources/
│   │   │   └── OrderSummaryResource.php
│   │   ├── Servers/
│   │   │   └── OrderMcpServer.php
│   │   └── Tools/
│   │       └── FetchOrderMetricsTool.php
│   ├── Models/                         # Eloquent Models (PHP 8 attributes, thin)
│   │   ├── Order.php
│   │   ├── OrderItem.php
│   │   └── User.php
│   ├── Notifications/                  # Cross-channel notifications (Mail, SMS, Slack)
│   │   └── OrderShippedNotification.php
│   ├── Policies/                       # Granular authorization gates
│   │   └── OrderPolicy.php
│   ├── Rules/                          # Custom validation rules
│   │   ├── ValidVatNumber.php
│   │   └── SkuInventoryAvailable.php
│   ├── Services/                       # External 3rd party SDK adapters ONLY
│   │   ├── Stripe/
│   │   │   └── StripePaymentGateway.php
│   │   └── Fedex/
│   │       └── FedexShippingClient.php
│   └── Support/                        # Pure static algorithmic & mathematical helpers
│       ├── CurrencyFormatter.php
│       └── TaxEngine.php
├── bootstrap/
│   ├── app.php                         # Fluent application builder (routes, middleware, exceptions)
│   └── providers.php                   # Registered service providers list
├── config/                             # Application configurations
│   ├── ai.php
│   ├── app.php
│   ├── database.php
│   └── services.php
├── database/
│   ├── factories/                      # Model test factories
│   │   ├── OrderFactory.php
│   │   └── UserFactory.php
│   ├── migrations/                     # Anonymous database migrations
│   │   ├── 2026_01_01_000001_create_users_table.php
│   │   └── 2026_01_01_000002_create_orders_table.php
│   └── seeders/                        # Database seeders
│       ├── DatabaseSeeder.php
│       └── OrderSeeder.php
├── resources/
│   ├── js/                             # Inertia.js SPAs (Vue 3 / React 19 / Svelte 5)
│   │   ├── components/
│   │   │   ├── app/                    # Tier 2: Domain chrome
│   │   │   │   ├── admin/
│   │   │   │   │   ├── AdminHeader.vue
│   │   │   │   │   └── AdminSidebar.vue
│   │   │   │   └── customer/
│   │   │   │       ├── CustomerHeader.vue
│   │   │   │       └── CustomerNav.vue
│   │   │   ├── icon/                   # Tier 3: SVG Glyphs
│   │   │   │   └── SearchIcon.vue
│   │   │   └── ui/                     # Tier 3: Reusable UI Design Tokens
│   │   │       ├── Button.vue
│   │   │       └── Modal.vue
│   │   ├── layouts/                    # Tier 1: Master Shells
│   │   │   ├── AdminLayout.vue
│   │   │   ├── AppLayout.vue
│   │   │   └── AuthLayout.vue
│   │   ├── pages/                      # Tier 4: Concrete Feature Pages
│   │   │   ├── admin/
│   │   │   │   └── dashboard/
│   │   │   │       └── Index.vue
│   │   │   └── customer/
│   │   │       └── orders/
│   │   │           ├── Index.vue
│   │   │           └── Show.vue
│   │   └── app.ts
│   └── views/                          # Blade & Livewire Server Templates
│       ├── components/
│       │   ├── app/                    # Tier 2: Domain chrome
│       │   │   ├── admin/
│       │   │   │   ├── header.blade.php
│       │   │   │   ├── nav.blade.php
│       │   │   │   └── sidebar.blade.php
│       │   │   └── customer/
│       │   │       ├── header.blade.php
│       │   │       └── nav.blade.php
│       │   ├── icon/                   # Tier 3: SVG Glyphs
│       │   │   ├── search.blade.php
│       │   │   └── user.blade.php
│       │   └── ui/                     # Tier 3: Reusable UI Components
│       │       ├── button.blade.php
│       │       └── modal.blade.php
│       ├── layouts/                    # Tier 1: Master Shells
│       │   ├── admin.blade.php
│       │   ├── app.blade.php
│       │   ├── auth.blade.php
│       │   └── customer.blade.php
│       └── pages/                      # Tier 4: Concrete Pages
│           ├── admin/
│           │   └── dashboard/
│           │       └── index.blade.php
│           └── customer/
│               └── orders/
│                   ├── index.blade.php
│                   └── show.blade.php
├── routes/
│   ├── ai.php                          # Model Context Protocol web SSE endpoints
│   ├── api.php                         # Versioned stateless REST API routes
│   ├── console.php                     # Artisan commands & scheduled tasks
│   └── web.php                         # Session-based web routes
└── tests/
    ├── Arch/                           # Pest 3 Architectural Boundary Tests
    │   ├── ArchitectureTest.php
    │   └── SecurityTest.php
    ├── Feature/                        # HTTP & Integration Tests
    │   └── Orders/
    │       ├── CreateOrderTest.php
    │       └── CancelOrderTest.php
    └── Unit/                           # Pure isolated Unit Tests
        ├── Actions/
        │   └── CreateOrderActionTest.php
        └── Data/
            └── OrderDataTest.php
```

---

## 2. Pattern B: Modular Monolith Directory Architecture

Ideal for medium-to-large engineering teams requiring bounded contexts, clear domain encapsulation, and decoupled development without the distributed operational overhead of microservices.

### Directory Structure

```text
my-modular-app/
├── app/                                # Core shared kernel only
│   ├── Concerns/
│   ├── Contracts/
│   ├── Support/
│   └── Providers/
│       └── AppServiceProvider.php
├── modules/
│   ├── Billing/                        # Bounded Context: Billing
│   │   ├── config/
│   │   │   └── billing.php
│   │   ├── database/
│   │   │   ├── factories/
│   │   │   └── migrations/
│   │   ├── resources/
│   │   │   └── views/
│   │   ├── routes/
│   │   │   ├── api.php
│   │   │   └── web.php
│   │   ├── src/
│   │   │   ├── Actions/
│   │   │   ├── Contracts/              # Public contracts exposed to other modules
│   │   │   ├── Data/
│   │   │   ├── Events/
│   │   │   ├── Exceptions/
│   │   │   ├── Http/
│   │   │   │   ├── Controllers/
│   │   │   │   ├── Requests/
│   │   │   │   └── Resources/
│   │   │   ├── Jobs/
│   │   │   ├── Models/
│   │   │   ├── Policies/
│   │   │   └── Providers/
│   │   │       └── BillingServiceProvider.php
│   │   └── tests/
│   │       ├── Feature/
│   │       └── Unit/
│   ├── Identity/                       # Bounded Context: Users, Auth, Roles
│   │   └── ...
│   ├── Inventory/                      # Bounded Context: Products, Stock
│   │   └── ...
│   └── Orders/                         # Bounded Context: Cart, Checkout, Fulfillment
│       └── ...
├── bootstrap/
│   ├── app.php
│   └── providers.php
└── tests/
    └── Arch/
        └── ModularBoundariesTest.php   # Strictly prevents cross-module private leaks
```

### Module Boundary Isolation Rule
- Modules communicate **exclusively** via:
  1. Synchronous Public Interface Contracts in `modules/<Module>/src/Contracts/`
  2. Asynchronous Domain Events dispatched onto the Laravel Event bus
- A module must **NEVER** directly query another module's Eloquent Models or database tables.

---

## 3. Pattern C: Domain-Driven Design (DDD) Directory Architecture

For high-complexity enterprise applications with deeply nuanced business rules, regulatory invariants, and rich behavioral models.

### Directory Structure

```text
my-ddd-app/
├── app/                                # Delivery Layer (HTTP, Console, Queue Workers)
│   ├── Console/
│   │   └── Commands/
│   └── Http/
│       ├── Controllers/
│       │   └── Order/
│       │       └── CreateOrderController.php
│       ├── Requests/
│       │   └── Order/
│       │       └── CreateOrderRequest.php
│       └── Resources/
│           └── Order/
│               └── OrderResource.php
├── src/
│   ├── Application/                    # Orchestration & Use Case Execution
│   │   └── Order/
│   │       ├── Commands/
│   │       │   ├── CreateOrderCommand.php
│   │       │   └── Handlers/
│   │       │       └── CreateOrderHandler.php
│   │       ├── Data/
│   │       │   └── OrderPayloadData.php
│   │       └── Queries/
│   │           ├── GetOrderByIdQuery.php
│   │           └── Handlers/
│   │               └── GetOrderByIdHandler.php
│   ├── Domain/                         # Pure Business Logic (Framework-Agnostic)
│   │   └── Order/
│   │       ├── Entities/
│   │       │   └── OrderItem.php
│   │       ├── Aggregates/
│   │       │   └── Order.php           # Encapsulates business invariants
│   │       ├── ValueObjects/
│   │       │   ├── Money.php
│   │       │   ├── OrderNumber.php
│   │       │   └── Quantity.php
│   │       ├── Events/
│   │       │   └── OrderPlacedEvent.php
│   │       ├── Exceptions/
│   │       │   └── NegativeQuantityException.php
│   │       └── Repositories/
│   │           └── OrderRepositoryInterface.php
│   └── Infrastructure/                 # Persistence, External APIs, Drivers
│       └── Order/
│           ├── Persistence/
│           │   ├── EloquentOrderModel.php
│           │   └── EloquentOrderRepository.php
│           └── Gateways/
│               └── StripePaymentGateway.php
```

---

## 4. Pattern D: Hexagonal (Ports & Adapters) Directory Architecture

Decouples the core domain entirely from external drivers, frameworks, and storage engines.

```text
src/
├── Core/
│   ├── Domain/                         # Pure Entities & Value Objects
│   │   ├── Model/
│   │   │   └── Account.php
│   │   └── ValueObject/
│   │       └── AccountId.php
│   └── Ports/
│       ├── Inbound/                    # Driving Ports (Use Cases invoked by UI/CLI)
│       │   ├── TransferFundsUseCaseInterface.php
│       │   └── DTO/
│       │       └── TransferFundsCommand.php
│       └── Outbound/                   # Driven Ports (SPI invoked by Core)
│           ├── AccountRepositoryPort.php
│           └── NotificationSenderPort.php
└── Adapters/
    ├── Primary/                        # Driving Adapters (Inbound entrypoints)
    │   ├── Http/
    │   │   ├── Controllers/
    │   │   └── Requests/
    │   └── Console/
    │       └── TransferFundsCommand.php
    └── Secondary/                      # Driven Adapters (Outbound implementations)
        ├── Persistence/
        │   └── EloquentAccountRepositoryAdapter.php
        └── Notifications/
            └── TwilioSmsSenderAdapter.php
```

---

## 5. Pattern E: Service-Class Oriented Monolith Directory Architecture

The **Service-Class Oriented Monolith** organizes business logic into cohesive, domain-scoped Service classes implementing explicit interfaces. It is ideal for applications where operations span multiple models, external services, and coordinated database transactions.

### Canonical Directory Blueprint

```text
my-service-monolith/
├── app/
│   ├── Contracts/
│   │   └── Services/                   # Public Interface Contracts for IoC Container
│   │       ├── Billing/
│   │       │   ├── PaymentGatewayServiceInterface.php
│   │       │   └── SubscriptionServiceInterface.php
│   │       └── Orders/
│   │           ├── OrderCreationServiceInterface.php
│   │           ├── OrderFulfillmentServiceInterface.php
│   │           └── OrderPricingServiceInterface.php
│   ├── Services/                       # Concrete Domain Service Implementations
│   │   ├── Billing/
│   │   │   ├── StripePaymentService.php
│   │   │   └── SubscriptionService.php
│   │   └── Orders/
│   │       ├── OrderCreationService.php
│   │       ├── OrderFulfillmentService.php
│   │       └── OrderPricingService.php
│   ├── Data/                           # Strongly-typed immutable DTOs passed into Services
│   │   ├── Billing/
│   │   │   └── ChargeCustomerData.php
│   │   └── Orders/
│   │       ├── CreateOrderData.php
│   │       ├── FulfillmentData.php
│   │       └── OrderPricingData.php
│   ├── Repositories/                   # Optional: Data Access Layer (or custom Query Builders)
│   │   ├── Contracts/
│   │   │   └── OrderRepositoryInterface.php
│   │   └── Eloquent/
│   │       └── EloquentOrderRepository.php
│   ├── Builders/                       # Eloquent Custom Query Builders
│   │   └── OrderQueryBuilder.php
│   ├── Models/                         # Thin Eloquent Models
│   │   ├── Order.php
│   │   └── OrderItem.php
│   ├── Http/
│   │   ├── Controllers/                # Thin Invokable Controllers injecting Service Interfaces
│   │   │   └── Api/
│   │   │       └── V1/
│   │   │           └── Orders/
│   │   │               ├── StoreOrderController.php
│   │   │               └── FulfillOrderController.php
│   │   ├── Requests/                   # Form Requests transforming into DTOs
│   │   │   └── Orders/
│   │   │       ├── StoreOrderRequest.php
│   │   │       └── FulfillOrderRequest.php
│   │   └── Resources/                  # JsonResource serialization
│   │       └── Orders/
│   │           └── OrderResource.php
│   └── Providers/
│       └── AppServiceProvider.php       # Binds Service Interfaces to Implementations
```

### Modern PHP 8.6+ Service Implementation Pattern

```php
<?php

declare(strict_types=1);

namespace App\Services\Orders;

use App\Contracts\Services\Billing\PaymentGatewayServiceInterface;
use App\Contracts\Services\Orders\OrderCreationServiceInterface;
use App\Data\Orders\CreateOrderData;
use App\Enums\OrderStatus;
use App\Events\Orders\OrderCreated;
use App\Exceptions\Orders\InsufficientInventoryException;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Facades\DB;
use Override;
use Throwable;

final readonly class OrderCreationService implements OrderCreationServiceInterface
{
    public function __construct(
        private PaymentGatewayServiceInterface $paymentGateway,
        private Dispatcher $events,
    ) {}

    #[Override]
    public function create(CreateOrderData $data): Order
    {
        return DB::transaction(attempts: 3, callback: function () use ($data): Order {
            // 1. Verify business invariants
            $order = Order::create([
                'user_id' => $data->userId,
                'status' => OrderStatus::Pending,
                'total_amount' => $data->totalAmount,
            ]);

            foreach ($data->items as $item) {
                $order->items()->create([
                    'product_id' => $item->productId,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unitPrice,
                ]);
            }

            // 2. Execute payment via injected service
            $this->paymentGateway->charge($order, $data->payment);

            // 3. Dispatch domain event post-commit
            DB::afterCommit(fn() => $this->events->dispatch(new OrderCreated($order)));

            return $order;
        });
    }
}
```

### Dependency Injection in Thin Single-Action Controllers

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Orders;

use App\Contracts\Services\Orders\OrderCreationServiceInterface;
use App\Http\Requests\Orders\StoreOrderRequest;
use App\Http\Resources\Orders\OrderResource;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

final readonly class StoreOrderController
{
    public function __construct(
        private OrderCreationServiceInterface $orderService,
    ) {}

    public function __invoke(StoreOrderRequest $request): JsonResponse
    {
        $order = $this->orderService->create($request->toDto());

        return (new OrderResource($order))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
```

### IoC Service Binding (`bootstrap/providers.php` or `AppServiceProvider.php`)

```php
// In app/Providers/AppServiceProvider.php:
use App\Contracts\Services\Orders\OrderCreationServiceInterface;
use App\Services\Orders\OrderCreationService;

public function register(): void
{
    $this->app->bind(
        OrderCreationServiceInterface::class,
        OrderCreationService::class,
    );
}
```

---

## 6. Architectural Directory Placement Rules

Follow this strict decision matrix to determine where any newly created file belongs:

| File Type / Responsibility | Target Directory | Strict Naming Convention |
| :--- | :--- | :--- |
| Single business action / use case | `app/Actions/<Domain>/` | `<Verb><Noun>Action.php` |
| Cohesive multi-step domain service | `app/Services/<Domain>/` | `<Domain><Capability>Service.php` |
| Service interface contract | `app/Contracts/Services/<Domain>/` | `<Capability>ServiceInterface.php` |
| Strongly typed immutable payload | `app/Data/<Domain>/` | `<Noun>Data.php` |
| Custom Eloquent query builder | `app/Builders/` | `<Model>QueryBuilder.php` |
| Single-action HTTP controller | `app/Http/Controllers/<Namespace>/` | `<Verb><Noun>Controller.php` |
| Request validation & auth | `app/Http/Requests/<Domain>/` | `<Verb><Noun>Request.php` |
| API output JSON serialization | `app/Http/Resources/<Version>/<Domain>/` | `<Noun>Resource.php` |
| Asynchronous queue task | `app/Jobs/<Domain>/` | `<Verb><Noun>Job.php` |
| Domain event | `app/Events/<Domain>/` | `<Noun><PastTenseVerb>.php` |
| Event listener | `app/Listeners/<Domain>/` | `<Verb><Target>Listener.php` |
| Eloquent Model | `app/Models/` | `<SingularNoun>.php` |
| Domain Backed Enum | `app/Enums/` | `<Noun>Status.php` / `<Noun>Type.php` |
| 3rd-party vendor SDK wrapper | `app/Services/<Vendor>/` | `<Vendor><Capability>Client.php` |
| Pure static mathematical helper | `app/Support/` | `<Noun>Formatter.php` / `<Engine>.php` |
| Autonomous AI Agent | `app/Ai/Agents/` | `<Role>Agent.php` |
| AI / MCP Function Tool | `app/Ai/Tools/` or `app/Mcp/Tools/` | `<Verb><Noun>Tool.php` |
| MCP Server Coordinator | `app/Mcp/Servers/` | `<Domain>McpServer.php` |
| MCP URI Resource | `app/Mcp/Resources/` | `<Noun>Resource.php` |

---

## 7. Pest 3 Architectural Boundary Tests

Ensure codebase integrity by placing automated tests in `tests/Arch/ArchitectureTest.php`:

```php
declare(strict_types=1);

// 1. Controllers must remain invokable and reside in Http/Controllers
arch('controllers are invokable and reside in Http/Controllers')
    ->expect('App\Http\Controllers')
    ->toHaveSuffix('Controller')
    ->toBeInvokable();

// 2. Actions must be final and reside in Actions/
arch('actions are final and invokable')
    ->expect('App\Actions')
    ->toHaveSuffix('Action')
    ->toBeFinal()
    ->toBeInvokable();

// 3. Services must implement an interface and reside in Services/
arch('services implement their contract interface')
    ->expect('App\Services')
    ->toHaveSuffix('Service')
    ->toBeFinal()
    ->toImplement('App\Contracts\Services');

// 4. DTOs in Data/ must be final readonly
arch('data transfer objects are immutable')
    ->expect('App\Data')
    ->toHaveSuffix('Data')
    ->toBeFinal()
    ->toBeReadonly();

// 5. Models must not be injected directly into Controllers
arch('controllers do not access models directly')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Database\Eloquent\Builder');

// 6. Zero procedural helpers
arch('no procedural helper files exist')
    ->expect('App\Helpers')
    ->not->toBeClasses();
```

---

## 8. Anti-Patterns & Prohibitions

1. **NO "God" Services**: Never build `app/Services/OrderService.php` with 30 unrelated methods. Split by cohesive capability: `OrderCreationService`, `OrderFulfillmentService`, `OrderPricingService`.
2. **NO Controllers with Business Logic**: Controllers must only deserialize requests, invoke an Action/Service via its Interface, and return a Resource.
3. **NO Untyped Array Passing**: Services must strictly receive and return typed DTOs (`final readonly class`) or Eloquent Models, never raw `$request->all()`.
4. **NO View Root Sprawl**: All views must reside inside the 4-tier hierarchy (`layouts/`, `components/app/<domain>`, `components/ui`, `pages/<domain>/<feature>`). Never dump files directly in `resources/views/`.
