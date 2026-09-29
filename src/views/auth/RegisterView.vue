<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, ApiError } from '@/stores/auth'
import AuthShell from '@/components/auth/AuthShell.vue'

const router = useRouter()
const auth = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const organizationName = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.register({
      name: name.value,
      email: email.value,
      password: password.value,
      organization_name: organizationName.value,
    })
    await router.push('/setup/shop')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Create your account" subtitle="Set up your retail business on NileBit POS.">

      <form class="auth-form" @submit.prevent="onSubmit">
        <p v-if="error" class="alert-danger">{{ error }}</p>

        <div class="field">
          <label for="name">Your name</label>
          <input id="name" v-model="name" type="text" required autocomplete="name" />
        </div>

        <div class="field">
          <label for="organization_name">Business name</label>
          <input id="organization_name" v-model="organizationName" type="text" required />
        </div>

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
            minlength="8"
            autocomplete="new-password"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? 'Creating…' : 'Create account' }}
        </button>
      </form>

      <p class="switch">
        Already have an account?
        <RouterLink class="link" to="/login">Log in</RouterLink>
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
</style>
