# Laravel 13 & Modern PHP 8.5+ Engineering Guidelines

These rules govern all PHP and Laravel code written, reviewed, or refactored when this plugin is active. Adhere to these standards strictly without exception.

---

## 1. Strict Typing & Modern PHP 8.5+ Syntax Standards

- **Strict Types**: Always place `declare(strict_types=1);` at the very top of every PHP file without exception.
- **Namespaces & Imports**:
  - Namespace must strictly match the directory path under `app/` (PSR-4).
  - Explicitly import all standard PHP root classes (`use DateTimeImmutable;`, `use Exception;`, `use Throwable;`, `use InvalidArgumentException;`). NEVER use inline leading backslashes (e.g. `\DateTimeImmutable`) in class bodies or signatures.
  - Organize imports into single-line statements (never grouped curly braces `use Foo\{Bar, Baz}`). Order imports: (1) classes/interfaces/traits, (2) functions (`use function`), (3) constants (`use const`), sorted alphabetically within each group.
  - Use `as` aliasing strictly to resolve short name collisions. Remove all unused imports.
- **Class Anatomy & Architecture**:
  - Mark classes `final` by default (except abstract bases and Eloquent models requiring inheritance).
  - Use `final readonly class` for immutable DTOs and Value Objects.
  - Follow canonical member ordering: (1) Traits, (2) Constants, (3) Properties (static, public/asymmetric, protected, private), (4) Constructor with promoted properties, (5) Framework hooks, (6) Magic methods, (7) Public API methods, (8) Private implementation methods.
- **PHP 8.4 Property Hooks**: Use property hooks (`get => ...; set => ...;`) for computed, formatted, or validated properties instead of boilerplate getter and setter methods.
- **PHP 8.4 Asymmetric Visibility**: Utilize `public private(set)` or `protected private(set)` for properties that need public read access but restricted write access, eliminating boilerplate getters.
- **PHP 8.5 Pipe Operator (`|>`)**: Use the native pipe operator for sequential data transformations and pipelines:
  ```php
  $slug = $title |> trim(...) 
                |> (fn(string $s): string => str_replace(' ', '-', $s)) 
                |> strtolower(...);
  ```
- **PHP 8.5 Clone-With Syntax**: Use `clone $obj with (...)` for immutable DTOs and value objects when modifying state:
  ```php
  $updatedUser = clone $user with (status: UserStatus::Active);
  ```
- **PHP 8.5 `#[NoDiscard]` Attribute**: Mark methods and functions whose return values must never be ignored (e.g., calculations, builders, status checks) with `#[\NoDiscard]`.
- **PHP 8.5 Native Array Helpers**: Prefer native `array_first($items)` and `array_last($items)` over manual pointer manipulations.
- **PHP 8.4+ Instantiation**: Chain directly onto new instances without wrapping parentheses: `new Service()->process()`.
- **Constructor Property Promotion**: Always promote constructor parameters with explicit visibility, types, and `readonly` where appropriate:
  ```php
  public function __construct(
      private readonly PaymentGateway $gateway,
      private readonly LoggerInterface $logger,
  ) {}
  ```
- **Enums**: Replace magic strings and constants with backed enums (e.g., `enum OrderStatus: string { case Pending = 'pending'; }`).
- **Match Expressions**: Always prefer `match` expressions over `switch` statements for cleaner, type-safe condition handling.
- **Trailing Commas & Callables**: Always use trailing commas in multi-line parameter lists, arrays, and arguments. Use first-class callable syntax: `array_map(strtoupper(...), $items)`.

---

## 2. Laravel 13 Architecture: Thin Controllers, Form Requests & Resources

- **Thin Controllers (Strict Rule)**:
  - Controllers must NEVER contain business logic, database queries, or inline validation.
  - Limit controller actions to: (1) unpacking request data, (2) invoking a dedicated Action/Service class, and (3) returning an API Resource or View.
  - Strongly prefer Single Action / Invokable Controllers (`__invoke`). Resource controllers must strictly use the 7 canonical verbs (`index`, `create`, `store`, `show`, `edit`, `update`, `destroy`); never add custom action verbs (extract to separate invokables).
- **Mandatory Form Requests**:
  - NEVER call `$request->validate()` or `Validator::make()` inline inside controller methods.
  - ALWAYS generate and inject a dedicated Form Request (`app/Http/Requests`) implementing:
    - `authorize(): bool` (enforcing authorization gates/policies)
    - `rules(): array` (declaring explicit validation rules)
    - Strongly typed helper methods or DTO transformation (`toDto()`).
- **API Resources Required**:
  - NEVER return raw Eloquent models, collections, or unmapped arrays from API endpoints.
  - ALWAYS transform API output using `JsonResource` or `ResourceCollection`.
- **Lean Skeleton & Middleware (`bootstrap/app.php`)**:
  - Never generate or rely on legacy `app/Http/Kernel.php`, `app/Console/Kernel.php`, or `app/Exceptions/Handler.php`.
  - Configure routes, middleware (append, prepend, aliases, priority), and exception handling inside `bootstrap/app.php` using the Fluent Application Builder.
  - Non-blocking tasks (analytics, audit logging) must use Terminable Middleware (`terminate()`) to eliminate user-facing latency.
- **Support Utilities over Global Helpers**:
  - NEVER dump procedural functions in an uncontrolled global `helpers.php` file.
  - ALWAYS use static pure utilities in `app/Support/` or immutable Value Objects in `app/Data/`.

---

## 3. Routes & Endpoint Design

- **Strict Naming Conventions**:
  All routes and endpoints must adhere strictly to these conventions:
  | Component | Convention | Example |
  | :--- | :--- | :--- |
  | **URL** | `kebab-case` | `/user-profiles` |
  | **Route name** | `dot notation` | `admin.users.index` |
  | **Controller** | `PascalCase` | `UserController` |
  | **Controller method** | `camelCase` | `showProfile()` or `__invoke` |
  | **Resource** | `plural noun` | `users` |
  | **Route parameter** | `singular` | `{user}` |
  | **API version** | `URL versioning` | `/api/v1/users` |

- **Explicit Controller References**: Always reference controller classes directly (`Route::post('/articles', StoreArticleController::class)`). Never use legacy string-based controller routes.
- **Route Model Binding**: Use custom keys where appropriate (e.g., `{article:slug}`) to prevent direct ID exposure.
- **Route Grouping**: Group endpoints logically with `prefix()`, `name()`, and scoped middleware (`throttle:60,1`, `auth:sanctum`).
- **Health & Inspection**: Register health endpoints in `bootstrap/app.php` using `health: '/up'`.

---

## 4. RESTful API Design & Serialization

- **Strict HTTP Semantics**:
  - `POST` creates resource $\rightarrow$ returns `201 Created` with `Location` header.
  - `PUT`/`PATCH` updates resource $\rightarrow$ returns `200 OK`.
  - `DELETE` deletes resource $\rightarrow$ returns `204 No Content` with empty body.
  - Validation failure $\rightarrow$ returns `422 Unprocessable Entity` with RFC 7807 problem details or structured error envelope.
- **Mandatory JsonResource Wrapping**:
  - Prohibit returning raw Eloquent models, collections, or untyped arrays from API endpoints.
  - Use conditional relationship loading (`$this->whenLoaded('relation')`) to strictly prevent N+1 database queries.
  - Standardize all date and timestamp serialization to ISO-8601 strings (`$this->created_at->toISOString()`).
- **Shallow Route Hierarchy**:
  - Limit nested routes to at most 1 level deep (e.g., `/api/v1/articles/{article}/comments`). Never nest beyond 1 level; expose child mutation endpoints at the top level (e.g., `/api/v1/comments/{comment}`).
- **Authentication & Token Scopes**:
  - Secure API endpoints using Laravel Sanctum with fine-grained token abilities (`ability:orders:create`).
- **Idempotency & Rate Limiting**:
  - Protect sensitive creation/payment endpoints with `Idempotency-Key` headers.
  - Apply tiered rate limits via `RateLimiter::for('api', ...)` with burst defense (`Limit::perSecond()`).

---

## 5. Eloquent Models: PHP 8 Attributes & Generics

- **Attribute-Based Declarations**:
  Declare model configuration using native PHP 8 attributes:
  ```php
  namespace App\Models;

  use Illuminate\Database\Eloquent\Model;
  use Illuminate\Database\Eloquent\Attributes\Table;
  use Illuminate\Database\Eloquent\Attributes\Fillable;
  use Illuminate\Database\Eloquent\Attributes\Hidden;
  use Illuminate\Database\Eloquent\Attributes\UseEloquentBuilder;
  use App\Builders\UserQueryBuilder;

  #[Table('users')]
  #[Fillable(['name', 'email', 'password', 'status'])]
  #[Hidden(['password', 'remember_token'])]
  #[UseEloquentBuilder(UserQueryBuilder::class)]
  class User extends Model
  {
      // ...
  }
  ```
- **Method-Based Casts**:
  - Declare attribute casting inside the `casts(): array` method using modern cast classes (`AsFluent::class`, backed enums, `hashed`, etc.).
- **Custom Query Builders**:
  - Encapsulate scopes and complex queries inside dedicated Eloquent Builder classes bound with `#[UseEloquentBuilder(CustomBuilder::class)]`.
- **Relationships**:
  - Explicitly type relationship return values (`BelongsTo`, `HasMany`, `BelongsToMany`, `MorphMany`, etc.) and annotate with PHPStan generics.
- **Vector & Semantic Search**:
  - Utilize Laravel 13's native vector similarity search (`whereVectorSimilarTo`) for AI embeddings and similarity queries.

---

## 6. Database Migrations

- **Anonymous Migrations**: Always declare migrations as `return new class extends Migration { ... };`.
- **Typed Signatures**: Specify `Blueprint $table` and `: void` on `up()` and `down()` methods.
- **Modern Key Types**: Use ULIDs (`$table->ulid('id')->primary();`) or UUIDs (`$table->uuid('id')->primary();`) for modern distributed services; use `$table->id();` for auto-incrementing integers.
- **Foreign Keys**: Always declare explicit cascades and target tables: `$table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();`.
- **Indexes**: Index columns frequently queried in `where`, `orderBy`, or join clauses (e.g., status, published_at, foreign keys).

---

## 7. Factories & Seeders

- **Model Factories**:
  - Annotate with `@extends Factory<ModelName>`.
  - Provide realistic defaults with modern `fake()` helpers.
  - Define explicit state methods (`published()`, `draft()`, `admin()`) returning `static`.
- **Seeders**:
  - Make seeders idempotent using `firstOrCreate()`, `updateOrCreate()`, or `upsert()`.
  - Avoid executing database queries in loops; generate batches using Factory counts (`Article::factory()->count(20)->create()`).

---

## 8. Strict Eager Loading (No N+1 Queries)

- NEVER access relationships inside loops without eager loading.
- ALWAYS use `with()` or `loadMissing()` for relationships.
- Use `withExists()` instead of `whereHas()` when only checking relationship existence.
- Use `withCount()` instead of loading collections just to count related items.
- Enforce `Model::preventLazyLoading(!app()->isProduction())` and `Model::preventSilentlyDiscardingAttributes(!app()->isProduction())` in `AppServiceProvider::boot()`.
- Use `chunkById()` or `cursor()` for large datasets.

---

## 9. PHPStan & Larastan Static Analysis (Level 8 / Max)

All generated code must be fully compliant with PHPStan / Larastan at Level 8 or `max`:

- **Complete Type Declarations**:
  - Every method parameter, return type, and class property must have a native type declaration.
  - Do not use `mixed` unless strictly unavoidable; handle nullable types (`?Type` or `Type|null`) explicitly.
- **Generic Type Annotations**:
  - Eloquent Builder classes must specify generic model types:
    ```php
    /**
     * @extends \Illuminate\Database\Eloquent\Builder<\App\Models\User>
     */
    final class UserQueryBuilder extends Builder
    ```
  - Eloquent Relationships must specify related model and owner types:
    ```php
    /**
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<\App\Models\Order, $this>
     */
    public function orders(): HasMany
    ```
  - Collections and array shapes must specify element types or exact keys:
    ```php
    /**
     * @param \Illuminate\Support\Collection<int, \App\Models\Order> $orders
     * @return array{total_cents: int, currency: string}
     */
    ```
- **Form Request Validated Data**:
  - Use typed helper methods or DTO mapping (`toDto()`) rather than treating `$request->validated()` as untyped arrays.
  - Guard `$request->user()` with assertions or null checks (`$user = $request->userOrFail()`).
- **Strict Error Handling & Null Safety**:
  - Check for falsy / null returns from `find()`, `first()`, `auth()->user()`, or use `findOrFail()` / `firstOrFail()`.
  - Never call methods on potentially null models without explicit null guards.

---

## 10. Queues, Caching & Events

- **Queue Configuration Attributes**:
  - Declare queue settings on Job classes using the `#[WithQueue]` attribute:
    ```php
    #[WithQueue(connection: 'redis', queue: 'notifications', tries: 3, timeout: 60)]
    final class SendWelcomeEmail implements ShouldQueue
    {
        use Queueable;
    }
    ```
- **Atomic Caching & TTL Management**:
  - Utilize `Cache::touch($key, $ttl)` to refresh expiration times without deserializing and rewriting payloads.
  - Use `Cache::lock($name, $seconds)->get(fn() => ...)` or `->block(...)` for atomic operations to prevent race conditions.
  - Use `Cache::flexible($key, [$freshTtl, $staleTtl], fn() => ...)` for read-heavy cache keys to prevent cache stampedes.
- **Cache Compression & Clean Separation**:
  - Enable `igbinary` serializer and `zstd` compression in `config/database.php` for Redis/Valkey caches.
  - NEVER litter HTTP controllers with inline `Cache::get()` and `Cache::put()`. ALWAYS encapsulate caching behind Cached Repository Decorators or dedicated domain Actions.

---

## 11. Testing with Pest 3

- Use Pest 3 as the primary test framework.
- Always include architectural boundary enforcement tests:
  ```php
  arch('controllers are invokable and thin')
      ->expect('App\Http\Controllers')
      ->toHaveSuffix('Controller')
      ->toBeInvokable();

  arch('models extend eloquent')
      ->expect('App\Models')
      ->toExtend('Illuminate\Database\Eloquent\Model');
  ```

---

## 12. Memory Safety & Resource Management

- **Streaming & Bulk Processing**:
  - NEVER execute unbounded `Model::all()` or `$query->get()` in batch jobs, commands, or data exports.
  - ALWAYS use `cursor()` (for read-only streaming via PDO generators) or `chunkById(1000)` (for record mutations). NEVER use `chunk()` when updating query criteria (prevents the page shifting bug).
  - Explicitly call `DB::disableQueryLog()` in long-running CLI commands, queue jobs, and seeders to prevent memory bloat.
- **Octane & Long-Running Daemon Safety**:
  - NEVER store request-scoped or user-specific state in static properties or singleton services.
  - Use `WeakMap` or `WeakReference` for in-memory object caches to allow automatic garbage collection.
- **File & Export Memory Safety**:
  - NEVER read multi-megabyte files into memory using `file_get_contents()`. Always stream using `fopen()`, `fgetcsv()`, or `fgets()`.
  - Export large datasets using `response()->streamDownload()` piping directly into `php://output`.
- **Cyclic Garbage Collection**:
  - In batch loops exceeding 5,000 items, break circular object references and invoke `gc_collect_cycles()` and `gc_mem_caches()`.
  - Enforce worker restart limits: `queue:work --max-jobs=1000 --max-time=3600 --memory=512`.

---

## 13. Security Hardening & Vulnerability Prevention

- **SQL Injection Defense**:
  - NEVER interpolate variables into raw queries (`DB::raw()`, `whereRaw()`). ALWAYS use PDO parameter bindings (`whereRaw('status = ?', [$status])`).
  - Dynamic `orderBy()` columns must ALWAYS be validated against a strict hardcoded whitelist array.
- **Access Control & IDOR Prevention**:
  - ALWAYS apply `->scopeBindings()` on nested route parameters to prevent cross-tenant record tampering.
  - Mandate explicit Policy authorization (`$user->can(...)` or `$this->authorize(...)`) in Form Requests or Actions before any mutation.
- **Constant-Time Cryptography**:
  - ALWAYS compare signatures, HMACs, and auth tokens using `hash_equals()`. NEVER use `===` or `strcmp()` for cryptographic verification (prevents timing side-channel attacks).
- **SSRF (Server-Side Request Forgery) Defense**:
  - When fetching user-provided URLs, ALWAYS resolve the hostname and reject private/reserved IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`, `169.254.169.254`).
- **File Upload Hardening & RCE Defense**:
  - NEVER trust client-reported file extensions or MIME types. ALWAYS inspect binary Magic Bytes via `finfo_file()`.
  - Store uploaded files on private disks outside the web root (`storage/app/private/`) using cryptographically randomized filenames (`Str::random(40)`).
- **Strict Model Invariants & Deserialization**:
  - Enable `Model::preventSilentlyDiscardingAttributes(!app()->isProduction())` in `AppServiceProvider`.
  - NEVER call `unserialize()` on untrusted input; use `json_decode()` with `JSON_THROW_ON_ERROR`.

---

## 14. Laravel AI SDK (`laravel/ai`) & Autonomous Agent Architecture

All AI features must adhere strictly to Laravel's official first-party AI SDK standards (`composer require laravel/ai`):

- **Dedicated Agent Architecture (Prompts & Instructions)**:
  - Encapsulate AI prompts and behaviors inside dedicated Agent classes (`app/Ai/Agents/`) implementing `Laravel\Ai\Contracts\Agent` using the `Promptable` trait.
  - NEVER hardcode inline prompt strings or raw vendor API cURL requests inside HTTP controllers.
  - Isolate system prompt guardrails in `instructions(): string`.
- **Conversational Memory & Context Scoping**:
  - Implement `Laravel\Ai\Contracts\Conversational` and use `Laravel\Ai\Concerns\RemembersConversations` for multi-turn chats.
  - ALWAYS explicitly scope conversation keys to specific user/team/model entities (`conversationKey(): string`) to prevent cross-tenant conversation context leakage.
- **Application & Provider Tools**:
  - Encapsulate internal tool actions in `app/Ai/Tools/` implementing `Laravel\Ai\Contracts\Tool`.
  - ALWAYS declare explicit typed parameter constraints in `schema(JsonSchema $schema)` and validate inputs before invoking internal models/services in `handle(Request $request)`.
  - Leverage cloud provider tools (`Laravel\Ai\Providers\Tools\WebSearch`, `FileSearch`, `CodeExecution`) for external operations rather than building custom scrapers.
- **Mandatory Structured Outputs**:
  - NEVER parse freeform model text with regular expressions.
  - Implement `Laravel\Ai\Concerns\HasStructuredOutput` with a strict `schema(JsonSchema $schema)` and ALWAYS hydrate the resulting payload into an immutable PHP 8.5+ DTO (`final readonly class`) with complete PHPStan typing.
- **Real-Time Streaming Standards**:
  - Interactive user chat endpoints MUST stream tokens incrementally using `(new Agent)->stream()` via Server-Sent Events (SSE) or Livewire `wire:stream`.
  - Disable web server response buffering (`X-Accel-Buffering: no`) on streaming responses.
- **Asynchronous Execution & Rate Limit Resilience**:
  - Non-streaming or batch AI workflows MUST run in queued background jobs (`#[WithQueue(connection: 'redis', queue: 'ai-processing')]`).
  - Declare exponential backoff (`backoff(): array = [10, 30, 90]`) to gracefully recover from HTTP 429 rate limits.
  - Broadcast intermediate agent execution steps to frontend clients using Laravel Echo events (`broadcast()`).
- **Multimodal Attachments & Safety**:
  - Pass files and media via `Laravel\Ai\Files` (`Image`, `Document`, `Audio`).
  - ALWAYS verify file magic bytes and MIME types before passing user-uploaded files as attachments.
- **Prompt Injection Defense & Boundaries**:
  - ALWAYS isolate untrusted user text inside XML boundary tags (`<user_input>...</user_input>`).
  - Strip boundary escape sequences (`</user_input>`) and non-printable control characters via a dedicated sanitizer before executing prompts.
  - Explicitly instruct the agent in `instructions()` to treat content within boundary tags strictly as passive data, never as commands.
- **Deterministic Testing with SDK Fakes**:
  - Automated tests MUST NEVER invoke live external AI provider endpoints.
  - ALWAYS use `Agent::fake([...])->preventStrayPrompts()` and assert invocations using `Agent::assertPrompted(...)`.

---

## 15. Model Context Protocol (MCP) Architecture & Security

All Model Context Protocol servers and client integrations must adhere strictly to official `laravel/mcp` standards:

- **Canonical Directory Organization**:
  - Place all MCP components strictly under `app/Mcp/`:
    - `app/Mcp/Servers/` for Server coordinators extending `Laravel\Mcp\Server`.
    - `app/Mcp/Tools/` for executable action classes extending `Laravel\Mcp\Server\Tool`.
    - `app/Mcp/Resources/` for read-only data classes extending `Laravel\Mcp\Server\Resource`.
    - `app/Mcp/Prompts/` for reusable template classes extending `Laravel\Mcp\Server\Prompt`.
- **Web Routing & Transport Standards**:
  - Expose web-facing MCP endpoints exclusively in `routes/ai.php` using `Mcp::web('/mcp/...', ServerClass::class)`.
  - Stdio transport for local development or desktop IDEs (Cursor, Claude Desktop, Antigravity) must run via `php artisan mcp:serve <ServerName>`.
- **Strict Parameter Schemas**:
  - Every Tool and Prompt MUST define explicit, typed parameters in `schema(JsonSchema $schema)`.
  - NEVER accept untyped or loose parameter arrays; declare descriptions, types, and required fields.
- **Zero-Trust Security & Authentication**:
  - NEVER expose unauthenticated public MCP web endpoints.
  - ALWAYS protect `routes/ai.php` web routes with `auth:sanctum` or `auth:api` and explicit ability middleware (`ability:mcp:execute`).
  - Apply tiered rate limiting (`throttle:60,1`) on all MCP route groups.
- **IDOR Defense & Multi-Tenant Isolation**:
  - NEVER execute queries based solely on client-provided IDs.
  - ALWAYS verify tenant boundaries and Policy authorization (`$user->can('view', $model)` or `$user->can('update', $model)`) inside `read()` and `handle()` methods before returning data or mutating records.
- **Separation of Read vs Mutation**:
  - Use **Resources** (`read()`) strictly for non-mutating data retrieval and telemetry.
  - Use **Tools** (`handle()`) for side effects, and ALWAYS require client `idempotency_key` strings on financial or state-altering mutations.
- **Deterministic MCP Testing**:
  - Test tools and resources using `Mcp::server(ServerClass::class)->callTool(...)` and `->readResource(...)` in Pest 3 suites without network requests.

---

## 16. Console Commands & Task Scheduling (`routes/console.php`)

All Artisan CLI commands and automated schedules must adhere to these standards:

- **Command Naming & Attributes**:
  - Command names must follow `noun:verb` colon-separated convention (e.g. `catalog:sync`, `orders:prune`).
  - Declare command identity using `#[AsCommand(name: '...', description: '...')]` attribute.
- **Concurrency Isolation & Overlap Defense**:
  - Commands scheduled on recurring intervals MUST implement `Illuminate\Contracts\Console\Isolatable` with an explicit `$isolationLockExpiresAt` property to eliminate race conditions and deadlocks caused by overlapping executions.
- **Memory Safety & Batch Protection**:
  - Long-running batch commands MUST invoke `DB::disableQueryLog()` immediately upon entry to prevent fatal Out of Memory (OOM) crashes.
  - Stream records using `$query->cursor()` for read-only iterations or `$query->chunkById()` for mutations. NEVER execute unbounded `Model::all()` or `$query->get()`.
- **Modern Interactive UX**:
  - ALWAYS use `laravel/prompts` functions (`text`, `select`, `confirm`, `spin`, `progress`, `table`) for terminal interaction.
  - Guard interactive prompts with `app()->isProduction() && ! $this->option('no-interaction')` checks.
- **Strict Exit Codes**:
  - The `handle()` method MUST return an explicit integer exit code: `self::SUCCESS` (0), `self::FAILURE` (1), or `self::INVALID` (2).
- **Centralized Scheduling (`routes/console.php`)**:
  - Define all recurring schedules in `routes/console.php` using the fluent `Schedule` facade.
  - Always enforce `->onOneServer()` for multi-server clusters and `->withoutOverlapping()`.

---

## 17. Database Transactions, Concurrency & Deadlock Resilience

All multi-record state mutations and high-contention business actions must adhere to these standards:

- **ACID Transaction Boundaries & Deadlock Retries**:
  - ALWAYS wrap multi-table or multi-row state mutations in `DB::transaction(fn () => ..., attempts: 3)`.
  - Provide at least 3 attempts to allow automatic recovery from transient database deadlock exceptions (`1213` in MySQL, `40P01` in Postgres).
- **Pessimistic Locking on Shared State**:
  - ALWAYS acquire exclusive row locks (`lockForUpdate()`) when reading balances, stock counters, or status fields that will be mutated within the transaction.
  - When locking multiple rows, ALWAYS sort IDs in canonical order (`sort($ids)`) before querying to eliminate symmetrical lock-order deadlocks.
- **Strict HTTP Prohibition Inside Transactions**:
  - NEVER execute external HTTP API calls (Stripe, Twilio, Webhooks, AI SDK calls) inside a database transaction.
  - Pre-fetch external data before opening the transaction, and dispatch outgoing API calls in background queue jobs.
- **Post-Commit Event & Queue Safety**:
  - NEVER dispatch events or queue jobs directly inside transactions that rely on the committed database state.
  - ALWAYS use `DB::afterCommit(fn () => ...)` or implement `Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit` on queued listeners to prevent race conditions where workers query uncommitted rows.

---

## 18. Modern Frontend Architecture (Blade, Livewire, Inertia.js, Vue, React, Svelte & Vite)

All frontend templates, components, and client-side single-page applications must adhere strictly to these enterprise standards:

- **Blade Component Architecture**:
  - Author atomic, reusable UI primitives in `resources/views/components/` with explicit `@props` parameter contracts.
  - Always merge caller attributes with internal defaults using `$attributes->class([...])`.
  - NEVER interpolate raw unescaped input into templates; use `{{ ... }}` for automatic HTML escaping and restrict `{!! ... !!}` strictly to sanitized markdown or trusted inline SVG icons.
- **Livewire (v3 & v4) Reactive Security & Performance**:
  - ALWAYS protect sensitive database IDs, tenant keys, and internal state using the `#[Locked]` attribute to prevent client-side tampering via DOM manipulation or network requests.
  - Encapsulate multi-field forms in dedicated `Livewire\Form` classes (`app/Livewire/Forms/`) implementing explicit `#[Validate]` attributes.
  - Cache heavy queries using `#[Computed(persist: true)]`, and defer slow dashboard widgets using `#[Lazy]` with a dedicated `placeholder()` skeleton view.
  - Stream LLM tokens incrementally to the DOM using Livewire's `$this->stream()` targeting elements marked with `wire:stream` when integrating with `laravel/ai`.
  - Reserve Livewire for server-dependent state; use **Alpine.js** (`x-data`, `x-show`, `x-transition`) for purely client-side micro-interactions (dropdowns, dialogs, tabs).
- **Inertia.js v2 Single-Page Applications (Vue 3, React, Svelte 5)**:
  - NEVER return raw Eloquent models or unmapped collections from Inertia controllers. ALWAYS transform data using `JsonResource` or dedicated DTOs to prevent sensitive model attributes from leaking into client page props.
  - Wrap queries taking longer than 100ms in **Deferred Props** (`Inertia::defer(fn () => ...)`) and hydrate on the client using `<Deferred data="...">` with fallback loading skeletons.
  - Author Vue 3 components with `<script setup lang="ts">` and React 19/18 with TypeScript JSX, enforcing explicit typed interface declarations for all page props.
  - Author Svelte 5 components using modern Runes (`let { prop }: Props = $props();`, `$state()`, `$derived()`) instead of legacy `export let` statements.
  - Manage form interactions using Inertia's native `useForm()` hook for client-side dirty state tracking, automatic validation error mapping, and file uploads.
- **Vite & Frontend Testing Standards**:
  - Configure `vite.config.ts` using `laravel-vite-plugin` with SSR entries (`resources/js/ssr.ts`) and path aliases (`@ -> /resources/js`).
  - Test Livewire components with Pest 3 using `Livewire::test()` verifying computed properties, action execution, validation errors, and locked property security exceptions.
  - Test Inertia endpoints with Pest 3 using `assertInertia(fn (AssertableInertia $page) => ...)` asserting component names, typed prop structures, and deferred groups.

