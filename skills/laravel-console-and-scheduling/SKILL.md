---
name: laravel-console-and-scheduling
description: Master guide to Laravel 13 & PHP 8.5+ Console Commands, CLI signature syntax, concurrency isolation (Isolatable), Laravel Prompts, memory safety, and scheduled tasks in routes/console.php.
---

# Laravel Console Commands & Scheduling Skill

This skill governs the development, concurrency isolation, memory management, interactive UX, and scheduled automation of Artisan console commands in Laravel 13 and PHP 8.5+.

---

## 1. When to Use This Skill

Activate this skill when:
- Authoring custom Artisan console commands (`php artisan make:command`).
- Designing command signatures with required/optional arguments, options, flags, and shortcuts.
- Implementing concurrency locking and overlap prevention (`implements Isolatable`).
- Building interactive terminal user interfaces using **Laravel Prompts** (`text`, `select`, `confirm`, `spin`, `progress`).
- Preventing memory leaks in high-throughput CLI batch processing (`DB::disableQueryLog()`, `cursor()`, `chunkById()`).
- Defining and configuring scheduled background tasks in `routes/console.php`.
- Writing isolated, deterministic console tests in Pest 3.

---

## 2. Core Architectural Rules

1. **Naming Conventions**:
   - Command names must follow `noun:verb` colon-separated convention (e.g. `catalog:sync`, `orders:prune`, `cache:warm`).
2. **Concurrency Defense**:
   - Commands scheduled on recurring intervals must implement `Illuminate\Contracts\Console\Isolatable` to prevent race conditions and overlapping execution.
3. **Memory Safety**:
   - Long-running batch commands must call `DB::disableQueryLog()` immediately upon entry to prevent memory bloat.
   - Never use unbounded `Model::all()` or `$query->get()`; stream via `$query->cursor()` or `$query->chunkById()`.
4. **Interactive Terminal UX**:
   - Use Laravel Prompts functions (`Laravel\Prompts\*`) instead of procedural `readline()` or messy ANSI escapes.
   - Always guard interactive prompts with `app()->isProduction() && ! $this->option('no-interaction')` checks.
5. **Canonical Exit Codes**:
   - The `handle()` method must return `self::SUCCESS` (0), `self::FAILURE` (1), or `self::INVALID` (2). Never return void or boolean.
6. **Centralized Scheduling**:
   - Declare all cron schedules in `routes/console.php` using the fluent `Schedule` facade with `onOneServer()` for multi-server clusters.

---

## 3. Implementation Workflow

### Step 1: Scaffold the Command

```bash
php artisan make:command SyncCatalogCommand --command=catalog:sync
```

---

### Step 2: Implement the Command Class

```php
declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Catalog\SyncCatalogAction;
use App\Data\Catalog\SyncCatalogOptions;
use Illuminate\Console\Command;
use Illuminate\Contracts\Console\Isolatable;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Console\Attribute\AsCommand;
use Throwable;
use function Laravel\Prompts\confirm;
use function Laravel\Prompts\error;
use function Laravel\Prompts\info;
use function Laravel\Prompts\progress;
use function Laravel\Prompts\select;
use function Laravel\Prompts\spin;

#[AsCommand(
    name: 'catalog:sync',
    description: 'Synchronize products and inventory from external catalog providers.'
)]
final class SyncCatalogCommand extends Command implements Isolatable
{
    protected $signature = 'catalog:sync
                            {provider? : External provider name (stripe, shopify)}
                            {--b|--batch=500 : Batch size for database chunking}
                            {--dry-run : Simulate sync without committing mutations}';

    public int $isolationLockExpiresAt = 300;

    public function handle(SyncCatalogAction $action): int
    {
        // 1. Memory Protection: Disable query logging
        DB::disableQueryLog();

        // 2. Resolve missing arguments with Prompts
        $provider = (string) ($this->argument('provider') ?? select(
            label: 'Which catalog provider should be synchronized?',
            options: ['stripe' => 'Stripe Products', 'shopify' => 'Shopify Store'],
            default: 'stripe'
        ));

        $batchSize = max((int) ($this->option('batch') ?? 500), 50);
        $isDryRun = (bool) $this->option('dry-run');

        if ($isDryRun) {
            info('Running in DRY-RUN mode. Database records will not be altered.');
        }

        // 3. Confirm in Production
        if (app()->isProduction() && ! $this->option('no-interaction')) {
            if (! confirm(label: "Execute sync for [{$provider}] in PRODUCTION?", default: false)) {
                $this->warn('Operation cancelled by user.');
                return self::SUCCESS;
            }
        }

        $options = new SyncCatalogOptions(provider: $provider, batchSize: $batchSize, dryRun: $isDryRun);

        // 4. Remote API Fetching with Spinner
        $items = spin(
            callback: fn (): array => $action->fetchItems($options),
            message: "Fetching items from [{$provider}]..."
        );

        if (count($items) === 0) {
            $this->warn('No items found to synchronize.');
            return self::SUCCESS;
        }

        // 5. Progress Bar
        $bar = progress(label: 'Ingesting items', steps: count($items));
        $bar->start();

        try {
            foreach ($items as $item) {
                $action->syncSingleItem($item, $options);
                $bar->advance();
            }

            $bar->finish();
        } catch (Throwable $e) {
            $bar->finish();
            error("Sync failed: {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->table(
            headers: ['Metric', 'Value'],
            rows: [
                ['Provider', $provider],
                ['Items Processed', (string) count($items)],
                ['Dry Run', $isDryRun ? 'Yes' : 'No'],
                ['Peak Memory', sprintf('%.2f MB', memory_get_peak_usage(true) / 1024 / 1024)],
            ]
        );

        info('Catalog synchronization completed successfully.');

        return self::SUCCESS;
    }
}
```

---

### Step 3: Configure Scheduling (`routes/console.php`)

```php
declare(strict_types=1);

use App\Console\Commands\SyncCatalogCommand;
use Illuminate\Support\Facades\Schedule;

Schedule::command(SyncCatalogCommand::class, ['stripe'])
    ->everyTenMinutes()
    ->withoutOverlapping(expiresAt: 15)
    ->runInBackground()
    ->onOneServer()
    ->evenInMaintenanceMode()
    ->appendOutputTo(storage_path('logs/catalog-sync.log'))
    ->emailOutputOnFailure('ops@example.com');
```

---

### Step 4: Write Pest 3 Tests

```php
declare(strict_types=1);

use App\Actions\Catalog\SyncCatalogAction;
use Mockery\MockInterface;
use Symfony\Component\Console\Command\Command;

it('runs catalog sync in dry-run mode successfully', function (): void {
    $this->mock(SyncCatalogAction::class, function (MockInterface $mock): void {
        $mock->shouldReceive('fetchItems')->once()->andReturn([['id' => 'prod_1']]);
        $mock->shouldReceive('syncSingleItem')->once();
    });

    $this->artisan('catalog:sync', ['provider' => 'stripe', '--dry-run' => true])
        ->expectsOutputToContain('DRY-RUN mode')
        ->expectsOutputToContain('completed successfully')
        ->assertExitCode(Command::SUCCESS);
});
```

---

## 4. Architectural Reference

For complete concurrency isolation mechanics, scheduling options, and benchmark telemetry:
- **[docs/architecture/console-commands-and-scheduling.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/console-commands-and-scheduling.md)**
