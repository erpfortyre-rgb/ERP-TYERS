import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'number' | 'rupees' | 'select'
  options?: { value: string; label: string }[]
  width?: number
  required?: boolean
  placeholder?: string
  maxLength?: number
  inputFilter?: RegExp
  transform?: (v: string) => string
  validate?: (v: string) => string | null
}

interface SimpleMasterProps {
  title: string
  fields: FieldDef[]
  listFn: (...args: any[]) => Promise<any[]>
  saveFn: (item: any) => Promise<string>
  deleteFn?: (id: string) => Promise<void>
  listArgs?: any[]
}

export default function SimpleMaster({ title, fields, listFn, saveFn, deleteFn, listArgs = [] }: SimpleMasterProps) {
  const [items, setItems] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listFn(...listArgs)
      // Deleted masters are soft-deleted (is_active = 0): hide them from the list
      setItems((list || []).filter((r: any) => r.isActive !== false))
    } catch (e: any) { console.error(e); toast.error(e?.message || `Failed to load ${title}`) }
    setLoading(false)
  }, [listFn, ...listArgs])

  useEffect(() => { load() }, [load])

  const validateAll = (): boolean => {
    if (!editing) return false
    const errs: Record<string, string> = {}
    for (const f of fields) {
      if (f.required && !editing[f.key]?.toString().trim()) {
        errs[f.key] = `${f.label} is required`
      }
      if (f.validate && editing[f.key]) {
        const err = f.validate(editing[f.key].toString())
        if (err) errs[f.key] = err
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validateAll()) return
    try {
      await saveFn(editing)
      toast.success(`${title} saved`)
      setEditing(null)
      setErrors({})
      load()
    } catch (e: any) { toast.error(e?.message || 'Save failed'); console.error(e) }
  }

  const handleDelete = async (id: string, itemName: string) => {
    if (!deleteFn) return
    if (!window.confirm(`Delete "${itemName}"? This cannot be undone.`)) return
    try {
      await deleteFn(id)
      toast.success(`${title} deleted`)
      load()
    } catch (e: any) { toast.error(e?.message || 'Delete failed'); console.error(e) }
  }

  const emptyItem = () => {
    const obj: any = { id: '', isActive: true }
    fields.forEach(f => {
      if (f.type === 'number' || f.type === 'rupees') obj[f.key] = 0
      else if (f.type === 'select') obj[f.key] = f.options?.[0]?.value || ''
      else obj[f.key] = ''
    })
    return obj
  }

  const handleFieldChange = (f: FieldDef, rawValue: string) => {
    let value = rawValue
    if (f.inputFilter) value = value.split('').filter(c => f.inputFilter!.test(c)).join('')
    if (f.maxLength) value = value.slice(0, f.maxLength)
    if (f.transform) value = f.transform(value)
    setEditing({ ...editing, [f.key]: value })
  }

  const handleFieldBlur = (f: FieldDef) => {
    if (f.validate && editing?.[f.key]) {
      const err = f.validate(editing[f.key].toString())
      setErrors(prev => err ? { ...prev, [f.key]: err } : (({ [f.key]: _, ...rest }) => rest)(prev))
    }
  }

  const formatCell = (value: any, field: FieldDef) => {
    if (field.type === 'rupees') {
      const val = (value || 0) / 100
      return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    if (field.type === 'select') {
      return field.options?.find(o => o.value === value)?.label ?? value ?? ''
    }
    return value ?? ''
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--fg-bright)' }}>
          {title} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--fg-muted)' }}>({items.length})</span>
        </h2>
        <button className="btn btn-primary" onClick={() => { setEditing(emptyItem()); setErrors({}) }}>+ Create New</button>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              {fields.map(f => <th key={f.key}>{f.label}</th>)}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id}>
                <td>{i + 1}</td>
                {fields.map(f => (
                  <td key={f.key} style={f.key === fields[0]?.key ? { fontWeight: 500 } : undefined}>
                    {formatCell(item[f.key], f)}
                  </td>
                ))}
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing({ ...item }); setErrors({}) }}>Edit</button>
                    {deleteFn && (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}
                        onClick={() => handleDelete(item.id, item[fields[0]?.key] || item.name || item.id)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={fields.length + 2} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                No records found
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'F2') { e.preventDefault(); e.stopPropagation(); handleSave() }
              else if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) }
            }}>
            <div className="modal-title">{editing.id ? `Edit ${title}` : `Create ${title}`}</div>
            {fields.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}{f.required ? ' *' : ''}</label>
                {f.type === 'rupees' ? (
                  <input className="form-input" type="number" step="0.01"
                    value={((editing[f.key] || 0) / 100).toFixed(2)}
                    onChange={e => setEditing({ ...editing, [f.key]: Math.round(parseFloat(e.target.value || '0') * 100) })} />
                ) : f.type === 'number' ? (
                  <input className="form-input" type="number"
                    value={editing[f.key] || 0}
                    onChange={e => setEditing({ ...editing, [f.key]: parseFloat(e.target.value || '0') })} />
                ) : f.type === 'select' ? (
                  <select className="form-input" value={editing[f.key] || f.options?.[0]?.value || ''}
                    onChange={e => setEditing({ ...editing, [f.key]: e.target.value })}>
                    {f.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : (
                  <input className="form-input" value={editing[f.key] || ''}
                    placeholder={f.placeholder}
                    maxLength={f.maxLength}
                    onChange={e => handleFieldChange(f, e.target.value)}
                    onBlur={() => handleFieldBlur(f)}
                    autoFocus={f === fields[0]}
                    style={f.transform ? { textTransform: 'uppercase' as const, fontFamily: 'monospace' } : undefined} />
                )}
                {errors[f.key] && <div style={{ fontSize: '0.72rem', color: 'var(--error)', marginTop: 2 }}>{errors[f.key]}</div>}
              </div>
            ))}
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
