// Motor de normalizacion de Lorito.
//
// Regla central: todo se normaliza HACIA ARRIBA, a la unidad entera
// (por kg, por L, por unidad). Normalizar hacia abajo produce decimales
// que nadie compara mentalmente en un pasillo.

export const FAMILIES = {
  WEIGHT: 'weight',
  VOLUME: 'volume',
  COUNT: 'count',
}

export const FAMILY_LABELS = {
  [FAMILIES.WEIGHT]: 'Peso',
  [FAMILIES.VOLUME]: 'Volumen',
  [FAMILIES.COUNT]: 'Conteo',
}

// factor = cuanto vale 1 de esta unidad expresado en la unidad base de su familia.
const UNITS = [
  // --- Peso, base: kg ---
  { family: FAMILIES.WEIGHT, factor: 0.001, base: 'kg', aliases: ['g', 'gr', 'grs', 'grm', 'gramo', 'gramos'] },
  { family: FAMILIES.WEIGHT, factor: 1, base: 'kg', aliases: ['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos', 'k'] },

  // --- Volumen, base: L ---
  { family: FAMILIES.VOLUME, factor: 0.001, base: 'L', aliases: ['ml', 'mls', 'cc', 'mililitro', 'mililitros'] },
  { family: FAMILIES.VOLUME, factor: 1, base: 'L', aliases: ['l', 'lt', 'lts', 'litro', 'litros'] },

  // --- Conteo, base: la unidad que escribio el usuario ---
  { family: FAMILIES.COUNT, factor: 1, base: 'u', aliases: ['u', 'un', 'und', 'unid', 'unidad', 'unidades', 'pza', 'pzas', 'pieza', 'piezas'] },
  { family: FAMILIES.COUNT, factor: 1, base: 'rollo', aliases: ['rollo', 'rollos'] },
  { family: FAMILIES.COUNT, factor: 1, base: 'sobre', aliases: ['sobre', 'sobres'] },
  { family: FAMILIES.COUNT, factor: 1, base: 'bolsita', aliases: ['bolsita', 'bolsitas'] },
  { family: FAMILIES.COUNT, factor: 1, base: 'capsula', aliases: ['capsula', 'capsulas'] },
  { family: FAMILIES.COUNT, factor: 1, base: 'tableta', aliases: ['tableta', 'tabletas'] },
]

const UNIT_INDEX = new Map()
for (const u of UNITS) {
  for (const alias of u.aliases) {
    UNIT_INDEX.set(alias, u)
  }
}

/** Quita acentos y normaliza a minusculas, para que "cápsula" y "capsula" sean la misma unidad. */
function fold(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export function lookupUnit(token) {
  return UNIT_INDEX.get(fold(token).replace(/\.$/, '')) ?? null
}

/**
 * Convierte texto a numero tolerando las dos convenciones que la gente escribe.
 *
 * Peru usa punto decimal y coma de miles, pero la gente mezcla. Regla:
 *  - dos separadores distintos  -> el de la derecha es el decimal
 *  - un separador con 3 digitos -> separador de miles  ("1,500" -> 1500)
 *  - un separador con 1-2       -> separador decimal   ("1,5"   -> 1.5)
 */
export function parseNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null

  let s = fold(input).replace(/\s/g, '').replace(/^s\/\.?/, '').replace(/[^\d.,]/g, '')
  if (!s) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    // El separador mas a la derecha manda; el otro es de miles.
    const decimalAt = Math.max(lastComma, lastDot)
    const decimalSep = s[decimalAt]
    const thousandsSep = decimalSep === ',' ? '.' : ','
    s = s.split(thousandsSep).join('')
    s = s.replace(decimalSep, '.')
  } else if (lastComma !== -1 || lastDot !== -1) {
    const at = lastComma !== -1 ? lastComma : lastDot
    const sep = s[at]
    const after = s.length - at - 1
    const occurrences = s.split(sep).length - 1

    if (occurrences > 1 || after === 3) {
      s = s.split(sep).join('') // miles
    } else {
      s = s.replace(sep, '.') // decimal
    }
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Interpreta la cantidad de una etiqueta.
 *
 * Acepta: "450 g", "1.5 kg", "970ml", "12 rollos", "6 x 350 ml", "6x350ml"
 * Devuelve { packCount, unitValue, unit, family, base, totalInBase } o null.
 */
export function parseQuantity(input) {
  if (input == null) return null
  const text = fold(input)
  if (!text) return null

  // Pack compuesto: "6 x 350 ml" -> 6 envases de 350 ml
  const pack = text.match(/^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*([a-z]+)\.?$/)
  if (pack) {
    const packCount = parseNumber(pack[1])
    const unitValue = parseNumber(pack[2])
    const unit = lookupUnit(pack[3])
    if (!packCount || !unitValue || !unit) return null
    return buildQuantity(packCount, unitValue, unit, pack[3])
  }

  // Simple: "450 g", "12 rollos". La unidad tambien puede venir antes ("12 rollos" vs "rollos 12").
  const simple = text.match(/^(\d+(?:[.,]\d+)?)\s*([a-z]+)?\.?$/)
  if (simple) {
    const unitValue = parseNumber(simple[1])
    if (!unitValue) return null
    // Sin unidad explicita asumimos conteo: "12" = 12 unidades.
    const token = simple[2] ?? 'u'
    const unit = lookupUnit(token)
    if (!unit) return null
    return buildQuantity(1, unitValue, unit, token)
  }

  return null
}

function buildQuantity(packCount, unitValue, unit, rawToken) {
  const totalInBase = packCount * unitValue * unit.factor
  if (!(totalInBase > 0)) return null
  return {
    packCount,
    unitValue,
    unit: fold(rawToken),
    family: unit.family,
    // En conteo la base es el sustantivo del alias ("por rollo"), no "por unidad":
    // conserva informacion util en el estante.
    base: unit.base,
    totalInBase,
  }
}

/**
 * Normaliza un producto a su precio por unidad base.
 * Devuelve { pricePerBase, base, family, totalInBase } o null si algo no se pudo leer.
 */
export function normalize({ price, quantity }) {
  const p = parseNumber(price)
  const q = typeof quantity === 'object' && quantity !== null ? quantity : parseQuantity(quantity)
  if (p == null || p <= 0 || !q) return null

  return {
    family: q.family,
    base: q.base,
    totalInBase: q.totalInBase,
    // Precio de etiqueta ya parseado, para que la UI no tenga que re-interpretarlo.
    priceValue: p,
    pricePerBase: p / q.totalInBase,
  }
}

/**
 * Agrupa por familia y ordena por precio por unidad base.
 *
 * Restriccion de correccion: comparar entre familias distintas no tiene sentido
 * (450 g contra 970 ml no se comparan), asi que cada familia tiene su propio ganador.
 *
 * savingVsWorst del ganador y extraCost de los demas se expresan en % contra el ganador.
 */
export function compare(products) {
  const groups = new Map()

  for (const product of products) {
    const norm = normalize(product)
    if (!norm) continue
    // En conteo, "rollo" y "sobre" son sustantivos distintos pero ambos son conteo:
    // se comparan entre si, y el ganador se expresa en la base del propio producto.
    const key = norm.family
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ ...product, ...norm })
  }

  const result = []
  for (const [family, items] of groups) {
    items.sort((a, b) => a.pricePerBase - b.pricePerBase)
    const winner = items[0]
    result.push({
      family,
      items: items.map((item, i) => ({
        ...item,
        isWinner: i === 0,
        // Cuanto mas caro es este que el ganador, en %.
        extraCostPct:
          winner.pricePerBase > 0
            ? ((item.pricePerBase - winner.pricePerBase) / winner.pricePerBase) * 100
            : 0,
      })),
    })
  }

  // Las familias con mas productos primero: ahi esta la comparacion que al usuario le importa.
  result.sort((a, b) => b.items.length - a.items.length)
  return result
}
