---
name: php-modern-syntax
description: Authoritative Modern PHP 8.4, PHP 8.5, and PHP 8.6.0 GA syntax reference, standard library guide, and migration checklist. Use when writing, upgrading, or refactoring PHP code to leverage PHP 8.6 Partial Function Application (? and ...), clamp(), Readonly property defaults, #[Override] on constants and enum cases, Time\Duration, SortDirection, Io\Poll\Context, StreamErrorMode/StreamException, Parameter DocComments, WeakMap reference assignment, object property writes on constants, PHP 8.5 clone($obj, [...]), pipe operator (|>), #[NoDiscard], and PHP 8.4 property hooks & asymmetric visibility.
---

# Modern PHP Syntax & Idioms Guide (PHP 8.4 – PHP 8.6.0 GA)

This skill is the verified syntax and standard library reference for **PHP 8.6.0 GA (released November 19, 2026)**, **PHP 8.5**, and **PHP 8.4**, tailored for strict-typed **Laravel 13** applications compliant with **PHPStan Level 8 / max**.

> **Master Guide**: See [`docs/architecture/php-8-6-modern-syntax-and-migration.md`](../../docs/architecture/php-8-6-modern-syntax-and-migration.md) for full class synopses, engine optimizations, Laravel 13 integration blueprints, and the complete PHP 8.5 → 8.6 upgrade runbook.

---

## 1. PHP 8.6.0 GA Language & Syntax Features

### 1.1 Partial Function Application (PFA) — `?` & `...` Placeholders
RFCs: `partial_function_application_v2` & `partial_function_application_optional_placeholder`.

Pre-fill positional or named arguments in any function, static method, or instance method call using `?` (single required placeholder) and/or trailing `...` (variadic leftover arguments), returning a `Closure` that preserves parameter names, types, pass-by-ref / return-by-ref, return type, `#[NoDiscard]`, and `#[SensitiveParameter]`.

- **Strict argument ordering**: zero or more positional values/`?` → zero or more named values/`?` → zero or one trailing `...`. (Positional arguments after named arguments are a compile-time error.)
- **Optionality rule**: Every `?` placeholder ALWAYS creates a **required** parameter even when the target parameter has a default value. Only `...` inherits parameter optionality and defaults.
- **Compiler optimization**: `array_map()` with a first-class callable or PFA callback is compiled directly into an internal `foreach` loop.

```php
<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Str;

final class SlugPipeline
{
    public static function normalize(string $rawTitle): string
    {
        // Pair ? placeholders with first-class callables (...) and the pipe operator (|>)
        return $rawTitle
            |> trim(...)
            |> str_replace(' ', '-', ?)
            |> strtolower(...)
            |> Str::limit(?, 80, '');
    }

    /**
     * @param list<string> $versions
     * @return list<string>
     */
    public static function filterPhp86Compatible(array $versions): array
    {
        // Positional placeholder ?
        return array_values(array_filter($versions, version_compare(?, '8.6', '>=')));
    }

    public static function createRetryCalculator(int $baseMs, int $maxMs): callable
    {
        // Named placeholder ? (returns Closure expecting required int $attempt)
        return self::backoff($baseMs, $maxMs, attempt: ?);
    }

    public static function deferQuery(string $sql): callable
    {
        // Zero-arg thunk via trailing ...
        return self::runStatement($sql, ...);
    }

    private static function backoff(int $baseMs, int $maxMs, int $attempt): int
    {
        return clamp($baseMs * (2 ** $attempt), $baseMs, $maxMs);
    }

    private static function runStatement(string $sql): string
    {
        return $sql;
    }
}
```

### 1.2 Native `clamp()` Function
Signature: `clamp(mixed $value, mixed $min, mixed $max): mixed`.

Constrains any comparable value — `int`, `float`, `string`, `DateTimeImmutable`, or `Time\Duration` — within `[$min, $max]`. Throws `ValueError` if `$min > $max` or if `$min` / `$max` is `NAN`; returns `NAN` if `$value` is `NAN`.

```php
<?php

declare(strict_types=1);

use DateTimeImmutable;
use Time\Duration;

// Numeric bounds (e.g., API pagination limits)
$perPage = clamp($request->integer('per_page', 25), min: 5, max: 100);
$discount = clamp(-5, 0, 50); // 0

// Comparable objects: Time\Duration and DateTimeImmutable
$timeout = clamp(
    Duration::fromSeconds(120),
    Duration::fromSeconds(5),
    Duration::fromSeconds(60),
); // Time\Duration(60s)

$scheduledAt = clamp(
    $requestedDate,
    new DateTimeImmutable('2026-01-01T00:00:00Z'),
    new DateTimeImmutable('2026-12-31T23:59:59Z'),
);
```

### 1.3 Readonly Property Defaults
RFC: `readonly_property_defaults`.

Instance `readonly` properties (including properties inside `readonly class` declarations) may now declare default values.

> **Critical Invariant**: A default value on a `readonly` property **counts as its single initializing assignment**. Constructors **cannot** overwrite a `readonly` property that declares a default value — use constructor promoted defaults (`public string $sort = 'created_at'`) when callers need to override per instance, and property-level defaults when implementing immutable interface property contracts or class-level fixed defaults.

```php
<?php

declare(strict_types=1);

namespace App\Rules;

interface ParsingRule
{
    public string $parser { get; }
}

final readonly class SlugRule implements ParsingRule
{
    // Counts as the single initializing write — satisfies interface without boilerplate constructor
    public string $parser = 'slug';
    public int $maxLength = 120;

    public function __construct(
        // Use promoted constructor defaults when callers may customize the value:
        public bool $allowUnicode = false,
    ) {}
}
```

### 1.4 `#[Override]` on Class, Interface, Trait Constants & Enum Cases
RFC: `override_constants`.

Always import `use Override;` at the top of the file (never inline `#[\Override]`). PHP 8.6 validates at compile time that a matching `public` or `protected` constant exists in a parent class or implemented interface (`private` parent constants do **not** satisfy `#[Override]`).

```php
<?php

declare(strict_types=1);

namespace App\Payments;

use Override;

interface PaymentGatewayContract
{
    public const int DEFAULT_TIMEOUT_SECONDS = 30;
}

final class StripePaymentGateway implements PaymentGatewayContract
{
    #[Override]
    public const int DEFAULT_TIMEOUT_SECONDS = 45;
}
```

### 1.5 Object Property Writes on Constants
RFC: `const_object_property_write`.

Allows `->` property writes, `isset()`, `unset()`, compound assignments, `++`/`--`, and pass-by-reference on objects referenced by global or class constants (rebinding the constant itself remains illegal; array dimension writes `[]` on constants remain unchanged):

```php
<?php

declare(strict_types=1);

use stdClass;

const METRICS = new stdClass();
METRICS->requests = 0;
METRICS->requests++;
unset(METRICS->temp);
```

### 1.6 Debugable Enums (`__debugInfo(): array`)
RFC: `debugable-enums`.

Unit and backed enums can now declare `public function __debugInfo(): array` to redact sensitive values in debug output (`var_dump()`, Symfony VarDumper / `dd()`).

> **Important Security & Deprecation Notes**:
> - Return type MUST be non-nullable `array` — declaring `?array` or `array|null` on `__debugInfo()` is deprecated in PHP 8.6.
> - `__debugInfo()` only affects debug dumps; Monolog's `NormalizerFormatter` uses JSON normalization and serializes the raw backing value, so always enforce separate Monolog secret scrubbing for logs.

```php
<?php

declare(strict_types=1);

namespace App\Enums\Security;

enum ApiCredentialType: string
{
    case ProductionKey = 'prod_secret_998124';
    case SandboxKey = 'test_key_00129';

    /**
     * @return array{name: string, masked_value: string}
     */
    public function __debugInfo(): array
    {
        return [
            'name' => $this->name,
            'masked_value' => substr($this->value, 0, 4) . '****',
        ];
    }
}
```

### 1.7 Parameter DocComments (`ReflectionParameter::getDocComment()`)
RFC: `parameter-doccomments`.

Function and method parameters may now declare their own DocComments (placed before the parameter or after it before `,`), retrievable via `ReflectionParameter::getDocComment(): string|false`. Ideal for `laravel/mcp` tools, `laravel/ai` schemas, and OpenAPI generators:

```php
<?php

declare(strict_types=1);

use ReflectionFunction;

function searchCatalog(
    /** Full-text search phrase */
    string $query,
    /** Maximum records per page (5–100) */
    int $limit = 25,
): array {
    return [$query, clamp($limit, 5, 100)];
}

$params = new ReflectionFunction('searchCatalog')->getParameters();
$doc = $params[0]->getDocComment(); // "/** Full-text search phrase */"
```

### 1.8 `WeakMap` Reference Assignment
Reference assignment on a `WeakMap` (`$cache[$object] =& $value;`) now works without requiring `$object` to already exist as a key in the map.

---

## 2. PHP 8.6.0 GA Standard Library & Core APIs

### 2.1 `Time\Duration` & `Time\TimeException`
Nanosecond-precision, timezone- and calendar-independent elapsed time (`final readonly class Time\Duration`, max range `9223372035999999999` ns).

- **Readonly properties**: `public readonly int $seconds`, `public readonly int $nanoseconds`, `public readonly bool $negative`.
- **Factories**: `fromNanoseconds(int)`, `fromMicroseconds(int)`, `fromMilliseconds(int)`, `fromSeconds(int $seconds, int $nanoseconds = 0)`, `fromMinutes(int)`, `fromHours(int)`, `fromIso8601DurationString(string)` (time components up to hours only — calendar designators `Y`/`M`/`W`/`D` throw `Time\TimeException`).
- **Arithmetic & Comparison**: `add(self)`, `sub(self)`, `multiplyBy(int)`, `divideBy(int)`, `negate()`, `absolute()`, `static compare(self $a, self $b): int`, plus `<`, `<=`, `==`, `!=`, `>=`, `>`, `<=>`, and `clamp()`.
- **No string coercion**: `Time\Duration` does **not** implement `__toString()`, `toIsoString()`, or `toSeconds()`. Read `$duration->seconds` and `$duration->nanoseconds` directly.

```php
<?php

declare(strict_types=1);

use Time\Duration;
use Time\TimeException;

$base = Duration::fromSeconds(90);
$extra = Duration::fromMinutes(5);
$total = $base->add($extra);

$totalSeconds = $total->seconds;         // 390
$remainingNs = $total->nanoseconds;      // 0
$isNegative = $total->negative;          // false

$parsed = Duration::fromIso8601DurationString('PT1H30M'); // 5400s
$sorted = [$extra, $base];
usort($sorted, Duration::compare(...));

try {
    Duration::fromIso8601DurationString('P1D'); // Calendar day unsupported
} catch (TimeException $e) {
    // Handle invalid duration specification
}
```

### 2.2 Native `SortDirection` Enum
Global unbacked enum: `enum SortDirection { case Ascending; case Descending; }`. Stop creating duplicate userland `App\Enums\Common\SortDirection` enums.

```php
<?php

declare(strict_types=1);

namespace App\Builders;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use SortDirection;

/**
 * @template TModel of Model
 * @extends Builder<TModel>
 */
final class OrderQueryBuilder extends Builder
{
    public function orderedByCreatedAt(SortDirection $direction = SortDirection::Descending): self
    {
        return $this->orderBy(
            'created_at',
            match ($direction) {
                SortDirection::Ascending => 'asc',
                SortDirection::Descending => 'desc',
            },
        );
    }
}
```

### 2.3 Native I/O Polling API (`Io\Poll\*` + `StreamPollHandle`)
Scalable OS-native event multiplexing (`epoll`, `kqueue`, `WSAPoll`, `EventPorts`, `Poll`) replacing `stream_select()`'s `FD_SETSIZE` ceiling for workers and event loops. `Io\Poll\Handle` is an internal-only marker interface; wrap PHP streams with global `StreamPollHandle`.

```php
<?php

declare(strict_types=1);

use Io\Poll\Backend;
use Io\Poll\Context;
use Io\Poll\Event;
use StreamPollHandle;
use Time\Duration;

$context = new Context(Backend::Auto);
$handle = new StreamPollHandle($socketStream);

$watcher = $context->add($handle, [Event::Read], data: 'worker-1');

// Wait up to 1 second using PHP 8.6's Time\Duration timeout parameter
$triggered = $context->wait(timeout: Duration::fromSeconds(1), maxEvents: 64);

foreach ($triggered as $readyWatcher) {
    $readyHandle = $readyWatcher->getHandle();
    if ($readyWatcher->hasTriggered(Event::Read) && $readyHandle instanceof StreamPollHandle) {
        $chunk = fread($readyHandle->getStream(), 8192);
    }
}

$watcher->remove();
```

### 2.4 Structured Stream Error Handling (`StreamErrorMode` & `StreamException`)
Replace fragile `@fopen()` + `E_WARNING` error suppression with structured `StreamErrorMode`, `StreamErrorStore`, `StreamError`, `StreamException`, `stream_last_errors()`, and `stream_clear_errors()`. Always nest `error_mode`, `error_store`, and `error_handler` inside the `'stream'` context option array (passing them at top level or via `stream_context_set_default()` raises `ValueError`):

```php
<?php

declare(strict_types=1);

use StreamErrorMode;
use StreamErrorStore;
use StreamException;

$context = stream_context_create([
    'stream' => [
        'error_mode' => StreamErrorMode::Exception,
        'error_store' => StreamErrorStore::All,
    ],
]);

$stream = null;
try {
    $stream = fopen('/var/app/exports/report.csv', 'rb', false, $context);
    // Stream rows cleanly with fgetcsv($stream)...
} catch (StreamException $e) {
    $errors = $e->getErrors(); // list<StreamError>
} finally {
    if (is_resource($stream)) {
        fclose($stream);
    }
}
```

### 2.5 Enriched JSON Parse Location (`json_last_error_msg()` & `JsonException`)
`json_decode()` failures now embed `near location {line}:{column}` directly into `json_last_error_msg()` and `JsonException::getMessage()` (integer codes from `json_last_error()` are unchanged; there is **no** `JsonException::getOffset()` method):

```php
<?php

declare(strict_types=1);

use JsonException;

try {
    json_decode('{"name": "Laravel", invalid}', associative: true, flags: JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    // Message: "Syntax error near location 1:21"
    $diagnostic = $e->getMessage();
}
```

### 2.6 New Reflection, URI & Security / Crypto Additions
- **Reflection**: `ReflectionProperty::isReadable(?string $scope, ?object $object = null): bool`, `ReflectionProperty::isWritable(?string $scope, ?object $object = null): bool`, `ReflectionParameter::getDocComment(): string|false`, `ReflectionConstant::inNamespace()`, `ReflectionAttribute::{inNamespace,getNamespaceName,getShortName}()`.
- **URI Builders**: `Uri\Rfc3986\UriBuilder`, `Uri\WhatWg\UrlBuilder`, `Uri\WhatWg\url_percent_encode()`, `getUriType()`, `getHostType()`, `isSpecialScheme()`.
- **Session Security Defaults**: `session.use_strict_mode = 1`, `session.cookie_httponly = 1`, `session.cookie_samesite = "Lax"` now enabled by default in PHP 8.6.
- **Sodium**: IPcrypt (`sodium_crypto_ipcrypt_*`, `sodium_bin2ip`/`sodium_ip2bin`), XOF (`SHAKE128/256`, `TurboSHAKE128/256`), and Post-Quantum KEM (`X-Wing` & `ML-KEM-768`, libsodium ≥ 1.0.22).
- **Other Notable Additions**: `ARRAY_FILTER_USE_VALUE`, `grapheme_strrev()`, `IntlNumberRangeFormatter`, `SpoofChecker` Bidi methods (ICU ≥ 74), `ZipArchive::openString()`/`closeString()`, `mysqli::quote_string()`, `Pdo\Pgsql::ATTR_CHUNK_SIZE` (libpq ≥ 17), `Openssl\{OpensslException,Session,Psk}`, `pack()`/`unpack()` `<`/`>` endianness modifiers, `error_include_args` INI, Unicode 18.0.

---

## 3. PHP 8.5 Features (Verified Syntax)

### 3.1 Native Pipe Operator (`|>`)
```php
<?php

declare(strict_types=1);

// Valid on PHP 8.5+ (on PHP 8.6+, the middle closure can be simplified to str_replace(' ', '-', ?))
$slug = '   PHP 8.5 Release Overview   '
    |> trim(...)
    |> (static fn (string $value): string => str_replace(' ', '-', $value))
    |> strtolower(...);
```

### 3.2 Clone With v2: `clone($object, $properties)`
> **Exact Syntax**: PHP 8.5 shipped function-call syntax `clone($object, ['prop' => $value])`. Do **NOT** write `clone $object with (...)` — that syntax does not exist.

```php
<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\UserStatus;
use NoDiscard;

final readonly class UserProfile
{
    public function __construct(
        public string $name,
        public string $email,
        public UserStatus $status,
    ) {}

    #[NoDiscard]
    public function withStatus(UserStatus $status): self
    {
        return clone($this, [
            'status' => $status,
        ]);
    }
}
```

### 3.3 `#[NoDiscard]` Attribute & Native Array / URI Helpers
- **`#[NoDiscard]`** (import `use NoDiscard;`): flags ignored return values at runtime and in static analysis.
- **`array_first(array $array): mixed`** & **`array_last(array $array): mixed`**: pointer-safe first/last element extraction (returns `null` on empty arrays).
- **Native URI Extension**: `Uri\Rfc3986\Uri` and `Uri\WhatWg\Url` (plus PHP 8.6 `UriBuilder` / `UrlBuilder`).
- **`#[Override]` on Properties** (PHP 8.5) — extended to constants and enum cases in PHP 8.6.
- **Closures & First-Class Callables in Constant Expressions**: static closures and FCCs inside attributes and parameter defaults.

---

## 4. PHP 8.4 Features

### 4.1 Property Hooks & Asymmetric Visibility (`public private(set)`)
```php
<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use DateTimeImmutable;
use InvalidArgumentException;

final class BankAccount
{
    public private(set) int $balanceInCents = 0;
    public private(set) ?DateTimeImmutable $lastDepositedAt = null;

    public string $currency = 'USD' {
        get => $this->currency;
        set {
            $upper = strtoupper($value);
            if (! in_array($upper, ['USD', 'EUR', 'GBP'], true)) {
                throw new InvalidArgumentException("Unsupported currency: {$value}");
            }
            $this->currency = $upper;
        }
    }

    public function deposit(int $cents): void
    {
        if ($cents <= 0) {
            throw new InvalidArgumentException('Deposit must be positive.');
        }

        $this->balanceInCents += $cents;
        $this->lastDepositedAt = new DateTimeImmutable();
    }
}
```

### 4.2 Parenthesis-Free `new` Chaining
```php
$result = new RequestPipeline()->pipe($step1)->pipe($step2)->execute();
```

---

## 5. PHP 8.6 Deprecations & Breaking Changes Checklist

When writing or upgrading code for PHP 8.6+, strictly avoid these deprecated/changed patterns:

| Category | Deprecated / Changed in PHP 8.6 | Modern Replacement |
| :--- | :--- | :--- |
| **Reserved Identifiers** | Naming classes/functions/constants/aliases `let` or `is`; constant `_`; function `readonly`; class constant `namespace` | Rename identifiers; avoid future pattern-matching keywords |
| **Control Flow / Magic** | `return` inside `finally`; returning values from or making `__construct`/`__destruct` generators; `?array` return type on `__debugInfo()` | Return outside `finally`; `void` constructors/destructors; non-nullable `__debugInfo(): array` |
| **Mbregex (Oniguruma EOL)** | `mb_ereg*`, `mb_split` | Use PCRE (`preg_match`, `preg_replace`, `preg_split`) with `/u` modifier |
| **Legacy Aliases & SPL** | `is_double`, `is_long`, `is_integer`, `doubleval`, `strcoll`, `SORT_LOCALE_STRING`, `metaphone`, `spl_classes`, `spl_object_hash`, `SplFileObject` CSV methods | `is_float`, `is_int`, `floatval`, `Collator`, `ReflectionExtension::getClassNames()`, `spl_object_id()`, `fgetcsv`/`fputcsv` |
| **Type Strictness** | Objects passed to `array_walk*`, `http_build_query`, `mb_convert_variables`; 3rd `$case_insensitive` arg to `define()`; invalid flags or NUL bytes in paths/env | Pass arrays explicitly; omit 3rd `define()` arg; catch `ValueError`/`TypeError` |
| **Trim & Streams BC** | `trim()`/`ltrim()`/`rtrim()`/`chop()` now strip `\f` (form feed) by default; `fclose()`/`file_put_contents()`/`copy()` return `false` on flush/close failure | Specify explicit `$characters` if `\f` must be preserved; check `false` return on writes/close |
| **JSON & OOM BC** | `json_last_error_msg()`/`JsonException` strings append `near location L:C`; hard OOM calls `abort()` (exit `134`) | Assert error codes (`json_last_error()`), not exact message strings |

---

## 6. Anti-Hallucination Guard: Features NOT in PHP 8.6

Never emit the following syntax — each was either declined, deferred, or remains under discussion as of PHP 8.6.0 GA:

- `clone $obj with (prop: $val)` → **Wrong** (use PHP 8.5 `clone($obj, ['prop' => $val])`).
- `BackedEnum::values()` → **Not in PHP 8.6** (under discussion; use `array_column(self::cases(), 'value')`).
- Pattern matching `is` operator (`$x is int`) → **Not in PHP 8.6** (under discussion; `is` identifier deprecated in prep).
- `let` block scoping (`let $x = 1`) → **Declined** (`let` identifier deprecated).
- Bound-erased generic types (`class Box<T>`) → **Declined** (use PHPStan `@template` generics).
- `Time\Instant` / `Time\Clock` → **Not in PHP 8.6** (under discussion; only `Time\Duration` & `Time\TimeException` shipped).
- Pipe assignment (`$x |>= trim(...)`) → **Declined**; `$this` PFA → **Under discussion**.
- `Duration::ofSeconds()` / `$duration->toIsoString()` / `JsonException::getOffset()` / `new Io\Poll()` → **Do not exist**.
