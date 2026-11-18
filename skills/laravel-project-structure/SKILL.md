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

## 5. Architectural Directory Placement Rules

Follow this strict decision matrix to determine where any newly created file belongs:

| File Type / Responsibility | Target Directory | Strict Naming Convention |
| :--- | :--- | :--- |
| Single business action / use case | `app/Actions/<Domain>/` | `<Verb><Noun>Action.php` |
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

## 6. Pest 3 Architectural Boundary Tests

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

// 3. DTOs in Data/ must be final readonly
arch('data transfer objects are immutable')
    ->expect('App\Data')
    ->toHaveSuffix('Data')
    ->toBeFinal()
    ->toBeReadonly();

// 4. Models must not be injected directly into Controllers
arch('controllers do not access models directly')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Database\Eloquent\Builder');

// 5. Zero procedural helpers
arch('no procedural helper files exist')
    ->expect('App\Helpers')
    ->not->toBeClasses();
```

---

## 7. Anti-Patterns & Prohibitions

1. **NO Miscellaneous Dumping Grounds**: Prohibit `app/Services/MiscService.php`, `app/Utils/Helper.php`, or `app/Helpers/functions.php`.
2. **NO Controller Business Logic**: Controllers must only deserialize requests, invoke an Action/DTO, and return a Resource.
3. **NO Model Bloat**: Do not put business orchestration, payment execution, or heavy queries into Eloquent models. Use Actions and Query Builders.
4. **NO View Root Sprawl**: All views must reside inside the 4-tier hierarchy (`layouts/`, `components/app/<domain>`, `components/ui`, `pages/<domain>/<feature>`). Never dump files directly in `resources/views/`.
