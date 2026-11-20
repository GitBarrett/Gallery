// pnpm test:trace — chaque critère d'acceptation exigé a au moins un test (11-strategie-de-tests.md § 2).
// Exigés : les critères [MVP] des tâches cochées dans 06-plan-de-taches.md. Une story (citée avec ou sans numéro)
// est exigée en entier quand toutes les tâches qui la citent sont cochées ; un critère `[v1.x, T-xx]`
// l'est quand T-xx est cochée. À la fin du MVP, toutes les tâches étant cochées, tout est exigé.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TASK = /^- \[([ x])\] \*\*(T-\d+[a-z]?) /
const REF = /US-(\d+)(?:\.(\d+)(?:–(\d+))?)?/g
const AC = /US-\d+\.\d+/g

function parseStories(storiesText) {
  const stories = new Map() // story -> [{ id, v1Task }] pour les stories [MVP] seulement
  let current = null
  for (const line of storiesText.split('\n')) {
    const heading = line.match(/^### (US-\d+) (\[MVP\])?/)
    if (heading) {
      current = heading[2] ? heading[1] : null
      if (current) stories.set(current, [])
      continue
    }
    const ac = line.match(/^- (US-\d+\.\d+)( \[v1\.x, (T-\d+[a-z]?)\])?/)
    if (ac && current && ac[1].startsWith(current + '.')) stories.get(current).push({ id: ac[1], v1Task: ac[3] })
  }
  return stories
}

function parseTasks(planText) {
  const tasks = []
  for (const line of planText.split('\n')) {
    const task = line.match(TASK)
    if (task) tasks.push({ id: task[2], checked: task[1] === 'x', text: line })
    else if (line.startsWith('#'))
      tasks.push(null) // une section clôt la tâche en cours
    else if (tasks.at(-1)) tasks.at(-1).text += '\n' + line
  }
  return tasks.filter(Boolean)
}

export function requiredAcs(planText, storiesText) {
  const stories = parseStories(storiesText)
  const tasks = parseTasks(planText)
  const checked = new Set(tasks.filter((t) => t.checked).map((t) => t.id))
  const eligible = (ac) => !ac.v1Task || checked.has(ac.v1Task)
  const required = new Set()
  const citingTasks = new Map() // story -> tâches qui la citent

  for (const task of tasks) {
    for (const [, story, from, to] of task.text.matchAll(REF)) {
      const id = `US-${story}`
      const cited = []
      for (let n = Number(from); from && n <= Number(to ?? from); n++) {
        const ac = stories.get(id)?.find((a) => a.id === `${id}.${n}`)
        if (ac) cited.push(ac)
      }
      // Une tâche qui ne cite que des critères v1.x ne retarde pas l'exigence de la story entière
      if (!from || cited.some((ac) => !ac.v1Task)) citingTasks.set(id, [...(citingTasks.get(id) ?? []), task])
      if (task.checked) for (const ac of cited) if (eligible(ac)) required.add(ac.id)
    }
  }
  for (const [id, citing] of citingTasks) {
    if (stories.has(id) && citing.every((t) => t.checked)) {
      for (const ac of stories.get(id)) if (eligible(ac)) required.add(ac.id)
    }
  }
  return required
}

export function foundAcs(testTexts) {
  return new Set(testTexts.flatMap((text) => text.match(AC) ?? []))
}

/* v8 ignore start -- lecture des fichiers et sortie CLI, exécutées par `pnpm test:trace` dans `pnpm check` */
function testFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((f) => f.isFile() && /\.(test|spec)\.ts$/.test(f.name))
    .map((f) => join(f.parentPath, f.name))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = (path) => readFileSync(path, 'utf8')
  const required = requiredAcs(read('docs/06-plan-de-taches.md'), read('docs/04-user-stories.md'))
  const files = ['app', 'server', 'shared', 'tests'].flatMap((dir) => {
    try {
      return testFiles(dir)
    } catch {
      return [] // dossier pas encore créé
    }
  })
  const found = foundAcs(files.map(read))
  const missing = [...required].filter((ac) => !found.has(ac)).sort()
  console.log(`test:trace — ${required.size} critère(s) exigé(s), ${missing.length} sans test`)
  if (missing.length) {
    console.error(`Critères sans test : ${missing.join(', ')}`)
    process.exit(1)
  }
}
/* v8 ignore stop */
