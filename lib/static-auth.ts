export const DEMO_USERNAME = "demo@vizru.com"
export const DEMO_PASSWORD = "84978"

const SESSION_KEY = "rover_demo_authenticated"
export const AUTH_CHANGE_EVENT = "rover:auth-change"

export function isDemoAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === "true"
}

export function signInDemo(username: string, password: string) {
  const valid = username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD
  if (!valid) return false

  sessionStorage.setItem(SESSION_KEY, "true")
  localStorage.setItem("rover_user_email", DEMO_USERNAME)
  localStorage.setItem("rover_login_username", DEMO_USERNAME)
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
  return true
}

export function signOutDemo() {
  sessionStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}
