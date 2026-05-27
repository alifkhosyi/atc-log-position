/**
 * Public API for src/lib/roster-engine/.
 *
 * Generator + FRMS + Swap + Templates. Roster-specific only.
 *
 * Untuk shared types: import dari ../shared.
 * Untuk airport reference data: import dari ../airport-data.
 * Untuk rolling intra-shift: import dari ../rolling-engine.
 * Untuk control allowance: import dari ../ca-engine.
 */

export * from './types';
export { generateRoster } from './generator';
export type { GenerateRosterOptions } from './generator';
export { swapShift } from './swap';
export type { SwapResult } from './swap';
export {
    validateFull, splitBySeverity,
    FRMS_SHIFT_HOURS,
    validateMinimumPersonnel, validateMaxConsecutiveDays,
    validateMinDaysOffPerWeek, validateMaxHoursPerWeek,
    validateNoLeaveAssignedWork, validateShiftDuration,
} from './frms-validator';
export {
    type ServiceClass,
    DEFAULT_LIMITS,
    getMaxConsecutiveDays, getMaxHoursPerWeek, getMaxShiftHours,
    getMinRestAfterMaxConsecutiveHours,
    computePersonnelNeeds,
} from './frms-rules';
export { getTemplate } from './templates';
