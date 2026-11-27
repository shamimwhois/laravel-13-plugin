---
name: laravel-edge-and-supply-chain-guard
description: >-
  Deep-dive Laravel, PHP & infrastructure security guard for edge, transport,
  configuration, and supply-chain vulnerabilities: SSRF, Leaked Secrets, Using
  Components with Known Vulnerabilities (CVEs), Improper Assets Management
  (Debug Mode On), Clickjacking, CORS Misconfiguration, and HTTP Request
  Smuggling. Load when auditing or hardening any of these 7 classes.
---

# Laravel Edge, Config & Supply Chain Guard

Covers **7 critical edge, secrets, configuration, and supply-chain vulnerability classes** with idiomatic Laravel 13 / PHP 8.6+ and reverse-proxy defenses.

---

## #5 Server-Side Request Forgery — SSRF (CWE-918)

### High-Risk Sinks
- Webhooks, URL previewers, avatar/PDF fetchers, or RSS importers calling `Http::get($url)`, Guzzle, `curl_exec()`, or `file_get_contents($url)` on user-supplied URLs.
- **Classic Bypasses**: Redirects (`302` -> `http://169.254.169.254/latest/meta-data/`), DNS rebinding, IPv6 loopback (`[::1]`), IPv6-mapped IPv4 (`[::ffff:127.0.0.1]`), decimal/octal IPs (`http://2130706433`), `file://` / `gopher://` / `dict://` schemes.

### Hardened Pattern: `SafeHttpClient` (DNS A+AAAA Validation + IP Pinning + No Blind Redirects)
```php
<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;

final class SafeHttpClient
{
    /**
     * Validate URL strictly, resolve ALL public A/AAAA IPs, and return a canonically reconstructed URL
     * so parse_url() and libcurl/Guzzle can never disagree on target host/port.
     *
     * @return array{url: string, host: string, port: int, ips: list<string>}
     */
    public static function assertPublicUrl(string $url): array
    {
        if (preg_match('/[\x00-\x1F\x7F\\\\]/', $url) === 1) {
            throw new InvalidArgumentException('URL contains forbidden control characters or backslashes.');
        }

        $parsed = parse_url($url);
        if (! is_array($parsed) || isset($parsed['user']) || isset($parsed['pass'])) {
            throw new InvalidArgumentException('URLs with embedded credentials are forbidden.');
        }

        $scheme = strtolower((string) ($parsed['scheme'] ?? ''));
        $host = strtolower((string) ($parsed['host'] ?? ''));
        $port = $parsed['port'] ?? ($scheme === 'https' ? 443 : 80);

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new InvalidArgumentException('Only valid http/https URLs are permitted.');
        }

        if (! in_array($port, [80, 443], true)) {
            throw new InvalidArgumentException('Outbound requests are restricted to ports 80 and 443.');
        }

        $trimmedHost = trim($host, '[]');
        $ips = filter_var($trimmedHost, FILTER_VALIDATE_IP) !== false
            ? [$trimmedHost]
            : self::resolveAllIps($trimmedHost);

        if ($ips === []) {
            throw new InvalidArgumentException("Unable to resolve host [{$host}].");
        }

        foreach ($ips as $ip) {
            if (! self::isPublicIp($ip)) {
                throw new InvalidArgumentException("SSRF blocked: [{$ip}] is non-public.");
            }
        }

        // Reconstruct canonical URL from validated components only (prevents parser-differential SSRF)
        $authorityHost = str_contains($trimmedHost, ':') ? "[{$trimmedHost}]" : $trimmedHost;
        $path = isset($parsed['path']) && is_string($parsed['path']) ? $parsed['path'] : '/';
        $query = isset($parsed['query']) && is_string($parsed['query']) ? '?' . $parsed['query'] : '';
        $canonicalUrl = sprintf('%s://%s:%d%s%s', $scheme, $authorityHost, $port, $path, $query);

        return ['url' => $canonicalUrl, 'host' => $trimmedHost, 'port' => $port, 'ips' => $ips];
    }

    public static function get(string $url): Response
    {
        $resolved = self::assertPublicUrl($url);

        // Pin ALL validated IPs (comma-separated) for dual-stack IPv6/IPv4 reliability & DNS-rebinding defense
        $pinnedIps = implode(',', $resolved['ips']);

        // Disable automatic redirects (or manually re-validate every hop) and send canonical URL
        return Http::connectTimeout(3)
            ->timeout(5)
            ->withoutRedirecting()
            ->withOptions([
                'curl' => [
                    CURLOPT_RESOLVE => ["{$resolved['host']}:{$resolved['port']}:{$pinnedIps}"],
                ],
            ])
            ->get($resolved['url']);
    }

    /** @return list<string> */
    private static function resolveAllIps(string $host): array
    {
        $records = @dns_get_record($host, DNS_A | DNS_AAAA) ?: [];
        $ips = [];
        foreach ($records as $record) {
            if (isset($record['ip']) && is_string($record['ip'])) {
                $ips[] = $record['ip'];
            }
            if (isset($record['ipv6']) && is_string($record['ipv6'])) {
                $ips[] = $record['ipv6'];
            }
        }

        return $ips;
    }

    private static function isPublicIp(string $ip): bool
    {
        // Normalize IPv6-mapped IPv4 (e.g., ::ffff:127.0.0.1)
        if (str_starts_with(strtolower($ip), '::ffff:')) {
            $mapped = substr($ip, 7);
            if (filter_var($mapped, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
                $ip = $mapped;
            }
        }

        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) !== false;
    }
}
```

---

## #10 Leaked Secrets (CWE-798)

### Audit Checklist
- Verify `.env`, `.env.production`, `.env.local`, and key files (`*.pem`, `*.key`) are in `.gitignore` and NEVER tracked in Git history (`git log --all --full-history -- .env`).
- Ban `env()` calls outside `config/*.php`; always read secrets via `config('services.stripe.secret')`.
- Audit `VITE_*` / `MIX_*` variables — ANYTHING prefixed with `VITE_` is compiled into public browser JS!
- Audit Inertia `HandleInertiaRequests::share()` so sensitive user columns or tokens are never leaked into client page props.
- Add a Monolog log processor to redact `password`, `authorization`, `cookie`, `token`, `secret`, `api_key`, and PAN/CVV fields before writing logs.
- Run secret scanners in CI (`gitleaks detect --source .`).

---

## #11 Using Components with Known Vulnerabilities (CWE-1104)

### Audit & Enforcement Commands
```bash
# 1. Fail CI on any known PHP CVE or abandoned Composer package
composer audit --abandoned=fail --format=table

# 2. Audit JavaScript / frontend dependencies
npm audit --omit=dev --audit-level=moderate

# 3. Cross-ecosystem OSV scan against lockfiles
osv-scanner --lockfile=composer.lock --lockfile=package-lock.json
```
- Always commit `composer.lock` and `package-lock.json`.
- Keep PHP and Laravel on active security-supported branches.
- Enable Dependabot or Renovate with automated security PRs and enforce CVSS remediation SLAs (Critical <= 24h, High <= 7d).

---

## #12 Improper Assets Management — Debug Mode On (CWE-489 / CWE-215)

### Audit Checklist
1. **Production Debug Mode**: `APP_ENV=production` and `APP_DEBUG=false`. In `config/app.php`, ensure `'debug' => (bool) env('APP_DEBUG', false)` (never default to `true`).
2. **Diagnostic Tools**:
   - Never install `barryvdh/laravel-debugbar` or `itsgoingd/clockwork` in `require` (only `require-dev`, and never enable in production).
   - Strictly gate Telescope, Horizon, Pulse, and Log Viewer with explicit admin email/role allowlists in their ServiceProviders — never `return true;`.
3. **Webroot & Dotfiles Hygiene**:
   - Point web server document root strictly to `public/` (NEVER the Laravel project root!).
   - Block dotfiles (`/.env`, `/.git`), backup archives (`.sql`, `.zip`, `.bak`), and `phpinfo.php` at Nginx/Apache:
     ```nginx
     location ~ /\.(?!well-known).* {
         deny all;
         return 404;
     }
     ```
4. **Shadow/Stale Endpoints**: Audit `php artisan route:list` to prune unauthenticated test/debug/legacy API routes.

---

## #17 Clickjacking (CWE-1021)

### Hardened Pattern: Global `SecurityHeaders` Middleware
Create `app/Http/Middleware/SecurityHeaders.php` and register it via `$middleware->append(SecurityHeaders::class)` in `bootstrap/app.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $nonce = base64_encode(Str::random(16));
        $request->attributes->set('csp_nonce', $nonce);

        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'nonce-{$nonce}'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        );

        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }

        return $response;
    }
}
```
If legitimate embedding by a partner origin is required, replace `DENY` / `'none'` with `frame-ancestors 'self' https://trusted.partner.com` (never `*`).

---

## #18 CORS Misconfiguration (CWE-942)

### High-Risk Sinks
- `'allowed_origins' => ['*']` with `'supports_credentials' => true`.
- Dynamically reflecting `$request->header('Origin')` into `Access-Control-Allow-Origin` without validating against an exact allowlist.
- Unanchored regexes in `allowed_origins_patterns` such as `'.*example\.com'` (matched by `https://evil-example.com` or `https://example.com.attacker.test`!).
- Trusting `Origin: null` (exploitable from sandboxed iframes).

### Hardened `config/cors.php`
```php
<?php

declare(strict_types=1);

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_values(array_filter(explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')))),
    'allowed_origins_patterns' => [
        // Strictly anchored if subdomain matching is required:
        // '/^https:\/\/[a-z0-9-]+\.example\.com$/',
    ],
    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Requested-With', 'X-XSRF-TOKEN', 'Idempotency-Key'],
    'exposed_headers' => ['X-Request-Id'],
    'max_age' => 600,
    'supports_credentials' => true,
];
```

---

## #19 HTTP Request Smuggling (CWE-444)

### Root Cause in Laravel Deployments
Request smuggling (`CL.TE`, `TE.CL`, `TE.TE`, `H2.CL`, `H2.TE`) occurs when a front-end CDN/Load Balancer and back-end web server (Nginx, Apache, Caddy/FrankenPHP, RoadRunner, Swoole/Octane) disagree on request boundaries, or when spoofed `Host` / `X-Forwarded-*` headers poison caches, password-reset URLs, or signed routes.

### Hardened Laravel + Edge Proxy Checklist
1. **Strict `TrustProxies` & `TrustHosts` in `bootstrap/app.php`**:
   ```php
   ->withMiddleware(function (Middleware $middleware): void {
       // Explicit trusted load balancer IPs/CIDRs — avoid blind '*' unless isolated behind managed VPC LB
       $middleware->trustProxies(
           at: array_values(array_filter(explode(',', (string) env('TRUSTED_PROXIES', '')))),
           headers: Request::HEADER_X_FORWARDED_FOR
               | Request::HEADER_X_FORWARDED_HOST
               | Request::HEADER_X_FORWARDED_PORT
               | Request::HEADER_X_FORWARDED_PROTO
       );

       // Block Host header poisoning / cache poisoning
       $middleware->trustHosts(at: fn (): array => [
           '^' . preg_quote((string) parse_url((string) config('app.url'), PHP_URL_HOST), '/') . '$',
       ]);
   })
   ```
2. **Edge / Nginx Hardening**:
   - Keep `ignore_invalid_headers on;` (never `off`).
   - Use end-to-end HTTP/2 (or strictly normalized HTTP/1.1) between CDN and origin — avoid unsafe HTTP/2-to-HTTP/1.1 downgrades without strict RFC 9112 framing validation.
   - Reject requests containing BOTH `Content-Length` and `Transfer-Encoding`, duplicate conflicting `Content-Length` headers, or obfuscated `Transfer-Encoding` headers at the edge WAF/reverse proxy.
   - Require an explicit `Host` allowlist (`server_name app.example.com;` plus a default catch-all server block returning `444`).
3. **Laravel Octane / FrankenPHP / Swoole Isolation**:
   - Keep runtime engines patched against HTTP parser CVEs.
   - Never cache per-request `Request`, `Auth`, or headers in static properties or singletons (prevents cross-request contamination even under pipelined connections).
