import { describe, expect, it } from 'vitest'
import { validateBio, validatePassword, validateUsername } from './account-rules'

describe('validateUsername', () => {
  it.each(['Ash', 'Ash_Barrett', 'night-elf-42', 'a'.repeat(24)])('US-05.1 accepts %s', (name) => {
    expect(validateUsername(name)).toEqual({ ok: true, value: name })
  })

  it.each([
    ['ab', 'length'],
    ['a'.repeat(25), 'length'],
    ['Ash Barrett', 'charset'],
    ['Thrall!', 'charset'],
    ['Élune', 'charset'],
  ])('US-05.1 refuses %s (%s)', (name, problem) => {
    expect(validateUsername(name)).toEqual({ ok: false, error: problem })
  })

  it.each(['admin', 'Moderator', 'SUPPORT', 'api', 'settings', 'upload'])('US-05.2 refuses the reserved %s', (name) => {
    expect(validateUsername(name)).toEqual({ ok: false, error: 'reserved' })
  })

  it.each(['FuckThis', 'gros_connard', 'xX_Bitch_Xx', 'Putain42', 'HitlerFan', 'Le-Batard'])(
    'US-05.2 refuses %s, which contains an insult',
    (name) => {
      expect(validateUsername(name)).toEqual({ ok: false, error: 'insult' })
    },
  )

  it.each([
    'Computer',
    'Peacock',
    'Grapefruit',
    'Torpedo',
    'Montenegro',
    'Analyst',
    'Document',
    'Chatterbox',
    'Unique',
    'Dickens',
    'Spicy',
  ])('US-05.1 accepts %s, which only looks like an insult', (name) => {
    expect(validateUsername(name)).toEqual({ ok: true, value: name })
  })
})

describe('validatePassword', () => {
  it.each([10, 128])('US-01.1 accepts %i characters', (length) => {
    expect(validatePassword('p'.repeat(length)).ok).toBe(true)
  })

  it('US-01.1 counts characters, not UTF-16 units', () => {
    expect(validatePassword('🐉'.repeat(128)).ok).toBe(true)
  })

  it.each([
    [9, 'too_short'],
    [129, 'too_long'],
  ])('US-01.1 refuses %i characters', (length, problem) => {
    expect(validatePassword('p'.repeat(length))).toEqual({ ok: false, error: problem })
  })
})

describe('validateBio', () => {
  it('US-07.1 keeps a bio of up to 300 characters, trimmed, and gives null for an empty one', () => {
    expect(validateBio('  Night elf hunter.  ')).toEqual({ ok: true, value: 'Night elf hunter.' })
    expect(validateBio('🌙'.repeat(300))).toEqual({ ok: true, value: '🌙'.repeat(300) })
    expect(validateBio('   ')).toEqual({ ok: true, value: null })
  })

  it('US-07.1 refuses a bio over 300 characters or with an insult', () => {
    expect(validateBio('b'.repeat(301))).toEqual({ ok: false, error: 'too_long' })
    expect(validateBio('Ask the bastard of Stormwind')).toEqual({ ok: false, error: 'insult' })
  })
})
