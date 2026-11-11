import { describe, it, expect } from 'vitest'
import { memberForOwner, ownerDisplay, nameFromEmail, memberName } from './team'

const members = [
  { email: 'gavin.morel@paradiem.org', name: 'Gavin Morel', role: 'admin' },
  { email: 'dani@paradiem.org', name: 'Dani Wauchope', role: 'planning' },
  { email: 'casey@paradiem.org', name: '', role: 'rm' },
]
describe('team helpers', () => {
  it('matches a task owner by email or by name, ignoring case', () => {
    expect(memberForOwner('Gavin.Morel@paradiem.org', members)?.name).toBe('Gavin Morel')
    expect(memberForOwner('dani wauchope', members)?.email).toBe('dani@paradiem.org')
    expect(memberForOwner('Someone Else', members)).toBeNull()
    expect(memberForOwner('', members)).toBeNull()
  })
  it('shows a friendly name', () => {
    expect(ownerDisplay('', members)).toBe('Unassigned')
    expect(ownerDisplay('dani@paradiem.org', members)).toBe('Dani Wauchope')
    expect(ownerDisplay('casey@paradiem.org', members)).toBe('Casey')
    expect(ownerDisplay('jo.smith@x.com', [])).toBe('Jo Smith')
    expect(ownerDisplay('Eric L. Dunavant', members)).toBe('Eric L. Dunavant')
    expect(nameFromEmail('first.last@x.org')).toBe('First Last')
    expect(memberName({ email: 'a_b@x.org', name: '  ' })).toBe('A B')
  })
})
