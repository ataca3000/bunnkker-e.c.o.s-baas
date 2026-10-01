# Flujo de trabajo de producción

## Objetivo

Publicar BUNKKER E.C.O.S de forma repetible, auditable y reversible, manteniendo la operación local-first cuando la conectividad falle.

## Flujo de entrega

```mermaid
flowchart LR
  A[Branch de trabajo] --> B[Pull request]
  B --> C[Build + tests]
  C --> D[Preview Vercel]
  D --> E[Revisión funcional]
  E --> F[Aprobación explícita]
  F --> G[Deploy Production]
  G --> H[Smoke tests]
  H --> I[Monitoreo]
  H --> J[Rollback]
```

1. Crear una rama de trabajo; no publicar directamente en `main`.
2. Ejecutar `npm ci`, `npx prisma generate`, `npm run build` y las pruebas relevantes.
3. Abrir Preview y validar login, dashboard, APIs críticas y PWA.
4. Aprobar el cambio y promoverlo a Production desde Vercel.
5. Ejecutar smoke tests contra la URL de producción: página principal, login, dashboard protegido y APIs con autenticación.
6. Si un smoke test falla, revisar logs, congelar nuevas promociones y volver a la última versión estable.

## Variables y secretos

Configurar valores por entorno en Vercel. Nunca incluir secretos en Git, documentación, logs o respuestas API. La aplicación usa, según el módulo habilitado, `DATABASE_URL`, configuración Firebase, `INTERNAL_API_SECRET` y variables públicas `NEXT_PUBLIC_*`. Verificar nombres y disponibilidad desde la sección Vars antes de promover.

## Flujo operativo local-first y Ciclo de Vida del Pedido (AXIOM_15)

```mermaid
sequenceDiagram
  participant C as Cliente / Mostrador
  participant B as SQLite Central (WAL)
  participant P as Pizarrón Público (Patio/Caja/Ruta)
  participant W as Operador (Patio/Chofer/Caja)
  participant E as OrderEvent (Inmutable)

  C->>B: Genera Pedido (Caja, Patio o Reparto)
  Note over C,B: Timeout fusible 1.5s evita cuelgues
  B->>E: Crea evento 'ORDER_CREATED' con hash
  B->>P: Publica orden en Pizarrón correspondiente
  W->>B: Claim / Reclamo exclusivo de orden
  B->>E: Registra 'ORDER_CLAIMED' (Actor + Rol)
  Note over P: Orden bloqueada para otros compañeros
  W->>B: Preparación / Carga concluida
  B->>E: Registra 'ORDER_PREPARED'
  W->>C: Entrega física (Foto + Firma + Pase QR)
  W->>B: Cierre y validación de entrega
  B->>E: Registra 'ORDER_DELIVERED' (Foto URL + Firma Base64)
```

- **Base Central Única (SQLite con WAL):** Evita inconsistencias de múltiples bases descoordinadas. Todo terminal (caja, patio, chofer) apunta a la misma base central vía red LAN local.
- **3 Métodos de Entrega Especializados:**
  1. `📦 PISO / CAJA` (`deliveryType: 'LOCAL' | 'pickup'`): Entrega y cobro inmediato en mostrador.
  2. `🏗️ CARGA / PATIO` (`deliveryType: 'PATIO'`): Despacho de bultos o materiales pesados en patio de maniobras.
  3. `🛵 REPARTIDOR / OBRA` (`deliveryType: 'DELIVERY' | 'repartidor'`): Asignación a choferes para reparto en ruta con geolocalización.
- **Lock-Claim Exclusivo:** En cuanto un operador toma una orden desde la pizarra pública, se bloquea para el resto del equipo evitando dobles despachos o confusiones.
- **Trazabilidad Inmutable (`OrderEvent`):** Cada transición de estado queda registrada con `orderId`, `eventType`, `fromStatus`, `toStatus`, `actorId`, `actorName`, `actorRole`, `details`, y `createdAt`. Incluye evidencia física de foto y firma digital.
- **Timeout Fusible en Mostrador:** El proceso de checkout no se congela ante fluctuaciones de Wi-Fi local; un límite de 1,500 ms asegura el paso fluido a la confirmación de la orden.

## Rollback y recuperación

- Identificar la versión estable anterior en Vercel.
- Promover esa versión o usar rollback del proyecto.
- Revisar logs de runtime y errores de sincronización.
- Reprocesar únicamente eventos WAL pendientes e idempotentes.
- Documentar causa, impacto y corrección en el pull request.

## Límites actuales

`/api/deploy` registra un tenant en Firestore y devuelve parámetros simulados; no crea proyectos Vercel, contenedores, DNS ni puertos públicos. Cualquier aprovisionamiento real debe implementarse con una integración autorizada y controles de idempotencia, permisos y auditoría.

## Checklist de salida

- [ ] Build de producción exitoso.
- [ ] Prisma Client generado.
- [ ] Variables de producción verificadas.
- [ ] Preview revisada en escritorio y móvil.
- [ ] Smoke tests ejecutados.
- [ ] Logs sin errores críticos.
- [ ] Plan de rollback identificado.
- [ ] Documentación actualizada.

## Arquitectura de referencia

La arquitectura técnica y sus responsabilidades están documentadas en [`ARCHITECTURE.md`](./ARCHITECTURE.md).
