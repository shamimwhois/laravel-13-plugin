---
name: laravel-inertia-spa
description: Production guide for building Laravel 13 Single-Page Applications (SPAs) with Inertia.js v3 (client v3.11.0 & inertiajs/inertia-laravel v3.8.0), Vue 3 (TypeScript), React 19+ (TypeScript), Svelte 5+ (Runes), @inertiajs/vite zero-config & Dev SSR, Built-in XHR client & interceptors, useHttp(), Optimistic Updates, Instant Visits, Layout Props, <Form> with Precognition, Deferred/Optional/Once/Live Props, InfiniteScroll, QUERY method, Blade <x-inertia::head>/<x-inertia::app>, Inertia::handleExceptionsUsing(), and Pest 3 testing.
---

# Laravel 13 & Inertia.js v3 Multi-Frontend SPA Skill

This skill governs the architecture, data delivery, frontend hydration, SSR, and testing of Single-Page Applications (SPAs) built with **Inertia.js v3** (`@inertiajs/{vue3,react,svelte,vite}` **v3.11.0** & `inertiajs/inertia-laravel` **v3.8.0**) on **Laravel 13** & **PHP 8.5+ / 8.6+**, supporting **Vue 3 (TypeScript)**, **React 19+ (TypeScript)**, and **Svelte 5+ (Runes)**.

> **Minimum Ecosystem Baseline (Inertia v3)**: PHP `^8.2` (PHP 8.6 supported in `v3.8.0`), Laravel `^11.35|^12|^13`, **React `^19.0`** (React 18 dropped), **Svelte `^5.0`** (Svelte 4 & SvelteKit dropped), **Vue `^3.0`**, **Vite `^7|^8`**, **Node.js 22+** for SSR, **ES2022 / ESM-only** (`"type": "module"`).

---

## 1. When to Use This Skill

Activate this skill when:
- Building modern SPAs without maintaining a separate REST/GraphQL API layer.
- Designing Invokable Inertia Controllers returning `Inertia::render('pages/Path', [...])` or backed enum component names (`Inertia::render(Page::Dashboard, [...])`).
- Implementing **Inertia.js v3 features**:
  - **Zero-Config `@inertiajs/vite` & Out-of-the-Box Dev SSR** (no separate Node SSR server during `npm run dev`).
  - **Built-in XHR Client & Global Interceptors (`http.onRequest` / `onResponse` / `onError`)** — Axios, `qs`, and `lodash-es` removed from core.
  - **Standalone HTTP Requests (`useHttp`)** with reactive state, Precognition, and optimistic updates without page navigation.
  - **First-Class Optimistic Updates** (`router.optimistic()`, `form.optimistic()`, `<Form :optimistic>`, `http.optimistic()`) with automatic partial-key rollback.
  - **Instant Visits** (`<Link component="Dashboard">` / Wayfinder `instant` + `pageProps`).
  - **Persistent Layouts & Layout Props** (`setLayoutProps()`, `resetLayoutProps()`, `[Layout, props]`, `LayoutCallback`).
  - **`<Form>` Component & `useForm()`** with built-in Precognition (no external `laravel-precognition-*` packages needed) and typed `createForm<T>()` / `<Form<T>>` / `useFormContext<T>()`.
  - **Deferred Props (`Inertia::defer(..., rescue: true)`)**, **Optional Props (`Inertia::optional()` — replaces removed `Inertia::lazy()`)**, **Once Props (`Inertia::once()`, `shareOnce()`)**, **Merge / Scroll Props (`Inertia::merge()`, `Inertia::scroll()` + `<InfiniteScroll>`)**, **Live Props (`Inertia::live()` + `echo()`/`pusher()`/`actionCable()` + `useProp()`)**, **Flash Data (`Inertia::flash()`, `forgetFlashed()`)**, and **Big Integers (`preserveBigIntegers()`)**.
  - **Blade Components** (`<x-inertia::head>` with SSR fallback slot & `<x-inertia::app />`) and **`Inertia::handleExceptionsUsing()`**.
  - **`QUERY` HTTP Method** (`router.query`, `useForm.query`, `useHttp.query`, `<Link method="query" prefetch>`), `<WhenVisible>`, `<WhenMounted>`, and `usePoll()` (`mode`, `background`, `polling`).
- Testing Inertia endpoints deterministically with **Pest 3** (`assertInertia()`, `loadDeferredProps()`, `hasFlash()`, `assertInertiaFlash()`).

---

## 2. Core Architectural Rules

1. **Clean Controller Data Boundary**:
   - NEVER pass raw Eloquent models or unmapped collections to `Inertia::render()`. Always transform via `JsonResource` or immutable `final readonly` DTOs.
2. **Deferred, Optional, Once & Live Props**:
   - Wrap slow queries (>100ms) in `Inertia::defer(fn () => ..., 'group', rescue: true)` and render `<Deferred data="...">` with `#fallback` and `#rescue` slots.
   - Use **`Inertia::optional()`** for explicit partial reloads — **`Inertia::lazy()` was removed in Inertia v3**.
   - Cache stable per-session shared data (permissions, feature flags, locales) with `Inertia::once()` / `HandleInertiaRequests::shareOnce()`.
   - Use **`Inertia::live($cb, on: $event, channel: $channel, throttle: 500)`** + `Inertia::broadcastProps()` for real-time server-pushed prop updates over Laravel Echo / Pusher / ActionCable.
3. **Zero-Config Vite & Dev SSR**:
   - Register `inertia()` from `@inertiajs/vite` in `vite.config.ts`. Use `createInertiaApp()` with `withApp(app, { ssr, page })` and `nonce` (for strict CSP) instead of verbose manual glob resolvers.
4. **Built-in XHR Client & v3 Error Events**:
   - Do NOT install `axios` just for Inertia; configure global headers/auth/logging through `http.onRequest` / `http.onResponse` / `http.onError` (only opt into `axiosAdapter()` for legacy Axios plugins).
   - Listen to **`httpException`** (`inertia:httpException`) and **`networkError`** (`inertia:networkError`) — v2's `invalid` and `exception` events were renamed in v3.
5. **Forms, `useHttp`, Optimistic UI & Layouts**:
   - Prefer `<Form>` (`createForm<T>()` in Vue/Svelte, `<Form<T>>` in React) or `useForm()` with built-in Precognition for page mutations; use **`useHttp()`** for standalone JSON/API calls that should not trigger page visits.
   - In React 19 persistent layouts, wrap arrow function layout components in an array (`Page.layout = [AppLayout]`) because arrow functions are treated as render callbacks.
   - Use `setLayoutProps()` / `resetLayoutProps()` for dynamic layout chrome updates (note: `useLayoutProps` does **not** exist in v3).
6. **Pest 3 Inertia Verification**:
   - Assert component names, typed prop structures, deferred groups (`loadDeferredProps()`), and flash payloads (`hasFlash()` / `assertInertiaFlash()`).

---

## 3. Controller Architecture (Inertia v3.8.0 + Laravel 13)

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Dashboard;

use App\Events\OrderPaid;
use App\Http\Resources\Metrics\RevenueMetricResource;
use App\Http\Resources\Orders\OrderSummaryResource;
use App\Models\Order;
use App\Models\RevenueMetric;
use App\Models\User;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class ShowDashboardController
{
    public function __invoke(Request $request): Response
    {
        /** @var User $user */
        $user = $request->userOrFail();
        $teamId = $user->current_team_id;

        return Inertia::render('admin/dashboard/Index', [
            // Critical immediate prop
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],

            // Deferred Prop with rescue fallback (v3.1+): non-blocking initial load + graceful error slot
            'metrics' => Inertia::defer(
                fn (): array => RevenueMetricResource::make(
                    RevenueMetric::query()->where('team_id', $teamId)->latest()->firstOrFail(),
                )->resolve(),
                group: 'analytics',
                rescue: true,
            ),

            // Optional Prop (replaces removed v2 Inertia::lazy()) — only resolved on partial reload
            'recentOrders' => Inertia::optional(
                fn (): array => OrderSummaryResource::collection(
                    Order::query()->where('team_id', $teamId)->latest()->limit(10)->get(),
                )->resolve(),
            ),

            // Live Prop (v3.7+ / client v3.11+): MUST pass PrivateChannel (strings are always treated as public channels!)
            // Authorize `team.{teamId}` in routes/channels.php
            'pendingCount' => Inertia::live(
                fn (): int => Order::query()->where('team_id', $teamId)->where('status', 'pending')->count(),
                on: OrderPaid::class,
                channel: new PrivateChannel("team.{$teamId}"),
                throttle: 500,
            ),

            'notesCount' => $user->notes()->count(),

            // Once Prop: cached across client navigations until TTL or ->fresh()
            'currencies' => Inertia::once(fn (): array => ['USD', 'EUR', 'BDT'])->until(now()->addHour()),
        ]);
    }
}
```

---

## 4. Frontend Framework Implementations (Vue 3, React 19+, Svelte 5+)

### Stack A: Vue 3 + TypeScript (Layout Props, `<Deferred>` `#rescue`, `useHttp`, Optimistic `<Form>`)

```vue
<script setup lang="ts">
import { Deferred, Head, Link, createForm, setLayoutProps, useHttp, useProp } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';

interface UserProp {
  id: string;
  name: string;
  email: string;
}

interface MetricsProp {
  total_revenue_formatted: string;
  gross_margin_percent: number;
}

interface NoteForm {
  body: string;
}

defineOptions({
  layout: [AppLayout, { title: 'Executive Dashboard' }],
});

const props = defineProps<{
  user: UserProp;
  metrics?: MetricsProp;
  pendingCount: number;
  notesCount: number;
}>();

const NoteFormComponent = createForm<NoteForm>();
const livePending = useProp<number>('pendingCount');

// Standalone HTTP call (no page visit) with reactive state
const exportRequest = useHttp<{ format: string }, { download_url: string }>({ format: 'csv' });

async function exportReport(): Promise<void> {
  const result = await exportRequest.post('/api/v1/reports/export');
  setLayoutProps({ subtitle: `Last export ready: ${result.download_url}` });
}
</script>

<template>
  <Head title="Executive Dashboard" />

  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Welcome back, {{ props.user.name }}</h1>
        <p class="text-sm text-zinc-500">Pending orders (live): {{ livePending.value }}</p>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          :disabled="exportRequest.processing"
          class="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium dark:border-zinc-700"
          @click="exportReport"
        >
          {{ exportRequest.processing ? 'Exporting...' : 'Export CSV' }}
        </button>

        <!-- Instant Visit + Hover Prefetch -->
        <Link
          href="/orders/create"
          component="admin/orders/Create"
          prefetch
          class="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950"
        >
          New Order
        </Link>
      </div>
    </header>

    <Deferred data="metrics">
      <template #fallback>
        <div class="h-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </template>

      <template #rescue>
        <div role="alert" class="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          Metrics failed to load. Please retry in a moment.
        </div>
      </template>

      <template #default="{ reloading }">
        <div v-if="props.metrics" :class="{ 'opacity-60': reloading }" class="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <p class="text-xs font-medium uppercase tracking-wider text-zinc-500">Total Revenue</p>
          <p class="mt-1 text-3xl font-bold tabular-nums">{{ props.metrics.total_revenue_formatted }}</p>
        </div>
      </template>
    </Deferred>

    <!-- Typed <Form> with Optimistic Update & Built-in Precognition -->
    <NoteFormComponent
      action="/dashboard/notes"
      method="post"
      :optimistic="(currentProps, data) => ({ notesCount: (currentProps.notesCount as number) + (data.body ? 1 : 0) })"
      disable-while-processing
      cancel-on-unmount
      #default="{ errors, processing, valid, validate }"
    >
      <div class="flex gap-3">
        <input
          name="body"
          type="text"
          placeholder="Add operational note..."
          class="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          @blur="validate('body')"
        />
        <button type="submit" :disabled="processing" class="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950">
          Save
        </button>
      </div>
      <p v-if="errors.body" role="alert" class="mt-1 text-xs text-rose-600">{{ errors.body }}</p>
      <p v-else-if="valid('body')" class="mt-1 text-xs text-emerald-600">Looks good</p>
    </NoteFormComponent>
  </div>
</template>
```

### Stack B: React 19+ + TypeScript (React 18 Dropped in v3)

```tsx
import type { JSX } from 'react';
import { Deferred, Form, Head, Link, useHttp } from '@inertiajs/react';
import AppLayout from '@/layouts/AppLayout';

interface DashboardProps {
  user: { id: string; name: string; email: string };
  metrics?: { total_revenue_formatted: string; gross_margin_percent: number };
  pendingCount: number;
  notesCount: number;
}

interface NoteForm {
  body: string;
}

function DashboardIndex({ user, metrics, pendingCount, notesCount }: DashboardProps): JSX.Element {
  const healthCheck = useHttp<Record<string, never>, { status: string }>({});

  return (
    <div className="space-y-6">
      <Head title="Executive Dashboard" />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-sm text-zinc-500">Pending orders: {pendingCount} · Notes: {notesCount}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" disabled={healthCheck.processing} onClick={() => void healthCheck.get('/up')}>
            Check Health
          </button>
          <Link href="/orders/create" component="admin/orders/Create" prefetch>
            New Order
          </Link>
        </div>
      </header>

      <Deferred
        data="metrics"
        fallback={<div className="h-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />}
        rescue={<p role="alert">Unable to load metrics right now.</p>}
      >
        {metrics && (
          <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <p className="text-xs font-medium uppercase text-zinc-500">Total Revenue</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{metrics.total_revenue_formatted}</p>
          </div>
        )}
      </Deferred>

      <Form<NoteForm>
        action="/dashboard/notes"
        method="post"
        optimistic={(currentProps) => ({ notesCount: (currentProps.notesCount as number) + 1 })}
        disableWhileProcessing
        cancelOnUnmount
      >
        {({ errors, processing }) => (
          <>
            <input name="body" type="text" placeholder="Add operational note..." />
            {errors.body && <p role="alert">{errors.body}</p>}
            <button type="submit" disabled={processing}>Save</button>
          </>
        )}
      </Form>
    </div>
  );
}

// IMPORTANT (Inertia v3 React breaking change):
// Wrap arrow-function layout components in an array or tuple so Inertia does not treat them as render callbacks.
DashboardIndex.layout = [[AppLayout, { title: 'Executive Dashboard' }]];

export default DashboardIndex;
```

### Stack C: Svelte 5+ Runes + TypeScript (Svelte 4 Dropped in v3)

```svelte
<script module lang="ts">
  import AppLayout from '@/layouts/AppLayout.svelte';
  export const layout = [AppLayout, { title: 'Executive Dashboard' }];
</script>

<script lang="ts">
  import { Deferred, Head, Link, useHttp } from '@inertiajs/svelte';

  interface Props {
    user: { id: string; name: string; email: string };
    metrics?: { total_revenue_formatted: string; gross_margin_percent: number };
    pendingCount: number;
  }

  let { user, metrics, pendingCount }: Props = $props();
  const exportHttp = useHttp<{ format: string }, { download_url: string }>({ format: 'csv' });
  let downloadUrl = $state<string | null>(null);

  async function handleExport(): Promise<void> {
    const result = await exportHttp.post('/api/v1/reports/export');
    downloadUrl = result.download_url;
  }
</script>

<Head title="Executive Dashboard" />

<section class="space-y-6">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p class="text-sm text-zinc-500">Pending orders: {pendingCount}</p>
    </div>
    <Link href="/orders/create" component="admin/orders/Create" prefetch>New Order</Link>
  </header>

  <Deferred data="metrics">
    {#snippet fallback()}
      <div class="h-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"></div>
    {/snippet}

    {#snippet rescue()}
      <p role="alert">Unable to load metrics right now.</p>
    {/snippet}

    {#if metrics}
      <div class="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <p class="text-xs font-medium uppercase text-zinc-500">Total Revenue</p>
        <p class="mt-1 text-3xl font-bold tabular-nums">{metrics.total_revenue_formatted}</p>
      </div>
    {/if}
  </Deferred>

  <div class="flex items-center gap-3">
    <button type="button" disabled={exportHttp.processing} onclick={() => void handleExport()}>
      {exportHttp.processing ? 'Exporting...' : 'Export CSV'}
    </button>
    {#if downloadUrl}
      <a href={downloadUrl} download class="text-sm font-medium underline">Download CSV</a>
    {/if}
  </div>
</section>
```

---

## 5. `@inertiajs/vite` Zero-Config Setup, Dev SSR, Blade Components & Interceptors

### A. `vite.config.ts` (Vite 7 / 8 + Built-In Dev SSR)
```typescript
import inertia from '@inertiajs/vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/css/app.css', 'resources/js/app.ts'],
      refresh: true,
    }),
    // Automatically handles page resolution, code splitting, and out-of-the-box Dev SSR (no separate Node SSR daemon in dev)
    inertia(),
    vue({
      template: {
        transformAssetUrls: { base: null, includeAbsolute: false },
      },
    }),
  ],
  resolve: {
    alias: { '@': '/resources/js' },
  },
});
```

### B. Zero-Config `resources/js/app.ts` + Built-in XHR Interceptors + Live Props
```typescript
import { createInertiaApp, http } from '@inertiajs/vue3';
import { echo } from '@inertiajs/vue3/echo';
import { configureEcho } from '@laravel/echo-vue';

// Configure Echo before enabling `live: echo()` (or pass `echo({ resolve: () => window.Echo })`)
configureEcho({
  broadcaster: 'reverb',
});

// Global built-in XHR interceptors (Axios is no longer required)
http.onRequest((config) => {
  config.headers['X-Client-Version'] = '3.11';
  return config;
});

createInertiaApp({
  live: echo(), // Enable Inertia::live() over Laravel Echo (v3.11+)
  withApp(app, { ssr, page }) {
    // Vue: register plugins on `app` (e.g. `app.use(i18n)`)
    // React 19: use `@inertiajs/react` (supports `strictMode: true`) and return `<ThemeProvider>{app}</ThemeProvider>`
    // Svelte 5: `app.set('locale', page.props.locale)`
    void ssr;
    void page;
  },
});
```

### C. Root Blade Layout (`resources/views/app.blade.php` — v3 Blade Components)
```blade
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <x-inertia::head>
        <title>{{ config('app.name') }}</title>
    </x-inertia::head>
    @vite(['resources/css/app.css', 'resources/js/app.ts'])
</head>
<body class="antialiased">
    <x-inertia::app />
</body>
</html>
```

### D. First-Class Exception Handling (`AppServiceProvider::boot()`)
```php
<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Inertia\ExceptionResponse;
use Inertia\Inertia;

final class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Inertia::handleExceptionsUsing(static function (ExceptionResponse $response) {
            if (in_array($response->statusCode(), [403, 404, 500, 503], true)) {
                return $response
                    ->render('errors/Index', [
                        'status' => $response->statusCode(),
                        'traceId' => (string) $response->request->attributes->get('trace_id', ''),
                    ])
                    ->withSharedData();
            }

            return null;
        });
    }
}
```

---

## 6. Pest 3 Inertia v3 Testing

```php
<?php

declare(strict_types=1);

use App\Models\RevenueMetric;
use App\Models\Team;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('renders dashboard with user, deferred metrics, and flash data', function (): void {
    $team = Team::factory()->create();
    $user = User::factory()->create([
        'name' => 'Clark Kent',
        'email' => 'clark@dailyplanet.com',
        'current_team_id' => $team->id,
    ]);
    RevenueMetric::factory()->create(['team_id' => $team->id]);

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/dashboard/Index')
            ->has('user', fn (Assert $prop) => $prop
                ->where('id', $user->id)
                ->where('name', 'Clark Kent')
                ->where('email', 'clark@dailyplanet.com'),
            )
            ->loadDeferredProps('analytics', fn (Assert $reload) => $reload
                ->has('metrics.total_revenue_formatted'),
            ),
        );
});
```

---

## 7. Inertia v2 → v3 Breaking Changes & Anti-Hallucination Guard

| Removed / Changed in v3 | Correct Inertia v3 Replacement |
| :--- | :--- |
| `Inertia::lazy()` / `LazyProp` (Removed) | `Inertia::optional(fn () => ...)` |
| `router.on('invalid', ...)` / `router.on('exception', ...)` | `router.on('httpException', ...)` / `router.on('networkError', ...)` |
| `router.cancel()` (Removed) | `router.cancelAll()` (or `router.cancelAll({ async: false, prefetch: false })`) |
| `hideProgress()` / `revealProgress()` (Removed) | `progress.hide()` / `progress.reveal()` |
| `axios` bundled by default | Built-in XHR client + `http.onRequest/onResponse/onError` (opt-in `axiosAdapter()` from `@inertiajs/core`) |
| `future.*` config & `pages.use_data_attribute_for_initial_page` | Permanently enabled (`<script type="application/json">`, `<title data-inertia>`, `<dialog>`) |
| `config/inertia.php` `testing.page_paths` / `page_extensions` | Moved to `pages.paths` (default `resource_path('js/pages')`) & `pages.extensions` |
| React 18 / Svelte 4 / CommonJS `require()` / Node < 22 SSR | React 19+ / Svelte 5+ Runes / ESM-only ES2022 / Node 22+ SSR |
| React `Page.layout = ArrowLayout` | `Page.layout = [ArrowLayout]` (or `[[ArrowLayout, { ... }]]`) |
| Fabricated `useLayoutProps()` or `<Prefetch>` component | **Do not exist** — use `setLayoutProps()`/`resetLayoutProps()` and `<Link prefetch>` / `usePrefetch()` |

---

## 8. Architectural Reference

Read the complete master architectural guide in [inertia-and-frontend-stacks.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/inertia-and-frontend-stacks.md) and [frontend-layouts-components-and-pages.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/frontend-layouts-components-and-pages.md) for full `config/inertia.php` v3.8.0 tuning, `<InfiniteScroll>`, `<WhenMounted>`, `usePoll()`, Live Props broadcasting, BigInt preservation, and the v2 → v3 migration runbook.
