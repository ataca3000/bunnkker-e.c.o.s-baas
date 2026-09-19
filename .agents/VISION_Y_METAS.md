# MEMORIA DE LARGO PLAZO (VISIÓN Y METAS)

Esta es la brújula del proyecto. Sirve para evitar desviaciones y asegurar que todo parche o módulo nuevo sirva al objetivo final.

## 🎯 Objetivo Principal (Visión)
Transformar el ERP BUNKKER en una "Colmena B2B" (Arquitectura Local-First), donde el `.exe` sea el motor principal, impulsado por Inteligencia Artificial Local (Basada en Tópicos), y que se comunique mediante una red P2P (Túneles) para sincronizar tiendas sin depender de un servidor central en la nube.

## 🚀 Metas de Alto Nivel (Future Functions)

- [ ] **M1: Autonomía Total (Desacoplamiento Nube)**
  - Reemplazar funciones de Firebase por "Cápsulas Mock" (Logrado parcialmente).
  - Usar base de datos basada en Tópicos y Archivos Excel locales.
- [ ] **M2: La Colmena (Red B2B P2P)**
  - Expandir el túnel local para interconectar más de 32 nodos.
  - Implementar "Consultas Scraper": los nodos se preguntan stock entre sí sin compartir DB completa.
  - Ocultar tráfico B2B (Estrategia Zero-Rating / Portales cautivos).
- [ ] **M3: IA Edge de Tópicos (Asistencia)**
  - Integrar motor de IA basado en `unsupervised_topic_modeling-master`.
  - Configurar Asistentes (Caja, Clientes, Delivery, Admin) en modo de *Solo Lectura* y recomendación.
- [ ] **M4: Licenciamiento Remoto y Actualizaciones P2P**
  - Crear un Agente Actualizador que reciba parches por el túnel.
  - Script remoto de bloqueo/desbloqueo de licencias a la escucha.

## 🔄 Estado Actual (Memoria de Corto Plazo)
- **Fase:** Rompiendo la dependencia de la nube sin dañar la UI.
- **Acción actual:** Engañando al sistema con el Firebase Mock y construyendo el árbol de memoria espejo (`lfeds/`) para evitar quemar cuotas de IA.
