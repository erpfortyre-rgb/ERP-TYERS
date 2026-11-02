import { useState, useEffect, useCallback, useRef } from 'react'

interface HistoryEntry {
  expression: string
  result: string
}

interface CalculatorProps {
  visible: boolean
  onClose: () => void
  targetRef: React.MutableRefObject<HTMLInputElement | null>
}

function safeEval(expr: string): string {
  try {
    const sanitized = expr
      .replace(/[^0-9+\-*/.()% ]/g, '')
      .replace(/%/g, '/100*')
    if (!sanitized.trim()) return '0'
    const fn = new Function(`return (${sanitized})`)
    const r = fn()
    if (typeof r !== 'number' || !isFinite(r)) return 'Error'
    return parseFloat(r.toFixed(4)).toString()
  } catch {
    return 'Error'
  }
}

const buttons = [
  ['C', '(', ')', '%'],
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '⌫', '+'],
]

export default function Calculator({ visible, onClose, targetRef }: CalculatorProps) {
  const [display, setDisplay] = useState('')
  const [result, setResult] = useState('0')
  const [evaluated, setEvaluated] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('calc-history')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [showHistory, setShowHistory] = useState(false)
  const calcRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem('calc-history', JSON.stringify(history.slice(0, 50))) } catch {}
  }, [history])

  useEffect(() => {
    if (visible) {
      setDisplay('')
      setResult('0')
      setEvaluated(false)
      setShowHistory(false)
      if (targetRef.current) {
        const val = targetRef.current.value.replace(/[^0-9.]/g, '')
        if (val && !isNaN(Number(val))) {
          setDisplay(val)
          setResult(val)
        }
      }
    }
  }, [visible])

  const evaluate = useCallback(() => {
    if (!display.trim()) return
    const r = safeEval(display)
    setResult(r)
    setEvaluated(true)
    if (r !== 'Error') {
      setHistory(prev => [{ expression: display, result: r }, ...prev.slice(0, 49)])
    }
  }, [display])

  const inject = useCallback(() => {
    if (result === 'Error') return
    if (targetRef.current) {
      const nativeSet = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set
      if (nativeSet) {
        nativeSet.call(targetRef.current, result)
        targetRef.current.dispatchEvent(new Event('input', { bubbles: true }))
        targetRef.current.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        targetRef.current.value = result
      }
      targetRef.current.focus()
    }
    onClose()
  }, [result, onClose, targetRef])

  const handleBtn = useCallback((btn: string) => {
    if (btn === 'C') { setDisplay(''); setResult('0'); setEvaluated(false); return }
    if (btn === '⌫') {
      if (evaluated) {
        setDisplay(result === 'Error' ? '' : result.slice(0, -1))
      } else {
        setDisplay(prev => prev.slice(0, -1))
      }
      setEvaluated(false)
      return
    }
    if (btn === '.') {
      if (evaluated) { setDisplay(result + '.'); setEvaluated(false); return }
      const parts = display.split(/[+\-*/()]/)
      const lastNum = parts[parts.length - 1] || ''
      if (lastNum.includes('.')) return
    }
    if (evaluated && '0123456789.'.includes(btn)) {
      setDisplay(result + btn)
      setEvaluated(false)
      return
    }
    setEvaluated(false)
    setDisplay(prev => prev + btn)
  }, [evaluated, result, display])

  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'Enter') { e.preventDefault(); if (evaluated && result !== 'Error') inject(); else evaluate(); return }
      if (e.key === 'Backspace') {
        e.preventDefault()
        if (evaluated) { setDisplay(result === 'Error' ? '' : result.slice(0, -1)); setEvaluated(false) }
        else { setDisplay(prev => prev.slice(0, -1)) }
        return
      }
      if (e.key === 'Delete') { e.preventDefault(); setDisplay(''); setResult('0'); return }
      if ('0123456789+-*/().%'.includes(e.key)) { e.preventDefault(); setEvaluated(false); setDisplay(prev => prev + e.key); return }
      if (e.key === '=' || e.key === 'F2') { e.preventDefault(); evaluate(); return }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [visible, evaluate, inject, display, result, evaluated, onClose])

  useEffect(() => {
    if (!display) { setResult('0'); return }
    const r = safeEval(display)
    if (r !== 'Error') setResult(r)
  }, [display])

  if (!visible) return null

  return (
    <div className="calc-overlay" onClick={onClose}>
      <div className="calc-popup" ref={calcRef} onClick={e => e.stopPropagation()}>
        <div className="calc-header">
          <span className="calc-title">Calculator</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`calc-hist-toggle${showHistory ? ' active' : ''}`}
              onClick={() => setShowHistory(p => !p)}
              title="History"
            >
              H
            </button>
            <button className="calc-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="calc-body">
          <div className="calc-main">
            <div className="calc-display">
              <div className="calc-expression">{display || '0'}</div>
              <div className="calc-result">= {result}</div>
            </div>

            <div className="calc-buttons">
              {buttons.map((row, ri) => (
                <div key={ri} className="calc-row">
                  {row.map(btn => (
                    <button
                      key={btn}
                      className={`calc-btn${btn === 'C' ? ' calc-btn-clear' : ''}${['+','-','*','/','%'].includes(btn) ? ' calc-btn-op' : ''}`}
                      onClick={() => handleBtn(btn)}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              ))}
              <div className="calc-row">
                <button className="calc-btn calc-btn-eval" onClick={evaluate} style={{ flex: 1 }}>=</button>
                <button className="calc-btn calc-btn-apply" onClick={inject} style={{ flex: 2 }}>
                  Apply ↵
                </button>
              </div>
            </div>
          </div>

          {showHistory && (
            <div className="calc-history">
              <div className="calc-hist-title">History</div>
              {history.length === 0 && <div className="calc-hist-empty">No calculations yet</div>}
              {history.map((h, i) => (
                <div
                  key={i}
                  className="calc-hist-item"
                  onClick={() => { setDisplay(h.result); setResult(h.result) }}
                  title="Click to use this result"
                >
                  <div className="calc-hist-expr">{h.expression}</div>
                  <div className="calc-hist-res">= {h.result}</div>
                </div>
              ))}
              {history.length > 0 && (
                <button className="calc-hist-clear" onClick={() => setHistory([])}>Clear History</button>
              )}
            </div>
          )}
        </div>

        <div className="calc-footer">
          <span>Ctrl+M or F2 to open</span>
          <span>Enter = Evaluate → Apply</span>
        </div>
      </div>
    </div>
  )
}
