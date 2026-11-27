---
name: laravel-auth-and-access-guard
description: >-
  Deep-dive Laravel & PHP security guard for authentication, authorization, and
  request-integrity vulnerabilities: Cross-Site Request Forgery (CSRF), Broken
  Access Control (IDOR / Policies / Scoped Bindings / Livewire #[Locked]), Mass
  Assignment, Open Redirect, and Broken Authentication. Load when auditing or
  hardening any of these 5 classes.
---

# Laravel Auth, Access & Request Integrity Guard

Covers **5 critical access, session, and request-integrity vulnerability classes** with idiomatic Laravel 13 / PHP 8.6+ defenses.

---

## #3 Cross-Site Request Forgery — CSRF (CWE-352)

### High-Risk Sinks
- Wildcard or overly broad exceptions in `bootstrap/app.php` (`validateCsrfTokens(except: ['*'])` or `'api/*'` on cookie-authenticated routes).
- Blade `<form method="POST">` missing `@csrf`.
- State-changing `Route::get('/delete-account', ...)` endpoints (browsers send cookies on cross-site `<img>`/navigation GETs).
- `config/session.php` with `'same_site' => null` or `'none'` without explicit need.

### Hardened Patterns
1. **Strict `bootstrap/app.php` CSRF config**:
   ```php
   ->withMiddleware(function (Middleware $middleware): void {
       // Only exempt stateless webhooks that enforce HMAC verification via hash_equals()
       $middleware->validateCsrfTokens(except: [
           'webhooks/stripe',
       ]);
   })
   ```
2. **State mutations**: Use `POST`/`PUT`/`PATCH`/`DELETE` strictly, include `@csrf` in every Blade form, and configure Sanctum stateful SPAs to call `/sanctum/csrf-cookie` with `X-XSRF-TOKEN`.
3. **Cookie hardening (`config/session.php`)**: `'same_site' => 'lax'` (or `'strict'` for admin panels).

---

## #4 Broken Access Control & IDOR (CWE-284 / CWE-639)

### High-Risk Sinks
- Missing `auth` / `auth:sanctum` / `can:` middleware on controllers or route groups.
- Form Requests with `authorize(): bool { return true; }` on resource updates/deletes without checking ownership or Policies.
- Nested routes `/organizations/{organization}/invoices/{invoice}` without `->scopeBindings()` (attacker supplies their own `{organization}` + victim's `{invoice}`!).
- Predictable auto-increment integer IDs exposing total counts and enabling sequential scraping.
- Livewire components exposing public `$recordId`, `$price`, or `$role` without `#[Locked]` or failing to re-authorize inside every public action method.

### Hardened Patterns
1. **Scoped Route Model Binding + Policy Middleware**:
   ```php
   Route::middleware(['auth:sanctum', 'throttle:60,1'])
       ->prefix('v1/organizations/{organization}')
       ->scopeBindings()
       ->group(function (): void {
           Route::get('/invoices/{invoice}', ShowInvoiceController::class)
               ->can('view', 'invoice');
           Route::delete('/invoices/{invoice}', DeleteInvoiceController::class)
               ->can('delete', 'invoice');
       });
   ```
2. **Form Request Authorization**:
   ```php
   public function authorize(): bool
   {
       /** @var Invoice $invoice */
       $invoice = $this->route('invoice');

       return $this->user()?->can('update', $invoice) ?? false;
   }
   ```
3. **Livewire Security**:
   ```php
   use Livewire\Attributes\Locked;

   #[Locked]
   public string $invoiceId;

   public function approve(): void
   {
       $invoice = Invoice::query()->findOrFail($this->invoiceId);
       $this->authorize('approve', $invoice);
       // ...
   }
   ```
4. **ULIDs**: Use `$table->ulid('id')->primary();` (`HasUlids`) on externally exposed models.

---

## #8 Mass Assignment (CWE-915)

### High-Risk Sinks
- `protected $guarded = [];` or `Model::unguard();` in models or service providers.
- Passing `$request->all()` or `$request->input()` directly into `User::create(...)`, `$user->update(...)`, or `$user->fill(...)`.
- Including privilege or financial columns (`is_admin`, `role`, `tenant_id`, `email_verified_at`, `balance`) in `$fillable` / `#[Fillable]`.

### Hardened Pattern
1. **Explicit Allowlist via PHP 8 Attribute**:
   ```php
   <?php

   declare(strict_types=1);

   namespace App\Models;

   use Illuminate\Database\Eloquent\Attributes\Fillable;
   use Illuminate\Database\Eloquent\Attributes\Hidden;
   use Illuminate\Database\Eloquent\Model;

   #[Fillable(['name', 'email', 'timezone'])]
   #[Hidden(['password', 'remember_token', 'two_factor_secret'])]
   class User extends Model {}
   ```
2. **Enforce Strict Discard Detection in `AppServiceProvider::boot()`**:
   ```php
   Model::preventSilentlyDiscardingAttributes(! app()->isProduction());
   ```
3. **Validated DTO Input**: Always persist `$request->validated()` or explicit DTO fields from a Form Request. Assign privileged columns (`$user->role = Role::Admin; $user->save();`) explicitly only inside authorized Admin Actions.

---

## #9 Open Redirect (CWE-601)

### High-Risk Sinks
- `redirect($request->input('next'))`, `redirect()->to($url)`, `redirect()->away($url)`.
- Naive checks like `str_starts_with($url, '/')` — **bypassed by `//evil.com` (protocol-relative) or `/\evil.com` (browser backslash normalization)!**

### Hardened Pattern: `SafeRedirect`
```php
<?php

declare(strict_types=1);

namespace App\Support;

final class SafeRedirect
{
    /** @var list<string> */
    private const array ALLOWED_HOSTS = [
        'app.example.com',
        'docs.example.com',
    ];

    public static function sanitize(?string $target, string $fallback = '/dashboard'): string
    {
        if ($target === null) {
            return $fallback;
        }

        $target = trim($target);
        if ($target === '' || preg_match('/[\x00-\x1F\x7F\\\\]/', $target) === 1) {
            return $fallback;
        }

        // Allow strict relative paths starting with a single '/' (reject '//evil.com')
        if (str_starts_with($target, '/') && ! str_starts_with($target, '//')) {
            return $target;
        }

        $parsed = parse_url($target);
        $scheme = strtolower((string) ($parsed['scheme'] ?? ''));
        $host = strtolower((string) ($parsed['host'] ?? ''));

        if ($scheme === 'https' && in_array($host, self::ALLOWED_HOSTS, true)) {
            return $target;
        }

        return $fallback;
    }
}
```
For login redirects, prefer Laravel's built-in `redirect()->intended('/dashboard')`.

---

## #13 Broken Authentication (CWE-287)

### High-Risk Sinks
- Weak password hashing (`md5()`, `sha1()`), weak password rules, or missing `Hash::needsRehash()`.
- Unthrottled `/login`, `/forgot-password`, `/reset-password`, `/two-factor-challenge`, or OTP verification endpoints (enables brute-force & credential stuffing).
- Missing `$request->session()->regenerate()` on login / privilege escalation (Session Fixation), or missing `$request->session()->invalidate()` + `regenerateToken()` on logout.
- Session cookies missing `'http_only' => true`, `'secure' => true`, `'same_site' => 'lax'`.
- Timing side channels using `===` / `==` to verify API keys, OTPs, or HMAC signatures instead of `hash_equals()`.
- Sanctum tokens issued with wildcard `['*']` abilities and `expiration => null`.
- User enumeration via distinct error messages ("Email not found" vs "Wrong password") or timing differences.

### Hardened Checklist & Patterns
1. **Global Strong Password Policy (`AppServiceProvider::boot()`)**:
   ```php
   Password::defaults(static function (): Password {
       $rule = Password::min(12);

       return app()->isProduction()
           ? $rule->mixedCase()->numbers()->symbols()->uncompromised()
           : $rule;
   });
   ```
2. **Dedicated Auth Rate Limiter (`AppServiceProvider::boot()`)**:
   ```php
   RateLimiter::for('login', static function (Request $request): array {
       $email = Str::lower((string) $request->input('email'));

       return [
           Limit::perMinute(5)->by($email . '|' . $request->ip()),
           Limit::perMinute(20)->by($request->ip()),
       ];
   });
   ```
3. **Session Fixation & Logout Hygiene**:
   ```php
   // On successful login:
   $request->session()->regenerate();

   // On logout:
   Auth::guard('web')->logout();
   $request->session()->invalidate();
   $request->session()->regenerateToken();
   ```
4. **Scoped, Expiring Sanctum Tokens**: Set `'expiration' => 60 * 24` in `config/sanctum.php` and mint tokens with least-privilege abilities (`$user->createToken('ci', ['invoices:read'], now()->addHours(12))`).
5. **Constant-Time Verification**: Always use `hash_equals($expected, $provided)` for tokens, webhooks, and signatures.
