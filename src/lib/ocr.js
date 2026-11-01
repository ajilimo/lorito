// OCR como ACELERADOR, no como requisito.
//
// Esta capa solo PRE-LLENA el formulario manual. Nunca decide en silencio:
// el usuario confirma o corrige antes de que el producto entre a la lista.
// Por eso un escaneo malo degrada la experiencia pero no bloquea la herramienta.

import { lookupUnit, parseNumber } from './units.js'

// Una foto de celular ronda los 4000x3000. Pasarle eso a Tesseract en el CPU
// de un movil tarda una eternidad; a 1600 px el borde largo el texto de una
// etiqueta sigue siendo legible y el reconocimiento baja de minutos a segundos.
const MAX_EDGE = 1600

// Techo duro: pase lo que pase, el usuario recupera el control.
const SCAN_TIMEOUT_MS = 90000

let workerPromise = null
let activeProgress = null

// Tesseract reporta sus fases en ingles; las traducimos para que el usuario
// sepa si esta descargando (primera vez, varios MB) o ya leyendo.
const PHASES = {
  'loading tesseract core': 'descargando motor',
  'initializing tesseract': 'iniciando motor',
  'loading language traineddata': 'descargando idioma',
  'initializing api': 'preparando',
  'recognizing text': 'leyendo',
}

function report(status, progress) {
  if (!activeProgress) return
  activeProgress({
    phase: PHASES[status] ?? status,
    pct: Math.round((progress ?? 0) * 100),
  })
}

/**
 * Tesseract se carga perezosamente: su WASM y los datos del idioma pesan varios
 * MB y vienen de CDN, asi que no se descargan hasta el primer escaneo.
 *
 * Usamos 'eng' y no 'spa' a proposito: de la etiqueta solo extraemos cifras y
 * abreviaturas de unidad (g, ml, kg), nunca prosa. El paquete ingles es mas
 * liviano de descargar y lee los digitos igual de bien.
 */
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker('eng', 1, { logger: (m) => report(m.status, m.progress) })
    })().catch((err) => {
      workerPromise = null // permite reintentar tras un fallo de red
      throw err
    })
  }
  return workerPromise
}

/** Corta el escaneo en curso y libera el worker. */
export async function cancelScan() {
  const pending = workerPromise
  workerPromise = null
  activeProgress = null
  try {
    const worker = await pending
    await worker?.terminate()
  } catch {
    // Si ni siquiera llego a crearse, no hay nada que terminar.
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

/** Reduce la imagen antes del OCR. Si algo falla, devuelve el original. */
async function downscale(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    if (longest <= MAX_EDGE) {
      bitmap.close?.()
      return file
    }
    const scale = MAX_EDGE / longest
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
    return blob ?? file
  } catch {
    return file
  }
}

const UNIT_WORD = '(?:kgs?|kilos?|kilogramos?|gr?s?|gramos?|mls?|cc|mililitros?|lts?|l|litros?|u|un|und|unid|unidad(?:es)?|pzas?|piezas?|rollos?|sobres?|bolsitas?|c[aá]psulas?|tabletas?)'

/**
 * Extrae precio y cantidad del texto crudo del OCR.
 * Devuelve { price, quantity, found } con strings listos para el formulario.
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
  //    El OCR confunde la barra con | y la S con 5, asi que toleramos ambas.
  let price = ''
  const withSymbol = flat.match(/[s5]\s*[/|]\s*\.?\s*(\d+(?:[.,]\d{1,2})?)/i)
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
  activeProgress = onProgress
  try {
    if (onProgress) onProgress({ phase: 'preparando foto', pct: 0 })
    const image = await downscale(file)
    const worker = await getWorker()
    const { data } = await withTimeout(worker.recognize(image), SCAN_TIMEOUT_MS)
    const fields = extractFromText(data.text)
    return { ...fields, rawText: data.text, confidence: data.confidence }
  } finally {
    activeProgress = null
  }
}
