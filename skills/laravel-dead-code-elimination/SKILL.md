---
name: laravel-dead-code-elimination
description: Master guide and automated toolkit for dead code elimination, zombie logic detection, unused route/import pruning, legacy skeleton cleanup, Rector SetList::DEAD_CODE, and composer-unused in Laravel 13 & PHP 8.6+.
---

# Laravel 13 & PHP 8.6+ Dead Code Elimination Skill

This skill governs the systematic detection, automated deletion, and continuous prevention of dead code, zombie logic, unused imports, orphaned legacy files, and dead Composer dependencies in Laravel 13 and PHP 8.6+.

---

## 1. When to Use This Skill

Activate this skill when:
- Auditing an existing codebase for unused private methods, unused variables, dead parameters, and unreachable branches.
- Cleaning up commented-out code graveyards ("just in case we need it later").
- Purging legacy framework skeleton files after upgrading from older Laravel versions (`Kernel.php`, `Handler.php`, `RouteServiceProvider.php`).
- Removing orphaned routes, abandoned Form Requests, unused API resources, and unreferenced Blade/Livewire/Inertia components.
- Setting up or running automated dead code cleanup tools: **Rector** (`SetList::DEAD_CODE`), **Laravel Pint** (`no_unused_imports`), **PHPStan** (unreachable code), and **composer-unused**.
- Writing Pest 3 architectural boundary tests enforcing zero dead code.

---

## 2. The 5 Cardinal Rules of Dead Code Removal

1. **Zero Commented-Out Code**:
   - NEVER commit commented-out code blocks. Git history preserves past implementations. Commented-out code creates doubt, rots over time, and pollutes search results.
2. **Immediate Legacy Skeleton Deletion**:
   - Laravel 13 configures middleware, routing, and exception handling fluently in `bootstrap/app.php`. Immediately delete legacy skeleton files (`app/Http/Kernel.php`, `app/Console/Kernel.php`, `app/Exceptions/Handler.php`, `app/Providers/RouteServiceProvider.php`).
3. **Automated Dead Import Stripping**:
   - Every file must have 0 unused `use` imports or orphaned aliases. Run Laravel Pint with `"no_unused_imports": true`.
4. **Rector-Driven Dead Code Purging**:
   - Enforce `SetList::DEAD_CODE` in `rector.php` to automatically delete unused private properties, unused private methods, dead parameters, and unreferenced class constants.
5. **Dead Dependency Pruning**:
   - Detect and remove unused packages from `composer.json` using `composer-unused`.

---

## 3. Automated Dead Code Purging Toolkit

### Step 1: Automated Rector Configuration (`rector.php`)

```php
declare(strict_types=1);

use Rector\Config\RectorConfig;
use Rector\DeadCode\Rector\ClassMethod\RemoveUnusedPrivateMethodParameterRector;
use Rector\DeadCode\Rector\ClassMethod\RemoveUnusedPrivateMethodRector;
use Rector\DeadCode\Rector\Property\RemoveUnusedPrivatePropertyRector;
use Rector\Set\ValueObject\SetList;

return RectorConfig::configure()
    ->withPaths([
        __DIR__ . '/app',
        __DIR__ . '/bootstrap/app.php',
        __DIR__ . '/config',
        __DIR__ . '/routes',
        __DIR__ . '/tests',
    ])
    ->withPreparedSets(
        deadCode: true,         // Automatically strips unused private methods, dead params, unused constants
        codeQuality: true,      // Simplifies boolean logic, eliminates dead branches
        typeDeclarations: true, // Native PHP 8.6 parameter & return types
    )
    ->withSets([
        SetList::DEAD_CODE,
        SetList::PHP_84,
        SetList::PHP_85,
        SetList::PHP_86,
    ]);
```

**Running Rector**:
```bash
# Dry run to inspect candidates for deletion
vendor/bin/rector process --dry-run

# Automatically delete all dead code
vendor/bin/rector process
```

---

### Step 2: Automated Unused Import Removal with Laravel Pint (`pint.json`)

```json
{
  "preset": "laravel",
  "rules": {
    "no_unused_imports": true,
    "ordered_imports": {
      "sort_algorithm": "alpha",
      "imports_order": ["class", "function", "const"]
    },
    "single_line_after_imports": true,
    "no_empty_statement": true
  }
}
```

**Running Pint**:
```bash
# Test for unused imports in CI
vendor/bin/pint --test

# Fix and purge dead imports automatically
vendor/bin/pint
```

---

### Step 3: Unreachable Code Detection via PHPStan (`phpstan.neon`)

```neon
includes:
    - vendor/larastan/larastan/extension.neon

parameters:
    level: 8
    paths:
        - app
        - bootstrap/app.php
        - routes
    checkUninitializedProperties: true
    reportUnmatchedIgnoredErrors: true
    # Flag dead code and unreachable branches
    treatPhpDocTypesAsCertain: false
```

---

### Step 4: Dead Composer Package Auditing (`composer-unused`)

Detect unused packages bloating your `vendor/` directory:

```bash
# Install tool
composer require --dev icanhazstring/composer-unused

# Scan for packages declared in composer.json but never referenced in code
vendor/bin/composer-unused
```

---

## 4. Laravel 13 Legacy Skeleton Purging

When upgrading or auditing a Laravel application, verify that these legacy files have been completely eliminated:

| Legacy File to Delete | Modern Laravel 13 Architecture |
| :--- | :--- |
| ❌ `app/Http/Kernel.php` | Configured via `$middleware->web(...)` / `$middleware->api(...)` in `bootstrap/app.php` |
| ❌ `app/Console/Kernel.php` | Scheduled directly via `Schedule` facade in `routes/console.php` |
| ❌ `app/Exceptions/Handler.php` | Configured via `$exceptions->render(...)` in `bootstrap/app.php` |
| ❌ `app/Providers/RouteServiceProvider.php` | Configured via `withRouting(...)` in `bootstrap/app.php` |
| ❌ `app/Providers/EventServiceProvider.php` | Handled via auto-discovery or `AppServiceProvider::boot()` |
| ❌ `app/Providers/BroadcastServiceProvider.php` | Handled via `routes/channels.php` registration |

---

## 5. Unused Frontend Component & Route Pruning

Orphaned templates waste maintenance time and create security blindspots.

### Audit Checklist:
1. **Unreferenced Blade Components**: Check `resources/views/components/` against all usages (`<x-...>`). If a component is never referenced, delete it.
2. **Dead Livewire Components**: Run `php artisan livewire:layout` and inspect `app/Livewire/` for components never embedded via `<livewire:...>` or bound to routes.
3. **Dead Inertia Page Views**: Compare `resources/js/pages/` against controller `Inertia::render('...')` calls.
4. **Dead Routes**: Run `php artisan route:list` to detect routes bound to missing controllers or disabled features.

---

## 6. Continuous Dead Code CI/CD Pipeline

Add this step to your GitHub Actions workflow (`.github/workflows/ci.yml`):

```yaml
name: Codebase Hygiene & Dead Code Verification

jobs:
  dead-code-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.6'
          coverage: none

      - name: Install Dependencies
        run: composer install --prefer-dist --no-interaction --no-progress

      - name: Check Unused Imports (Pint)
        run: vendor/bin/pint --test

      - name: Check Dead Code & Unreachable Logic (Rector)
        run: vendor/bin/rector process --dry-run

      - name: Check Static Analysis & Dead Branches (PHPStan)
        run: vendor/bin/phpstan analyse --error-format=github
```

---

## 7. Pest 3 Architectural Enforcement

Add boundary tests to `tests/Feature/ArchTest.php` to prevent dead patterns from entering the codebase:

```php
declare(strict_types=1);

arch('no legacy kernel files exist')
    ->expect('App\Http\Kernel')
    ->not->toBeClasses()
    ->expect('App\Console\Kernel')
    ->not->toBeClasses()
    ->expect('App\Exceptions\Handler')
    ->not->toBeClasses();

arch('strict types are declared in all app files')
    ->expect('App')
    ->toUseStrictTypes();

arch('controllers must be invokable')
    ->expect('App\Http\Controllers')
    ->toHaveSuffix('Controller')
    ->toBeInvokable();
```
