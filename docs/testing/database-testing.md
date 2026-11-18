# Laravel 13 & Pest 3 Database Testing Master Guide

> **Document**: `docs/testing/database-testing.md`  
> **Framework**: Pest 3 & Laravel 13 (PHP 8.5+)  
> **Scope**: Database testing strategies, schema refreshes, factory optimization, transaction rollback testing, and query assertions.

---

## 1. Database Configuration & Refresh Strategies

### A. Environment Configuration (`phpunit.xml`)
Configure your test database connection in `phpunit.xml`:

```xml
<php>
    <env name="APP_ENV" value="testing"/>
    <env name="BCRYPT_ROUNDS" value="4"/>
    <env name="CACHE_STORE" value="array"/>
    <env name="QUEUE_CONNECTION" value="sync"/>
    <env name="SESSION_DRIVER" value="array"/>

    <!-- Option 1: Ultra-Fast In-Memory SQLite (Simple Projects) -->
    <env name="DB_CONNECTION" value="sqlite"/>
    <env name="DB_DATABASE" value=":memory:"/>

    <!-- Option 2: Dedicated Test PostgreSQL / MySQL (For pgvector or DB-specific features) -->
    <!-- <env name="DB_CONNECTION" value="pgsql"/> -->
    <!-- <env name="DB_DATABASE" value="testing_db"/> -->
</php>
```

### B. Choosing the Right Refresh Strategy
| Trait | How It Works | Performance | When to Use |
| :--- | :--- | :--- | :--- |
| `LazilyRefreshDatabase` | Runs migrations on first DB query in a test file, then wraps tests in transactions. | ⚡ **Fastest (Default)** | **Recommended standard** for 95% of test suites. |
| `RefreshDatabase` | Runs migrations before each test class, resets DB per test. | ⏳ Moderate | When non-database tests still need fresh schema. |
| `DatabaseTransactions`| Wraps each test in `BEGIN ... ROLLBACK`. Does not run migrations. | ⚡ Fast | Pre-migrated persistent staging databases. |
| `DatabaseMigrations` | Drops and runs all migrations fresh for every single test. | 🐢 Slowest | Testing migration up/down reversibility directly. |

#### Global Setup in `tests/Pest.php`:
```php
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(LazilyRefreshDatabase::class)
    ->in('Feature');
```

---

## 2. Model Factories in Database Tests

### A. `create()` vs `make()`
```php
// create(): Persists model to the database
$user = User::factory()->create();

// make(): Instantiates model in-memory WITHOUT database write (Fast!)
$user = User::factory()->make();

// raw(): Returns array of attributes without model instantiation
$attributes = User::factory()->raw();
```

### B. Factory States & Sequences
```php
// Using pre-defined states
$admin = User::factory()->admin()->verified()->create();
$draft = Article::factory()->draft()->create();

// Sequences: alternate values across a count
$users = User::factory()
    ->count(4)
    ->sequence(
        ['role' => 'editor'],
        ['role' => 'reviewer'],
    )
    ->create();
```

### C. Relationship Optimization with `recycle()`
Avoid creating duplicate parent records when generating related models:

```php
// Bad: Creates 5 different users for 5 orders
$orders = Order::factory()->count(5)->create();

// Good: Uses ONE existing user for all 5 orders
$user = User::factory()->create();
$orders = Order::factory()->count(5)->recycle($user)->create();
```

### D. HasMany & BelongsToMany Relationships
```php
// HasMany: create author with 3 articles
$author = User::factory()
    ->has(Article::factory()->count(3))
    ->create();

// BelongsToMany with Pivot Data
$article = Article::factory()
    ->hasAttached(
        Tag::factory()->count(2),
        ['created_by' => $user->id] // Pivot attributes
    )
    ->create();
```

---

## 3. Seeders in Tests

When tests require static lookup data (roles, permissions, countries, currencies):

```php
test('user can assign permissions after roles are seeded', function () {
    // Run specific seeder on demand
    $this->seed(RolePermissionSeeder::class);

    $user = User::factory()->create();
    $user->assignRole('admin');

    expect($user->hasRole('admin'))->toBeTrue();
});
```

---

## 4. Complete Database Assertions

Verify database mutations with Laravel's built-in assertions:

```php
use App\Models\Article;
use App\Models\User;
use function Pest\Laravel\{
    assertDatabaseHas,
    assertDatabaseMissing,
    assertDatabaseCount,
    assertDatabaseEmpty,
    assertSoftDeleted,
    assertNotSoftDeleted,
    assertModelExists,
    assertModelMissing,
};

test('database assertions verify persistence state', function () {
    $author = User::factory()->create();
    $article = Article::factory()->for($author, 'author')->create([
        'title' => 'Database Testing Mastery',
        'status' => 'draft',
    ]);

    // 1. Verify existence of record matching criteria
    assertDatabaseHas('articles', [
        'id' => $article->id,
        'title' => 'Database Testing Mastery',
        'user_id' => $author->id,
    ]);

    // 2. Verify absence of record
    assertDatabaseMissing('articles', [
        'title' => 'Hacked Post',
    ]);

    // 3. Verify exact table row count
    assertDatabaseCount('articles', 1);

    // 4. Soft deletion assertions
    $article->delete();
    assertSoftDeleted('articles', ['id' => $article->id]);

    // 5. Model-instance level assertions
    assertModelExists($author);

    $author->forceDelete();
    assertModelMissing($author);
});
```

---

## 5. Transaction Rollback & Atomicity Testing

Test that multi-step operations roll back completely when an unexpected exception occurs, leaving no orphaned database records:

```php
<?php

declare(strict_types=1);

use App\Actions\Orders\CreateOrderAction;
use App\Data\CreateOrderDto;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use function Pest\Laravel\{assertDatabaseEmpty, assertDatabaseCount};

test('CreateOrderAction rolls back transaction on exception', function () {
    $user = User::factory()->create();

    // DTO with an item that triggers a deliberate failure
    $dto = new CreateOrderDto(
        items: [
            ['product_id' => '01JBCDEFGHJKMNPQRSTVWXYZ12', 'quantity' => 1, 'unit_price' => 1000],
            ['product_id' => 'INVALID_UUID', 'quantity' => 0, 'unit_price' => -500], // Fails validation/DB
        ]
    );

    $action = app(CreateOrderAction::class);

    // Expect transaction to throw exception
    expect(fn() => $action->execute($user, $dto))
        ->toThrow(Throwable::class);

    // Assert that NO partial records were saved (clean rollback!)
    assertDatabaseEmpty('orders');
    assertDatabaseEmpty('order_items');
});
```

---

## 6. Testing Concurrency & Pessimistic Locks (`lockForUpdate`)

Verify that pessimistic database locking prevents race conditions and balance overdrafts:

```php
<?php

declare(strict_types=1);

use App\Models\Account;
use Illuminate\Support\Facades\DB;

test('pessimistic lock prevents balance overdraft in concurrent transactions', function () {
    $account = Account::factory()->create(['balance' => 1000]);

    // Simulate Transaction 1 locking the row
    DB::beginTransaction();
    $lockedAccount = Account::query()->where('id', $account->id)->lockForUpdate()->first();
    $lockedAccount->balance -= 800;
    $lockedAccount->save();

    // Commit Transaction 1
    DB::commit();

    expect($account->fresh()->balance)->toBe(200);
});
```

---

## 7. Testing Custom Query Builders & Vector Queries

Test custom query builders and Laravel 13 vector similarity search directly against database fixtures:

```php
<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\Document;

test('published scope only returns live articles', function () {
    Article::factory()->create(['status' => 'draft']);
    Article::factory()->create(['status' => 'published', 'published_at' => now()->addDay()]); // Future
    $live = Article::factory()->create(['status' => 'published', 'published_at' => now()->subDay()]); // Live

    $results = Article::query()->published()->get();

    expect($results)
        ->toHaveCount(1)
        ->first()->id->toBe($live->id);
});

test('whereVectorSimilarTo finds closest embeddings', function () {
    $docA = Document::factory()->create(['embedding' => [1.0, 0.0, 0.0]]);
    $docB = Document::factory()->create(['embedding' => [0.0, 1.0, 0.0]]);

    $closest = Document::query()
        ->whereVectorSimilarTo('embedding', [0.95, 0.05, 0.0], threshold: 0.9)
        ->first();

    expect($closest->id)->toBe($docA->id);
});
```

---

## 8. Migration Reversibility Testing

Ensure your migrations run `up()` and `down()` cleanly without foreign key constraint or syntax errors:

```php
test('all migrations can roll back cleanly', function () {
    // Roll back all migrations
    $this->artisan('migrate:rollback --batch=1')
        ->assertSuccessful();

    // Re-run migrations
    $this->artisan('migrate')
        ->assertSuccessful();
});
```
