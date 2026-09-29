<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import type { StaffMember, StaffRole } from '@/types/staff'

const auth = useAuthStore()

const staff = ref<StaffMember[]>([])
const loading = ref(true)
const error = ref('')
const notice = ref('')

const roleLabel: Record<StaffRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
}

const roleHint: Record<StaffRole, string> = {
  owner: 'Everything, including profit, staff and the audit log.',
  manager: 'Sales, stock, customers and reports. Can add and manage cashiers.',
  cashier: 'Sells at the till and takes customer payments.',
}

const activeCount = computed(() => staff.value.filter((s) => s.status === 'active').length)

// The same limits the server enforces, so people are only offered what will work.
function canManage(member: StaffMember): boolean {
  if (member.is_you || member.role === 'owner') return false
  return auth.isOwner || member.role === 'cashier'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    staff.value = await apiFetch<StaffMember[]>('/staff')
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function lastActive(member: StaffMember): string {
  return member.last_active_at ? formatDateTime(member.last_active_at) : 'Never signed in'
}

// ---- Add ---------------------------------------------------------------

const adding = ref(false)
const addForm = ref({ name: '', email: '', phone: '', role: 'cashier' as StaffRole, password: '' })
const addError = ref('')
const saving = ref(false)
const showPassword = ref(false)

const addableRoles = computed<StaffRole[]>(() =>
  auth.isOwner ? ['cashier', 'manager'] : ['cashier'],
)

function generatePassword(): string {
  // Easy to read out over the phone: no look-alike characters.
  const chars = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY346789'
  const bytes = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(bytes, (n) => chars[n % chars.length]).join('')
}

function openAdd() {
  addForm.value = { name: '', email: '', phone: '', role: 'cashier', password: generatePassword() }
  addError.value = ''
  showPassword.value = true
  adding.value = true
}

async function add() {
  saving.value = true
  addError.value = ''
  try {
    const body = { ...addForm.value, phone: addForm.value.phone || null }
    const created = await apiFetch<StaffMember>('/staff', { method: 'POST', body })
    adding.value = false
    notice.value = `${created.name} can now sign in with ${created.email}. Give them the password you set — they can change it under Settings.`
    await load()
  } catch (e) {
    addError.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

// ---- Manage ------------------------------------------------------------

const managing = ref<StaffMember | null>(null)
const manageError = ref('')
const manageBusy = ref(false)
const newRole = ref<StaffRole>('cashier')
const newPassword = ref('')

function openManage(member: StaffMember) {
  managing.value = member
  newRole.value = member.role
  newPassword.value = ''
  manageError.value = ''
}

async function change(body: { role?: StaffRole; status?: 'active' | 'inactive' }, done: string) {
  if (!managing.value) return
  manageBusy.value = true
  manageError.value = ''
  try {
    const updated = await apiFetch<StaffMember>(`/staff/${managing.value.id}`, {
      method: 'PATCH',
      body,
    })
    managing.value = updated
    newRole.value = updated.role
    notice.value = done.replace('{name}', updated.name)
    await load()
  } catch (e) {
    manageError.value = apiErrorMessage(e)
  } finally {
    manageBusy.value = false
  }
}

async function deactivate() {
  const name = managing.value?.name
  if (
    !window.confirm(
      `Deactivate ${name}? They will be signed out on every device straight away and cannot sign in until you reactivate them.`,
    )
  )
    return
  await change({ status: 'inactive' }, '{name} has been deactivated and signed out everywhere.')
}

async function resetPassword() {
  if (!managing.value) return
  manageBusy.value = true
  manageError.value = ''
  try {
    await apiFetch(`/staff/${managing.value.id}/password`, {
      method: 'POST',
      body: { password: newPassword.value },
    })
    notice.value = `${managing.value.name}'s password has been changed and they were signed out everywhere. Give them the new password.`
    managing.value = null
    await load()
  } catch (e) {
    manageError.value = apiErrorMessage(e)
  } finally {
    manageBusy.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Admin</p>
        <h1>Staff</h1>
        <p class="sub">
          {{ activeCount }} active {{ activeCount === 1 ? 'person' : 'people' }} can sign in to this
          shop.
        </p>
      </div>
      <button type="button" class="btn btn-primary" @click="openAdd">Add staff member</button>
    </header>

    <p v-if="notice" class="notice" role="status">
      {{ notice }}
      <button type="button" class="dismiss" aria-label="Dismiss" @click="notice = ''">×</button>
    </p>
    <p v-if="error" class="alert-danger">{{ error }}</p>

    <div class="card table-card">
      <p v-if="loading && !staff.length" class="state">Loading…</p>

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="member in staff"
              :key="member.id"
              :class="{ dim: member.status !== 'active' }"
            >
              <td>
                <div class="person">
                  <span class="avatar" aria-hidden="true">{{ member.name.slice(0, 1) }}</span>
                  <div>
                    <p class="name">
                      {{ member.name }} <span v-if="member.is_you" class="you">You</span>
                    </p>
                    <p class="email">{{ member.email }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span class="badge" :class="`role-${member.role}`">{{
                  roleLabel[member.role]
                }}</span>
              </td>
              <td>
                <span class="badge" :class="member.status === 'active' ? 'on' : 'off'">
                  {{ member.status === 'active' ? 'Active' : 'Deactivated' }}
                </span>
              </td>
              <td class="muted">{{ lastActive(member) }}</td>
              <td class="actions">
                <button
                  v-if="canManage(member)"
                  type="button"
                  class="btn-quiet"
                  @click="openManage(member)"
                >
                  Manage
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <section class="card roles">
      <h2>What each role can do</h2>
      <dl>
        <div v-for="r in ['owner', 'manager', 'cashier'] as StaffRole[]" :key="r">
          <dt>
            <span class="badge" :class="`role-${r}`">{{ roleLabel[r] }}</span>
          </dt>
          <dd>{{ roleHint[r] }}</dd>
        </div>
      </dl>
    </section>

    <BaseModal v-if="adding" title="Add staff member" @close="adding = false">
      <form class="form" @submit.prevent="add">
        <p v-if="addError" class="alert-danger">{{ addError }}</p>

        <div class="field">
          <label for="s-name">Full name</label>
          <input id="s-name" v-model="addForm.name" type="text" required maxlength="255" />
        </div>
        <div class="field">
          <label for="s-email">Email (they sign in with this)</label>
          <input id="s-email" v-model="addForm.email" type="email" required autocomplete="off" />
        </div>
        <div class="field">
          <label for="s-phone">Phone <span class="optional">(optional)</span></label>
          <input id="s-phone" v-model="addForm.phone" type="tel" maxlength="30" />
        </div>
        <div class="field">
          <label for="s-role">Role</label>
          <select id="s-role" v-model="addForm.role">
            <option v-for="r in addableRoles" :key="r" :value="r">{{ roleLabel[r] }}</option>
          </select>
          <p class="hint">{{ roleHint[addForm.role] }}</p>
        </div>
        <div class="field">
          <label for="s-pass">Password</label>
          <div class="pass-row">
            <input
              id="s-pass"
              v-model="addForm.password"
              :type="showPassword ? 'text' : 'password'"
              minlength="8"
              required
              autocomplete="new-password"
            />
            <button type="button" class="btn-quiet" @click="showPassword = !showPassword">
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
            <button
              type="button"
              class="btn-quiet"
              @click="((addForm.password = generatePassword()), (showPassword = true))"
            >
              New
            </button>
          </div>
          <p class="hint">
            At least 8 characters. Tell them this password; they can change it themselves.
          </p>
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-block"
          :disabled="saving || addForm.password.length < 8"
        >
          {{ saving ? 'Adding…' : 'Add to staff' }}
        </button>
      </form>
    </BaseModal>

    <BaseModal v-if="managing" :title="managing.name" @close="managing = null">
      <div class="form">
        <p v-if="manageError" class="alert-danger">{{ manageError }}</p>
        <p class="muted">{{ managing.email }} · {{ lastActive(managing) }}</p>

        <section v-if="auth.isOwner" class="block">
          <h3>Role</h3>
          <div class="inline">
            <select v-model="newRole" aria-label="Role">
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </select>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="manageBusy || newRole === managing.role"
              @click="change({ role: newRole }, '{name} is now a ' + newRole + '.')"
            >
              Save role
            </button>
          </div>
        </section>

        <section class="block">
          <h3>Password</h3>
          <p class="hint">Sets a new password and signs them out on every device.</p>
          <div class="inline">
            <input
              v-model="newPassword"
              type="text"
              minlength="8"
              placeholder="New password (8+ characters)"
              autocomplete="off"
              aria-label="New password"
            />
            <button
              type="button"
              class="btn btn-primary"
              :disabled="manageBusy || newPassword.length < 8"
              @click="resetPassword"
            >
              Reset
            </button>
          </div>
        </section>

        <section class="block">
          <h3>Access</h3>
          <template v-if="managing.status === 'active'">
            <p class="hint">
              Deactivating signs them out everywhere and stops them signing in. Their sales and
              history are kept.
            </p>
            <button type="button" class="btn btn-danger" :disabled="manageBusy" @click="deactivate">
              Deactivate account
            </button>
          </template>
          <template v-else>
            <p class="hint">This account is deactivated. They cannot sign in.</p>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="manageBusy"
              @click="change({ status: 'active' }, '{name} can sign in again.')"
            >
              Reactivate account
            </button>
          </template>
        </section>

        <p class="hint">Every change here is recorded in the audit log.</p>
      </div>
    </BaseModal>
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
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

.sub,
.muted,
.hint {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.sub {
  margin-top: 0.25rem;
}

.notice {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-ink);
  font-size: 0.875rem;
}

.dismiss {
  border: none;
  background: none;
  color: var(--color-ink-faint);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.table-card {
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

th {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-ink-faint);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

td {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
  vertical-align: middle;
}

tbody tr:last-child td {
  border-bottom: none;
}

tr.dim .person,
tr.dim .muted {
  opacity: 0.6;
}

.person {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
  text-transform: uppercase;
}

.name {
  font-weight: 600;
}

.email {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.you {
  margin-left: 0.25rem;
  padding: 0.0625rem 0.4rem;
  border-radius: 999px;
  background: var(--color-canvas);
  border: 1px solid var(--color-border);
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
  font-weight: 500;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--color-canvas);
  color: var(--color-ink-soft);
  border: 1px solid var(--color-border);
}

.badge.role-owner {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border-color: transparent;
}

.badge.on {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border-color: transparent;
}

.badge.off {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: transparent;
}

.actions {
  text-align: right;
}

.btn-quiet {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-quiet:hover {
  background: var(--color-canvas);
}

.btn-danger {
  background: var(--color-danger);
  color: var(--color-on-danger);
}

.btn-danger:hover:not(:disabled) {
  filter: brightness(0.92);
}

.state {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-ink-faint);
}

.roles {
  padding: 1.25rem 1.5rem;
}

.roles h2 {
  font-size: 0.9375rem;
}

.roles dl {
  margin: 0.75rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.roles dl > div {
  display: grid;
  grid-template-columns: 96px 1fr;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.roles dd {
  margin: 0;
  color: var(--color-ink-soft);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.optional {
  font-weight: 400;
  color: var(--color-ink-faint);
}

.pass-row,
.inline {
  display: flex;
  gap: 0.5rem;
}

.pass-row input,
.inline input,
.inline select {
  flex: 1;
  min-width: 0;
  padding: 0.625rem 0.75rem;
  font-size: 0.9375rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.block h3 {
  font-size: 0.875rem;
}

.block .btn {
  align-self: flex-start;
}

@media (max-width: 860px) {
  .page {
    padding: 1.25rem 1rem;
  }

  .roles dl > div {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
}
</style>
