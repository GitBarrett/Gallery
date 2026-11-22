// node scripts/pwa-icons.mjs — PWA icons from the emblem (03-architecture.md § PWA), rendered by Chromium and committed.
// Re-run it when public/brand/emblem.svg changes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BACKGROUND = '#0B0E14'
const svg = `data:image/svg+xml;base64,${readFileSync('public/brand/emblem.svg').toString('base64')}`

// size: canvas; scale: share of the canvas taken by the emblem; background: none = transparent
const ICONS = [
  { file: 'public/icons/icon-192.png', size: 192, scale: 1 },
  { file: 'public/icons/icon-512.png', size: 512, scale: 1 },
  // Maskable: the emblem stays inside the 80 % safe zone, on the site background
  { file: 'public/icons/maskable-512.png', size: 512, scale: 0.7, background: BACKGROUND },
  // Monochrome: only the alpha channel counts, white silhouette
  { file: 'public/icons/monochrome-512.png', size: 512, scale: 1, filter: 'brightness(0) invert(1)' },
  // iOS ignores transparency: opaque background
  { file: 'public/icons/apple-touch-icon.png', size: 180, scale: 0.8, background: BACKGROUND },
  { file: 'favicon-32.png', size: 32, scale: 1 },
]

const browser = await chromium.launch()
const page = await browser.newPage()
const pngs = {}
for (const { file, size, scale, background = 'transparent', filter = 'none' } of ICONS) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${background}">` +
      `<img src="${svg}" style="width:${size * scale}px;height:${size * scale}px;filter:${filter}"></body>`,
  )
  await page.locator('img').evaluate((img) => img.decode())
  pngs[file] = await page.screenshot({ omitBackground: background === 'transparent' })
}
await browser.close()

mkdirSync('public/icons', { recursive: true })
for (const [file, png] of Object.entries(pngs)) if (file !== 'favicon-32.png') writeFileSync(file, png)

// favicon.ico: one 32 px PNG image wrapped in an ICO header (format accepted by every current browser)
const png = pngs['favicon-32.png']
const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // one image
header.writeUInt8(32, 6) // width
header.writeUInt8(32, 7) // height
header.writeUInt16LE(1, 10) // colour planes
header.writeUInt16LE(32, 12) // bits per pixel
header.writeUInt32LE(png.length, 14)
header.writeUInt32LE(22, 18) // image offset
writeFileSync('public/favicon.ico', Buffer.concat([header, png]))
console.log(`${ICONS.length} icons written`)
