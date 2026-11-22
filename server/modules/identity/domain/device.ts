/** Readable device of a session (US-03.7): browser and system read from the stored User-Agent, null when unknown. */
export interface Device {
  browser: string | null
  os: string | null
}

// First match wins: Edge, Opera and Samsung also announce Chrome; iOS also announces Mac OS X; Android announces Linux
const BROWSERS: [RegExp, string][] = [
  [/Edg(A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Version\/.*Safari\//, 'Safari'],
]
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
]

const first = (ua: string, rules: [RegExp, string][]) => rules.find(([re]) => re.test(ua))?.[1] ?? null

export const deviceOf = (userAgent: string | null): Device => ({
  browser: userAgent ? first(userAgent, BROWSERS) : null,
  os: userAgent ? first(userAgent, SYSTEMS) : null,
})
