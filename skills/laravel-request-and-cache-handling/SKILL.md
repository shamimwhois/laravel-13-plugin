---
name: laravel-request-and-cache-handling
description: >-
  Master guide to Resilient Request Handling (inbound correlation X-Request-Id
  Context, Form Requests + DTOs + JsonSchema::rules(), Idempotency-Key locks,
  tiered RateLimiter, HTTPS/TrustProxies/TrustHosts, outbound Http:: timeouts,
  exponential retries, TLS enforcement, SSRF defense, circuit breakers) and
  Resilient Cache Handling (Laravel 13 failover store, RedisException &
  LockTimeoutException recovery, Cache::flexible SWR, versioned multi-tenant
  keys, and HTTP Cache-Control / ETag / no-store on errors) in Laravel 13 & PHP 8.6+.
---

# Laravel 13 Resilient Request & Cache Handling Skill

This skill governs the complete **Inbound & Outbound HTTP/HTTPS Request Lifecycle** and **Failure-Resilient Cache Architecture** in Laravel 13 & PHP 8.6+.

> 📖 **Master Specification**: For full architecture flowcharts, circuit breaker implementations, HTTP cache header rules, and Pest 3 test suites, see **[docs/architecture/request-and-cache-resilience.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/request-and-cache-resilience.md)**.

---

## 1. Inbound Request Handling Pipeline

### A. Correlation Trace ID & Context Middleware (`AttachRequestContextMiddleware`)

Attach a sortable ULID `X-Request-Id` on every incoming request, store it in `Illuminate\Support\Facades\Context` (propagating automatically to logs and queued jobs), and echo it on every response (including `4xx`/`5xx` errors):

```php
<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class AttachRequestContextMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $incoming = $request->header('X-Request-Id');
        $traceId = (is_string($incoming) && preg_match('/^[A-Za-z0-9_-]{8,64}$/', $incoming) === 1)
            ? $incoming
            : (string) Str::ulid();

        $request->attributes->set('trace_id', $traceId);

        Context::add([
            'trace_id' => $traceId,
            'http_method' => $request->method(),
            'http_path' => $request->path(),
            'is_secure' => $request->isSecure(),
            'ip' => $request->ip(),
        ]);

        /** @var Response $response */
        $response = $next($request);
        $response->headers->set('X-Request-Id', $traceId);

        return $response;
    }
}
```

### B. Strict Form Request Normalization, Validation & DTO Hydration

Never validate inline inside controllers. Normalize input in `prepareForValidation()`, authorize in `authorize()`, validate via `rules()` (or `JsonSchema::rules()`), and return an immutable DTO:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Orders;

use App\Data\Orders\CreateOrderData;
use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;

final class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Order::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'currency' => strtoupper(trim((string) $this->input('currency', 'USD'))),
            'customer_email' => strtolower(trim((string) $this->input('customer_email', ''))),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer_email' => ['required', 'email:rfc,dns', 'max:254'],
            'currency' => ['required', 'string', 'in:USD,EUR,GBP,BDT'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'ulid', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ];
    }

    #[\NoDiscard]
    public function toDto(): CreateOrderData
    {
        /** @var array{customer_email: string, currency: string, items: list<array{product_id: string, quantity: int}>} $validated */
        $validated = $this->validated();

        return new CreateOrderData(
            userId: (string) $this->userOrFail()->id,
            customerEmail: $validated['customer_email'],
            currency: $validated['currency'],
            items: $validated['items'],
        );
    }
}
```

### C. Atomic Idempotency Middleware (`Idempotency-Key`)

Protect state-mutating API endpoints (`POST /orders`, `POST /payments`) against network retries and double-submissions using `Cache::lock()` + SHA-256 request fingerprint verification:

```php
<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

final class EnforceIdempotencyKeyMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH'], true)) {
            return $next($request);
        }

        $key = $request->header('Idempotency-Key');
        if (! is_string($key) || preg_match('/^[A-Za-z0-9_-]{8,128}$/', $key) !== 1) {
            return response()->json([
                'type' => 'https://api.example.com/errors/missing-idempotency-key',
                'title' => 'Missing or Invalid Idempotency-Key',
                'status' => Response::HTTP_BAD_REQUEST,
                'code' => 'INVALID_IDEMPOTENCY_KEY',
                'detail' => 'Provide a unique Idempotency-Key header (8-128 alphanumeric chars).',
            ], Response::HTTP_BAD_REQUEST, [
                'Content-Type' => 'application/problem+json',
                'Cache-Control' => 'no-store, private',
            ]);
        }

        $scope = ($request->user()?->id ?? $request->ip()) . ':' . $request->path() . ':' . $key;
        $cacheKey = 'idempotency:resp:' . hash('sha256', $scope);
        $fingerprint = hash('sha256', $request->getContent());

        try {
            return Cache::lock('idempotency:lock:' . hash('sha256', $scope), 15)->block(3, function () use ($cacheKey, $fingerprint, $request, $next): Response {
                /** @var array{fingerprint: string, status: int, body: string, content_type: string}|null $stored */
                $stored = Cache::get($cacheKey);

                if ($stored !== null) {
                    if (! hash_equals($stored['fingerprint'], $fingerprint)) {
                        return response()->json([
                            'type' => 'https://api.example.com/errors/idempotency-mismatch',
                            'title' => 'Idempotency Key Payload Mismatch',
                            'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                            'code' => 'IDEMPOTENCY_PAYLOAD_MISMATCH',
                            'detail' => 'This Idempotency-Key was already used with a different request payload.',
                        ], Response::HTTP_UNPROCESSABLE_ENTITY, [
                            'Content-Type' => 'application/problem+json',
                            'Cache-Control' => 'no-store, private',
                        ]);
                    }

                    return response($stored['body'], $stored['status'], [
                        'Content-Type' => $stored['content_type'],
                        'Idempotent-Replayed' => 'true',
                    ]);
                }

                /** @var Response $response */
                $response = $next($request);

                if ($response->getStatusCode() < 500) {
                    Cache::put($cacheKey, [
                        'fingerprint' => $fingerprint,
                        'status' => $response->getStatusCode(),
                        'body' => (string) $response->getContent(),
                        'content_type' => (string) $response->headers->get('Content-Type', 'application/json'),
                    ], now()->addHours(24));
                }

                return $response;
            });
        } catch (LockTimeoutException) {
            return response()->json([
                'type' => 'https://api.example.com/errors/concurrent-request',
                'title' => 'Request Already In Progress',
                'status' => Response::HTTP_CONFLICT,
                'code' => 'IDEMPOTENCY_CONFLICT',
                'detail' => 'A request with this Idempotency-Key is currently being processed.',
            ], Response::HTTP_CONFLICT, [
                'Content-Type' => 'application/problem+json',
                'Retry-After' => '2',
                'Cache-Control' => 'no-store, private',
            ]);
        }
    }
}
```

---

## 2. Outbound HTTP / HTTPS Request Resilience (`Http::` Macros + Circuit Breaker)

1. Always set **explicit `connectTimeout()` and `timeout()`** — never allow unbounded hangs.
2. **Never disable TLS verification** (`withoutVerifying()` is strictly prohibited in production).
3. Retry **only transient failures** (`ConnectionException`, `429`, `502`, `503`, `504`) with jittered exponential backoff, and NEVER retry non-idempotent `POST` charges without an `Idempotency-Key`.
4. Wrap user-supplied URLs through **`SafeHttpClient`** (DNS A/AAAA check + IP pinning + no blind redirects) to prevent SSRF.

```php
// AppServiceProvider::boot()
use Exception;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Http;

Http::macro('resilient', static function (string $baseUrl): PendingRequest {
    return Http::baseUrl($baseUrl)
        ->acceptJson()
        ->withHeaders([
            'X-Request-Id' => (string) Context::get('trace_id', ''),
        ])
        ->connectTimeout(3)
        ->timeout(10)
        ->retry(
            times: 3,
            sleepMilliseconds: static fn (int $attempt): int => (200 * (2 ** ($attempt - 1))) + random_int(0, 100),
            when: static fn (Exception $e): bool =>
                $e instanceof ConnectionException
                || ($e instanceof RequestException && in_array($e->response->status(), [429, 502, 503, 504], true)),
            throw: true,
        );
});
```

---

## 3. Resilient Cache Handling & Failure Recovery

### A. Laravel 13 Native `failover` Cache Store (`config/cache.php`)

Prevent a Redis/Valkey outage from turning every page into a `500 RedisException`:

```php
// config/cache.php
'default' => env('CACHE_STORE', 'failover'),

'stores' => [
    'failover' => [
        'driver' => 'failover',
        'stores' => ['redis', 'database', 'array'],
    ],
    // ...
],
```

### B. `ResilientCache` Support Wrapper (Safe `RedisException` & `LockTimeoutException` Handling)

```php
<?php

declare(strict_types=1);

namespace App\Support;

use Closure;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

final class ResilientCache
{
    private function __construct() {}

    /**
     * Serve stale-while-revalidate via Cache::flexible() and fall back cleanly
     * to the origin callback if the cache backend fails completely.
     *
     * @template TValue
     * @param Closure(): TValue $callback
     * @return TValue
     */
    #[\NoDiscard]
    public static function flexible(string $key, int $freshSeconds, int $staleSeconds, Closure $callback): mixed
    {
        try {
            return Cache::flexible($key, [$freshSeconds, $staleSeconds], $callback);
        } catch (Throwable $e) {
            Log::warning('Cache backend unavailable during flexible fetch; falling back to origin.', [
                'cache_key' => $key,
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return $callback();
        }
    }

    /**
     * Acquire an atomic distributed lock with graceful LockTimeoutException handling.
     *
     * @template TValue
     * @param Closure(): TValue $callback
     * @param Closure(): TValue $onTimeout
     * @return TValue
     */
    #[\NoDiscard]
    public static function withLock(
        string $lockName,
        int $lockSeconds,
        int $waitSeconds,
        Closure $callback,
        Closure $onTimeout,
    ): mixed {
        try {
            return Cache::lock($lockName, $lockSeconds)->block($waitSeconds, $callback);
        } catch (LockTimeoutException) {
            Log::notice('Cache lock contention timeout; invoking fallback.', [
                'lock_name' => $lockName,
            ]);

            return $onTimeout();
        } catch (Throwable $e) {
            Log::error('Cache lock backend error; invoking fallback.', [
                'lock_name' => $lockName,
                'exception' => $e::class,
            ]);

            return $onTimeout();
        }
    }
}
```

### C. HTTP Response Cache Headers Matrix

| Route / Response Type | Required `Cache-Control` Header | Reason |
| :--- | :--- | :--- |
| Public catalog / marketing GET | `public, max-age=300, stale-while-revalidate=60, stale-if-error=3600` + `ETag` | CDN acceleration + resilience during origin blips |
| Authenticated dashboard / API GET | `private, no-cache, must-revalidate` (or `no-store, private` for PII/billing) | Prevents cross-tenant CDN cache poisoning |
| Any `4xx` / `5xx` error response | **`no-store, private`** | Guarantees CDNs & browsers never cache transient errors |
| Auth login / CSRF / webhooks | **`no-store, private`** | Protects tokens, sessions, and nonces |
