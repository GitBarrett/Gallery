import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { previewConfig, previewNumbers } from './preview-config.mjs'

const production = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
const preview = previewConfig(production, { pr: 42, hyperdriveId: 'aaaabbbbccccddddeeeeffff00001111' })

describe('previewConfig (ADR-013)', () => {
  it('names the Worker and its public URL after the pull request', () => {
    expect(preview.toml).toContain('name = "ls-pr-42"')
    expect(preview.toml).toContain('NUXT_PUBLIC_SITE_URL = "https://ls-pr-42.aleygues.workers.dev"')
  })

  it('switches to preview mode with fake providers and its own R2 prefix', () => {
    expect(preview.toml).toContain('NUXT_DEPLOY_ENV = "preview"')
    expect(preview.toml).toContain('NUXT_FAKE_PROVIDERS = "true"')
    expect(preview.toml).toContain('NUXT_R2_PREFIX = "pr-42/"')
  })

  it('points to the preview bucket and the dedicated Hyperdrive config, never to production', () => {
    expect(preview.toml).toContain('bucket_name = "ls-preview"')
    expect(preview.toml).toContain('id = "aaaabbbbccccddddeeeeffff00001111"')
    expect(preview.toml).not.toContain('ls-prod')
    expect(preview.toml).not.toMatch(/legendary-shots/)
  })

  it('counts preview bursts apart from production (own rate limiting namespace)', () => {
    expect(production).toContain('namespace_id = "1001"')
    expect(preview.toml).toContain('namespace_id = "1002"')
    expect(preview.toml).not.toContain('namespace_id = "1001"')
  })

  it('suffixes every queue and dead letter queue, and lists them for creation', () => {
    expect(preview.queues).toContain('photo-process-pr-42')
    expect(preview.queues).toContain('photo-process-dlq-pr-42')
    expect(preview.queues).toHaveLength(10)
    for (const line of preview.toml.split('\n').filter((l) => /^(queue|dead_letter_queue) =/.test(l))) {
      expect(line).toMatch(/-pr-42"$/)
    }
  })

  it('refuses a production file whose resources it does not recognise', () => {
    expect(() =>
      previewConfig(production.replace('bucket_name = "ls-prod"', 'bucket_name = "other"'), {
        pr: 1,
        hyperdriveId: 'x',
      }),
    ).toThrow(/ls-prod/)
  })
})

describe('previewNumbers (T-03c)', () => {
  it('finds the pull request of every preview resource, never a production one', () => {
    const names = [
      'ls-pr-12',
      'photo-process-dlq-pr-12',
      'pr-7',
      'pr-30/',
      'legendary-shots',
      'photo-process',
      'ls-prod',
      'main',
      'gallery',
      'sprint-pr-notes',
    ]
    expect([...previewNumbers(names)].sort()).toEqual(['12', '30', '7'])
  })
})
