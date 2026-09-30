<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import { useShopStore } from '@/stores/shop'
import { ApiError, useAuthStore } from '@/stores/auth'
import { PRODUCTION_BUSINESS_TYPES } from '@/lib/businessTypes'

const router = useRouter()
const shopStore = useShopStore()
const auth = useAuthStore()

const name = ref('')
const businessType = ref('')
const phone = ref('')
const address = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await shopStore.createShop({
      name: name.value,
      business_type: businessType.value,
      phone: phone.value || undefined,
      address: address.value || undefined,
    })
    await auth.fetchMe()
    await router.push('/')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    title="Set up your production location"
    subtitle="This is the factory, production site, warehouse, or selling outlet under your business."
    eyebrow="Step 2 of 2"
    wide
    compact-brand
  >

      <form class="setup-form" @submit.prevent="onSubmit">
        <p v-if="error" class="alert-danger">{{ error }}</p>

        <div class="field">
          <label for="name">Outlet / production location name</label>
          <input
            id="name"
            v-model="name"
            type="text"
            required
            placeholder="Main Factory or Kampala Outlet"
          />
        </div>

        <div class="field">
          <label for="business_type">Business type</label>
          <select id="business_type" v-model="businessType" required>
            <option value="" disabled>Choose one</option>
            <option v-for="type in PRODUCTION_BUSINESS_TYPES" :key="type.value" :value="type.value">
              {{ type.label }}
            </option>
          </select>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="phone">Phone <span class="optional">(optional)</span></label>
            <input id="phone" v-model="phone" type="tel" />
          </div>

          <div class="field">
            <label for="address">Address <span class="optional">(optional)</span></label>
            <input id="address" v-model="address" type="text" />
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? 'Creating…' : 'Create location' }}
        </button>
      </form>
  </AuthShell>
</template>

<style scoped>
.setup-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.75rem;
}

.field-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
}

.field-row > .field {
  min-width: 0;
}

.optional {
  font-weight: 400;
  color: var(--color-ink-faint);
}

@media (max-width: 640px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
