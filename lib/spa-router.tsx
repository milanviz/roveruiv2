import React, { useEffect, useState } from "react"

const NAVIGATION_EVENT = "rover:navigate"

function navigate(href: string, replace = false) {
  if (replace) window.history.replaceState({}, "", href)
  else window.history.pushState({}, "", href)
  window.dispatchEvent(new Event(NAVIGATION_EVENT))
  window.scrollTo({ top: 0 })
}

export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener("popstate", update)
    window.addEventListener(NAVIGATION_EVENT, update)
    return () => {
      window.removeEventListener("popstate", update)
      window.removeEventListener(NAVIGATION_EVENT, update)
    }
  }, [])

  return pathname
}

export function useSearchParams() {
  const [search, setSearch] = useState(() => window.location.search)

  useEffect(() => {
    const update = () => setSearch(window.location.search)
    window.addEventListener("popstate", update)
    window.addEventListener(NAVIGATION_EVENT, update)
    return () => {
      window.removeEventListener("popstate", update)
      window.removeEventListener(NAVIGATION_EVENT, update)
    }
  }, [])

  return new URLSearchParams(search)
}

export function useRouter() {
  usePathname()
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, true),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
  }
}

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

export function Link({ href, onClick, target, ...props }: LinkProps) {
  return (
    <a
      href={href}
      target={target}
      onClick={(event) => {
        onClick?.(event)
        if (
          event.defaultPrevented ||
          target === "_blank" ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          !href.startsWith("/")
        ) return
        event.preventDefault()
        navigate(href)
      }}
      {...props}
    />
  )
}

type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string
  alt: string
  width?: number | string
  height?: number | string
  fill?: boolean
  unoptimized?: boolean
}

export function Image({ alt, fill, unoptimized: _unoptimized, style, ...props }: ImageProps) {
  const fillStyle: React.CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
    : style
  return <img alt={alt} style={fillStyle} {...props} />
}
