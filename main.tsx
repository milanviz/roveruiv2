import React from "react"
import ReactDOM from "react-dom/client"
import App from "@/App"
import "@/app/globals.css"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "@/lib/mock-fetch"

document.documentElement.lang = "en"
document.documentElement.classList.add("dark")
document.body.className = "font-sans antialiased dark bg-transparent"
document.body.style.setProperty("--bg-image-url", `url('${import.meta.env.BASE_URL}assets/images/bg.png')`)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
