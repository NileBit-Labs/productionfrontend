<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AskVisual from '@/components/ask/AskVisual.vue'
import NavIcon from '@/components/NavIcon.vue'
import { ApiError, apiFetch, isNetworkFailure } from '@/lib/api'
import { renderAnswer } from '@/lib/markdown'
import { useShopStore } from '@/stores/shop'
import type { AskReply, AskStatus, ChatMessage } from '@/types/ask'

const shopStore = useShopStore()

const status = ref<AskStatus | null>(null)
const statusError = ref('')
const messages = ref<ChatMessage[]>([])
const input = ref('')
const busy = ref(false)
const thread = ref<HTMLElement | null>(null)
const box = ref<HTMLTextAreaElement | null>(null)
const copied = ref<number | null>(null)

let nextId = 1
let activeShopId: number | undefined

const storageKey = (shopId = activeShopId) => `ask_chat_${shopId ?? 'none'}`

// The conversation survives leaving the page and coming back, but not closing the tab.
function restore(shopId = activeShopId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(shopId)) ?? '[]') as ChatMessage[]
    messages.value = saved
    nextId = saved.reduce((max, m) => Math.max(max, m.id), 0) + 1
  } catch {
    messages.value = []
  }
}

function persist(shopId = activeShopId) {
  try {
    sessionStorage.setItem(storageKey(shopId), JSON.stringify(messages.value.slice(-40)))
  } catch {
    // Storage full or blocked: the chat still works for this visit.
  }
}

const ready = computed(() => status.value?.enabled === true)
const limitReached = computed(
  () => !!status.value && status.value.asked_today >= status.value.daily_limit,
)
const canSend = computed(
  () => ready.value && !busy.value && !limitReached.value && input.value.trim().length >= 2,
)

const ABILITIES = computed(
  () =>
    [
      ['Sales and trends', 'Today, this week, last month, busiest days, vs the period before'],
      ['Best and slowest sellers', 'By units sold or by revenue'],
      ['Stock', 'What is running low or out, and what to reorder'],
      ['Customer debts', 'Who owes you, how old it is, who is overdue'],
      ['Expenses and payments', 'Where the money goes, cash vs mobile money'],
      ['Suppliers', 'What you owe them and what you bought'],
      ...(status.value?.is_owner
        ? [['Profit', 'Gross profit, margin and what is left after expenses']]
        : []),
    ] as [string, string][],
)

async function loadStatus() {
  try {
    status.value = await apiFetch<AskStatus>('/ask/status')
  } catch {
    statusError.value = "Couldn't check the assistant just now. Check your connection and refresh."
  }
}

function history() {
  // Earlier questions and answers, so "and last week?" makes sense. Failed attempts stay out.
  return messages.value
    .filter((m) => !m.error && m.text)
    .map((m) => ({ role: m.role, text: m.text }))
}

async function scrollDown() {
  await nextTick()
  thread.value?.scrollTo({ top: thread.value.scrollHeight, behavior: 'smooth' })
}

function grow() {
  const el = box.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

function failure(question: string, e: unknown): ChatMessage {
  if (e instanceof ApiError) {
    const body = e.body as { message?: string; code?: string } | null
    const code = body?.code
    const message = {
      busy: 'Ask NileBot is busy right now. Please try again in a minute.',
      daily_limit: "You've reached this shop's question limit for today. It resets at midnight.",
      not_configured: 'Ask NileBot is temporarily unavailable. Please try again later.',
      invalid_key: 'Ask NileBot is temporarily unavailable. Please try again later.',
      model_unavailable: 'Ask NileBot is temporarily unavailable. Please try again later.',
      unavailable: 'Ask NileBot could not be reached just now. Please try again shortly.',
      malformed_response: 'Ask NileBot returned an invalid response. Please try again.',
      ungrounded_response:
        "I couldn't verify that from your shop records. Please ask a more specific question.",
      bad_request: "Ask NileBot couldn't complete that question. Try asking it another way.",
    }[code ?? '']

    return {
      id: nextId++,
      role: 'assistant',
      text: '',
      error: {
        message: message ?? 'Ask NileBot could not complete that question. Please try again.',
        code,
        question,
      },
    }
  }
  const offline = isNetworkFailure(e)
  return {
    id: nextId++,
    role: 'assistant',
    text: '',
    error: {
      message: offline
        ? "Couldn't reach the server. Ask NileBot needs an internet connection."
        : 'That took too long. Try a narrower question, for example one product or one week.',
      question,
    },
  }
}

async function send(text?: string) {
  const question = (text ?? input.value).trim()
  if (question.length < 2 || busy.value || !ready.value) return

  const previous = history()
  messages.value.push({ id: nextId++, role: 'user', text: question })
  input.value = ''
  grow()
  busy.value = true
  persist()
  void scrollDown()

  try {
    const reply = await apiFetch<AskReply>('/ask', {
      method: 'POST',
      body: { question, history: previous.slice(-8) },
      timeoutMs: 90_000,
    })
    messages.value.push({
      id: nextId++,
      role: 'assistant',
      text: reply.answer,
      visuals: reply.visuals,
      tools: reply.tools,
    })
  } catch (e) {
    messages.value.push(failure(question, e))
  } finally {
    busy.value = false
    persist()
    void scrollDown()
    void loadStatus()
    void nextTick(() => box.value?.focus())
  }
}

function retry(message: ChatMessage) {
  if (!message.error) return
  const question = message.error.question
  // The failed attempt and the question that led to it are replaced by the new try.
  const at = messages.value.findIndex((m) => m.id === message.id)
  messages.value.splice(Math.max(at - 1, 0), 2)
  void send(question)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    void send()
  }
}

function newChat() {
  messages.value = []
  persist()
  input.value = ''
  grow()
  box.value?.focus()
}

async function copy(message: ChatMessage) {
  try {
    await navigator.clipboard.writeText(message.text)
    copied.value = message.id
    setTimeout(() => (copied.value = null), 1500)
  } catch {
    // Clipboard blocked: nothing to do.
  }
}

onMounted(() => {
  activeShopId = shopStore.currentShop?.id
  restore()
  void loadStatus()
  void scrollDown()
})

watch(
  () => shopStore.currentShop?.id,
  (shopId, previousShopId) => {
    if (shopId === previousShopId) return

    persist(previousShopId)
    activeShopId = shopId
    messages.value = []
    nextId = 1
    restore(shopId)
    input.value = ''
    grow()
    void scrollDown()
    void loadStatus()
  },
)
</script>

<template>
  <main class="ask">
    <section class="chat card" aria-label="Conversation">
      <header class="chat-head">
        <div class="title">
          <span class="badge"><NavIcon name="ask" /></span>
          <div>
            <h1>Ask NileBot</h1>
            <p>Your assistant for sales, stock, debts and money</p>
          </div>
        </div>
        <button
          v-if="messages.length"
          type="button"
          class="btn ui-btn-secondary small"
          @click="newChat"
        >
          New chat
        </button>
      </header>

      <div ref="thread" class="thread" aria-live="polite">
        <p v-if="statusError" class="alert-danger">{{ statusError }}</p>

        <div v-if="status && !status.enabled" class="setup">
          <h2>Ask NileBot is temporarily unavailable</h2>
          <p>Please try again later. If it continues, contact NileBit support.</p>
        </div>

        <div v-else-if="!messages.length && status" class="welcome">
          <h2>What would you like to know?</h2>
          <p>
            Ask in plain words, the way you'd ask a shop manager. I look at your real figures before
            I answer.
          </p>
          <div class="chips">
            <button
              v-for="s in status.suggestions"
              :key="s"
              type="button"
              class="chip"
              @click="send(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>

        <template v-for="m in messages" :key="m.id">
          <div v-if="m.role === 'user'" class="row me">
            <p class="bubble">{{ m.text }}</p>
          </div>

          <div v-else class="row bot">
            <span class="avatar"><NavIcon name="ask" /></span>
            <div class="reply">
              <div v-if="m.error" class="failed">
                <p>{{ m.error.message }}</p>
                <button
                  v-if="
                    !['not_configured', 'invalid_key', 'model_unavailable', 'daily_limit'].includes(
                      m.error.code ?? '',
                    )
                  "
                  type="button"
                  class="link"
                  @click="retry(m)"
                >
                  Try again
                </button>
              </div>

              <template v-else>
                <div class="answer" v-html="renderAnswer(m.text)" />
                <AskVisual v-for="(v, i) in m.visuals ?? []" :key="i" :visual="v" />

                <div class="meta">
                  <details v-if="m.tools?.length" class="how">
                    <summary>How I worked this out</summary>
                    <ul>
                      <li v-for="t in m.tools" :key="t">{{ t }}</li>
                    </ul>
                    <p>
                      These come from your recorded sales, stock and expenses. Check big decisions
                      in Reports.
                    </p>
                  </details>
                  <button type="button" class="link small" @click="copy(m)">
                    {{ copied === m.id ? 'Copied' : 'Copy' }}
                  </button>
                </div>
              </template>
            </div>
          </div>
        </template>

        <div v-if="busy" class="row bot" role="status">
          <span class="avatar"><NavIcon name="ask" /></span>
          <p class="typing"><span /><span /><span /> <em>Checking your numbers…</em></p>
        </div>
      </div>

      <form class="composer" @submit.prevent="send()">
        <textarea
          ref="box"
          v-model="input"
          rows="1"
          maxlength="500"
          :disabled="!ready || limitReached"
          :placeholder="
            limitReached
              ? 'Daily question limit reached. It resets at midnight.'
              : 'Ask about sales, stock, customers, expenses…'
          "
          aria-label="Your question"
          @input="grow"
          @keydown="onKey"
        />
        <button type="submit" class="btn btn-primary" :disabled="!canSend">
          {{ busy ? 'Thinking…' : 'Ask' }}
        </button>
      </form>
    </section>

    <aside class="side" aria-label="Help">
      <section class="card panel">
        <h2>Try asking</h2>
        <ul class="ideas">
          <li v-for="s in status?.suggestions ?? []" :key="s">
            <button type="button" :disabled="!ready || busy || limitReached" @click="send(s)">
              {{ s }}
            </button>
          </li>
        </ul>
      </section>

      <section v-if="status" class="card panel note">
        <p>
          <strong>{{ status.asked_today }}</strong> of {{ status.daily_limit }} questions used
          today.
        </p>
        <p>
          I only read your shop's figures. I can't change anything, and I never see other shops.
        </p>
      </section>

      <section class="card panel">
        <h2>What I can look at</h2>
        <dl class="abilities">
          <div v-for="[name, detail] in ABILITIES" :key="name">
            <dt>{{ name }}</dt>
            <dd>{{ detail }}</dd>
          </div>
        </dl>
      </section>
    </aside>
  </main>
</template>

<style scoped>
.ask {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 1.25rem;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 1.5rem 2rem;
}

.chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.badge {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.badge :deep(svg) {
  width: 22px;
  height: 22px;
}

h1 {
  font-size: 1.125rem;
}

.title p {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.small {
  min-height: 34px;
  padding: 0 0.875rem;
  font-size: 0.8125rem;
}

.thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 1.25rem;
}

.welcome,
.setup {
  margin: auto;
  max-width: 640px;
  text-align: center;
}

.welcome h2,
.setup h2 {
  font-size: 1.25rem;
}

.welcome > p {
  margin-top: 0.5rem;
  color: var(--color-ink-soft);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.chip {
  min-height: 38px;
  padding: 0 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.875rem;
  cursor: pointer;
}

.chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.setup {
  padding: 1.5rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  text-align: left;
}

.setup p,
.setup ol {
  margin-top: 0.75rem;
  color: var(--color-ink-soft);
  font-size: 0.9375rem;
}

.setup ol {
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

code {
  padding: 0.0625rem 0.375rem;
  border-radius: 4px;
  background: var(--color-canvas);
  font-size: 0.85em;
}

.row {
  display: flex;
  gap: 0.75rem;
}

.row.me {
  justify-content: flex-end;
}

.bubble {
  max-width: min(640px, 85%);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md) var(--radius-md) 4px var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.avatar :deep(svg) {
  width: 18px;
  height: 18px;
}

.reply {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
  max-width: 760px;
}

.answer {
  font-size: 0.9688rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.answer :deep(p) {
  margin: 0 0 0.625rem;
}

.answer :deep(p:last-child),
.answer :deep(ul:last-child),
.answer :deep(ol:last-child) {
  margin-bottom: 0;
}

.answer :deep(ul),
.answer :deep(ol) {
  margin: 0 0 0.625rem;
  padding-left: 1.25rem;
}

.answer :deep(li + li) {
  margin-top: 0.25rem;
}

.meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.how {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.how summary {
  cursor: pointer;
}

.how ul {
  margin: 0.5rem 0 0;
  padding-left: 1.125rem;
}

.how p {
  margin-top: 0.5rem;
}

.link {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.875rem;
  cursor: pointer;
}

.link.small {
  min-height: 0;
  padding: 0;
  font-size: 0.8125rem;
}

.failed {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.9rem;
}

.failed .link {
  margin-top: 0.5rem;
  color: var(--color-danger);
  font-weight: 600;
  text-decoration: underline;
}

.typing {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--color-ink-faint);
  font-size: 0.875rem;
}

.typing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: blink 1.2s infinite ease-in-out;
}

.typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.25;
  }
  40% {
    opacity: 1;
  }
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem 1rem;
  border-top: 1px solid var(--color-border);
}

.composer textarea {
  flex: 1;
  min-height: 44px;
  max-height: 160px;
  padding: 0.6875rem 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.9375rem;
  line-height: 1.4;
  resize: none;
  outline: none;
}

.composer textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.composer textarea:disabled {
  background: var(--color-canvas);
}

.composer .btn {
  min-height: 44px;
  padding: 0 1.5rem;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-height: 0;
  overflow-y: auto;
}

.panel {
  padding: 1.125rem 1.25rem;
}

.panel h2 {
  margin-bottom: 0.75rem;
  font-size: 0.9375rem;
}

.ideas {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ideas button {
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
}

.ideas button:hover:not(:disabled) {
  background: var(--color-canvas);
  color: var(--color-primary);
}

.ideas button:disabled {
  opacity: 0.5;
  cursor: default;
}

.abilities {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.abilities dt {
  font-size: 0.875rem;
  font-weight: 600;
}

.abilities dd {
  margin: 0.125rem 0 0;
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.note p {
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.note p + p {
  margin-top: 0.5rem;
  color: var(--color-ink-faint);
}

@media (max-width: 1100px) {
  .ask {
    grid-template-columns: 1fr;
    padding: 1rem;
  }

  .side {
    display: none;
  }

  .chat {
    min-height: 70vh;
  }
}

@media (max-width: 560px) {
  .ask {
    padding: 0.625rem;
  }
  .chat-head {
    padding: 0.75rem;
  }
  .title {
    min-width: 0;
  }
  .title > div {
    min-width: 0;
  }
  .title p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .thread {
    gap: 1rem;
    padding: 1rem 0.75rem;
  }
  .composer {
    gap: 0.5rem;
    padding: 0.75rem;
  }
  .composer .btn {
    min-width: 64px;
    padding: 0 0.75rem;
  }
  .meta {
    gap: 0.625rem;
  }
}
</style>
