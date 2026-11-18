---
name: laravel-eloquent-orm
description: Master guide to Laravel 13 Eloquent ORM: native PHP attribute declarations, custom query builders with PHPStan generic types, method-based casts, vector similarity search, and high-performance eager loading.
---

# Laravel 13 Eloquent ORM Guide (PHP 8.5+)

Laravel 13 pairs the Eloquent ORM with native PHP 8 attributes, custom query builders, method-based casts, PHPStan generic types, and first-party vector search.

---

## 1. Modern Model Definition with Attributes

Declare model metadata using native PHP 8 `#[Attribute]` syntax rather than legacy protected properties:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use App\Builders\ArticleQueryBuilder;
use App\Enums\ArticleStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\UseEloquentBuilder;
use Illuminate\Database\Eloquent\Casts\AsFluent;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Table('articles')]
#[Fillable(['title', 'slug', 'body', 'metadata', 'status', 'published_at', 'author_id'])]
#[Hidden(['internal_notes'])]
#[UseEloquentBuilder(ArticleQueryBuilder::class)]
class Article extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * Method-based casts declaration.
     *
     * @return array<string, string|class-string>
     */
    protected function casts(): array
    {
        return [
            'status' => ArticleStatus::class,
            'metadata' => AsFluent::class,
            'published_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * @return HasMany<Comment, $this>
     */
    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }
}
```

---

## 2. Type-Safe Custom Query Builders (PHPStan Level 8)

Extract scopes into dedicated Builder classes with PHPStan `@extends` generics:

```php
<?php

declare(strict_types=1);

namespace App\Builders;

use App\Enums\ArticleStatus;
use App\Models\Article;
use Illuminate\Database\Eloquent\Builder;

/**
 * @extends Builder<Article>
 */
final class ArticleQueryBuilder extends Builder
{
    #[\NoDiscard]
    public function published(): self
    {
        return $this->where('status', ArticleStatus::Published)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    #[\NoDiscard]
    public function byAuthor(string $authorId): self
    {
        return $this->where('author_id', $authorId);
    }

    #[\NoDiscard]
    public function popular(int $minComments = 10): self
    {
        return $this->has('comments', '>=', $minComments);
    }
}
```

---

## 3. Strict Eager Loading & Preventing N+1 Bottlenecks

### Global Enforcement
Enable strict mode in `app/Providers/AppServiceProvider.php` to fail loudly during tests or development when lazy loading is attempted:

```php
public function boot(): void
{
    Model::preventLazyLoading(! app()->isProduction());
}
```

### Eager Loading Relations & Existence Checks
```php
// Eager load with constraint callback
$articles = Article::query()
    ->published()
    ->with([
        'author:id,name,email',
        'comments' => fn($query) => $query->latest()->limit(5),
    ])
    // Efficiently query existence without loading relation rows
    ->withExists('comments as has_comments')
    // Count relations via single subquery
    ->withCount('comments')
    ->paginate(20);
```

---

## 4. Vector & Semantic Search in Laravel 13

Laravel 13 provides native query builder methods for AI embeddings and vector indexes (such as PostgreSQL `pgvector`):

```php
use App\Models\Document;

/** @var array<int, float> $queryEmbedding */
$similarDocuments = Document::query()
    ->whereVectorSimilarTo('embedding', $queryEmbedding, threshold: 0.85)
    ->with(['author:id,name'])
    ->limit(5)
    ->get();
```

---

## 5. Memory-Safe Dataset Processing

Never use unbounded `get()` queries on production tables:

```php
// 1. chunkById for atomic, indexed batches
Article::query()
    ->where('status', ArticleStatus::Draft)
    ->chunkById(250, function ($articles): void {
        foreach ($articles as $article) {
            // Process batch
        }
    });

// 2. cursor() for generator-based memory streaming
foreach (Article::query()->cursor() as $article) {
    // Streams records one by one with minimal memory allocation
}
```
