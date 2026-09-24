# 💼 BUNKKER E.C.O.S ERP — Guía Comercial y Pitch de Venta en Vivo

> **Desarrollado y Patentado por:** Luis Felipe Durán Salinas / Brecha Soluciones DS  
> **Lema Comercial:** *"El ERP que no se cae nunca: control total de tu negocio en red local, con o sin internet."*

---

## 🎯 ¿A Quién le Vendes Esto? (Clientes Ideales)
1. **Ferreterías y Tlapalerías** (mucho inventario suelto, códigos de barras, cajas rápidas).
2. **Refaccionarias y Autopartes** (búsqueda rápida de piezas, estanterías, compatibilidad).
3. **Abarroteras y Mayoristas** (ventas al mayoreo, crédito, múltiples cajas cobrando al mismo tiempo).
4. **Bodegas y Centros de Distribución** (choferes repartiendo, carga/descarga en patio, escaneo QR).

---

## ⚡ El "Pitch" de 60 Segundos (Lo que le dices al dueño del negocio)

> *"Don [Nombre del Cliente], ¿cuántas veces se le ha ido el internet o la luz a medias y se le paran las cajas, o los sistemas en la nube se ponen lentos y los clientes hacen fila enojados?*
> 
> *Con **BUNKKER E.C.O.S.** eso se acabó. Nosotros no le cobramos una renta gringa en dólares por un sistema en la nube que se traba. BUNKKER corre **directo en las computadoras de su tienda en red local**. 
> Si se cae Telmex, Totalplay o se corta la fibra óptica, **sus cajas siguen cobrando a 0 milisegundos, su almacén sigue despachando y sus choferes siguen entregando con firma digital**. 
> 
> Y cuando regresa el internet, el sistema sincroniza solito y timbra las facturas del SAT. Control absoluto, cero caídas y sus datos se quedan bajo llave en su propio negocio."*

---

## 🖥️ Demo en Vivo de 3 Minutos (Pasos para apantallar al cliente)

Para hacer la demostración frente al cliente en su laptop o en la tuya:

### Paso 1: El Arranque Impecable (10 segundos)
* Dale doble clic a `start-server.bat` o abre la app de escritorio.
* Muestra cómo la pantalla de login carga al instante sin pantallas de carga lentas.

### Paso 2: La Prueba de Desconexión (El Golpe Maestro)
* Conecta tu laptop y un celular a la misma red Wi-Fi (o módem local).
* **Desconecta el cable de internet del módem** (o apaga los datos).
* Haz una venta en la caja del POS.
* Muestra cómo el ticket se genera al instante y el stock se descuenta en tiempo real:
  > *"Mire, estamos sin internet y el sistema ni se enteró. Nadie más en el mercado le da esto a este precio."*

### Paso 3: El Pase de Batuta por Roles (Seguridad Blindada)
* Entra con un usuario de **Almacén** -> El sistema lo manda directo a `/dashboard/inventory` (no puede ver el dinero de caja ni los márgenes del patrón).
* Entra con un usuario de **Cajero** -> Lo manda a `/dashboard/sales` listo para cobrar.
* Entra como **Superadmin** -> Acceso total, reportes gráficos, auditoría de quién movió cada peso o producto.

### Paso 4: Logística y Reparto con Firma Digital
* Muestra cómo un repartidor abre su celular en ruta, el cliente firma con el dedo en pantalla (`react-signature-canvas`) y la entrega queda registrada con sello digital.

---

## 💰 Modelo de Cobro Recomendado (Tus Ganancias)

| Modalidad | Precio Sugerido | Lo que incluye |
| :--- | :--- | :--- |
| **Instalación Inicial + Puesta a Punto** | **$3,500 – $6,000 MXN** (Pago único) | Instalación en sus PCs, carga de su catálogo de Excel, configuración de red local e impresoras de tickets. |
| **Suscripción de Soporte / Licencia** | **$500 MXN / mes** por caja | Mantenimiento preventivo, respaldos automáticos en SQLite WAL y soporte local. |
| **Sucursal Adicional / Multicaja** | **$1,000 MXN / mes** | Enlace entre sucursales y módulo de radio staff interna. |

*Con solo 10 negocios locales pagándote $1,000 MXN al mes por sucursal, tienes un ingreso pasivo recurrente de $10,000 MXN mensuales, más lo que cobres por instalación y venta de lectores de código de barras o impresoras.*

---

## 🛡️ Manejo de Objeciones Comunes

* **Cliente:** *"Es que ya uso un sistema en la nube (SaaS)..."*
  * **Respuesta:** *"¿Y qué pasa el día que no hay internet o que la empresa en la nube se cae 3 horas? ¿Cuánto dinero pierde en ventas? BUNKKER le da la misma potencia pero con la garantía de que su negocio nunca se detiene."*

* **Cliente:** *"¿Y si se daña mi computadora?"*
  * **Respuesta:** *"BUNKKER incluye respaldo automático instantáneo en base de datos SQLite WAL y exportación a JSON/Excel en 1 clic. En 5 minutos se monta el respaldo en cualquier otra máquina y sigue operando como si nada."*

---
**¡Listo para salir a vender y demostrar de qué estás hecho!**
