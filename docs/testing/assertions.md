# Laravel 13 & Pest 3 Assertions Master Encyclopedia

> **Document**: `docs/testing/assertions.md`  
> **Framework**: Pest 3 & Laravel 13 (PHP 8.5+)  
> **Scope**: Comprehensive reference catalog for all HTTP, Database, Expectation, Mock, and Authentication assertions.

---

## 1. Pest 3 Expectation API (`expect($value)`)

Pest's fluent expectation API replaces traditional `assert*` methods with highly readable, chainable assertions.

### A. Value, Type & Nullability
```php
expect($value)->toBe(10);                    // Strict equality (===)
expect($value)->toEqual('10');               // Loose equality (==)
expect($value)->toBeTrue();                  // Exactly true
expect($value)->toBeFalse();                 // Exactly false
expect($value)->toBeTruthy();                // Evaluates to true
expect($value)->toBeFalsy();                 // Evaluates to false
expect($value)->toBeNull();                  // Exactly null
expect($value)->not->toBeNull();             // Not null
expect($value)->toBeEmpty();                 // Empty array, string, or collection
expect($value)->toBeInstanceOf(Order::class);// Matches class or interface
expect($value)->toBeString();                // Is string primitive
expect($value)->toBeInt();                   // Is integer primitive
expect($value)->toBeArray();                 // Is array
```

### B. Numbers & Comparisons
```php
expect($total)->toBeGreaterThan(0);
expect($total)->toBeGreaterThanOrEqual(100);
expect($total)->toBeLessThan(1000);
expect($total)->toBeLessThanOrEqual(500);
expect($discount)->toBeBetween(5, 25);       // Inclusive range
```

### C. Strings & Regular Expressions
```php
expect($slug)->toStartWith('article-');
expect($slug)->toEndWith('-v1');
expect($body)->toContain('Laravel 13', 'PHP 8.5');
expect($email)->toMatch('/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i');
expect($content)->toHaveLength(250);
```

### D. Arrays, Collections & Objects
```php
expect($items)->toHaveCount(3);
expect($user)->toHaveProperty('status', 'active');
expect($user)->toHaveProperties(['name', 'email']);
expect($array)->toHaveKey('total_cents', 5000);
expect($array)->toHaveKeys(['id', 'title', 'slug']);
expect($collection)->toContain($specificModel);
expect($payload)->toMatchArray([
    'status' => 'pending',
    'currency' => 'USD',
]);
```

### E. Exception Assertions
```php
expect(fn() => $action->execute())
    ->toThrow(DomainException::class, 'Insufficient funds.');

expect(fn() => $calculator->divide(10, 0))
    ->toThrow(DivisionByZeroError::class);
```

### F. Chaining with `and()` and `not()`
```php
expect($order)
    ->toBeInstanceOf(Order::class)
    ->status->value->toBe('processing')
    ->and($order->items)
        ->toHaveCount(2)
        ->not->toBeEmpty();
```

---

## 2. HTTP & API Response Assertions

Returned from `$this->get()`, `$this->postJson()`, etc.

### A. HTTP Status Codes
| Assertion | Status Code | HTTP Meaning |
| :--- | :--- | :--- |
| `assertOk()` | 200 | OK |
| `assertCreated()` | 201 | Resource Created |
| `assertAccepted()` | 202 | Accepted for Background Processing |
| `assertNoContent()` | 204 | No Content (e.g. DELETE) |
| `assertBadRequest()` | 400 | Bad Request |
| `assertUnauthorized()` | 401 | Unauthenticated / Invalid Token |
| `assertForbidden()` | 403 | Authenticated, but Unauthorized (Gate/Policy denied) |
| `assertNotFound()` | 404 | Resource Missing |
| `assertMethodNotAllowed()`| 405 | Wrong HTTP Verb |
| `assertUnprocessable()` | 422 | Form Request Validation Failed |
| `assertTooManyRequests()` | 429 | Rate Limit Throttled |
| `assertServerError()` | 500 | Unhandled Exception |
| `assertStatus(int $code)` | Any | Exact custom status |
| `assertSuccessful()` | 2xx | Any 200-299 success code |

### B. Fluent JSON Assertions
```php
$response = postJson('/api/v1/orders', $payload);

// Exact match of key-values (subset)
$response->assertJson([
    'data' => [
        'status' => 'pending',
        'total' => 2500,
    ],
]);

// Path-specific checks (supports closures)
$response->assertJsonPath('data.items.0.sku', 'PROD-100');
$response->assertJsonPath('data.total', fn(int $val) => $val >= 2500);

// Shape / Structure validation
$response->assertJsonStructure([
    'data' => [
        'id',
        'title',
        'author' => ['id', 'name'],
        'tags' => ['*' => ['id', 'label']],
    ],
]);

// Fragment & Missing checks
$response->assertJsonFragment(['currency' => 'USD']);
$response->assertJsonMissing(['password_hash']);
$response->assertJsonCount(5, 'data.items');

// Validation errors
$response->assertJsonValidationErrors(['email', 'password']);
$response->assertJsonMissingValidationErrors(['username']);
```

### C. Headers & Cookies
```php
$response->assertHeader('Content-Type', 'application/json');
$response->assertHeader('X-RateLimit-Limit', '60');
$response->assertHeaderMissing('X-Debug-Token');

$response->assertCookie('session_token');
$response->assertCookieExpired('remember_token');
```

### D. Web Redirects & Session Assertions
```php
$response->assertRedirect('/login');
$response->assertRedirectToRoute('admin.dashboard.index');

$response->assertSessionHas('status', 'Profile updated!');
$response->assertSessionHasErrors(['email' => 'The email has already been taken.']);
$response->assertSessionMissing('otp_secret');
```

---

## 3. Database Assertions

Verify database state using `LazilyRefreshDatabase`:

```php
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

// Check row presence
assertDatabaseHas('orders', [
    'id' => $order->id,
    'status' => 'completed',
]);

// Check row absence
assertDatabaseMissing('users', [
    'email' => 'deleted@example.com',
]);

// Check row count in table
assertDatabaseCount('articles', 10);
assertDatabaseEmpty('audit_logs');

// Soft deletes
assertSoftDeleted($article);
assertNotSoftDeleted($user);

// Model instance checks
assertModelExists($order);
assertModelMissing($temporaryModel);
```

---

## 4. First-Party Service Fakes & Side-Effect Assertions

### A. Events (`Event::fake()`)
```php
use Illuminate\Support\Facades\Event;

Event::fake([OrderPlaced::class]);

// Action executed...

Event::assertDispatched(OrderPlaced::class, function (OrderPlaced $event) use ($order) {
    return $event->order->id === $order->id;
});

Event::assertDispatchedTimes(OrderPlaced::class, 1);
Event::assertNotDispatched(OrderCancelled::class);
```

### B. Queues & Jobs (`Queue::fake()`)
```php
use Illuminate\Support\Facades\Queue;

Queue::fake([SendEmailJob::class]);

// Action executed...

Queue::assertPushed(SendEmailJob::class, function (SendEmailJob $job) {
    return $job->recipientEmail === 'customer@example.com';
});

Queue::assertPushedOn('high-priority', SendEmailJob::class);
Queue::assertPushedTimes(SendEmailJob::class, 1);
Queue::assertNotPushed(DeleteAccountJob::class);
Queue::assertCount(1);
```

### C. Mails (`Mail::fake()`)
```php
use Illuminate\Support\Facades\Mail;

Mail::fake();

// Action executed...

Mail::assertSent(OrderInvoiceMail::class, function (OrderInvoiceMail $mail) use ($user) {
    return $mail->hasTo($user->email) && $mail->order->id === 123;
});

Mail::assertQueued(WelcomeMail::class);
Mail::assertNotSent(PasswordResetMail::class);
Mail::assertSentCount(1);
```

### D. Notifications (`Notification::fake()`)
```php
use Illuminate\Support\Facades\Notification;

Notification::fake();

// Action executed...

Notification::assertSentTo($user, InvoicePaidNotification::class);
Notification::assertNotSentTo($user, AccountSuspendedNotification::class);
Notification::assertTimesSent(1, InvoicePaidNotification::class);
```

### E. Cloud Storage (`Storage::fake()`)
```php
use Illuminate\Support\Facades\Storage;

Storage::fake('s3');

// File written...

Storage::disk('s3')->assertExists("avatars/{$filename}");
Storage::disk('s3')->assertMissing("avatars/secret.sh");
Storage::disk('s3')->assertDirectoryEmpty('temp');
```

### F. HTTP Client (`Http::fake()`)
```php
use Illuminate\Support\Facades\Http;

Http::fake([
    'api.stripe.com/*' => Http::response(['id' => 'ch_123'], 200),
]);

// Action executed...

Http::assertSent(function (Illuminate\Http\Client\Request $request) {
    return $request->url() === 'https://api.stripe.com/v1/charges'
        && $request->hasHeader('Authorization')
        && $request['amount'] === 5000;
});

Http::assertNotSent(fn($r) => $r->url() === 'https://api.paypal.com');
Http::assertSentCount(1);
```

---

## 5. Authentication & Authorization Assertions

```php
use function Pest\Laravel\{
    assertAuthenticated,
    assertAuthenticatedAs,
    assertGuest,
};

// Check if any user is logged in
assertAuthenticated();

// Check if specific user is authenticated
assertAuthenticatedAs($user);

// Specify guard
assertAuthenticatedAs($user, 'sanctum');

// Check guest status
assertGuest();
```

---

## 6. Console & CLI Assertions

```php
use function Pest\Laravel\artisan;

artisan('cache:clear')
    ->expectsOutput('Application cache cleared successfully.')
    ->doesntExpectOutput('Error:')
    ->assertSuccessful();

artisan('migrate:status')
    ->expectsTable(['Ran?', 'Migration'], [
        ['Yes', '2026_01_01_000000_create_users_table'],
    ])
    ->assertExitCode(0);
```
