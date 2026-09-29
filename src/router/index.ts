import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { ApiError, useAuthStore } from '@/stores/auth'
import { useShopStore } from '@/stores/shop'
import { navGroups } from './nav'
import { publicRegistrationEnabled } from '@/lib/beta'
import DashboardView from '../views/DashboardView.vue'

const comingSoonRoutes: RouteRecordRaw[] = navGroups
  .flatMap((group) => group.items)
  .filter((item) => item.to !== '/' && !item.ready)
  .map((item) => ({
    path: item.to,
    name: item.to.slice(1),
    component: () => import('../views/ComingSoonView.vue'),
    meta: { requiresAuth: true, title: item.label, owner: item.owner },
  }))

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: DashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/auth/RegisterView.vue'),
      meta: { guestOnly: true },
      beforeEnter: () => (publicRegistrationEnabled ? true : { name: 'login' }),
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/auth/ForgotPasswordView.vue'),
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/auth/ResetPasswordView.vue'),
    },
    {
      path: '/setup/shop',
      name: 'setup-shop',
      component: () => import('../views/shop/CreateShopView.vue'),
      meta: { requiresAuth: true, standalone: true },
    },
    {
      path: '/pos',
      name: 'pos',
      component: () => import('../views/pos/PosView.vue'),
      meta: { requiresAuth: true, title: 'Sell' },
    },
    {
      path: '/sales',
      name: 'sales',
      component: () => import('../views/sales/SalesHistoryView.vue'),
      meta: { requiresAuth: true, title: 'Sales history' },
    },
    {
      path: '/sales/:id',
      name: 'sale-detail',
      component: () => import('../views/sales/SaleDetailView.vue'),
      meta: { requiresAuth: true, title: 'Sale' },
    },
    {
      path: '/customers',
      name: 'customers',
      component: () => import('../views/customers/CustomersView.vue'),
      meta: { requiresAuth: true, title: 'Customers' },
    },
    {
      path: '/customers/:id',
      name: 'customer-detail',
      component: () => import('../views/customers/CustomerDetailView.vue'),
      meta: { requiresAuth: true, title: 'Customer' },
    },
    {
      path: '/credit',
      name: 'credit',
      component: () => import('../views/customers/CreditView.vue'),
      meta: { requiresAuth: true, title: 'Credit' },
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: () => import('../views/expenses/ExpensesView.vue'),
      meta: { requiresAuth: true, title: 'Expenses', managerOnly: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('../views/users/UsersView.vue'),
      meta: { requiresAuth: true, title: 'Staff', managerOnly: true },
    },
    {
      path: '/audit-log',
      name: 'audit-log',
      component: () => import('../views/settings/AuditLogView.vue'),
      meta: { requiresAuth: true, title: 'Audit log', ownerOnly: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/settings/SettingsView.vue'),
      meta: { requiresAuth: true, title: 'Settings' },
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('../views/reports/ReportsView.vue'),
      meta: { requiresAuth: true, title: 'Reports', managerOnly: true },
    },
    {
      path: '/products',
      name: 'products',
      component: () => import('../views/products/ProductsView.vue'),
      meta: { requiresAuth: true, title: 'Products', managerOnly: true },
    },
    {
      path: '/inventory',
      name: 'inventory',
      component: () => import('../views/inventory/InventoryView.vue'),
      meta: { requiresAuth: true, title: 'Inventory', managerOnly: true },
    },
    {
      path: '/suppliers',
      name: 'suppliers',
      component: () => import('../views/suppliers/SuppliersView.vue'),
      meta: { requiresAuth: true, title: 'Suppliers', managerOnly: true },
    },
    {
      path: '/suppliers/:id',
      name: 'supplier-detail',
      component: () => import('../views/suppliers/SupplierDetailView.vue'),
      meta: { requiresAuth: true, title: 'Supplier', managerOnly: true },
    },
    {
      path: '/purchases',
      name: 'purchases',
      component: () => import('../views/purchases/PurchasesView.vue'),
      meta: { requiresAuth: true, title: 'Purchases', managerOnly: true },
    },
    {
      path: '/purchases/new',
      name: 'purchase-new',
      component: () => import('../views/purchases/NewPurchaseView.vue'),
      meta: { requiresAuth: true, title: 'New purchase', managerOnly: true },
    },
    {
      path: '/purchases/:id',
      name: 'purchase-detail',
      component: () => import('../views/purchases/PurchaseDetailView.vue'),
      meta: { requiresAuth: true, title: 'Purchase', managerOnly: true },
    },
    {
      path: '/ask',
      name: 'ask',
      component: () => import('../views/ask/AskView.vue'),
      meta: { requiresAuth: true, title: 'Ask NileBot', managerOnly: true },
    },
    {
      path: '/shifts',
      name: 'shifts',
      component: () => import('../views/shifts/ShiftsView.vue'),
      meta: { requiresAuth: true, title: 'Shifts' },
    },
    {
      path: '/sync',
      name: 'sync',
      component: () => import('../views/sync/SyncQueueView.vue'),
      meta: { requiresAuth: true, title: 'Sync' },
    },
    ...comingSoonRoutes,
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const shopStore = useShopStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' }
  }

  if (!to.meta.requiresAuth) return

  if (!auth.user) {
    try {
      await auth.fetchMe()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        auth.clearSession()
        return { name: 'login' }
      }
      return
    }
  } else if (!auth.fresh) {
    // The saved account lets the app open at once, even offline; check it with the server in
    // the background, so a changed role or a deactivated account is still noticed.
    void auth.fetchMe().catch((e) => {
      if (e instanceof ApiError && e.status === 401) {
        auth.clearSession()
        void router.push({ name: 'login' })
      }
    })
  }

  // The current shop is only cached locally, so a fresh browser or device has
  // to resolve it from the account's own shops rather than asking the user to
  // create another one.
  if (!shopStore.currentShop) {
    const existingShop = auth.user?.shop_roles[0]?.shop
    if (existingShop) {
      shopStore.setCurrentShop(existingShop)
    } else if (!to.meta.standalone) {
      return { name: 'setup-shop' }
    }
  }

  // Checked last: a person's role is per shop, so the shop has to be known.
  if ((to.meta.managerOnly && !auth.canManage) || (to.meta.ownerOnly && !auth.isOwner)) {
    return { name: 'home' }
  }
})

export default router
