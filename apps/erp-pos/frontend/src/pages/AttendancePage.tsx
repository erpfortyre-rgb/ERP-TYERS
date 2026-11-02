import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListEmployees, ListAttendance, SaveAttendance } from '../../wailsjs/go/main/App'

interface Employee { id: string; name: string; designation: string }
interface AttendanceRecord { id: string; employeeId: string; attendanceDate: string; status: string; notes: string }

const today = () => new Date().toISOString().slice(0, 10)

export default function AttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [date, setDate] = useState(today())

  const load = useCallback(async () => {
    try {
      const [emps, att] = await Promise.all([
        ListEmployees(''),
        ListAttendance('', date, date)
      ])
      setEmployees(emps || [])
      setAttendance(att || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [date])

  useEffect(() => { load() }, [load])

  const getStatus = (empId: string) => {
    const rec = attendance.find(a => a.employeeId === empId && a.attendanceDate === date)
    return rec?.status || ''
  }

  const markAttendance = async (empId: string, status: string) => {
    try {
      await SaveAttendance({
        id: '', employeeId: empId, attendanceDate: date, status, notes: ''
      } as any)
      toast.success('Attendance marked')
      load()
    } catch (e: any) { toast.error(e?.message || 'Failed to mark attendance'); console.error(e) }
  }

  const statusColors: Record<string, string> = {
    PRESENT: 'var(--success)',
    ABSENT: 'var(--error)',
    HALF_DAY: '#f59e0b',
    LEAVE: '#6366f1',
  }

  const presentCount = employees.filter(e => getStatus(e.id) === 'PRESENT').length
  const absentCount = employees.filter(e => getStatus(e.id) === 'ABSENT').length
  const halfDayCount = employees.filter(e => getStatus(e.id) === 'HALF_DAY').length

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Employee Attendance</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Date:</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4 }} />
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={() => setDate(today())}>Today</button>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: '0.85rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', marginRight: 4 }}></span>
            Present: {presentCount}
          </span>
          <span style={{ fontSize: '0.85rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--error)', display: 'inline-block', marginRight: 4 }}></span>
            Absent: {absentCount}
          </span>
          <span style={{ fontSize: '0.85rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', marginRight: 4 }}></span>
            Half Day: {halfDayCount}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Employee Name</th>
              <th style={{ width: 120 }}>Designation</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 280 }}>Mark Attendance</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => {
              const status = getStatus(emp.id)
              return (
                <tr key={emp.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{emp.name}</td>
                  <td>{emp.designation || '-'}</td>
                  <td>
                    {status && (
                      <span style={{
                        padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
                        background: statusColors[status] || '#ccc', color: '#fff'
                      }}>
                        {status.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'].map(s => (
                        <button key={s} onClick={() => markAttendance(emp.id, s)}
                          style={{
                            padding: '4px 10px', border: status === s ? '2px solid var(--fg)' : '1px solid var(--border)',
                            borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                            background: status === s ? statusColors[s] : 'var(--bg-card)',
                            color: status === s ? '#fff' : 'var(--fg)'
                          }}>
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
            {employees.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                No employees found. Add employees in Masters first.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
