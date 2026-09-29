<script lang="ts">
let openModalCount = 0
let savedBodyOverflow = ''
let savedBodyPaddingRight = ''
let nextModalId = 0
const modalStack: number[] = []

function lockPageScroll() {
  if (openModalCount === 0) {
    savedBodyOverflow = document.body.style.overflow
    savedBodyPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
  }
  openModalCount += 1
}

function unlockPageScroll() {
  openModalCount = Math.max(0, openModalCount - 1)
  if (openModalCount > 0) return

  document.body.style.overflow = savedBodyOverflow
  document.body.style.paddingRight = savedBodyPaddingRight
}
</script>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const modal = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const modalId = ++nextModalId
const titleId = `modal-title-${modalId}`
let opener: HTMLElement | null = null

function close() {
  emit('close')
}

function focusableElements() {
  return [...(modal.value?.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) ?? [])].filter((element) => element.offsetParent !== null)
}

function focusInitialElement() {
  const autofocus = modal.value?.querySelector<HTMLElement>('[autofocus]')
  ;(autofocus ?? closeButton.value ?? focusableElements()[0] ?? modal.value)?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (modalStack[modalStack.length - 1] !== modalId) return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (event.key !== 'Tab') return

  const focusable = focusableElements()
  if (!focusable.length) {
    event.preventDefault()
    modal.value?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  lockPageScroll()
  modalStack.push(modalId)
  document.addEventListener('keydown', onKeydown)
  void nextTick(focusInitialElement)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  const stackIndex = modalStack.lastIndexOf(modalId)
  if (stackIndex >= 0) modalStack.splice(stackIndex, 1)
  unlockPageScroll()
  void nextTick(() => {
    if (openModalCount === 0 && opener?.isConnected) opener.focus({ preventScroll: true })
  })
})
</script>

<template>
  <div class="overlay" @click.self="close">
    <div
      ref="modal"
      class="modal card"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
    >
      <header class="modal-head">
        <h2 :id="titleId">{{ title }}</h2>
        <button ref="closeButton" type="button" class="modal-close" aria-label="Close" @click="close">
          ×
        </button>
      </header>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.45);
}

.modal {
  width: 100%;
  max-width: 480px;
  max-height: calc(100dvh - 1.5rem);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1.5rem;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.modal-head h2 {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.0625rem;
}

.modal-close {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-faint);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.modal-close:hover {
  background: var(--color-canvas);
  color: var(--color-ink);
}

@media (max-width: 480px) {
  .modal {
    max-height: calc(100dvh - 1rem);
    padding: 1rem;
  }

  .modal-head {
    margin-bottom: 1rem;
  }
}
</style>
