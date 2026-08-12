"use client"

import { useState } from "react"
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
  onConfirm?: () => void
  onSend?: (email: string) => void
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

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
          />
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>

          {mode === "delete" && (
            <button
            type="button"
            onClick={async () => {
                console.log("CONFIRM HANDLER STARTED ✅")
                await onConfirm?.()
                setOpen(false)
            }}
            className="px-4 py-2 bg-red-600 text-white rounded cursor-pointer"
            >
            Confirm
            </button>
          )}

          {mode === "email" && (
            <button
              type="button"
              disabled={!email}
              onClick={() => {
                console.log("SEND CLICKED ✅", email)
                onSend?.(email)
                setEmail("")
                setOpen(false)
              }}
              className="px-4 py-2 btn-gradient hover:btn-gradient1 text-white rounded cursor-pointer"
            >
              Send
            </button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}


