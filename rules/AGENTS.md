# Laravel 13 & Modern PHP 8.6+ Engineering Guidelines

These rules govern all PHP and Laravel code written, reviewed, or refactored when this plugin is active. Adhere to these standards strictly without exception.

---

## 1. Strict Typing & Modern PHP 8.6+ Syntax Standards

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
- **PHP 8.6 Partial Function Application (PFA)**: Use `?` placeholders with first-class callables and the pipe operator (`|>`) for clean, closure-free data transformations:
  ```php
  $slug = $title |> trim(...) 
                |> str_replace(' ', '-', ?) 
                |> strtolower(...);
  ```
- **PHP 8.6 Native `clamp()` Function**: Use native `clamp($value, $min, $max)` for bounding numbers, metrics, and pagination limits instead of legacy `min(max(...))` boilerplate:
  ```php
  $perPage = clamp($request->integer('per_page', 15), min: 5, max: 100);
  ```
- **PHP 8.6 Readonly Property Defaults**: Leverage default value initializers directly on readonly class properties to eliminate redundant constructor parameter boilerplate:
  ```php
  final readonly class QueryFilter
  {
      public string $sort = 'created_at';
      public string $direction = 'desc';

      public function __construct(public string $query = '') {}
  }
  ```
- **PHP 8.6 `#[Override]` on Constants**: Enforce compile-time contract integrity on overridden class and interface constants using the `#[Override]` attribute:
  ```php
  #[\Override]
  public const int TIMEOUT_SECONDS = 60;
  ```
- **PHP 8.6 `Time\Duration` Class**: Prefer the native `Time\Duration` class for precise elapsed time representation, nanosecond arithmetic, and ISO 8601 formatting.
- **PHP 8.4 Property Hooks**: Use property hooks (`get => ...; set => ...;`) for computed, formatted, or validated properties instead of boilerplate getter and setter methods.
- **PHP 8.4 Asymmetric Visibility**: Utilize `public private(set)` or `protected private(set)` for properties that need public read access but restricted write access, eliminating boilerplate getters.
- **PHP 8.5 Pipe Operator (`|>`)**: Use the native pipe operator for sequential data transformations and pipelines.
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
- **Enums**: Replace magic strings and constants with backed enums (e.g., `enum OrderStatus: string { case Pending = 'pending'; }`). Use `__debugInfo()` to sanitize sensitive enum secrets.
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
  - When validating structured payloads defined by a JSON Schema (e.g. AI tool inputs, MCP parameters, or dynamic schemas), derive rules dynamically via `JsonSchema::rules($schema)` inside `rules(): array` to guarantee a single source of truth without duplicating validation constraints.
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
  - Declare queue settings and retry windows on Job classes using the `#[WithQueue]` and `#[RetryFor]` attributes:
    ```php
    #[WithQueue(connection: 'redis', queue: 'notifications', tries: 3, timeout: 60)]
    #[RetryFor(hours: 4)]
    final class SendWelcomeEmail implements ShouldQueue
    {
        use Queueable;
    }
    ```
  - NEVER write procedural `retryUntil(): DateTimeInterface` methods or imperative `$retryUntil` properties when defining job expiration windows. ALWAYS declare retry limits via the declarative `#[RetryFor(hours: ..., minutes: ...)]` attribute.
  - `#[RetryFor]` accepts explicit time units (`hours: 4`, `minutes: 30`, `seconds: 3600`) and applies seamlessly to queued jobs, notifications, mailables, and event listeners.
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

## 13. Security Hardening & 19-Point Vulnerability Defense Guard

Whenever designing, writing, editing, or reviewing Laravel or PHP code, strictly enforce these **19 non-negotiable security guardrails** (merged from `laravel-security-guard`; load `laravel-security-guard` or its domain skills `laravel-injection-and-input-guard`, `laravel-auth-and-access-guard`, `laravel-edge-and-supply-chain-guard`, or invoke `laravel-security-auditor` for deep audits & static scans):

1. **SQL Injection**: NEVER concatenate or interpolate variables into `DB::raw()`, `whereRaw()`, `selectRaw()`, `orderByRaw()`, `havingRaw()`, `groupByRaw()`, or `DB::select()`. Always use `?` or named PDO parameter bindings, and validate dynamic `orderBy()` columns/directions against a strict hardcoded allowlist.
2. **Cross-Site Scripting (XSS)**: Default to escaped Blade `{{ $var }}`. NEVER render untrusted input with `{!! $var !!}`, `v-html`, or `dangerouslySetInnerHTML` without strict allowlist sanitization (HTML Purifier) and a nonce-based CSP. Serialize PHP into inline JS via `Js::from($data)` and validate `href`/`src` URLs against `https://`, `http://`, or safe relative paths.
3. **Cross-Site Request Forgery (CSRF)**: Keep `ValidateCsrfToken` active on stateful web routes and include `@csrf` in every HTML form. NEVER add wildcard exclusions (`'*'`, `'api/*'` on cookie-auth routes) to `validateCsrfTokens(except: [...])`; exempt only HMAC-verified stateless webhooks. Never mutate state on `GET` routes; keep session cookies at `same_site => 'lax'` (or `'strict'`).
4. **Broken Access Control (IDOR & Missing Authorization)**: Enforce authorization on EVERY sensitive endpoint via Form Request `authorize()`, Policies (`$this->authorize()` / `Gate::authorize()`), or `can:` middleware. Apply `->scopeBindings()` on all nested route parameters, use ULIDs/UUIDs for public resources, mark immutable Livewire public properties with `#[Locked]`, and re-authorize inside every Livewire action.
5. **Server-Side Request Forgery (SSRF)**: Before fetching any user-supplied URL (`Http::`, Guzzle, cURL, `file_get_contents`), enforce an `https`/`http` scheme allowlist, resolve ALL DNS A/AAAA records, reject loopback, private, link-local, multicast, IPv6-mapped IPv4 (`::ffff:127.0.0.1`), and cloud metadata IPs (`169.254.169.254`, `fd00:ec2::254`, `100.100.100.200`), disable/re-validate redirects, and pin the validated IP (`CURLOPT_RESOLVE`).
6. **Path Traversal & Zip Slip**: NEVER pass raw user input into `Storage::download()`, `response()->file()`, `file_get_contents()`, `include`/`require`, or filesystem deletes. Resolve paths via `basename()` or server-generated IDs (`Str::random(40)`), verify `realpath()` containment inside the base directory, inspect binary magic bytes via `finfo`, store uploads on private disks outside `public/`, and reject `..` entries when extracting archives.
7. **Command Injection**: Ban `exec()`, `shell_exec()`, `system()`, `passthru()`, `popen()`, `proc_open()`, and backticks. Invoke OS binaries exclusively via `Illuminate\Support\Facades\Process` with argument arrays (`Process::run(['convert', '--', $safeInput])`) and strict regex validation.
8. **Mass Assignment**: NEVER set `protected $guarded = []` or call `Model::unguard()`. Explicitly declare allowed fields via `#[Fillable([...])]` (excluding `is_admin`, `role`, `balance`, `tenant_id`, `email_verified_at`), persist only `$request->validated()` or typed DTOs, and enable `Model::preventSilentlyDiscardingAttributes(! app()->isProduction())`.
9. **Open Redirect**: NEVER pass unvalidated user input directly to `redirect($url)`, `redirect()->to($url)`, or `redirect()->away($url)`. Restrict dynamic targets to single-slash relative paths (rejecting `//` and `/\`) or an explicit `https://` host allowlist.
10. **Leaked Secrets**: NEVER hardcode `APP_KEY`, DB passwords, API keys, JWT/webhook secrets, or private keys; never commit `.env`. Read secrets exclusively via `config()`, never expose secrets via `VITE_*` variables or Inertia shared props, and scrub sensitive keys in Monolog processors.
11. **Using Components with Known Vulnerabilities (CVEs)**: Run `composer audit --abandoned=fail` and `npm audit --omit=dev` (plus OSV-Scanner/Semgrep in CI) before shipping, commit lockfiles, and stay on supported PHP/Laravel security branches.
12. **Improper Assets Management (Debug Mode On)**: Enforce `APP_DEBUG=false` and `APP_ENV=production` in production; never default `config/app.php` `debug` to `true`. Strictly gate Telescope/Horizon/Pulse behind production admin allowlists; never leave `phpinfo()`, debug routes, `.git/`, `.env`, `storage/logs`, or SQL dumps web-accessible.
13. **Broken Authentication**: Hash passwords exclusively with `Hash::make()` (Bcrypt/Argon2id); ban `md5()`/`sha1()`. Enforce `Password::defaults()`, throttle login/reset/MFA endpoints, call `$request->session()->regenerate()` on login and `invalidate()` + `regenerateToken()` on logout, enforce `secure`/`http_only`/`same_site` cookies, scope expiring Sanctum tokens, and compare tokens/HMACs strictly with `hash_equals()`.
14. **Insecure Deserialization & `phar://`**: NEVER call `unserialize()` on untrusted input; use `json_decode($data, true, 512, JSON_THROW_ON_ERROR)` (or strictly `['allowed_classes' => false]` for legacy data). Reject `phar://` and unknown stream wrappers before filesystem calls.
15. **XML External Entity (XXE) Injection**: NEVER pass `LIBXML_NOENT` or `LIBXML_DTDLOAD` to XML parsers. Disable external entity loading, pass `LIBXML_NONET`, and reject `<!DOCTYPE` / `<!ENTITY` declarations in untrusted XML/SVG/SAML/Office payloads.
16. **Server-Side Template Injection (SSTI)**: NEVER pass user-supplied strings to `Blade::render()`, `Blade::compileString()`, `eval()`, or template compilers, and never write user content into `.blade.php` files. Use static templates or allowlisted `strtr()` token replacement.
17. **Clickjacking**: Attach a global `SecurityHeaders` middleware in `bootstrap/app.php` emitting `X-Frame-Options: DENY` (or `SAMEORIGIN`) AND `Content-Security-Policy: frame-ancestors 'none'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Strict-Transport-Security`.
18. **CORS Misconfiguration**: NEVER combine `'allowed_origins' => ['*']` with `'supports_credentials' => true`, NEVER reflect arbitrary `Origin` headers, and NEVER trust `Origin: null`. Use explicit trusted origins or anchored regexes.
19. **HTTP Request Smuggling & TLS Integrity**: Configure `TrustProxies` with explicit proxy CIDRs and `TrustHosts` in `bootstrap/app.php`. Enforce HTTP/1.1 & HTTP/2 framing parity (`ignore_invalid_headers on`), ensure zero per-request state leakage in Octane/FrankenPHP, and NEVER disable outbound TLS certificate verification (`withoutVerifying()` / `verify => false`) in production.

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
  - ALWAYS declare explicit typed parameter constraints in `schema(JsonSchema $schema)`.
  - In `handle(Request $request)`, validate inputs directly against the schema using `Validator::validate($request->all(), JsonSchema::rules($this->schema(...)))` to eliminate duplicated validation definitions.
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
- **Strict Parameter Schemas & Validation**:
  - Every Tool and Prompt MUST define explicit, typed parameters in `schema(JsonSchema $schema)`.
  - NEVER accept untyped or loose parameter arrays; declare descriptions, types, and required fields.
  - In Tool `handle(Request $request)` methods, validate client execution parameters using `Validator::validate($request->all(), JsonSchema::rules($this->schema(...)))` to guarantee alignment with the declared schema contract.
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

---

## 19. Canonical Frontend Directory Organization: Layouts, Components & Pages

All frontend assets across Blade, Livewire, Vue 3, React 19/18, and Svelte 5 must strictly adhere to the standardized 4-tier directory architecture:

- **Strict 4-Tier Directory Scoping**:
  - `layouts/`: Master application shells. Must ONLY contain outer HTML scaffolding, asset tags, and slot insertion points (`layouts/app`, `layouts/auth`, `layouts/customer`, `layouts/admin`, `layouts/public`).
  - `components/app/<domain>/`: Domain-specific navigation chrome. Contains `header`, `nav`, `footer`, and `sidebar` partitioned by domain (`admin/`, `customer/`, `auth/`, `public/`).
  - `components/ui/` & `components/icon/`: Atomic, reusable design tokens (`button`, `input`, `modal`, `card`, `badge`, `table`, `dropdown`) and SVG icons. Must NEVER contain database queries, domain entities, or business logic.
  - `pages/<domain>/<feature>/`: Concrete page entrypoints corresponding 1:1 with HTTP controller routes (e.g., `pages/admin/dashboard/index`, `pages/customer/dashboard/index`, `pages/home/index`).
- **Prohibition of View Root Sprawl**:
  - NEVER dump ad-hoc template files directly in the root of `resources/views/` (except the base `app.blade.php` for Inertia bootstrapping) or `resources/js/`.
  - NEVER mix admin back-office navigation chrome into customer-facing or public templates.
- **Controller Route-to-Page Resolution**:
  - Controllers must resolve view names following canonical dot-notation paths:
    ```php
    // Blade / Livewire
    return view('pages.admin.dashboard.index', $data);

    // Inertia.js (Vue 3 / React / Svelte 5)
    return Inertia::render('admin/dashboard/Index', $data);
    ```

---

## 20. Dead Code Elimination, Zombie Logic Hunting & Codebase Hygiene

All applications maintained or scaffolded under this plugin must strictly adhere to these dead code elimination standards:

- **Zero Commented-Out Code (Strict Rule)**:
  - NEVER commit commented-out code blocks ("just in case we need it later").
  - Version control (Git) retains full history. Commented-out code rots, creates ambiguity, and adds cognitive drag. Delete ruthlessly.
- **Unused Imports & Dead Aliases**:
  - Every PHP file must contain zero unused `use` statements or orphaned aliases.
  - Enforce automated stripping via Laravel Pint (`"no_unused_imports": true`) in local hooks and CI workflows.
- **Immediate Deletion of Legacy Skeleton Files**:
  - Immediately delete legacy framework files from Laravel 9/10 (`app/Http/Kernel.php`, `app/Console/Kernel.php`, `app/Exceptions/Handler.php`, `app/Providers/RouteServiceProvider.php`).
  - Laravel 13 configures middleware, exception handling, and routing exclusively in `bootstrap/app.php` and `routes/console.php`.
- **Automated Dead Code Purging with Rector**:
  - Enforce `SetList::DEAD_CODE` in `rector.php` to continuously detect and automatically delete:
    - Unused private methods and private properties.
    - Dead method parameters and unreachable conditional branches.
    - Unreferenced class constants and unused local variables.
- **Dead Route & Component Pruning**:
  - Ruthlessly delete orphaned routes, unused Form Requests, dead API resources, and unreferenced Blade views, Livewire components, or Inertia page templates.
- **Dead Composer Dependencies**:
  - Audit `composer.json` using `composer-unused` to identify and remove declared dependencies that are never referenced in production code.

---

## 21. Architectural Base Project Directory Tree Patterns & Placement Guidelines

All codebases developed, refactored, or audited under this plugin must strictly adhere to standardized architectural directory patterns and placement rules:

- **Strict Architectural Base Hierarchy**:
  - Standard applications must use the **Action-Driven Monolith** pattern (`app/Actions/<Domain>/`, `app/Data/<Domain>/`, `app/Builders/`) or the **Service-Class Oriented Monolith** pattern (`app/Services/<Domain>/`, `app/Contracts/Services/<Domain>/`, `app/Data/<Domain>/`).
  - Large multi-team platforms must partition into **Modular Monolith** bounded contexts (`modules/<Domain>/src/`).
  - Core banking and highly complex domains must use **Domain-Driven Design (DDD)** (`src/Domain/`, `src/Application/`, `src/Infrastructure/`) or **Hexagonal Architecture** (`src/Core/`, `src/Adapters/`).
- **Canonical Folder Placement Rules**:
  - **Business Logic & Use Cases**: MUST reside in `app/Actions/<Domain>/<Verb><Noun>Action.php` (final, invokable) or cohesive domain services in `app/Services/<Domain>/<Domain><Capability>Service.php`. NEVER place business logic in Controllers, Eloquent Models, or Blade templates.
  - **Service-Class Architecture Standards**:
    - Services MUST implement explicit interface contracts under `app/Contracts/Services/<Domain>/<Capability>ServiceInterface.php` bound via the IoC container.
    - Services MUST accept strongly-typed immutable DTOs (`app/Data/<Domain>/`), NEVER raw `$request->all()` or untyped arrays.
    - Services MUST encapsulate ACID transaction boundaries (`DB::transaction(..., attempts: 3)`) and post-commit event dispatching (`DB::afterCommit()`).
    - PROHIBIT "God Services": Services must maintain high cohesion and narrow operational scope (e.g., split bloated `OrderService` into `OrderCreationService`, `OrderFulfillmentService`, `OrderPricingService`).
  - **Data Transfer Objects (DTOs)**: MUST reside in `app/Data/<Domain>/<Noun>Data.php` as `final readonly class`.
  - **Custom Query Builders**: MUST reside in `app/Builders/<Model>QueryBuilder.php` bound via `#[UseEloquentBuilder]`.
  - **Controllers**: MUST reside in `app/Http/Controllers/` as Single-Action Invokables (`__invoke`).
  - **Form Requests**: MUST reside in `app/Http/Requests/<Domain>/`. NEVER run inline validation in controllers.
  - **API Serialization**: MUST reside in `app/Http/Resources/<Version>/<Domain>/`. NEVER return raw models from endpoints.
  - **Vendor Integrations**: External 3rd party SDK wrappers belong exclusively in `app/Services/<Vendor>/`. NEVER create generic "God" services (`OrderService`, `GeneralService`).
  - **Pure Algorithmic Helpers**: MUST reside as pure static classes in `app/Support/`. NEVER dump procedural functions into a global `helpers.php` or `app/Utils/` folder.
  - **First-Party AI & MCP**: Autonomous agents reside in `app/Ai/Agents/`, AI tools in `app/Ai/Tools/`, and Model Context Protocol servers in `app/Mcp/Servers/`.
  - **Frontend 4-Tier Scoping**: View templates (`resources/views/`) and Inertia SPAs (`resources/js/`) must strictly adhere to the 4-tier hierarchy (`layouts/`, `components/app/<domain>/`, `components/ui/`, `components/icon/`, `pages/<domain>/<feature>/`). Total prohibition of view root sprawl.
  - **Architectural Boundary Enforcement**: Every project must maintain automated Pest 3 boundary tests in `tests/Arch/` ensuring controllers remain invokable, actions remain final, models do not leak into controllers directly, and no generic dumping grounds exist.

---

## 22. Payment Gateway Architecture, Webhook Security & Fintech Rules

All payment processing code written or audited under this plugin must strictly adhere to the following fintech security and architectural rules:

- **PCI-DSS Compliance & Zero Plaintext Card Storage**:
  - NEVER store credit/debit card numbers (PAN), CVVs, expiration dates, or cryptocurrency private keys in the database, cache, session, or application logs.
  - Rely exclusively on client-side tokenization (Stripe Elements, bKash Hosted Page, Binance QR, PayPal Buttons) so raw credentials never touch the Laravel application server.
  - Redact sensitive gateway responses from log files using `Http::withHeaders()->withoutLogging()`.
- **Constant-Time Webhook Signature Verification**:
  - EVERY incoming webhook and Instant Payment Notification (IPN) must verify its cryptographic signature using constant-time comparison (`hash_equals()`) to prevent timing side-channel attacks.
  - Reject any webhook with missing, malformed, or invalid signatures with `400 Bad Request` or `401 Unauthorized`.
- **Atomic Idempotency & Double-Billing Defense**:
  - Charge initiation must be protected against race conditions using Redis distributed locks (`Cache::lock("payment:charge:{$orderId}", 15)`) or database unique constraint idempotency tables.
  - Webhook processing MUST be idempotent. Track incoming event IDs in a `processed_webhooks` table locked via `lockForUpdate()` inside `DB::transaction(..., attempts: 3)` to ensure retry storms do not trigger duplicate fulfillment or multiple emails.
- **Strict Out-of-Band Verification**:
  - NEVER mark an order as `Paid` solely because a customer redirected to a callback URL (`?paymentID=...&status=success`).
  - Always execute or query the gateway directly out-of-band (e.g., bKash `/tokenized/checkout/execute`, Binance Pay `/binancepay/openapi/v2/order/query`, Stripe `PaymentIntent::retrieve`) before transitioning order state.
- **bKash Tokenized Checkout Standards**:
  - Cache authorization grant tokens atomically in Redis with a 50-minute TTL to minimize redundant token requests.
  - Mandate the 3-step sequence: (1) `token/grant`, (2) `checkout/create`, (3) `checkout/execute` followed by status verification.
- **Binance Pay Cryptographic Standards**:
  - Sign every request using HMAC-SHA512 with millisecond UTC timestamp and cryptographically secure 32-character random nonce.
  - Verify incoming Binance Pay webhook payloads using the identical SHA512 string-to-sign protocol.
- **Zero Floating-Point Arithmetic for Currency**:
  - NEVER use PHP `float` or `double` types for monetary calculations.
  - Store all monetary values as integer cents (e.g. `amount_cents: int`) or use BCMath strings (`bcadd`, `bcmul`) with explicit scale for crypto or fractional units.
- **Replay Attack Defense & Nonce Tracking**:
  - Enforce a strict sliding window ($\pm 300\text{s}$) on all signed webhook and payment payloads.
  - Record unique nonces in Redis (`Cache::add("fintech:nonce:{$nonce}", true, 600)`) and reject duplicate nonces with `401 Unauthorized`.
- **Payment Log Sanitization (Monolog Processor)**:
  - Configure a dedicated Monolog processor (`MaskSensitivePaymentData`) in `config/logging.php` to redact PANs, CVVs, and Bearer tokens before writing to disk.
- **Payment Finite State Machine (FSM) Guards**:
  - Implement strict transition guards on `PaymentStatus` preventing illegal transitions (e.g., transitioning from `Refunded` or `Voided` back to `Paid`).
- **Checkout Velocity Defense (Anti-Carding)**:
  - Enforce tiered rate limiting (`payment.checkout`) via `RateLimiter::for()` on all payment initiation endpoints to mitigate card testing and MFS bot abuse.

---

## 23. Database Schema Design, Eloquent Attributes, Indexing & FK Architecture Rules

All database migrations, Eloquent models, and schema designs must strictly comply with the following architectural rules:

- **Mandatory Native PHP 8 Attributes on Eloquent Models**:
  - Models MUST declare table names, fillable attributes, hidden attributes, custom query builders, and global scopes using native PHP 8 attributes:
    ```php
    #[Table('orders')]
    #[Fillable(['tenant_id', 'status', 'total_amount_cents'])]
    #[Hidden(['gateway_secret'])]
    #[UseEloquentBuilder(OrderQueryBuilder::class)]
    #[ScopedBy([TenantScope::class])]
    class Order extends Model
    ```
  - Prohibit legacy protected property arrays (`protected $fillable`, `protected $hidden`, `protected $table`).
  - Attribute casts MUST be declared inside the `casts(): array` method using backed enums, `AsFluent::class`, integer cents, or `immutable_datetime`.
- **Relationship Type-Safety & PHPStan Level 8 Generics**:
  - Every Eloquent relationship method MUST declare a native return type and a PHPStan generic docblock indicating related model and owner:
    ```php
    /**
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<\App\Models\OrderItem, $this>
     */
    public function items(): HasMany
    ```
  - Enforce global strictness in `AppServiceProvider::boot()`:
    - `Model::preventLazyLoading(! app()->isProduction())`
    - `Model::preventSilentlyDiscardingAttributes(! app()->isProduction())`
    - `Model::preventAccessingMissingAttributes(! app()->isProduction())`
- **Primary Key (PK) Architecture Standard**:
  - Modern public and multi-tenant SaaS tables MUST use ULIDs (`$table->ulid('id')->primary();`) with `HasUlids` trait to prevent sequential ID harvesting.
  - Inter-service integrations with Kafka/Snowflake may use UUIDv7 (`$table->uuid('id')->primary();`).
  - Auto-incrementing BigInts (`$table->id();`) are strictly reserved for high-throughput, internal-only append tables (e.g. log streams, internal ledger lines).
- **Foreign Key (FK) Integrity & Cascades**:
  - All foreign keys MUST declare explicit cascades:
    - `cascadeOnDelete()` for tightly-bound child items (e.g. `order_items`).
    - `restrictOnDelete()` for master entities referenced in financial transactions (e.g. `products`, `customers`).
    - `nullOnDelete()` for optional associations.
  - Foreign key columns must always be indexed to prevent full table lock escalation during parent row deletions.
- **Indexing Standards & The Leftmost Prefix Rule**:
  - Multi-column indexes MUST adhere to the Equality-then-Range (ESR) rule: high-cardinality equality columns first, range/sort columns last (e.g. `index(['tenant_id', 'status', 'created_at'])`).
  - NEVER create standalone indexes on low-cardinality boolean columns. Combine them into composite indexes or use partial indexes (`WHERE deleted_at IS NULL`).

---

## 24. Frontend Design Craft, Anti-AI-Slop & Aesthetic Taste Rules

All frontend templates, Blade views, Livewire components, and Inertia.js (Vue 3, React 19, Svelte 5) pages must strictly adhere to the following design craft and anti-slop rules, synthesized from Paul Bakaus's Impeccable (`pbakaus/impeccable`), Leon Lin's Taste Skill (`Leonxlnx/taste-skill`), and Hassan El Mghari's Hallmark (`nutlope/hallmark`):

- **Absolute Prohibition of AI-Slop Visual Clichés**:
  - **No Cliché Gradients**: Strictly forbid generic purple-to-blue or indigo-to-pink gradients (`bg-gradient-to-r from-purple-600 to-blue-500`, `from-indigo-500 to-pink-500`). Use intentional monochromatic palettes with subtle tonal depth, warm analog neutrals, or bold brand-anchored contrast.
  - **No Identical 3-Card Feature Grids**: Strictly forbid repeating `[Icon in rounded circle + H3 + 2 lines of filler text]` across 3 uniform cards. Cards are the lazy container; nested cards are always wrong. Replace with asymmetric Bento grids, direct interactive component previews, live data tables, or editorial columns.
  - **No Eyebrow or Pill Badges Above Headings**: Strictly forbid floating kicker labels (e.g., `[✨ AI-POWERED PLATFORM]`, `[NEW FEATURE]`). The headline must carry its own semantic weight; let typography speak.
  - **No Fake Metrics or Imaginary Proof**: Strictly forbid inventing metrics ("Trusted by 10,000+ teams", "99.9% customer happiness"), fake testimonials, or placeholder logo walls. Show the real application interface or clearly labeled structural mockups.
  - **No Emoji as UI Icons**: Strictly forbid unicode emoji (`🚀`, `✨`, `🔥`, `💡`) serving as UI glyphs. Use clean, single-weight SVG vector primitives from `components/icon/`, Lucide, or Heroicons.
- **The Hero Viewport Invariant (1280x800 & 1440x900)**:
  - The hero headline, single supporting sentence, and primary action button must be 100% visible above the fold without scrolling at both 1280x800 and 1440x900 viewport resolutions.
  - Maximum ~80 words in the entire initial viewport. Eliminate giant empty vertical paddings (`py-32`) that push the CTA off-screen.
- **Restrained Motion & GPU-Accelerated Animation**:
  - **Never use `transition: all`**. Only transition explicit GPU-accelerated properties (`transform`, `opacity`, `filter`).
  - Never animate layout triggers (`width`, `height`, `top`, `left`).
  - Always enforce `@media (prefers-reduced-motion: reduce)` fallbacks disabling motion for sensitive users.
  - Authored micro-interactions: card hover lift of 2px (`translate-y-[-2px]`), photo zoom of 1.02 inside frame, button active press scale of 0.98.
- **Themed Browser Native Surfaces**:
  - Theme `::selection` to match brand accent tones (`var(--color-accent-subtle)`).
  - Theme input caret (`caret-color: var(--color-accent)`).
  - Theme custom scrollbars (`scrollbar-color: var(--color-border) transparent`).
  - Mandatory high-contrast `:focus-visible` ring on every interactive control; never default browser blue focus rings.
- **Surface Mode Discipline**:
  - **`Persuade Mode`** (Landing pages, marketing, pricing): Bold, distinctive, high visual tension, real product previews.
  - **`Operate Mode`** (Admin panels, dashboards, CRM, data tables): High scanability, compact padding, monospace data tables, restrained neutral chrome.
  - **`Read Mode`** (Documentation, guides, changelogs): Optimal reading measure (65–75ch), generous line-height, zero distracting motion.
  - **`Experience Mode`** (Portfolios, onboarding wizards, showcases): Artifact leads from the first viewport, interface recedes to quiet frame.
- **Design Governance & Automated Verification**:
  - Audit templates with `npx impeccable detect resources/views/` and `npx impeccable audit <path>`.
  - Validate with automated Pest 3 boundary tests in `tests/Arch/FrontendDesignTest.php` forbidding forbidden gradient classes and unorganized inline styles.

---

## 25. Error Handling, Error Pages & HTTP/HTTPS Error Component Rules

All Laravel 13 exception handling, error views, and HTTP/HTTPS error UI components must strictly follow these rules:

- **Unified `bootstrap/app.php` Exception Orchestration**:
  - NEVER create legacy `app/Exceptions/Handler.php`. Configure `shouldRenderJsonWhen`, RFC 7807 `application/problem+json` rendering, `dontReportDuplicates()`, and Inertia error rendering exclusively inside `withExceptions()` in `bootstrap/app.php`.
  - ALWAYS attach a correlation Trace ID (`X-Request-Id` ULID via `Context::add('trace_id', ...)`) to every logged exception, RFC 7807 payload, and rendered error page.
  - ALWAYS emit `Cache-Control: no-store, private` on every `4xx`/`5xx` error response so CDNs and browsers never cache transient errors or user-specific error details.
  - NEVER expose stack traces, SQL queries, file paths, or `.env` values when `APP_DEBUG=false`.
- **Complete Error Pages & Isolated Error Layout**:
  - Ship branded, accessible error pages covering `400`, `401`, `402`, `403`, `404`, `419` (CSRF expired), `422`, `429` (Rate Limited with `Retry-After` countdown), `500`, `502`, `503` (Maintenance / Upstream Unavailable), and `504` across Blade (`resources/views/errors/`), Livewire, and Inertia (`pages/errors/Index`).
  - Isolate `layouts/error.blade.php` / `ErrorLayout` from all database queries, Redis calls, and `auth()->user()` lookups to prevent cascading double-fault blank pages during outages.
- **Reusable UI, HTTP & HTTPS Transport Error Components**:
  - Standardize accessible validation error components (`components/ui/error/field`, `components/ui/error/summary`, `FieldError`, `ErrorSummary`) with `role="alert"`, `aria-live="polite"`, and real SVG icons (zero emoji).
  - Wrap unstable frontend islands/deferred widgets in Error Boundaries (React `ErrorBoundary`, Vue `onErrorCaptured`, Svelte `<svelte:boundary>`) with non-destructive retry actions.
  - Provide unified **HTTP status** (`components/error/http-status` / `HttpErrorCard`) and **HTTPS transport** (`components/error/https-transport` / `HttpsTransportAlert`) components handling `419` token refresh, `429` countdown, browser offline/reconnecting alerts, insecure HTTP downgrade alerts, and `502`/`504` gateway recovery.
  - Enforce `URL::forceScheme('https')` in production, `EnsureHttpsRequest` (`308` web redirect / `426 Upgrade Required` API), HSTS, and `upgrade-insecure-requests` CSP.

---

## 26. Resilient Request Handling & Cache Handling Rules

All inbound HTTP/HTTPS requests, outbound `Http::` calls, and application/HTTP caching must strictly enforce these resilience rules:

- **Inbound Request Handling**:
  - Prepend `AttachRequestContextMiddleware` to assign/validate a ULID `X-Request-Id`, bind request metadata to `Illuminate\Support\Facades\Context`, and echo `X-Request-Id` on every response.
  - Normalize inputs in Form Request `prepareForValidation()`, authorize in `authorize()`, validate with `rules()` or `JsonSchema::rules()`, and hydrate immutable `final readonly` DTOs (`toDto()`).
  - Protect state-mutating payment/order endpoints with `Idempotency-Key` middleware backed by `Cache::lock()` and SHA-256 request payload fingerprinting (`409 Conflict` on concurrent in-flight duplicate, `422` on payload mismatch).
  - Enforce tiered burst + sustained rate limiting via `RateLimiter::for()` returning RFC 7807 `429` with `Retry-After`.
- **Outbound HTTP / HTTPS Request Handling**:
  - ALWAYS configure explicit `connectTimeout()` and `timeout()` on `Illuminate\Support\Facades\Http` calls; never permit unbounded hangs.
  - Retry ONLY transient failures (`ConnectionException`, `429`, `502`, `503`, `504`) with jittered exponential backoff; never retry non-idempotent writes without an `Idempotency-Key`.
  - Wrap unstable external HTTPS dependencies in a Cache-backed `CircuitBreaker` and route user-supplied URLs exclusively through SSRF-safe `SafeHttpClient` with strict TLS verification (never `withoutVerifying()` in production).
- **Resilient Cache Handling**:
  - Configure Laravel 13's native `failover` cache store (`redis -> database -> array`) in `config/cache.php` strictly for **recomputable cached data** (catalogs, dashboards, read models), and guard critical reads with `ResilientCache` so Redis outages degrade gracefully instead of crashing with `500 RedisException`.
  - **Exclude Idempotency & Security State from Best-Effort Failover**: ALWAYS store idempotency records, distributed financial locks, and replay nonces in a single authoritative, durable store (e.g., dedicated database table or `Cache::store('database')`) rather than a failover store, preventing duplicate execution after Redis recovers from an outage.
  - ALWAYS handle `LockTimeoutException` explicitly on `Cache::lock()->block()` calls (returning `503` + `Retry-After` or a stale fallback) without swallowing business exceptions thrown by the inner callback.
  - Use `Cache::flexible()` for read-heavy SWR keys, `Cache::touch()` for TTL renewal, `igbinary` + `zstd` compression, and versioned multi-tenant cache keys (`t:{tenantId}:{domain}:v{n}:{key}`) backed by a non-evicting version store invalidated strictly via `DB::afterCommit()`.
  - Apply `Cache-Control: public, max-age=..., stale-while-revalidate=..., stale-if-error=...` + `ETag` on public GETs and strict `Cache-Control: no-store, private` on authenticated PII, auth, and `4xx`/`5xx` error responses.








