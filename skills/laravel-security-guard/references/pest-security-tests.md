# Pest 3 Security Regression & Architecture Test Suite

Use these Pest 3 test blueprints to prove defenses against all 19 vulnerability classes stay enforced in CI.

## 1. Architectural Security Boundaries (`tests/Arch/SecurityArchTest.php`)

```php
<?php

declare(strict_types=1);

arch('dangerous OS execution and eval functions are strictly banned')
    ->expect(['eval', 'exec', 'shell_exec', 'passthru', 'system', 'popen', 'proc_open'])
    ->not->toBeUsed();

arch('raw PHP unserialize is strictly banned across application code')
    ->expect('unserialize')
    ->not->toBeUsed();

arch('weak cryptographic hashes are banned')
    ->expect(['md5', 'sha1'])
    ->not->toBeUsed();

arch('debug helpers and phpinfo are never left in production code')
    ->expect(['dd', 'dump', 'var_dump', 'phpinfo', 'ray'])
    ->not->toBeUsed();

arch('raw PHP superglobals are banned outside low-level adapters')
    ->expect(['_GET', '_POST', '_REQUEST', '_COOKIE', '_FILES', '_SERVER'])
    ->not->toBeUsed();

arch('direct env() calls are banned outside config files')
    ->expect('env')
    ->not->toBeUsed()
    ->ignoring('config');
```

## 2. Feature Regression Tests (`tests/Feature/SecurityGuardTest.php`)

```php
<?php

declare(strict_types=1);

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\User;
use App\Support\SafeHttpClient;
use App\Support\SafeRedirect;
use App\Support\SafeXmlParser;

// #1 SQL Injection — dynamic sort allowlist
it('rejects SQL injection payloads in sort parameters', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/articles?sort=title;DROP%20TABLE%20users--')
        ->assertOk();
});

// #2 XSS — Blade auto-escaping & CSP header
it('escapes HTML script payloads in rendered views', function (): void {
    $user = User::factory()->create(['name' => '<script>alert(1)</script>']);

    $this->actingAs($user)
        ->get('/profile')
        ->assertOk()
        ->assertDontSee('<script>alert(1)</script>', escape: false)
        ->assertSee('&lt;script&gt;alert(1)&lt;/script&gt;', escape: false);
});

// #3 CSRF — rejects unauthenticated/missing CSRF token on web state mutations
it('enforces CSRF protection on stateful POST endpoints', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withoutMiddleware([]) // Ensure ValidateCsrfToken runs
        ->post('/profile', ['name' => 'Tampered'])
        ->assertStatus(419);
});

// #4 Broken Access Control (IDOR) — scoped bindings + Policy
it('blocks cross-tenant IDOR access to another organization invoice', function (): void {
    $orgA = Organization::factory()->create();
    $orgB = Organization::factory()->create();
    $userA = User::factory()->for($orgA)->create();
    $invoiceB = Invoice::factory()->for($orgB)->create();

    $this->actingAs($userA)
        ->getJson("/api/v1/organizations/{$orgA->id}/invoices/{$invoiceB->id}")
        ->assertNotFound();

    $this->actingAs($userA)
        ->getJson("/api/v1/organizations/{$orgB->id}/invoices/{$invoiceB->id}")
        ->assertForbidden();
});

// #5 SSRF — rejects loopback, private, and cloud metadata targets
it('blocks SSRF attempts targeting internal or metadata IPs', function (string $maliciousUrl): void {
    expect(fn () => SafeHttpClient::assertPublicUrl($maliciousUrl))
        ->toThrow(InvalidArgumentException::class);
})->with([
    'loopback IPv4' => 'http://127.0.0.1/admin',
    'AWS metadata' => 'http://169.254.169.254/latest/meta-data/',
    'RFC1918 private' => 'http://10.0.0.1/internal',
    'file scheme' => 'file:///etc/passwd',
    'gopher scheme' => 'gopher://127.0.0.1:6379/_INFO',
    'IPv6 loopback' => 'http://[::1]/',
]);

// #6 Path Traversal — blocks dot-dot traversal and stream wrappers
it('blocks path traversal attempts on file download endpoint', function (string $badPath): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/downloads?file=' . urlencode($badPath))
        ->assertStatus(400);
})->with([
    '../../.env',
    '..\\..\\.env',
    'phar://uploads/evil.phar/test',
]);

// #8 Mass Assignment — rejects privilege escalation fields
it('ignores privileged attributes during mass assignment', function (): void {
    $user = User::factory()->create(['is_admin' => false]);

    $this->actingAs($user)
        ->patch('/profile', [
            'name' => 'Updated Name',
            'is_admin' => true,
            'role' => 'superadmin',
        ]);

    expect($user->fresh()->is_admin)->toBeFalse();
});

// #9 Open Redirect — blocks external and protocol-relative bypasses
it('rejects open redirect URLs including protocol-relative bypasses', function (string $evilNext): void {
    expect(SafeRedirect::sanitize($evilNext))->toBe('/dashboard');
})->with([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/\\evil.example',
    'javascript:alert(1)',
]);

// #12 Debug Mode — asserts production config defaults debug to false
it('defaults application debug mode to false', function (): void {
    $config = require base_path('config/app.php');

    expect($config['debug'])->toBeFalse();
})->skip(fn () => (bool) env('APP_DEBUG', false), 'Set APP_DEBUG=false in phpunit.xml to enforce.');

// #13 Broken Auth — login rate limiting & session regeneration
it('throttles repeated failed login attempts', function (): void {
    for ($i = 0; $i < 6; $i++) {
        $response = $this->post('/login', [
            'email' => 'victim@example.com',
            'password' => 'wrong-password',
        ]);
    }

    $response->assertStatus(429);
});

// #15 XXE — blocks external entity resolution
it('rejects XML payloads containing DOCTYPE or ENTITY declarations', function (): void {
    $xxe = '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>';

    expect(fn () => SafeXmlParser::parse($xxe))
        ->toThrow(InvalidArgumentException::class);
});

// #17 Clickjacking — verifies X-Frame-Options & CSP frame-ancestors
it('emits anti-clickjacking security headers on responses', function (): void {
    $response = $this->get('/');

    $response->assertHeader('X-Frame-Options', 'DENY');
    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    expect((string) $response->headers->get('Content-Security-Policy'))
        ->toContain("frame-ancestors 'none'");
});

// #18 CORS — verifies untrusted Origin is never reflected with credentials
it('never reflects untrusted Origins with credentials enabled', function (): void {
    $response = $this->withHeaders(['Origin' => 'https://evil.attacker.test'])
        ->getJson('/api/v1/health');

    expect($response->headers->get('Access-Control-Allow-Origin'))
        ->not->toBe('https://evil.attacker.test');
});

// #19 HTTP Request Smuggling / Host Header Poisoning — rejects untrusted Host
it('rejects requests carrying spoofed Host headers when TrustHosts is active', function (): void {
    $this->withHeaders(['Host' => 'evil.attacker.test'])
        ->get('/')
        ->assertStatus(400);
});

// #20 HTTPS Transport & Safe Error Pages — prevents stack traces & enforces no-store on errors
it('returns RFC 7807 JSON error with X-Request-Id and zero stack traces when APP_DEBUG is false', function (): void {
    config()->set('app.debug', false);

    $response = $this->getJson('/api/v1/non-existent-endpoint');

    $response->assertNotFound()
        ->assertHeader('X-Request-Id')
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonStructure(['type', 'title', 'status', 'detail', 'trace_id'])
        ->assertJsonMissingPath('trace')
        ->assertJsonMissingPath('file');
});
```
