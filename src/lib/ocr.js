// OCR como ACELERADOR, no como requisito.
//
// Esta capa solo PRE-LLENA el formulario manual. Nunca decide en silencio:
// el usuario confirma o corrige antes de que el producto entre a la lista.
// Por eso un escaneo malo degrada la experiencia pero no bloquea la herramienta.

import { lookupUnit, parseNumber } from './units.js'

let workerPromise = null

/**
 * Tesseract se carga perezosamente: su WASM y los datos del idioma pesan varios MB
 * y vienen de CDN, asi que no se descargan hasta el primer escaneo.
 */
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('spa')
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789.,/SsXx×ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
      })
      return worker
    })()
  }
  return workerPromise
}

const UNIT_WORD = '(?:kgs?|kilos?|kilogramos?|gr?s?|gramos?|mls?|cc|mililitros?|lts?|l|litros?|u|un|und|unid|unidad(?:es)?|pzas?|piezas?|rollos?|sobres?|bolsitas?|c[aá]psulas?|tabletas?)'

/**
 * Extrae precio y cantidad del texto crudo del OCR.
 * Devuelve { price, quantity, confidence } con strings listos para el formulario.
 */
export function extractFromText(raw) {
  const text = String(raw || '').replace(/\n+/g, ' \n ')
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return { price: '', quantity: '', found: [] }

  const found = []

  // --- Cantidad ---
  // Primero packs compuestos ("6 x 350 ml"), que son los que mas se malinterpretan.
  let quantity = ''
  const packRe = new RegExp(`(\\d+)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_WORD})\\b`, 'i')
  const packMatch = flat.match(packRe)
  if (packMatch) {
    quantity = `${packMatch[1]} x ${packMatch[2]} ${packMatch[3]}`
    found.push('pack')
  } else {
    const qtyRe = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_WORD})\\b`, 'i')
    const qtyMatch = flat.match(qtyRe)
    if (qtyMatch && lookupUnit(qtyMatch[2])) {
      quantity = `${qtyMatch[1]} ${qtyMatch[2]}`
      found.push('cantidad')
    }
  }

  // --- Precio ---
  // 1) Con simbolo de soles: la senal mas fuerte en una etiqueta peruana.
  let price = ''
  const withSymbol = flat.match(/s\s*\/\s*\.?\s*(\d+(?:[.,]\d{1,2})?)/i)
  if (withSymbol) {
    price = String(parseNumber(withSymbol[1]) ?? '')
    found.push('precio (S/)')
  } else {
    // 2) Si no, un numero con 2 decimales que NO sea la cantidad.
    const unitTail = new RegExp(`^\\s*${UNIT_WORD}\\b`, 'i')
    const candidates = []
    const re = /(\d+[.,]\d{2})(?!\d)/g
    let m
    while ((m = re.exec(flat)) !== null) {
      const tail = flat.slice(m.index + m[0].length)
      if (unitTail.test(tail)) continue // es cantidad, no precio
      const n = parseNumber(m[1])
      if (n != null && n > 0) candidates.push(n)
    }
    if (candidates.length) {
      // En un estante el precio suele ser la cifra mas prominente; con empates
      // de formato, la mayor es la apuesta mas segura.
      price = String(Math.max(...candidates))
      found.push('precio')
    }
  }

  return { price, quantity, found }
}

/** Corre el OCR sobre un File/Blob y devuelve los campos sugeridos. */
export async function scanLabel(file, onProgress) {
  const worker = await getWorker()
  if (onProgress) onProgress('leyendo')
  const { data } = await worker.recognize(file)
  const fields = extractFromText(data.text)
  return { ...fields, rawText: data.text, confidence: data.confidence }
}
