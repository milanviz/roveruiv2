import React from "react"
import ReactDOM from "react-dom/client"
import App from "@/App"
import "@/app/globals.css"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "@/lib/mock-fetch"
import { assetPath } from "@/lib/env"

document.documentElement.lang = "en"
document.documentElement.classList.add("dark")
document.body.className = "font-sans antialiased dark bg-transparent"
document.body.style.setProperty("--bg-image-url", `url('${assetPath("images/bg.png")}')`)
const favicon = document.createElement("link")
favicon.rel = "icon"
favicon.href = assetPath("icons/rover_icon.svg")
document.head.appendChild(favicon)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
