// « Time of day » of the gallery filters (US-20.3, Q82), from the in-game time "HH:MM" given at upload (US-11.4):
// fixed hour ranges, the end excluded; Night wraps around midnight. A capture without a time matches none.
export const TIMES_OF_DAY = ['dawn', 'day', 'dusk', 'night'] as const
export type TimeOfDay = (typeof TIMES_OF_DAY)[number]

/** First and last-excluded "HH:MM" of each range. */
export const TIME_OF_DAY_RANGES: Readonly<Record<TimeOfDay, readonly [string, string]>> = {
  dawn: ['05:00', '09:00'],
  day: ['09:00', '17:00'],
  dusk: ['17:00', '21:00'],
  night: ['21:00', '05:00'],
}

export function timeOfDay(inGameTime: string): TimeOfDay {
  return TIMES_OF_DAY.find((t) => {
    const [from, to] = TIME_OF_DAY_RANGES[t]
    return from < to ? inGameTime >= from && inGameTime < to : inGameTime >= from || inGameTime < to
  })!
}
