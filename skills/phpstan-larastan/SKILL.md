---
name: phpstan-larastan
description: Configure, run, and resolve PHPStan and Larastan (Level 8 / max) static analysis in Laravel 13 & PHP 8.5+ applications. Use when configuring phpstan.neon, resolving static analysis errors, writing generic types for Eloquent, or adding CI verification.
---

# PHPStan & Larastan Guide (Level 8 / Max) for Laravel 13

This skill establishes the setup, configuration, and resolution strategies for achieving and maintaining PHPStan / Larastan **Level 8** (or `max`) compliance in Laravel 13 and PHP 8.5+ codebases.

---

## 1. Production `phpstan.neon` Configuration

Place `phpstan.neon` (or `phpstan.neon.dist`) in your project root:

```neon
includes:
    - vendor/larastan/larastan/extension.neon
    - phar://phpstan.phar/conf/bleedingEdge.neon

parameters:
    paths:
        - app
        - bootstrap/app.php
        - database/factories
        - database/seeders
        - routes

    # Target Level 8 or max
    level: 8

    # Strict type checks
    checkGenericClassInNonGenericObjectType: true
    checkMissingIterableValueType: true
    checkMissingCallableSignature: true
    treatPhpDocTypesAsCertain: false

    # Larastan-specific features
    checkModelProperties: true

    # Ignore false positives or legacy debt via baseline
    # baseline: phpstan-baseline.neon
```

---

## 2. Generic Types for Eloquent ORM

### Custom Query Builders
When creating custom Eloquent Builders, you must declare the model class as a generic type:

```php
<?php

declare(strict_types=1);

namespace App\Builders;

use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;

/**
 * @extends Builder<Order>
 */
final class OrderQueryBuilder extends Builder
{
    /**
     * @return self
     */
    #[\NoDiscard]
    public function completed(): self
    {
        return $this->where('status', 'completed');
    }
}
```

### Relationship Return Types
Always annotate relation return types with the target model and owner:

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class User extends Model
{
    /**
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
```

### Collections & Iterables
Specify key and value types for collections and arrays:

```php
use Illuminate\Support\Collection;

/**
 * @param Collection<int, Order> $orders
 * @return array<string, int>
 */
public function calculateUserTotals(Collection $orders): array
{
    /** @var array<string, int> */
    return $orders->groupBy('currency')
        ->map(fn(Collection $group): int => (int) $group->sum('amount'))
        ->all();
}
```

---

## 3. Resolving Common Larastan / PHPStan Pitfalls

### Pitfall 1: Authenticated User Type
**Issue:** `$request->user()` returns `\Illuminate\Contracts\Auth\Authenticatable|null`, causing method-not-found errors when accessing model properties (`$user->email`).

**Solution:** Use a typed helper or assertion in Form Requests or Controllers:
```php
/** @var \App\Models\User|null $user */
$user = $request->user();

if ($user === null) {
    abort(401, 'Unauthenticated.');
}

// Now $user is guaranteed \App\Models\User
echo $user->email;
```

Or encapsulate in a custom Form Request:
```php
public function userOrFail(): User
{
    /** @var User|null $user */
    $user = $this->user();
    assert($user instanceof User, 'Expected authenticated User model.');
    return $user;
}
```

### Pitfall 2: Nullable Query Results (`find()` vs `findOrFail()`)
**Issue:** Calling methods on `$model` after `Model::find($id)` triggers `"Cannot call method on Model|null"`.

**Solution:** Use `findOrFail()` or explicit null guards:
```php
// Good:
$user = User::query()->findOrFail($id);

// Or:
$user = User::query()->find($id);
if ($user === null) {
    throw new UserNotFoundException($id);
}
```

### Pitfall 3: Untyped Form Request Validated Data
**Issue:** `$request->validated()` returns untyped `mixed` or generic arrays.

**Solution:** Define precise array shapes or unpack into a typed DTO:
```php
/**
 * @return array{name: string, email: string, role: string}
 */
public function validatedData(): array
{
    /** @var array{name: string, email: string, role: string} */
    return $this->validated();
}
```

---

## 4. Running PHPStan & Automating in CI

### CLI Commands
```bash
# Run analysis with memory limit
./vendor/bin/phpstan analyse --memory-limit=2G

# Generate or update baseline for existing codebase
./vendor/bin/phpstan analyse --generate-baseline=phpstan-baseline.neon --memory-limit=2G

# Clear cache
./vendor/bin/phpstan clear-result-cache
```

### GitHub Actions Workflow
```yaml
name: Static Analysis

on: [push, pull_request]

jobs:
  phpstan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.5'
          extensions: mbstring, pdo, pdo_sqlite
          coverage: none

      - name: Install Dependencies
        run: composer install --prefer-dist --no-progress

      - name: Run PHPStan
        run: ./vendor/bin/phpstan analyse --error-format=github
```
