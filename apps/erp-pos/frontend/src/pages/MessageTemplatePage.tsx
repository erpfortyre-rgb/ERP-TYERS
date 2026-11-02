import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ListMessageTemplates, SaveMessageTemplate, DeleteMessageTemplate } from '../../wailsjs/go/main/App'

interface Template {
  id: string; name: string; content: string; templateType: string
}

const placeholders = ['{customerName}', '{amount}', '{dueDate}', '{invoiceNumber}', '{date}', '{vehicleNo}', '{serviceType}', '{serviceDate}', '{phone}', '{balance}']

export default function MessageTemplatePage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', content: '', templateType: 'WHATSAPP' })

  useEffect(() => { loadTemplates() }, [])

  const loadTemplates = async () => {
    try {
      const data = await ListMessageTemplates() as any
      setTemplates(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load templates'); console.error(e) }
  }

  const handleAdd = async () => {
    if (!draft.name || !draft.content) return
    try {
      await SaveMessageTemplate({ id: '', ...draft, isActive: true } as any)
      toast.success('Template saved')
      setDraft({ name: '', content: '', templateType: 'WHATSAPP' })
      loadTemplates()
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); console.error(e) }
  }

  const handleSaveEdit = async (id: string, name: string, body: string) => {
    try {
      const existing = templates.find(t => t.id === id)
      if (existing) {
        await SaveMessageTemplate({ ...existing, name, content: body, isActive: (existing as any).isActive ?? true } as any)
        toast.success('Template updated')
        setEditingId(null)
        loadTemplates()
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); console.error(e) }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this template? This cannot be undone.')) return
    try {
      await DeleteMessageTemplate(id)
      toast.success('Template deleted')
      loadTemplates()
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); console.error(e) }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Message Templates</span>
        <span style={{ fontSize: '0.85rem' }}>{templates.length} template(s)</span>
      </div>

      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 8, fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
          <strong>Available Placeholders:</strong> {placeholders.map(p => (
            <span key={p} style={{ display: 'inline-block', margin: '2px 4px', padding: '1px 6px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 4, fontSize: '0.75rem', fontFamily: 'monospace' }}>{p}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Template Name *</label>
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="Template Name" style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)', width: 200 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Type</label>
            <select value={draft.templateType} onChange={e => setDraft({ ...draft, templateType: e.target.value })}
              style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 300 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Message Body *</label>
            <textarea value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })}
              placeholder="Type message with placeholders..." rows={2}
              style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)', resize: 'vertical' }} />
          </div>
          <button onClick={handleAdd}
            style={{ padding: '6px 20px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
            + Add
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {templates.map(t => (
          <div key={t.id} style={{ border: '1px solid var(--glass-border)', borderRadius: 8, padding: 12, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {editingId === t.id ? (
                  <input defaultValue={t.name} id={`tname-${t.id}`}
                    style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, fontWeight: 600, background: 'var(--bg-input)', color: 'var(--fg)' }} />
                ) : (
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                )}
                <span style={{ fontSize: '0.72rem', padding: '1px 8px', borderRadius: 10, background: 'var(--accent)', color: '#fff' }}>{t.templateType}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {editingId === t.id ? (
                  <button onClick={() => {
                    const nameEl = document.getElementById(`tname-${t.id}`) as HTMLInputElement
                    const bodyEl = document.getElementById(`tbody-${t.id}`) as HTMLTextAreaElement
                    handleSaveEdit(t.id, nameEl?.value || t.name, bodyEl?.value || t.content)
                  }}
                    style={{ padding: '2px 10px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                    Save
                  </button>
                ) : (
                  <button onClick={() => setEditingId(t.id)}
                    style={{ padding: '2px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                    Edit
                  </button>
                )}
                <button onClick={() => handleDelete(t.id)}
                  style={{ padding: '2px 10px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                  Delete
                </button>
              </div>
            </div>
            {editingId === t.id ? (
              <textarea defaultValue={t.content} id={`tbody-${t.id}`} rows={3}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)', resize: 'vertical', fontSize: '0.85rem' }} />
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>{t.content}</div>
            )}
          </div>
        ))}
        {templates.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No templates defined</div>
        )}
      </div>
    </div>
  )
}
