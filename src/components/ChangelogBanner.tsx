import { signal } from '@preact/signals'

interface ChangelogEntry {
  date: string
  title: string
  items: string[]
}

const COOKIE_NAME = 'changelog_dismissed'
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
  const dismissed = getCookie(COOKIE_NAME)

  // First visit: set cookie to now so they're "caught up", show nothing
  if (!dismissed) {
    setCookie(COOKIE_NAME, new Date().toISOString())
    return
  }

  try {
    const res = await fetch('./changelog.json')
    const all: ChangelogEntry[] = await res.json()
    const dismissedTime = new Date(dismissed).getTime()
    // Show entries newer than what they last dismissed
    entries.value = all
      .filter(e => new Date(e.date).getTime() > dismissedTime)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  } catch {
    // ignore fetch errors
  }
}

function dismiss(): void {
  // Advance cookie to the newest entry shown
  const shown = entries.value
  if (shown.length > 0) {
    const newest = shown.reduce((a, b) =>
      new Date(a.date).getTime() > new Date(b.date).getTime() ? a : b
    )
    setCookie(COOKIE_NAME, newest.date)
  }
  entries.value = []
}

loadChangelog()

export function ChangelogBanner() {
  if (entries.value.length === 0) return null

  return (
    <div class="changelog-banner">
      <div class="changelog-content">
        <div class="changelog-header">What's new since your last visit:</div>
        {entries.value.map((entry, i) => (
          <>
            {i > 0 && <hr class="changelog-separator" />}
            <div key={entry.date} class="changelog-entry">
              <strong>{entry.title}</strong>
              <ul class="changelog-items">
                {entry.items.map(item => <li>{item}</li>)}
              </ul>
            </div>
          </>
        ))}
      </div>
      <button class="changelog-dismiss" onClick={dismiss} aria-label="Dismiss">x</button>
    </div>
  )
}
