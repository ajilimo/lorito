import { describe, it, expect } from 'vitest'
import { extractFromText } from './ocr.js'

describe('extractFromText', () => {
  it('lee una etiqueta tipica peruana', () => {
    const r = extractFromText('ACEITE PRIMOR\nS/ 12.90\nBotella 900 ml')
    expect(r.price).toBe('12.9')
    expect(r.quantity).toBe('900 ml')
  })

  it('tolera el simbolo escrito como S/.', () => {
    const r = extractFromText('LECHE GLORIA S/. 4.50 400 g')
    expect(r.price).toBe('4.5')
    expect(r.quantity).toBe('400 g')
  })

  it('prefiere packs compuestos sobre la unidad suelta', () => {
    const r = extractFromText('GASEOSA 6 x 350 ml S/ 15.90')
    expect(r.quantity).toBe('6 x 350 ml')
    expect(r.price).toBe('15.9')
  })

  it('no confunde la cantidad con el precio', () => {
    // 1.50 kg es cantidad, 8.90 es precio.
    const r = extractFromText('ARROZ 1.50 kg 8.90')
    expect(r.quantity).toBe('1.50 kg')
    expect(r.price).toBe('8.9')
  })

  it('lee conteo', () => {
    const r = extractFromText('PAPEL HIGIENICO ELITE 12 rollos S/ 22.90')
    expect(r.quantity).toBe('12 rollos')
    expect(r.price).toBe('22.9')
  })

  it('devuelve campos vacios si no reconoce nada, sin lanzar', () => {
    const r = extractFromText('@@@ ???')
    expect(r.price).toBe('')
    expect(r.quantity).toBe('')
  })

  it('aguanta texto vacio o nulo', () => {
    expect(extractFromText('')).toMatchObject({ price: '', quantity: '' })
    expect(extractFromText(null)).toMatchObject({ price: '', quantity: '' })
  })

  it('tolera que el OCR lea la barra de S/ como pipe', () => {
    const r = extractFromText('ACEITE S| 12.90 900 ml')
    expect(r.price).toBe('12.9')
    expect(r.quantity).toBe('900 ml')
  })

  it('tolera que el OCR confunda la S con un 5', () => {
    const r = extractFromText('LECHE 5/ 4.50 400 g')
    expect(r.price).toBe('4.5')
  })

  it('reporta que campos encontro, para que la UI avise al usuario', () => {
    const r = extractFromText('S/ 9.90 500 g')
    expect(r.found).toContain('cantidad')
    expect(r.found.join(' ')).toMatch(/precio/)
  })
})
