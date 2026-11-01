import { FAMILY_LABELS } from '../lib/units.js'
import { formatSoles, formatPerBase, formatQuantity, formatPct } from '../lib/format.js'

export default function Results({ groups, onRemove }) {
  if (!groups.length) return null

  return (
    <section className="results">
      {groups.length > 1 && (
        <p className="note">
          Hay productos de familias distintas. No se comparan entre sí — comparar peso contra
          volumen no tiene sentido — así que cada familia tiene su propio ganador.
        </p>
      )}

      {groups.map((group) => {
        const comparable = group.items.length > 1
        return (
          <div className="group" key={group.family}>
            <h2 className="group-title">
              {FAMILY_LABELS[group.family]}
              <span className="group-base">por {group.items[0].base}</span>
            </h2>

            <ul className="items">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className={`item ${comparable && item.isWinner ? 'item-winner' : ''}`}
                >
                  <div className="item-head">
                    <span className="item-name">{item.name?.trim() || 'Sin nombre'}</span>
                    {comparable && item.isWinner && <span className="badge">Más conviene</span>}
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => onRemove(item.id)}
                      aria-label={`Quitar ${item.name?.trim() || 'producto'}`}
                    >
                      ×
                    </button>
                  </div>

                  <div className="item-figure">{formatPerBase(item.pricePerBase, item.base)}</div>

                  <div className="item-meta">
                    <span>
                      {formatSoles(item.priceValue)} · {formatQuantity(item.totalInBase, item.base)}
                    </span>
                    {comparable && !item.isWinner && (
                      <span className="worse">{formatPct(item.extraCostPct)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {!comparable && (
              <p className="hint">Agrega otro producto de esta familia para ver quién gana.</p>
            )}
          </div>
        )
      })}
    </section>
  )
}
