import { signal } from '@preact/signals'

interface ChangelogEntry {
  date: string
  title: string
  message: string
}

const COOKIE_NAME = 'last_visit'
const entries = signal<ChangelogEntry[]>([])

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string): void {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

async function loadChangelog(): Promise<void> {
  const lastVisit = getCookie(COOKIE_NAME)
  // Set cookie to now for next visit
  setCookie(COOKIE_NAME, new Date().toISOString())

  // First visit (no cookie) → don't show
  if (!lastVisit) return

  try {
    const res = await fetch('./changelog.json')
    const all: ChangelogEntry[] = await res.json()
    const lastVisitTime = new Date(lastVisit).getTime()
    // Show entries newer than last visit
    const unseen = all.filter(e => new Date(e.date).getTime() > lastVisitTime)
    entries.value = unseen
  } catch {
    // ignore fetch errors
  }
}

loadChangelog()

export function ChangelogBanner() {
  if (entries.value.length === 0) return null

  const dismiss = () => { entries.value = [] }

  return (
    <div class="changelog-banner">
      <div class="changelog-content">
        <div class="changelog-header">What's new since your last visit:</div>
        {entries.value.map((entry) => (
          <div key={entry.date} class="changelog-entry">
            <strong>{entry.title}</strong>
            <span> — {entry.message}</span>
          </div>
        ))}
      </div>
      <button class="changelog-dismiss" onClick={dismiss} aria-label="Dismiss">x</button>
    </div>
  )
}
