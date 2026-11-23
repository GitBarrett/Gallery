import { describe, expect, it } from 'vitest'
import { SOCIAL_PLATFORMS, socialLink, validateSocialHandle } from './social-links'

describe('social links', () => {
  it('US-82.1 offers the fixed list of networks, in display order', () => {
    expect(SOCIAL_PLATFORMS).toEqual([
      'twitch',
      'youtube',
      'x',
      'bluesky',
      'instagram',
      'tiktok',
      'reddit',
      'discord',
      'website',
    ])
  })

  it('US-82.2 checks each identifier against the format of its network', () => {
    const valid = {
      twitch: 'Ash_Barrett',
      youtube: '@ash.barrett',
      x: 'ash_barrett',
      bluesky: 'ash.bsky.social',
      instagram: 'ash.barrett',
      tiktok: 'ash.barrett',
      reddit: 'ash-barrett',
      discord: 'ash.barrett',
      website: 'https://ash.example.com/shots',
    }
    for (const [platform, handle] of Object.entries(valid))
      expect(validateSocialHandle(platform as never, handle)).toEqual({ ok: true, value: handle })
    const invalid = {
      twitch: 'ash', // under 4 characters
      youtube: 'ash_barrett', // no @
      x: 'ash_barrett_the_hunter', // over 15
      bluesky: 'not a domain',
      instagram: 'ash barrett',
      tiktok: '@ash', // the @ is added by the link
      reddit: 'ab',
      discord: 'Ash Barrett',
    }
    for (const [platform, handle] of Object.entries(invalid))
      expect(validateSocialHandle(platform as never, handle)).toEqual({ ok: false, error: 'format' })
  })

  it('US-82.2 refuses an insult in an identifier', () => {
    expect(validateSocialHandle('twitch', 'the_bastard')).toEqual({ ok: false, error: 'insult' })
  })

  it('US-82.3 accepts a website only over https, without an IP, a shortener or more than 200 characters', () => {
    for (const url of [
      'http://ash.example.com',
      'javascript:alert(1)',
      'https://192.168.0.1/',
      'https://[::1]/',
      'https://bit.ly/abc',
      'https://www.tinyurl.com/abc',
      'https://user:pass@ash.example.com',
      'https://localhost',
      `https://ash.example.com/${'a'.repeat(200)}`,
    ])
      expect(validateSocialHandle('website', url)).toEqual({ ok: false, error: 'format' })
  })

  it('US-82.4 builds every link from the fixed template of its network', () => {
    expect(socialLink('twitch', 'Ash_Barrett')).toEqual({ label: 'Ash_Barrett', url: 'https://twitch.tv/Ash_Barrett' })
    expect(socialLink('youtube', '@ash')).toEqual({ label: '@ash', url: 'https://youtube.com/@ash' })
    expect(socialLink('x', 'ash')?.url).toBe('https://x.com/ash')
    expect(socialLink('bluesky', 'ash.bsky.social')?.url).toBe('https://bsky.app/profile/ash.bsky.social')
    expect(socialLink('instagram', 'ash.b')?.url).toBe('https://instagram.com/ash.b')
    expect(socialLink('tiktok', 'ash.b')?.url).toBe('https://tiktok.com/@ash.b')
    expect(socialLink('reddit', 'ash-b')?.url).toBe('https://reddit.com/user/ash-b')
  })

  it('US-82.4 gives Discord no link and shows a website by its domain', () => {
    expect(socialLink('discord', 'ash.barrett')).toEqual({ label: 'ash.barrett', url: null })
    expect(socialLink('website', 'https://www.ash.example.com/shots?x=1')).toEqual({
      label: 'www.ash.example.com',
      url: 'https://www.ash.example.com/shots?x=1',
    })
  })

  it('US-82.4 builds no link from a stored identifier that is no longer valid', () => {
    expect(socialLink('twitch', 'a/../evil')).toBeNull()
    expect(socialLink('website', 'javascript:alert(1)')).toBeNull()
  })
})
