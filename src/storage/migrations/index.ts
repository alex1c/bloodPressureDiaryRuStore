import { migration001Init } from './001_init'
import type { Migration } from '../sql-executor'

/** Ordered list of schema migrations. Never reorder or skip versions. */
export const MIGRATIONS: readonly Migration[] = [migration001Init]
