---
name: php-modern-syntax
description: Modern PHP 8.4, PHP 8.5, and PHP 8.6+ syntax reference, typing rules, and idiom guide. Use when writing, upgrading, or refactoring PHP code to leverage modern language features such as Partial Function Application (PFA) with ?, clamp(), #[Override] on constants, Readonly property defaults, Time\Duration, pipe operator, clone-with, property hooks, and asymmetric visibility.
---

# Modern PHP Syntax & Idioms Guide (PHP 8.4 – PHP 8.6+)

This skill covers the modern syntax features of **PHP 8.4**, **PHP 8.5**, and **PHP 8.6+**, detailing how to build type-safe, expressive, and zero-boilerplate applications.

---

## 1. PHP 8.6+ Features & New Syntax

### Partial Function Application (PFA) with `?` Placeholder
Pre-fill specific arguments of any function or method using a question mark `?` placeholder, returning a lightweight closure for the remaining arguments. This pairs exceptionally well with first-class callables (`...`) and the pipe operator (`|>`):

```php
declare(strict_types=1);

// 1. Standalone partial application
$formatPrice = number_format(?, 2, '.', ',');
echo $formatPrice(1499.5); // "1,499.50"

// 2. Synergizing with the pipe operator (|>) without verbose closures
$rawTitle = '   Building Enterprise AI with Laravel 13 & PHP 8.6   ';

$slug = $rawTitle 
    |> trim(...) 
    |> str_replace(' ', '-', ?) 
    |> strtolower(...);

echo $slug; // "building-enterprise-ai-with-laravel-13-&-php-8.6"
```

### Native `clamp()` Function
Bound numbers within a declared minimum and maximum threshold without verbose `min(max(...))` or nested ternary expressions:

```php
// Standard clamping syntax: clamp(number, min, max)
$score = clamp(145, 0, 100); // 100
$discount = clamp(-5, 0, 50); // 0

// Production controller pagination bounds:
$perPage = clamp($request->integer('per_page', 15), min: 5, max: 100);
```

### Readonly Property Defaults
Readonly class properties are now permitted to have default initializers directly on property definitions, eliminating constructor boilerplate for optional immutable fields:

```php
final readonly class PaginationCriteria
{
    public int $page = 1;
    public int $perPage = 25;
    public string $sortBy = 'created_at';
    public string $sortOrder = 'desc';

    public function __construct(
        public string $search = '',
    ) {}
}

$criteria = new PaginationCriteria('billing');
echo $criteria->page; // 1
echo $criteria->sortBy; // "created_at"
```

### `#[Override]` Attribute on Class Constants
Extend compile-time interface and inheritance verification to class constants using the `#[Override]` attribute, ensuring base contracts are not broken:

```php
interface PaymentGatewayContract
{
    public const int DEFAULT_TIMEOUT_SECONDS = 30;
}

final class StripePaymentGateway implements PaymentGatewayContract
{
    #[\Override]
    public const int DEFAULT_TIMEOUT_SECONDS = 45;
}
```

### High-Performance Native Polling API (`Io\Poll`)
Modern replacement for legacy `stream_select()`. Leverages OS-native event multiplexing (`epoll` on Linux, `kqueue` on macOS/BSD, and `WSAPoll` on Windows) for $O(1)$ socket throughput in asynchronous workers, Octane servers, and daemon listeners:

```php
use Io\Poll;

$poll = new Poll();
$poll->add($socketResource, Poll::READ);

// Event loop waiting without O(n) select() degradation
$events = $poll->wait(timeoutMs: 1000);
```

### The `Time\Duration` Standard Class
Native standard library representation for precise elapsed time, ISO 8601 interval parsing, and nanosecond calculations:

```php
use Time\Duration;

$duration = Duration::ofSeconds(90);
echo $duration->toIsoString(); // "PT1M30S"

$total = $duration->add(Duration::ofMinutes(5));
echo $total->toSeconds(); // 390
```

### Enums `__debugInfo()` Support
Enums can now customize their debug output to mask sensitive backing data or inject telemetry when inspected via `var_dump()` or application loggers:

```php
enum ApiCredentialType: string
{
    case ProductionKey = 'prod_secret_998124';
    case SandboxKey = 'test_key_00129';

    public function __debugInfo(): array
    {
        return [
            'name' => $this->name,
            'masked_value' => substr($this->value, 0, 4) . '****',
        ];
    }
}
```

### Precise JSON Offset Error Tracking
`json_decode()` and `JsonException` now include the exact character location where a syntax failure occurred, speeding up API payload debugging:

```php
try {
    json_decode('{"name": "Laravel", invalid}', flags: JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    // Exact byte/character offset reported by the engine:
    echo $e->getOffset(); // 19
}
```

---

## 2. PHP 8.5+ Features & New Syntax

### The Native Pipe Operator (`|>`)
Chain sequential function calls from left to right cleanly without nested parentheses or temporary variables:

```php
<?php

declare(strict_types=1);

$rawInput = '   PHP 8.5 Release Overview   ';

// Left-to-right readable data pipeline
$slug = $rawInput 
    |> trim(...)
    |> (fn(string $str): string => str_replace(' ', '-', $str))
    |> strtolower(...);

echo $slug; // "php-8.5-release-overview"
```

### The Clone-With Syntax
Simplify the "with-er" pattern for immutable objects, DTOs, and value objects by cloning and updating properties in a single expression:

```php
final readonly class UserProfile
{
    public function __construct(
        public string $name,
        public string $email,
        public UserStatus $status,
    ) {}
}

$original = new UserProfile('Ada', 'ada@example.com', UserStatus::Pending);

// Clone with updated properties:
$activated = clone $original with (status: UserStatus::Active);

echo $activated->status->value; // "active"
echo $original->status->value;  // "pending" (immutability preserved)
```

### The `#[\NoDiscard]` Attribute
Instruct the engine and static analyzers (PHPStan) to flag code where the return value of a method or function is ignored:

```php
final class Money
{
    public function __construct(public readonly int $cents) {}

    #[\NoDiscard]
    public function add(self $other): self
    {
        return new self($this->cents + $other->cents);
    }
}

$a = new Money(100);
$b = new Money(50);

// Correct usage:
$c = $a->add($b);

// Static analysis warning if return value is discarded:
// $a->add($b); // Warning: Return value of add() with #[NoDiscard] must not be ignored
```

### Native Array Functions: `array_first()` & `array_last()`
Retrieve the first or last element of an array without resetting internal pointers:

```php
$items = ['alpha', 'beta', 'gamma'];

$first = array_first($items); // "alpha"
$last = array_last($items);   // "gamma"
```

### Native URI Standard Extension
A built-in extension conforming to RFC 3986 & WHATWG for robust URL manipulation:

```php
use Uri\Rfc3986\Uri;

$uri = new Uri('https://example.com:8080/path/to/resource?sort=asc#heading');
echo $uri->getHost(); // "example.com"
echo $uri->getPort(); // 8080
```

### Closures & First-Class Callables in Constant Expressions
Pass static closures and first-class callables inside attributes and parameter defaults:

```php
#[ValidationRule(filter: Sanitizer::clean(...))]
class UserInput {}
```

---

## 3. PHP 8.4 Features

### Property Hooks
Declare computed or validated properties directly on class fields, eliminating verbose getter and setter methods:

```php
final class Order
{
    public function __construct(
        public int $subtotal,
        public int $taxRate = 10,
    ) {}

    // Computed property hook (virtual)
    public int $total {
        get => $this->subtotal + (int) round(($this->subtotal * $this->taxRate) / 100);
    }

    // Backed property hook with validation
    public string $currency {
        get => $this->currency;
        set {
            $upper = strtoupper($value);
            if (! in_array($upper, ['USD', 'EUR', 'GBP'], true)) {
                throw new InvalidArgumentException("Unsupported currency: {$value}");
            }
            $this->currency = $upper;
        }
    }
}
```

### Asymmetric Visibility (`public private(set)`)
Control read and write access independently without writing getters:

```php
final class BankAccount
{
    public private(set) int $balanceInCents = 0;
    public private(set) ?DateTimeImmutable $lastDepositedAt = null;

    public function deposit(int $cents): void
    {
        if ($cents <= 0) {
            throw new InvalidArgumentException('Deposit must be positive');
        }
        $this->balanceInCents += $cents;
        $this->lastDepositedAt = new DateTimeImmutable();
    }
}

$account = new BankAccount();
echo $account->balanceInCents; // Allowed: 0
// $account->balanceInCents = 500; // Fatal error: Cannot modify private(set) property outside class
```

### Chaining Methods from New Without Parentheses
```php
// Modern:
$result = new RequestPipeline()->pipe($step1)->pipe($step2)->execute();

// Legacy:
// $result = (new RequestPipeline())->pipe($step1)->pipe($step2)->execute();
```

---

## 4. Strong Typing, Enums & Pattern Matching

### Backed Enums
```php
enum OrderStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function canCancel(): bool
    {
        return match ($this) {
            self::Pending, self::Processing => true,
            self::Completed, self::Cancelled => false,
        };
    }
}
```

### Disjunctive Normal Form (DNF) Types
Combine intersection and union types in method signatures:

```php
public function setAuditLogger((LoggerInterface&AuditableInterface)|null $logger): void
{
    $this->logger = $logger;
}
```
