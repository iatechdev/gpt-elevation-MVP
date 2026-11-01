import policy from '../../../shared/registration-password-policy.json' with { type: 'json' }
const common = new Set(policy.common)
export function validRegistrationPassword(value: string): boolean {
  return [...value].length >= policy.minCharacters && new TextEncoder().encode(value).length <= policy.maxUtf8Bytes
    && value.trim().length > 0 && !common.has(value.trim().toLowerCase())
}
