<script setup lang="ts">
import ThemeToggle from '@/components/ThemeToggle.vue'
import brandLockupUrl from '@/assets/brand/nilebit-pos-for-retail.svg'

withDefaults(
  defineProps<{
    title: string
    subtitle: string
    eyebrow?: string
    wide?: boolean
    compactBrand?: boolean
  }>(),
  {
    eyebrow: undefined,
    wide: false,
    compactBrand: false,
  },
)
</script>

<template>
  <main class="auth-page">
    <div class="theme-toggle-corner">
      <ThemeToggle />
    </div>

    <section class="auth-card card" :class="{ 'auth-card--wide': wide }">
      <img
        class="brand-lockup"
        :class="{ 'brand-lockup--compact': compactBrand }"
        :src="brandLockupUrl"
        alt="NileBit POS for Retail"
      />
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p class="subtitle">{{ subtitle }}</p>
      <slot />
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 1.5rem;
}

.theme-toggle-corner {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
}

.auth-card {
  width: 100%;
  max-width: 380px;
  min-width: 0;
  padding: 2rem;
  text-align: center;
}

.auth-card--wide {
  max-width: 460px;
}

.brand-lockup {
  display: block;
  width: min(100%, 252px);
  height: auto;
  margin: 0 auto 1.125rem;
}

.brand-lockup--compact {
  width: min(100%, 210px);
  margin-bottom: 1rem;
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

.subtitle {
  margin-top: 0.375rem;
  color: var(--color-ink-faint);
  font-size: 0.875rem;
}

.auth-card :deep(.field),
.auth-card :deep(.field-row > .field) {
  min-width: 0;
}

.auth-card :deep(.field input),
.auth-card :deep(.field select) {
  width: 100%;
  min-width: 0;
}

@media (max-width: 640px) {
  .auth-page {
    align-items: flex-start;
    padding: 5rem 1rem 1rem;
  }

  .theme-toggle-corner {
    top: 1rem;
    right: 1rem;
  }

  .auth-card {
    padding: 1.5rem;
  }

  .brand-lockup {
    width: min(100%, 220px);
  }

  .brand-lockup--compact {
    width: min(100%, 190px);
  }
}
</style>
