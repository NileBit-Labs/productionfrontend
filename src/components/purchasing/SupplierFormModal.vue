<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch, fieldErrors } from '@/lib/api'
import type { Supplier } from '@/types/purchasing'

const props = defineProps<{ supplier?: Supplier }>()
const emit = defineEmits<{ close: []; saved: [supplier: Supplier] }>()

const editing = computed(() => !!props.supplier)

const form = reactive({
  name: props.supplier?.name ?? '',
  phone: props.supplier?.phone ?? '',
  email: props.supplier?.email ?? '',
  address: props.supplier?.address ?? '',
  notes: props.supplier?.notes ?? '',
  is_active: props.supplier?.is_active ?? true,
})

const saving = ref(false)
const error = ref('')
const errors = ref<Record<string, string>>({})

async function save() {
  saving.value = true
  error.value = ''
  errors.value = {}
  const body = {
    name: form.name.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    notes: form.notes.trim() || null,
    ...(editing.value ? { is_active: form.is_active } : {}),
  }
  try {
    const saved = editing.value
      ? await apiFetch<Supplier>(`/suppliers/${props.supplier!.id}`, { method: 'PATCH', body })
      : await apiFetch<Supplier>('/suppliers', { method: 'POST', body })
    emit('saved', saved)
  } catch (e) {
    errors.value = fieldErrors(e)
    error.value = Object.keys(errors.value).length
      ? 'Please fix the highlighted fields.'
      : apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :title="editing ? 'Edit supplier' : 'Add supplier'" @close="emit('close')">
    <form class="form" @submit.prevent="save">
      <p v-if="error" class="alert-danger">{{ error }}</p>

      <div class="field">
        <label for="s-name">Name</label>
        <input id="s-name" v-model="form.name" type="text" required maxlength="150" autofocus />
        <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
      </div>

      <div class="row">
        <div class="field">
          <label for="s-phone">Phone</label>
          <input id="s-phone" v-model="form.phone" type="tel" maxlength="30" />
          <span v-if="errors.phone" class="field-error">{{ errors.phone }}</span>
        </div>
        <div class="field">
          <label for="s-email">Email</label>
          <input id="s-email" v-model="form.email" type="email" maxlength="255" />
          <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
        </div>
      </div>

      <div class="field">
        <label for="s-address">Address</label>
        <input id="s-address" v-model="form.address" type="text" maxlength="255" />
      </div>

      <div class="field">
        <label for="s-notes">Notes</label>
        <input
          id="s-notes"
          v-model="form.notes"
          type="text"
          maxlength="1000"
          placeholder="e.g. Delivers on Tuesdays, 30 days credit"
        />
      </div>

      <label v-if="editing" class="check">
        <input v-model="form.is_active" type="checkbox" />
        <span>Active <small>— inactive suppliers can't be used for new purchases</small></span>
      </label>

      <button
        type="submit"
        class="btn btn-primary btn-block"
        :disabled="saving || !form.name.trim()"
      >
        {{ saving ? 'Saving…' : 'Save supplier' }}
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

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.875rem;
}

.check small {
  color: var(--color-ink-faint);
}

@media (max-width: 520px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
