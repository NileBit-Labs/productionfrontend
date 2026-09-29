<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, useAuthStore } from '@/stores/auth'
import { fieldErrors } from '@/lib/api'
import AuthShell from '@/components/auth/AuthShell.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const email = typeof route.query.email === 'string' ? route.query.email : ''
const token = typeof route.query.token === 'string' ? route.query.token : ''
const hasValidLink = computed(() => Boolean(email && token))
const password = ref('')
const passwordConfirmation = ref('')
const errors = ref<Record<string, string>>({})
const error = ref('')
const invalidToken = ref(false)
const success = ref(false)
const loading = ref(false)
let redirectTimer: ReturnType<typeof setTimeout> | undefined

onBeforeUnmount(() => {
  if (redirectTimer) clearTimeout(redirectTimer)
})

function validate() {
  const next: Record<string, string> = {}
  if (password.value.length < 8 || password.value.length > 100) {
    next.password = 'Password must be between 8 and 100 characters.'
  }
  if (passwordConfirmation.value !== password.value) {
    next.password_confirmation = 'Passwords do not match.'
  }
  errors.value = next
  return Object.keys(next).length === 0
}

async function onSubmit() {
  error.value = ''
  invalidToken.value = false
  if (!hasValidLink.value || !validate()) return

  loading.value = true
  try {
    await auth.resetPassword({
      email,
      token,
      password: password.value,
      password_confirmation: passwordConfirmation.value,
    })
    password.value = ''
    passwordConfirmation.value = ''
    success.value = true
    redirectTimer = setTimeout(() => void router.push('/login'), 2500)
  } catch (e) {
    const apiErrors = fieldErrors(e)
    if (apiErrors.token) {
      invalidToken.value = true
      errors.value = {}
    } else if (Object.keys(apiErrors).length) {
      errors.value = apiErrors
    } else {
      error.value = 'We could not reset your password. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Reset password" subtitle="Choose a new password for your account.">
    <div v-if="!hasValidLink || invalidToken" class="auth-form">
      <p class="alert-danger" role="alert">
        {{ !hasValidLink ? 'This password reset link is incomplete or invalid.' : 'This password reset link is invalid or has expired.' }}
      </p>
      <RouterLink class="link" to="/forgot-password">Request a new reset link</RouterLink>
    </div>

    <div v-else-if="success" class="auth-form">
      <p class="alert-success">Password reset. Please sign in with your new password.</p>
      <RouterLink class="btn btn-primary btn-block" to="/login">Go to login</RouterLink>
    </div>

    <form v-else class="auth-form" @submit.prevent="onSubmit">
      <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
      <div class="field">
        <label for="password">New password</label>
        <input id="password" v-model="password" type="password" required minlength="8" maxlength="100" autocomplete="new-password" />
        <small v-if="errors.password" class="field-error">{{ errors.password }}</small>
      </div>
      <div class="field">
        <label for="password_confirmation">Confirm new password</label>
        <input id="password_confirmation" v-model="passwordConfirmation" type="password" required minlength="8" maxlength="100" autocomplete="new-password" />
        <small v-if="errors.password_confirmation" class="field-error">{{ errors.password_confirmation }}</small>
      </div>
      <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
        {{ loading ? 'Resetting…' : 'Reset password' }}
      </button>
    </form>
  </AuthShell>
</template>

<style scoped>
.auth-form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.75rem; text-align: left; }
.alert-success { padding: 0.625rem 0.75rem; border-radius: var(--radius-sm); background: var(--color-primary-soft); color: var(--color-ink); font-size: 0.875rem; }
.field-error { color: var(--color-danger); font-size: 0.8125rem; }
</style>
