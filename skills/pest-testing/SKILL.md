---
name: pest-testing
description: Comprehensive guide to testing Laravel 13 & PHP 8.5+ applications using Pest 3. Covers Feature/HTTP tests, Unit tests, Architectural boundary testing (`arch()`), Database factories, Mocking/Fakes, Datasets, and Type Coverage.
---

# Pest 3 Testing Suite for Laravel 13 (PHP 8.5+)

This skill establishes the testing standards, best practices, and patterns for building robust test suites with **Pest 3** in Laravel 13 applications.

> 📚 **Assertions Master Encyclopedia**: For the complete reference of all HTTP, JSON path, database, expectation (`expect()`), event, queue, and mock assertions, see **[docs/testing/assertions.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/testing/assertions.md)**.
> 💾 **Database Testing Master Guide**: For detailed strategies on `LazilyRefreshDatabase`, factory `recycle()`, transaction rollback testing, and concurrency locks, see **[docs/testing/database-testing.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/testing/database-testing.md)**.

---

## 1. Test Suite Configuration (`tests/Pest.php`)

Configure base test suites, database refresh strategies, and architectural presets in `tests/Pest.php`:

```php
<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case Bindings
|--------------------------------------------------------------------------
*/
pest()->extend(TestCase::class)
    ->use(LazilyRefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)
    ->in('Unit');

/*
|--------------------------------------------------------------------------
| Custom Test Helpers
|--------------------------------------------------------------------------
*/
function asAdmin(?App\Models\User $user = null): TestCase
{
    $admin = $user ?? App\Models\User::factory()->admin()->create();
    return test()->actingAs($admin);
}
```

> **Performance Tip**: Always prefer `LazilyRefreshDatabase` over `RefreshDatabase`. It refreshes the database schema only when a test touches the database, dramatically reducing test execution times for unit and mock-heavy feature tests.

---

## 2. Feature & HTTP API Testing

Test HTTP endpoints end-to-end, validating status codes, validation rules, and JSON structures:

```php
<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\User;
use function Pest\Laravel\{actingAs, getJson, postJson, assertDatabaseHas};

test('an authenticated user can create an article', function () {
    $author = User::factory()->create();

    actingAs($author)
        ->postJson('/api/v1/articles', [
            'title' => 'Building with Laravel 13',
            'body' => 'Comprehensive guide to Pest 3 and PHP 8.5+ testing.',
            'category_id' => '01JBCDEFGHJKMNPQRSTVWXYZ12',
        ])
        ->assertCreated()
        ->assertJsonStructure([
            'data' => [
                'id',
                'title',
                'slug',
                'reading_minutes',
                'status',
            ],
        ])
        ->assertJsonPath('data.title', 'Building with Laravel 13');

    assertDatabaseHas('articles', [
        'title' => 'Building with Laravel 13',
        'user_id' => $author->id,
    ]);
});

test('unauthenticated users receive a 401 unauthorized', function () {
    postJson('/api/v1/articles', [
        'title' => 'Unauthorized Post',
    ])->assertUnauthorized();
});

test('article validation rules are enforced', function () {
    $author = User::factory()->create();

    actingAs($author)
        ->postJson('/api/v1/articles', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title', 'body', 'category_id']);
});
```

---

## 3. Unit & Domain Action Testing

Test business logic in isolation without spinning up HTTP requests:

```php
<?php

declare(strict_types=1);

use App\Actions\Orders\CreateOrderAction;
use App\Data\CreateOrderDto;
use App\Enums\OrderStatus;
use App\Models\Product;
use App\Models\User;

test('CreateOrderAction calculates total and creates order in database', function () {
    $user = User::factory()->create();
    $productA = Product::factory()->create(['price' => 2500]);
    $productB = Product::factory()->create(['price' => 1500]);

    $dto = new CreateOrderDto(
        items: [
            ['product_id' => $productA->id, 'quantity' => 2, 'unit_price' => 2500],
            ['product_id' => $productB->id, 'quantity' => 1, 'unit_price' => 1500],
        ]
    );

    $action = app(CreateOrderAction::class);
    $order = $action->execute($user, $dto);

    expect($order)
        ->toBeInstanceOf(App\Models\Order::class)
        ->status->toBe(OrderStatus::Pending)
        ->total_amount->toBe(6500)
        ->items->toHaveCount(2);
});
```

### Testing PHP 8.4 Property Hooks
```php
test('reading minutes property hook calculates correct estimate', function () {
    $shortArticle = new App\Models\Article();
    $shortArticle->body = 'A quick test post with ten words or less here.';
    expect($shortArticle->readingMinutes)->toBe(1);

    $longArticle = new App\Models\Article();
    $longArticle->body = str_repeat('word ', 650);
    expect($longArticle->readingMinutes)->toBe(4); // ceil(650 / 200) = 4
});
```

---

## 4. Architectural Boundary Enforcement (`arch()`)

Pest 3 provides powerful static architecture testing to ensure codebase standards cannot be violated:

```php
<?php

declare(strict_types=1);

// 1. Strict Typing Enforcement
arch('strict types are declared across entire application')
    ->expect('App')
    ->toUseStrictTypes();

// 2. Controller Architectural Rules
arch('controllers are invokable single-action classes')
    ->expect('App\Http\Controllers')
    ->toHaveSuffix('Controller')
    ->toBeInvokable();

arch('controllers do not call DB directly')
    ->expect('App\Http\Controllers')
    ->not->toUse(['Illuminate\Support\Facades\DB', 'Illuminate\Database\Eloquent\Builder']);

// 3. Domain Action Rules
arch('actions are final and readonly')
    ->expect('App\Actions')
    ->toBeFinal()
    ->toBeReadonly();

// 4. Model Inheritance
arch('models extend Eloquent Model')
    ->expect('App\Models')
    ->toExtend('Illuminate\Database\Eloquent\Model');

// 5. Zero Debugging Code Left Behind
arch('no debug functions in production code')
    ->expect(['dd', 'dump', 'ray', 'var_dump', 'print_r'])
    ->not->toBeUsed();
```

---

## 5. Mocking, Fakes & Time Travel

Use Laravel's first-party fakes to test asynchronous side effects without executing third-party network requests:

```php
<?php

declare(strict_types=1);

use App\Events\OrderPlaced;
use App\Jobs\ProcessOrderPayment;
use App\Mail\OrderReceiptMail;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use function Pest\Laravel\{actingAs, postJson};

test('placing an order dispatches event, queues payment job, and mocks API', function () {
    Event::fake([OrderPlaced::class]);
    Queue::fake([ProcessOrderPayment::class]);
    Mail::fake();

    // Mock external payment gateway HTTP request
    Http::fake([
        'api.stripe.com/*' => Http::response(['id' => 'ch_123', 'status' => 'succeeded'], 200),
    ]);

    $user = User::factory()->create();

    actingAs($user)
        ->postJson('/api/v1/orders', [
            'payment_method_id' => 'pm_card_visa',
            'items' => [['product_id' => '01JBCDEFGHJKMNPQRSTVWXYZ12', 'quantity' => 1]],
        ])
        ->assertCreated();

    // Verify side-effects
    Event::assertDispatched(OrderPlaced::class);
    Queue::assertPushed(ProcessOrderPayment::class);
    Mail::assertNothingSent(); // Sent later in the worker
});
```

### Time Travel
```php
test('subscription expires after 30 days', function () {
    $subscription = App\Models\Subscription::factory()->active()->create();

    expect($subscription->isExpired())->toBeFalse();

    // Travel 31 days into the future
    $this->travel(31)->days();

    expect($subscription->isExpired())->toBeTrue();
});
```

---

## 6. Datasets & Parameterized Testing

Test edge cases and validation matrices cleanly with `with()` datasets:

```php
test('invalid email formats fail validation', function (string $invalidEmail) {
    postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'email' => $invalidEmail,
        'password' => 'Password123!',
    ])->assertJsonValidationErrors('email');
})->with([
    'missing @' => 'invalid-email.com',
    'missing domain' => 'user@',
    'multiple @' => 'user@@domain.com',
    'spaces' => 'user name@domain.com',
]);

test('order discounts apply based on promo tier', function (string $code, int $subtotal, int $expectedTotal) {
    $calculator = app(App\Services\DiscountCalculator::class);
    $total = $calculator->apply($code, $subtotal);

    expect($total)->toBe($expectedTotal);
})->with([
    'TIER10 (10% off $100)' => ['TIER10', 10000, 9000],
    'TIER25 (25% off $100)' => ['TIER25', 10000, 7500],
    'TIER50 (50% off $200)' => ['TIER50', 20000, 10000],
]);
```

---

## 8. File Upload & Cloud Storage Testing

Test multipart file uploads, image dimensions, mime-types, and private cloud storage:

```php
<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use function Pest\Laravel\{actingAs, postJson};

test('user can upload an avatar image', function () {
    Storage::fake('s3');

    $user = User::factory()->create();
    $avatar = UploadedFile::fake()->image('avatar.jpg', width: 400, height: 400)->size(500);

    actingAs($user)
        ->postJson('/api/v1/user/avatar', [
            'avatar' => $avatar,
        ])
        ->assertOk()
        ->assertJsonPath('data.avatar_url', fn(string $url) => str_contains($url, 'avatar.jpg'));

    // Assert file exists on the fake S3 disk
    Storage::disk('s3')->assertExists("avatars/{$user->id}/{$avatar->hashName()}");
});

test('upload rejects executable or oversized files', function () {
    Storage::fake('s3');

    $user = User::factory()->create();
    $badFile = UploadedFile::fake()->create('script.sh', 5000, 'application/x-sh');

    actingAs($user)
        ->postJson('/api/v1/user/avatar', ['avatar' => $badFile])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('avatar');

    Storage::disk('s3')->assertDirectoryEmpty('avatars');
});
```

---

## 9. Console & Artisan CLI Command Testing

Test interactive CLI commands, arguments, option flags, user prompts, and exit codes:

```php
<?php

declare(strict_types=1);

use App\Models\User;
use function Pest\Laravel\artisan;

test('catalog:sync command executes with progress and options', function () {
    artisan('catalog:sync --dry-run')
        ->expectsOutput('Starting catalog sync (dry run)...')
        ->expectsConfirmation('Do you wish to continue?', 'yes')
        ->expectsQuestion('Select sync provider', 'Shopify')
        ->assertSuccessful();
});

test('user:prune command prompts confirmation and removes inactive users', function () {
    $inactive = User::factory()->count(3)->inactive()->create();
    $active = User::factory()->create();

    artisan('users:prune --days=90')
        ->expectsConfirmation('Are you sure you want to delete 3 inactive users?', 'yes')
        ->expectsOutput('Pruned 3 inactive users successfully.')
        ->assertExitCode(0);

    expect(User::query()->count())->toBe(1);
});
```

---

## 10. Isolated Policy, Gate & Middleware Testing

Test authorization gates and HTTP middleware in isolation without the overhead of the full HTTP stack:

### Policy Unit Testing
```php
<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\User;
use App\Policies\ArticlePolicy;

test('authors can update their own articles, but not others', function () {
    $author = User::factory()->create();
    $stranger = User::factory()->create();
    $article = Article::factory()->for($author, 'author')->create();

    $policy = new ArticlePolicy();

    expect($policy->update($author, $article))->toBeTrue()
        ->and($policy->update($stranger, $article))->toBeFalse();
});
```

### Middleware Isolation Testing
```php
<?php

declare(strict_types=1);

use App\Http\Middleware\EnsureEmailIsVerified;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

test('EnsureEmailIsVerified aborts 403 when email is unverified', function () {
    $unverifiedUser = User::factory()->unverified()->make();
    $request = Request::create('/api/dashboard', 'GET');
    $request->setUserResolver(fn() => $unverifiedUser);

    $middleware = new EnsureEmailIsVerified();

    expect(fn() => $middleware->handle($request, fn() => response('OK')))
        ->toThrow(HttpException::class, 'Your email address is not verified.');
});
```

---

## 11. Deep Queue Job Execution & Failure Testing

Beyond checking `Queue::assertPushed()`, test the actual execution of background jobs, handling retries, and failed job callbacks:

```php
<?php

declare(strict_types=1);

use App\Jobs\ProcessOrderPayment;
use App\Models\Order;
use App\Services\PaymentGateway;

test('ProcessOrderPayment job handles successful charge', function () {
    $order = Order::factory()->pending()->create();

    $gatewayMock = Mockery::mock(PaymentGateway::class);
    $gatewayMock->shouldReceive('charge')
        ->once()
        ->with($order)
        ->andReturn(true);

    $job = new ProcessOrderPayment($order);
    $job->handle($gatewayMock);

    expect($order->fresh()->status->value)->toBe('paid');
});

test('ProcessOrderPayment records failure when payment gateway fails', function () {
    $order = Order::factory()->pending()->create();
    $job = new ProcessOrderPayment($order);

    // Call the failed() lifecycle callback directly
    $job->failed(new RuntimeException('Gateway timeout'));

    expect($order->fresh())
        ->status->value->toBe('payment_failed')
        ->failure_reason->toBe('Gateway timeout');
});
```

---

## 12. Concurrency, Race Condition & Database Lock Testing

Test pessimistic database locks (`lockForUpdate()`) and atomic cache locks (`Cache::lock()`):

```php
<?php

declare(strict_types=1);

use App\Models\Inventory;
use App\Services\InventoryReservationService;
use Illuminate\Support\Facades\Cache;

test('atomic lock prevents double booking inventory concurrently', function () {
    $inventory = Inventory::factory()->create(['stock' => 1]);
    $service = app(InventoryReservationService::class);

    // Simulate lock acquired by Process A
    $lock = Cache::lock("inventory:reserve:{$inventory->id}", 10);
    expect($lock->get())->toBeTrue();

    // Process B attempts to reserve while locked
    $reservedByB = $service->reserve($inventory->id, quantity: 1);
    expect($reservedByB)->toBeFalse();

    // Release lock
    $lock->release();

    // Now reservation succeeds
    $reservedAfterRelease = $service->reserve($inventory->id, quantity: 1);
    expect($reservedAfterRelease)->toBeTrue();
});
```

---

## 13. Snapshot Testing

Test complex JSON payloads, PDF generation, or calculated reporting matrices against saved snapshots:

```php
<?php

declare(strict_types=1);

use App\Actions\Reporting\GenerateTaxReportAction;
use App\Models\Order;

test('annual tax report matches verified snapshot', function () {
    Order::factory()->count(5)->create(['created_at' => '2026-05-15']);

    $report = app(GenerateTaxReportAction::class)->execute(year: 2026);

    // Matches against tests/.snapshots/AnnualTaxReport.json
    expect($report->toArray())->toMatchSnapshot();
});
```

---

## 14. Mutation Testing (Infection PHP)

Test the effectiveness of your Pest test suite using Mutation Testing. Infection mutates source code (inverting logic, modifying operators) and checks if tests catch the bug:

```bash
# Run mutation tests against mutated code
./vendor/bin/infection --threads=4 --min-msi=80 --min-covered-msi=90
```

```neon
# infection.json.dist
{
    "source": {
        "directories": ["app/Actions", "app/Services"]
    },
    "logs": {
        "text": "infection.log"
    },
    "mutators": {
        "@default": true
    }
}
```
- **MSI (Mutation Score Indicator)**: Proves that your tests actually assert business logic rather than just executing lines for false code coverage metrics.

---

## 15. Native AI Vector & Similarity Search Testing (Laravel 13)

Test semantic search and embedding queries with deterministic vectors:

```php
<?php

declare(strict_types=1);

use App\Models\Document;

test('whereVectorSimilarTo finds semantically matching documents', function () {
    $techDoc = Document::factory()->create([
        'title' => 'Kubernetes Infrastructure Guide',
        'embedding' => [0.92, 0.88, 0.12, 0.05],
    ]);

    $cookingDoc = Document::factory()->create([
        'title' => 'Italian Pasta Recipes',
        'embedding' => [0.05, 0.02, 0.95, 0.89],
    ]);

    $queryVector = [0.90, 0.85, 0.10, 0.02]; // Very close to Tech Doc

    $results = Document::query()
        ->whereVectorSimilarTo('embedding', $queryVector, threshold: 0.80)
        ->get();

    expect($results)
        ->toHaveCount(1)
        ->first()->id->toBe($techDoc->id);
});
```

---

## 16. Execution, Parallelization & Type Coverage

Run tests fast in parallel and enforce strict coverage metrics in CI:

```bash
# 1. Run all tests in parallel with fast process workers
./vendor/bin/pest --parallel

# 2. Run only failed tests
./vendor/bin/pest --retry

# 3. Enforce code coverage minimums
./vendor/bin/pest --coverage --min=85

# 4. Enforce 100% PHPStan-grade Type Coverage
./vendor/bin/pest --type-coverage --min=100

# 5. Run only Architecture boundary tests
./vendor/bin/pest --filter=arch
```
