---
name: laravel-frontend-layouts-and-pages
description: Standardized directory organization, multi-domain layouts (admin, customer, auth, public), component categorization (ui, icon, app/*), and page structure across Blade, Livewire v3/v4, Vue 3 (TS), React 19 (TS), and Svelte 5.
---

# Laravel 13 Frontend Layouts, Components & Pages Organization Skill

This skill governs the canonical directory structure, layout boundaries, domain-driven component scoping, and page hierarchy across all frontend technologies in Laravel 13 & PHP 8.5+: **Blade**, **Livewire (v3 & v4)**, and **Inertia.js v2** (**Vue 3**, **React 19/18**, **Svelte 5**).

---

## 1. When to Use This Skill

Activate this skill when:
- Scaffolding new application layouts (`layouts/app`, `layouts/auth`, `layouts/customer`, `layouts/admin`).
- Organizing frontend components into domain-specific chrome (`components/app/*`), UI primitives (`components/ui/*`), or SVG glyphs (`components/icon/*`).
- Creating feature screens and page templates (`pages/admin/dashboard/index`, `pages/customer/dashboard/index`, `pages/home/index`).
- Enforcing structural consistency across full-stack Blade/Livewire and Inertia.js SPAs.
- Connecting controllers with page templates via `view('pages.<domain>.<feature>.index')` or `Inertia::render('<domain>/<feature>/Index')`.
- Writing Pest 3 view and layout assertion tests.

---

## 2. The 4-Tier Frontend Architectural Rules

1. **Zero Root Template Sprawl**:
   - NEVER dump random `.blade.php`, `.vue`, `.tsx`, or `.svelte` files directly in `resources/views/` or `resources/js/`.
   - Every file must belong to one of four canonical directories:
     - `layouts/`: Master application shells.
     - `components/app/<domain>/`: Domain-specific chrome (`header`, `nav`, `footer`, `sidebar`).
     - `components/ui/` & `components/icon/`: Reusable, atomic UI primitives and SVG icons.
     - `pages/<domain>/<feature>/`: Feature page entrypoints.
2. **Strict Layout Isolation**:
   - `layouts/app`: Base authenticated layout for shared dashboard features.
   - `layouts/auth`: Unauthenticated authentication flow (login, register, forgot-password).
   - `layouts/customer`: Customer-facing self-service portal, billing, and account management.
   - `layouts/admin`: Back-office control panel with persistent sidebar, breadcrumbs, and metrics.
   - `layouts/public`: Unauthenticated marketing, pricing, landing pages, and documentation.
3. **Domain Component Scoping (`components/app/`)**:
   - Place domain chrome exclusively inside `components/app/<domain>/`:
     - `components/app/admin/`: `header`, `nav`, `footer`, `sidebar`
     - `components/app/customer/`: `header`, `nav`, `footer`, `sidebar`
     - `components/app/auth/`: `header`, `nav`, `footer`
     - `components/app/public/`: `header`, `nav`, `footer`
4. **Pure UI Primitives (`components/ui/`)**:
   - Keep `components/ui/` completely free of business logic and database queries.
   - UI primitives (`button`, `input`, `modal`, `card`, `badge`, `table`, `dropdown`) must accept properties via `@props` or TypeScript interfaces.
5. **Page Hierarchy Matching Controllers**:
   - Page paths must follow `<domain>/<feature>/index` (e.g., `pages/admin/dashboard/index`, `pages/customer/dashboard/index`, `pages/home/index`).

---

## 3. Directory Layout Matrix

### Blade & Livewire v3/v4 (`resources/views/`)

```text
resources/views/
├── layouts/
│   ├── app.blade.php
│   ├── auth.blade.php
│   ├── customer.blade.php
│   ├── admin.blade.php
│   └── public.blade.php
├── components/
│   ├── app/
│   │   ├── admin/      (header, nav, footer, sidebar)
│   │   ├── customer/   (header, nav, footer, sidebar)
│   │   ├── auth/       (header, nav, footer)
│   │   └── public/     (header, nav, footer)
│   ├── ui/             (button, input, modal, card, badge, table, dropdown)
│   └── icon/           (search, user, chevron-down, check, alert-circle)
└── pages/
    ├── admin/
    │   └── dashboard/
    │       └── index.blade.php
    ├── customer/
    │   └── dashboard/
    │       └── index.blade.php
    └── home/
        └── index.blade.php
```

### Inertia.js v2 (Vue 3, React 19, Svelte 5) (`resources/js/`)

```text
resources/js/
├── layouts/
│   ├── AppLayout.[vue|tsx|svelte]
│   ├── AuthLayout.[vue|tsx|svelte]
│   ├── CustomerLayout.[vue|tsx|svelte]
│   └── AdminLayout.[vue|tsx|svelte]
├── components/
│   ├── app/
│   │   ├── admin/      (AdminHeader, AdminNav, AdminFooter, AdminSidebar)
│   │   ├── customer/   (CustomerHeader, CustomerNav, CustomerFooter, CustomerSidebar)
│   │   ├── auth/       (AuthHeader, AuthNav, AuthFooter)
│   │   └── public/     (PublicHeader, PublicNav, PublicFooter)
│   ├── ui/             (Button, Input, Modal, Card, Badge, Table, Dropdown)
│   └── icon/           (IconSearch, IconUser, IconChevronDown, IconCheck, IconAlertCircle)
└── pages/
    ├── admin/
    │   └── dashboard/
    │       └── Index.[vue|tsx|svelte]
    ├── customer/
    │   └── dashboard/
    │       └── Index.[vue|tsx|svelte]
    └── home/
        └── Index.[vue|tsx|svelte]
```

---

## 4. Implementation Patterns

### Pattern 1: Blade Admin Layout (`resources/views/layouts/admin.blade.php`)

```blade
@props(['title' => 'Admin Panel'])

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full bg-slate-900 text-slate-100">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }} - {{ config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="h-full font-sans antialiased">
    <div class="flex min-h-screen">
        <x-app.admin.sidebar />

        <div class="flex flex-1 flex-col pl-64">
            <x-app.admin.header :title="$title" />

            @isset($breadcrumbs)
                <x-app.admin.nav>
                    {{ $breadcrumbs }}
                </x-app.admin.nav>
            @endisset

            <main class="flex-1 p-6 lg:p-8">
                {{ $slot }}
            </main>

            <x-app.admin.footer />
        </div>
    </div>
    @livewireScripts
</body>
</html>
```

### Pattern 2: Blade Admin Dashboard Page (`resources/views/pages/admin/dashboard/index.blade.php`)

```blade
<x-layouts.admin title="System Dashboard">
    <x-slot:breadcrumbs>
        <li class="text-sm font-medium text-slate-400">Admin</li>
        <li class="text-sm font-medium text-slate-600">/</li>
        <li class="text-sm font-medium text-slate-200">Dashboard</li>
    </x-slot:breadcrumbs>

    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold tracking-tight text-white">System Dashboard</h1>
            <x-ui.button variant="primary">
                <x-icon.search class="h-4 w-4" />
                <span>Search Records</span>
            </x-ui.button>
        </div>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <x-ui.card>
                <p class="text-sm font-medium text-slate-400">Active Subscriptions</p>
                <p class="mt-2 text-3xl font-semibold text-white">1,429</p>
            </x-ui.card>
        </div>
    </div>
</x-layouts.admin>
```

### Pattern 3: Vue 3 + TypeScript Admin Dashboard (`resources/js/pages/admin/dashboard/Index.vue`)

```vue
<script setup lang="ts">
import AdminLayout from '@/layouts/AdminLayout.vue';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import IconSearch from '@/components/icon/IconSearch.vue';

interface MetricItem {
  label: string;
  value: string;
}

defineProps<{
  metrics: MetricItem[];
}>();
</script>

<template>
  <AdminLayout title="Admin System Overview">
    <div class="space-y-6">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-white">System Dashboard</h1>
        <Button variant="primary">
          <IconSearch class="h-4 w-4" />
          <span>Search Records</span>
        </Button>
      </header>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card v-for="(metric, idx) in metrics" :key="idx">
          <p class="text-sm text-slate-400">{{ metric.label }}</p>
          <p class="mt-2 text-3xl font-semibold text-white">{{ metric.value }}</p>
        </Card>
      </div>
    </div>
  </AdminLayout>
</template>
```

### Pattern 4: React 19/18 Admin Dashboard (`resources/js/pages/admin/dashboard/Index.tsx`)

```tsx
import React from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import IconSearch from '@/components/icon/IconSearch';

interface MetricItem {
  label: string;
  value: string;
}

interface IndexProps {
  metrics: MetricItem[];
}

export default function Index({ metrics }: IndexProps): React.JSX.Element {
  return (
    <AdminLayout title="Admin System Overview">
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">System Dashboard</h1>
          <Button variant="primary">
            <IconSearch className="h-4 w-4" />
            <span>Search Records</span>
          </Button>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {metrics.map((metric, i) => (
            <Card key={i}>
              <p className="text-sm text-slate-400">{metric.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{metric.value}</p>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
```

### Pattern 5: Svelte 5 Runes Admin Dashboard (`resources/js/pages/admin/dashboard/Index.svelte`)

```svelte
<script lang="ts">
  import AdminLayout from '@/layouts/AdminLayout.svelte';
  import Card from '@/components/ui/Card.svelte';
  import Button from '@/components/ui/Button.svelte';
  import IconSearch from '@/components/icon/IconSearch.svelte';

  interface Props {
    metrics: Array<{ label: string; value: string }>;
  }

  let { metrics }: Props = $props();
</script>

<AdminLayout title="Admin System Overview">
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-white">System Dashboard</h1>
      <Button variant="primary">
        <IconSearch class="h-4 w-4" />
        <span>Search Records</span>
      </Button>
    </header>

    <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {#each metrics as metric}
        <Card>
          <p class="text-sm text-slate-400">{metric.label}</p>
          <p class="mt-2 text-3xl font-semibold text-white">{metric.value}</p>
        </Card>
      {/each}
    </div>
  </div>
</AdminLayout>
```

---

## 5. Controller Rendering Standards

```php
declare(strict_types=1);

namespace App\Http\Controllers\Admin\Dashboard;

use App\Actions\Metrics\FetchAdminDashboardMetricsAction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;

final class ShowAdminDashboardController
{
    // Blade/Livewire Return
    public function showBlade(Request $request, FetchAdminDashboardMetricsAction $action): View
    {
        return view('pages.admin.dashboard.index', [
            'metrics' => $action->execute(),
        ]);
    }

    // Inertia.js (Vue/React/Svelte) Return
    public function showInertia(Request $request, FetchAdminDashboardMetricsAction $action): Response
    {
        return Inertia::render('admin/dashboard/Index', [
            'metrics' => $action->execute(),
        ]);
    }
}
```

---

## 6. Architectural Reference

Read the complete guide in [frontend-layouts-components-and-pages.md](file:///C:/Users/SHAMIM.IT/.gemini/config/plugins/laravel/docs/architecture/frontend-layouts-components-and-pages.md) for deeper slot architectures, Alpine dropdown traps, and multi-tenant layout switching.
