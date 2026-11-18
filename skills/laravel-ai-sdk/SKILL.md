---
name: laravel-ai-sdk
description: Master guide to Laravel 13 & PHP 8.5+ Official AI SDK (laravel/ai): Prompts, Context, Tools, Provider Tools, Structured Output, Streaming, Async, and Multimodal Attachments.
---

# Laravel AI SDK (`laravel/ai`) Skill

This skill governs the end-to-end design, implementation, and testing of AI-powered features using Laravel's official first-party AI SDK (**`laravel/ai`**) targeting Laravel 13 and PHP 8.5+.

---

## 1. When to Use This Skill

Activate this skill when:
- Installing and configuring Laravel's official AI package: `composer require laravel/ai`.
- Scaffolding and implementing AI Agents (`php artisan make:agent`).
- Scaffolding and implementing Local Tools (`php artisan make:tool`).
- Integrating cloud-side **Provider Tools** (`WebSearch`, `WebFetch`, `FileSearch`, `CodeExecution`).
- Managing multi-turn conversation memory and **Context** (`RemembersConversations`, `Conversational`).
- Enforcing deterministic **Structured Outputs** (`HasStructuredOutput`) hydrated into PHP 8.5+ immutable DTOs (`final readonly class`).
- Building real-time **Streaming** endpoints (SSE, Livewire `wire:stream`, Vercel Data Protocol).
- Offloading heavy AI reasoning to **Async** queues (`#[WithQueue]`) with live WebSockets broadcasting (Laravel Echo).
- Processing multimodal **Attachments** (`Laravel\Ai\Files\Image`, `Document`, `Audio`, HTTP uploads).
- Writing zero-cost, deterministic Pest 3 tests with `Agent::fake()` and `assertPrompted()`.

---

## 2. Installation & Quick Setup

```bash
composer require laravel/ai
php artisan vendor:publish --provider="Laravel\Ai\AiServiceProvider"
php artisan migrate
```

Configure `.env`:
```env
AI_DEFAULT_DRIVER=anthropic

ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy...
OLLAMA_URL=http://localhost:11434
```

---

## 3. The 8 Core Implementation Blueprints

### Blueprint 1: Prompts & Dedicated Agent Classes

Scaffold an agent class:
```bash
php artisan make:agent SalesCoach
```

```php
declare(strict_types=1);

namespace App\Ai\Agents;

use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Promptable;

final class SalesCoach implements Agent
{
    use Promptable;

    public function instructions(): string
    {
        return 'You are an elite B2B sales coach helping representatives refine their pitch. ' .
               'Provide punchy, actionable critique focusing on value proposition and objection handling.';
    }

    public function model(): ?string
    {
        return 'claude-3-7-sonnet-20250219';
    }
}
```

**Executing prompts:**
```php
$coach = new SalesCoach();
$feedback = (string) $coach->prompt('Here is my pitch: "We sell the fastest database in the world..."');
```

---

### Blueprint 2: Context & Conversational Memory

Persist chat history automatically using `RemembersConversations` and `Conversational`:

```php
declare(strict_types=1);

namespace App\Ai\Agents;

use App\Models\SupportTicket;
use Laravel\Ai\Concerns\RemembersConversations;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Promptable;

final class TicketAssistantAgent implements Agent, Conversational
{
    use Promptable, RemembersConversations;

    public function __construct(
        private readonly SupportTicket $ticket,
    ) {}

    public function instructions(): string
    {
        return sprintf(
            'You are resolving Ticket #%s: "%s". Maintain technical context across user exchanges.',
            $this->ticket->id,
            $this->ticket->subject
        );
    }

    public function conversationKey(): string
    {
        return "ticket:{$this->ticket->id}";
    }
}
```

---

### Blueprint 3: Local Tools (`make:tool`)

Scaffold a local application tool:
```bash
php artisan make:tool LookupUserSubscriptionTool
```

```php
declare(strict_types=1);

namespace App\Ai\Tools;

use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

final readonly class LookupUserSubscriptionTool implements Tool
{
    public function description(): Stringable|string
    {
        return 'Look up customer account details, subscription tier, and active add-ons by email.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'email' => $schema->string()
                ->description('The customer email address')
                ->required(),
        ];
    }

    public function handle(Request $request): Stringable|string
    {
        $email = (string) $request['email'];
        $user = User::query()->where('email', $email)->first();

        if ($user === null) {
            return json_encode(['found' => false], JSON_THROW_ON_ERROR);
        }

        return json_encode([
            'found' => true,
            'user_id' => $user->id,
            'name' => $user->name,
            'tier' => $user->subscription_tier ?? 'free',
            'is_delinquent' => $user->is_delinquent ?? false,
        ], JSON_THROW_ON_ERROR);
    }
}
```

Attach to Agent via `HasTools`:
```php
use Laravel\Ai\Concerns\HasTools;

class SupportAgent implements Agent
{
    use Promptable, HasTools;

    public function tools(): iterable
    {
        return [
            new LookupUserSubscriptionTool(),
        ];
    }
}
```

---

### Blueprint 4: Cloud Provider Tools

Attach cloud-executed tools that run on provider infrastructure (web search, file search, code sandbox):

```php
declare(strict_types=1);

namespace App\Ai\Agents;

use Laravel\Ai\Concerns\HasTools;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Promptable;
use Laravel\Ai\Providers\Tools\FileSearch;
use Laravel\Ai\Providers\Tools\WebSearch;

final class ResearchAgent implements Agent
{
    use Promptable, HasTools;

    public function instructions(): string
    {
        return 'You are an investment analyst. Search the live web to find verified annual revenue reports.';
    }

    public function tools(): iterable
    {
        return [
            new WebSearch(),
            new FileSearch(),
        ];
    }
}
```

---

### Blueprint 5: Structured Outputs & Immutable DTOs

Enforce strict output formatting via `HasStructuredOutput` and hydrate into a `final readonly class` DTO:

```php
declare(strict_types=1);

namespace App\Data\Ai;

use DateTimeImmutable;

final readonly class LeadQualificationDto
{
    /**
     * @param list<string> $identifiedNeeds
     */
    public function __construct(
        public string $leadTier,
        public int $fitScore,
        public array $identifiedNeeds,
        public string $recommendedAction,
        public DateTimeImmutable $qualifiedAt,
    ) {}

    /**
     * @param array{lead_tier: string, fit_score: int, identified_needs: list<string>, recommended_action: string} $data
     */
    #[\NoDiscard]
    public static function fromArray(array $data): self
    {
        return new self(
            leadTier: $data['lead_tier'],
            fitScore: $data['fit_score'],
            identifiedNeeds: $data['identified_needs'],
            recommendedAction: $data['recommended_action'],
            qualifiedAt: new DateTimeImmutable(),
        );
    }
}
```

```php
declare(strict_types=1);

namespace App\Ai\Agents;

use App\Data\Ai\LeadQualificationDto;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Concerns\HasStructuredOutput;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Promptable;

final class QualifyLeadAgent implements Agent
{
    use Promptable, HasStructuredOutput;

    public function instructions(): string
    {
        return 'Analyze B2B inquiry messages and extract structured qualification metrics strictly matching the schema.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'lead_tier' => $schema->string()->enum(['enterprise', 'mid_market', 'smb', 'disqualified'])->required(),
            'fit_score' => $schema->integer()->description('Score from 0 to 100 based on budget and fit')->required(),
            'identified_needs' => $schema->array()->items($schema->string())->required(),
            'recommended_action' => $schema->string()->required(),
        ];
    }

    #[\NoDiscard]
    public function qualify(string $leadNotes): LeadQualificationDto
    {
        /** @var array{lead_tier: string, fit_score: int, identified_needs: list<string>, recommended_action: string} $payload */
        $payload = $this->prompt("Qualify lead notes:\n\n{$leadNotes}");

        return LeadQualificationDto::fromArray($payload);
    }
}
```

---

### Blueprint 6: Real-Time SSE Token Streaming

Stream tokens directly to HTTP clients:

```php
declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Ai;

use App\Ai\Agents\SalesCoach;
use App\Http\Requests\Ai\StreamPromptRequest;
use Exception;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class StreamCoachController
{
    public function __invoke(StreamPromptRequest $request): StreamedResponse
    {
        $prompt = $request->validatedPrompt();

        return response()->stream(function () use ($prompt): void {
            if (ob_get_level() > 0) {
                ob_end_clean();
            }

            try {
                $stream = (new SalesCoach())->stream($prompt);

                foreach ($stream as $chunk) {
                    $delta = $chunk->content;
                    if ($delta === '') {
                        continue;
                    }

                    $json = json_encode(['delta' => $delta], JSON_THROW_ON_ERROR);
                    echo "event: chunk\ndata: {$json}\n\n";

                    if (connection_aborted() === 1) {
                        break;
                    }

                    flush();
                }

                echo "event: complete\ndata: {}\n\n";
                flush();
            } catch (Exception $e) {
                Log::error('Streaming error', ['error' => $e->getMessage()]);
                echo "event: error\ndata: {\"error\":\"Stream interrupted\"}\n\n";
                flush();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
```

---

### Blueprint 7: Async Queues & WebSocket Broadcasting

Offload long tasks to background jobs with exponential retry backoff and broadcast progress to the frontend:

```php
declare(strict_types=1);

namespace App\Jobs\Ai;

use App\Ai\Agents\QualifyLeadAgent;
use App\Events\Ai\LeadProcessingEvent;
use App\Models\Lead;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\Attributes\WithoutRelations;
use Illuminate\Queue\Attributes\WithQueue;
use Throwable;

#[WithQueue(connection: 'redis', queue: 'ai-processing', tries: 3, timeout: 180)]
final class ProcessLeadJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        #[WithoutRelations]
        private readonly Lead $lead,
    ) {}

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 30, 90]; // 429 recovery
    }

    public function handle(QualifyLeadAgent $agent): void
    {
        broadcast(new LeadProcessingEvent($this->lead->id, 'Analyzing business signals...'));

        $dto = $agent->qualify($this->lead->notes);

        $this->lead->update([
            'tier' => $dto->leadTier,
            'fit_score' => $dto->fitScore,
            'identified_needs' => $dto->identifiedNeeds,
            'recommended_action' => $dto->recommendedAction,
            'qualified_at' => now(),
        ]);

        broadcast(new LeadProcessingEvent($this->lead->id, 'Qualification complete.'));
    }
}
```

---

### Blueprint 8: Multimodal Attachments (`Laravel\Ai\Files`)

Pass images, PDFs, audio transcripts, or uploaded files directly to models:

```php
declare(strict_types=1);

namespace App\Actions\Ai;

use App\Ai\Agents\SalesCoach;
use Illuminate\Http\UploadedFile;
use InvalidArgumentException;
use Laravel\Ai\Files\Document;
use Laravel\Ai\Files\Image;

final readonly class AnalyzePitchDeckAction
{
    #[\NoDiscard]
    public function execute(UploadedFile $file, string $notes): string
    {
        $attachment = match ($file->getClientMimeType()) {
            'image/png', 'image/jpeg' => Image::fromPath($file->getRealPath()),
            'application/pdf' => Document::fromPath($file->getRealPath()),
            default => throw new InvalidArgumentException('Unsupported pitch deck format.'),
        };

        $coach = new SalesCoach();

        return (string) $coach->prompt(
            "Review this pitch deck slide and notes:\n\n{$notes}",
            attachments: [$attachment]
        );
    }
}
```

---

## 4. Pest 3 Testing with `Agent::fake()`

```php
declare(strict_types=1);

use App\Ai\Agents\QualifyLeadAgent;
use App\Data\Ai\LeadQualificationDto;

it('qualifies incoming leads with structured data without live API requests', function (): void {
    QualifyLeadAgent::fake([
        [
            'lead_tier' => 'enterprise',
            'fit_score' => 92,
            'identified_needs' => ['SSO', 'Custom SLA', 'Dedicated VPC'],
            'recommended_action' => 'Schedule VP intro call',
        ],
    ])->preventStrayPrompts();

    $agent = app(QualifyLeadAgent::class);
    $dto = $agent->qualify('Enterprise client with 5,000 employees requesting VPC deployment.');

    expect($dto)->toBeInstanceOf(LeadQualificationDto::class)
        ->and($dto->leadTier)->toBe('enterprise')
        ->and($dto->fitScore)->toBe(92)
        ->and($dto->identifiedNeeds)->toContain('Dedicated VPC');

    QualifyLeadAgent::assertPrompted(function (string $prompt): bool {
        return str_contains($prompt, '5,000 employees');
    });
});
```

---

## 5. Architectural Reference

For complete enterprise patterns, prompt injection sanitization, and vector search indexing benchmarks, refer to:
- **[docs/architecture/ai-sdk-and-llm-integration.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/ai-sdk-and-llm-integration.md)**
