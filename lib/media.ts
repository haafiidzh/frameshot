// Decoded media registry. Scenes hold only ids so they stay serialisable.
const registry = new Map<string, HTMLImageElement>()
export const MAX_BYTES = 25 * 1024 * 1024
export const MAX_DIM = 8192

export class MediaError extends Error {}

export const getMedia = (id?: string) => (id ? registry.get(id) : undefined)
export const clearMedia = () => { registry.clear(); signatures.clear(); library = []; emit() }

// Session library: every image the user adds stays here (memory only, gone on refresh) so a layout change
// never needs a second upload. Decoded images stay in `registry` even after a library entry is hidden,
// so Undo can still bring a removed image back.
export const MAX_LIBRARY = 24
export interface LibraryItem { id: string; name: string; w: number; h: number; thumb: string }
let library: LibraryItem[] = []
const listeners = new Set<() => void>()
const signatures = new Map<string, string>()
const emit = () => { library = [...library]; listeners.forEach((l) => l()) }
export const subscribeLibrary = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const getLibrary = () => library
export const removeFromLibrary = (id: string) => {
  library = library.filter((i) => i.id !== id)
  for (const [sig, v] of signatures) if (v === id) signatures.delete(sig)
  emit()
}

/** Same bytes means the same image, wherever it came from (disk, paste, drag). Falls back to metadata if hashing is unavailable. */
async function fileSignature(file: File): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return `${file.size}:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return `${file.name}|${file.size}|${file.lastModified}`
  }
}

function makeThumb(img: HTMLImageElement): string {
  const max = 160, s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s))
  const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

export async function loadImageFile(file: File): Promise<{ id: string; w: number; h: number }> {
  if (file.type.startsWith('video/')) throw new MediaError('Video mockups arrive in a later version. Use a still image for now.')
  if (!file.type.startsWith('image/')) throw new MediaError('That file is not an image. Try PNG, JPG, WebP or GIF.')
  if (file.size > MAX_BYTES) throw new MediaError('That image is over 25 MB. Pick a smaller one.')
  const sig = await fileSignature(file)
  const known = signatures.get(sig)
  const existing = known ? library.find((i) => i.id === known) : undefined
  if (existing && registry.has(existing.id)) return { id: existing.id, w: existing.w, h: existing.h }
  if (library.length >= MAX_LIBRARY) throw new MediaError(`Your library holds ${MAX_LIBRARY} images. Remove one you no longer need, then add this one.`)
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new MediaError('We could not read that image. It may be damaged.'))
      img.src = url
    })
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM) {
    URL.revokeObjectURL(url)
    throw new MediaError('That image is larger than 8192 px on one side. Resize it first.')
  }
  // Check again after decoding: two uploads running at once can both pass the first check.
  const raced = signatures.get(sig)
  const twin = raced ? library.find((i) => i.id === raced) : undefined
  if (twin && registry.has(twin.id)) { URL.revokeObjectURL(url); return { id: twin.id, w: twin.w, h: twin.h } }
  if (library.length >= MAX_LIBRARY) { URL.revokeObjectURL(url); throw new MediaError(`Your library holds ${MAX_LIBRARY} images. Remove one you no longer need, then add this one.`) }
  const id = crypto.randomUUID()
  registry.set(id, img)
  signatures.set(sig, id)
  library = [...library, { id, name: file.name || 'Pasted image', w: img.naturalWidth, h: img.naturalHeight, thumb: makeThumb(img) }]
  emit()
  return { id, w: img.naturalWidth, h: img.naturalHeight }
}
