<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import StatTile from '@/components/reports/StatTile.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { longDay } from '@/lib/dates'
import { formatUgx } from '@/lib/format'
import type { DebtReport } from '@/types/reports'

const report = ref<DebtReport | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    report.value = await apiFetch<DebtReport>('/reports/debt')
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const s = computed(() => report.value?.summary)
const agingTotal = computed(() => report.value?.aging.reduce((sum, b) => sum + b.amount, 0) ?? 0)
const bucketNames: Record<string, string> = {
  '0-30': 'Up to 30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': 'Over 90 days',
}
const bucketColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-negative)']
</script>

<template>
  <div class="rp">
    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
    <p v-if="!report && loading" class="rp-empty">Adding up who owes what…</p>

    <template v-if="report && s">
      <section class="rp-tiles three">
        <StatTile
          label="Owed to you"
          :value="formatUgx(s.total_owed)"
          :hint="`As of ${longDay(report.as_of)}`"
          icon="credit"
        />
        <StatTile
          label="Customers owing"
          :value="String(s.customers_owing)"
          hint="With an unpaid balance"
          icon="customers"
        />
        <StatTile
          label="Past its due date"
          :value="formatUgx(s.overdue)"
          :hint="s.overdue ? 'Worth a phone call' : 'Nothing overdue'"
          :trend="s.overdue ? 'down' : null"
          icon="expenses"
        />
      </section>

      <section class="card rp-panel">
        <div class="rp-panel-head">
          <h2>How old is the debt</h2>
          <span class="rp-meta">Days since the credit sale</span>
        </div>
        <p v-if="!agingTotal" class="rp-empty">Nobody owes you anything right now.</p>
        <template v-else>
          <div class="stack" role="img" aria-label="Debt by age">
            <span
              v-for="(b, i) in report.aging"
              :key="b.bucket"
              :style="{ width: (b.amount / agingTotal) * 100 + '%', background: bucketColors[i] }"
            />
          </div>
          <ul class="ages">
            <li v-for="(b, i) in report.aging" :key="b.bucket">
              <span class="dot" :style="{ background: bucketColors[i] }" />
              <span class="name">{{ bucketNames[b.bucket] ?? b.bucket }}</span>
              <span class="amt">{{ formatUgx(b.amount) }}</span>
              <span class="rp-meta">{{ Math.round((b.amount / agingTotal) * 100) }}%</span>
            </li>
          </ul>
        </template>
      </section>

      <section class="card rp-panel">
        <div class="rp-panel-head">
          <h2>Who owes you</h2>
          <span v-if="report.customers.length" class="rp-meta"
            >Use Export above to download this data.</span
          >
        </div>
        <p v-if="!report.customers.length" class="rp-empty">No customer owes anything.</p>
        <div v-else class="rp-scroll">
          <table class="rp-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th class="num">Owes</th>
                <th class="num">Unpaid sales</th>
                <th class="num">Oldest</th>
                <th class="num">Overdue</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in report.customers" :key="c.id">
                <td class="clip">
                  <RouterLink :to="`/customers/${c.id}`" class="link">{{ c.name }}</RouterLink>
                </td>
                <td>{{ c.phone ?? '—' }}</td>
                <td class="num strong">{{ formatUgx(c.balance) }}</td>
                <td class="num">{{ c.open_sales }}</td>
                <td class="num">
                  {{ c.oldest_debt_days === null ? '—' : `${c.oldest_debt_days} days` }}
                </td>
                <td class="num" :class="{ neg: c.overdue > 0 }">
                  <template v-if="c.overdue">
                    {{ formatUgx(c.overdue) }}
                    <span class="rp-meta">· {{ c.days_overdue }} days late</span>
                  </template>
                  <template v-else>—</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="rp-note">
        <b>How this is worked out.</b> What a customer owes is their account balance: credit sales,
        less what they have paid and any debt cancelled by a refund. Payments are taken off the
        oldest sales first. A customer who has overpaid is not listed as owing. "Overdue" means a
        due date was agreed at the till and has passed.
      </p>
    </template>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
  background: var(--color-border);
}

.stack span {
  display: block;
  height: 100%;
}

.ages {
  list-style: none;
  padding: 0;
  margin-top: 1.25rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.ages li {
  display: grid;
  grid-template-columns: 8px 1fr;
  column-gap: 0.5rem;
  row-gap: 0.125rem;
  align-items: center;
  font-size: 0.8125rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  grid-row: 1;
}

.name {
  color: var(--color-ink-soft);
}

.amt {
  grid-column: 2;
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.ages .rp-meta {
  grid-column: 2;
}

@media (max-width: 720px) {
  .ages {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
