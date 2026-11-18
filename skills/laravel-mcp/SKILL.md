---
name: laravel-mcp
description: Master guide to Model Context Protocol (MCP) in Laravel 13 & PHP 8.5+: Building first-party MCP Servers (make:mcp-server, make:mcp-tool, make:mcp-resource, make:mcp-prompt), stdio and SSE web transports (routes/ai.php), client connections, security, and Pest 3 testing.
---

# Laravel Model Context Protocol (MCP) Skill

This skill governs the architecture, development, security, and testing of **Model Context Protocol (MCP)** servers and clients using Laravel's official first-party package (**`laravel/mcp`**) in Laravel 13 and PHP 8.5+.

---

## 1. When to Use This Skill

Activate this skill when:
- Exposing Laravel application capabilities to external AI clients (Claude Desktop, Cursor, Antigravity, ChatGPT) over the Model Context Protocol.
- Scaffolding MCP Servers (`php artisan make:mcp-server`).
- Developing MCP Tools (`php artisan make:mcp-tool`) with JSON Schema validation and action dispatching.
- Exposing read-only MCP Resources (`php artisan make:mcp-resource`) with URI templates (`HasUriTemplate`).
- Creating standardized, reusable MCP Prompts (`php artisan make:mcp-prompt`).
- Configuring Web SSE transports (`routes/ai.php` with `Mcp::web()`) and stdio transports (`php artisan mcp:serve`).
- Connecting internal `laravel/ai` agents to external MCP servers (`Mcp::client()`).
- Securing MCP endpoints with Laravel Sanctum tokens, rate limiting, and IDOR defenses.
- Writing fast Pest 3 tests using `Mcp::server()->callTool()` and `readResource()`.

---

## 2. Installation & Scaffolding Workflow

```bash
composer require laravel/mcp
php artisan vendor:publish --tag=ai-routes
```

### Core Artisan Generator Commands

| Command | Output Location | Purpose |
| :--- | :--- | :--- |
| `php artisan make:mcp-server <Name>` | `app/Mcp/Servers/<Name>.php` | Groups tools, resources, and prompts under a unified endpoint |
| `php artisan make:mcp-tool <Name>` | `app/Mcp/Tools/<Name>.php` | Actionable functions executed by AI models |
| `php artisan make:mcp-resource <Name>` | `app/Mcp/Resources/<Name>.php` | Read-only contextual documents exposed via URIs |
| `php artisan make:mcp-prompt <Name>` | `app/Mcp/Prompts/<Name>.php` | Pre-engineered conversation templates with typed parameters |

---

## 3. Step-by-Step Implementation Blueprints

### Step 1: The MCP Server Class

Create `app/Mcp/Servers/BusinessServer.php`:

```php
declare(strict_types=1);

namespace App\Mcp\Servers;

use App\Mcp\Prompts\DraftRefundPrompt;
use App\Mcp\Resources\OrderDetailsResource;
use App\Mcp\Tools\ProcessRefundTool;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;

#[Name('Business Operations MCP Server')]
#[Version('1.0.0')]
#[Instructions('Provides authorized business tools for customer refunds, order telemetry, and support workflows.')]
final class BusinessServer extends Server
{
    /**
     * @var array<int, class-string<\Laravel\Mcp\Server\Tool>>
     */
    protected array $tools = [
        ProcessRefundTool::class,
    ];

    /**
     * @var array<int, class-string<\Laravel\Mcp\Server\Resource>>
     */
    protected array $resources = [
        OrderDetailsResource::class,
    ];

    /**
     * @var array<int, class-string<\Laravel\Mcp\Server\Prompt>>
     */
    protected array $prompts = [
        DraftRefundPrompt::class,
    ];
}
```

---

### Step 2: Implementing an MCP Tool

Create `app/Mcp/Tools/ProcessRefundTool.php`:

```php
declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Actions\Billing\RefundOrderAction;
use App\Models\Order;
use Exception;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\JsonSchema as JsonSchemaFacade;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tool;

final class ProcessRefundTool extends Tool
{
    protected string $description = 'Process a partial or full refund for a customer order.';

    public function schema(JsonSchema $schema): array
    {
        return [
            'order_id' => $schema->string()
                ->description('The ULID of the target order')
                ->required(),
            'amount_cents' => $schema->integer()
                ->description('Amount to refund in cents (must not exceed order balance)')
                ->required(),
            'reason' => $schema->string()
                ->enum(['damaged_goods', 'customer_dissatisfaction', 'billing_error'])
                ->description('Reason classification for the refund')
                ->required(),
            'idempotency_key' => $schema->string()
                ->description('Unique client key to prevent double refund processing')
                ->required(),
        ];
    }

    public function handle(Request $request): Response
    {
        // Laravel 13.43+: Derive native validation rules from the declared JSON Schema
        /** @var array{order_id: string, amount_cents: int, reason: string, idempotency_key: string} $validated */
        $validated = Validator::validate(
            $request->all(),
            JsonSchemaFacade::rules($this->schema(...))
        );

        $orderId = $validated['order_id'];
        $amountCents = $validated['amount_cents'];
        $reason = $validated['reason'];
        $idempotencyKey = $validated['idempotency_key'];

        $order = Order::query()->find($orderId);
        if ($order === null) {
            return Response::error("Order [{$orderId}] does not exist.");
        }

        try {
            $action = app(RefundOrderAction::class);
            $refund = $action->execute($order, $amountCents, $reason, $idempotencyKey);

            return Response::json([
                'success' => true,
                'refund_id' => $refund->id,
                'status' => $refund->status,
                'refunded_amount' => $refund->amount_cents,
            ]);
        } catch (Exception $e) {
            Log::error('MCP Refund processing failed', ['order_id' => $orderId, 'error' => $e->getMessage()]);

            return Response::error('Refund processing error: ' . $e->getMessage());
        }
    }
}
```

---

### Step 3: Implementing an MCP Resource with URI Templates

Create `app/Mcp/Resources/OrderDetailsResource.php`:

```php
declare(strict_types=1);

namespace App\Mcp\Resources;

use App\Models\Order;
use Laravel\Mcp\Contracts\HasUriTemplate;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Resource;
use Laravel\Mcp\Server\UriTemplate;

final class OrderDetailsResource extends Resource implements HasUriTemplate
{
    protected string $description = 'Provides real-time line items, tax, and shipment tracking for an order.';

    public function uriTemplate(): UriTemplate
    {
        return new UriTemplate('orders://{id}/details');
    }

    /**
     * @param array<string, string> $parameters
     */
    public function read(array $parameters): Response
    {
        $id = $parameters['id'] ?? '';
        $order = Order::query()->with(['items', 'customer'])->find($id);

        if ($order === null) {
            return Response::error("Order [{$id}] not found.");
        }

        return Response::json([
            'order_id' => $order->id,
            'customer_name' => $order->customer?->name,
            'status' => $order->status,
            'total_cents' => $order->total_cents,
            'items' => $order->items->map(static fn ($item): array => [
                'sku' => $item->sku,
                'quantity' => $item->quantity,
                'price_cents' => $item->price_cents,
            ]),
        ]);
    }
}
```

---

### Step 4: Implementing an MCP Prompt

Create `app/Mcp/Prompts/DraftRefundPrompt.php`:

```php
declare(strict_types=1);

namespace App\Mcp\Prompts;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Server\Prompt;

final class DraftRefundPrompt extends Prompt
{
    protected string $description = 'Draft an empathetic customer email explaining an issued refund.';

    public function schema(JsonSchema $schema): array
    {
        return [
            'customer_name' => $schema->string()->description('Customer full name')->required(),
            'refund_amount' => $schema->string()->description('Formatted refund amount (e.g. $49.00)')->required(),
            'issue_summary' => $schema->string()->description('Brief summary of what went wrong')->required(),
        ];
    }

    /**
     * @param array<string, mixed> $arguments
     */
    public function template(array $arguments): string
    {
        $name = (string) ($arguments['customer_name'] ?? 'Valued Customer');
        $amount = (string) ($arguments['refund_amount'] ?? '$0.00');
        $issue = (string) ($arguments['issue_summary'] ?? 'an unexpected issue');

        return <<<PROMPT
You are a Senior Customer Relations specialist. Draft a warm, concise apology email to [{$name}].
Inform them that a refund of [{$amount}] has been issued due to [{$issue}].
Emphasize our commitment to quality and provide reassurance for future interactions.
PROMPT;
    }
}
```

---

### Step 5: Web SSE Routing (`routes/ai.php`) & Stdio Transport

In `routes/ai.php`:

```php
declare(strict_types=1);

use App\Mcp\Servers\BusinessServer;
use Illuminate\Support\Facades\Route;
use Laravel\Mcp\Facades\Mcp;

// Secure web SSE transport for remote AI clients
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function (): void {
    Mcp::web('/mcp/business', BusinessServer::class);
});
```

For local stdio execution (Claude Desktop, Cursor, Antigravity):
```bash
php artisan mcp:serve BusinessServer
```

---

### Step 6: Consuming MCP Tools in `laravel/ai` Agents

Connect internal AI agents directly to MCP servers:

```php
declare(strict_types=1);

namespace App\Ai\Agents;

use Laravel\Ai\Concerns\HasTools;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Promptable;
use Laravel\Mcp\Facades\Mcp;

final class OperationsAgent implements Agent
{
    use Promptable, HasTools;

    public function instructions(): string
    {
        return 'You are an operations assistant. Use MCP tools to inspect orders and execute refunds safely.';
    }

    public function tools(): iterable
    {
        return [
            ...Mcp::client('business')->tools(),
        ];
    }
}
```

---

## 4. Pest 3 Testing Framework

```php
declare(strict_types=1);

use App\Mcp\Servers\BusinessServer;
use App\Models\Order;
use Laravel\Mcp\Facades\Mcp;

it('executes refund tool successfully via MCP protocol', function (): void {
    $order = Order::factory()->create(['total_cents' => 10000]);

    $response = Mcp::server(BusinessServer::class)->callTool('process_refund', [
        'order_id' => $order->id,
        'amount_cents' => 5000,
        'reason' => 'customer_dissatisfaction',
        'idempotency_key' => 'unique-refund-key-abc',
    ]);

    expect($response->isSuccess())->toBeTrue()
        ->and($response->json('success'))->toBeTrue()
        ->and($response->json('refunded_amount'))->toBe(5000);
});

it('reads order details resource by URI template', function (): void {
    $order = Order::factory()->create();

    $response = Mcp::server(BusinessServer::class)->readResource("orders://{$order->id}/details");

    expect($response->isSuccess())->toBeTrue()
        ->and($response->json('order_id'))->toBe($order->id);
});
```

---

## 5. Architectural Reference

For complete protocol mechanics, capability negotiation, and authentication hardening:
- **[docs/architecture/mcp-and-ai-protocols.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/mcp-and-ai-protocols.md)**
