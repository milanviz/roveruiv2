"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

interface UniversalPopupProps {
  trigger: React.ReactNode
  title: string
  description: string
  mode?: "delete" | "email"
  onConfirm?: () => void | Promise<void>
  onSend?: (email: string) => void | Promise<void>
}

export function UniversalPopup({
  trigger,
  title,
  description,
  mode = "delete",
  onConfirm,
  onSend,
}: UniversalPopupProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAction = async (action?: () => void | Promise<void>) => {
    if (!action || pending) return
    setPending(true)
    setError(null)
    try {
      await action()
      setEmail("")
      setOpen(false)
      toast.success(mode === "email" ? "Project shared" : "Action completed")
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Something went wrong. Please try again."
      setError(message)
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (!next) setError(null) } }}>
      <AlertDialogTrigger asChild>
        {trigger}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {mode === "email" && (
          <Input
            type="email"
            aria-label="Email address"
            aria-invalid={!!error}
            disabled={pending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
          />
        )}

        {error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>

          {mode === "delete" && (
            <button
            type="button"
            onClick={() => runAction(onConfirm)}
            disabled={pending}
            aria-busy={pending}
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
            {pending && <Loader2 className="size-4 animate-spin" />} Confirm
            </button>
          )}

          {mode === "email" && (
            <button
              type="button"
              disabled={!email.trim() || pending}
              onClick={() => runAction(() => onSend?.(email.trim()))}
              aria-busy={pending}
              className="focus-ring btn-gradient inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Send
            </button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}


