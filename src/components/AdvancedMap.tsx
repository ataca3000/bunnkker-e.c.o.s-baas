import dynamic from 'next/dynamic';

const AdvancedMap = dynamic(() => import('./AdvancedRouteMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: '0.5rem', color: '#94a3b8' }}>Cargando Mapa Avanzado...</div>
});

export default AdvancedMap;
