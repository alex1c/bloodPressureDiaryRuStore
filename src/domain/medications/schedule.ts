import type {
	Medication,
	MedicationIntake,
	MedicationScheduleTime,
} from '@/domain/types'
import {
	formatLocalDayKey,
	formatLocalTime,
	localDayKeyFromIso,
} from '@/domain/dates/local-day'

/** V1: every day — JS getDay() values Sun…Sat. */
export const DAILY_WEEKDAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6]

/** Formats local wall-clock HH:mm. */
export function formatScheduleHm(time: MedicationScheduleTime): string {
	return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
}

/** Parses user HH:mm (or H:mm) into a schedule slot. */
export function parseScheduleHm(
	text: string,
): MedicationScheduleTime | null {
	const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
	if (!match) {
		return null
	}
	const hour = Number(match[1])
	const minute = Number(match[2])
	if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
		return null
	}
	return { hour, minute }
}

/** Stable sort: earlier clock times first; ties keep input order. */
export function sortScheduleTimes(
	times: MedicationScheduleTime[],
): MedicationScheduleTime[] {
	return [...times].sort((a, b) => {
		const da = a.hour * 60 + a.minute
		const db = b.hour * 60 + b.minute
		return da - db
	})
}

/** Deduplicate identical HH:mm slots. */
export function uniqueScheduleTimes(
	times: MedicationScheduleTime[],
): MedicationScheduleTime[] {
	const seen = new Set<string>()
	const out: MedicationScheduleTime[] = []
	for (const t of times) {
		const key = formatScheduleHm(t)
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		out.push(t)
	}
	return sortScheduleTimes(out)
}

export type PlannedDoseStatus = 'pending' | 'taken'

/**
 * One planned dose for a local calendar day (computed, not stored).
 * Intake rows are created only when the user marks «Принял».
 */
export type PlannedDose = {
	medicationId: string
	profileId: string
	medicationName: string
	dosageText: string
	hour: number
	minute: number
	status: PlannedDoseStatus
	intake: MedicationIntake | null
}

function slotKey(
	medicationId: string,
	hour: number,
	minute: number,
	dayKey: string,
): string {
	return `${dayKey}|${medicationId}|${hour}:${minute}`
}

/**
 * Builds today's planned doses from active medications + taken intakes.
 * Does not invent intake rows for pending slots.
 */
export function buildPlannedDosesForDay(
	medications: Medication[],
	intakes: MedicationIntake[],
	day: Date = new Date(),
): PlannedDose[] {
	const dayKey = formatLocalDayKey(day)
	const takenBySlot = new Map<string, MedicationIntake>()

	for (const intake of intakes) {
		if (!intake.taken) {
			continue
		}
		if (localDayKeyFromIso(intake.takenAt) !== dayKey) {
			continue
		}
		const key = slotKey(
			intake.medicationId,
			intake.scheduledHour,
			intake.scheduledMinute,
			dayKey,
		)
		const existing = takenBySlot.get(key)
		// Prefer the newest mark if duplicates somehow exist.
		if (!existing || intake.takenAt > existing.takenAt) {
			takenBySlot.set(key, intake)
		}
	}

	const doses: PlannedDose[] = []
	for (const med of medications) {
		if (!med.isActive) {
			continue
		}
		for (const time of sortScheduleTimes(med.schedule)) {
			const key = slotKey(med.id, time.hour, time.minute, dayKey)
			const intake = takenBySlot.get(key) ?? null
			doses.push({
				medicationId: med.id,
				profileId: med.profileId,
				medicationName: med.name,
				dosageText: med.dosageText,
				hour: time.hour,
				minute: time.minute,
				status: intake ? 'taken' : 'pending',
				intake,
			})
		}
	}

	return doses.sort((a, b) => {
		const da = a.hour * 60 + a.minute
		const db = b.hour * 60 + b.minute
		if (da !== db) {
			return da - db
		}
		return a.medicationName.localeCompare(b.medicationName, 'ru')
	})
}

/** Compact home summary for the diary tab. */
export function summarizeTodaysDoses(doses: PlannedDose[]): {
	total: number
	taken: number
	nextPending: PlannedDose | null
} {
	const taken = doses.filter((d) => d.status === 'taken').length
	const nextPending =
		doses.find((d) => d.status === 'pending') ?? null
	return { total: doses.length, taken, nextPending }
}

/** Human label for a taken intake time, e.g. «08:07». */
export function formatIntakeTakenClock(intake: MedicationIntake): string {
	return formatLocalTime(intake.takenAt)
}

/**
 * True when an intake already covers this planned slot on the given local day.
 */
export function findTakenIntakeForSlot(
	intakes: MedicationIntake[],
	medicationId: string,
	hour: number,
	minute: number,
	day: Date = new Date(),
): MedicationIntake | null {
	const dayKey = formatLocalDayKey(day)
	const matches = intakes.filter(
		(i) =>
			i.taken &&
			i.medicationId === medicationId &&
			i.scheduledHour === hour &&
			i.scheduledMinute === minute &&
			localDayKeyFromIso(i.takenAt) === dayKey,
	)
	if (matches.length === 0) {
		return null
	}
	return matches.sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0]!
}
