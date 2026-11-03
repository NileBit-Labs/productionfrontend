<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime } from '@/lib/format'

type Connection = {
  id: number
  created_at: string
  expires_at: string | null
  last_used_at: string | null
}
const connections = ref<Connection[]>([])
const loading = ref(true)
const busy = ref<number | null>(null)
const confirm = ref<number | null>(null)
const error = ref('')
const notice = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    connections.value = await apiFetch<Connection[]>('/auth/connections')
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}
async function disconnect(id: number) {
  if (busy.value !== null) return
  busy.value = id
  error.value = ''
  notice.value = ''
  try {
    await apiFetch(`/auth/connections/${id}`, { method: 'DELETE' })
    connections.value = connections.value.filter((entry) => entry.id !== id)
    confirm.value = null
    notice.value = 'WhatsApp connection disconnected. Your POS records and web session are unchanged.'
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    busy.value = null
  }
}
onMounted(load)
</script>

<template>
  <section aria-labelledby="whatsapp-connections-title">
    <div class="connection-head">
      <h2 id="whatsapp-connections-title">WhatsApp connections</h2>
      <button class="btn" type="button" :disabled="loading || busy !== null" @click="load">Refresh</button>
    </div>
    <p class="connection-hint">Manage this account’s access from NileBit POS on WhatsApp. Disconnect a connection if you lose your phone or no longer use it.</p>
    <p v-if="loading" role="status">Loading connections…</p>
    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="!loading && !error && connections.length === 0" class="connection-hint">No WhatsApp connections on this account.</p>
    <ul v-if="!loading && connections.length" class="connection-list">
      <li v-for="entry in connections" :key="entry.id">
        <strong>WhatsApp session #{{ entry.id }}</strong>
        <dl>
          <div><dt>Connected</dt><dd>{{ formatDateTime(entry.created_at) }}</dd></div>
          <div><dt>Last used</dt><dd>{{ entry.last_used_at ? formatDateTime(entry.last_used_at) : 'Not used yet' }}</dd></div>
          <div v-if="entry.expires_at"><dt>Expires</dt><dd>{{ formatDateTime(entry.expires_at) }}</dd></div>
        </dl>
        <div v-if="confirm === entry.id" class="connection-confirm">
          <p>Disconnect this WhatsApp session? All businesses using this connection will need to reconnect. Your POS data stays saved.</p>
          <div class="connection-actions">
            <button class="btn" type="button" :disabled="busy !== null" @click="confirm = null">Keep connected</button>
            <button class="btn btn-primary" type="button" :disabled="busy !== null" @click="disconnect(entry.id)">{{ busy === entry.id ? 'Disconnecting…' : 'Confirm disconnect' }}</button>
          </div>
        </div>
        <button v-else class="btn" type="button" :disabled="busy !== null" @click="confirm = entry.id">Disconnect session #{{ entry.id }}</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.connection-head,.connection-actions{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap}
h2{font-size:1rem;margin:0}.connection-hint,dt{color:var(--color-ink-faint);font-size:.8125rem}
.connection-list{list-style:none;margin:0;padding:0;display:grid;gap:1rem}.connection-list li{border:1px solid var(--color-border);border-radius:var(--radius-md);padding:1rem;display:grid;gap:.75rem}
dl{display:flex;flex-wrap:wrap;gap:.5rem 1.25rem;margin:0}dd{margin:0;font-size:.875rem}.connection-confirm{border-top:1px solid var(--color-border);padding-top:.75rem}.connection-confirm p{font-size:.875rem;margin:0 0 .75rem}.connection-list .btn{justify-self:start}
</style>
