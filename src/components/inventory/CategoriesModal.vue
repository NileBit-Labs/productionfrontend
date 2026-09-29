<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { useCategoriesStore } from '@/stores/categories'
import type { Category } from '@/types/inventory'

const emit = defineEmits<{ close: []; changed: [] }>()
const categories = useCategoriesStore()

const newName = ref('')
const editingId = ref<number | null>(null)
const editName = ref('')
const error = ref('')

onMounted(() => void categories.load())

async function run(fn: () => Promise<unknown>) {
  error.value = ''
  try {
    await fn()
    await categories.load()
    emit('changed')
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

const add = () =>
  run(async () => {
    await apiFetch('/categories', { method: 'POST', body: { name: newName.value } })
    newName.value = ''
  })

function startEdit(category: Category) {
  editingId.value = category.id
  editName.value = category.name
}

const saveEdit = (category: Category) =>
  run(async () => {
    await apiFetch(`/categories/${category.id}`, {
      method: 'PATCH',
      body: { name: editName.value },
    })
    editingId.value = null
  })

function remove(category: Category) {
  const n = category.products_count ?? 0
  if (
    n &&
    !window.confirm(
      `${n} product${n === 1 ? '' : 's'} in "${category.name}" will become uncategorised. Delete it?`,
    )
  ) {
    return
  }
  return run(() => apiFetch(`/categories/${category.id}`, { method: 'DELETE' }))
}
</script>

<template>
  <BaseModal title="Categories" @close="emit('close')">
    <p v-if="error" class="alert-danger">{{ error }}</p>

    <form class="add" @submit.prevent="add">
      <input
        v-model="newName"
        type="text"
        placeholder="New category"
        maxlength="100"
        aria-label="New category name"
      />
      <button type="submit" class="btn btn-primary" :disabled="!newName.trim()">Add</button>
    </form>

    <ul class="list">
      <li v-for="category in categories.list" :key="category.id">
        <template v-if="editingId === category.id">
          <input
            v-model="editName"
            type="text"
            maxlength="100"
            :aria-label="`Rename ${category.name}`"
            @keydown.enter.prevent="saveEdit(category)"
          />
          <button type="button" class="link" @click="saveEdit(category)">Save</button>
          <button type="button" class="link muted" @click="editingId = null">Cancel</button>
        </template>
        <template v-else>
          <span class="name">{{ category.name }}</span>
          <span class="count"
            >{{ category.products_count }} product{{
              category.products_count === 1 ? '' : 's'
            }}</span
          >
          <button type="button" class="link" @click="startEdit(category)">Rename</button>
          <button type="button" class="link danger" @click="remove(category)">Delete</button>
        </template>
      </li>
      <li v-if="!categories.list.length" class="empty">No categories yet.</li>
    </ul>
  </BaseModal>
</template>

<style scoped>
.add {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

input {
  flex: 1;
  min-height: 40px;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.9375rem;
  outline: none;
}

input:focus {
  border-color: var(--color-primary);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}

.list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
}

.name {
  flex: 1;
  font-weight: 500;
}

.count {
  color: var(--color-ink-faint);
  font-size: 0.75rem;
}

.link {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  cursor: pointer;
}

.link.muted {
  color: var(--color-ink-faint);
}

.link.danger {
  color: var(--color-danger);
}

.empty {
  justify-content: center;
  color: var(--color-ink-faint);
}
</style>
