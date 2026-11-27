---
name: laravel-error-handling-and-pages
description: >-
  Production guide to Laravel 13 & PHP 8.6+ Error Handling, Custom Error Pages
  (400-504), Reusable UI Error Components (inline field errors, summaries, error
  boundaries, fallback cards), and HTTP/HTTPS Transport Error Components (419
  CSRF refresh, 429 retry-after countdown, HTTPS enforcement, TLS/SSL failures,
  mixed-content, offline/network recovery) across Blade, Livewire v3/v4, and
  Inertia.js v2 (Vue 3 TS, React 19 TS, Svelte 5 Runes).
---

# Laravel 13 Error Handling, Error Pages & HTTP/HTTPS Error Components Skill

This skill standardizes backend exception orchestration, RFC 7807 JSON Problem Details, custom error pages (`400`–`504`), reusable validation/boundary error components, and **HTTP / HTTPS transport error components** across Blade, Livewire v3/v4, and Inertia.js v2.

> 📖 **Master Specification**: For full architectural sequence diagrams, complete Blade/Vue/React/Svelte component suites, and Pest 3 verification tests, see **[docs/architecture/error-handling-pages-and-components.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/error-handling-pages-and-components.md)**.

---

## 1. Unified Exception Architecture (`bootstrap/app.php`)

Never create legacy `app/Exceptions/Handler.php`. Configure all reporting, throttling, RFC 7807 JSON rendering, and Inertia/Blade error pages inside `bootstrap/app.php` with Trace ID (`X-Request-Id`) correlation and `Cache-Control: no-store, private` headers so proxies/CDNs never cache error responses.

```php
<?php

declare(strict_types=1);

use App\Exceptions\DomainException;
use App\Http\Middleware\AttachRequestContextMiddleware;
use App\Support\Http\ProblemDetailsFactory;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(AttachRequestContextMiddleware::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // 1. Deduplicate noisy reports and throttle repeated upstream outages
        $exceptions->dontReportDuplicates();

        // 2. Force JSON Problem Details on all API endpoints regardless of Accept header
        $exceptions->shouldRenderJsonWhen(
            static fn (Request $request, Throwable $e): bool =>
                $request->is('api/*') || $request->expectsJson(),
        );

        // 3. Render RFC 7807 Problem Details for API requests (zero stack-trace leakage in prod)
        $exceptions->render(static function (Throwable $e, Request $request): ?Response {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            return ProblemDetailsFactory::fromThrowable($e, $request);
        });

        // 4. Unified Inertia.js v2 error page rendering + strict no-store cache headers
        $exceptions->respond(static function (Response $response, Throwable $e, Request $request): Response {
            $status = $response->getStatusCode();
            $traceId = (string) Context::get('trace_id', $request->attributes->get('trace_id', ''));

            if ($traceId !== '') {
                $response->headers->set('X-Request-Id', $traceId);
            }

            // Never allow CDNs or browsers to cache 4xx/5xx error responses
            if ($status >= 400) {
                $response->headers->set('Cache-Control', 'no-store, private');
            }

            if (
                $request->header('X-Inertia') !== null
                && ! app()->environment(['local', 'testing'])
                && in_array($status, [400, 401, 403, 404, 419, 429, 500, 502, 503, 504], true)
            ) {
                if ($status === 419) {
                    return back()->with('error', [
                        'status' => 419,
                        'code' => 'SESSION_EXPIRED',
                        'message' => 'Your session expired. Refreshing security token — please try again.',
                        'trace_id' => $traceId,
                    ]);
                }

                return Inertia::render('errors/Index', [
                    'status' => $status,
                    'traceId' => $traceId,
                    'retryAfter' => $response->headers->get('Retry-After'),
                    'isSecure' => $request->isSecure(),
                ])
                    ->toResponse($request)
                    ->setStatusCode($status)
                    ->header('Cache-Control', 'no-store, private')
                    ->header('X-Request-Id', $traceId);
            }

            return $response;
        });
    })
    ->create();
```

### RFC 7807 `ProblemDetailsFactory` (`app/Support/Http/ProblemDetailsFactory.php`)

```php
<?php

declare(strict_types=1);

namespace App\Support\Http;

use App\Exceptions\DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ProblemDetailsFactory
{
    private function __construct() {}

    #[\NoDiscard]
    public static function fromThrowable(Throwable $e, Request $request): JsonResponse
    {
        $traceId = (string) Context::get('trace_id', $request->attributes->get('trace_id', ''));

        [$status, $code, $title, $detail, $extraHeaders] = match (true) {
            $e instanceof DomainException => [
                $e->statusCode(),
                $e->errorCode(),
                $e->title(),
                $e->getMessage(),
                [],
            ],
            $e instanceof ValidationException => [
                Response::HTTP_UNPROCESSABLE_ENTITY,
                'VALIDATION_FAILED',
                'Validation Failed',
                'One or more input fields failed validation.',
                [],
            ],
            $e instanceof AuthenticationException => [
                Response::HTTP_UNAUTHORIZED,
                'UNAUTHENTICATED',
                'Authentication Required',
                'You must sign in to access this resource.',
                [],
            ],
            $e instanceof AuthorizationException => [
                Response::HTTP_FORBIDDEN,
                'FORBIDDEN',
                'Access Denied',
                'You do not have permission to perform this action.',
                [],
            ],
            $e instanceof ModelNotFoundException => [
                Response::HTTP_NOT_FOUND,
                'RESOURCE_NOT_FOUND',
                'Resource Not Found',
                'The requested resource could not be found.',
                [],
            ],
            $e instanceof ThrottleRequestsException => [
                Response::HTTP_TOO_MANY_REQUESTS,
                'RATE_LIMIT_EXCEEDED',
                'Too Many Requests',
                'Request rate limit exceeded. Wait before retrying.',
                $e->getHeaders(),
            ],
            $e instanceof HttpExceptionInterface => [
                $e->getStatusCode(),
                'HTTP_' . $e->getStatusCode(),
                Response::$statusTexts[$e->getStatusCode()] ?? 'HTTP Error',
                $e->getMessage() !== '' ? $e->getMessage() : 'Request could not be completed.',
                $e->getHeaders(),
            ],
            default => [
                Response::HTTP_INTERNAL_SERVER_ERROR,
                'INTERNAL_SERVER_ERROR',
                'Internal Server Error',
                app()->hasDebugModeEnabled()
                    ? $e->getMessage()
                    : 'An unexpected error occurred. Reference your trace ID if contacting support.',
                [],
            ],
        };

        $payload = [
            'type' => sprintf('https://api.%s/errors/%s', parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'example.com', strtolower($code)),
            'title' => $title,
            'status' => $status,
            'code' => $code,
            'detail' => $detail,
            'instance' => $request->path(),
            'trace_id' => $traceId,
        ];

        if ($e instanceof ValidationException) {
            $payload['errors'] = $e->errors();
        }

        return response()
            ->json($payload, $status, array_merge($extraHeaders, [
                'Content-Type' => 'application/problem+json',
                'Cache-Control' => 'no-store, private',
                'X-Request-Id' => $traceId,
            ]));
    }
}
```

---

## 2. Canonical Error Pages & Component Directory Tree

Aligned cleanly with the **4-Tier Frontend Directory Standard**:

```text
resources/views/
├── layouts/
│   └── error.blade.php                      # Minimal, zero-DB-query error shell
├── components/
│   ├── ui/
│   │   └── error/
│   │       ├── field.blade.php              # Inline validation error (role="alert")
│   │       ├── summary.blade.php            # Accessible validation summary banner
│   │       └── inline-fallback.blade.php    # Recoverable widget fallback card
│   └── error/
│       ├── http-status.blade.php            # Unified 4xx/5xx HTTP status component
│       └── https-transport.blade.php        # HTTPS/TLS/Mixed-Content/Offline component
└── errors/                                  # Laravel native Blade error views
    ├── 400.blade.php
    ├── 401.blade.php
    ├── 402.blade.php
    ├── 403.blade.php
    ├── 404.blade.php
    ├── 419.blade.php                        # CSRF / Session Expired
    ├── 422.blade.php
    ├── 429.blade.php                        # Rate Limited (with Retry-After countdown)
    ├── 500.blade.php
    ├── 502.blade.php
    ├── 503.blade.php                        # Maintenance / Upstream Unavailable
    └── 504.blade.php                        # Gateway Timeout

resources/js/
├── layouts/
│   └── ErrorLayout.[vue|tsx|svelte]
├── components/
│   ├── ui/error/
│   │   ├── FieldError.[vue|tsx|svelte]
│   │   ├── ErrorSummary.[vue|tsx|svelte]
│   │   └── ErrorBoundary.[vue|tsx|svelte]
│   └── error/
│       ├── HttpErrorCard.[vue|tsx|svelte]
│       └── HttpsTransportAlert.[vue|tsx|svelte]
└── pages/
    └── errors/
        └── Index.[vue|tsx|svelte]
```

> [!CAUTION]
> **Error Layout Isolation Rule**: `layouts/error.blade.php` MUST NEVER invoke authenticated user queries, session-dependent sidebars, or Eloquent calls. If a `500` or `503` occurred because the database or Redis is down, calling `auth()->user()` inside the error layout triggers a cascading double-fault blank screen.

---

## 3. HTTP & HTTPS Error Components (Blade + Alpine / Livewire)

### A. Unified HTTP Status Component (`resources/views/components/error/http-status.blade.php`)

```blade
@props([
    'status' => 500,
    'title' => null,
    'detail' => null,
    'traceId' => null,
    'retryAfter' => null,
])

@php
    $catalog = [
        400 => ['Bad Request', 'The request syntax or parameters could not be understood.'],
        401 => ['Sign-In Required', 'Your session is missing or unauthenticated. Sign in to continue.'],
        402 => ['Payment Required', 'An active subscription or settled invoice is required to access this feature.'],
        403 => ['Access Denied', 'You do not have permission to view or modify this resource.'],
        404 => ['Page Not Found', 'The resource you requested does not exist or has been moved.'],
        419 => ['Session Expired', 'Your security token expired due to inactivity. Reload to issue a fresh token.'],
        422 => ['Unprocessable Request', 'Submitted data could not be processed. Review highlighted fields.'],
        429 => ['Too Many Requests', 'You have hit the rate limit. Wait for the cooldown timer before retrying.'],
        500 => ['Server Error', 'Something went wrong on our side. Our engineering team has been notified.'],
        502 => ['Bad Gateway', 'An upstream service returned an invalid response. Please try again shortly.'],
        503 => ['Service Temporarily Unavailable', 'The platform is undergoing maintenance or recovering from load.'],
        504 => ['Gateway Timeout', 'An upstream HTTPS dependency took too long to respond.'],
    ];

    [$defaultTitle, $defaultDetail] = $catalog[(int) $status] ?? ['Unexpected Error', 'An unexpected error occurred.'];
    $resolvedTitle = $title ?? $defaultTitle;
    $resolvedDetail = $detail ?? $defaultDetail;
    $resolvedTrace = $traceId ?? request()->attributes->get('trace_id');
    $retrySeconds = is_numeric($retryAfter) ? max(1, (int) $retryAfter) : null;
    $isServerError = (int) $status >= 500;
@endphp

<section
    role="alert"
    aria-live="assertive"
    class="mx-auto w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-zinc-100 shadow-xl"
>
    <div class="flex items-center justify-between gap-4">
        <span class="font-mono text-sm font-semibold {{ $isServerError ? 'text-rose-400' : 'text-amber-400' }}">
            HTTP {{ (int) $status }}
        </span>

        @if ($resolvedTrace)
            <button
                type="button"
                x-data="{ copied: false }"
                x-on:click="navigator.clipboard?.writeText('{{ e($resolvedTrace) }}'); copied = true; setTimeout(() => copied = false, 2000)"
                class="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
            >
                <span x-text="copied ? 'Copied Trace ID' : 'Trace: {{ e(substr((string) $resolvedTrace, 0, 12)) }}'"></span>
            </button>
        @endif
    </div>

    <h1 class="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 text-balance">
        {{ $resolvedTitle }}
    </h1>

    <p class="mt-3 text-base leading-relaxed text-zinc-400 text-pretty">
        {{ $resolvedDetail }}
    </p>

    @if ($retrySeconds !== null)
        <div
            x-data="{ remaining: {{ $retrySeconds }} }"
            x-init="const t = setInterval(() => { if (remaining > 0) remaining--; else clearInterval(t); }, 1000)"
            class="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-mono text-sm text-amber-300"
        >
            <span x-show="remaining > 0">Retry available in <strong x-text="remaining"></strong>s</span>
            <span x-show="remaining === 0">Cooldown finished — you may retry now.</span>
        </div>
    @endif

    <div class="mt-8 flex flex-wrap items-center gap-3">
        @if ((int) $status === 419 || $isServerError)
            <button
                type="button"
                onclick="window.location.reload()"
                class="inline-flex items-center justify-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition-transform duration-150 hover:bg-white active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
                Reload Page
            </button>
        @elseif ((int) $status === 401)
            <a
                href="{{ route('login', [], false) }}"
                class="inline-flex items-center justify-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition-transform duration-150 hover:bg-white active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
                Sign In
            </a>
        @endif

        <a
            href="/"
            class="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
        >
            Return Home
        </a>
    </div>
</section>
```

### B. HTTPS / TLS & Network Transport Error Component (`resources/views/components/error/https-transport.blade.php`)

Handles insecure HTTP access warnings in production, network offline drops, and upstream TLS/HTTPS gateway errors without leaking internal hostnames:

```blade
@props([
    'enforceHttps' => app()->isProduction(),
    'httpsUrl' => null,
])

<div
    x-data="{
        offline: !navigator.onLine,
        insecure: {{ $enforceHttps ? 'true' : 'false' }} && window.location.protocol === 'http:',
        transportError: null,
        upgradeToHttps() {
            const target = {{ \Illuminate\Support\Js::from($httpsUrl) }}
                || window.location.href.replace(/^http:\/\//i, 'https://');
            window.location.replace(target);
        }
    }"
    x-on:online.window="offline = false"
    x-on:offline.window="offline = true"
    x-on:http-transport-error.window="transportError = $event.detail"
    class="fixed inset-x-0 top-0 z-50 flex flex-col gap-2 p-3 pointer-events-none"
    aria-live="assertive"
>
    {{-- 1. Insecure HTTP Protocol Alert (Offer instant HTTPS upgrade) --}}
    <template x-if="insecure">
        <div role="alert" class="pointer-events-auto mx-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-xl border border-amber-500/40 bg-zinc-950/95 px-4 py-3 text-sm text-amber-200 shadow-lg">
            <span>This connection is using unencrypted HTTP. Switch to HTTPS to protect your credentials and session.</span>
            <button
                type="button"
                x-on:click="upgradeToHttps()"
                class="shrink-0 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
                Switch to HTTPS
            </button>
        </div>
    </template>

    {{-- 2. Browser Offline / TLS Handshake Drop Alert --}}
    <template x-if="offline">
        <div role="alert" class="pointer-events-auto mx-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-zinc-950/95 px-4 py-3 text-sm text-rose-200 shadow-lg">
            <span>Network connection lost. Waiting for a secure HTTPS connection to resume...</span>
            <button
                type="button"
                onclick="window.location.reload()"
                class="shrink-0 rounded-md border border-rose-400/40 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/20"
            >
                Retry
            </button>
        </div>
    </template>

    {{-- 3. Livewire / Fetch Upstream HTTP/HTTPS Transport Failure Toast --}}
    <template x-if="transportError">
        <div role="alert" class="pointer-events-auto mx-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-zinc-950/95 px-4 py-3 text-sm text-zinc-100 shadow-lg">
            <div>
                <p class="font-medium text-rose-300" x-text="transportError.title || 'Secure Request Failed'"></p>
                <p class="text-xs text-zinc-400" x-text="transportError.detail || 'Could not reach the server over HTTPS.'"></p>
            </div>
            <button
                type="button"
                x-on:click="transportError = null"
                class="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
                Dismiss
            </button>
        </div>
    </template>
</div>
```

### C. Inline Validation & Summary Error Components

```blade
{{-- resources/views/components/ui/error/field.blade.php --}}
@props(['name'])

@error($name)
    <p
        id="{{ $name }}-error"
        role="alert"
        aria-live="polite"
        {{ $attributes->merge(['class' => 'mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-400']) }}
    >
        <x-icon.alert-circle class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{{ $message }}</span>
    </p>
@enderror
```

```blade
{{-- resources/views/components/ui/error/summary.blade.php --}}
@props(['bag' => 'default'])

@php($errorBag = $errors->getBag($bag))

@if ($errorBag->any())
    <div
        role="alert"
        aria-live="assertive"
        tabindex="-1"
        {{ $attributes->merge(['class' => 'rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200']) }}
    >
        <p class="font-semibold text-rose-100">
            Please correct {{ $errorBag->count() }} {{ \Illuminate\Support\Str::plural('error', $errorBag->count()) }} before continuing:
        </p>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-200/90">
            @foreach ($errorBag->all() as $message)
                <li>{{ $message }}</li>
            @endforeach
        </ul>
    </div>
@endif
```

---

## 4. Server-Side HTTPS Enforcement Middleware

```php
<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureHttpsRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! app()->isProduction() || $request->isSecure()) {
            return $next($request);
        }

        // APIs reject plaintext HTTP downgrade with 426 Upgrade Required (never silently downgrade POST bodies)
        if ($request->is('api/*') || $request->expectsJson()) {
            return response()->json([
                'type' => 'https://api.example.com/errors/https-required',
                'title' => 'HTTPS Required',
                'status' => Response::HTTP_UPGRADE_REQUIRED,
                'code' => 'HTTPS_REQUIRED',
                'detail' => 'All API requests must use HTTPS (TLS 1.2+).',
                'instance' => $request->path(),
            ], Response::HTTP_UPGRADE_REQUIRED, [
                'Content-Type' => 'application/problem+json',
                'Upgrade' => 'TLS/1.3, HTTP/1.1',
                'Cache-Control' => 'no-store, private',
            ]);
        }

        // Web traffic uses 308 Permanent Redirect (preserves HTTP method safely)
        return redirect()->secure($request->getRequestUri(), Response::HTTP_PERMANENTLY_REDIRECT);
    }
}
```

Pair with `URL::forceScheme('https')` in `AppServiceProvider::boot()` when `app()->isProduction()` and explicit `TrustProxies` CIDRs (`Request::HEADER_X_FORWARDED_PROTO`) so reverse proxies (Cloudflare, AWS ALB, Nginx) never create HTTP$\leftrightarrow$HTTPS redirect loops.

---

## 5. Livewire v3/v4 & Inertia.js v2 Client Error Interception

```ts
// resources/js/bootstrap-errors.ts — Livewire & Inertia unified HTTP/HTTPS error hook
import { router } from '@inertiajs/vue3'; // or @inertiajs/react / @inertiajs/svelte

export function registerTransportErrorHandlers(): void {
    // 1. Inertia non-Inertia / network / TLS exception hook
    router.on('exception', (event) => {
        window.dispatchEvent(
            new CustomEvent('http-transport-error', {
                detail: {
                    title: 'Network or HTTPS Error',
                    detail: 'Unable to reach the server securely. Verify your connection and retry.',
                },
            }),
        );
        event.preventDefault();
    });

    // 2. Livewire v3/v4 global failure hook (419 CSRF, 429 throttle, 500/503 server error)
    document.addEventListener('livewire:init', () => {
        const lw = (window as unknown as { Livewire?: { hook: Function } }).Livewire;
        lw?.hook('request', ({ fail }: { fail: (cb: (ctx: { status: number; preventDefault: () => void }) => void) => void }) => {
            fail(({ status, preventDefault }) => {
                preventDefault();
                const messages: Record<number, { title: string; detail: string }> = {
                    419: { title: 'Session Expired', detail: 'Reload the page to refresh your security token.' },
                    429: { title: 'Rate Limit Reached', detail: 'Please wait a few seconds before trying again.' },
                    503: { title: 'Service Unavailable', detail: 'The service is temporarily unavailable.' },
                };
                window.dispatchEvent(
                    new CustomEvent('http-transport-error', {
                        detail: messages[status] ?? {
                            title: `HTTP ${status} Error`,
                            detail: 'The request could not be completed. Please retry.',
                        },
                    }),
                );
            });
        });
    });
}
```
