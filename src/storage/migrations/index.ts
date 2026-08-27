import { migration001Init } from './001_init'
import { migration002IntakeScheduleSlot } from './002_intake_schedule_slot'
import type { Migration } from '../sql-executor'

/** Ordered list of schema migrations. Never reorder or skip versions. */
export const MIGRATIONS: readonly Migration[] = [
	migration001Init,
	migration002IntakeScheduleSlot,
]
