"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, Bell, Zap, ChevronDown, Check, Pen, X } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useProjectStore } from "@/app/store/project/project.store"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogPortal,
  AlertDialogOverlay,
} from "@/components/ui/alert-dialog"
import StripePaymentPlan from "@/components/stripe-payment-plan"

interface TopbarProps {
  onMenuClick: () => void
}

const languages = [
  { code: "en", name: "English", flag: "/assets/images/english.png" },
  { code: "ja", name: "Japanese", flag: "/assets/images/japan.png" },
]

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { language, setLanguage, t } = useLanguage()
  const [isLanguageOpen, setIsLanguageOpen] = useState(false)
  const [isPaymentPopupOpen, setIsPaymentPopupOpen] = useState(false)
  const [curUserData, setCurUserData] = useState({ email: "", user: "" });
  const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "";
  const selectedLanguage = languages.find((lang) => lang.code === language) || languages[0]

  const { currentUser } = useProjectStore();

  useEffect(() => {
    const email = localStorage.getItem("rover_user_email") || "";
    const currentUser = localStorage.getItem("rover_login_username") || "";
    // setCurUserEmail(email);
    setCurUserData(prev => ({
      ...prev,
      email,
      user: currentUser,
    }))
  }, []);

  const firstLetter = currentUser ? currentUser.charAt(0).toUpperCase() : "";

  const handleLanguageSelect = (lang: (typeof languages)[0]) => {
    setLanguage(lang.code as "en" | "ja")
    setIsLanguageOpen(false)
  }

  return (
    <header className="bg-sidebar border-b border-border h-[61px] px-6 flex items-center justify-between flex-shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-secondary rounded-lg transition-colors text-sidebar-foreground md:hidden cursor-pointer"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <Link href={`/?=${Date.now()}`}>
          <Image src={`${assetPrefix}/assets/icons/rover_label.svg`} alt="Rover Logo" width={135} height={28} />
          {/* <h1 className="text-sm font-bold text-sidebar-foreground hidden md:block tracking-wide cursor-pointer">
            ROVER
          </h1> */}
        </Link>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-5">
        <div className="relative">
          {/* <button
            onClick={() => setIsLanguageOpen(!isLanguageOpen)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-sidebar-accent rounded-lg transition-colors text-sidebar-foreground text-sm cursor-pointer"
          >
            <span className="text-lg"><Image src={`${assetPrefix + selectedLanguage.flag}`} alt="Rover Logo" width={17} height={17} /></span>
            <span className="hidden md:inline">{selectedLanguage.name}</span>
            <ChevronDown size={16} className={`transition-transform ${isLanguageOpen ? "rotate-180" : ""}`} />
          </button> */}

          {isLanguageOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsLanguageOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-sm text-popover-foreground cursor-pointer"
                  >
                    <span className="text-base"><Image src={`${assetPrefix + lang.flag}`} alt="Rover Logo" width={17} height={17} /></span>
                    <span className="flex-1 text-left">{lang.name}</span>
                    {selectedLanguage.code === lang.code && <Check size={16} className="text-green-500" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Payment Popup */}
        <AlertDialog open={isPaymentPopupOpen} onOpenChange={setIsPaymentPopupOpen}>
          <AlertDialogPortal>
            <AlertDialogOverlay />
            <AlertDialogContent className="max-w-[1000px] w-[95vw] h-[90vh]  p-0 overflow-hidden">
              {/* Close Button */}
              <button
                onClick={() => setIsPaymentPopupOpen(false)}
                className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>

              {/* Payment Component */}
              <div className="h-full overflow-auto">
                <StripePaymentPlan onClose={() => setIsPaymentPopupOpen(false)} />
              </div>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialog>





        {/* <button
          className="p-2 hover:bg-sidebar-accent rounded-lg transition-colors text-sidebar-foreground"
          aria-label="Help"
        >
          <HelpIcon size={20} />
        </button>
        <button
          className="p-2 hover:bg-sidebar-accent rounded-lg transition-colors text-sidebar-foreground"
          aria-label="Notifications"
        >
          <Bell size={20} />
        </button>
        <button className="w-10 h-10 bg-sidebar-accent text-sidebar-foreground rounded-full flex items-center justify-center font-semibold hover:opacity-90 transition-opacity text-sm">
          E
        </button> */}
      </div>
    </header>
  )
}

function HelpIcon(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const size = props.size || 24
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
