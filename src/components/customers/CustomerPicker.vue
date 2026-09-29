<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage } from '@/lib/api'
import { formatUgx } from '@/lib/format'
import { useCustomersStore } from '@/stores/customers'
import { useShopStore } from '@/stores/shop'

const emit = defineEmits<{
  close: []
  pick: [customer: { id: number; name: string; phone: string | null }]
}>()

const customers = useCustomersStore()
const shop = useShopStore()

const search = ref('')
const adding = ref(false)
const name = ref('')
const phone = ref('')
const error = ref('')
const saving = ref(false)

onMounted(() => {
  if (shop.currentShop) void customers.load(shop.currentShop.id)
})

const matches = computed(() => {
  const q = search.value.trim().toLowerCase()
  return customers.list
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone?.includes(q))
    .slice(0, 30)
})

async function addNew() {
  if (!shop.currentShop) return
  saving.value = true
  error.value = ''
  try {
    const created = await customers.create(shop.currentShop.id, {
      name: name.value,
      phone: phone.value || undefined,
    })
    emit('pick', created)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal title="Who is this sale for?" @close="emit('close')">
    <template v-if="!adding">
      <input
        v-model="search"
        class="search"
        type="search"
        placeholder="Search by name or phone…"
        autofocus
      />

      <ul class="results">
        <li v-for="customer in matches" :key="customer.id">
          <button type="button" class="result" @click="emit('pick', customer)">
            <span>
              <strong>{{ customer.name }}</strong>
              <small v-if="customer.phone">{{ customer.phone }}</small>
            </span>
            <span v-if="customer.balance > 0" class="owes"
              >owes {{ formatUgx(customer.balance) }}</span
            >
          </button>
        </li>
        <li v-if="!matches.length" class="none">
          {{ customers.loading ? 'Loading…' : 'No customers match.' }}
        </li>
      </ul>

      <button type="button" class="btn add" @click="adding = true">+ Add a new customer</button>
    </template>

    <form v-else class="form" @submit.prevent="addNew">
      <p v-if="error" class="alert-danger">{{ error }}</p>
      <div class="field">
        <label for="pc-name">Name</label>
        <input id="pc-name" v-model="name" type="text" required maxlength="255" autofocus />
      </div>
      <div class="field">
        <label for="pc-phone">Phone (optional)</label>
        <input id="pc-phone" v-model="phone" type="tel" maxlength="30" />
      </div>
      <div class="actions">
        <button type="button" class="btn" @click="adding = false">Back</button>
        <button type="submit" class="btn btn-primary" :disabled="saving || !name.trim()">
          {{ saving ? 'Adding…' : 'Add and select' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
.search {
  width: 100%;
  min-height: 44px;
  padding: 0 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.9375rem;
  outline: none;
}

.search:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.results {
  list-style: none;
  margin: 0.75rem 0;
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
}

.result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  min-height: 52px;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font-size: 0.9375rem;
  text-align: left;
  cursor: pointer;
}

.result:hover {
  background: var(--color-canvas);
}

.result small {
  display: block;
  color: var(--color-ink-faint);
}

.owes {
  color: var(--color-danger);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.none {
  padding: 1.5rem;
  text-align: center;
  color: var(--color-ink-faint);
}

.add,
.actions .btn:not(.btn-primary) {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
}

.add {
  width: 100%;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
