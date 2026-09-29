import { ref } from 'vue'

const BASE_URL = import.meta.env.VITE_API_URL as string | undefined

// A request that hangs on a weak mobile connection must fail instead of
// freezing the till, so it can fall back to saving the sale on the device.
const REQUEST_TIMEOUT_MS = 15000

// false once a request fails to reach the server at all; true as soon as any
// response (even an error one) comes back. More honest than navigator.onLine,
// which only knows whether there is a network, not whether the API is reachable.
export const apiReachable = ref(true)

// True when the request never got an answer (offline, DNS, timeout, server down).
export function isNetworkFailure(e: unknown): boolean {
  return !(e instanceof ApiError) || e.status >= 502
}

if (!BASE_URL) {
  throw new Error(
    'VITE_API_URL is not set. Copy .env.example to .env (see CONTRIBUTING.md) and restart the dev server.',
  )
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed with status ${status}`
    super(message)
    this.status = status
    this.body = body
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  shopId?: number | string
  // Most calls should fail fast on a weak connection; the AI assistant may legitimately take a while.
  timeoutMs?: number
}

function requestHeaders(options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const token = localStorage.getItem('auth_token')
  if (token) headers.Authorization = `Bearer ${token}`
  const shopId =
    options.shopId ??
    (JSON.parse(localStorage.getItem('current_shop') ?? 'null')?.id as number | undefined)
  if (shopId) headers['X-Shop-Id'] = String(shopId)
  return headers
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = requestHeaders(options)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
  } catch (e) {
    apiReachable.value = false
    throw e
  } finally {
    clearTimeout(timer)
  }

  apiReachable.value = true

  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new ApiError(response.status, data)
  }

  return data as T
}

/** Download a server-authorized report without exposing the auth token in a URL. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: requestHeaders({}) })
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    throw new ApiError(
      response.status,
      contentType.includes('application/json') ? await response.json() : null,
    )
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// Laravel validation failures carry a generic top-level message ("... and 2
// more errors"); the first field error is the one worth showing a cashier.
export function apiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const errors = (e.body as { errors?: Record<string, string[]> } | null)?.errors
    const first = errors ? Object.values(errors)[0]?.[0] : undefined
    return first ?? e.message
  }
  return 'Something went wrong. Please try again.'
}

// Laravel's per-field validation messages, so a form can show each one under
// the field it belongs to. Nested names like "units.0.unit_name" are kept as-is.
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {}
  const errors = (e.body as { errors?: Record<string, string[]> } | null)?.errors ?? {}
  return Object.fromEntries(
    Object.entries(errors).map(([key, messages]) => [key, messages[0] ?? '']),
  )
}
