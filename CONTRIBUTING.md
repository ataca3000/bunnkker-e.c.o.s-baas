# Guía de Contribución

¡Gracias por tu interés en contribuir a **BUNKKER E.C.O.S ERP**!

## Estándares de Código

### TypeScript

- Usamos **Strict Type Checking**. Evita el uso de `any` siempre que sea posible.
- Define interfaces para todos los modelos de datos en `/src/types` o junto al componente si es local.

### Estilos

- Preferimos **CSS Modules** o Tailwind CSS (en migración) sobre estilos en línea.
- Mantén la consistencia visual siguiendo la paleta de colores definida en `layout.tsx`.

## Flujo de Trabajo (Git Flow)

1. Haz un Fork del repositorio.
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`).
3. Realiza tus cambios y haz commit (`git commit -m 'feat: Agrega nueva funcionalidad'`).
4. Haz push a la rama (`git push origin feature/nueva-funcionalidad`).
5. Abre un Pull Request.

## Reporte de Bugs

Si encuentras un error, por favor abre un issue describiendo:

- Pasos para reproducir.
- Comportamiento esperado vs. real.
- Capturas de pantalla (si aplica).

---
*Equipo de Desarrollo BUNKKER E.C.O.S ERP*
