# Modern PHP 8.5+ & Laravel 13 Enum Architecture & Directory Organization

> **Document**: `docs/architecture/enums.md`  
> **Framework**: Laravel 13 & PHP 8.5+  
> **Key Commands**: `php artisan make:enum` with directory paths and backing flags (`--string`, `--int`).

---

## 🏛️ Executive Summary

Enums are first-class domain citizens in modern PHP 8.5+ and Laravel 13. They replace magic strings, integer status codes, and scattered arrays of constants with **type-safe, behavior-rich objects**.

In enterprise applications, enums must not be dumped into a single flat directory. This guide establishes:
1. **Directory-Based Organization (`dir base`)**: Domain-partitioned subdirectories under `app/Enums/` or modular monolith domains.
2. **Artisan CLI Generation**: Creating domain-nested enums via `php artisan make:enum`.
3. **Rich Behavioral Enums**: Pattern matching via `match ($this)` for labels, badges, and state transitions.
4. **Laravel 13 Integration**: Eloquent method casts, database migrations, Form Request rules (`Rule::enum`), and route binding.
5. **Reusable Enum Concerns**: Traits for `values()`, `options()`, and `names()`.

---

## 1. Directory-Based Organization (`dir base`)

### The Problem: Flat Directory Anti-Pattern
Placing all application enums in a single flat directory (`app/Enums/*.php`) creates chaos as applications scale beyond 20+ enums:
```text
❌ Flat Anti-Pattern:
app/Enums/
├── AccountStatus.php
├── ArticleStatus.php
├── InvoiceStatus.php
├── NotificationChannel.php
├── OrderStatus.php
├── PaymentGateway.php
├── PaymentMethod.php
├── Role.php
├── SubscriptionTier.php
└── ... (40 more files in one folder)
```

---

### The Modern Standard: Domain-Partitioned Enums
Group enums by domain boundaries inside `app/Enums/{Domain}/`:

```text
✅ Clean Domain-Based Structure:
app/
├── Enums/
│   ├── Common/                         # Cross-cutting system enums
│   │   ├── Environment.php
│   │   ├── HttpMethod.php
│   │   └── SortDirection.php
│   ├── Identity/                       # Auth & User management
│   │   ├── AccountStatus.php
│   │   ├── MfaMethod.php
│   │   └── UserRole.php
│   ├── Orders/                         # Order domain
│   │   ├── OrderStatus.php
│   │   └── ShippingMethod.php
│   ├── Payments/                       # Financial domain
│   │   ├── Currency.php
│   │   ├── PaymentGateway.php
│   │   └── PaymentStatus.php
│   └── Subscriptions/                  # Billing domain
│       ├── BillingCycle.php
│       └── SubscriptionTier.php
└── Concerns/
    └── Enums/                          # Reusable Enum traits
        ├── HasOptions.php
        └── HasValues.php
```

#### In Modular Monoliths:
If using a modular architecture (`app/Modules/`), enums reside directly in their module:
```text
app/Modules/Orders/Enums/OrderStatus.php
app/Modules/Billing/Enums/SubscriptionTier.php
```

---

## 2. Artisan CLI Generation: `php artisan make:enum`

Laravel 11, 12, and 13 provide a native `make:enum` command that supports directory paths and backing types:

### A. Subdirectory Generation (Forward Slash or Backslash)
```bash
# 1. String-backed enum in a domain subdirectory
php artisan make:enum "Orders/OrderStatus" --string

# 2. Integer-backed enum in a domain subdirectory
php artisan make:enum "Identity/UserRole" --int

# 3. Pure (unbacked) enum in a common directory
php artisan make:enum "Common/SortDirection"
```

### B. Flag Reference:
| Flag | Short | Output Syntax | Use Case |
| :--- | :--- | :--- | :--- |
| `--string` | `-s` | `enum Name: string` | Database columns, API keys, URLs, status strings. |
| `--int` | `-i` | `enum Name: int` | Bitmasks, legacy numeric status codes, priority ranks. |
| *(None)* | | `enum Name` | Pure states, internal logic, Finite State Machines (FSM). |

---

## 3. Reusable Enum Concerns (`app/Concerns/Enums/`)

Standard PHP enums lack built-in helpers to extract all raw values or generate dropdown options. Provide reusable traits:

### A. `HasValues` Concern
```php
<?php

declare(strict_types=1);

namespace App\Concerns\Enums;

use BackedEnum;

trait HasValues
{
    /**
     * @return list<string|int>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
```

### B. `HasOptions` Concern
```php
<?php

declare(strict_types=1);

namespace App\Concerns\Enums;

trait HasOptions
{
    /**
     * @return array<string|int, string>
     */
    public static function options(): array
    {
        $options = [];
        foreach (self::cases() as $case) {
            $options[$case->value] = method_exists($case, 'label')
                ? $case->label()
                : $case->name;
        }

        return $options;
    }
}
```

---

## 4. Complete Domain Example: `OrderStatus`

Here is a production-grade, behavior-rich domain enum:

```php
<?php

declare(strict_types=1);

namespace App\Enums\Orders;

use App\Concerns\Enums\HasOptions;
use App\Concerns\Enums\HasValues;

enum OrderStatus: string
{
    use HasOptions;
    use HasValues;

    case Pending = 'pending';
    case Processing = 'processing';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';
    case Refunded = 'refunded';

    /**
     * Human-readable label (supports localization).
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => __('Pending Confirmation'),
            self::Processing => __('In Fulfillment'),
            self::Shipped => __('Shipped with Carrier'),
            self::Delivered => __('Delivered to Customer'),
            self::Cancelled => __('Cancelled by Customer'),
            self::Refunded => __('Payment Refunded'),
        };
    }

    /**
     * UI Badge Styling (Tailwind CSS / Blade / Inertia).
     */
    public function badgeClasses(): string
    {
        return match ($this) {
            self::Pending => 'bg-amber-100 text-amber-800 border-amber-300',
            self::Processing => 'bg-blue-100 text-blue-800 border-blue-300',
            self::Shipped => 'bg-purple-100 text-purple-800 border-purple-300',
            self::Delivered => 'bg-emerald-100 text-emerald-800 border-emerald-300',
            self::Cancelled => 'bg-zinc-100 text-zinc-800 border-zinc-300',
            self::Refunded => 'bg-rose-100 text-rose-800 border-rose-300',
        };
    }

    /**
     * State Machine Rule: Can this order be cancelled?
     */
    public function canBeCancelled(): bool
    {
        return match ($this) {
            self::Pending, self::Processing => true,
            self::Shipped, self::Delivered, self::Cancelled, self::Refunded => false,
        };
    }

    /**
     * Valid state transitions.
     *
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Processing, self::Cancelled],
            self::Processing => [self::Shipped, self::Cancelled],
            self::Shipped => [self::Delivered],
            self::Delivered => [self::Refunded],
            self::Cancelled, self::Refunded => [],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedTransitions(), strict: true);
    }
}
```

---

## 5. Laravel 13 Ecosystem Integration

### A. Database Migrations (Varchar vs. Database ENUM)

> [!TIP]
> **Use `$table->string()` with an index**: Avoid MySQL/PostgreSQL native `ENUM('pending', ...)` columns. Native database enums lock the table when adding new values in production. A varchar column (`$table->string('status')`) with an index provides full portability, zero downtime alterations, and identical performance.

```php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            
            // Backed Enum column with indexed default
            $table->string('status')
                ->default(OrderStatus::Pending->value)
                ->index();
                
            $table->timestamps();
        });
    }
};
```

---

### B. Eloquent Model Method-Based Casts

In Laravel 13, declare enum casting in the `casts(): array` method:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Orders\OrderStatus;
use Illuminate\Database\Eloquent\Model;

final class Order extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
        ];
    }
}
```

#### Querying with Enums:
Eloquent automatically casts enums to their raw database value:
```php
// Pass enum instance directly into queries
$orders = Order::query()
    ->where('status', OrderStatus::Pending)
    ->get();
```

---

### C. Form Request Validation (`Rule::enum`)

Laravel includes native enum validation rules:

```php
use App\Enums\Orders\OrderStatus;
use Illuminate\Validation\Rule;

public function rules(): array
{
    return [
        // Any valid case in OrderStatus
        'status' => ['required', Rule::enum(OrderStatus::class)],

        // Restricted to specific cases only
        'target_status' => [
            'required',
            Rule::enum(OrderStatus::class)->only([
                OrderStatus::Processing,
                OrderStatus::Cancelled,
            ]),
        ],

        // Exclude specific cases
        'new_status' => [
            'required',
            Rule::enum(OrderStatus::class)->except([
                OrderStatus::Refunded,
            ]),
        ],
    ];
}
```

---

### D. Route Model / Enum Parameter Binding

Laravel automatically converts string route parameters into backed enum instances, returning `404 Not Found` if the value does not exist:

#### Route Definition:
```php
use App\Enums\Orders\OrderStatus;
use App\Http\Controllers\Api\V1\Orders\FilterOrdersByStatusController;
use Illuminate\Support\Facades\Route;

Route::get('/orders/status/{status}', FilterOrdersByStatusController::class)
    ->name('orders.by-status');
```

#### Invokable Controller:
```php
namespace App\Http\Controllers\Api\V1\Orders;

use App\Enums\Orders\OrderStatus;
use App\Http\Resources\Orders\OrderResource;
use App\Models\Order;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class FilterOrdersByStatusController
{
    public function __invoke(OrderStatus $status): AnonymousResourceCollection
    {
        $orders = Order::query()
            ->where('status', $status)
            ->paginate();

        return OrderResource::collection($orders);
    }
}
```

---

### E. API Resource Serialization

Never return raw enum objects or untyped strings. Expose both machine-readable values and human-readable metadata:

```php
public function toArray(Request $request): array
{
    return [
        'id' => $this->id,
        'status' => [
            'code' => $this->status->value,
            'label' => $this->status->label(),
            'badge' => $this->status->badgeClasses(),
            'can_cancel' => $this->status->canBeCancelled(),
        ],
    ];
}
```

---

## 📌 Enum Engineering Checklist

1. ✅ **Domain-Nested**: Place in `app/Enums/{Domain}/` (e.g. `Orders/OrderStatus.php`).
2. ✅ **Generated via CLI**: Use `php artisan make:enum "Domain/Name" --string`.
3. ✅ **String Backed**: Default to `--string` for database and API clarity.
4. ✅ **Method-Based Casts**: Cast in `casts(): array` via `status => OrderStatus::class`.
5. ✅ **Database Column**: Use `$table->string('status')` with index, avoiding brittle DB enums.
6. ✅ **Validation**: Validate with `Rule::enum(OrderStatus::class)`.
7. ✅ **Behavior Rich**: Use `match ($this)` for labels, badges, and state transitions.
8. ✅ **Pest Tests**: Test all transitions and cases in your unit test suite.
