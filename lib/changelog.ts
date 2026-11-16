export interface ChangeEntry { date: string; title: string; items: string[] }

// Written for this app. It describes what this editor does, not any other product.
export const CHANGELOG: ChangeEntry[] = [
  { date: '2026-11-10', title: 'Look and workflow', items: [
    'Light and dark themes, or follow your system.',
    'Command palette: press Ctrl+K (or Cmd+K) to run any action by typing.',
    'Magic look and magic blend: colours and a frame chosen from your own image.',
    'Grain, vignette, glows, rings and a text watermark you write yourself.',
    'Screen glare, and an option to show the image without a frame.',
    'Performance mode and a full-screen preview.',
  ] },
  { date: '2026-11-10', title: 'More room to design', items: [
    'Eight starting templates that keep your images.',
    'Custom canvas sizes plus social and app-store presets.',
    'Export at 1x, 2x or 3x.',
    'Sixteen device frames, ten looks and thirteen layouts.',
  ] },
  { date: '2026-11-10', title: 'Many images at once', items: [
    'Bento layouts: put several images in one picture, with eight arrangements.',
    'A library keeps the images you added, so changing layout never needs a second upload (cleared when you refresh).',
  ] },
]
