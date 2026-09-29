<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useShopStore } from '@/stores/shop'
import { navGroups } from '@/router/nav'
import NavIcon from '@/components/NavIcon.vue'
import SyncStatus from '@/components/SyncStatus.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useSyncStore } from '@/stores/sync'
import { applyUpdate, updateReady } from '@/lib/pwa'
import brandIconUrl from '@/assets/brand/nilebit-pos-icon.svg'

const auth = useAuthStore()
const shopStore = useShopStore()
const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)
const profileOpen = ref(false)
const profileButton = ref<HTMLButtonElement | null>(null)
const sync = useSyncStore()
const visibleGroups = computed(() =>
  navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => (!i.managerOnly || auth.canManage) && (!i.ownerOnly || auth.isOwner),
      ),
    }))
    .filter((g) => g.items.length),
)
const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
}
const roleLabel = computed(() => ROLE_LABELS[auth.currentRole ?? ''] ?? '')
const initials = computed(() =>
  (auth.user?.name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join(''),
)
const pageTitle = computed(() => (route.meta.title as string | undefined) ?? 'Dashboard')

// Only the content area scrolls, so a new page should start at its top.
const scroller = ref<HTMLElement | null>(null)
watch(
  () => route.path,
  () => scroller.value?.scrollTo({ top: 0 }),
)

watch(sidebarOpen, (open) => document.body.classList.toggle('drawer-open', open))

function closeProfile(restoreFocus = false) {
  profileOpen.value = false
  if (restoreFocus) void nextTick(() => profileButton.value?.focus())
}

function onDocumentPointer(event: PointerEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.profile-wrap')) closeProfile()
}

document.addEventListener('pointerdown', onDocumentPointer)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.body.classList.remove('drawer-open')
})

const showShell = computed(() => auth.isAuthenticated && !route.meta.standalone)

watch(
  () => auth.isAuthenticated,
  (signedIn) => {
    if (signedIn) void sync.init()
  },
  { immediate: true },
)

async function onLogout() {
  if (
    sync.unsyncedCount &&
    !window.confirm(
      `${sync.unsyncedCount} sale${sync.unsyncedCount === 1 ? ' is' : 's are'} not synced yet. They stay safe on this device, but will only reach the shop's records after you sign in and sync again. Log out anyway?`,
    )
  ) {
    return
  }
  await auth.logout()
  await router.push('/login')
}
</script>

<template>
  <div v-if="showShell" class="shell">
    <button
      v-if="sidebarOpen"
      type="button"
      class="scrim"
      aria-label="Close menu"
      @click="sidebarOpen = false"
    />

    <aside id="main-menu" class="sidebar" :class="{ open: sidebarOpen }" aria-label="Main menu">
      <RouterLink to="/" class="brand" @click="sidebarOpen = false">
        <img class="brand-icon" :src="brandIconUrl" alt="" />
        <span class="brand-copy">
          <span class="brand-name">NileBit <span class="brand-name-accent">POS</span></span>
          <span class="brand-edition">For Retail</span>
        </span>
      </RouterLink>

      <nav class="nav">
        <div v-for="group in visibleGroups" :key="group.label" class="nav-group">
          <p class="nav-group-label">{{ group.label }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            @click="sidebarOpen = false"
          >
            <NavIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>
    </aside>

    <div class="main-col">
      <header class="topbar">
        <button
          type="button"
          class="hamburger"
          aria-label="Open menu"
          aria-controls="main-menu"
          :aria-expanded="sidebarOpen"
          @click="sidebarOpen = true"
        >
          <span /><span /><span />
        </button>

        <div class="crumbs">
          <span v-if="shopStore.currentShop" class="shop-name">{{
            shopStore.currentShop.name
          }}</span>
          <span v-if="shopStore.currentShop" class="sep" aria-hidden="true">/</span>
          <h1 class="page-name">{{ pageTitle }}</h1>
        </div>

        <div class="topbar-actions">
          <SyncStatus />
          <div class="profile-wrap" @keydown.esc="closeProfile(true)">
            <button
              ref="profileButton"
              type="button"
              class="user"
              :title="auth.user?.email"
              :aria-expanded="profileOpen"
              aria-haspopup="menu"
              aria-label="Open account menu"
              @click="profileOpen = !profileOpen"
            >
              <span class="avatar" aria-hidden="true">{{ initials }}</span>
              <span class="user-text">
                <strong>{{ auth.user?.name }}</strong>
                <small>{{ roleLabel }}</small>
              </span>
            </button>
            <div v-if="profileOpen" class="profile-menu" role="menu" aria-label="Account menu">
              <p class="profile-email">{{ auth.user?.email }}</p>
              <RouterLink to="/settings" role="menuitem" @click="closeProfile"
                >My profile &amp; settings</RouterLink
              >
              <RouterLink v-if="auth.canManage" to="/users" role="menuitem" @click="closeProfile"
                >Staff management</RouterLink
              >
              <div class="menu-theme"><span>Appearance</span><ThemeToggle /></div>
              <button type="button" role="menuitem" class="menu-logout" @click="onLogout">
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div ref="scroller" class="content">
        <RouterView />
      </div>
    </div>
  </div>

  <RouterView v-else />

  <div v-if="updateReady" class="update-toast" role="status">
    <span>A new version is ready.</span>
    <button type="button" @click="applyUpdate">Reload</button>
  </div>
</template>

<style scoped>
.update-toast {
  position: fixed;
  z-index: 60;
  right: 1rem;
  bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  max-width: calc(100vw - 2rem);
  padding: 0.625rem 0.75rem 0.625rem 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: 0.875rem;
}

.update-toast button {
  min-height: 34px;
  padding: 0 0.875rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

/* The shell is exactly one screen tall: the sidebar and header stay where they are and only
   the content area scrolls. */
.shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
}

/* ---- Sidebar ---- */

.sidebar {
  display: flex;
  flex-direction: column;
  width: 264px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 64px;
  padding: 0 1.25rem;
  border-bottom: 1px solid var(--color-border);
  text-decoration: none;
  flex-shrink: 0;
}

.brand-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-name {
  font-weight: 700;
  font-size: 1.1875rem;
  color: var(--color-ink);
  letter-spacing: -0.01em;
}

.brand-name-accent {
  color: var(--color-primary);
  font-weight: 500;
}

.brand-edition {
  margin-top: 0.125rem;
  color: var(--color-ink-faint);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1;
  text-transform: uppercase;
}

.nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.875rem 0.875rem 1.25rem;
}

.nav-group + .nav-group {
  margin-top: 1rem;
}

.nav-group-label {
  padding: 0 0.75rem;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-ink-faint);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-height: 40px;
  padding: 0 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-ink-soft);
  text-decoration: none;
  transition:
    background-color 0.12s,
    color 0.12s;
}

.nav-item :deep(.nav-icon) {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.nav-item:hover {
  background: var(--color-canvas);
  color: var(--color-ink);
}

.nav-item.router-link-exact-active,
.nav-item.router-link-active:not([href='/']) {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}

/* ---- Header + content ---- */

.main-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  height: 64px;
  flex-shrink: 0;
  min-width: 0;
  padding: 0 1.75rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.crumbs {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.shop-name {
  flex: 0 1 auto;
  max-width: min(32vw, 360px);
  color: var(--color-ink-faint);
  font-size: 0.9375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sep {
  color: var(--color-border-strong);
}

.page-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 1.0625rem;
  font-weight: 600;
  white-space: nowrap;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-left: auto;
  min-width: 0;
  flex-shrink: 0;
}

.profile-wrap {
  position: relative;
}

.user {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 44px;
  padding: 4px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
}

.user:hover,
.user:focus-visible {
  background: var(--color-canvas);
}

.avatar {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.8125rem;
  font-weight: 700;
}

.user-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.user-text strong {
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
}

.user-text small {
  color: var(--color-ink-faint);
  font-size: 0.75rem;
}

.profile-menu {
  position: absolute;
  z-index: 45;
  top: calc(100% + 0.5rem);
  right: 0;
  display: grid;
  width: min(300px, calc(100vw - 1.5rem));
  padding: 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.profile-menu a,
.menu-logout {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.75rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.profile-menu a:hover,
.menu-logout:hover {
  background: var(--color-canvas);
}
.profile-email {
  overflow: hidden;
  padding: 0.5rem 0.75rem;
  color: var(--color-ink-faint);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu-theme {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 48px;
  margin: 0.25rem 0;
  padding: 0.25rem 0.75rem;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}
.menu-logout {
  color: var(--color-danger);
}

.content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 0 9px;
  background: none;
  border: none;
  cursor: pointer;
}

.hamburger span {
  height: 2px;
  border-radius: 1px;
  background: var(--color-ink);
}

.scrim {
  display: none;
}

@media (max-width: 1180px) {
  .user-text,
  .shop-name,
  .sep {
    display: none;
  }
}

@media (max-width: 860px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 30;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow-card);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    padding: 0;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    cursor: pointer;
    z-index: 20;
  }

  .hamburger {
    display: flex;
    width: 44px;
    height: 44px;
  }

  .topbar {
    gap: 0.5rem;
    padding: 0 0.75rem;
  }
}

@media (max-width: 560px) {
  .topbar-actions {
    gap: 0.5rem;
  }

  .topbar-actions :deep(.sync-status .label) {
    display: none;
  }

  .topbar-actions :deep(.sync-status) {
    min-height: 40px;
    padding: 0.5rem;
  }

  .topbar {
    height: 56px;
  }
  .profile-menu {
    position: fixed;
    top: auto;
    right: 0.75rem;
    bottom: 0.75rem;
    width: min(360px, calc(100vw - 1.5rem));
  }
}

:global(body.drawer-open) {
  overflow: hidden;
}
</style>
