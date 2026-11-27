---
name: laravel-security-guard
description: >-
  Master Laravel & PHP Security Guard orchestrator for auditing, hardening, and
  testing applications against 19 critical vulnerability classes: SQL Injection,
  XSS, CSRF, Broken Access Control (IDOR), SSRF, Path Traversal, Command
  Injection, Mass Assignment, Open Redirect, Leaked Secrets, Known Vulnerable
  Components (CVEs), Improper Assets Management (Debug Mode On), Broken
  Authentication, Insecure Deserialization, XXE, SSTI, Clickjacking, CORS
  Misconfiguration, and HTTP Request Smuggling. Use whenever the user asks to
  audit, harden, scan, or build a security guard for a Laravel application.
---

# Laravel Security Guard — 19-Point Audit & Hardening Runbook

This skill coordinates a complete, evidence-based security audit and hardening pass across all **19 vulnerability classes** for Laravel (11/12/13) and modern PHP (8.4–8.6+).

## Companion Deep-Dive Skills (Progressive Disclosure)

Load the targeted domain skill(s) for concrete vulnerable-vs-hardened PHP/Laravel code patterns and checklists:

1. **`laravel-injection-and-input-guard`**:
   - #1 SQL Injection, #2 XSS, #6 Path Traversal & Zip Slip, #7 Command Injection, #14 Insecure Deserialization & `phar://`, #15 XXE Injection, #16 SSTI.
2. **`laravel-auth-and-access-guard`**:
   - #3 CSRF, #4 Broken Access Control / IDOR, #8 Mass Assignment, #9 Open Redirect, #13 Broken Authentication.
3. **`laravel-edge-and-supply-chain-guard`**:
   - #5 SSRF, #10 Leaked Secrets, #11 Known Vulnerable Components (CVEs), #12 Improper Assets Management (Debug Mode On), #17 Clickjacking, #18 CORS Misconfiguration, #19 HTTP Request Smuggling.

For Pest 3 security regression and architecture test templates, read [references/pest-security-tests.md](./references/pest-security-tests.md).

---

## Step 1: Run Automated Discovery & Static Security Scan

Always gather hard evidence before making claims. Run the bundled zero-dependency Node.js scanner and dependency audits against the target Laravel project root:

```bash
# 1. Run the bundled 19-category Laravel Security Guard static scanner
node "<PLUGIN_DIR>/skills/laravel-security-guard/scripts/laravel-security-scan.mjs" .

# Optional: JSON output or CI gate on CRITICAL/HIGH findings
node "<PLUGIN_DIR>/skills/laravel-security-guard/scripts/laravel-security-scan.mjs" . --json
node "<PLUGIN_DIR>/skills/laravel-security-guard/scripts/laravel-security-scan.mjs" . --fail-on-high

# 2. Supply-chain CVE audits (Vulnerability #11)
composer audit --abandoned=fail --format=table
npm audit --omit=dev

# 3. Inspect full route attack surface (Vulnerabilities #3, #4, #12, #13)
php artisan route:list --columns=method,uri,name,middleware
```

*(Resolve `<PLUGIN_DIR>` from this skill's directory: `scripts/laravel-security-scan.mjs` relative to this `SKILL.md`.)*

---

## Step 2: Manual Verification Across All 19 Vulnerability Classes

Static regex scans catch common sinks, but business-logic flaws (IDOR, missing policies, auth state bugs, CORS/proxy mismatch) require inspecting key Laravel files:

| Target Files | Vulnerability Classes to Inspect |
| :--- | :--- |
| `bootstrap/app.php`, `app/Http/Middleware/*` | #3 CSRF exceptions, #17 Clickjacking headers, #19 TrustProxies / TrustHosts, global rate limits |
| `routes/web.php`, `routes/api.php`, `routes/ai.php` | #3 state-changing GETs, #4 missing `auth`/`can`/`scopeBindings()`, #12 debug/test routes, #13 unthrottled auth endpoints |
| `app/Http/Controllers/**`, `app/Livewire/**` | #1 SQLi, #4 IDOR/missing `#[Locked]`, #5 SSRF, #6 Path Traversal, #7 Command Injection, #8 Mass Assignment, #9 Open Redirect, #14 Deserialization, #15 XXE, #16 SSTI |
| `app/Http/Requests/**`, `app/Policies/**` | #4 `authorize()` returning `true` without checks, #8 unvalidated fields |
| `app/Models/**`, `app/Providers/AppServiceProvider.php` | #8 `$guarded = []` / `unguard()`, `preventSilentlyDiscardingAttributes()`, `Password::defaults()` |
| `resources/views/**/*.blade.php`, `resources/js/**` | #2 `{!! ... !!}`, `v-html`, `dangerouslySetInnerHTML`, #3 missing `@csrf`, #10 `VITE_*` secrets |
| `config/app.php`, `config/cors.php`, `config/session.php`, `.env*` | #10 secrets, #12 `APP_DEBUG`, #13 cookie flags (`secure`, `http_only`, `same_site`), #18 CORS wildcards + credentials |
| `public/`, `nginx*.conf`, `Dockerfile`, `.htaccess` | #12 exposed `.env`/`.git`/backups/`phpinfo`, #17 edge headers, #19 HTTP Request Smuggling framing parity |
| `composer.json`, `composer.lock`, `package.json` | #11 CVEs, abandoned packages, EOL PHP/Laravel versions |

---

## Step 3: Triage & Report Format

Classify every confirmed finding with:

- **Severity**: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`
- **Category & CWE**: Exact match from the 19 classes (e.g., `#4 Broken Access Control — CWE-639`)
- **Location**: Clickable file path with line range
- **Exploit Scenario**: Concrete 1–2 sentence attack vector
- **Remediation**: Idiomatic Laravel 13 / PHP 8.6+ fix (strict types, FormRequest, Policy, Scoped Binding, Process array, CSP, etc.)

---

## Step 4: Harden & Verify with Pest 3 Security Tests

1. Apply minimal, idiomatic Laravel fixes following `rules/AGENTS.md` and the three deep-dive domain skills (no breaking public APIs unnecessarily; preserve `declare(strict_types=1);` and PHPStan Level 8 compatibility).
2. Add or update Pest 3 security tests from [references/pest-security-tests.md](./references/pest-security-tests.md) covering:
   - Architectural bans (`eval`, `exec`, `shell_exec`, `unserialize`, `md5`, `sha1`, superglobals).
   - Feature regression tests for every remediated vulnerability (confirming exploit payloads return `403`/`422`/`400` or safe headers).
3. Re-run verification commands and report real results:
   - Re-run `laravel-security-scan.mjs` to confirm findings are cleared.
   - Run `php artisan test` / `./vendor/bin/pest` to verify all security and existing tests pass.
   - Run `composer audit` to confirm zero known vulnerabilities.
