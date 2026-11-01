import { describe, it, expect } from 'vitest'
import { parseNumber, parseQuantity, normalize, compare, FAMILIES } from './units.js'

describe('parseNumber', () => {
  it('lee enteros', () => {
    expect(parseNumber('450')).toBe(450)
  })

  it('lee punto decimal (convencion peruana)', () => {
    expect(parseNumber('3.20')).toBeCloseTo(3.2)
    expect(parseNumber('12.90')).toBeCloseTo(12.9)
  })

  it('tolera coma decimal, que la gente igual escribe', () => {
    expect(parseNumber('1,5')).toBeCloseTo(1.5)
  })

  it('trata 3 digitos tras el separador como miles', () => {
    expect(parseNumber('1,500')).toBe(1500)
    expect(parseNumber('1.500')).toBe(1500)
  })

  it('con ambos separadores, el de la derecha es el decimal', () => {
    expect(parseNumber('1,234.56')).toBeCloseTo(1234.56)
    expect(parseNumber('1.234,56')).toBeCloseTo(1234.56)
  })

  it('ignora el simbolo de soles y los espacios', () => {
    expect(parseNumber('S/ 3.20')).toBeCloseTo(3.2)
    expect(parseNumber('S/.12.90')).toBeCloseTo(12.9)
  })

  it('devuelve null con basura', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
  })
})

describe('parseQuantity', () => {
  it('lee peso con y sin espacio', () => {
    expect(parseQuantity('450 g')).toMatchObject({ family: FAMILIES.WEIGHT, totalInBase: 0.45 })
    expect(parseQuantity('450g')).toMatchObject({ totalInBase: 0.45 })
    expect(parseQuantity('385 gr')).toMatchObject({ totalInBase: 0.385 })
  })

  it('lee kilos', () => {
    expect(parseQuantity('1.5 kg')).toMatchObject({ family: FAMILIES.WEIGHT, totalInBase: 1.5 })
  })

  it('lee volumen', () => {
    expect(parseQuantity('970 ml')).toMatchObject({ family: FAMILIES.VOLUME, totalInBase: 0.97 })
    expect(parseQuantity('1.5 L')).toMatchObject({ family: FAMILIES.VOLUME, totalInBase: 1.5 })
    expect(parseQuantity('330 cc')).toMatchObject({ family: FAMILIES.VOLUME, totalInBase: 0.33 })
  })

  it('lee conteo y conserva el sustantivo como base', () => {
    expect(parseQuantity('12 rollos')).toMatchObject({
      family: FAMILIES.COUNT,
      base: 'rollo',
      totalInBase: 12,
    })
    expect(parseQuantity('6 sobres')).toMatchObject({ base: 'sobre', totalInBase: 6 })
  })

  it('un numero solo se asume conteo', () => {
    expect(parseQuantity('12')).toMatchObject({ family: FAMILIES.COUNT, totalInBase: 12 })
  })

  it('resuelve packs compuestos antes de dividir', () => {
    // 6 botellas de 350 ml = 2.1 L
    expect(parseQuantity('6 x 350 ml')).toMatchObject({ family: FAMILIES.VOLUME, totalInBase: 2.1 })
    expect(parseQuantity('6x350ml')).toMatchObject({ totalInBase: 2.1 })
    expect(parseQuantity('6 × 350 ml')).toMatchObject({ totalInBase: 2.1 })
  })

  it('tolera acentos y mayusculas', () => {
    expect(parseQuantity('10 CAPSULAS')).toMatchObject({ base: 'capsula', totalInBase: 10 })
    expect(parseQuantity('10 cápsulas')).toMatchObject({ base: 'capsula', totalInBase: 10 })
  })

  it('rechaza unidades desconocidas y cantidades invalidas', () => {
    expect(parseQuantity('450 xyz')).toBeNull()
    expect(parseQuantity('0 g')).toBeNull()
    expect(parseQuantity('')).toBeNull()
  })
})

describe('normalize', () => {
  it('normaliza hacia arriba, no hacia abajo', () => {
    // 450 g a S/ 3.20 -> S/ 7.11 por kg, NO S/ 0.0071 por gramo
    const r = normalize({ price: '3.20', quantity: '450 g' })
    expect(r.base).toBe('kg')
    expect(r.pricePerBase).toBeCloseTo(7.111, 2)
  })

  it('normaliza volumen a litro', () => {
    const r = normalize({ price: '4.50', quantity: '970 ml' })
    expect(r.base).toBe('L')
    expect(r.pricePerBase).toBeCloseTo(4.639, 2)
  })

  it('normaliza conteo al sustantivo', () => {
    const r = normalize({ price: '8.40', quantity: '12 rollos' })
    expect(r.base).toBe('rollo')
    expect(r.pricePerBase).toBeCloseTo(0.7, 3)
  })

  it('rechaza precio cero o ausente', () => {
    expect(normalize({ price: '0', quantity: '450 g' })).toBeNull()
    expect(normalize({ price: '', quantity: '450 g' })).toBeNull()
  })
})

describe('compare', () => {
  it('declara ganador por precio por unidad base, no por precio de etiqueta', () => {
    const groups = compare([
      { id: 'a', name: 'A', price: '3.20', quantity: '450 g' },  // 7.111 / kg
      { id: 'b', name: 'B', price: '6.50', quantity: '970 g' },  // 6.701 / kg
    ])
    expect(groups).toHaveLength(1)
    const [weight] = groups
    expect(weight.items[0].id).toBe('b')
    expect(weight.items[0].isWinner).toBe(true)
    // El mas barato en etiqueta (A, S/3.20) NO es el ganador.
    expect(weight.items[1].id).toBe('a')
  })

  it('calcula cuanto mas caro es cada uno contra el ganador', () => {
    const [group] = compare([
      { id: 'cheap', price: '10.00', quantity: '1 kg' },   // 10 / kg
      { id: 'pricey', price: '15.00', quantity: '1 kg' },  // 15 / kg -> 50% mas
    ])
    expect(group.items[0].extraCostPct).toBe(0)
    expect(group.items[1].extraCostPct).toBeCloseTo(50)
  })

  it('NO compara entre familias distintas', () => {
    const groups = compare([
      { id: 'w', price: '3.20', quantity: '450 g' },
      { id: 'v', price: '4.50', quantity: '970 ml' },
    ])
    expect(groups).toHaveLength(2)
    // Cada familia tiene su propio ganador; nadie gana contra la otra.
    for (const g of groups) {
      expect(g.items).toHaveLength(1)
      expect(g.items[0].isWinner).toBe(true)
    }
  })

  it('descarta productos ilegibles sin romper la comparacion', () => {
    const groups = compare([
      { id: 'ok', price: '10.00', quantity: '1 kg' },
      { id: 'roto', price: 'abc', quantity: 'xyz' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(1)
  })

  it('devuelve vacio sin productos', () => {
    expect(compare([])).toEqual([])
  })
})
