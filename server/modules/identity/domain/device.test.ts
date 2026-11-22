import { describe, expect, it } from 'vitest'
import { deviceOf } from './device'

const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1',
  firefoxIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  samsungAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  operaChromeOs:
    'Mozilla/5.0 (X11; CrOS x86_64 15917.71.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/115.0',
}

describe('deviceOf', () => {
  it.each([
    [UA.chromeWindows, 'Chrome', 'Windows'],
    [UA.edgeWindows, 'Edge', 'Windows'],
    [UA.firefoxLinux, 'Firefox', 'Linux'],
    [UA.safariIphone, 'Safari', 'iOS'],
    [UA.chromeIphone, 'Chrome', 'iOS'],
    [UA.firefoxIphone, 'Firefox', 'iOS'],
    [UA.safariMac, 'Safari', 'macOS'],
    [UA.samsungAndroid, 'Samsung Internet', 'Android'],
    [UA.operaChromeOs, 'Opera', 'ChromeOS'],
  ])('US-03.7 reads the browser and the system of %s', (ua, browser, os) => {
    expect(deviceOf(ua)).toEqual({ browser, os })
  })

  it('US-03.7 gives nulls for an unknown or missing user agent', () => {
    expect(deviceOf('curl/8.4.0')).toEqual({ browser: null, os: null })
    expect(deviceOf(null)).toEqual({ browser: null, os: null })
  })
})
