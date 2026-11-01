import { useEffect, useMemo, useState } from 'react'
import EntryForm from './components/EntryForm.jsx'
import Results from './components/Results.jsx'
import { compare } from './lib/units.js'

const STORAGE_KEY = 'lorito.productos.v1'

/**
 * La lista vive en el dispositivo. No es "historial de precios" — es durabilidad
 * de la sesion, para que no pierdas la comparacion si el celular se bloquea.
 * Sin cuentas ni sincronizacion: costo cero.
 */
function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function App() {
  const [products, setProducts] = useState(loadProducts)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
    } catch {
      // Modo privado o almacenamiento bloqueado: la app sigue funcionando en memoria.
    }
  }, [products])

  const groups = useMemo(() => compare(products), [products])

  const add = (product) => setProducts((p) => [...p, product])
  const remove = (id) => setProducts((p) => p.filter((x) => x.id !== id))
  const clear = () => setProducts([])

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span className="logo" aria-hidden="true">🦜</span> Lorito
        </h1>
        <p className="tagline">Te canta el precio real.</p>
      </header>

      <EntryForm onAdd={add} />

      <Results groups={groups} onRemove={remove} />

      {products.length > 0 && (
        <button type="button" className="btn btn-ghost" onClick={clear}>
          Vaciar la comparación
        </button>
      )}

      {products.length === 0 && (
        <section className="empty">
          <h2>Por qué existe esto</h2>
          <p>
            Las marcas usan tamaños irregulares — 450 g, 970 ml, 385 g — para que no puedas
            comparar de cabeza. Lorito pone todo en la misma vara: precio por kilo, por litro
            o por unidad.
          </p>
          <table className="example">
            <thead>
              <tr>
                <th>Etiqueta</th>
                <th>Precio real</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>450 g — S/ 3.20</td>
                <td>S/ 7.11 / kg</td>
              </tr>
              <tr>
                <td>970 g — S/ 6.50</td>
                <td className="better">S/ 6.70 / kg</td>
              </tr>
            </tbody>
          </table>
          <p className="hint">
            El más barato en la etiqueta no es el que más conviene.
          </p>
        </section>
      )}

      <footer className="footer">
        Hecho para el pasillo del supermercado. Todo se calcula en tu teléfono.
      </footer>
    </div>
  )
}
