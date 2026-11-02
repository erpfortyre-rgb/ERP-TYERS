import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  FiBriefcase, FiShield, FiUsers, FiPlus, FiCheck, FiTrash2,
  FiRepeat, FiKey, FiEdit2, FiX,
} from 'react-icons/fi'
import {
  ListFirms, CreateFirm, SetActiveCompany,
  ListRoles, SaveRole, DeleteRole,
  ListUsers, CreateEmployee, ChangePassword,
} from '../../wailsjs/go/main/App'
import { PAGE_GROUPS } from '../pagePermissions'

type Tab = 'companies' | 'roles' | 'staff'

interface Firm { id: string; name: string; gstin: string; phone: string; address: string; isActive: boolean }
interface Role { id: string; name: string; permissions: string; userCount: number }
interface Staff { id: string; name: string; email: string; roleName: string }

// ─── shared styles ───────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }
const label: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--fg-muted)', marginBottom: 5, display: 'block' }
const input: React.CSSProperties = { width: '100%', padding: '9px 11px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--fg)', fontSize: '0.88rem', boxSizing: 'border-box' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 700 }
const btnGhost: React.CSSProperties = { ...btn, background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)' }

const NAV: { key: Tab; icon: React.ReactNode; title: string; sub: string }[] = [
  { key: 'companies', icon: <FiBriefcase size={18} />, title: 'Companies', sub: 'Add & switch firms' },
  { key: 'roles', icon: <FiShield size={18} />, title: 'Roles & Access', sub: 'Page permissions' },
  { key: 'staff', icon: <FiUsers size={18} />, title: 'Staff / Logins', sub: 'Hire employees' },
]

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('companies')
  const [stats, setStats] = useState({ companies: 0, roles: 0, staff: 0 })
  const [activeName, setActiveName] = useState('')
  // bump refresh so stat row reloads after a company/role/staff change
  const [refresh, setRefresh] = useState(0)
  const bump = useCallback(() => setRefresh(n => n + 1), [])

  useEffect(() => {
    ListFirms().then((r: any) => {
      const firms = r || []
      setStats(s => ({ ...s, companies: firms.length }))
      setActiveName((firms.find((f: Firm) => f.isActive)?.name) || '')
    }).catch(() => {})
    ListRoles().then((r: any) => setStats(s => ({ ...s, roles: (r || []).length }))).catch(() => {})
    ListUsers().then((r: any) => setStats(s => ({ ...s, staff: (r || []).length }))).catch(() => {})
  }, [refresh])

  const count = (k: Tab) => k === 'companies' ? stats.companies : k === 'roles' ? stats.roles : stats.staff

  return (
    <div className="page" style={{ width: '100%' }}>
      {/* Header band */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Admin Console</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--fg-muted)', fontSize: '0.88rem' }}>
            Manage companies, roles &amp; staff logins. Changes apply to the active company.
          </p>
        </div>
        {activeName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 30, padding: '8px 16px' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 0 3px color-mix(in srgb, #16a34a 25%, transparent)' }} />
            <div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Company</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{activeName}</div>
            </div>
          </div>
        )}
      </div>

      {/* KPI stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 22 }}>
        {NAV.map(n => (
          <div key={n.key} onClick={() => setTab(n.key)}
            style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, borderColor: tab === n.key ? 'var(--accent)' : 'var(--border)', borderWidth: tab === n.key ? 2 : 1, padding: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', flexShrink: 0 }}>{n.icon}</div>
            <div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1 }}>{count(n.key)}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 3, fontWeight: 600 }}>{n.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column console: left rail + content */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 210, flexShrink: 0, display: 'grid', gap: 6, position: 'sticky', top: 0 }} className="admin-rail">
          {NAV.map(n => (
            <button key={n.key} onClick={() => setTab(n.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', borderRadius: 10,
                border: `1px solid ${tab === n.key ? 'var(--accent)' : 'var(--border)'}`,
                background: tab === n.key ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-card)',
                color: tab === n.key ? 'var(--accent)' : 'var(--fg)' }}>
              <span style={{ display: 'flex', flexShrink: 0 }}>{n.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700 }}>{n.title}</span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--fg-muted)', fontWeight: 500 }}>{n.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {tab === 'companies' && <CompaniesTab onChange={bump} />}
          {tab === 'roles' && <RolesTab onChange={bump} />}
          {tab === 'staff' && <StaffTab onChange={bump} />}
        </div>
      </div>
    </div>
  )
}

// ─── Companies ─────────────────────────────────────────────────────────────
function CompaniesTab({ onChange }: { onChange: () => void }) {
  void onChange // company create/switch reloads the whole app, so no manual refresh needed
  const [firms, setFirms] = useState<Firm[]>([])
  const [form, setForm] = useState({ name: '', gstin: '', phone: '', address: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(() => { ListFirms().then((r: any) => setFirms(r || [])).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])

  const switchTo = async (f: Firm) => {
    if (f.isActive) return
    try {
      await SetActiveCompany(f.id)
      toast.success(`Switched to ${f.name}`)
      // Reload so every page re-fetches data for the new company.
      setTimeout(() => window.location.reload(), 500)
    } catch (e: any) { toast.error(String(e)) }
  }

  const create = async () => {
    if (!form.name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    try {
      await CreateFirm(form as any)
      toast.success(`${form.name} created & activated`)
      setTimeout(() => window.location.reload(), 600)
    } catch (e: any) { toast.error(String(e)); setSaving(false) }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 700 }}>{firms.length} compan{firms.length === 1 ? 'y' : 'ies'}</div>
        <button style={btn} onClick={() => setShowForm(v => !v)}>{showForm ? <><FiX /> Cancel</> : <><FiPlus /> Add Company</>}</button>
      </div>

      {showForm && (
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}><label style={label}>Company / Firm Name *</label><input style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Shiv Shankar Tyres - Branch 2" autoFocus /></div>
            <div><label style={label}>GSTIN</label><input style={input} value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} maxLength={15} placeholder="36XXXXX…" /></div>
            <div><label style={label}>Phone</label><input style={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={label}>Address</label><input style={input} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={label}>Email</label><input style={input} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button style={btn} disabled={saving} onClick={create}><FiCheck /> {saving ? 'Creating…' : 'Create & Switch'}</button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
            The new company starts empty (its own products, parties, sales, invoices &amp; staff). GSTIN decides CGST+SGST vs IGST on its bills.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {firms.map(f => (
          <div key={f.id} style={{ ...card, borderColor: f.isActive ? 'var(--accent)' : 'var(--border)', borderWidth: f.isActive ? 2 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{f.name}</div>
              {f.isActive && <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>ACTIVE</span>}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 6, lineHeight: 1.6 }}>
              {f.gstin && <div>GSTIN: {f.gstin}</div>}
              {f.phone && <div>📞 {f.phone}</div>}
              {f.address && <div>{f.address}</div>}
            </div>
            {!f.isActive && (
              <button style={{ ...btnGhost, marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => switchTo(f)}>
                <FiRepeat /> Switch to this company
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Roles & Access ───────────────────────────────────────────────────────
const BUILTIN = new Set(['owner', 'manager', 'cashier', 'demo'])

function RolesTab({ onChange }: { onChange: () => void }) {
  const [roles, setRoles] = useState<Role[]>([])
  const [editing, setEditing] = useState<Role | null>(null)

  const load = useCallback(() => { ListRoles().then((r: any) => setRoles(r || [])).catch(() => {}); onChange() }, [onChange])
  useEffect(() => { load() }, [load])

  const summary = (perms: string): string => {
    try {
      const p = JSON.parse(perms || '{}')
      if (p.all) return 'Full access (all pages)'
      if (Array.isArray(p.paths)) return `${p.paths.length} page${p.paths.length === 1 ? '' : 's'} allowed`
      // legacy named perms
      const keys = Object.keys(p).filter(k => p[k])
      return keys.length ? keys.join(', ') : 'No pages'
    } catch { return '—' }
  }

  const del = async (r: Role) => {
    if (!confirm(`Delete role "${r.name}"?`)) return
    try { await DeleteRole(r.id); toast.success('Role deleted'); load() }
    catch (e: any) { toast.error(String(e)) }
  }

  if (editing) return <RoleEditor role={editing} onDone={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 700 }}>{roles.length} role{roles.length === 1 ? '' : 's'} in this company</div>
        <button style={btn} onClick={() => setEditing({ id: '', name: '', permissions: '{"paths":[]}', userCount: 0 })}><FiPlus /> New Role</button>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {roles.map(r => {
          const builtin = BUILTIN.has(r.name.toLowerCase())
          return (
            <div key={r.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.98rem' }}>
                  {r.name}
                  {builtin && <span style={{ marginLeft: 8, fontSize: '0.64rem', fontWeight: 700, color: 'var(--fg-muted)', border: '1px solid var(--border)', borderRadius: 20, padding: '1px 8px' }}>BUILT-IN</span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 3 }}>{summary(r.permissions)} &middot; {r.userCount} staff</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnGhost} onClick={() => setEditing(r)}><FiEdit2 /> Edit Access</button>
                {!builtin && <button style={{ ...btnGhost, color: '#ef4444', borderColor: '#ef444455' }} onClick={() => del(r)}><FiTrash2 /></button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RoleEditor({ role, onDone, onCancel }: { role: Role; onDone: () => void; onCancel: () => void }) {
  const parse = (): { all: boolean; paths: Set<string> } => {
    try {
      const p = JSON.parse(role.permissions || '{}')
      if (p.all) return { all: true, paths: new Set() }
      if (Array.isArray(p.paths)) return { all: false, paths: new Set<string>(p.paths) }
    } catch { /* ignore */ }
    return { all: false, paths: new Set() }
  }
  const init = parse()
  const [name, setName] = useState(role.name)
  const [fullAccess, setFullAccess] = useState(init.all)
  const [paths, setPaths] = useState<Set<string>>(init.paths)
  const [saving, setSaving] = useState(false)

  const toggle = (p: string) => setPaths(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s })
  const toggleGroup = (items: { path: string }[], on: boolean) => setPaths(prev => {
    const s = new Set(prev); items.forEach(i => on ? s.add(i.path) : s.delete(i.path)); return s
  })

  const save = async () => {
    if (!name.trim()) { toast.error('Role name required'); return }
    setSaving(true)
    const permissions = fullAccess ? JSON.stringify({ all: true }) : JSON.stringify({ paths: [...paths] })
    try {
      await SaveRole({ id: role.id, name: name.trim(), permissions, userCount: role.userCount } as any)
      toast.success('Role saved')
      onDone()
    } catch (e: any) { toast.error(String(e)); setSaving(false) }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={btnGhost} onClick={onCancel}><FiX /> Back</button>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{role.id ? 'Edit Role' : 'New Role'}</h3>
      </div>

      <div style={{ ...card, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <label style={label}>Role Name</label>
          <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Accountant, Store Keeper" autoFocus />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700, padding: '9px 0' }}>
          <input type="checkbox" checked={fullAccess} onChange={e => setFullAccess(e.target.checked)} style={{ width: 17, height: 17 }} />
          Full access (all pages)
        </label>
      </div>

      {!fullAccess && (
        <div style={{ ...card, opacity: fullAccess ? 0.5 : 1 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 12 }}>Choose which pages this role can open:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
            {PAGE_GROUPS.map(g => {
              const allOn = g.items.every(i => paths.has(i.path))
              return (
                <div key={g.label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 5, marginBottom: 7 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--fg-muted)' }}>{g.label}</span>
                    <span onClick={() => toggleGroup(g.items, !allOn)} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}>{allOn ? 'Clear' : 'All'}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {g.items.map(i => (
                      <label key={i.path} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer', padding: '2px 0' }}>
                        <input type="checkbox" checked={paths.has(i.path)} onChange={() => toggle(i.path)} style={{ width: 15, height: 15 }} />
                        {i.label}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btn} disabled={saving} onClick={save}><FiCheck /> {saving ? 'Saving…' : 'Save Role'}</button>
        <button style={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Staff / Logins ─────────────────────────────────────────────────────────
function StaffTab({ onChange }: { onChange: () => void }) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [form, setForm] = useState({ name: '', email: '', password: '', pin: '', roleName: '' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pwFor, setPwFor] = useState<Staff | null>(null)
  const [newPw, setNewPw] = useState('')

  const load = useCallback(() => {
    ListUsers().then((r: any) => setStaff(r || [])).catch(() => {})
    ListRoles().then((r: any) => { const rs = r || []; setRoles(rs); setForm(f => f.roleName ? f : { ...f, roleName: rs[0]?.name || '' }) }).catch(() => {})
    onChange()
  }, [onChange])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.name.trim() || !form.password.trim()) { toast.error('Name and password are required'); return }
    if (!form.roleName) { toast.error('Pick a role'); return }
    setSaving(true)
    try {
      await CreateEmployee(form.name, form.email, form.password, form.pin || '0000', form.roleName)
      toast.success(`${form.name} hired`)
      setForm({ name: '', email: '', password: '', pin: '', roleName: roles[0]?.name || '' })
      setShowForm(false); load()
    } catch (e: any) { toast.error(String(e)) } finally { setSaving(false) }
  }

  const changePw = async () => {
    if (!pwFor || !newPw.trim()) { toast.error('Enter a new password'); return }
    try { await ChangePassword(pwFor.id, newPw); toast.success(`Password updated for ${pwFor.name}`); setPwFor(null); setNewPw('') }
    catch (e: any) { toast.error(String(e)) }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 700 }}>{staff.length} staff login{staff.length === 1 ? '' : 's'} in this company</div>
        <button style={btn} onClick={() => setShowForm(v => !v)}>{showForm ? <><FiX /> Cancel</> : <><FiPlus /> Hire Employee</>}</button>
      </div>

      {showForm && (
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={label}>Full Name *</label><input style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div><label style={label}>Role *</label>
              <select style={input} value={form.roleName} onChange={e => setForm({ ...form, roleName: e.target.value })}>
                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <div><label style={label}>Login Email</label><input style={input} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="staff@firm.local" /></div>
            <div><label style={label}>Counter PIN</label><input style={input} value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="4 digits (default 0000)" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={label}>Password *</label><input style={input} type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="They log in with email + this password" /></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button style={btn} disabled={saving} onClick={create}><FiCheck /> {saving ? 'Hiring…' : 'Create Login'}</button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
            This login belongs to the active company only. The role decides which pages they see.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {staff.map(s => (
          <div key={s.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.96rem' }}>{s.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 3 }}>{s.roleName || 'No role'}{s.email ? ` · ${s.email}` : ''}</div>
            </div>
            <button style={btnGhost} onClick={() => { setPwFor(s); setNewPw('') }}><FiKey /> Reset Password</button>
          </div>
        ))}
      </div>

      {pwFor && (
        <div onClick={() => setPwFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: 380, maxWidth: '90vw' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>Reset Password</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: 12 }}>for {pwFor.name}</div>
            <label style={label}>New Password</label>
            <input style={input} type="text" value={newPw} onChange={e => setNewPw(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && changePw()} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button style={btn} onClick={changePw}><FiCheck /> Update</button>
              <button style={btnGhost} onClick={() => setPwFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
