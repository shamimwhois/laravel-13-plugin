---
name: laravel-injection-and-input-guard
description: >-
  Deep-dive Laravel & PHP security guard for injection and unsafe input
  vulnerabilities: SQL Injection (SQLi), Cross-Site Scripting (XSS), Path
  Traversal & Zip Slip, Command Injection, Insecure Deserialization & phar://
  chains, XML External Entity (XXE) Injection, and Server-Side Template
  Injection (SSTI). Load when auditing or hardening any of these 7 classes.
---

# Laravel Injection & Input Guard

Covers **7 critical injection & parsing vulnerability classes** with idiomatic Laravel 13 / PHP 8.6+ defenses.

---

## #1 SQL Injection (CWE-89)

### High-Risk Sinks
- `DB::raw()`, `whereRaw()`, `orWhereRaw()`, `selectRaw()`, `orderByRaw()`, `havingRaw()`, `groupByRaw()`, `DB::select()`, `DB::statement()`, `DB::unprepared()` with variable interpolation (`"... $var ..."`).
- Dynamic column names in `orderBy($request->input('sort'))` or dynamic JSON column paths `where("meta->{$key}", ...)`.

### Hardened Pattern: Parameterized Bindings & Column Allowlist
```php
<?php

declare(strict_types=1);

namespace App\Actions\Articles;

use Illuminate\Database\Eloquent\Builder;

final class ListArticlesAction
{
    private const array SORTABLE_COLUMNS = [
        'created' => 'created_at',
        'title' => 'title',
        'views' => 'views_count',
    ];

    /**
     * @param Builder<\App\Models\Article> $query
     * @return Builder<\App\Models\Article>
     */
    public function applySort(Builder $query, ?string $sort, string $dir = 'desc', ?string $minRating = null): Builder
    {
        $column = self::SORTABLE_COLUMNS[$sort ?? ''] ?? 'created_at';
        $direction = strtolower($dir) === 'asc' ? 'asc' : 'desc';

        if ($minRating !== null) {
            // Parameterized binding — NEVER interpolate $minRating
            $query->whereRaw('rating >= ?', [(float) $minRating]);
        }

        return $query->orderBy($column, $direction);
    }
}
```

---

## #2 Cross-Site Scripting — XSS (CWE-79)

### High-Risk Sinks
- Unescaped Blade `{!! $var !!}`, Vue `v-html`, React `dangerouslySetInnerHTML`, vanilla `.innerHTML`.
- Unsafe URL schemes (`href="{{ $url }}"` when `$url` is `javascript:alert(1)`).
- Inline `<script>` interpolation `const name = "{{ $name }}";` instead of `Js::from()`.
- Unsanitized SVG/HTML uploads served inline from `public/`.

### Hardened Patterns
1. **Default escaped Blade**: `{{ $user->bio }}`.
2. **Safe JS serialization**:
   ```blade
   <script nonce="{{ request()->attributes->get('csp_nonce') }}">
       const profile = {{ \Illuminate\Support\Js::from($profile) }};
   </script>
   ```
3. **URL Scheme Validation**:
   ```php
   public static function safeHref(?string $url): string
   {
       if ($url === null || $url === '') {
           return '#';
       }
       $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

       return in_array($scheme, ['', 'http', 'https', 'mailto'], true) && ! str_starts_with(ltrim($url), '//')
           ? $url
           : '#';
   }
   ```
4. **Rich HTML**: Sanitize server-side with `mews/purifier` (strict allowlist) AND send a nonce-based `Content-Security-Policy` header without `'unsafe-inline'` or `'unsafe-eval'`.
5. **Untrusted uploads**: Serve with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` (never serve user-uploaded `.svg` inline).

---

## #6 Path Traversal & Zip Slip (CWE-22)

### High-Risk Sinks
- `Storage::download($request->input('file'))`, `response()->file(...)`, `file_get_contents($base . $userFile)`, `unlink()`, `include`/`require`.
- `ZipArchive::extractTo()` extracting archive entries containing `../../public/shell.php`.

### Hardened Pattern: Canonical Containment & Binary Magic Bytes
```php
<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Str;
use InvalidArgumentException;
use ZipArchive;

final class SafePath
{
    public static function resolveWithin(string $baseDir, string $untrustedFilename): string
    {
        if (str_contains($untrustedFilename, "\0") || str_contains($untrustedFilename, '://')) {
            throw new InvalidArgumentException('Invalid path syntax or stream wrapper.');
        }

        $safeName = basename(str_replace('\\', '/', $untrustedFilename));
        $canonicalBase = realpath($baseDir);
        $canonicalTarget = $canonicalBase !== false ? realpath($canonicalBase . DIRECTORY_SEPARATOR . $safeName) : false;

        if ($canonicalBase === false || $canonicalTarget === false || ! str_starts_with($canonicalTarget, $canonicalBase . DIRECTORY_SEPARATOR)) {
            throw new InvalidArgumentException('Path traversal attempt blocked.');
        }

        return $canonicalTarget;
    }

    public static function safeExtractZip(string $zipPath, string $destDir): void
    {
        $canonicalDest = realpath($destDir);
        if ($canonicalDest === false) {
            throw new InvalidArgumentException('Destination directory does not exist.');
        }

        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new InvalidArgumentException('Unable to open archive.');
        }

        try {
            $prefix = $canonicalDest . DIRECTORY_SEPARATOR;

            for ($i = 0; $i < $zip->numFiles; $i++) {
                $entry = $zip->getNameIndex($i);
                if (! is_string($entry) || $entry === '' || str_contains($entry, "\0")) {
                    throw new InvalidArgumentException('Invalid ZIP entry name.');
                }

                // Reject POSIX symlink entries (mode 0120000) so later entries cannot write through symlinks
                $opsys = 0;
                $externalAttr = 0;
                if ($zip->getExternalAttributesIndex($i, $opsys, $externalAttr) && $opsys === ZipArchive::OPSYS_UNIX) {
                    $fileType = ($externalAttr >> 16) & 0170000;
                    if ($fileType === 0120000) {
                        throw new InvalidArgumentException('Symlink entries are forbidden in ZIP archives.');
                    }
                }

                $normalized = str_replace('\\', '/', $entry);
                if (str_starts_with($normalized, '/') || preg_match('/^[A-Za-z]:/', $normalized) === 1) {
                    throw new InvalidArgumentException('Absolute path entry blocked.');
                }

                // Validate segment-by-segment (permits legitimate filenames like "report..final.txt")
                $segments = array_values(array_filter(explode('/', $normalized), static fn (string $s): bool => $s !== '' && $s !== '.'));
                foreach ($segments as $segment) {
                    if ($segment === '..') {
                        throw new InvalidArgumentException('Zip Slip traversal segment blocked.');
                    }
                }

                if ($segments === [] || str_ends_with($normalized, '/')) {
                    continue;
                }

                $targetPath = $canonicalDest . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $segments);
                $targetDir = dirname($targetPath);
                if (! is_dir($targetDir) && ! mkdir($targetDir, 0750, true) && ! is_dir($targetDir)) {
                    throw new InvalidArgumentException('Unable to create destination subdirectory.');
                }

                $realTargetDir = realpath($targetDir);
                if ($realTargetDir === false || (! str_starts_with($realTargetDir . DIRECTORY_SEPARATOR, $prefix) && $realTargetDir !== $canonicalDest)) {
                    throw new InvalidArgumentException('Resolved extraction directory escapes destination.');
                }

                // Stream regular file directly without calling extractTo() (prevents symlink TOCTOU)
                $in = $zip->getStreamIndex($i);
                if ($in === false) {
                    throw new InvalidArgumentException("Unable to read archive entry [{$entry}].");
                }
                $out = fopen($realTargetDir . DIRECTORY_SEPARATOR . basename($targetPath), 'wb');
                if ($out === false) {
                    fclose($in);
                    throw new InvalidArgumentException('Unable to write extracted file.');
                }
                stream_copy_to_stream($in, $out);
                fclose($in);
                fclose($out);
            }
        } finally {
            $zip->close();
        }
    }
}
```
For file uploads: inspect real binary bytes via `finfo` (`$file->getMimeType()`), map MIME -> safe extension allowlist, save under `Str::random(40) . '.' . $ext` on a `private` disk outside `public/`, and resolve downloads by database ULID rather than filename.

---

## #7 Command Injection (CWE-78)

### High-Risk Sinks
- `exec()`, `shell_exec()`, `system()`, `passthru()`, `popen()`, `proc_open()`, backticks (`` `...` ``).
- `Process::run("ffmpeg -i {$input} out.mp4")` (string passed to shell!).
- **Argument/Option Injection**: Passing user input starting with `-` (e.g., `--exec=...`) to CLI tools even with array arguments.

### Hardened Pattern: Array `Process::run()` + `--` Separator + Allowlist
```php
<?php

declare(strict_types=1);

namespace App\Actions\Media;

use Illuminate\Support\Facades\Process;
use InvalidArgumentException;
use RuntimeException;

final class GeneratePdfThumbnailAction
{
    public function execute(string $safePath): string
    {
        if (! preg_match('/^[A-Za-z0-9_.\-\/]+$/', $safePath) || str_starts_with($safePath, '-')) {
            throw new InvalidArgumentException('Unsafe file argument rejected.');
        }

        $result = Process::timeout(15)->run([
            '/usr/bin/pdftoppm',
            '-png',
            '-singlefile',
            '--',
            $safePath,
            '/tmp/thumb',
        ]);

        if ($result->failed()) {
            throw new RuntimeException('Thumbnail generation failed.');
        }

        return '/tmp/thumb.png';
    }
}
```

---

## #14 Insecure Deserialization & `phar://` Chains (CWE-502)

### High-Risk Sinks
- `unserialize($request->input(...))` or `unserialize($cookie)` without `['allowed_classes' => false]`.
- Any filesystem function (`file_exists`, `is_file`, `getimagesize`, `md5_file`, `fopen`) accepting a user-controlled path that can start with `phar://` (triggers automatic PHAR metadata deserialization!).
- Leaked `APP_KEY` enabling attackers to forge encrypted cookies/sessions or signed URLs.

### Hardened Patterns
- **Always use JSON** instead of PHP serialization:
  ```php
  $data = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
  ```
- **Legacy fallback only**: `unserialize($payload, ['allowed_classes' => false])`.
- **Stream wrapper rejection**: Reject any user path matching `/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//` before calling filesystem functions.
- **Session & Queue hygiene**: Keep `EncryptCookies` enabled; never expose `APP_KEY`; rotate `APP_KEY` using `APP_PREVIOUS_KEYS` if compromised.

---

## #15 XML External Entity — XXE Injection (CWE-611)

### High-Risk Sinks
- `DOMDocument::loadXML()`, `simplexml_load_string()`, `new SimpleXMLElement()`, `XMLReader::XML()` with `LIBXML_NOENT`, `LIBXML_DTDLOAD`, or `LIBXML_DTDATTR`.
- SVG, SAML, SOAP, RSS/Atom, DOCX/XLSX parsers accepting untrusted XML.

### Hardened Pattern: `SafeXmlParser`
```php
<?php

declare(strict_types=1);

namespace App\Support;

use DOMDocument;
use InvalidArgumentException;

final class SafeXmlParser
{
    public static function parse(string $xml): DOMDocument
    {
        if (preg_match('/<!(?:DOCTYPE|ENTITY)\b/i', $xml) === 1) {
            throw new InvalidArgumentException('XML DTD and ENTITY declarations are forbidden.');
        }

        $previousUseErrors = libxml_use_internal_errors(true);
        $previousLoader = libxml_set_external_entity_loader(static fn () => null);

        try {
            $dom = new DOMDocument();
            // LIBXML_NONET blocks network access; NEVER pass LIBXML_NOENT or LIBXML_DTDLOAD
            $loaded = $dom->loadXML($xml, LIBXML_NONET | LIBXML_NOCDATA | LIBXML_COMPACT);

            if (! $loaded) {
                throw new InvalidArgumentException('Malformed XML payload.');
            }

            return $dom;
        } finally {
            libxml_set_external_entity_loader($previousLoader);
            libxml_clear_errors();
            libxml_use_internal_errors($previousUseErrors);
        }
    }
}
```

---

## #16 Server-Side Template Injection — SSTI (CWE-1336)

### High-Risk Sinks
- `Blade::render($userTemplate, $data)` or `Blade::compileString($userTemplate)` (gives instant PHP RCE via `@php system(...); @endphp`!).
- Writing user-editable strings into `.blade.php` files or passing them to Twig `createTemplate()` / Smarty / `eval()`.

### Hardened Pattern: Non-Executable Token Interpolation
```php
<?php

declare(strict_types=1);

namespace App\Support;

final class SafeTemplateRenderer
{
    /**
     * @param array<string, string> $variables
     */
    public static function render(string $template, array $variables): string
    {
        $replacements = [];
        foreach ($variables as $key => $value) {
            if (preg_match('/^[a-z0-9_]+$/', $key) === 1) {
                $replacements["{{{$key}}}"] = e($value);
            }
        }

        // Pure string substitution — zero PHP/Blade code evaluation
        return strtr($template, $replacements);
    }
}
```
