<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, ApiError } from '@/stores/auth'
import AuthShell from '@/components/auth/AuthShell.vue'
import { publicRegistrationEnabled } from '@/lib/beta'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login({ email: email.value, password: password.value })
    await router.push('/')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Log in" subtitle="Run your retail shop from anywhere.">

      <form class="auth-form" @submit.prevent="onSubmit">
        <p v-if="error" class="alert-danger">{{ error }}</p>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" required autocomplete="email" />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
          />
        </div>

        <RouterLink class="link forgot-link" to="/forgot-password">Forgot password?</RouterLink>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? 'Logging in…' : 'Log in' }}
        </button>
      </form>

      <p v-if="publicRegistrationEnabled" class="switch">
        Don't have an account?
        <RouterLink class="link" to="/register">Create one</RouterLink>
      </p>
  </AuthShell>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.75rem;
  text-align: left;
}

.switch {
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: var(--color-ink-soft);
}

.forgot-link {
  align-self: flex-end;
  margin-top: -0.5rem;
  font-size: 0.875rem;
}
</style>
