# Modern PHP 8.5+ & Laravel 13 Clean Code, DRY & Trait Architecture

> **Document**: `docs/architecture/clean-code-and-concerns.md`  
> **Framework**: Laravel 13 & PHP 8.5+  
> **Focus**: DRY Principles, Trait Organization (`Concerns/`), DTOs, Pipe Pipelines, and Anti-Patterns.

---

## 1. The Modern DRY Principle: Pragmatic Abstraction

The classic DRY (*Don't Repeat Yourself*) principle is often misinterpreted as *"never write duplicate lines of code"*, which leads to premature, tangled abstractions.

### The Rule of Three & AHA (*Avoid Hasty Abstractions*)
1. **First Occurrence**: Write clean, inline code.
2. **Second Occurrence**: Tolerate slight duplication (duplication is far cheaper than the wrong abstraction).
3. **Third Occurrence**: Extract a reusable **Action class**, **Value Object**, or **Trait**.

> [!TIP]
> **Knowledge Duplication vs. Code Duplication**:
> Only abstract when the **business concept / domain rule** is identical. If two features accidentally share 5 lines of array mapping but evolve for different business reasons, keep them separate.

---

## 2. Trait Architecture: The `Concerns/` Pattern

In modern Laravel, traits are referred to as **Concerns** and represent horizontal, cross-cutting capabilities.

### A. Directory Structure
Never dump traits in a generic `app/Traits/` junk drawer. Group them by their architectural domain:

```text
app/
├── Concerns/                       # Cross-cutting application concerns
│   ├── TracksActivity.php
│   └── InteractsWithTenant.php
├── Models/
│   └── Concerns/                   # Eloquent-specific concerns
│       ├── HasUlids.php
│       ├── HasSlug.php
│       ├── HasMetadata.php
│       └── SoftDeletesTenant.php
└── Http/
    └── Concerns/                   # HTTP / Request concerns
        └── AuthorizesRoleAbilities.php
```

---

### B. Eloquent Bootable Traits (`boot` & `initialize`)

Laravel automatically invokes `boot[TraitName]()` when a model boots and `initialize[TraitName]()` when an instance is instantiated.

#### Example: Clean `HasSlug` Concern
```php
<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

trait HasSlug
{
    /**
     * Boot the trait and register model lifecycle hooks.
     */
    public static function bootHasSlug(): void
    {
        static::creating(function (Model $model): void {
            $sourceColumn = $model->slugSourceColumn();
            $slugColumn = $model->slugTargetColumn();

            if (empty($model->{$slugColumn}) && ! empty($model->{$sourceColumn})) {
                $model->{$slugColumn} = Str::slug((string) $model->{$sourceColumn});
            }
        });
    }

    /**
     * Customizable hook for the source attribute.
     */
    public function slugSourceColumn(): string
    {
        return 'title';
    }

    /**
     * Customizable hook for the target slug column.
     */
    public function slugTargetColumn(): string
    {
        return 'slug';
    }
}
```

#### Usage in Model:
```php
namespace App\Models;

use App\Models\Concerns\HasSlug;
use Illuminate\Database\Eloquent\Model;

class Article extends Model
{
    use HasSlug;

    // Optionally override the source column
    public function slugSourceColumn(): string
    {
        return 'headline';
    }
}
```

---

### C. Traits vs. Composition: When NOT to Use Traits

| Situation | Use a Trait (`Concerns/`) | Use an Action / Service Class |
| :--- | :---: | :---: |
| **Model lifecycle hooks** (`creating`, `saving`) | ✅ Yes | ❌ No |
| **Cross-cutting Eloquent scopes** (`scopeActive`) | ✅ Yes | ❌ No |
| **Multi-step business algorithms** (e.g. checkout, payout) | ❌ **Anti-Pattern** | ✅ **Yes (Dedicated Action)** |
| **Third-party API communication** (Stripe, Twilio) | ❌ **Anti-Pattern** | ✅ **Yes (Gateway / Service)** |
| **Validation & input normalization** | ❌ **Anti-Pattern** | ✅ **Yes (Form Request / DTO)** |

> [!CAUTION]
> **The Junk Drawer Anti-Pattern**: Never create a trait called `GeneralHelperTrait` or `UtilsTrait`. Traits that bundle unrelated utility methods create invisible coupling and make static analysis impossible.

---

## 3. Strong Typing with DTOs & Value Objects

Replace untyped associative arrays (`$data['amount']`) with immutable Data Transfer Objects and Value Objects:

```php
<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\OrderStatus;

final readonly class OrderDto
{
    /**
     * @param list<array{product_id: string, quantity: int}> $items
     */
    public function __construct(
        public string $customerId,
        public int $subtotalInCents,
        public int $taxInCents,
        public OrderStatus $status = OrderStatus::Pending,
        public array $items = [],
    ) {}

    // Computed total
    public int $totalInCents {
        get => $this->subtotalInCents + $this->taxInCents;
    }

    /**
     * PHP 8.5+ Clone-With syntax for non-destructive mutation
     */
    #[\NoDiscard]
    public function withStatus(OrderStatus $newStatus): self
    {
        return clone $this with (status: $newStatus);
    }
}
```

---

## 4. Modern Data Pipelines with the PHP 8.5+ Pipe Operator (`|>`)

Avoid messy intermediate variables or nested function calls by chaining transformations with the native pipe operator:

```php
<?php

declare(strict_types=1);

namespace App\Actions\Content;

final readonly class NormalizeArticleContentAction
{
    #[\NoDiscard]
    public function execute(string $rawInput): string
    {
        // Left-to-right readable transformation pipeline
        return $rawInput
            |> trim(...)
            |> strip_tags(...)
            |> (fn(string $s): string => preg_replace('/\s+/', ' ', $s) ?? '')
            |> (fn(string $s): string => Str::limit($s, 500));
    }
}
```

---

## 5. Backed Enums with Behavior

Replace magic strings and numeric constants with rich backed enums that carry behavior and domain rules:

```php
<?php

declare(strict_types=1);

namespace App\Enums;

enum SubscriptionTier: string
{
    case Free = 'free';
    case Starter = 'starter';
    case Pro = 'pro';
    case Enterprise = 'enterprise';

    public function maxProjects(): int
    {
        return match ($this) {
            self::Free => 1,
            self::Starter => 5,
            self::Pro => 25,
            self::Enterprise => PHP_INT_MAX,
        };
    }

    public function allowsCustomDomains(): bool
    {
        return match ($this) {
            self::Free, self::Starter => false,
            self::Pro, self::Enterprise => true,
        };
    }
}
```

---

## 6. Automated Code Style Enforcement with Laravel Pint

Standardize code formatting across the team using Laravel Pint.

### Recommended `pint.json`
```json
{
    "preset": "laravel",
    "rules": {
        "declare_strict_types": true,
        "final_class": false,
        "ordered_imports": {
            "sort_algorithm": "alpha"
        },
        "no_unused_imports": true,
        "trailing_comma_in_multiline": true,
        "single_line_empty_body": true
    }
}
```

### CLI Commands:
```bash
# Check code style without modifying files
./vendor/bin/pint --test

# Automatically fix all code style issues
./vendor/bin/pint
```

---

## 📌 Clean Code Checklist

1. ✅ **Strict Types**: Always start every file with `declare(strict_types=1);`.
2. ✅ **Concerns Directory**: Place reusable traits in `app/Concerns/` or `app/Models/Concerns/`.
3. ✅ **No Junk Traits**: Traits must represent a single, focused capability (`HasSlug`, `TracksActivity`).
4. ✅ **DTOs over Arrays**: Pass typed DTOs into Actions rather than unstructured arrays.
5. ✅ **Pipe Operator (`|>`)**: Use native PHP 8.5 pipes for string/array data transformations.
6. ✅ **Backed Enums**: Replace constants and status strings with type-safe Enums.
7. ✅ **Pint & PHPStan**: Enforce style via Pint and static analysis via PHPStan Level 8.
