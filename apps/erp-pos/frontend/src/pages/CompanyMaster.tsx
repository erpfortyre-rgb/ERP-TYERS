import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListCompanies, SaveCompany, DeleteCompany } from '../../wailsjs/go/main/App'
import {
  INDIAN_STATES, getCitiesForState, getStateByName, lookupPincode,
  validatePAN, validateGSTIN, validatePhone, validateEmail, validatePincode,
  onlyNumbers, onlyAlpha,
} from '../utils/indianData'

interface Company {
  id: string
  name: string
  contactPerson: string
  phone: string
  email: string
  gstin: string
  pan: string
  address: string
  city: string
  state: string
  stateCode: string
  pincode: string
  openingBalancePaise: number
  isActive: boolean
}

const emptyCompany: Company = {
  id: '', name: '', contactPerson: '', phone: '', email: '', gstin: '', pan: '',
  address: '', city: '', state: '', stateCode: '', pincode: '', openingBalancePaise: 0, isActive: true,
}

export default function CompanyMaster() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [citySearch, setCitySearch] = useState('')
  const [showCityDropdown, setShowCityDropdown] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await ListCompanies(search)
      setCompanies(list || [])
    } catch (e: any) { console.error(e); toast.error(e?.message || 'Failed to load companies') }
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const validate = (): boolean => {
    if (!editing) return false
    const e: Record<string, string> = {}
    if (!editing.name.trim()) e.name = 'Company name is required'
    const phoneErr = validatePhone(editing.phone)
    if (phoneErr) e.phone = phoneErr
    const emailErr = validateEmail(editing.email)
    if (emailErr) e.email = emailErr
    const gstErr = validateGSTIN(editing.gstin)
    if (gstErr) e.gstin = gstErr
    const panErr = validatePAN(editing.pan)
    if (panErr) e.pan = panErr
    const pinErr = validatePincode(editing.pincode)
    if (pinErr) e.pincode = pinErr
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      await SaveCompany(editing as any)
      toast.success(editing!.id ? 'Company updated' : 'Company created')
      setEditing(null)
      setErrors({})
      load()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await DeleteCompany(id)
      toast.success('Company deleted')
      load()
    } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  const handlePincodeChange = async (pin: string) => {
    const cleaned = onlyNumbers(pin).slice(0, 6)
    setEditing(prev => prev ? { ...prev, pincode: cleaned } : null)
    if (cleaned.length === 6) {
      setPincodeLoading(true)
      const result = await lookupPincode(cleaned)
      if (result && editing) {
        setEditing(prev => prev ? {
          ...prev,
          city: result.city,
          state: result.state,
          stateCode: result.stateCode,
        } : null)
        toast.success(`Auto-filled: ${result.city}, ${result.state}`)
      }
      setPincodeLoading(false)
    }
  }

  const handleStateChange = (stateName: string) => {
    const st = getStateByName(stateName)
    setEditing(prev => prev ? {
      ...prev,
      state: stateName,
      stateCode: st?.gstCode || '',
      city: '',
    } : null)
    setCitySearch('')
  }

  const filteredCities = editing?.state
    ? getCitiesForState(editing.state).filter(c =>
        c.toLowerCase().includes((citySearch || editing?.city || '').toLowerCase())
      )
    : []

  const formatRupees = (paise: number) => {
    const val = Math.abs(paise) / 100
    const formatted = val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return paise < 0 ? `-₹${formatted}` : `₹${formatted}`
  }

  const errStyle = { fontSize: '0.72rem', color: 'var(--error)', marginTop: 2 }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="Search company name, phone, GSTIN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 320 }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
            {companies.length} companies
          </span>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing({ ...emptyCompany }); setErrors({}) }}>
          + Create New
        </button>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Company Name</th>
              <th>Contact</th>
              <th>Phone</th>
              <th>GSTIN</th>
              <th>City</th>
              <th>Balance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td>{c.contactPerson}</td>
                <td>{c.phone}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{c.gstin}</td>
                <td>{c.city}</td>
                <td style={{ fontWeight: 500, color: c.openingBalancePaise >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  {formatRupees(c.openingBalancePaise)}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing({ ...c }); setErrors({}) }}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}
                      onClick={() => handleDelete(c.id, c.name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {companies.length === 0 && !loading && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                No companies found
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 600, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-title">{editing.id ? 'Edit Company' : 'Create Company'}</div>
            <div className="grid-2" style={{ gap: 12 }}>

              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input className="form-input" value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  autoFocus />
                {errors.name && <div style={errStyle}>{errors.name}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input className="form-input" value={editing.contactPerson}
                  onChange={e => setEditing({ ...editing, contactPerson: onlyAlpha(e.target.value) })} />
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={editing.phone} maxLength={13}
                  placeholder="10 digit number"
                  onChange={e => {
                    const v = e.target.value
                    if (v === '+' || v.startsWith('+9') || v.startsWith('+91')) {
                      setEditing({ ...editing, phone: v.slice(0, 3) + onlyNumbers(v.slice(3)) })
                    } else {
                      setEditing({ ...editing, phone: onlyNumbers(v) })
                    }
                  }}
                  onBlur={() => { const err = validatePhone(editing.phone); setErrors(prev => err ? { ...prev, phone: err } : (({ phone: _, ...rest }) => rest)(prev)) }} />
                {errors.phone && <div style={errStyle}>{errors.phone}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={editing.email} type="email"
                  onChange={e => setEditing({ ...editing, email: e.target.value })}
                  onBlur={() => { const err = validateEmail(editing.email); setErrors(prev => err ? { ...prev, email: err } : (({ email: _, ...rest }) => rest)(prev)) }} />
                {errors.email && <div style={errStyle}>{errors.email}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input className="form-input" value={editing.gstin} maxLength={15}
                  placeholder="e.g. 36ABCDE1234F1Z5"
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                  onChange={e => setEditing({ ...editing, gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  onBlur={() => { const err = validateGSTIN(editing.gstin); setErrors(prev => err ? { ...prev, gstin: err } : (({ gstin: _, ...rest }) => rest)(prev)) }} />
                {errors.gstin && <div style={errStyle}>{errors.gstin}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">PAN</label>
                <input className="form-input" value={editing.pan} maxLength={10}
                  placeholder="e.g. ABCDE1234F"
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                  onChange={e => setEditing({ ...editing, pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  onBlur={() => { const err = validatePAN(editing.pan); setErrors(prev => err ? { ...prev, pan: err } : (({ pan: _, ...rest }) => rest)(prev)) }} />
                {errors.pan && <div style={errStyle}>{errors.pan}</div>}
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Address</label>
                <input className="form-input" value={editing.address}
                  onChange={e => setEditing({ ...editing, address: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Pincode {pincodeLoading && <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>(looking up...)</span>}</label>
                <input className="form-input" value={editing.pincode} maxLength={6}
                  placeholder="6 digit pincode"
                  inputMode="numeric"
                  onChange={e => handlePincodeChange(e.target.value)}
                  onBlur={() => { const err = validatePincode(editing.pincode); setErrors(prev => err ? { ...prev, pincode: err } : (({ pincode: _, ...rest }) => rest)(prev)) }} />
                {errors.pincode && <div style={errStyle}>{errors.pincode}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">State</label>
                <select className="form-input" value={editing.state}
                  onChange={e => handleStateChange(e.target.value)}>
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">City</label>
                <input className="form-input" value={editing.city}
                  placeholder={editing.state ? 'Type or select city' : 'Select state first'}
                  onChange={e => {
                    setEditing({ ...editing, city: e.target.value })
                    setCitySearch(e.target.value)
                    setShowCityDropdown(true)
                  }}
                  onFocus={() => editing.state && setShowCityDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                />
                {showCityDropdown && filteredCities.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)',
                    border: '1px solid var(--border)', borderRadius: 4, maxHeight: 160, overflow: 'auto', zIndex: 20,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}>
                    {filteredCities.slice(0, 15).map(c => (
                      <div key={c} onMouseDown={() => { setEditing({ ...editing, city: c }); setShowCityDropdown(false) }}
                        style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }}>
                        {c}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">State Code (GST)</label>
                <input className="form-input" value={editing.stateCode} maxLength={2} readOnly
                  style={{ background: 'var(--bg)', fontFamily: 'monospace' }}
                  title="Auto-filled from state selection" />
              </div>

              <div className="form-group">
                <label className="form-label">Opening Balance (₹)</label>
                <input className="form-input" type="number" step="0.01"
                  value={(editing.openingBalancePaise / 100).toFixed(2)}
                  onChange={e => setEditing({ ...editing, openingBalancePaise: Math.round(parseFloat(e.target.value || '0') * 100) })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
