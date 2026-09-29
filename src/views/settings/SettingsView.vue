<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useShopStore, type Shop } from '@/stores/shop'
import { useThemeStore, type Theme } from '@/stores/theme'

const auth = useAuthStore()
const shopStore = useShopStore()
const themeStore = useThemeStore()

const roleName = computed(() => {
  const role = auth.currentRole
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : ''
})

// ---- Shop ----------------------------------------------------------------

const shop = shopStore.currentShop
const shopForm = ref({
  name: shop?.name ?? '',
  business_type: shop?.business_type ?? '',
  phone: shop?.phone ?? '',
  address: shop?.address ?? '',
})
const shopBusy = ref(false)
const shopError = ref('')
const shopSaved = ref(false)

async function saveShop() {
  if (!shop) return
  shopBusy.value = true
  shopError.value = ''
  shopSaved.value = false
  try {
    const updated = await apiFetch<Shop>(`/shops/${shop.id}`, {
      method: 'PATCH',
      body: {
        ...shopForm.value,
        phone: shopForm.value.phone || null,
        address: shopForm.value.address || null,
      },
    })
    shopStore.setCurrentShop(updated)
    await auth.fetchMe()
    shopSaved.value = true
  } catch (e) {
    shopError.value = apiErrorMessage(e)
  } finally {
    shopBusy.value = false
  }
}

// ---- Appearance ------------------------------------------------------------

const themes: { value: Theme; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Best in a bright shop' },
  { value: 'dark', label: 'Dark', hint: 'Easier on the eyes at night' },
  { value: 'system', label: 'Match device', hint: 'Follows your phone or computer' },
]

// ---- Password ----------------------------------------------------------------

const pw = ref({ current: '', next: '', again: '' })
const pwBusy = ref(false)
const pwError = ref('')
const pwSaved = ref(false)

const pwMismatch = computed(() => pw.value.again !== '' && pw.value.next !== pw.value.again)

async function changePassword() {
  pwBusy.value = true
  pwError.value = ''
  pwSaved.value = false
  try {
    await apiFetch('/auth/change-password', {
      method: 'POST',
      body: { current_password: pw.value.current, password: pw.value.next },
    })
    pw.value = { current: '', next: '', again: '' }
    pwSaved.value = true
  } catch (e) {
    pwError.value = apiErrorMessage(e)
  } finally {
    pwBusy.value = false
  }
}
</script>

<template>
  <main class="page">
    <header>
      <p class="eyebrow">Admin</p>
      <h1>Settings</h1>
    </header>

    <section class="card block">
      <div class="block-head">
        <h2>Shop</h2>
        <p v-if="!auth.isOwner" class="hint">Only the owner can change these details.</p>
      </div>

      <form class="grid" @submit.prevent="saveShop">
        <div class="field">
          <label for="shop-name">Shop name</label>
          <input
            id="shop-name"
            v-model="shopForm.name"
            type="text"
            required
            :disabled="!auth.isOwner"
          />
        </div>
        <div class="field">
          <label for="shop-type">Type of business</label>
          <input
            id="shop-type"
            v-model="shopForm.business_type"
            type="text"
            required
            :disabled="!auth.isOwner"
          />
        </div>
        <div class="field">
          <label for="shop-phone">Phone</label>
          <input id="shop-phone" v-model="shopForm.phone" type="tel" :disabled="!auth.isOwner" />
        </div>
        <div class="field">
          <label for="shop-address">Address</label>
          <input
            id="shop-address"
            v-model="shopForm.address"
            type="text"
            :disabled="!auth.isOwner"
          />
        </div>

        <dl class="facts">
          <div>
            <dt>Business</dt>
            <dd>{{ auth.user?.organization?.name ?? '—' }}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{{ auth.user?.organization?.default_currency ?? 'UGX' }}</dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>{{ auth.user?.organization?.timezone ?? 'Africa/Kampala' }}</dd>
          </div>
        </dl>

        <div v-if="auth.isOwner" class="actions">
          <p v-if="shopError" class="alert-danger">{{ shopError }}</p>
          <p v-if="shopSaved" class="saved" role="status">Saved.</p>
          <button type="submit" class="btn btn-primary" :disabled="shopBusy">
            {{ shopBusy ? 'Saving…' : 'Save shop details' }}
          </button>
        </div>
      </form>
    </section>

    <section class="card block">
      <div class="block-head">
        <h2>Appearance</h2>
        <p class="hint">Saved on this device only.</p>
      </div>
      <div class="themes" role="radiogroup" aria-label="Theme">
        <button
          v-for="t in themes"
          :key="t.value"
          type="button"
          role="radio"
          class="theme"
          :class="{ active: themeStore.theme === t.value }"
          :aria-checked="themeStore.theme === t.value"
          @click="themeStore.setTheme(t.value)"
        >
          <span class="theme-name">{{ t.label }}</span>
          <span class="theme-hint">{{ t.hint }}</span>
        </button>
      </div>
    </section>

    <section class="card block">
      <div class="block-head">
        <h2>Your account</h2>
      </div>
      <dl class="facts">
        <div>
          <dt>Name</dt>
          <dd>{{ auth.user?.name }}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{{ auth.user?.email }}</dd>
        </div>
        <div>
          <dt>Role in this shop</dt>
          <dd>{{ roleName }}</dd>
        </div>
      </dl>

      <form class="grid password" @submit.prevent="changePassword">
        <h3>Change password</h3>
        <div class="field">
          <label for="pw-current">Current password</label>
          <input
            id="pw-current"
            v-model="pw.current"
            type="password"
            required
            autocomplete="current-password"
          />
        </div>
        <div class="field">
          <label for="pw-next">New password</label>
          <input
            id="pw-next"
            v-model="pw.next"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
          />
        </div>
        <div class="field">
          <label for="pw-again">Type it again</label>
          <input
            id="pw-again"
            v-model="pw.again"
            type="password"
            required
            autocomplete="new-password"
          />
          <p v-if="pwMismatch" class="hint bad">The two passwords don't match.</p>
        </div>

        <div class="actions">
          <p v-if="pwError" class="alert-danger">{{ pwError }}</p>
          <p v-if="pwSaved" class="saved" role="status">
            Password changed. Any other device you were signed in on has been signed out.
          </p>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="pwBusy || pwMismatch || pw.next.length < 8 || !pw.current"
          >
            {{ pwBusy ? 'Changing…' : 'Change password' }}
          </button>
        </div>
      </form>
    </section>

    <section v-if="auth.isOwner" class="card block">
      <div class="block-head">
        <h2>Activity</h2>
      </div>
      <p class="hint">
        See who voided a sale, refunded a customer, changed an expense or closed a shift, and when.
      </p>
      <RouterLink to="/audit-log" class="link">Open the audit log →</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 1.75rem 2rem 2.5rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 1.25rem;
}

.eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-primary);
}

h1 {
  margin-top: 0.25rem;
  font-size: 1.5rem;
}

.page > header {
  grid-column: 1 / -1;
}

@media (max-width: 1100px) {
  .page {
    grid-template-columns: 1fr;
  }
}

.block {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.block-head h2 {
  font-size: 1rem;
}

h3 {
  grid-column: 1 / -1;
  font-size: 0.875rem;
}

.hint {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.hint.bad {
  color: var(--color-danger);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.field input:disabled {
  background: var(--color-canvas);
  color: var(--color-ink-soft);
}

.facts {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem 2.5rem;
  margin: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--color-border);
}

.facts dt {
  color: var(--color-ink-faint);
  font-size: 0.75rem;
}

.facts dd {
  margin: 0.125rem 0 0;
  font-weight: 500;
}

.password {
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.actions .btn {
  margin-left: auto;
}

.saved {
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 500;
}

.themes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.theme {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}

.theme:hover {
  border-color: var(--color-primary);
}

.theme.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.theme-name {
  font-weight: 600;
}

.theme-hint {
  color: var(--color-ink-faint);
  font-size: 0.75rem;
}

@media (max-width: 720px) {
  .page {
    padding: 1.25rem 1rem;
  }

  .grid,
  .themes {
    grid-template-columns: 1fr;
  }
}
</style>
