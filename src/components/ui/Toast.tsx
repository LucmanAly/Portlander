import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  push: (tone: ToastTone, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_ICON: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'border-accent-500/30 bg-ink-900 text-accent-400',
  error: 'border-critical/30 bg-ink-900 text-critical',
  info: 'border-border bg-ink-900 text-ink-200',
}

const AUTO_DISMISS_MS = 4500

/**
 * Minimal toast stack for post-action feedback (sync/refresh/import/reset)
 * so those results show up as a transient, glanceable confirmation instead
 * of only being visible if you happen to be looking at the field that
 * changed. Auto-dismisses; also closeable. Respects reduced-motion.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, tone, message }])
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
          aria-live="polite"
        >
          {toasts.map((t) => {
            const Icon = TONE_ICON[t.tone]
            return (
              <div
                key={t.id}
                role="status"
                className={clsx(
                  'animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-lg backdrop-blur',
                  TONE_CLASS[t.tone],
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-ink-100">{t.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="focus-ring -m-1 shrink-0 rounded-md p-1 text-ink-450 hover:text-ink-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
} {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return {
    success: (message: string) => ctx.push('success', message),
    error: (message: string) => ctx.push('error', message),
    info: (message: string) => ctx.push('info', message),
  }
}
