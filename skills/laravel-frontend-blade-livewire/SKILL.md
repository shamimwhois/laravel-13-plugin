---
name: laravel-frontend-blade-livewire
description: Enterprise guide to Laravel 13 Blade component architecture, slots, attribute bags, Alpine.js, and Livewire v3 & v4 reactive full-stack components, wire:stream AI token streaming, #[Computed], #[Lazy], #[Locked], and Pest 3 testing.
---

# Laravel 13 Blade & Livewire (v3 & v4) Skill

This skill governs the development of server-rendered component systems and reactive full-stack PHP applications using modern **Blade**, **Alpine.js**, and **Livewire (v3 & v4)** in Laravel 13 & PHP 8.5+.

---

## 1. When to Use This Skill

Activate this skill when:
- Designing atomic, reusable Blade components (`resources/views/components/`).
- Working with Blade `@props`, `@aware`, attribute bags (`$attributes->class()`), and named slots.
- Building reactive, single-page-like interactive interfaces without leaving PHP using **Livewire (v3 & v4)**.
- Implementing Livewire v3/v4 attributes: `#[Computed]`, `#[Lazy]`, `#[Locked]`, `#[Url]`, `#[On]`.
- Integrating real-time AI token streaming into Livewire using `wire:stream` and `laravel/ai`.
- Extracting complex form validation and state into dedicated Livewire **Form Objects** (`Livewire\Form`).
- Integrating **Alpine.js** for client-side micro-interactions and modal toggles with `@entangle`.
- Writing isolated, deterministic component tests in **Pest 3** (`Livewire::test()`).

---

## 2. Core Architectural Rules

1. **Atomic Blade Components**:
   - Favor anonymous Blade components in `resources/views/components/` for UI primitives (buttons, inputs, alerts, modals).
   - Use `@props` with explicit defaults. Never read untyped global variables directly.
   - Always merge classes via `$attributes->class([...])` to allow caller customization.
2. **Security & State Tampering Prevention (`#[Locked]`)**:
   - ALWAYS mark sensitive database IDs, tenant foreign keys, and non-editable state with `#[Locked]`.
   - Never trust client-submitted Livewire state without server-side validation.
3. **Dedicated Form Objects**:
   - Extract multi-field forms into dedicated `Livewire\Form` classes (`app/Livewire/Forms/`) to keep components thin and adhere to Single Responsibility.
4. **Performance & Lazy Loading (`#[Lazy]`)**:
   - Defer slow queries and third-party API calls in dashboard widgets by applying `#[Lazy]` and implementing `placeholder()`.
5. **AI Token Streaming (`wire:stream`)**:
   - Use Livewire's native `$this->stream()` targeting a DOM element with `wire:stream="id"` when consuming LLM token streams from `laravel/ai`.
6. **Alpine.js for Client State**:
   - Do NOT send network roundtrips to Livewire for purely visual client-side interactions (dropdowns, tabs, tooltips). Use Alpine.js (`x-data`, `x-show`, `x-transition`).
7. **Pest 3 Component Testing**:
   - Test every Livewire component using `Livewire::test(ComponentClass::class)` covering validation rules, computed caching, method execution, and state assertions.

---

## 3. Implementation Patterns

### Pattern 1: Production Blade Component (`resources/views/components/form/input.blade.php`)

```blade
@props([
    'disabled' => false,
    'label' => null,
    'error' => null,
    'name' => null,
    'id' => null,
])

@php
    $inputId = $id ?? $name ?? 'input-' . str()->random(8);
@endphp

<div {{ $attributes->only('class')->class(['space-y-1.5']) }}>
    @if ($label)
        <label for="{{ $inputId }}" class="block text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ $label }}
            @if ($attributes->has('required'))
                <span class="text-rose-500">*</span>
            @endif
        </label>
    @endif

    <div class="relative rounded-md shadow-sm">
        <input
            id="{{ $inputId }}"
            name="{{ $name }}"
            {{ $disabled ? 'disabled' : '' }}
            {{ $attributes->except('class')->class([
                'block w-full rounded-md border text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1',
                'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white' => ! $error,
                'border-rose-500 text-rose-900 placeholder-rose-300 focus:border-rose-500 focus:ring-rose-500 dark:border-rose-600 dark:bg-slate-900' => $error,
                'bg-slate-100 text-slate-500 cursor-not-allowed dark:bg-slate-800' => $disabled,
            ]) }}
        />
    </div>

    @if ($error)
        <p class="text-xs text-rose-600 dark:text-rose-400 mt-1" id="{{ $inputId }}-error">{{ $error }}</p>
    @endif
</div>
```

### Pattern 2: Livewire Form Object (`app/Livewire/Forms/OrderForm.php`)

```php
declare(strict_types=1);

namespace App\Livewire\Forms;

use App\Models\Order;
use Livewire\Attributes\Validate;
use Livewire\Form;

final class OrderForm extends Form
{
    #[Validate(['required', 'string', 'max:255'])]
    public string $customerName = '';

    #[Validate(['required', 'email', 'max:255'])]
    public string $customerEmail = '';

    #[Validate(['required', 'integer', 'min:1'])]
    public int $quantity = 1;

    #[Validate(['required', 'numeric', 'min:0.01'])]
    public float $unitPrice = 0.0;

    public function store(): Order
    {
        $this->validate();

        return Order::query()->create([
            'customer_name' => $this->customerName,
            'customer_email' => $this->customerEmail,
            'quantity' => $this->quantity,
            'unit_price' => (int) round($this->unitPrice * 100),
            'status' => 'pending',
        ]);
    }
}
```

### Pattern 3: Livewire Reactive Component (`app/Livewire/Orders/CreateOrder.php`)

```php
declare(strict_types=1);

namespace App\Livewire\Orders;

use App\Livewire\Forms\OrderForm;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Component;

final class CreateOrder extends Component
{
    public OrderForm $form;

    #[Locked]
    public int $userId;

    public function mount(User $user): void
    {
        $this->userId = $user->id;
    }

    #[Computed(persist: true, seconds: 300)]
    public function estimatedTotal(): float
    {
        return $this->form->quantity * $this->form->unitPrice;
    }

    public function save(): void
    {
        $order = $this->form->store();

        session()->flash('status', 'Order created successfully.');

        $this->redirectRoute('orders.show', ['order' => $order], navigate: true);
    }

    public function render(): View
    {
        return view('livewire.orders.create-order');
    }
}
```

### Pattern 4: AI Token Streaming with `wire:stream` & `laravel/ai`

```php
declare(strict_types=1);

namespace App\Livewire\Ai;

use App\Ai\Agents\SupportAssistantAgent;
use Illuminate\Contracts\View\View;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Validate;
use Livewire\Component;

final class AssistantChat extends Component
{
    #[Validate(['required', 'string', 'max:1000'])]
    public string $prompt = '';

    #[Locked]
    public string $conversationId = '';

    public function mount(): void
    {
        $this->conversationId = (string) str()->uuid();
    }

    public function ask(): void
    {
        $this->validate();

        $promptText = $this->prompt;
        $this->reset('prompt');

        // Stream tokens incrementally to DOM target
        $stream = (new SupportAssistantAgent)->stream($promptText);

        foreach ($stream as $token) {
            $this->stream(
                to: 'assistant-response',
                content: $token,
                replace: false,
            );
        }
    }

    public function render(): View
    {
        return view('livewire.ai.assistant-chat');
    }
}
```

Blade view (`resources/views/livewire/ai/assistant-chat.blade.php`):

```blade
<div class="p-6 bg-white rounded-lg shadow dark:bg-slate-800">
    <div 
        id="assistant-response" 
        wire:stream="assistant-response"
        class="min-h-24 p-4 rounded bg-slate-50 text-slate-900 font-mono text-sm dark:bg-slate-900 dark:text-slate-100 whitespace-pre-wrap"
    ></div>

    <form wire:submit="ask" class="mt-4 flex gap-2">
        <input 
            type="text" 
            wire:model="prompt" 
            placeholder="Ask AI assistant..." 
            class="flex-1 rounded-md border-slate-300 dark:bg-slate-900 dark:border-slate-700"
        />
        <button 
            type="submit" 
            wire:loading.attr="disabled"
            class="px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
            <span wire:loading.remove>Send</span>
            <span wire:loading>Thinking...</span>
        </button>
    </form>
</div>
```

---

## 4. Pest 3 Component Testing

```php
declare(strict_types=1);

use App\Livewire\Orders\CreateOrder;
use App\Models\User;
use Livewire\Livewire;

test('creates order successfully with reactive updates', function (): void {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(CreateOrder::class, ['user' => $user])
        ->set('form.customerName', 'Bruce Wayne')
        ->set('form.customerEmail', 'bruce@wayne.corp')
        ->set('form.quantity', 2)
        ->set('form.unitPrice', 49.99)
        ->assertComputed('estimatedTotal', 99.98)
        ->call('save')
        ->assertHasNoErrors()
        ->assertRedirectRoute('orders.show');

    $this->assertDatabaseHas('orders', [
        'customer_name' => 'Bruce Wayne',
        'customer_email' => 'bruce@wayne.corp',
        'quantity' => 2,
        'unit_price' => 4999,
    ]);
});

test('prevents tampering with locked user id', function (): void {
    $user = User::factory()->create();

    $this->expectException(\Livewire\Exceptions\CannotMutateLockedPropertyException::class);

    Livewire::actingAs($user)
        ->test(CreateOrder::class, ['user' => $user])
        ->set('userId', 9999);
});
```

---

## 5. Architectural Reference

Read the complete architectural guide in [blade-and-livewire.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/blade-and-livewire.md) and [frontend-layouts-components-and-pages.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/frontend-layouts-components-and-pages.md) for 4-tier directory structuring (`layouts/`, `components/app/*`, `components/ui/*`, `pages/*`), lazy loading placeholders, Alpine entangle, and SPA navigation with `wire:navigate`.
