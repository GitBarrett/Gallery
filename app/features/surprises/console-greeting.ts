// Console greeting (US-79.2): the house logo in ASCII and a bug report line, once per browser session.
const LOGO = String.raw`
   _.-'''-._      LEGENDARY
  /  \ | /  \       SHOTS
 |  --( )--  |
  \  / | \  /
   '-.___.-'`

const KEY = 'ls-console-greeted'

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function greetOnce({
  storage,
  log,
  line,
}: {
  storage: () => SessionStorageLike // a getter: reading window.sessionStorage itself throws when storage is blocked
  log: (message: string) => void
  line: string
}) {
  try {
    if (storage().getItem(KEY)) return
    storage().setItem(KEY, '1')
  } catch {
    // Storage blocked (private mode): greet anyway, maybe again on the next page
  }
  log(`${LOGO}\n\n${line}`)
}
