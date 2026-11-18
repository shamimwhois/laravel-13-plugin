# Modern Laravel 13 & PHP 8.5+ API Design Architecture Guide

> **Document**: `docs/api/design.md`  
> **Framework**: Laravel 13 & PHP 8.5+  
> **Standards Compliance**: RFC 7807 (Problem Details), RESTful JSON, ISO-8601, JSON:API, PHPStan Level 8 / max.

---

## 🏛️ Executive API Design Philosophy

Modern enterprise APIs in Laravel 13 must be **predictable**, **type-safe**, **idempotent**, and **resilient**. This specification defines the production standards for:
- Uniform RESTful routing and URL conventions.
- HTTP status codes and semantics.
- Standardized response envelopes and RFC 7807 Problem Details.
- Mandatory `JsonResource` serialization.
- Dedicated Form Requests with DTO transformations.
- Fine-grained token authentication (Sanctum).
- Multi-tier rate limiting and concurrency control.

---

## 1. RESTful URL Architecture & Versioning

### A. Core URL Rules
1. **URL Versioning**: Prefix all API routes with the version identifier: `/api/v1/{resource}`.
2. **Kebab-Case Paths**: Use lowercase kebab-case for multi-word URI segments (`/user-profiles`, `/order-items`).
3. **Plural Nouns for Resources**: Use plural nouns for entity collections (`/orders`, `/invoices`, `/webhooks`).
4. **Singular Route Parameters**: Route model binding parameters must be singular (`{order}`, `{user}`).

### B. Route Hierarchy & Shallow Nesting
Never nest resources more than **one level deep**. Deep nesting (`/users/{user}/posts/{post}/comments/{comment}`) creates brittle, uncacheable URLs.

```php
// ✅ Shallow Nesting (Standard)
Route::prefix('v1')->name('api.v1.')->group(function () {
    // Top-level resources
    Route::apiResource('articles', ArticleController::class);
    
    // 1-Level Nested: Listing and creating comments for an article
    Route::get('/articles/{article}/comments', ArticleCommentIndexController::class)->name('articles.comments.index');
    Route::post('/articles/{article}/comments', ArticleCommentStoreController::class)->name('articles.comments.store');
    
    // Top-level for individual child operations (Update, Show, Delete)
    Route::apiResource('comments', CommentController::class)->only(['show', 'update', 'destroy']);
});
```

---

## 2. HTTP Verbs & Status Code Semantics

Adhere strictly to standard HTTP status codes:

| Verb | Path | Success Code | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orders` | `200 OK` | Retrieve a paginated list of resources. |
| `GET` | `/api/v1/orders/{order}` | `200 OK` | Retrieve a single resource. |
| `POST` | `/api/v1/orders` | `201 Created` | Create a new resource (returns created resource & `Location` header). |
| `PUT` | `/api/v1/orders/{order}` | `200 OK` | Full replacement of the resource. |
| `PATCH` | `/api/v1/orders/{order}` | `200 OK` | Partial update of specific resource attributes. |
| `DELETE` | `/api/v1/orders/{order}` | `204 No Content` | Delete the resource; empty response body. |

### Standard Error Status Codes:
- `400 Bad Request`: Malformed JSON or invalid query syntax.
- `401 Unauthorized`: Missing or invalid Bearer token / authentication failure.
- `403 Forbidden`: Authenticated user lacks permission / Policy gate denial.
- `404 Not Found`: Model or route does not exist.
- `409 Conflict`: Business invariant collision (e.g., duplicate slug, optimistic lock failure).
- `422 Unprocessable Entity`: Form Request validation failure with field-level errors.
- `429 Too Many Requests`: Rate limiter exceeded (`Retry-After` header sent).
- `500 Internal Server Error`: Unhandled server exception (sanitized in production).

---

## 3. Standardized Response Envelope & RFC 7807 Errors

### A. Success Response Envelopes

#### 1. Single Resource:
```json
{
  "data": {
    "id": "01j8m2a8p9q8b8n3v8b2c4d5e6",
    "type": "orders",
    "status": "processing",
    "total_cents": 12500,
    "currency": "USD",
    "created_at": "2026-11-19T00:30:00.000000Z"
  }
}
```

#### 2. Paginated Collection:
```json
{
  "data": [
    {
      "id": "01j8m2a8p9q8b8n3v8b2c4d5e6",
      "type": "orders",
      "status": "processing",
      "total_cents": 12500,
      "currency": "USD",
      "created_at": "2026-11-19T00:30:00.000000Z"
    }
  ],
  "links": {
    "first": "https://api.example.com/api/v1/orders?page=1",
    "last": "https://api.example.com/api/v1/orders?page=10",
    "prev": null,
    "next": "https://api.example.com/api/v1/orders?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 10,
    "per_page": 15,
    "to": 15,
    "total": 150
  }
}
```

---

### B. Standard Error Envelope (RFC 7807 Problem Details)

All API error responses must adhere to the RFC 7807 Problem Details specification:

#### Validation Failure (`422 Unprocessable Entity`):
```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The given data was invalid.",
  "code": "VALIDATION_FAILED",
  "instance": "/api/v1/orders",
  "errors": {
    "items.0.product_id": [
      "The selected product_id is invalid."
    ],
    "payment_method_id": [
      "The payment_method_id field is required."
    ]
  }
}
```

#### Domain / Authorization Failure (`403 Forbidden`):
```json
{
  "type": "https://api.example.com/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "You do not have permission to access orders from another organization.",
  "code": "ORGANIZATION_ACCESS_DENIED",
  "instance": "/api/v1/orders/01j8m2a8p9q8b8n3v8b2c4d5e6"
}
```

---

## 4. Mandatory `JsonResource` & `ResourceCollection`

> [!CAUTION]
> **Zero Raw Eloquent Model Returns**: Never return Eloquent models directly (`return $user;`). Raw returns leak hidden database attributes (`password_hash`, `stripe_id`), bypass ISO-8601 date formatting, and create un-versioned API contracts.

### Complete `JsonResource` Implementation
```php
<?php

declare(strict_types=1);

namespace App\Http\Resources\Orders;

use App\Http\Resources\Customers\CustomerResource;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Order
 */
final class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => 'orders',
            'order_number' => $this->order_number,
            'status' => $this->status->value,
            'total_cents' => $this->total_cents,
            'currency' => $this->currency,
            
            // Conditional relationship loading (strictly prevents N+1 queries)
            'customer' => CustomerResource::make($this->whenLoaded('customer')),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
            'items_count' => $this->whenCounted('items'),
            
            // Conditional authorization attribute
            'profit_margin' => $this->when(
                $request->user()?->can('viewProfits', $this->resource),
                fn(): float => $this->calculateProfitMargin()
            ),
            
            // Standardized ISO-8601 timestamps
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
        ];
    }
}
```

---

## 5. Dedicated Form Requests & DTO Mapping

Controllers must remain thin. The Form Request handles:
1. Authorization via policies (`authorize(): bool`).
2. Type-safe validation rules (`rules(): array`).
3. DTO transformation (`toDto()`).

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Orders;

use App\Data\CreateOrderDto;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var User|null $user */
        $user = $this->user();
        return $user !== null && $user->can('create', Order::class);
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'ulid', Rule::exists('products', 'id')],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'payment_token' => ['required', 'string', 'starts_with:tok_'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function userOrFail(): User
    {
        /** @var User|null $user */
        $user = $this->user();
        if ($user === null) {
            abort(401, 'Unauthenticated');
        }
        return $user;
    }

    public function toDto(): CreateOrderDto
    {
        /** @var array{items: list<array{product_id: string, quantity: int}>, payment_token: string, notes?: string|null} $validated */
        $validated = $this->validated();

        return new CreateOrderDto(
            userId: $this->userOrFail()->id,
            items: $validated['items'],
            paymentToken: $validated['payment_token'],
            notes: $validated['notes'] ?? null,
        );
    }
}
```

---

## 6. Thin Invokable Controller Implementation

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Orders;

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
        $order = $action->execute($request->toDto());

        return OrderResource::make($order)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED)
            ->header('Location', route('api.v1.orders.show', ['order' => $order->id]));
    }
}
```

---

## 7. Authentication, Token Abilities & Rate Limiting

### A. Sanctum Token Abilities
Protect sensitive API endpoints using token scopes/abilities:

```php
Route::middleware(['auth:sanctum', 'ability:orders:create'])
    ->post('/orders', StoreOrderController::class)
    ->name('orders.store');
```

### B. Tiered Rate Limiting in `bootstrap/app.php`
```php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for('api', function (Request $request): array {
    $user = $request->user();

    // Authenticated users get plan-based tiered limits
    if ($user !== null) {
        return [
            Limit::perMinute($user->rateLimitPerMinute())->by($user->id),
            Limit::perSecond(15)->by($user->id), // Burst defense
        ];
    }

    // Unauthenticated clients rate-limited by IP
    return [
        Limit::perMinute(60)->by($request->ip()),
    ];
});
```

---

## 8. Idempotency & Concurrency

### A. Mutation Idempotency (`Idempotency-Key`)
For sensitive financial transactions (`POST /orders`, `POST /charges`), require an `Idempotency-Key` header. Store execution results in atomic cache for 24 hours. If a request arrives with the same key, return the cached response immediately without re-executing.

### B. Optimistic Locking (`ETag` & `If-Match`)
Prevent lost update problems on concurrent resource updates (`PATCH /orders/{order}`):
1. Send `ETag: "hash-of-updated-at"` in `GET` responses.
2. Require `If-Match: "etag"` in `PATCH`/`PUT` requests.
3. Return `412 Precondition Failed` if the resource has been modified by another client.

---

## 9. Filtering, Sorting & Pagination Standards

| Query Parameter | Example | Purpose |
| :--- | :--- | :--- |
| `filter[field]` | `?filter[status]=paid` | Filter records by exact or ranged value. |
| `sort` | `?sort=-created_at,total` | Multi-column sort (prefix `-` for descending). |
| `include` | `?include=customer,items` | Eager-load relationships safely (whitelisted). |
| `page[number]`, `page[size]` | `?page[number]=2&page[size]=25` | Page-based pagination for dashboards. |
| `cursor` | `?cursor=eyJpZCI6MTA...` | High-performance cursor pagination for feeds/APIs. |

---

## 📌 Production API Checklist

1. ✅ **Versioned**: Every route starts with `/api/v1/`.
2. ✅ **Nouns & Kebab-case**: Plural nouns for collections, kebab-case for URIs (`/customer-orders`).
3. ✅ **Shallow Routes**: Maximum 1 level of nesting (`/articles/{article}/comments`).
4. ✅ **Zero Model Exposure**: Every response returned through a typed `JsonResource`.
5. ✅ **RFC 7807 Errors**: Error responses return structured problem details with status codes.
6. ✅ **Dedicated Form Requests**: Validation, policy authorization, and DTO extraction.
7. ✅ **Strict Rate Limiting**: Tiered limits with per-second burst protection.
8. ✅ **ISO-8601 Dates**: All timestamps formatted as `.toISOString()`.
9. ✅ **Idempotency**: Critical mutations guarded via `Idempotency-Key`.
10. ✅ **Pest 3 Tests**: Every endpoint tested with status code, schema, and authorization assertions.
