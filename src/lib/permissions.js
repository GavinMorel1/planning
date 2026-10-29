// Who may change data. The database enforces this (supabase/migrations/20261029_roles.sql); this module mirrors it in the
// browser so the app refuses edits for read-only roles instead of failing on save. Roles: admin and planning can edit,
// rm (Relationship Manager) can read and export only.
let role = 'planning'
export const getRole = () => role
export const setRole = (r) => { role = r === 'admin' || r === 'rm' ? r : 'planning'; try { window.dispatchEvent(new CustomEvent('planning-role', { detail: role })) } catch { /* ignore */ } }
export const canEdit = () => role === 'admin' || role === 'planning'
export const ROLE_LABELS = { admin: 'Admin', planning: 'Planning Team', rm: 'Relationship Manager' }
/** Call when an edit is refused; the app shows a notice. Always returns false so callers can `return denyEdit()`. */
export function denyEdit() { try { window.dispatchEvent(new CustomEvent('planning-readonly')) } catch { /* ignore */ } return false }
