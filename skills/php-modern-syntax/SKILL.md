---
name: php-modern-syntax
description: Modern PHP 8.4 and PHP 8.5+ syntax reference, typing rules, and idiom guide. Use when writing, upgrading, or refactoring PHP code to leverage modern language features such as the pipe operator, clone-with, property hooks, asymmetric visibility, and enums.
---

# Modern PHP Syntax & Idioms Guide (PHP 8.4 – PHP 8.5+)

This skill covers the modern syntax features of **PHP 8.4** and **PHP 8.5+**, detailing how to build type-safe, expressive, and zero-boilerplate applications.

---

## 1. PHP 8.5+ Features & New Syntax

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

## 2. PHP 8.4 Features

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

## 3. Strong Typing, Enums & Pattern Matching

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
