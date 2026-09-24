import { spawnSync } from 'node:child_process'
const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/database.test.ts'],{stdio:'inherit'})
process.exitCode=result.status??1
