---
name: php-modern-syntax
description: Authoritative Modern PHP 8.4, PHP 8.5.0 GA, and PHP 8.6.0 GA syntax reference, standard library guide, and cumulative migration checklist. Use when writing, upgrading, or refactoring PHP code to leverage PHP 8.6 Partial Function Application (? and ...), clamp(), Readonly property defaults, #[Override] on constants and enum cases, Time\Duration, SortDirection, Io\Poll\Context, StreamErrorMode/StreamException, Parameter DocComments, WeakMap reference assignment, object property writes on constants, PHP 8.5 pipe operator (|>), clone($obj, [...]), #[NoDiscard] + (void) cast, #[DelayedTargetValidation], #[Override] on properties, #[Deprecated] on traits/constants, final property promotion, asymmetric static visibility, closures/FCCs/casts in constant expressions, native Uri\Rfc3986\Uri & Uri\WhatWg\Url, array_first/array_last, Closure::getCurrent(), FILTER_THROW_ON_FAILURE, IntlListFormatter, and PHP 8.4 property hooks & asymmetric visibility.
---

# Modern PHP Syntax & Idioms Guide (PHP 8.4 – PHP 8.5.0 GA – PHP 8.6.0 GA)

This skill is the verified syntax and standard library reference for **PHP 8.6.0 GA (released November 19, 2026)**, **PHP 8.5.0 GA (released November 20, 2025)**, and **PHP 8.4**, tailored for strict-typed **Laravel 13** applications compliant with **PHPStan Level 8 / max**.

> **Master Guide**: See [`docs/architecture/php-8-6-modern-syntax-and-migration.md`](../../docs/architecture/php-8-6-modern-syntax-and-migration.md) for full PHP 8.5 & PHP 8.6 class synopses, engine optimizations, Laravel 13 integration blueprints, and the cumulative **PHP 8.4 → 8.5 → 8.6** upgrade runbook.

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

Allows `->` property writes, `isset()`, `unset()`, compound assignments, `++`/`--`, and pass-by-reference on objects referenced by global or class constants (rebinding the constant itself remains illegal; array dimension writes `[]` on constants remain unchanged; class constants still cannot directly use `new` expressions and must reference a global constant):

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
> - Return type MUST be non-nullable `array` — declaring `?array` or `array|null` on `__debugInfo()` is deprecated in PHP 8.6 (and returning `null` was deprecated in PHP 8.5).
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
- **Arithmetic & Comparison**: `add(Duration $duration)`, `sub(Duration $duration)`, `multiplyBy(int)`, `divideBy(int)`, `negate()`, `absolute()`, `static compare(self $a, self $b): int`, plus `<`, `<=`, `==`, `!=`, `>=`, `>`, `<=>`, and `clamp()`.
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

### 2.6 New Reflection, URI & Security / Crypto Additions (PHP 8.6)
- **Reflection**: `ReflectionProperty::isReadable(?string $scope, ?object $object = null): bool`, `ReflectionProperty::isWritable(?string $scope, ?object $object = null): bool`, `ReflectionParameter::getDocComment(): string|false`, `ReflectionConstant::inNamespace()`, `ReflectionAttribute::{inNamespace,getNamespaceName,getShortName}()`.
- **URI Builders**: `Uri\Rfc3986\UriBuilder`, `Uri\WhatWg\UrlBuilder`, `Uri\WhatWg\url_percent_encode()`, `getUriType()`, `getHostType()`, `isSpecialScheme()`.
- **Session Security Defaults**: `session.use_strict_mode = 1`, `session.cookie_httponly = 1`, `session.cookie_samesite = "Lax"` now enabled by default in PHP 8.6.
- **Sodium**: IPcrypt (`sodium_crypto_ipcrypt_*`, `sodium_bin2ip`/`sodium_ip2bin`), XOF (`SHAKE128/256`, `TurboSHAKE128/256`), and Post-Quantum KEM (`X-Wing` & `ML-KEM-768`, libsodium ≥ 1.0.22).
- **Other Notable Additions**: `ARRAY_FILTER_USE_VALUE`, `grapheme_strrev()`, `IntlNumberRangeFormatter`, `SpoofChecker` Bidi methods (ICU ≥ 74), `ZipArchive::openString()`/`closeString()`, `mysqli::quote_string()`, `Pdo\Pgsql::ATTR_CHUNK_SIZE` (libpq ≥ 17), `Openssl\{OpensslException,Session,Psk}`, `pack()`/`unpack()` `<`/`>` endianness modifiers, `error_include_args` INI, Unicode 18.0.

---

## 3. PHP 8.5.0 GA Language, Syntax & Standard Library (Complete Verified Reference)

### 3.1 Native Pipe Operator (`|>`, `T_PIPE`)
Left-associative operator passing the LHS expression as the single argument to the RHS callable.

- **Precedence**: Directly below `.` (string concat) and **above** all comparisons (`==`, `===`, `<`, `>`), bitwise/logical operators, `??`, `?:`, `=`, and `yield`.
  - `5 + 2 |> f(...)` evaluates `(5 + 2) |> f(...)`.
  - `'ok' |> strlen(...) === 2` compares the pipe result against `2`.
  - `$id |> findUsername(...) ?? 'guest'` coalesces the entire chain.
- **Parentheses required on RHS**: Always wrap arrow functions `fn(...) => ...`, `??`, and `?:` in parentheses when used as a pipe stage (`|> (static fn (string $v): string => ...)`). Omitting parentheses around arrow functions is a syntax error.
- **Callable constraints**: RHS must accept 1 argument (by-value; pass-by-reference parameters are disallowed except internal "prefer-ref" stdlib functions). Non-callable RHS throws `Error`. Compiled directly for FCCs (`strlen(...)`, `$obj->method(...)`, `Class::method(...)`).

```php
<?php

declare(strict_types=1);

// Valid on PHP 8.5+ (on PHP 8.6+, the middle closure can be simplified to str_replace(' ', '-', ?))
$slug = '   PHP 8.5 Release Overview   '
    |> trim(...)
    |> (static fn (string $value): string => str_replace(' ', '-', $value))
    |> strtolower(...);

$label = $rawInput
    |> trim(...)
    |> (static fn (string $value): ?string => $value !== '' ? $value : null)
    ?? 'untitled';
```

### 3.2 Clone With v2: `clone(object $object, array $withProperties = []): object`
> **Exact Syntax**: PHP 8.5 promoted `clone` to a language construct/function (`clone($object, ['prop' => $value])`) and first-class callable (`clone(...)`). Do **NOT** write `clone $object with (...)` — that syntax does not exist.

- **Execution order**: (1) Shallow copy → (2) `__clone()` executes **before** `$withProperties` → (3) `$withProperties` writes apply in iteration order (first exception aborts remaining assignments).
- **Readonly, Visibility & Invariants**: Unlocks `readonly` on the cloned copy during assignment, while strictly enforcing visibility (including implicit `protected(set)` on `public readonly`), property `set` hooks, and `__set()`. Because `clone($object, [...])` bypasses `__construct()` and runs `__clone()` before applying overrides, preserve value-object invariants by validating inside a property `set` hook or reconstructing through the validating constructor (`new self(...)`).
- **First-Class Callable**: `array_map(clone(...), $items)` clones a list of objects cleanly.

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

    #[NoDiscard('Use the cloned UserProfile instance returned by withStatus().')]
    public function withStatus(UserStatus $status): self
    {
        return clone($this, [
            'status' => $status,
        ]);
    }
}
```

### 3.3 `#[NoDiscard]` Attribute & `(void)` Cast (`T_VOID_CAST`)
- **Synopsis**: `#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_FUNCTION)] final class NoDiscard { public readonly ?string $message; public function __construct(?string $message = null) {} }`.
- **Fail-closed timing**: Checks for unused return value **after** argument evaluation and **before** executing the function body — emits `E_USER_WARNING` (userland) or `E_WARNING` (native), including `$message`.
- **Inheritance & Restrictions**: Applies strictly to the called declaration (NOT inherited from interfaces or parent methods; **preserved** when copied from traits). Compile-time error on `: void`, `: never`, void/untyped magic methods, and property hooks.
- **Explicit Suppression with `(void)`**: Use `(void) $service->compute();` when intentionally discarding a `#[NoDiscard]` return value (protected from OPcache DCE). `(void)` is a **statement-only** construct, NOT an expression (`if ((void) $fn())` is a `ParseError`).
- **Native PHP 8.5 usage**: Applied natively to `flock()` and `DateTimeImmutable::set*()`.

```php
<?php

declare(strict_types=1);

use NoDiscard;

#[NoDiscard('Inspect the verification result before proceeding.')]
function verifyDigest(string $expected, string $actual): bool
{
    return hash_equals($expected, $actual);
}

// Suppressing warning intentionally in a test or fire-and-forget wrapper:
(void) verifyDigest($expected, $actual);
```

### 3.4 `#[Override]` on Properties, `#[DelayedTargetValidation]`, `#[Deprecated]` Expansion & Constant Attributes
- **`#[Override]` on Properties** (`Attribute::TARGET_PROPERTY`): Works on regular and constructor-promoted properties (PHP 8.5); extended to class/interface/trait constants & enum cases in PHP 8.6.
- **`#[DelayedTargetValidation]`**: Defers compile-time validation of internal/extension attribute targets to `ReflectionAttribute::newInstance()`. Use when maintaining dual PHP 8.5 / 8.6 libraries (e.g., attaching `#[Override]` to constants before 8.6) or working with PHP 8.5's stricter compile-time rejection of `#[Attribute]` on abstract classes/interfaces/traits/enums.
- **`#[Deprecated]` Expansion**: Extended in PHP 8.5 to **traits** and **compile-time non-class constants** (`const FOO = ...`, via `Attribute::TARGET_CONSTANT`; functions, methods, and class constants shipped in PHP 8.4).
- **Attributes on Non-Class Constants**: Compile-time `const` declarations (not `define()`) accept attributes, readable via `ReflectionConstant::getAttributes()`.

### 3.5 `final` Constructor Property Promotion & Asymmetric Static Visibility
- **`final` Promoted Properties**: Declare `final` directly on promoted constructor parameters (defaults to `public` if visibility omitted; combinable with asymmetric visibility & property hooks).
- **Asymmetric Visibility on Static Properties**: `public private(set) static` and `public protected(set) static` follow identical semantics to PHP 8.4 instance asymmetric visibility.

```php
<?php

declare(strict_types=1);

namespace App\Domain\Ledger;

class BaseLedgerEntry
{
    public private(set) static int $allocatedCount = 0;

    public function __construct(
        final public string $ledgerId,
        final public private(set) int $amountCents,
    ) {
        self::$allocatedCount++;
    }
}
```

### 3.6 Static Closures, First-Class Callables & Type Casts in Constant Expressions
Permitted in attribute arguments, property/parameter defaults, constants, and class constants:
- Closures **must** be `static` and **cannot** use `use (...)` (arrow functions `fn(...)` are disallowed due to implicit capture).
- First-class callables are limited to `function_name(...)` and `ClassName::methodName(...)` (no dynamic expressions or `__callStatic()`).
- Scalar type casts are allowed in constant expressions (e.g., `public const int MAX_RETRIES = (int) 3.0;`).

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Attribute;

#[Attribute(Attribute::TARGET_PROPERTY)]
final readonly class TransformWith
{
    /** @param callable(string): string $transformer */
    public function __construct(
        public mixed $transformer = trim(...),
    ) {}
}

final readonly class SearchFilter
{
    public const int DEFAULT_LIMIT = (int) 25.0;

    public function __construct(
        #[TransformWith(static function (string $value): string {
            return strtolower(trim($value));
        })]
        public string $query = '',
    ) {}
}
```

### 3.7 Native URI Extension (`Uri\Rfc3986\Uri` & `Uri\WhatWg\Url`)
Always-enabled built-in extension (powered by `uriparser` for RFC 3986 and `Lexbor` for WHATWG URLs). Prefer over legacy `parse_url()` for security-critical URL parsing (SSRF defense, webhook validation, OAuth redirects):

- **`Uri\Rfc3986\Uri`** (`final readonly class`): `new Uri($str, ?Uri $base = null)` (throws `Uri\InvalidUriException`), `Uri::parse($str, ?Uri $base = null): ?static`, `resolve()`, `equals(..., UriComparisonMode::ExcludeFragment|IncludeFragment)`, `toString()` / `toRawString()`, normalized getters (`getScheme()`, `getHost()`, `getPort()`, `getPath()`, `getQuery()`, `getFragment()`, `getUserInfo()`, `getUsername()`, `getPassword()`), `getRaw*()` getters, and immutable `with*()` methods (`withUserInfo(#[SensitiveParameter] ?string)`).
- **`Uri\WhatWg\Url`** (`final readonly class`): `new Url($str, ?Url $base = null, array &$softErrors = null)` (throws `Uri\WhatWg\InvalidUrlException` with `$errors`), `Url::parse($str, ?Url $base = null, array &$errors = null): ?static`, `toAsciiString()` / `toUnicodeString()`, `getAsciiHost()` / `getUnicodeHost()`, and immutable `with*()` methods.

```php
<?php

declare(strict_types=1);

namespace App\Security;

use Uri\InvalidUriException;
use Uri\Rfc3986\Uri;
use Uri\UriComparisonMode;
use Uri\WhatWg\Url;

final class SafeUrlNormalizer
{
    public static function canonicalHttpsOrigin(string $rawUrl): ?string
    {
        $url = Url::parse($rawUrl);
        $host = $url?->getAsciiHost();
        if ($url === null || $url->getScheme() !== 'https' || $host === null) {
            return null;
        }

        // Return scheme + host + optional port only (never credentials, path, query, or fragment)
        $port = $url->getPort();

        return $port === null
            ? sprintf('https://%s', $host)
            : sprintf('https://%s:%d', $host, $port);
    }

    /**
     * Resolves a callback reference strictly within the trusted HTTPS base origin (blocks SSRF origin escape).
     *
     * @throws InvalidUriException
     */
    public static function resolveWebhookCallback(string $base, string $relative): string
    {
        $baseUri = new Uri($base);
        if ($baseUri->getScheme() !== 'https' || $baseUri->getHost() === null || $baseUri->getUserInfo() !== null) {
            throw new InvalidUriException('Base webhook URI must use HTTPS with an explicit host and no credentials.');
        }

        $resolved = $baseUri->resolve($relative);
        if (
            $resolved->getScheme() !== 'https'
            || $resolved->getHost() !== $baseUri->getHost()
            || $resolved->getPort() !== $baseUri->getPort()
            || $resolved->getUserInfo() !== null
        ) {
            throw new InvalidUriException('Callback URI must stay on the trusted HTTPS base origin without credentials.');
        }

        return $resolved->equals($baseUri, UriComparisonMode::ExcludeFragment)
            ? $baseUri->withFragment(null)->toString()
            : $resolved->withFragment(null)->toString();
    }
}
```

### 3.8 PHP 8.5 Standard Library, Intl, Curl, Filter, PDO & Runtime Additions
- **Array & Core**: `array_first(array $array): mixed`, `array_last(array $array): mixed`, `get_error_handler(): ?callable`, `get_exception_handler(): ?callable`, `Closure::getCurrent(): Closure` (clean self-recursion without `&$fn`), `Closure` is a proper subtype of `callable`.
- **Filter**: `FILTER_THROW_ON_FAILURE` + `Filter\FilterException` / `Filter\FilterFailedException` (cannot combine with `FILTER_NULL_ON_FAILURE` → `ValueError`).
- **Intl** (ICU ≥ 57.1; `IntlListFormatter` ICU ≥ 67): `IntlListFormatter` (`TYPE_AND`, `TYPE_OR`, `TYPE_UNITS`; `WIDTH_WIDE`, `WIDTH_SHORT`, `WIDTH_NARROW`), `locale_is_right_to_left()` / `Locale::isRightToLeft()`, `Locale::{addLikelySubtags,minimizeSubtags}()`, `grapheme_levenshtein()`, `$locale` param on `grapheme_*()`.
- **Curl**: `curl_multi_get_handles(CurlMultiHandle)`, `curl_share_init_persistent(array $share_options): CurlSharePersistentHandle`.
- **DOM**: `Dom\Element::getElementsByClassName()`, `Dom\Element::insertAdjacentHTML()`, `$outerHTML`, `$children`.
- **PDO / SQLite / PgSQL** (note: `Pdo\Mysql`/`Pdo\Pgsql`/`Pdo\Sqlite` subclasses shipped in PHP 8.4): `Pdo\Sqlite::setAuthorizer(?callable)`, `ATTR_TRANSACTION_MODE`, `ATTR_EXPLAIN_STATEMENT`, `ATTR_BUSY_STATEMENT`; `Pdo\Pgsql::copyFromArray(iterable)` & `PDO::ATTR_PREFETCH = 0`; `pg_close_stmt()` (libpq ≥ 17).
- **Reflection**: `ReflectionConstant` is no longer `final` and adds `getFileName()`, `getExtension()`, `getExtensionName()`, `getAttributes()`; `ReflectionProperty::getMangledName()`.
- **Cookies (CHIPS)**: `setcookie()`, `setrawcookie()`, `session_set_cookie_params()` support `'partitioned' => true`.
- **OPcache, INI & CLI**: OPcache is **always compiled in** (remove `zend_extension=opcache.so` to avoid warnings; added `opcache_is_script_cached_in_file_cache()`), `fatal_error_backtraces=1` enabled by default, `max_memory_limit` (`INI_SYSTEM` hard cap), `disable_classes` removed, `PHP_BUILD_DATE`, `PHP_BUILD_PROVIDER`, and `php --ini=diff`.

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

### 4.2 Parenthesis-Free `new` Chaining & PHP 8.4 Array/PDO/DOM Foundations
- Chaining without wrapping parentheses: `new RequestPipeline()->pipe($step1)->execute()`.
- `array_find()`, `array_find_key()`, `array_any()`, `array_all()`, `#[Deprecated]` (functions/methods/class constants), `BcMath\Number`, `Dom\HTMLDocument`/`Dom\XMLDocument`, and driver-specific `Pdo\Mysql`/`Pdo\Pgsql`/`Pdo\Sqlite` subclasses.

---

## 5. Cumulative Deprecations & Breaking Changes Checklist (PHP 8.5 & PHP 8.6)

### 5.1 PHP 8.5.0 GA Deprecations & BC Changes

| Category | Deprecated / Changed in PHP 8.5 | Modern Replacement |
| :--- | :--- | :--- |
| **Syntax & Casts** | Non-canonical casts `(integer)`, `(boolean)`, `(double)`, `(binary)`; backtick operator `` `cmd` ``; `case` terminated by `;`; constant redeclaration | Use `(int)`, `(bool)`, `(float)`, `(string)`; `Illuminate\Support\Facades\Process` (array args); `case ...:` |
| **Strings, Arrays & Magic** | `null` as array offset or in `array_key_exists()`; `$str++` on non-numeric strings; `__sleep()`/`__wakeup()`; returning `null` from `__debugInfo()` | Use `""` key; `str_increment()`; `__serialize()`/`__unserialize()`; return `[]` |
| **PDO Driver APIs** | Driver-specific `PDO::MYSQL_ATTR_*`, `PDO::PGSQL_*`, `PDO::SQLITE_*` constants & `PDO::pgsql*()`/`PDO::sqlite*()` methods; `"uri:"` DSN | Use PHP 8.4+ `Pdo\Mysql`, `Pdo\Pgsql`, `Pdo\Sqlite` subclass constants & methods |
| **No-Op Close & Legacy** | `curl_close()`, `curl_share_close()`, `finfo_close()`, `imagedestroy()`, `xml_parser_free()`; `MHASH_*`; `DATE_RFC7231`; `mysqli_execute()`; `socket_set_timeout()`; `$http_response_header` | Drop no-op close calls (GC handles objects); `hash()`; convert to UTC before formatting (`$dt->setTimezone(new DateTimeZone('UTC'))->format('D, d M Y H:i:s \G\M\T')`); `mysqli_stmt_execute()`; `stream_set_timeout()`; `http_get_last_response_headers()` |
| **Reflection & SPL** | `Reflection*::setAccessible()`; `SplObjectStorage::{contains,attach,detach}()`; `ArrayObject`/`ArrayIterator` with objects; `chr()` outside `0..255`; `ord()` non-1-byte string | Remove `setAccessible()`; use `offsetExists`/`offsetSet`/`offsetUnset`; pass arrays; validate byte ranges |
| **Runtime & INI BC** | `disable_classes` removed; `zend_extension=opcache.so` warns (always built-in); `#[Attribute]` on abstract/interface/trait/enum is a compile error; traits bound before parent class; `PDO::FETCH_CLASS` constructor args follow `call_user_func_array`; `ArrayObject` rejects enums | Remove `disable_classes` & `zend_extension=opcache.so`; declare concrete attribute classes (or `#[DelayedTargetValidation]`); review `PDO::FETCH_CLASS` arg lists |

### 5.2 PHP 8.6.0 GA Deprecations & BC Changes

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

## 6. Anti-Hallucination & Version-Boundary Guard

Never emit the following syntax or misattribute versions:

- `clone $obj with (prop: $val)` → **Wrong** (use PHP 8.5 `clone($obj, ['prop' => $val])`).
- `if ((void) $fn())` → **ParseError** (PHP 8.5 `(void)` cast is a statement-only construct, not an expression).
- `str_replace(' ', '-', ?)` in PHP 8.5 → **Wrong** (PFA `?` placeholder shipped in **PHP 8.6.0**; use a parenthesized closure in PHP 8.5).
- `Uri\Rfc3986\UriBuilder` / `Uri\WhatWg\UrlBuilder` in PHP 8.5 → **Wrong** (`Uri`/`Url` shipped in PHP 8.5; `*Builder` shipped in **PHP 8.6.0**).
- `Pdo\Mysql`/`Pdo\Pgsql`/`Pdo\Sqlite` → introduced in **PHP 8.4** (driver methods/constants on base `PDO` deprecated in **PHP 8.5**).
- `BackedEnum::values()` → **Not in PHP 8.6** (under discussion; use `array_column(self::cases(), 'value')`).
- Pattern matching `is` operator (`$x is int`) → **Not in PHP 8.6** (under discussion; `is` identifier deprecated in prep).
- `let` block scoping (`let $x = 1`) → **Declined** (`let` identifier deprecated).
- Bound-erased generic types (`class Box<T>`) → **Declined** (use PHPStan `@template` generics).
- `Time\Instant` / `Time\Clock` → **Not in PHP 8.6** (under discussion; only `Time\Duration` & `Time\TimeException` shipped).
- Pipe assignment (`$x |>= trim(...)`) → **Declined**; `$this` PFA → **Under discussion**.
- `Duration::ofSeconds()` / `$duration->toIsoString()` / `JsonException::getOffset()` / `new Io\Poll()` → **Do not exist**.
