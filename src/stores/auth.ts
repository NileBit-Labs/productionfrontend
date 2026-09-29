import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch, ApiError } from '@/lib/api'
import { useShiftStore } from '@/stores/shift'
import { useShopStore, type Shop } from '@/stores/shop'

export interface Organization {
  id: number
  name: string
  default_currency: string
  timezone: string
}

export interface ShopRole {
  role: string
  shop: Shop
}

export interface User {
  id: number
  name: string
  email: string
  phone: string | null
  organization_id: number | null
  organization: Organization | null
  shop_roles: ShopRole[]
}

interface AuthResponse {
  user: User
  token: string
}

interface PasswordResetResponse {
  message: string
}

const USER_KEY = 'auth_user'

// The signed-in user is kept on the device so that reopening the app with no connection still
// knows their role, and shows the right menu, instead of treating them as a stranger.
function readCachedUser(): User | null {
  if (!localStorage.getItem('auth_token')) return null
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as User | null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(readCachedUser())
  // Whether the account has been re-read from the server since this page was opened.
  const fresh = ref(false)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const isAuthenticated = computed(() => token.value !== null)

  const currentRole = computed(() => {
    const shopId = useShopStore().currentShop?.id
    return user.value?.shop_roles.find((r) => r.shop.id === shopId)?.role ?? null
  })
  const canManage = computed(() => currentRole.value === 'owner' || currentRole.value === 'manager')
  const isOwner = computed(() => currentRole.value === 'owner')

  function keepUser(next: User) {
    user.value = next
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(next))
    } catch {
      // Storage full or blocked: the account still works, just not offline after a reload.
    }
  }

  function setSession(response: AuthResponse) {
    keepUser(response.user)
    fresh.value = true
    token.value = response.token
    localStorage.setItem('auth_token', response.token)
  }

  function clearSession() {
    user.value = null
    fresh.value = false
    token.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem(USER_KEY)
    useShopStore().clearCurrentShop()
    useShiftStore().reset()
  }

  async function register(payload: {
    name: string
    email: string
    password: string
    organization_name: string
  }) {
    const response = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    })
    setSession(response)
  }

  async function login(payload: { email: string; password: string }) {
    const response = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload,
    })
    setSession(response)
  }

  async function forgotPassword(email: string) {
    return apiFetch<PasswordResetResponse>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    })
  }

  async function resetPassword(payload: {
    email: string
    token: string
    password: string
    password_confirmation: string
  }) {
    return apiFetch<PasswordResetResponse>('/auth/reset-password', {
      method: 'POST',
      body: payload,
    })
  }

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } finally {
      clearSession()
    }
  }

  async function fetchMe() {
    keepUser(await apiFetch<User>('/auth/me'))
    fresh.value = true
  }

  return {
    user,
    fresh,
    token,
    isAuthenticated,
    currentRole,
    canManage,
    isOwner,
    register,
    login,
    forgotPassword,
    resetPassword,
    logout,
    fetchMe,
    clearSession,
  }
})

export { ApiError }
