import { reactive } from 'vue'

// Notifications éphémères (toasts) affichées par ToastHost.vue. Module réactif
// singleton — pushToast/toastError/… sont appelables depuis n'importe où (couche IA,
// vues), pas seulement depuis un composant.

export type ToastKind = 'error' | 'success' | 'info' | 'warning'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  title?: string
}

const toasts = reactive<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 0

const DEFAULT_TIMEOUT = 6000
const ERROR_TIMEOUT = 9000

export function dismissToast(id: number) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  const index = toasts.findIndex((t) => t.id === id)
  if (index !== -1) toasts.splice(index, 1)
}

function scheduleDismiss(id: number, timeout: number) {
  if (timeout <= 0) return
  timers.set(
    id,
    setTimeout(() => dismissToast(id), timeout)
  )
}

interface ToastOptions {
  title?: string
  timeout?: number
}

export function pushToast(kind: ToastKind, message: string, options: ToastOptions = {}): number {
  const timeout = options.timeout ?? (kind === 'error' ? ERROR_TIMEOUT : DEFAULT_TIMEOUT)

  // Dédoublonnage : une salve (ex. autocomplétion par source) peut produire la même
  // erreur en parallèle. On garde un seul toast et on réarme son minuteur.
  const existing = toasts.find((t) => t.kind === kind && t.message === message)
  if (existing) {
    const previous = timers.get(existing.id)
    if (previous) clearTimeout(previous)
    scheduleDismiss(existing.id, timeout)
    return existing.id
  }

  const id = nextId++
  toasts.push({ id, kind, message, title: options.title })
  scheduleDismiss(id, timeout)
  return id
}

export const toastError = (message: string, title?: string) => pushToast('error', message, { title })
export const toastInfo = (message: string, title?: string) => pushToast('info', message, { title })
export const toastSuccess = (message: string, title?: string) =>
  pushToast('success', message, { title })
export const toastWarning = (message: string, title?: string) =>
  pushToast('warning', message, { title })

export function useToasts() {
  return { toasts, pushToast, dismissToast }
}
