// Formato peruano: punto decimal, coma de miles, simbolo S/.

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatSoles(n) {
  if (!Number.isFinite(n)) return '—'
  return soles.format(n)
}

/** "S/ 7.11 / kg" — la cifra que hace comparable todo. */
export function formatPerBase(pricePerBase, base) {
  return `${formatSoles(pricePerBase)} / ${base}`
}

/** Cantidad legible: 0.45 kg -> "450 g", 2.1 L -> "2.1 L" */
export function formatQuantity(totalInBase, base) {
  if (!Number.isFinite(totalInBase)) return '—'
  if (base === 'kg' && totalInBase < 1) return `${Math.round(totalInBase * 1000)} g`
  if (base === 'L' && totalInBase < 1) return `${Math.round(totalInBase * 1000)} ml`
  const n = Number(totalInBase.toFixed(2))
  if (base === 'kg' || base === 'L') return `${n} ${base}`
  return `${n} ${base}${n === 1 ? '' : 's'}`
}

export function formatPct(pct) {
  if (!Number.isFinite(pct)) return '—'
  if (pct < 0.5) return 'igual'
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}% más caro`
}
