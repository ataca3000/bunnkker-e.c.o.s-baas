import os

# Archivo final donde se consolidará todo tu avance
ARCHIVO_SALIDA = "COMPENDIO_EVOSTORE_COMPLETO.md"
# Carpeta principal que contiene toda tu ingeniería real
DIRECTORIO_RAIZ = "src"

contenido_md = f"""# 📚 COMPENDIO DE CÓDIGO FUENTE — EVOSTORE ERP
> Panorama técnico unificado de la lógica de negocio del sistema.
> Directorio analizado: /{DIRECTORIO_RAIZ}
---

"""

print("🚀 Iniciando el escaneo completo de la carpeta src...")

extensiones_validas = ('.ts', '.tsx', '.js', '.jsx', '.json', '.css')

if os.path.exists(DIRECTORIO_RAIZ):
    for raiz, dirs, archivos in os.walk(DIRECTORIO_RAIZ):
        for archivo in archivos:
            if archivo.endswith(extensiones_validas):
                ruta_completa = os.path.join(raiz, archivo)
                # Normalizar la ruta con slashes universales
                ruta_relativa = os.path.relpath(ruta_completa, os.path.dirname(DIRECTORIO_RAIZ)).replace('\\', '/')
                
                try:
                    with open(ruta_completa, "r", encoding="utf-8") as f:
                        codigo = f.read()
                    
                    # Determinar el lenguaje para el formateador de Markdown
                    ext = archivo.split('.')[-1]
                    lang = "typescript" if ext in ['ts', 'tsx'] else "javascript" if ext in ['js', 'jsx'] else ext
                    
                    # Estructurar el bloque en el documento maestro
                    contenido_md += f"## 📄 ARCHIVO: `{ruta_relativa}`\n\n"
                    contenido_md += f"```{lang}\n"
                    contenido_md += codigo.strip() + "\n"
                    contenido_md += "```\n\n---\n\n"
                    print(f"[🔹 Procesado]: {ruta_relativa}")
                    
                except Exception as e:
                    print(f"[⚠️ Error al leer {ruta_relativa}]: {str(e)}")

    # Escribir el compendio final en la raíz del proyecto
    with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f:
        f.write(contenido_md)
        
    print(f"\n[✅ Éxito]: Se ha generado el archivo '{ARCHIVO_SALIDA}' con todo tu código real.")
else:
    print(f"[🚫 Error]: No se encontró la carpeta '{DIRECTORIO_RAIZ}' en este directorio.")