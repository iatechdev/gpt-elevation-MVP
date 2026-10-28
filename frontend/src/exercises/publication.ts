// A public build flag, never a substitute for ES-17/24 editorial review.
export const publicationEnabled = (value: unknown) => value === 'true'
export const exercisesEnabled = publicationEnabled(import.meta.env.VITE_ENABLE_COMPANION_EXERCISES)
