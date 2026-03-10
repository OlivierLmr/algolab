# Storing Algorithm Source in URL

## Feasibility

Store the full pseudocode in a `#code=...` hash fragment. The fragment never reaches the server, so only browser limits apply.

## Browser URL Length Limits

| Browser | Max URL length |
|---------|---------------|
| Chrome (& Chromium Edge) | ~32,767 chars |
| Firefox | ~65,536 chars |
| Safari | ~80,000 chars |

## Compression Results (deflate + base64url)

| Algorithm | Source | Compressed | Ratio |
|-----------|--------|------------|-------|
| Insertion Sort | 378 chars | ~283 chars | 75% |
| Bubble Sort | 436 chars | ~302 chars | 69% |
| Selection Sort | 497 chars | ~347 chars | 70% |
| Merge Sort BU | 1,297 chars | ~702 chars | 54% |
| Merge Sort LR | 1,331 chars | ~715 chars | 54% |

Largest algorithm uses ~2% of Chrome's limit. Plenty of headroom.

## Compression Options

| Option | Bundle size | Compression | Used by |
|--------|------------|-------------|---------|
| lz-string | 4 kB | 72–87% of original | TypeScript Playground |
| fflate (deflate+b64) | 8 kB | 55–75% of original | — |
| pako (deflate+b64) | 45 kB | 55–75% of original | Mermaid Live Editor |
| Native `CompressionStream` | 0 kB | same as deflate | async API |

**Recommendation**: `fflate` or native `CompressionStream`. Deflate beats lz-string by 15–18 percentage points.

## Implementation Sketch

```typescript
import { deflateSync, inflateSync } from 'fflate'

function encodeForURL(source: string): string {
  const compressed = deflateSync(new TextEncoder().encode(source), { level: 9 })
  return btoa(String.fromCharCode(...compressed))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeFromURL(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return new TextDecoder().decode(inflateSync(binary))
}

// window.location.hash = '#code=' + encodeForURL(source)
// const source = decodeFromURL(hash.slice('#code='.length))
```

Input array can also be stored: `#code=...&input=9,1,4,7`.
