#!/usr/bin/env node
/**
 * Laravel Security Guard — PreToolUse Real-Time Write Guard
 * Inspects pending writes/edits to Laravel PHP, Blade, .env, config, and proxy files
 * and prompts the user ("ask") whenever high-confidence critical security hazards appear.
 *
 * Contract: reads JSON from stdin, writes JSON decision to stdout.
 * Always fails open with {"decision":"allow"} for non-Laravel files, test files, or errors.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function allow() {
  process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
  process.exit(0);
}

function ask(reason) {
  process.stdout.write(JSON.stringify({ decision: 'ask', reason }) + '\n');
  process.exit(0);
}

function isWithinDir(targetPath, dirPath) {
  if (!targetPath || !dirPath) return false;
  const resolvedTarget = path.resolve(targetPath);
  const resolvedDir = path.resolve(dirPath);
  const normTarget = process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget;
  const normDir = process.platform === 'win32' ? resolvedDir.toLowerCase() : resolvedDir;
  const rel = path.relative(normDir, normTarget);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function extractTargetPath(args) {
  if (!args || typeof args !== 'object') return '';
  return String(
    args.Path ??
    args.path ??
    args.TargetFile ??
    args.targetFile ??
    args.FilePath ??
    args.filePath ??
    ''
  );
}

function extractWrittenText(args) {
  if (!args || typeof args !== 'object') return '';
  const parts = [];
  for (const key of [
    'Content',
    'content',
    'contents',
    'Replacement',
    'replacement',
    'CodeContent',
    'ReplacementContent',
    'new_string',
    'newText',
    'code',
  ]) {
    if (typeof args[key] === 'string' && args[key].length > 0) {
      parts.push(args[key]);
    }
  }
  if (Array.isArray(args.ReplacementChunks)) {
    for (const chunk of args.ReplacementChunks) {
      if (chunk && typeof chunk.ReplacementContent === 'string') {
        parts.push(chunk.ReplacementContent);
      }
    }
  }
  if (Array.isArray(args.edits)) {
    for (const edit of args.edits) {
      if (edit && typeof edit.replacement === 'string') {
        parts.push(edit.replacement);
      } else if (edit && typeof edit.new_string === 'string') {
        parts.push(edit.new_string);
      }
    }
  }
  return parts.join('\n');
}

function stripCommentLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('#') && !t.startsWith('{{--');
    })
    .join('\n');
}

const GUARD_RULES = [
  {
    name: '#1 SQL Injection',
    files: /\.php$/i,
    pattern: /\b(?:DB::raw|whereRaw|orWhereRaw|selectRaw|orderByRaw|havingRaw|DB::select|DB::statement|DB::unprepared)\s*\(\s*(?:"[^"]*\$|\'[^\']*'\s*\.\s*\$|\$[A-Za-z_])/,
    advice: 'Use parameterized PDO bindings (e.g., whereRaw("col = ?", [$val])) instead of variable interpolation.',
  },
  {
    name: '#2 Cross-Site Scripting (XSS)',
    files: /\.blade\.php$/i,
    pattern: /\{!!\s*(?:(?!!!\}).)*(?:\$request|request\s*\(|old\s*\()(?:(?!!!\}).)*!!\}/,
    advice: 'Use escaped {{ ... }} output instead of raw {!! ... !!} on user input.',
  },
  {
    name: '#3 CSRF Bypass',
    files: /(?:bootstrap\/app\.php|VerifyCsrfToken\.php)$/i,
    pattern: /(?:validateCsrfTokens\s*\(\s*except\s*:\s*\[[^\]]*['"]\*['"]|\$except\s*=\s*\[[^\]]*['"]\*['"])/s,
    advice: 'Never disable CSRF globally with "*"; exempt only HMAC-verified stateless webhooks.',
  },
  {
    name: '#5 SSRF',
    files: /\.php$/i,
    pattern: /\b(?:Http::(?:get|post|put|patch|delete|send)|file_get_contents|curl_init)\s*\(\s*(?:\$request->|request\s*\()/,
    advice: 'Validate scheme/DNS/public IP range and pin IP before requesting user-controlled URLs.',
  },
  {
    name: '#6 Path Traversal',
    files: /\.php$/i,
    pattern: /\b(?:Storage::(?:disk\([^)]*\)->)?(?:download|get|delete)|response\(\)->(?:download|file)|unlink|include|require)\s*\([^;]*(?:\$request->|request\s*\()/,
    advice: 'Resolve paths with basename() + realpath() containment check or database ULIDs.',
  },
  {
    name: '#7 Command Injection',
    files: /\.php$/i,
    pattern: /\b(?:exec|shell_exec|system|passthru|popen|proc_open)\s*\([^;]*\$|\bProcess::(?:run|start)\s*\(\s*"[^"]*\$/,
    advice: 'Use Process::run(["binary", "--", $arg]) array syntax instead of shell string interpolation.',
  },
  {
    name: '#8 Mass Assignment',
    files: /\.php$/i,
    pattern: /protected\s+\$guarded\s*=\s*\[\s*\]|Model::unguard\s*\(|(?:::create|->update|->fill|->forceFill)\s*\(\s*\$request->(?:all|input)\s*\(\s*\)/,
    advice: 'Use explicit #[Fillable([...])] / $fillable and pass $request->validated() from a FormRequest.',
  },
  {
    name: '#9 Open Redirect',
    files: /\.php$/i,
    pattern: /\b(?:redirect|Redirect::to|Redirect::away)\s*\(\s*(?:\$request->|request\s*\()|redirect\s*\(\s*\)\s*->\s*(?:to|away)\s*\(\s*(?:\$request->|request\s*\()/,
    advice: 'Restrict redirect targets to single-slash relative paths or a strict host allowlist.',
  },
  {
    name: '#10 Leaked Secrets',
    files: /\.(?:php|blade\.php|env(?:\..+)?|json|js|ts|vue|jsx|tsx)$/i,
    pattern: /(?:AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/,
    advice: 'Never hardcode live API keys or private keys; inject via untracked .env and config().',
  },
  {
    name: '#12 Debug Mode Enabled in Production',
    files: /(?:\.env\.prod|\.env\.production|config\/app\.php)$/i,
    pattern: /(?:^\s*APP_DEBUG\s*=\s*true\b|'debug'\s*=>\s*(?:\(\s*bool\s*\)\s*)?env\(\s*'APP_DEBUG'\s*,\s*true\s*\)|'debug'\s*=>\s*true\b)/m,
    advice: "Keep APP_DEBUG=false in production and default config/app.php 'debug' to false.",
  },
  {
    name: '#13 Weak Auth Hashing',
    files: /\.php$/i,
    pattern: /\b(?:md5|sha1)\s*\([^;]*(?:password|passwd|pass|pwd|secret)/i,
    advice: 'Use Hash::make() / Hash::check() (Bcrypt/Argon2id) instead of md5/sha1.',
  },
  {
    name: '#14 Insecure Deserialization',
    files: /\.php$/i,
    pattern: /\bunserialize\s*\((?![^)]*allowed_classes[^)]*false)/,
    advice: 'Use json_decode(..., JSON_THROW_ON_ERROR) or enforce ["allowed_classes" => false].',
  },
  {
    name: '#15 XXE Injection',
    files: /\.php$/i,
    pattern: /\b(?:LIBXML_NOENT|LIBXML_DTDLOAD|LIBXML_DTDATTR)\b/,
    advice: 'Remove LIBXML_NOENT/LIBXML_DTDLOAD and reject <!DOCTYPE / <!ENTITY in untrusted XML.',
  },
  {
    name: '#16 Server-Side Template Injection (SSTI)',
    files: /\.php$/i,
    pattern: /\b(?:Blade::render|Blade::compileString|eval)\s*\(\s*(?:\$|['"][^'"]*\$)/,
    advice: 'Never compile user-controlled strings as Blade/PHP templates.',
  },
  {
    name: '#18 CORS Misconfiguration',
    files: /(?:config\/cors\.php|\.php)$/i,
    pattern: /(?:['"]allowed_origins['"]\s*=>\s*\[[^\]]*['"]\*['"][\s\S]{0,600}['"]supports_credentials['"]\s*=>\s*true\b|Access-Control-Allow-Origin['"]?\s*(?:=>|,|:)\s*['"]?\s*(?:\$_SERVER\[['"]HTTP_ORIGIN['"]\]|\$request->header\(\s*['"]Origin['"]\s*\)))/i,
    advice: 'Never combine wildcard origins with supports_credentials => true or reflect arbitrary Origin headers.',
  },
  {
    name: '#19 HTTP Request Smuggling / Proxy Hardening',
    files: /(?:TrustProxies\.php|bootstrap\/app\.php|nginx.*\.conf|\.conf)$/i,
    pattern: /(?:protected\s+\$proxies\s*=\s*['"]\*['"]|trustProxies\s*\(\s*at\s*:\s*['"]\*['"]|\bignore_invalid_headers\s+off\b)/i,
    advice: 'Pin explicit trusted proxy IPs/CIDRs, register TrustHosts, and keep ignore_invalid_headers on.',
  },
  {
    name: '#19b HTTPS / TLS Verification Disabled',
    files: /\.php$/i,
    pattern: /(?:(?:->|::)withoutVerifying\s*\(\s*\)|['"]verify['"]\s*=>\s*false\b|CURLOPT_SSL_VERIFYPEER\s*=>\s*(?:false|0)\b)/i,
    advice: 'Never disable HTTPS/TLS certificate verification in production; configure a trusted CA bundle instead.',
  },
];

function main() {
  let raw = '';
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    allow();
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    allow();
  }

  const args = payload?.toolCall?.args;
  const rawTargetPath = extractTargetPath(args);
  if (!rawTargetPath) allow();

  // Resolve lexically & canonically before any allow-list check (blocks "/x/tests/../../app/..." traversal bypasses)
  const baseCwd = typeof payload?.cwd === 'string' && payload.cwd.length > 0 ? payload.cwd : process.cwd();
  const resolvedTarget = path.resolve(baseCwd, rawTargetPath);
  const targetPath = resolvedTarget.replace(/\\/g, '/');

  // Allow-list ONLY real Antigravity plugin/app-data dirs, workspace root tests/ dir, and .env.example
  const homeDir = os.homedir();
  const workspaceRoots = [
    ...(Array.isArray(payload?.workspacePaths) ? payload.workspacePaths : []),
    baseCwd,
  ].filter((p) => typeof p === 'string' && p.length > 0);

  const inPluginsDir = isWithinDir(resolvedTarget, path.join(homeDir, '.gemini', 'config', 'plugins'));
  const inAntigravityDir = isWithinDir(resolvedTarget, path.join(homeDir, '.gemini', 'antigravity'));
  const inWorkspaceTests = workspaceRoots.some((root) => isWithinDir(resolvedTarget, path.join(root, 'tests')));
  const isEnvExample = path.basename(resolvedTarget).toLowerCase() === '.env.example';

  if (inPluginsDir || inAntigravityDir || inWorkspaceTests || isEnvExample) {
    allow();
  }

  // Only inspect Laravel/PHP/env/proxy-relevant files
  if (!/(?:\.php|\.blade\.php|\.env(?:\.[^/]+)?|\.conf|\.htaccess)$/i.test(targetPath)) {
    allow();
  }

  const text = extractWrittenText(args);
  if (!text) {
    process.stderr.write(`[Laravel Security Guard] Notice: no writable text field extracted for guarded target ${targetPath}\n`);
    allow();
  }

  const code = stripCommentLines(text);
  const hits = [];

  for (const rule of GUARD_RULES) {
    if (!rule.files.test(targetPath)) continue;
    if (rule.pattern.test(code)) {
      hits.push(`${rule.name}: ${rule.advice}`);
    }
  }

  if (hits.length > 0) {
    const summary = hits.slice(0, 3).join(' | ');
    const extra = hits.length > 3 ? ` (+${hits.length - 3} more)` : '';
    ask(`[Laravel Security Guard] Potential security hazard in ${targetPath}: ${summary}${extra}`);
  }

  allow();
}

main();
