import dynamic from 'next/dynamic';

const AdvancedMap = dynamic(() => import('./AdvancedRouteMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', display: 'flex', font: 'sans-serif', fontSize: '0.8rem', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', borderRadius: '0.5rem', color: '#38bdf8' }}>Cargando Mapa de Rutas GPS...</div>
});

export default AdvancedMap;
