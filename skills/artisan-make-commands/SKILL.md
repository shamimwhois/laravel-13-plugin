---
name: artisan-make-commands
description: Complete catalog of all 30+ Laravel 13 `php artisan make:*` generator commands with CLI syntax, options, PHP 8.5+ code examples, and architectural rules. Use when generating or scaffolding any Laravel component.
---

# Master Catalog: Laravel 13 Artisan `make:*` Commands, Examples & Rules

This document provides the exhaustive directory of all `php artisan make:*` commands in Laravel 13, complete with modern PHP 8.5+ syntax examples and strict architectural rules.

---

## 🛠️ Global Compound Generators

### 1. `make:model --all` / `-mfs`
Generate a complete vertical slice in a single command:
```bash
php artisan make:model Article -mfs --controller --requests --resource --pest
```
**Options**:
- `-m`: Migration
- `-f`: Factory
- `-s`: Seeder
- `-c` or `--controller`: Controller
- `-r` or `--resource`: Resource Controller
- `--requests`: Dedicated Form Requests (`StoreArticleRequest`, `UpdateArticleRequest`)
- `--pest`: Pest Feature test
- `--policy`: Authorization Policy
- `--all` (`-a`): Scaffolds all of the above simultaneously.

---

## 📂 Category 1: HTTP & Presentation Layer

### 1. `php artisan make:controller`
```bash
# Invokable Single-Action Controller (Recommended)
php artisan make:controller Orders/StoreOrderController --invokable

# Resourceful Controller
php artisan make:controller Orders/OrderController --resource --model=Order --requests
```
**Example (Invokable)**:
```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Orders;

use App\Actions\Orders\CreateOrderAction;
use App\Http\Requests\Orders\StoreOrderRequest;
use App\Http\Resources\Orders\OrderResource;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

final class StoreOrderController
{
    public function __invoke(
        StoreOrderRequest $request,
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
**Rules**:
- Controllers MUST be skinny: no business logic, no direct SQL queries, no inline validation.
- Prefer single-action invokable controllers (`__invoke`) over fat multi-method controllers.

---

### 2. `php artisan make:request`
```bash
php artisan make:request Articles/StoreArticleRequest
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Articles;

use App\Data\CreateArticleDto;
use App\Models\Article;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var User|null $user */
        $user = $this->user();
        return $user !== null && $user->can('create', Article::class);
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'category_id' => ['required', 'uuid', Rule::exists('categories', 'id')],
        ];
    }

    public function userOrFail(): User
    {
        /** @var User|null $user */
        $user = $this->user();
        assert($user instanceof User, 'Authenticated user expected.');
        return $user;
    }

    public function toDto(): CreateArticleDto
    {
        /** @var array{title: string, body: string, category_id: string} $data */
        $data = $this->validated();
        return CreateArticleDto::fromArray($data);
    }
}
```
**Rules**:
- All input validation and gate checks must reside in Form Requests.
- Implement a `toDto()` or typed helper method to eliminate untyped array handling in controllers.

---

### 3. `php artisan make:resource`
```bash
# Item Resource
php artisan make:resource Articles/ArticleResource

# Collection Resource
php artisan make:resource Articles/ArticleCollection --collection
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Http\Resources\Articles;

use App\Models\Article;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Article
 */
final class ArticleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'reading_time' => $this->readingTime,
            'status' => $this->status->value,
            'author' => $this->whenLoaded('author', fn() => [
                'id' => $this->author->id,
                'name' => $this->author->name,
            ]),
        ];
    }
}
```
**Rules**:
- Always transform API responses via `JsonResource`. Never expose raw models.
- Guard relationship attributes with `$this->whenLoaded()`.

---

### 4. `php artisan make:middleware`
```bash
php artisan make:middleware EnsureUserIsAdmin
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->isAdmin()) {
            abort(403, 'Unauthorized.');
        }

        return $next($request);
    }
}
```
**Rules**:
- Register middleware aliases inside `bootstrap/app.php` using `$middleware->alias([...])`.

---

### 5. `php artisan make:component` & `make:view`
```bash
# Class + Blade View Component
php artisan make:component Alerts/Toast

# Inline View Component
php artisan make:component Alerts/Toast --inline

# Blade View template
php artisan make:view pages/dashboard
```

---

## 📂 Category 2: Database & Persistence Layer

### 6. `php artisan make:model`
```bash
php artisan make:model Article
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Models;

use App\Builders\ArticleQueryBuilder;
use App\Enums\ArticleStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\UseEloquentBuilder;
use Illuminate\Database\Eloquent\Casts\AsFluent;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table('articles')]
#[Fillable(['title', 'slug', 'body', 'status', 'metadata', 'user_id'])]
#[UseEloquentBuilder(ArticleQueryBuilder::class)]
class Article extends Model
{
    /** @use HasFactory<\Database\Factories\ArticleFactory> */
    use HasFactory;

    // PHP 8.4 Property Hook
    public int $readingTime {
        get => max(1, (int) ceil(str_word_count($this->body) / 200));
    }

    /**
     * @return array<string, string|class-string>
     */
    protected function casts(): array
    {
        return [
            'status' => ArticleStatus::class,
            'metadata' => AsFluent::class,
            'published_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
```
**Rules**:
- Use PHP 8 `#[Attribute]` syntax (`#[Table]`, `#[Fillable]`, `#[Hidden]`, `#[UseEloquentBuilder]`).
- Declare casting in `casts(): array`, not in `$casts` property.

---

### 7. `php artisan make:migration`
```bash
php artisan make:migration create_articles_table --create=articles
php artisan make:migration add_embedding_to_articles_table --table=articles
```
**Example**:
```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->longText('body');
            $table->string('status')->default('draft')->index();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};
```
**Rules**:
- Always return an anonymous migration class.
- Always add foreign key cascades and index frequently searched columns.

---

### 8. `php artisan make:factory`
```bash
php artisan make:factory ArticleFactory --model=Article
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\ArticleStatus;
use App\Models\Article;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Article>
 */
final class ArticleFactory extends Factory
{
    protected $model = Article::class;

    public function definition(): array
    {
        $title = fake()->sentence();
        return [
            'user_id' => User::factory(),
            'title' => $title,
            'slug' => Str::slug($title),
            'body' => fake()->paragraphs(3, true),
            'status' => ArticleStatus::Draft,
        ];
    }

    public function published(): static
    {
        return $this->state(fn(): array => ['status' => ArticleStatus::Published]);
    }
}
```
**Rules**:
- Must include `@extends Factory<Model>` for PHPStan Level 8.
- Declare explicit states (`published()`, `archived()`).

---

### 9. `php artisan make:seeder`
```bash
php artisan make:seeder ArticleSeeder
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Article;
use App\Models\User;
use Illuminate\Database\Seeder;

final class ArticleSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'admin@example.com'],
            ['name' => 'Admin User', 'password' => bcrypt('password')]
        );

        Article::factory()->count(10)->published()->for($user, 'author')->create();
    }
}
```
**Rules**:
- Seeders must be idempotent: rerunning them must not produce duplicate records or unique constraint violations.

---

### 10. `php artisan make:scope`
```bash
php artisan make:scope PublishedScope
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

final class PublishedScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $builder->whereNotNull('published_at')->where('published_at', '<=', now());
    }
}
```

---

### 11. `php artisan make:cast`
```bash
php artisan make:cast EncryptedJsonCast
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/**
 * @implements CastsAttributes<array<string, mixed>, string>
 */
final class EncryptedJsonCast implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?array
    {
        return is_string($value) ? (array) json_decode(Crypt::decryptString($value), true) : null;
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return $value !== null ? Crypt::encryptString((string) json_encode($value)) : null;
    }
}
```

---

### 12. `php artisan make:observer`
```bash
php artisan make:observer ArticleObserver --model=Article
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Observers;

use App\Models\Article;
use Illuminate\Support\Facades\Cache;

final class ArticleObserver
{
    public function saved(Article $article): void
    {
        Cache::forget("article:{$article->slug}");
    }
}
```

---

## 📂 Category 3: Modern PHP & Domain Classes

### 13. `php artisan make:enum`

Generates a modern PHP 8.1+ backed or pure enum. In enterprise Laravel applications, always organize enums into **domain subdirectories** rather than dumping them flat in `app/Enums/`.

> 📖 **Deep Dive**: For domain directory architecture, state transitions, and traits, see **[docs/architecture/enums.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/enums.md)**.

```bash
# 1. Directory-based generation (Domain subfolder)
php artisan make:enum "Orders/OrderStatus" --string
php artisan make:enum "Billing/SubscriptionTier" --string

# 2. Integer-backed enum in subdirectory
php artisan make:enum "Identity/UserRole" --int

# 3. Pure (unbacked) enum in subdirectory
php artisan make:enum "Common/SortDirection"
```

| Flag | Short | Output Syntax | Best Used For |
| :--- | :--- | :--- | :--- |
| `--string` | `-s` | `enum Name: string` | Database columns, status codes, URLs, API responses. |
| `--int` | `-i` | `enum Name: int` | Bitmasks, numeric priorities, legacy IDs. |
| *(None)* | | `enum Name` | Pure states, Finite State Machines (FSM). |

**Generated File (`app/Enums/Orders/OrderStatus.php`) with Rich Domain Logic**:
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

    /**
     * Localized human-readable label.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => __('Pending Review'),
            self::Processing => __('In Fulfillment'),
            self::Shipped => __('Shipped with Carrier'),
            self::Delivered => __('Delivered to Customer'),
            self::Cancelled => __('Cancelled'),
        };
    }

    /**
     * UI Badge classes (Tailwind CSS).
     */
    public function badgeClasses(): string
    {
        return match ($this) {
            self::Pending => 'bg-amber-100 text-amber-800',
            self::Processing => 'bg-blue-100 text-blue-800',
            self::Shipped => 'bg-purple-100 text-purple-800',
            self::Delivered => 'bg-emerald-100 text-emerald-800',
            self::Cancelled => 'bg-zinc-100 text-zinc-800',
        };
    }

    /**
     * State transition guard.
     */
    public function canCancel(): bool
    {
        return match ($this) {
            self::Pending, self::Processing => true,
            self::Shipped, self::Delivered, self::Cancelled => false,
        };
    }
}
```

**Model Casts (`casts(): array`)**:
```php
use App\Enums\Orders\OrderStatus;

protected function casts(): array
{
    return [
        'status' => OrderStatus::class,
    ];
}
```

**Form Request Validation**:
```php
use App\Enums\Orders\OrderStatus;
use Illuminate\Validation\Rule;

public function rules(): array
{
    return [
        'status' => ['required', Rule::enum(OrderStatus::class)],
    ];
}
```

---

### 14. `php artisan make:class`
```bash
# Plain Class / DTO
php artisan make:class Data/CreateArticleDto --invokable
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Data;

final readonly class CreateArticleDto
{
    public function __construct(
        public string $title,
        public string $body,
        public string $categoryId,
    ) {}

    /**
     * @param array{title: string, body: string, category_id: string} $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            title: $data['title'],
            body: $data['body'],
            categoryId: $data['category_id'],
        );
    }
}
```

---

### 15. `php artisan make:interface` & `make:trait`
```bash
php artisan make:interface Contracts/PaymentGatewayInterface
php artisan make:trait Concerns/HasSlug
```

---

## 📂 Category 4: Async, Events & Messaging

### 16. `php artisan make:job`
```bash
php artisan make:job ProcessPaymentJob
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Order;
use App\Services\PaymentGateway;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\Attributes\WithQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

#[WithQueue(connection: 'redis', queue: 'payments', tries: 3, timeout: 60)]
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
**Rules**:
- Declare queue attributes using `#[WithQueue]` instead of property declarations.

---

### 17. `php artisan make:job-middleware`
```bash
php artisan make:job-middleware RateLimitJobMiddleware
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Jobs\Middleware;

use Closure;
use Illuminate\Support\Facades\Redis;

final class RateLimitJobMiddleware
{
    public function handle(object $job, Closure $next): void
    {
        Redis::throttle('payment-gateway')
            ->block(0)->allow(10)->every(60)
            ->then(fn() => $next($job), fn() => $job->release(10));
    }
}
```

---

### 18. `php artisan make:event` & `make:listener`
```bash
php artisan make:event OrderPlaced
php artisan make:listener SendOrderReceipt --event=OrderPlaced --queued
```

---

### 19. `php artisan make:mail` & `make:notification`
```bash
php artisan make:mail OrderReceiptMail
php artisan make:notification InvoicePaidNotification
```

---

### 20. `php artisan make:channel`
```bash
php artisan make:channel OrdersChannel
```

---

## 📂 Category 5: Console, Security & Testing

### 21. `php artisan make:command`
```bash
# Generate command with explicit signature
php artisan make:command SyncCatalogCommand --command=catalog:sync

# Generate command with test
php artisan make:command PruneExpiredTokensCommand --command=tokens:prune --test
```

**Signature Syntax Cheatsheet**:
- `{user}`: Required positional argument
- `{user?}`: Optional positional argument
- `{user=default}`: Argument with default value
- `{users*}`: Array of positional arguments
- `{--force}`: Boolean flag option (true/false)
- `{--queue=}`: Value option (requires input)
- `{--queue=default}`: Value option with fallback
- `{--Q|queue=}`: Option with single-letter shortcut
- `{--id=*}`: Option accepting multiple values (`--id=1 --id=2`)
- `{user : Description text}`: Document argument/option in `--help`

**Production Example (PHP 8.5+, Isolatable, Prompts & Memory-Safe)**:
```php
<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Catalog\SyncCatalogAction;
use Illuminate\Console\Command;
use Illuminate\Contracts\Console\Isolatable;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Console\Attribute\AsCommand;
use function Laravel\Prompts\confirm;
use function Laravel\Prompts\info;
use function Laravel\Prompts\progress;
use function Laravel\Prompts\spin;

#[AsCommand(name: 'catalog:sync', description: 'Synchronize third-party catalog products')]
final class SyncCatalogCommand extends Command implements Isolatable
{
    protected $signature = 'catalog:sync
                            {provider=stripe : The catalog provider (stripe, shopify)}
                            {--b|--batch=500 : Batch size for database mutations}
                            {--dry-run : Simulate sync without committing changes}';

    public int $isolationLockExpiresAt = 300;

    public function handle(SyncCatalogAction $action): int
    {
        // 1. Memory Safety: Prevent SQL query logs from eating RAM in CLI loops
        DB::disableQueryLog();

        $provider = (string) $this->argument('provider');
        $batch = (int) $this->option('batch');
        $isDryRun = (bool) $this->option('dry-run');

        if (app()->isProduction() && ! $this->option('no-interaction')) {
            if (! confirm(label: "Sync [{$provider}] in PRODUCTION?", default: false)) {
                $this->warn('Aborted by user.');
                return self::SUCCESS;
            }
        }

        $items = spin(
            callback: fn (): array => $action->fetchItems($provider),
            message: "Fetching items from [{$provider}]..."
        );

        $progress = progress(label: 'Syncing catalog', steps: count($items));
        $progress->start();

        foreach ($items as $item) {
            $action->syncItem($item, $isDryRun);
            $progress->advance();
        }

        $progress->finish();
        info('Catalog sync complete.');

        return self::SUCCESS;
    }
}
```

> 📖 **Architectural Reference**: For concurrency locking, scheduling in `routes/console.php`, and Pest 3 testing, see **[docs/architecture/console-commands-and-scheduling.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/console-commands-and-scheduling.md)**.

---

### 22. `php artisan make:policy`
```bash
php artisan make:policy ArticlePolicy --model=Article
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Article;
use App\Models\User;

final class ArticlePolicy
{
    public function update(User $user, Article $article): bool
    {
        return $user->id === $article->user_id;
    }
}
```

---

### 23. `php artisan make:rule`
```bash
php artisan make:rule ValidPostalCode
```
**Example**:
```php
<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final class ValidPostalCode implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! preg_match('/^[0-9]{5}(-[0-9]{4})?$/', $value)) {
            $fail('The :attribute must be a valid postal code.');
        }
    }
}
```

---

### 24. `php artisan make:exception`
```bash
# Renderable exception
php artisan make:exception PaymentFailedException --render
```

---

### 25. `php artisan make:provider`
```bash
php artisan make:provider PaymentServiceProvider
```

---

### 26. `php artisan make:test`
```bash
# Pest Feature Test (Default standard)
php artisan make:test Articles/StoreArticleTest --pest

# Pest Unit Test
php artisan make:test ReadingTimeTest --unit --pest
```
**Example**:
```php
<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\User;
use function Pest\Laravel\{actingAs, postJson};

test('an authenticated user can create an article', function () {
    $user = User::factory()->create();

    actingAs($user)
        ->postJson('/api/v1/articles', [
            'title' => 'Building with Laravel 13',
            'body' => 'Deep dive into modern PHP 8.5+ architecture.',
        ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Building with Laravel 13');
});
```

---

## 📌 Summary Reference Table

| Layer | Recommended Command | Key Flags |
| :--- | :--- | :--- |
| **All-in-One** | `php artisan make:model <Name> -a` | `-mfs --controller --requests --resource --pest` |
| **Controller** | `php artisan make:controller <Name>` | `--invokable`, `--resource`, `--requests` |
| **Form Request** | `php artisan make:request <Name>` | |
| **Resource** | `php artisan make:resource <Name>` | `--collection` |
| **Model** | `php artisan make:model <Name>` | `-m`, `-f`, `-s`, `--pivot` |
| **Migration** | `php artisan make:migration <Name>` | `--create=<table_name>`, `--table=<table_name>` |
| **Factory** | `php artisan make:factory <Name>` | `--model=<ModelName>` |
| **Seeder** | `php artisan make:seeder <Name>` | |
| **Enum** | `php artisan make:enum <Name>` | `--string`, `--int` |
| **Class / DTO** | `php artisan make:class <Name>` | `--invokable` |
| **Job** | `php artisan make:job <Name>` | `--sync` |
| **Command** | `php artisan make:command <Name>` | `--command=<signature>` |
| **Policy** | `php artisan make:policy <Name>` | `--model=<ModelName>` |
| **Test** | `php artisan make:test <Name>` | `--pest`, `--unit` |
| **Stubs** | `php artisan stub:publish` | Exports all stubs to `stubs/` |
