---
name: laravel-performance-and-caching
description: High-performance caching, payload compression (igbinary, zstd), Stale-While-Revalidate (Cache::flexible), atomic lock concurrency, OPcache/JIT tuning, and refactoring messy procedural caching into clean repository decorators.
---

# Laravel 13 & PHP 8.5+ Performance & Enterprise Caching Skill

This skill guides the design, auditing, and refactoring of high-speed caching architectures in Laravel 13, including Redis payload compression, cache stampede defense, and refactoring messy procedural caching code into clean architectural patterns.

> 📖 **Master Specification**: For deep-dive benchmarks, OPcache/JIT settings, and Redis configuration, see **[docs/architecture/caching-and-performance.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/caching-and-performance.md)**.
> 🛡️ **Cache Failover, Lock Timeout Recovery & HTTP Cache Headers**: For Laravel 13 `failover` cache store (`redis -> database -> array`), `LockTimeoutException` handling, versioned multi-tenant keys, and HTTP `Cache-Control` / `ETag` resilience, see **`laravel-request-and-cache-handling`** and **[docs/architecture/request-and-cache-resilience.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/request-and-cache-resilience.md)**.

---

## 🚀 The 4 Pillars of Performance & Caching

```mermaid
flowchart LR
    Comp["1. Payload Compression<br/>(igbinary + zstd: -80% RAM)"] --> Flex["2. Stampede Defense<br/>(Cache::flexible & locks)"]
    Flex --> Dec["3. Clean Architecture<br/>(Cached Repository Decorator)"]
    Dec --> Tune["4. Execution Speed<br/>(OPcache, JIT, artisan cache)"]
```

---

## 1. Redis / Valkey Compression Configuration

To reduce Redis memory footprint by 70–85% and cut network I/O, configure binary serialization and Zstandard compression in `config/database.php`:

```php
// config/database.php
use Redis;

'redis' => [
    'client' => env('REDIS_CLIENT', 'phpredis'),

    'options' => [
        // igbinary serializer (50% smaller than PHP serialize)
        'serializer' => defined('Redis::SERIALIZER_IGBINARY') 
            ? Redis::SERIALIZER_IGBINARY 
            : Redis::SERIALIZER_PHP,

        // zstd compression (Zstandard algorithm)
        'compression' => defined('Redis::COMPRESSION_ZSTD') 
            ? Redis::COMPRESSION_ZSTD 
            : Redis::COMPRESSION_NONE,
        'compression_level' => 3,
    ],
    // ...
],
```

---

## 2. Eliminating Cache Stampedes: `Cache::flexible()`

Serve stale data instantly to users while refreshing the cache asynchronously in the background:

```php
use App\Models\Product;
use Illuminate\Support\Facades\Cache;

#[\NoDiscard]
public function getTrendingProducts(): array
{
    // [Fresh TTL: 5 min, Stale Grace Window: 30 min]
    return Cache::flexible('products:trending', [300, 1800], function (): array {
        return Product::query()
            ->with(['category', 'tags'])
            ->orderByDesc('sales_count')
            ->limit(20)
            ->get()
            ->toArray();
    });
}
```

---

## 3. Atomic Locks for Expensive Operations

Prevent concurrent worker stampedes on heavy computations:

```php
use Illuminate\Support\Facades\Cache;

public function generateAnalyticsDigest(): ReportDto
{
    return Cache::lock('locks:analytics_digest', 10)->block(5, function (): ReportDto {
        return Cache::remember('reports:analytics_digest', 3600, function (): ReportDto {
            return $this->computeExpensiveAnalytics();
        });
    });
}
```

---

## 4. Refactoring Messy Caching into Clean Decorators

Never clutter controllers with inline `Cache::get()` and `Cache::put()`. Use the **Cached Repository Decorator**:

### A. The Contract
```php
namespace App\Contracts;

use App\Models\Article;

interface ArticleRepositoryInterface
{
    public function findBySlug(string $slug): ?Article;
}
```

### B. The Cached Decorator
```php
namespace App\Repositories;

use App\Contracts\ArticleRepositoryInterface;
use App\Models\Article;
use Illuminate\Support\Facades\Cache;

final readonly class CachedArticleRepository implements ArticleRepositoryInterface
{
    public function __construct(
        private ArticleRepositoryInterface $inner,
        private int $ttl = 3600,
    ) {}

    public function findBySlug(string $slug): ?Article
    {
        return Cache::remember("articles:slug:{$slug}", $this->ttl, function () use ($slug): ?Article {
            return $this->inner->findBySlug($slug);
        });
    }
}
```

### C. Clean Service Provider Registration
```php
// app/Providers/AppServiceProvider.php
public function register(): void
{
    $this->app->bind(ArticleRepositoryInterface::class, function () {
        return new CachedArticleRepository(
            inner: new DatabaseArticleRepository(),
            ttl: 3600,
        );
    });
}
```

---

## 5. Production Optimization Commands

Run these commands during every deployment:

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
composer dump-autoload -o --classmap-authoritative
```
