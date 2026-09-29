<script setup lang="ts">
import { ref } from 'vue'
import { ApiError, useAuthStore } from '@/stores/auth'
import { fieldErrors } from '@/lib/api'
import AuthShell from '@/components/auth/AuthShell.vue'

const auth = useAuthStore()
const email = ref('')
const error = ref('')
const emailError = ref('')
const success = ref(false)
const loading = ref(false)

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function onSubmit() {
  error.value = ''
  emailError.value = ''
  if (!validEmail(email.value)) {
    emailError.value = 'Enter a valid email address.'
    return
  }

  loading.value = true
  try {
    await auth.forgotPassword(email.value)
    success.value = true
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) {
      error.value = 'Too many requests; please try again later.'
    } else {
      emailError.value = fieldErrors(e).email ?? ''
      if (!emailError.value) error.value = 'We could not send a reset link. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Forgot password?" subtitle="Enter your email and we’ll send a reset link.">
    <div v-if="success" class="auth-form">
      <p class="alert-success">
        If an account exists for that email, a password reset link has been sent.
      </p>
      <RouterLink class="link" to="/login">Back to login</RouterLink>
    </div>

    <form v-else class="auth-form" @submit.prevent="onSubmit">
      <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model.trim="email" type="email" required autocomplete="email" />
        <small v-if="emailError" class="field-error">{{ emailError }}</small>
      </div>
      <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
        {{ loading ? 'Sending…' : 'Send reset link' }}
      </button>
      <p class="switch"><RouterLink class="link" to="/login">Back to login</RouterLink></p>
    </form>
  </AuthShell>
</template>

<style scoped>
.auth-form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.75rem; text-align: left; }
.switch { text-align: center; font-size: 0.875rem; }
.alert-success { padding: 0.625rem 0.75rem; border-radius: var(--radius-sm); background: var(--color-primary-soft); color: var(--color-ink); font-size: 0.875rem; }
.field-error { color: var(--color-danger); font-size: 0.8125rem; }
</style>
