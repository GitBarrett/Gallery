// Wakes the local PostgreSQL of WSL Ubuntu before `pnpm dev`, the integration tests, the seed and the migrations
// (T-04e): WSL starts it with systemd. Windows only; anywhere else (CI's Postgres service, Linux) it does nothing.
import { spawnSync } from 'node:child_process'

if (process.platform === 'win32') spawnSync('wsl', ['-d', 'Ubuntu', '--exec', 'true'], { stdio: 'ignore' })
