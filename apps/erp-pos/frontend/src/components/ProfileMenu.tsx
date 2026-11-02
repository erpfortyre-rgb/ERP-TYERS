import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiLogOut, FiLock, FiUserPlus, FiChevronDown, FiEye, FiEyeOff, FiX, FiShield, FiMail, FiUser, FiBriefcase } from 'react-icons/fi'
import { ChangePassword, CreateUser } from '../../wailsjs/go/main/App'

interface Props {
  user: { id: string; name: string; email?: string; roleName?: string }
  onLogout: () => void
}

const ACCENT = 'var(--accent)'

function initials(name: string) {
  const parts = (name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

/* ── Reusable styled field with a focus ring ── */
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {icon && <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', display: 'flex' }}>{icon}</span>}
        {children}
      </div>
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { hasIcon?: boolean }) {
  const { hasIcon, style, ...rest } = props
  const [focus, setFocus] = useState(false)
  return (
    <input {...rest}
      onFocus={e => { setFocus(true); props.onFocus?.(e) }}
      onBlur={e => { setFocus(false); props.onBlur?.(e) }}
      style={{
        width: '100%', boxSizing: 'border-box', padding: hasIcon ? '10px 12px 10px 34px' : '10px 12px',
        border: `1.5px solid ${focus ? ACCENT : 'var(--border)'}`, borderRadius: 9,
        background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.9rem', outline: 'none',
        boxShadow: focus ? `0 0 0 3px color-mix(in srgb, ${ACCENT} 18%, transparent)` : 'none',
        transition: 'border-color .15s, box-shadow .15s', ...style,
      }} />
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'ssFade .12s ease-out' }
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 0, width: 400, maxWidth: '92vw', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }
const modalHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)' }
const iconCircle = (c: string): React.CSSProperties => ({ width: 42, height: 42, borderRadius: 12, background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })

export default function ProfileMenu({ user, onLogout }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pwModal, setPwModal] = useState(false)
  const [userModal, setUserModal] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'Cashier' })
  const [showNuPw, setShowNuPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const isAdmin = (user.roleName || '').toLowerCase() === 'owner'
  const roleLabel = (user.roleName || '').toLowerCase() === 'demo' ? 'Cashier' : (user.roleName || 'User')

  const doChangePw = async () => {
    if (!pw || pw.length < 4) { toast.error('Password must be at least 4 characters'); return }
    if (pw !== pw2) { toast.error('Passwords do not match'); return }
    setSaving(true)
    try { await ChangePassword(user.id, pw); toast.success('Password changed successfully'); setPwModal(false); setPw(''); setPw2(''); setShowPw(false) }
    catch (e: any) { toast.error(e?.message || 'Failed to change password') }
    finally { setSaving(false) }
  }
  const doAddUser = async () => {
    if (!nu.name.trim()) { toast.error('Name is required'); return }
    if (!nu.password.trim() || nu.password.length < 4) { toast.error('Password must be at least 4 characters'); return }
    setSaving(true)
    try { await CreateUser(nu.name.trim(), nu.email.trim(), nu.password, nu.role); toast.success(`User "${nu.name.trim()}" created`); setUserModal(false); setNu({ name: '', email: '', password: '', role: 'Cashier' }); setShowNuPw(false) }
    catch (e: any) { toast.error(e?.message || 'Failed to create user') }
    finally { setSaving(false) }
  }

  const btnPrimary: React.CSSProperties = { padding: '9px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 9, cursor: saving ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.88rem', opacity: saving ? 0.7 : 1 }
  const btnGhost: React.CSSProperties = { padding: '9px 16px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }
  const eyeBtn: React.CSSProperties = { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', padding: 4 }

  return (
    <>
      <style>{`@keyframes ssFade{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}`}</style>

      {/* Trigger */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', background: open ? 'var(--bg-sidebar)' : 'transparent', border: '1px solid var(--border)', borderRadius: 24, cursor: 'pointer', color: 'var(--fg)' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>{initials(user.name)}</span>
          <span style={{ fontWeight: 600, fontSize: '0.82rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
          <FiChevronDown size={14} style={{ color: 'var(--fg-muted)', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
        </button>

        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 51, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 16px 44px rgba(0,0,0,0.3)', minWidth: 248, overflow: 'hidden', animation: 'ssFade .12s ease-out' }}>
              {/* Identity header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 800, flexShrink: 0 }}>{initials(user.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--fg-bright)', fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email || 'No email'}</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.66rem', fontWeight: 700, color: ACCENT, background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, padding: '2px 8px', borderRadius: 20 }}><FiShield size={10} /> {roleLabel}</span>
                </div>
              </div>
              <div style={{ padding: 6 }}>
                {isAdmin && <MenuItem icon={<FiBriefcase size={15} />} label="Company & Users (Admin)" onClick={() => { setOpen(false); navigate('/admin') }} />}
                <MenuItem icon={<FiLock size={15} />} label="Change Password" onClick={() => { setOpen(false); setPwModal(true) }} />
                {isAdmin && <MenuItem icon={<FiUserPlus size={15} />} label="Quick Add User" onClick={() => { setOpen(false); setUserModal(true) }} />}
                <div style={{ height: 1, background: 'var(--border)', margin: '5px 8px' }} />
                <MenuItem icon={<FiLogOut size={15} />} label="Sign out" danger onClick={() => { setOpen(false); onLogout() }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Change Password modal */}
      {pwModal && (
        <div style={overlay} onClick={() => setPwModal(false)} onKeyDown={e => { if (e.key === 'Escape') setPwModal(false); if (e.key === 'Enter') doChangePw() }}>
          <div style={card} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={iconCircle(ACCENT)}><FiLock size={20} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--fg-bright)' }}>Change Password</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>Update your login password</div>
              </div>
              <button onClick={() => setPwModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)' }}><FiX size={18} /></button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <Field label="New Password">
                <TextInput type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoFocus placeholder="Enter new password" />
                <button type="button" style={eyeBtn} onClick={() => setShowPw(s => !s)}>{showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}</button>
              </Field>
              <Field label="Confirm Password">
                <TextInput type={showPw ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Re-enter new password"
                  style={pw2 && pw !== pw2 ? { borderColor: '#ef4444' } : undefined} />
              </Field>
              {pw2 && pw !== pw2 && <div style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: -6 }}>Passwords do not match</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 22px 20px' }}>
              <button style={btnGhost} onClick={() => setPwModal(false)}>Cancel</button>
              <button style={btnPrimary} onClick={doChangePw} disabled={saving}>{saving ? 'Saving…' : 'Change Password'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add User modal */}
      {userModal && (
        <div style={overlay} onClick={() => setUserModal(false)} onKeyDown={e => { if (e.key === 'Escape') setUserModal(false) }}>
          <div style={card} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={iconCircle('#16a34a')}><FiUserPlus size={20} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--fg-bright)' }}>Add New User</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>Create a login for your staff</div>
              </div>
              <button onClick={() => setUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)' }}><FiX size={18} /></button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <Field label="Full Name" icon={<FiUser size={15} />}><TextInput hasIcon value={nu.name} onChange={e => setNu({ ...nu, name: e.target.value })} autoFocus placeholder="e.g. Rajesh Kumar" /></Field>
              <Field label="Email" icon={<FiMail size={15} />}><TextInput hasIcon value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} placeholder="optional" /></Field>
              <Field label="Password" icon={<FiLock size={15} />}>
                <TextInput hasIcon type={showNuPw ? 'text' : 'password'} value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} placeholder="Set a login password" />
                <button type="button" style={eyeBtn} onClick={() => setShowNuPw(s => !s)}>{showNuPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}</button>
              </Field>
              <Field label="Role">
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Cashier', 'Manager', 'Owner'].map(r => (
                    <button key={r} type="button" onClick={() => setNu({ ...nu, role: r })}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 9, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700,
                        border: `1.5px solid ${nu.role === r ? ACCENT : 'var(--border)'}`,
                        background: nu.role === r ? `color-mix(in srgb, ${ACCENT} 14%, transparent)` : 'var(--bg-input)',
                        color: nu.role === r ? ACCENT : 'var(--fg)' }}>{r}</button>
                  ))}
                </div>
              </Field>
              <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                ℹ️ The new user's login PIN is <strong>0000</strong> by default — ask them to change it after first login.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 22px 20px' }}>
              <button style={btnGhost} onClick={() => setUserModal(false)}>Cancel</button>
              <button style={{ ...btnPrimary, background: '#16a34a' }} onClick={doAddUser} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false)
  const color = danger ? '#ef4444' : 'var(--fg)'
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color, background: hover ? (danger ? 'color-mix(in srgb, #ef4444 12%, transparent)' : 'var(--bg-sidebar)') : 'transparent', transition: 'background .12s' }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: danger ? 'color-mix(in srgb, #ef4444 14%, transparent)' : 'var(--bg-sidebar)', color: danger ? '#ef4444' : ACCENT }}>{icon}</span>
      {label}
    </div>
  )
}
