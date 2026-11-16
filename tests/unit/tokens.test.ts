import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const files = (dir: string) => readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.tsx')).map((f) => [`${dir}/${f}`, readFileSync(path.join(root, dir, f), 'utf8')] as const)

describe('tokens only in components', () => {
  it.each(files('components'))('%s has no raw px/rem/vh arbitrary values and no raw hex colours', (_name, src) => {
    expect(src.match(/\[[0-9.]+(px|rem|vh|vw)\]/g) ?? []).toEqual([])
    // hex colours are only allowed inside the palette/art data in lib/, not in components
    const hex = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter((h) => !/^#[0-9]+$/.test(h))
    expect(hex).toEqual([])
  })
  it('selection never uses a black outline or border', () => {
    for (const [name, src] of [...files('components')]) expect(src, name).not.toMatch(/outline-accent|border-accent|border-black|border-text/)
  })
  it('does not reference the reference app domain or CDN (clean room)', () => {
    for (const [name, src] of [...files('components')]) expect(src, name).not.toMatch(/shots\.so|assets\.shots|shotsapphq/i)
  })
})
