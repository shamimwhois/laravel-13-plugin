#!/usr/bin/env node
/**
 * Laravel Security Guard — 19-Point Static Security Scanner
 * Zero-dependency Node.js ESM scanner for Laravel & PHP projects.
 *
 * Usage:
 *   node laravel-security-scan.mjs [targetDir] [--json] [--fail-on-high] [--category=<slug>]
 */

import fs from 'node:fs';
import path from 'node:path';

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const CATEGORIES = {
  sqli: { id: 1, name: 'SQL Injection', cwe: 'CWE-89' },
  xss: { id: 2, name: 'Cross-Site Scripting (XSS)', cwe: 'CWE-79' },
  csrf: { id: 3, name: 'Cross-Site Request Forgery (CSRF)', cwe: 'CWE-352' },
  'broken-access-control': { id: 4, name: 'Broken Access Control', cwe: 'CWE-284/CWE-639' },
  ssrf: { id: 5, name: 'Server-Side Request Forgery (SSRF)', cwe: 'CWE-918' },
  'path-traversal': { id: 6, name: 'Path Traversal', cwe: 'CWE-22' },
  'command-injection': { id: 7, name: 'Command Injection', cwe: 'CWE-78' },
  'mass-assignment': { id: 8, name: 'Mass Assignment', cwe: 'CWE-915' },
  'open-redirect': { id: 9, name: 'Open Redirect', cwe: 'CWE-601' },
  'leaked-secrets': { id: 10, name: 'Leaked Secrets', cwe: 'CWE-798' },
  'known-vulnerabilities': { id: 11, name: 'Using Components with Known Vulnerabilities', cwe: 'CWE-1104' },
  'debug-mode-assets': { id: 12, name: 'Improper Assets Management (Debug Mode On)', cwe: 'CWE-489/CWE-215' },
  'broken-authentication': { id: 13, name: 'Broken Authentication', cwe: 'CWE-287' },
  'insecure-deserialization': { id: 14, name: 'Insecure Deserialization', cwe: 'CWE-502' },
  xxe: { id: 15, name: 'XML External Entity (XXE) Injection', cwe: 'CWE-611' },
  ssti: { id: 16, name: 'Server-Side Template Injection (SSTI)', cwe: 'CWE-1336' },
  clickjacking: { id: 17, name: 'Clickjacking', cwe: 'CWE-1021' },
  'cors-misconfiguration': { id: 18, name: 'CORS Misconfiguration', cwe: 'CWE-942' },
  'http-request-smuggling': { id: 19, name: 'HTTP Request Smuggling', cwe: 'CWE-444' },
};

const SKIP_DIRS = new Set([
  'vendor',
  'node_modules',
  '.git',
  '.idea',
  '.vscode',
  'dist',
  'build',
  'coverage',
  'tests',
]);

const SKIP_SUBPATHS = [
  'storage/framework',
  'storage/logs',
  'bootstrap/cache',
  'public/build',
  'public/hot',
];

function parseArgs(argv) {
  let targetDir = process.cwd();
  let json = false;
  let failOnHigh = false;
  let category = null;

  for (const arg of argv.slice(2)) {
    if (arg === '--json') json = true;
    else if (arg === '--fail-on-high') failOnHigh = true;
    else if (arg.startsWith('--category=')) category = arg.slice('--category='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node laravel-security-scan.mjs [targetDir] [--json] [--fail-on-high] [--category=<slug>]\n' +
        'Categories: ' + Object.keys(CATEGORIES).join(', ')
      );
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      targetDir = path.resolve(arg);
    }
  }
  return { targetDir, json, failOnHigh, category };
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walkFiles(rootDir) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const rel = toPosix(path.relative(rootDir, fullPath));
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (SKIP_SUBPATHS.some((sp) => rel === sp || rel.startsWith(sp + '/'))) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        results.push({ fullPath, rel, name: entry.name });
      }
    }
  }
  walk(rootDir);
  return results;
}

function findLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function snippetAtLine(lines, lineNum) {
  const raw = lines[lineNum - 1] ?? '';
  const trimmed = raw.trim();
  return trimmed.length > 140 ? trimmed.slice(0, 137) + '...' : trimmed;
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('#') || t.startsWith('{{--');
}

const LINE_RULES = [
  // 1. SQL Injection
  {
    id: 'SQLI-001',
    category: 'sqli',
    severity: 'CRITICAL',
    files: /\.php$/i,
    pattern: /\b(?:DB::raw|whereRaw|orWhereRaw|selectRaw|orderByRaw|havingRaw|groupByRaw|DB::select|DB::statement|DB::unprepared)\s*\(\s*(?:"[^"]*\$|\'[^\']*'\s*\.\s*\$|\$[A-Za-z_])/g,
    message: 'Raw SQL expression interpolates or concatenates a PHP variable.',
    fix: 'Use parameterized PDO bindings (e.g., whereRaw("status = ?", [$status])) or Query Builder methods.',
  },
  {
    id: 'SQLI-002',
    category: 'sqli',
    severity: 'HIGH',
    files: /\.php$/i,
    pattern: /->orderBy\s*\(\s*(?:\$request->|request\s*\()/g,
    message: 'Dynamic orderBy() column sourced directly from user request.',
    fix: 'Map user sort parameters through a strict hardcoded column allowlist.',
  },

  // 2. XSS
  {
    id: 'XSS-001',
    category: 'xss',
    severity: 'HIGH',
    files: /\.blade\.php$/i,
    pattern: /\{!!\s*(?:(?!!!\}).)*(?:\$request|request\s*\(|old\s*\(|\$[A-Za-z_][A-Za-z0-9_]*)(?:(?!!!\}).)*!!\}/g,
    customCheck: (match) => !/\b(?:Purifier::clean|clean|Js::from|Vite::|e)\s*\(|\$slot\b/.test(match),
    message: 'Unescaped Blade output ({!! ... !!}) may allow Cross-Site Scripting.',
    fix: 'Use escaped {{ ... }} syntax, or sanitize rich HTML through HTML Purifier with a strict allowlist.',
  },
  {
    id: 'XSS-002',
    category: 'xss',
    severity: 'HIGH',
    files: /\.(?:vue|jsx|tsx|js|ts|blade\.php)$/i,
    pattern: /\b(?:v-html\s*=|dangerouslySetInnerHTML\s*=|innerHTML\s*=)/g,
    message: 'Raw HTML sink (v-html / dangerouslySetInnerHTML / innerHTML) detected.',
    fix: 'Render plain text bindings or sanitize with DOMPurify before inserting HTML.',
  },
  {
    id: 'XSS-003',
    category: 'xss',
    severity: 'MEDIUM',
    files: /\.(?:blade\.php|vue|jsx|tsx)$/i,
    pattern: /\b(?:href|src)\s*=\s*["']\s*(?:javascript:|data:text\/html)/gi,
    message: 'Dangerous javascript: or data:text/html URI scheme in href/src attribute.',
    fix: 'Validate dynamic URLs to allow only https://, http://, or safe relative paths.',
  },

  // 3. CSRF
  {
    id: 'CSRF-001',
    category: 'csrf',
    severity: 'CRITICAL',
    files: /(?:bootstrap\/app\.php|VerifyCsrfToken\.php)$/i,
    pattern: /validateCsrfTokens\s*\(\s*except\s*:\s*\[[^\]]*['"]\*['"]/gs,
    message: 'Wildcard CSRF exemption ("*") disables CSRF protection globally.',
    fix: 'Remove wildcard CSRF exemptions; exempt only HMAC-signed stateless webhook routes.',
  },
  {
    id: 'CSRF-002',
    category: 'csrf',
    severity: 'HIGH',
    files: /VerifyCsrfToken\.php$/i,
    pattern: /\$except\s*=\s*\[[^\]]*['"]\*['"]/gs,
    message: 'VerifyCsrfToken::$except contains wildcard "*", disabling CSRF protection.',
    fix: 'Restrict $except strictly to verified webhook endpoints.',
  },

  // 4. Broken Access Control
  {
    id: 'BAC-001',
    category: 'broken-access-control',
    severity: 'MEDIUM',
    files: /^routes\/.*\.php$/i,
    pattern: /Route::(?:get|post|put|patch|delete|any)\s*\(\s*['"][^'"]*\{[^}]+\}[^'"]*\{[^}]+\}[^'"]*['"][^;]*;/gs,
    customCheck: (match) => !match.includes('scopeBindings'),
    message: 'Nested route parameters declared without explicit ->scopeBindings() (IDOR risk).',
    fix: 'Chain ->scopeBindings() on nested routes or route groups and enforce Policy authorization.',
  },
  {
    id: 'BAC-002',
    category: 'broken-access-control',
    severity: 'MEDIUM',
    files: /app\/Livewire\/.*\.php$/i,
    pattern: /public\s+(?:\??(?:int|string)\s+)?\$(?:id|userId|user_id|tenantId|tenant_id|organizationId|role|isAdmin|price|amount)\b/g,
    customCheck: (_match, fullContent, index) => {
      const lookback = fullContent.slice(Math.max(0, index - 80), index);
      return !lookback.includes('#[Locked]');
    },
    message: 'Sensitive public Livewire property missing #[Locked] attribute (client-side tampering risk).',
    fix: 'Add #[Locked] attribute from Livewire\\Attributes\\Locked and re-authorize inside actions.',
  },

  // 5. SSRF
  {
    id: 'SSRF-001',
    category: 'ssrf',
    severity: 'HIGH',
    files: /\.php$/i,
    pattern: /\b(?:Http::(?:with[A-Za-z]+\([^)]*\)->)?(?:get|post|put|patch|delete|head|send)|file_get_contents|curl_init)\s*\(\s*(?:\$request->|request\s*\()/g,
    message: 'Outbound HTTP/file request directly uses user-controlled request input (SSRF risk).',
    fix: 'Validate scheme (https/http), resolve DNS A/AAAA, reject private/loopback/metadata IPs, disable/re-validate redirects, and pin IP.',
  },

  // 6. Path Traversal
  {
    id: 'PATH-001',
    category: 'path-traversal',
    severity: 'CRITICAL',
    files: /\.php$/i,
    pattern: /\b(?:Storage::(?:disk\([^)]*\)->)?(?:download|get|delete|path)|response\(\)->(?:download|file)|file_get_contents|readfile|unlink|fopen|include|include_once|require|require_once)\s*\([^;]*(?:\$request->|request\s*\()/g,
    message: 'Filesystem or file inclusion call accepts user-controlled request input (Path Traversal risk).',
    fix: 'Use basename() or server-generated IDs, verify realpath() stays within base directory, and reject ".." or stream wrappers.',
  },
  {
    id: 'PATH-002',
    category: 'path-traversal',
    severity: 'HIGH',
    files: /\.php$/i,
    pattern: /->extractTo\s*\(/g,
    message: 'ZipArchive::extractTo() detected — verify every entry path against Zip Slip ("../").',
    fix: 'Iterate entries, reject paths containing ".." or leading "/", and assert resolved target stays inside destination dir.',
  },

  // 7. Command Injection
  {
    id: 'CMDI-001',
    category: 'command-injection',
    severity: 'CRITICAL',
    files: /\.php$/i,
    pattern: /\b(?:exec|shell_exec|system|passthru|popen|proc_open)\s*\([^;]*\$/g,
    message: 'OS command execution function invoked with dynamic variable (Command Injection risk).',
    fix: 'Replace with Process::run([\'binary\', \'--\', $arg]) array syntax and strictly validate inputs.',
  },
  {
    id: 'CMDI-002',
    category: 'command-injection',
    severity: 'HIGH',
    files: /\.php$/i,
    pattern: /\bProcess::(?:path\([^)]*\)->|timeout\([^)]*\)->)?(?:run|start)\s*\(\s*(?:"[^"]*\$|\'[^\']*'\s*\.\s*\$|\$[A-Za-z_])/g,
    message: 'Laravel Process::run/start() invoked with interpolated string instead of argument array.',
    fix: 'Pass command and arguments as an array: Process::run([\'cmd\', \'--\', $arg]).',
  },

  // 8. Mass Assignment
  {
    id: 'MASS-001',
    category: 'mass-assignment',
    severity: 'HIGH',
    files: /\.php$/i,
    pattern: /protected\s+\$guarded\s*=\s*\[\s*\]|Model::unguard\s*\(/g,
    message: 'Mass-assignment protection disabled ($guarded = [] or Model::unguard()).',
    fix: 'Declare an explicit allowlist via #[Fillable([...])] or protected $fillable = [...].',
  },
  {
    id: 'MASS-002',
    category: 'mass-assignment',
    severity: 'HIGH',
    files: /\.php$/i,
    pattern: /(?:::create|->create|->update|->fill|->forceFill)\s*\(\s*\$request->(?:all|input)\s*\(\s*\)/g,
    message: 'Unfiltered $request->all()/$request->input() passed directly into Eloquent persistence.',
    fix: 'Validate via a dedicated FormRequest and pass $request->validated() or a typed DTO.',
  },
  {
    id: 'MASS-003',
    category: 'mass-assignment',
    severity: 'HIGH',
    files: /app\/Models\/.*\.php$/i,
    pattern: /(?:\$fillable\s*=\s*|#\[Fillable\s*\()\s*\[[^\]]*['"](?:is_admin|is_super_admin|role|roles|permissions|email_verified_at|balance|credits)['"]/gs,
    message: 'Privilege or financial attribute exposed in model $fillable / #[Fillable].',
    fix: 'Remove privileged columns from fillable and assign them explicitly inside authorized Actions.',
  },

  // 9. Open Redirect
  {
    id: 'REDIR-001',
    category: 'open-redirect',
    severity: 'HIGH',
    files: /\.php$/i,
    pattern: /\b(?:redirect|Redirect::to|Redirect::away)\s*\(\s*(?:\$request->|request\s*\()|redirect\s*\(\s*\)\s*->\s*(?:to|away)\s*\(\s*(?:\$request->|request\s*\()/g,
    message: 'Redirect destination derived directly from user input (Open Redirect risk).',
    fix: 'Allow only validated relative paths (single leading "/", rejecting "//" and "/\\") or strict host allowlists.',
  },

  // 10. Leaked Secrets
  {
    id: 'SECRET-001',
    category: 'leaked-secrets',
    severity: 'CRITICAL',
    files: /\.(?:php|js|ts|vue|jsx|tsx|json|yml|yaml|md|env|example)$/i,
    customCheck: (_m, _c, _i, rel) => !rel.endsWith('.env.example'),
    pattern: /(?:AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|rk_live_[0-9a-zA-Z]{16,}|ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g,
    message: 'Potential hardcoded credential, cloud/payment API key, or private key detected.',
    fix: 'Revoke/rotate the secret immediately, store in secret manager/.env (untracked), and read via config().',
  },
  {
    id: 'SECRET-002',
    category: 'leaked-secrets',
    severity: 'HIGH',
    files: /^(?:app|routes|resources)\/.*\.php$/i,
    pattern: /\benv\s*\(\s*['"][A-Z0-9_]+['"]/g,
    message: 'Direct env() call outside config/ directory (breaks config caching & risks secret mishandling).',
    fix: 'Map environment variables inside config/*.php and read them via config("...").',
  },
  {
    id: 'SECRET-003',
    category: 'leaked-secrets',
    severity: 'HIGH',
    files: /\.env(?:\..+)?$/i,
    pattern: /^VITE_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE|TOKEN|KEY)\s*=\s*.+$/gm,
    customCheck: (_m, _c, _i, rel) => !rel.endsWith('.env.example'),
    message: 'Sensitive secret exposed with VITE_ prefix (bundled into client-side JavaScript!).',
    fix: 'Remove VITE_ prefix so secrets stay strictly server-side.',
  },

  // 12. Improper Assets Management (Debug Mode On)
  {
    id: 'DEBUG-001',
    category: 'debug-mode-assets',
    severity: 'CRITICAL',
    files: /(?:\.env\.prod|\.env\.production|config\/app\.php)$/i,
    pattern: /(?:^\s*APP_DEBUG\s*=\s*true\b|'debug'\s*=>\s*(?:\(\s*bool\s*\)\s*)?env\(\s*'APP_DEBUG'\s*,\s*true\s*\)|'debug'\s*=>\s*true\b)/gm,
    message: 'APP_DEBUG enabled or defaulted to true in production/app config (leaks stack traces, env vars, and secrets).',
    fix: "Set APP_DEBUG=false in production and default config/app.php 'debug' => (bool) env('APP_DEBUG', false).",
  },
  {
    id: 'DEBUG-002',
    category: 'debug-mode-assets',
    severity: 'HIGH',
    files: /^(?:app|routes|public)\/.*\.php$/i,
    pattern: /\b(?:phpinfo|var_dump)\s*\(/g,
    message: 'Diagnostic function phpinfo()/var_dump() left in application or public code.',
    fix: 'Remove phpinfo()/var_dump() immediately.',
  },
  {
    id: 'DEBUG-003',
    category: 'debug-mode-assets',
    severity: 'HIGH',
    files: /(?:TelescopeServiceProvider|HorizonServiceProvider)\.php$/i,
    pattern: /Gate::define\s*\(\s*['"]view(?:Telescope|Horizon)['"][\s\S]{0,180}?return\s+true\s*;/g,
    message: 'Telescope/Horizon authorization gate unconditionally returns true.',
    fix: 'Restrict gate to authenticated admin emails/roles strictly verified in production.',
  },

  // 13. Broken Authentication
  {
    id: 'AUTH-001',
    category: 'broken-authentication',
    severity: 'CRITICAL',
    files: /\.php$/i,
    pattern: /\b(?:md5|sha1)\s*\([^;]*(?:password|passwd|pass|pwd|secret|token)/gi,
    message: 'Weak cryptographic hash (md5/sha1) used for password, secret, or token.',
    fix: 'Use Hash::make()/Hash::check() (Bcrypt/Argon2id) for passwords and hash_hmac("sha256", ...) + hash_equals() for tokens.',
  },
  {
    id: 'AUTH-002',
    category: 'broken-authentication',
    severity: 'HIGH',
    files: /config\/session\.php$/i,
    pattern: /'(?:http_only|secure)'\s*=>\s*false\b|'same_site'\s*=>\s*(?:null|'none'|"none")/g,
    message: 'Insecure session cookie flag in config/session.php.',
    fix: "Set 'http_only' => true, 'secure' => env('SESSION_SECURE_COOKIE', true), and 'same_site' => 'lax' (or 'strict').",
  },
  {
    id: 'AUTH-003',
    category: 'broken-authentication',
    severity: 'MEDIUM',
    files: /\.php$/i,
    pattern: /\$(?:signature|hmac|expectedSignature|webhookSignature|apiToken)\s*(?:===?|!==?)\s*\$|\$[A-Za-z0-9_]+\s*(?:===?|!==?)\s*\$(?:signature|hmac|expectedSignature|webhookSignature)/g,
    message: 'Non-constant-time comparison (==/===) on signature, HMAC, or secret token (timing attack risk).',
    fix: 'Use hash_equals($expected, $provided) for constant-time comparison.',
  },

  // 14. Insecure Deserialization
  {
    id: 'DESER-001',
    category: 'insecure-deserialization',
    severity: 'CRITICAL',
    files: /\.php$/i,
    pattern: /\bunserialize\s*\((?![^)]*allowed_classes[^)]*false)/g,
    message: 'unserialize() called without ["allowed_classes" => false] (PHP Object Injection / RCE risk).',
    fix: 'Replace with json_decode($str, true, 512, JSON_THROW_ON_ERROR) or pass ["allowed_classes" => false].',
  },
  {
    id: 'DESER-002',
    category: 'insecure-deserialization',
    severity: 'HIGH',
    files: /\.php$/i,
    pattern: /phar:\/\//gi,
    message: 'Explicit phar:// stream wrapper reference detected (PHAR deserialization gadget risk).',
    fix: 'Avoid phar:// wrappers and strictly reject stream wrappers in any user-influenced file path.',
  },

  // 15. XXE Injection
  {
    id: 'XXE-001',
    category: 'xxe',
    severity: 'CRITICAL',
    files: /\.php$/i,
    pattern: /\b(?:LIBXML_NOENT|LIBXML_DTDLOAD|LIBXML_DTDATTR)\b/g,
    message: 'Dangerous libxml flag (LIBXML_NOENT/LIBXML_DTDLOAD) enables XML External Entity expansion.',
    fix: 'Remove LIBXML_NOENT/LIBXML_DTDLOAD, use LIBXML_NONET, and reject <!DOCTYPE / <!ENTITY in untrusted XML.',
  },
  {
    id: 'XXE-002',
    category: 'xxe',
    severity: 'MEDIUM',
    files: /\.php$/i,
    pattern: /\b(?:simplexml_load_string|simplexml_load_file|new\s+SimpleXMLElement|->loadXML\s*\(|XMLReader::(?:XML|open))\b/g,
    message: 'XML parser usage detected — verify external entities and DTDs are strictly disabled.',
    fix: 'Reject <!DOCTYPE and <!ENTITY, pass LIBXML_NONET without LIBXML_NOENT/LIBXML_DTDLOAD, and disable entity loader.',
  },

  // 16. SSTI
  {
    id: 'SSTI-001',
    category: 'ssti',
    severity: 'CRITICAL',
    files: /\.php$/i,
    pattern: /\b(?:Blade::render|Blade::compileString|eval|createTemplate)\s*\(\s*(?:\$|['"][^'"]*\$)/g,
    message: 'Dynamic server-side template compilation or eval() with variable input (SSTI / RCE risk).',
    fix: 'Never compile user-supplied templates; use static Blade views with escaped variables or strict strtr() token maps.',
  },

  // 18. CORS Misconfiguration
  {
    id: 'CORS-001',
    category: 'cors-misconfiguration',
    severity: 'CRITICAL',
    files: /\.php$/i,
    pattern: /Access-Control-Allow-Origin['"]?\s*(?:=>|,|:)\s*['"]?\s*(?:\$_SERVER\[['"]HTTP_ORIGIN['"]\]|\$request->header\(\s*['"]Origin['"]\s*\))/gi,
    message: 'Arbitrary Origin header reflected directly into Access-Control-Allow-Origin.',
    fix: 'Validate Origin against an exact hardcoded allowlist in config/cors.php.',
  },

  // 19. HTTP Request Smuggling
  {
    id: 'SMUG-001',
    category: 'http-request-smuggling',
    severity: 'HIGH',
    files: /(?:TrustProxies\.php|bootstrap\/app\.php)$/i,
    pattern: /(?:protected\s+\$proxies\s*=\s*['"]\*['"]|trustProxies\s*\(\s*at\s*:\s*['"]\*['"])/g,
    message: 'TrustProxies blindly trusts "*" (all proxy IPs), allowing X-Forwarded-* header spoofing.',
    fix: 'Configure explicit trusted reverse-proxy IPs/CIDRs and register TrustHosts in bootstrap/app.php.',
  },
  {
    id: 'SMUG-002',
    category: 'http-request-smuggling',
    severity: 'HIGH',
    files: /(?:nginx.*\.conf|\.conf)$/i,
    pattern: /\bignore_invalid_headers\s+off\b/gi,
    message: 'Nginx ignore_invalid_headers is turned off (increases HTTP Request Smuggling surface).',
    fix: 'Set ignore_invalid_headers on; enforce strict HTTP/1.1/HTTP/2 framing parity between CDN, Nginx, and PHP-FPM/Octane.',
  },
  {
    id: 'TLS-001',
    category: 'http-request-smuggling',
    severity: 'HIGH',
    files: /\.php$/i,
    pattern: /(?:(?:->|::)withoutVerifying\s*\(\s*\)|['"]verify['"]\s*=>\s*false\b|CURLOPT_SSL_VERIFYPEER\s*=>\s*(?:false|0)\b)/gi,
    message: 'HTTPS/TLS certificate verification disabled on outbound HTTP client (MITM vulnerability).',
    fix: 'Remove withoutVerifying() / verify => false and use system CA certificates or explicit CA bundle.',
  },
];

function scanProject(targetDir, categoryFilter) {
  const findings = [];
  const files = walkFiles(targetDir);

  let hasClickjackingHeader = false;
  let hasTrustHosts = false;
  let hasLaravelApp = false;

  const pushFinding = (f) => {
    if (categoryFilter && f.category !== categoryFilter) return;
    findings.push(f);
  };

  for (const file of files) {
    const { fullPath, rel, name } = file;

    if (rel === 'artisan' || rel === 'bootstrap/app.php') hasLaravelApp = true;

    // 12. Public webroot leaked sensitive artifacts
    if (rel.startsWith('public/')) {
      if (/(?:^|\/)(?:\.env(?:\..*)?|phpinfo\.php|info\.php|adminer\.php|.*\.(?:sql|bak|old|orig|zip|tar|tar\.gz|tgz|log))$/i.test(rel)) {
        pushFinding({
          ruleId: 'DEBUG-004',
          category: 'debug-mode-assets',
          severity: 'CRITICAL',
          file: rel,
          line: 1,
          snippet: rel,
          message: 'Sensitive backup, log, env, or diagnostic file exposed inside public/ webroot.',
          fix: 'Delete this file from public/ immediately and block dotfiles/backups in web server config.',
        });
      }
    }

    // Only read text-like source/config files under 2MB
    if (!/\.(?:php|blade\.php|js|ts|vue|jsx|tsx|json|yml|yaml|conf|htaccess|env|example)$/i.test(name) && !name.startsWith('.env')) {
      continue;
    }

    let stat;
    try {
      stat = fs.statSync(fullPath);
      if (stat.size > 2 * 1024 * 1024) continue;
    } catch {
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);

    // Track project-wide protections (#17 Clickjacking, #19 TrustHosts)
    if (/(?:X-Frame-Options|frame-ancestors)/i.test(content)) {
      hasClickjackingHeader = true;
    }
    if (/\btrustHosts\s*\(|TrustHosts::class/i.test(content)) {
      hasTrustHosts = true;
    }

    // Special check #3: Blade POST/PUT/PATCH/DELETE forms missing @csrf
    if (/\.blade\.php$/i.test(name)) {
      const formRe = /<form\b[^>]*method\s*=\s*["']?(?:post|put|patch|delete)["']?[^>]*>([\s\S]*?)<\/form>/gi;
      let m;
      while ((m = formRe.exec(content)) !== null) {
        const body = m[1];
        if (!/@csrf\b|csrf_field\s*\(|name\s*=\s*["']_token["']/i.test(body)) {
          const line = findLineNumber(content, m.index);
          pushFinding({
            ruleId: 'CSRF-003',
            category: 'csrf',
            severity: 'HIGH',
            file: rel,
            line,
            snippet: snippetAtLine(lines, line),
            message: 'State-changing Blade <form> appears to be missing @csrf token directive.',
            fix: 'Include @csrf inside every POST/PUT/PATCH/DELETE Blade form.',
          });
        }
      }
    }

    // Special check #18: config/cors.php wildcard + credentials or unanchored patterns
    if (rel === 'config/cors.php') {
      const wildcardOrigins = /'allowed_origins'\s*=>\s*\[[^\]]*['"]\*['"]/s.test(content);
      const supportsCreds = /'supports_credentials'\s*=>\s*true\b/s.test(content);
      if (wildcardOrigins && supportsCreds) {
        pushFinding({
          ruleId: 'CORS-002',
          category: 'cors-misconfiguration',
          severity: 'CRITICAL',
          file: rel,
          line: 1,
          snippet: "allowed_origins => ['*'] with supports_credentials => true",
          message: 'CORS combines wildcard allowed_origins ("*") with supports_credentials => true.',
          fix: 'Replace "*" with explicit trusted origins (e.g., [env("FRONTEND_URL")]) whenever supports_credentials is true.',
        });
      } else if (wildcardOrigins) {
        pushFinding({
          ruleId: 'CORS-003',
          category: 'cors-misconfiguration',
          severity: 'MEDIUM',
          file: rel,
          line: 1,
          snippet: "allowed_origins => ['*']",
          message: 'CORS allows wildcard origin "*". Verify this API is intentionally public and unauthenticated.',
          fix: 'Restrict allowed_origins to explicit trusted frontend domains.',
        });
      }
    }

    // Special check #11: composer.json dependency hygiene
    if (rel === 'composer.json') {
      try {
        const pkg = JSON.parse(content);
        const lockExists = fs.existsSync(path.join(targetDir, 'composer.lock'));
        if (!lockExists) {
          pushFinding({
            ruleId: 'CVE-001',
            category: 'known-vulnerabilities',
            severity: 'HIGH',
            file: rel,
            line: 1,
            snippet: 'Missing composer.lock',
            message: 'composer.lock is missing; dependency versions are unpinned and cannot be deterministically audited.',
            fix: 'Commit composer.lock and run `composer audit --abandoned=fail` in CI.',
          });
        }
        const deps = { ...(pkg.require || {}), ...(pkg['require-dev'] || {}) };
        for (const [depName, constraint] of Object.entries(deps)) {
          if (typeof constraint === 'string' && (constraint.trim() === '*' || /dev-(?:master|main)/i.test(constraint))) {
            pushFinding({
              ruleId: 'CVE-002',
              category: 'known-vulnerabilities',
              severity: 'MEDIUM',
              file: rel,
              line: 1,
              snippet: `"${depName}": "${constraint}"`,
              message: `Unpinned/unstable dependency constraint for ${depName}.`,
              fix: 'Pin to a vetted semantic version range and run `composer audit`.',
            });
          }
          if (depName === 'php' && typeof constraint === 'string' && /\b(?:7\.|8\.0|8\.1)\b/.test(constraint)) {
            pushFinding({
              ruleId: 'CVE-003',
              category: 'known-vulnerabilities',
              severity: 'HIGH',
              file: rel,
              line: 1,
              snippet: `"php": "${constraint}"`,
              message: 'Composer constraint permits an End-of-Life PHP version with unpatched security advisories.',
              fix: 'Upgrade PHP constraint to a currently supported security branch (PHP 8.3+ / 8.4+ / 8.5+).',
            });
          }
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    // Standard regex rules
    for (const rule of LINE_RULES) {
      if (categoryFilter && rule.category !== categoryFilter) continue;
      if (!rule.files.test(rel)) continue;

      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(content)) !== null) {
        const lineNum = findLineNumber(content, match.index);
        if (isCommentLine(lines[lineNum - 1] ?? '')) continue;
        if (rule.customCheck && !rule.customCheck(match[0], content, match.index, rel)) continue;

        pushFinding({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          file: rel,
          line: lineNum,
          snippet: snippetAtLine(lines, lineNum),
          message: rule.message,
          fix: rule.fix,
        });
      }
    }
  }

  // Project-level checks when scanning a Laravel app
  if (hasLaravelApp) {
    if (!hasClickjackingHeader) {
      pushFinding({
        ruleId: 'CLICK-001',
        category: 'clickjacking',
        severity: 'HIGH',
        file: 'bootstrap/app.php',
        line: 1,
        snippet: 'Missing X-Frame-Options / CSP frame-ancestors',
        message: 'No Clickjacking defense headers (X-Frame-Options or CSP frame-ancestors) found in middleware or proxy configs.',
        fix: "Register a global SecurityHeaders middleware in bootstrap/app.php emitting X-Frame-Options: DENY and Content-Security-Policy: frame-ancestors 'none'.",
      });
    }
    if (!hasTrustHosts) {
      pushFinding({
        ruleId: 'SMUG-003',
        category: 'http-request-smuggling',
        severity: 'MEDIUM',
        file: 'bootstrap/app.php',
        line: 1,
        snippet: 'Missing TrustHosts middleware',
        message: 'TrustHosts middleware not detected (leaves Host header injection / cache poisoning risk).',
        fix: 'Enable $middleware->trustHosts(at: fn () => [config("app.url")]) in bootstrap/app.php.',
      });
    }
  }

  findings.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return a.file.localeCompare(b.file) || a.line - b.line;
  });

  return {
    targetDir,
    filesScanned: files.length,
    isLaravelApp: hasLaravelApp,
    counts: {
      CRITICAL: findings.filter((f) => f.severity === 'CRITICAL').length,
      HIGH: findings.filter((f) => f.severity === 'HIGH').length,
      MEDIUM: findings.filter((f) => f.severity === 'MEDIUM').length,
      LOW: findings.filter((f) => f.severity === 'LOW').length,
      TOTAL: findings.length,
    },
    findings,
  };
}

function main() {
  const { targetDir, json, failOnHigh, category } = parseArgs(process.argv);

  if (category && !CATEGORIES[category]) {
    console.error(`Unknown category "${category}". Valid: ${Object.keys(CATEGORIES).join(', ')}`);
    process.exit(2);
  }
  if (!fs.existsSync(targetDir)) {
    console.error(`Target directory does not exist: ${targetDir}`);
    process.exit(2);
  }

  const report = scanProject(targetDir, category);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n=== Laravel Security Guard — 19-Point Static Scan ===`);
    console.log(`Target: ${report.targetDir}`);
    console.log(`Files inspected: ${report.filesScanned} | Laravel detected: ${report.isLaravelApp ? 'yes' : 'no'}`);
    console.log(
      `Summary: CRITICAL=${report.counts.CRITICAL} | HIGH=${report.counts.HIGH} | MEDIUM=${report.counts.MEDIUM} | LOW=${report.counts.LOW} | TOTAL=${report.counts.TOTAL}\n`
    );

    if (report.findings.length === 0) {
      console.log('No static security hazards matched. Remember to also run `composer audit`, `npm audit`, and manual IDOR/business-logic review.');
    } else {
      for (const f of report.findings) {
        const meta = CATEGORIES[f.category];
        console.log(`[${f.severity}] ${f.ruleId} (#${meta.id} ${meta.name} — ${meta.cwe})`);
        console.log(`  Location : ${f.file}:${f.line}`);
        console.log(`  Snippet  : ${f.snippet}`);
        console.log(`  Issue    : ${f.message}`);
        console.log(`  Fix      : ${f.fix}\n`);
      }
    }
  }

  if (failOnHigh && (report.counts.CRITICAL > 0 || report.counts.HIGH > 0)) {
    process.exit(1);
  }
}

main();
