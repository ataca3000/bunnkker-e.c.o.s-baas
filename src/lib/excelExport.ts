// Utility para exportar tablas a Excel (.csv UTF-8 con BOM)

export function exportToExcel(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) {
    alert('No hay datos para exportar a Excel.');
    return;
  }

  // Extraer encabezados de las llaves del primer objeto
  const headers = Object.keys(rows[0]);
  
  // Mapear cada fila formateando cadenas con comillas
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      headers.map(header => {
        let val = row[header];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    )
  ].join('\r\n');

  // Agregar BOM (Byte Order Mark) \uFEFF para que Excel abra UTF-8 (acentos y ñs) correctamente
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
