import { useMemo, useRef, useState } from 'react'
import { normalize } from '../lib/units.js'
import { formatPerBase, formatQuantity } from '../lib/format.js'
import { scanLabel, cancelScan } from '../lib/ocr.js'

const EMPTY = { name: '', price: '', quantity: '' }

export default function EntryForm({ onAdd }) {
  const [draft, setDraft] = useState(EMPTY)
  // null cuando no hay escaneo; {phase, pct} mientras corre.
  const [scan, setScan] = useState(null)
  const [scanNote, setScanNote] = useState('')
  const fileRef = useRef(null)

  // Vista previa en vivo: el usuario ve el precio normalizado antes de agregar.
  const preview = useMemo(
    () => normalize({ price: draft.price, quantity: draft.quantity }),
    [draft.price, draft.quantity],
  )

  const set = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    if (!preview) return
    onAdd({ ...draft, id: crypto.randomUUID() })
    setDraft(EMPTY)
    setScanNote('')
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-escanear la misma foto
    if (!file) return

    setScan({ phase: 'preparando foto', pct: 0 })
    setScanNote('')
    try {
      const result = await scanLabel(file, setScan)
      // El OCR solo PRE-LLENA. No agrega nada a la lista por su cuenta.
      setDraft((d) => ({
        ...d,
        price: result.price || d.price,
        quantity: result.quantity || d.quantity,
      }))
      setScanNote(
        result.found.length
          ? `Leí ${result.found.join(' y ')}. Revisa y corrige si hace falta.`
          : 'No pude leer la etiqueta. Escribe los datos a mano.',
      )
      setScan(null)
    } catch (err) {
      // Un timeout deja el worker moliendo: hay que cortarlo o seguira gastando bateria.
      await cancelScan()
      setScan(null)
      setScanNote(
        err?.message === 'TIMEOUT'
          ? 'El escaneo tardó demasiado y lo corté. Escribe los datos a mano.'
          : 'El escaneo falló, quizá por la conexión. Escribe los datos a mano.',
      )
    }
  }

  async function abort() {
    await cancelScan()
    setScan(null)
    setScanNote('Escaneo cancelado.')
  }

  const scanning = scan !== null

  return (
    <form className="card entry" onSubmit={submit}>
      <div className="entry-scan">
        <button
          type="button"
          className="btn btn-scan"
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
        >
          {scanning ? `${scan.phase}… ${scan.pct}%` : '📷 Escanear etiqueta'}
        </button>

        {scanning && (
          <>
            <div
              className="progress"
              role="progressbar"
              aria-valuenow={scan.pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="progress-bar" style={{ width: `${scan.pct}%` }} />
            </div>
            <button type="button" className="btn btn-ghost btn-cancel" onClick={abort}>
              Cancelar
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          hidden
        />
        <p className="hint">
          {scanNote ||
            (scanning
              ? 'La primera vez descarga el motor de lectura. Después es más rápido.'
              : 'El escaneo solo rellena el formulario. Tú confirmas antes de agregar.')}
        </p>
      </div>

      <div className="entry-grid">
        <label className="field field-wide">
          <span>Producto <em>(opcional)</em></span>
          <input
            type="text"
            value={draft.name}
            onChange={set('name')}
            placeholder="Aceite Primor"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Precio</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.price}
            onChange={set('price')}
            placeholder="12.90"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Cantidad</span>
          <input
            type="text"
            value={draft.quantity}
            onChange={set('quantity')}
            placeholder="900 ml"
            autoComplete="off"
          />
        </label>
      </div>

      <div className={`preview ${preview ? 'preview-on' : ''}`}>
        {preview ? (
          <>
            <strong>{formatPerBase(preview.pricePerBase, preview.base)}</strong>
            <span>{formatQuantity(preview.totalInBase, preview.base)} en total</span>
          </>
        ) : (
          <span className="hint">
            Escribe precio y cantidad — por ejemplo <code>450 g</code>, <code>1.5 L</code>,{' '}
            <code>12 rollos</code> o <code>6 x 350 ml</code>.
          </span>
        )}
      </div>

      <button type="submit" className="btn btn-primary" disabled={!preview}>
        Agregar a la comparación
      </button>
    </form>
  )
}
