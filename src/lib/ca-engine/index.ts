/**
 * Public API for src/lib/ca-engine/.
 *
 * Control Allowance / Tunjangan computation engine.
 * Outputs PersonnelAllowance rows with regular + overtime hours combined.
 */

export * from './types';
export {
    computeAllowanceTable,
    summarizeAllowance,
    kontrolMinutesPerShift,
    computeMonthlyKontrolMinutes,
    computeKontrolMinutesFromRoster,
} from './control-allowance';
