<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import type { Customer } from '@/types/customers'

const props = defineProps<{ customer?: Customer; canEditNotes: boolean }>()
const emit = defineEmits<{ close: []; saved: [customer: Customer] }>()

const name = ref(props.customer?.name ?? '')
const phone = ref(props.customer?.phone ?? '')
const notes = ref(props.customer?.notes ?? '')
const saving = ref(false)
const error = ref('')

async function save() {
  saving.value = true
  error.value = ''
  try {
    const body = {
      name: name.value,
      phone: phone.value || null,
      ...(props.canEditNotes ? { notes: notes.value || null } : {}),
    }
    const saved = props.customer
      ? await apiFetch<Customer>(`/customers/${props.customer.id}`, { method: 'PATCH', body })
      : await apiFetch<Customer>('/customers', { method: 'POST', body })
    emit('saved', saved)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :title="customer ? 'Edit customer' : 'Add customer'" @close="emit('close')">
    <form class="form" @submit.prevent="save">
      <p v-if="error" class="alert-danger">{{ error }}</p>

      <div class="field">
        <label for="c-name">Name</label>
        <input id="c-name" v-model="name" type="text" required maxlength="255" autofocus />
      </div>
      <div class="field">
        <label for="c-phone">Phone <span class="optional">(optional)</span></label>
        <input id="c-phone" v-model="phone" type="tel" maxlength="30" />
      </div>
      <div v-if="canEditNotes" class="field">
        <label for="c-notes">Notes <span class="optional">(optional)</span></label>
        <input id="c-notes" v-model="notes" type="text" maxlength="2000" />
      </div>

      <button type="submit" class="btn btn-primary btn-block" :disabled="saving || !name.trim()">
        {{ saving ? 'Saving…' : 'Save customer' }}
      </button>
    </form>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.optional {
  font-weight: 400;
  color: var(--color-ink-faint);
}
</style>
