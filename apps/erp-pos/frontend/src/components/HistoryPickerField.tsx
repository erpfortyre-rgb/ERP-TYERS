import { useState, useEffect, useRef, useCallback } from 'react'
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiLayers } from 'react-icons/fi'
import { GetSettings, SaveSetting } from '../../wailsjs/go/main/App'

// A reusable textarea + F4 "history picker" for repeated text fields like
// invoice Narration and Terms & Conditions. Press F4 inside the field to open a
// popup of previously-used lines: search, multi-select, auto-numbered merge,
// add/edit/delete, and templates. New text auto-saves to history on blur/F4.
// History is stored per company in the settings table (key `hist_<kind>`), so
// no schema change is needed. Variables {Date} and {Invoice_No} are expanded.

export interface HistoryItem { id: string; text: string; usageCount: number; isTemplate?: boolean }

interface Props {
  kind: string            // storage bucket, e.g. 'narration' | 'terms'
  label: string
  value: string
  onChange: (v: string) => void
  invoiceNo?: string
  placeholder?: string
  rows?: number
  maxLen?: number
}

const uid = () => 'h' + Math.random().toString(36).slice(2, 9)
const stripNum = (s: string) => s.replace(/^\d+[.)]\s*/, '')

function expandVars(text: string, invoiceNo?: string): string {
  const today = new Date().toLocaleDateString('en-GB')
  return text.replace(/{Date}/gi, today).replace(/{Invoice_No}/gi, invoiceNo || '')
}

export default function HistoryPickerField({ kind, label, value, onChange, invoiceNo, placeholder, rows = 2, maxLen = 1000 }: Props) {
  const storeKey = 'hist_' + kind
  const [items, setItems] = useState<HistoryItem[]>([])
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [focused, setFocused] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastClick = useRef(-1)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Load this bucket's history once.
  useEffect(() => {
    GetSettings().then((s: any) => {
      try { const arr = JSON.parse((s && s[storeKey]) || '[]'); if (Array.isArray(arr)) setItems(arr) } catch { /* ignore */ }
    }).catch(() => {})
  }, [storeKey])

  // Auto-grow the textarea with its content (like the client's reference).
  useEffect(() => {
    const el = taRef.current; if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(Math.max(56, el.scrollHeight), 260) + 'px'
    el.style.overflowY = el.scrollHeight > 260 ? 'auto' : 'hidden'
  }, [value])

  const persist = useCallback((next: HistoryItem[]) => {
    setItems(next)
    SaveSetting(storeKey, JSON.stringify(next)).catch(() => {})
  }, [storeKey])

  // Auto-save any new (non-duplicate) lines the user typed into history.
  const autoSave = useCallback(() => {
    const text = (taRef.current?.value || '').trim()
    if (!text) return
    const existing = new Set(items.map(i => i.text.toLowerCase()))
    const lines = text.split('\n').map(l => stripNum(l.trim())).filter(Boolean)
    const add: HistoryItem[] = []
    for (const line of lines) {
      if (!existing.has(line.toLowerCase())) { existing.add(line.toLowerCase()); add.push({ id: uid(), text: line, usageCount: 1 }) }
    }
    if (add.length) persist([...items, ...add])
  }, [items, persist])

  const openPopup = () => { autoSave(); setFilter(''); setFocused(0); setSelected(new Set()); lastClick.current = -1; setOpen(true) }
  const closePopup = () => setOpen(false)

  // Visible (filtered + most-used-first) list.
  const q = filter.trim().toLowerCase()
  const visible = (q ? items.filter(i => i.text.toLowerCase().includes(q)) : items)
    .slice().sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))

  const mergeInto = (picked: string[]) => {
    const existing = value.split('\n').map(s => stripNum(s.trim())).filter(Boolean)
    const seen = new Set(existing.map(s => s.toLowerCase()))
    const fresh: string[] = []
    for (const p of picked) {
      const t = stripNum(expandVars(p, invoiceNo).trim())
      if (!t || seen.has(t.toLowerCase())) continue
      seen.add(t.toLowerCase()); fresh.push(t)
    }
    const all = [...existing, ...fresh]
    if (all.length === 0) return ''
    return all.length > 1 ? all.map((l, i) => `${i + 1}. ${l}`).join('\n') : all[0]
  }

  const apply = () => {
    let picked: string[] = []
    if (selected.size > 0) picked = items.filter(i => selected.has(i.id)).map(i => i.text)
    else if (visible[focused]) picked = [visible[focused].text]
    if (picked.length) {
      const ids = new Set(selected.size ? selected : (visible[focused] ? [visible[focused].id] : []))
      if (ids.size) persist(items.map(i => ids.has(i.id) ? { ...i, usageCount: (i.usageCount || 0) + 1 } : i))
      onChange(mergeInto(picked))
    }
    closePopup(); taRef.current?.focus()
  }

  const toggle = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const addNew = (text: string) => {
    const t = text.trim(); if (!t) return
    if (items.some(i => i.text.toLowerCase() === t.toLowerCase())) return
    persist([{ id: uid(), text: t, usageCount: 1 }, ...items])
  }
  const editItem = (it: HistoryItem) => {
    const nt = prompt('Edit entry:', it.text)
    if (nt && nt.trim() && nt !== it.text) persist(items.map(i => i.id === it.id ? { ...i, text: nt.trim() } : i))
  }
  const delItem = (id: string) => { persist(items.filter(i => i.id !== id)); setSelected(prev => { const s = new Set(prev); s.delete(id); return s }) }
  const saveTemplate = () => {
    if (selected.size < 2) { alert('Select at least 2 lines to save as a template.'); return }
    const name = prompt('Template name:'); if (!name) return
    const texts = items.filter(i => selected.has(i.id)).map(i => i.text)
    persist([{ id: uid(), text: `[${name}]\n` + texts.map(t => '- ' + t).join('\n'), usageCount: 10, isTemplate: true }, ...items])
    setSelected(new Set())
  }

  // styles
  const ta: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 56, padding: '9px 12px', fontSize: '0.86rem', color: 'var(--fg)', background: 'var(--bg-input)', border: '1.5px solid var(--border)', borderRadius: 8, outline: 'none', resize: 'none', overflowY: 'hidden', lineHeight: 1.6, fontFamily: 'inherit' }
  const popup: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 12px 28px rgba(0,0,0,0.18)', overflow: 'hidden' }
  const smInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: '0.78rem', padding: '6px 8px 6px 26px', border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--bg-input)', color: 'var(--fg)', fontFamily: 'inherit' }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--fg-muted)' }}>{label}</label>
        <span style={{ fontSize: '0.68rem', color: value.length > maxLen * 0.9 ? '#ef4444' : 'var(--fg-muted)', fontWeight: value.length > maxLen * 0.9 ? 700 : 400 }}>Press <kbd style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 3, padding: '0 4px', fontSize: '0.64rem' }}>F4</kbd> for saved list &middot; {value.length}/{maxLen}</span>
      </div>
      <textarea
        ref={taRef}
        rows={rows}
        value={value}
        placeholder={placeholder || 'Type, or press F4 to pick from saved…'}
        maxLength={maxLen}
        onChange={e => onChange(e.target.value)}
        onBlur={autoSave}
        onKeyDown={e => { if (e.key === 'F4' || e.keyCode === 115) { e.preventDefault(); e.stopPropagation(); openPopup() } }}
        style={ta}
      />

      {open && (
        <>
          <div onMouseDown={closePopup} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
          <div style={popup} onMouseDown={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); selected.size ? apply() : closePopup() }
              else if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, visible.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
              else if (e.key === ' ' && e.target === listRef.current) { e.preventDefault(); if (visible[focused]) toggle(visible[focused].id) }
              else if (e.key === 'Enter' && e.target === listRef.current) { e.preventDefault(); apply() }
              else if (e.key === 'Delete' && e.target === listRef.current) { e.preventDefault(); if (visible[focused]) delItem(visible[focused].id) }
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg)' }}>
              <span>Saved {label}</span>
              <span style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>Selected: {selected.size}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <FiSearch size={11} style={{ position: 'absolute', left: 9, color: 'var(--fg-muted)' }} />
                <input autoFocus value={filter} onChange={e => { setFilter(e.target.value); setFocused(0) }} placeholder="Search…" style={smInput}
                  onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); listRef.current?.focus() } }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input placeholder="New entry…" style={{ ...smInput, paddingLeft: 8 }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNew((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' } }} />
                <button type="button" onClick={e => { const inp = (e.currentTarget.previousSibling as HTMLInputElement); addNew(inp.value); inp.value = '' }}
                  style={{ flexShrink: 0, width: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--accent)', cursor: 'pointer' }}><FiPlus size={12} /></button>
              </div>
            </div>
            <ul ref={listRef} tabIndex={-1} style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 240, overflowY: 'auto', outline: 'none' }}>
              {visible.length === 0 ? (
                <li style={{ padding: 16, textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.78rem' }}>
                  {q ? <>No match. <button type="button" onClick={() => { addNew(filter.trim()); setFilter('') }} style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', border: 'none', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>+ Add "{filter.trim()}"</button></> : 'No saved entries yet — type above and press +'}
                </li>
              ) : visible.map((it, idx) => {
                const isSel = selected.has(it.id)
                return (
                  <li key={it.id}
                    onClick={e => {
                      if ((e.target as HTMLElement).closest('button')) return
                      if (e.shiftKey && lastClick.current !== -1) {
                        const a = Math.min(lastClick.current, idx), b = Math.max(lastClick.current, idx)
                        setSelected(prev => { const s = new Set(prev); for (let i = a; i <= b; i++) s.add(visible[i].id); return s })
                      } else { setFocused(idx); toggle(it.id) }
                      lastClick.current = idx
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', fontSize: '0.84rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: idx === focused ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : isSel ? 'var(--bg-sidebar)' : 'transparent' }}>
                    <input type="checkbox" checked={isSel} readOnly tabIndex={-1} style={{ width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, color: 'var(--fg)', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {it.isTemplate && <FiLayers size={11} style={{ marginRight: 5, color: 'var(--accent)', verticalAlign: '-1px' }} />}{it.text}
                    </span>
                    <button type="button" title="Edit" onClick={e => { e.stopPropagation(); editItem(it) }} style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--accent)', cursor: 'pointer' }}><FiEdit2 size={11} /></button>
                    <button type="button" title="Delete" onClick={e => { e.stopPropagation(); delItem(it.id) }} style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 4, border: '1px solid #ef444455', background: 'var(--bg-input)', color: '#ef4444', cursor: 'pointer' }}><FiTrash2 size={11} /></button>
                  </li>
                )
              })}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--fg-muted)' }}>
              <span>Space select &middot; ↑↓ move &middot; Enter apply</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={saveTemplate} style={{ background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', padding: '4px 9px', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>Save Template</button>
                <button type="button" onClick={apply} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>Done</button>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
