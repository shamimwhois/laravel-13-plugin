---
name: laravel-inertia-spa
description: Production guide for building Laravel 13 Single-Page Applications (SPAs) with Inertia.js v2, Vue 3 (TypeScript), React 19 (TypeScript), Svelte 5 (Runes), Deferred Props, Vite bundling, and Pest 3 testing.
---

# Laravel 13 Inertia.js v2 Multi-Frontend SPA Skill

This skill governs the architecture, data delivery, frontend hydration, and testing of Single-Page Applications (SPAs) built with **Inertia.js v2** and Laravel 13 & PHP 8.5+, supporting **Vue 3 (TypeScript)**, **React 19/18 (TypeScript)**, and **Svelte 5 (Runes)**.

---

## 1. When to Use This Skill

Activate this skill when:
- Building modern client-side Single-Page Applications (SPAs) without building separate REST/GraphQL APIs.
- Designing Invokable Inertia Controllers returning `Inertia::render('PageName', [...])`.
- Implementing **Inertia.js v2 features**:
  - Deferred Props (`Inertia::defer()`) for non-blocking page transitions.
  - Optional / Lazy Props (`Inertia::lazy()`).
  - Polling (`router.poll()`), prefetching (`prefetch`), and infinite scrolling.
  - History encryption and clear history state.
- Authoring type-safe page components in:
  - **Vue 3**: `<script setup lang="ts">` with strongly typed props interfaces and `<Deferred>` wrappers.
  - **React 19 / 18**: Function components with TypeScript props, `useForm()`, and `<Deferred>`.
  - **Svelte 5**: Modern Svelte Runes (`$props()`, `$state()`, `$derived()`).
- Configuring `vite.config.ts` for multi-stack asset bundling and Server-Side Rendering (SSR).
- Testing Inertia endpoints deterministically using **Pest 3** (`assertInertia()`).

---

## 2. Core Architectural Rules

1. **Clean Controller Data Boundary**:
   - NEVER pass raw Eloquent models or unmapped collections directly to `Inertia::render()`.
   - ALWAYS map data using `JsonResource` or dedicated DTOs to prevent sensitive database columns (e.g. `password`, internal tenant keys) from leaking into the client DOM state.
2. **Inertia v2 Deferred Props**:
   - Any query taking longer than 100ms (e.g. aggregate reporting, charts, external API checks) must be wrapped in `Inertia::defer(fn () => ...)`.
   - The frontend page must wrap deferred props with `<Deferred data="...">` and render a skeleton placeholder while loading.
3. **Strict TypeScript & Interfaces**:
   - Every Vue 3 and React component must define explicit TypeScript interfaces for page props.
   - For Svelte 5, use `let { prop }: Props = $props();` with TypeScript type declarations.
4. **Thin Controllers & Single Responsibility**:
   - Use Single-Action Invokable Controllers (`__invoke`) for each Inertia screen route.
5. **Form Handling via Inertia Form Helpers**:
   - Use `useForm()` in Vue/React to manage client form state, dirty tracking, validation errors, and progress indicators.
6. **Pest 3 Inertia Assertions**:
   - Test Inertia endpoints using `$response->assertInertia(fn (AssertableInertia $page) => ...)` asserting component names, props existence, and deferred groups.

---

## 3. Controller Architecture with Deferred Props

```php
declare(strict_types=1);

namespace App\Http\Controllers\Dashboard;

use App\Http\Resources\Metrics\RevenueMetricResource;
use App\Http\Resources\Orders\OrderSummaryResource;
use App\Models\Order;
use App\Models\RevenueMetric;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class ShowDashboardController
{
    public function __invoke(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Dashboard/Index', [
            // Critical immediate prop
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],

            // Deferred Prop (loads asynchronously without blocking page transition)
            'metrics' => Inertia::defer(fn (): array => [
                'revenue' => RevenueMetricResource::make(
                    RevenueMetric::query()->where('team_id', $user->current_team_id)->latest()->first()
                )->resolve(),
            ], 'analytics'),

            // Lazy Prop (only loaded on explicit partial reloads)
            'recentOrders' => Inertia::lazy(fn (): array => 
                OrderSummaryResource::collection(
                    Order::query()->where('user_id', $user->id)->latest()->limit(5)->get()
                )->resolve()
            ),
        ]);
    }
}
```

---

## 4. Frontend Framework Implementations

### Stack A: Vue 3 with TypeScript & `<Deferred>`

```vue
<script setup lang="ts">
import { Head, Deferred } from '@inertiajs/vue3';

interface UserProp {
  id: number;
  name: string;
  email: string;
}

interface MetricsProp {
  revenue: {
    totalRevenueFormatted: string;
    grossMarginPercent: number;
  };
}

defineProps<{
  user: UserProp;
  metrics?: MetricsProp;
}>();
</script>

<template>
  <Head title="Enterprise Dashboard" />

  <div class="min-h-screen bg-slate-50 p-8 dark:bg-slate-900">
    <header class="mb-8">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Welcome back, {{ user.name }}</h1>
    </header>

    <Deferred data="metrics">
      <template #fallback>
        <div class="h-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      </template>

      <div v-if="metrics" class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div class="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
          <p class="text-sm font-medium text-slate-500">Total Revenue</p>
          <p class="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {{ metrics.revenue.totalRevenueFormatted }}
          </p>
        </div>
      </div>
    </Deferred>
  </div>
</template>
```

### Stack B: React 19/18 with TypeScript & `<Deferred>`

```tsx
import React from 'react';
import { Head, Deferred } from '@inertiajs/react';

interface UserProp {
  id: number;
  name: string;
  email: string;
}

interface MetricsProp {
  revenue: {
    totalRevenueFormatted: string;
    grossMarginPercent: number;
  };
}

interface DashboardProps {
  user: UserProp;
  metrics?: MetricsProp;
}

export default function DashboardIndex({ user, metrics }: DashboardProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50 p-8 dark:bg-slate-900">
      <Head title="Enterprise Dashboard" />

      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome, {user.name}</h1>
      </header>

      <Deferred
        data="metrics"
        fallback={<div className="h-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />}
      >
        {metrics && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
              <p className="text-sm font-medium text-slate-500">Total Revenue</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {metrics.revenue.totalRevenueFormatted}
              </p>
            </div>
          </div>
        )}
      </Deferred>
    </div>
  );
}
```

### Stack C: Svelte 5 with Runes (`$props`, `$state`, `$derived`)

```svelte
<script lang="ts">
  import { inertia } from '@inertiajs/svelte';

  interface Props {
    user: {
      id: number;
      name: string;
      email: string;
    };
    metrics?: {
      revenue: {
        totalRevenueFormatted: string;
        grossMarginPercent: number;
      };
    };
  }

  // Svelte 5 Runes: Modern reactive property declaration
  let { user, metrics }: Props = $props();

  let isExporting = $state(false);
  let statusMessage = $derived(isExporting ? 'Exporting report...' : 'Ready');
</script>

<svelte:head>
  <title>Svelte 5 Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 p-8 dark:bg-slate-900">
  <header class="mb-8 flex items-center justify-between">
    <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Svelte 5: {user.name}</h1>
    <span class="text-xs font-mono text-slate-500">{statusMessage}</span>
  </header>

  {#if metrics}
    <div class="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
      <p class="text-sm font-medium text-slate-500">Total Revenue</p>
      <p class="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
        {metrics.revenue.totalRevenueFormatted}
      </p>
    </div>
  {:else}
    <div class="h-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"></div>
  {/if}
</div>
```

---

## 5. Vite Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.ts'],
            ssr: 'resources/js/ssr.ts',
            refresh: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
    ],
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
});
```

---

## 6. Pest 3 Inertia Testing

```php
declare(strict_types=1);

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('renders dashboard component with user and deferred metrics', function (): void {
    $user = User::factory()->create([
        'name' => 'Clark Kent',
        'email' => 'clark@dailyplanet.com',
    ]);

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Index')
            ->has('user', fn (Assert $prop) => $prop
                ->where('id', $user->id)
                ->where('name', 'Clark Kent')
                ->where('email', 'clark@dailyplanet.com')
            )
            ->has('metrics')
        );
});
```

---

## 7. Architectural Reference

Read the complete architectural guide in [inertia-and-frontend-stacks.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/inertia-and-frontend-stacks.md) for full stack deep-dives, Vite asset bundling, and TypeScript configurations.
