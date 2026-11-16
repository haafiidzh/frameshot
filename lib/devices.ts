// Original device frames, drawn procedurally. Geometry only, no traced art.
export type DeviceType = 'generic' | 'browser' | 'phone' | 'tablet' | 'laptop' | 'desktop' | 'watch'
export interface Device {
  slug: string
  name: string
  type: DeviceType
  /** frame aspect (w/h) when media is absent; screen aspect is derived */
  aspect: number
  /** bezel thickness as a fraction of the shorter side */
  bezel: number
  /** outer corner radius as a fraction of the shorter side */
  corner: number
  /** extra chrome */
  chrome?: 'notch' | 'island' | 'punch' | 'browser' | 'stand' | 'base' | 'crown'
  adapts?: boolean
  isNew?: boolean
  section: string
}

export const DEVICES: Device[] = [
  { slug: 'screenshot', name: 'Screenshot', type: 'generic', aspect: 4 / 3, bezel: 0, corner: 0.03, adapts: true, section: 'Essentials' },
  { slug: 'browser', name: 'Browser window', type: 'browser', aspect: 16 / 10, bezel: 0.0, corner: 0.025, chrome: 'browser', adapts: true, section: 'Essentials' },
  { slug: 'phone-island', name: 'Phone Island', type: 'phone', aspect: 9 / 19.5, bezel: 0.035, corner: 0.16, chrome: 'island', isNew: true, section: 'Phones' },
  { slug: 'phone-notch', name: 'Phone Notch', type: 'phone', aspect: 9 / 19.5, bezel: 0.04, corner: 0.13, chrome: 'notch', section: 'Phones' },
  { slug: 'phone-punch', name: 'Phone Punch', type: 'phone', aspect: 9 / 20, bezel: 0.03, corner: 0.1, chrome: 'punch', section: 'Phones' },
  { slug: 'phone-compact', name: 'Phone Compact', type: 'phone', aspect: 9 / 16, bezel: 0.05, corner: 0.12, section: 'Phones' },
  { slug: 'phone-slim', name: 'Phone Slim', type: 'phone', aspect: 9 / 21, bezel: 0.028, corner: 0.15, chrome: 'punch', section: 'Phones' },
  { slug: 'foldable', name: 'Foldable (open)', type: 'tablet', aspect: 0.92, bezel: 0.03, corner: 0.07, chrome: 'punch', isNew: true, section: 'Tablets & laptops' },
  { slug: 'tablet', name: 'Tablet', type: 'tablet', aspect: 4 / 3, bezel: 0.05, corner: 0.06, section: 'Tablets & laptops' },
  { slug: 'tablet-portrait', name: 'Tablet Portrait', type: 'tablet', aspect: 3 / 4, bezel: 0.05, corner: 0.06, section: 'Tablets & laptops' },
  { slug: 'tablet-slim', name: 'Tablet Slim', type: 'tablet', aspect: 4 / 3, bezel: 0.028, corner: 0.045, section: 'Tablets & laptops' },
  { slug: 'laptop-wide', name: 'Laptop Wide', type: 'laptop', aspect: 16 / 10, bezel: 0.014, corner: 0.025, chrome: 'base', section: 'Tablets & laptops' },
  { slug: 'laptop', name: 'Laptop', type: 'laptop', aspect: 16 / 10.5, bezel: 0.025, corner: 0.03, chrome: 'base', section: 'Tablets & laptops' },
  { slug: 'monitor', name: 'Monitor', type: 'desktop', aspect: 16 / 10, bezel: 0.018, corner: 0.02, chrome: 'stand', section: 'Desktop' },
  { slug: 'ultrawide', name: 'Ultrawide Monitor', type: 'desktop', aspect: 21 / 9, bezel: 0.012, corner: 0.015, chrome: 'stand', section: 'Desktop' },
  { slug: 'tv', name: 'TV', type: 'desktop', aspect: 16 / 9, bezel: 0.008, corner: 0.012, chrome: 'stand', section: 'Desktop' },
  { slug: 'watch-round', name: 'Watch Round', type: 'watch', aspect: 1, bezel: 0.07, corner: 0.5, chrome: 'crown', section: 'Wearables' },
  { slug: 'watch', name: 'Watch', type: 'watch', aspect: 0.82, bezel: 0.06, corner: 0.28, chrome: 'crown', section: 'Wearables' },
]

export const DEVICE_FILTERS: { id: 'all' | DeviceType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'phone', label: 'Phones' },
  { id: 'tablet', label: 'Tablets' },
  { id: 'laptop', label: 'Laptops' },
  { id: 'desktop', label: 'Desktops' },
  { id: 'watch', label: 'Watches' },
]

export const getDevice = (slug: string) => DEVICES.find((d) => d.slug === slug) ?? DEVICES[0]
