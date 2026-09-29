<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <main class="page">
    <div class="empty card">
      <p class="eyebrow">{{ (route.meta.owner as string) ?? 'Coming soon' }}</p>
      <h1>{{ route.meta.title }}</h1>
      <p class="body">
        This module is being built as part of the team's rollout. It'll appear here once it's ready.
      </p>
    </div>
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  padding: 2rem 1.5rem;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty {
  padding: 2.5rem;
  text-align: center;
  width: 100%;
}

.eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-primary);
}

h1 {
  margin-top: 0.375rem;
  font-size: 1.25rem;
}

.body {
  margin-top: 0.5rem;
  color: var(--color-ink-faint);
  font-size: 0.9375rem;
}
</style>
