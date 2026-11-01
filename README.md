# Lorito

> Te canta el precio real. Compara productos de supermercado poniendo todo en la misma vara.

## El problema

En Perú no existe la obligación de mostrar el precio por unidad de medida en la etiqueta del
estante. Las marcas aprovechan eso: en lugar de presentaciones redondas (1 kg, 1 L) usan
tamaños irregulares — 450 g, 970 ml, 385 g — que hacen imposible comparar de cabeza dos
productos con cantidades y precios distintos.

Lorito hace esa cuenta.

## La regla central: normalizar hacia arriba

La conversión va **hacia la unidad entera**, no hacia la mínima.

| Producto | Etiqueta | Lorito muestra |
|---|---|---|
| Detergente A | 450 g — S/ 3.20 | S/ 7.11 / kg |
| Detergente B | 970 g — S/ 6.50 | **S/ 6.70 / kg** ← gana |
| Papel higiénico | 12 rollos — S/ 22.90 | S/ 1.91 / rollo |

El que cuesta la mitad en la etiqueta (A, S/ 3.20) es el caro. Ese es todo el punto.

Normalizar hacia abajo daría "S/ 0.0071 por gramo": decimales que nadie compara en un pasillo.
El valor de la herramienta no es convertir unidades, es poner todo en la misma escala.

## Familias de unidad

Tres, y no se mezclan entre sí:

| Familia | Unidad base | Ejemplos de etiqueta |
|---|---|---|
| Peso | por kg | `450 g`, `1.5 kg`, `385 gr` |
| Volumen | por L | `970 ml`, `1.5 L`, `330 cc` |
| Conteo | por unidad | `12 rollos`, `6 sobres`, `24 u` |

**Packs compuestos** se resuelven antes de dividir: `6 x 350 ml` → 2.1 L → precio por litro.

**Restricción de corrección:** comparar entre familias distintas no tiene sentido. 450 g contra
970 ml no se comparan. La lista agrupa por familia y no declara ganador entre familias.

En conteo la base conserva el sustantivo del usuario: "por rollo" dice más que "por unidad".

## Dos formas de entrada

**Manual (esqueleto).** Precio + cantidad. Siempre funciona, instantáneo, sin permisos.
Hay vista previa en vivo: ves el precio normalizado mientras escribes.

**OCR (acelerador).** Captura la etiqueta con la cámara y **pre-llena** el formulario. El
usuario confirma o corrige antes de que el producto entre a la lista. El OCR nunca decide en
silencio.

Esta jerarquía es deliberada: un escaneo fallido no bloquea a nadie, y la herramienta sirve
aunque el OCR acierte poco.

## Formato de números

Convención peruana: punto decimal, coma de miles, símbolo `S/`. El parser tolera que la gente
escriba coma decimal — `1,5` se lee como 1.5, pero `1,500` se lee como 1500 (tres dígitos tras
el separador indican miles).

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| UI | React + Vite | PWA instalable, un solo código |
| OCR | Tesseract.js | Corre en el navegador: sin API key, sin servidor, sin costo |
| Persistencia | `localStorage` | En el dispositivo, sin cuentas |
| Backend | Ninguno | Todo el cálculo es aritmética local |
| Hosting | GitHub Pages | Gratis en repo público, deploy automático |

**Costo de operación: cero.** Lo que cuesta dinero no es guardar, es *sincronizar*.

> Tesseract descarga su WASM y los datos del idioma desde CDN (varios MB) en el primer
> escaneo, así que esa primera vez necesita red. La entrada manual funciona siempre.

## Desarrollo

```bash
npm install
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

Los 32 tests cubren el motor de conversión y el parseo de etiquetas, que es donde el proyecto
se gana o se pierde.

## Fuera del alcance de la v1

Diferido por **complejidad de producto**, no por costo:

- **Historial de precios en el tiempo.** Abre preguntas que una herramienta de tres toques no
  debería hacer: qué guardar, por cuánto tiempo, en qué tienda, en qué fecha.
- **Sincronización y cuentas.** Único componente que realmente cuesta dinero.
- **OCR de alta precisión vía API de visión.** Candidato natural a función pagada, junto al
  historial.

La lista actual sí sobrevive a recargas, pero eso es durabilidad de sesión — no historial.
