import { FormEvent, useState } from "react"
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"
import { assetPath } from "@/lib/env"
import { DEMO_USERNAME, signInDemo } from "@/lib/static-auth"

export default function LoginPage() {
  const [username, setUsername] = useState(DEMO_USERNAME)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (!signInDemo(username, password)) {
      setError("The email or password is incorrect.")
    }
  }

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center overflow-hidden bg-black/20 px-5 py-10">
      <section className="relative w-full max-w-[430px] rounded-2xl border border-white/10 bg-[#111111]/95 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-9">
        <div className="mb-9 flex flex-col items-center text-center">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_0_40px_rgba(121,113,255,0.14)]">
            <img
              src={assetPath("icons/rover_icon.svg")}
              alt="Rover"
              width={29}
              height={29}
            />
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-white">Welcome to Rover</h1>
          <p className="mt-2 text-sm font-light text-[#989898]">
            Sign in to continue to your research workspace.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="username" className="mb-2 block text-sm text-[#d2d2d2]">
              Email address
            </label>
            <div className="relative">
              <Mail aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777]" size={18} />
              <input
                id="username"
                name="username"
                type="email"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-12 w-full rounded-lg border border-[#303030] bg-[#0b0b0b] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[#5f5f5f] focus:border-[#8580ee] focus:ring-2 focus:ring-[#8580ee]/15"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-[#d2d2d2]">
              Password
            </label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777]" size={18} />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-lg border border-[#303030] bg-[#0b0b0b] pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-[#5f5f5f] focus:border-[#8580ee] focus:ring-2 focus:ring-[#8580ee]/15"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="focus-ring absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-[#777] transition hover:bg-white/5 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="container-gradient mt-1 h-12 w-full rounded-lg text-sm font-medium text-white shadow-[0_10px_30px_rgba(91,82,210,0.2)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#9893ff] focus:ring-offset-2 focus:ring-offset-[#111]"
          >
            Sign in
          </button>
        </form>

        <p className="mt-7 text-center text-xs text-[#646464]">Rover · AI-powered research workspace</p>
      </section>
    </main>
  )
}
