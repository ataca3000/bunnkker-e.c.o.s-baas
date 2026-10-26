# Descubrimiento Técnico 001: Persistencia Local Atómica y Aritmética Libre de Deriva

## 1. Escrituras Atómicas en Disco (`src/lib/persistentSettings.ts`)
- **Hallazgo:** Para no depender de Firebase/Firestore cuando la tienda opera en modo LAN offline, los ajustes de la sucursal y la configuración de agentes IA se escriben atómicamente en `data/settings/{tenantId}.json`.
- **Mecanismo:** Se escribe primero en un archivo temporal (`.tmp`) con `fs.writeFileSync` y luego se realiza `fs.renameSync` atómico a nivel del sistema operativo. Esto garantiza cero corrupción de archivos incluso ante cortes de luz repentinos en el punto de venta.

## 2. Aritmética Monetaria en Centavos Enteros (`src/lib/financial.ts`)
- **Hallazgo:** JavaScript suma números de punto flotante binario con deriva IEEE-754 (`0.1 + 0.2 === 0.30000000000000004`).
- **Mecanismo:** Convertir siempre montos a centavos enteros con redondeo por épsilon (`Math.round((val + Number.EPSILON) * 100)`), realizar sumas y restas con números enteros, y dividir entre 100 solo para la salida final. Garantiza cero descuadres falsos en arqueos de caja.
