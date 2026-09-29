<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <svg
    class="nav-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <template v-if="name === 'dashboard'">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </template>

    <template v-else-if="name === 'sell'">
      <path d="M3 4h2l2.2 12.2a2 2 0 0 0 2 1.8h7.6a2 2 0 0 0 2-1.6L21 8H6.2" />
      <circle cx="9.5" cy="20.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="20.5" r="1.2" fill="currentColor" stroke="none" />
    </template>

    <template v-else-if="name === 'sales'">
      <line x1="5" y1="6" x2="19" y2="6" />
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="5" y1="18" x2="14" y2="18" />
    </template>

    <template v-else-if="name === 'shifts'">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </template>

    <template v-else-if="name === 'products'">
      <rect x="4" y="7" width="16" height="13" rx="1.5" />
      <path d="M4 11h16" />
      <path d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7" />
    </template>

    <template v-else-if="name === 'inventory'">
      <polyline points="3 7 12 3 21 7 12 11 3 7" />
      <polyline points="3 12 12 16 21 12" />
      <polyline points="3 17 12 21 21 17" />
    </template>

    <template v-else-if="name === 'purchases'">
      <rect x="2" y="8" width="12" height="9" rx="1" />
      <path d="M14 11h4l4 3v3h-8z" />
      <circle cx="7" cy="19" r="1.6" />
      <circle cx="17.5" cy="19" r="1.6" />
    </template>

    <template v-else-if="name === 'suppliers'">
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <line x1="8" y1="7" x2="8" y2="7.01" />
      <line x1="12" y1="7" x2="12" y2="7.01" />
      <line x1="16" y1="7" x2="16" y2="7.01" />
      <line x1="8" y1="11" x2="8" y2="11.01" />
      <line x1="12" y1="11" x2="12" y2="11.01" />
      <line x1="16" y1="11" x2="16" y2="11.01" />
      <path d="M9 21v-4h6v4" />
    </template>

    <template v-else-if="name === 'customers'">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <path d="M16 4.5a3 3 0 0 1 0 5.8" />
      <path d="M20 20c0-2.8-1.7-5-4-5.8" />
    </template>

    <template v-else-if="name === 'credit'">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </template>

    <template v-else-if="name === 'expenses'">
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3H5" />
      <path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z" />
      <circle cx="16" cy="14" r="1.3" fill="currentColor" stroke="none" />
    </template>

    <template v-else-if="name === 'reports'">
      <line x1="5" y1="21" x2="19" y2="21" />
      <rect x="6" y="13" width="3" height="8" />
      <rect x="11" y="8" width="3" height="13" />
      <rect x="16" y="4" width="3" height="17" />
    </template>

    <template v-else-if="name === 'ask'">
      <path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3z" />
      <path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8-1.8-.7 1.8-.7z" />
    </template>

    <template v-else-if="name === 'users'">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </template>

    <template v-else-if="name === 'audit'">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </template>

    <template v-else-if="name === 'settings'">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="9" cy="7" r="1.8" fill="var(--color-surface)" />
      <circle cx="16" cy="12" r="1.8" fill="var(--color-surface)" />
      <circle cx="10" cy="17" r="1.8" fill="var(--color-surface)" />
    </template>
  </svg>
</template>

<style scoped>
.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
</style>
