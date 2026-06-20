import dynamic from 'next/dynamic';

const Map = dynamic(() => import('./MapWithNoSSR'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: '1rem', color: '#94a3b8' }}>Cargando Mapa...</div>
});

export default Map;
