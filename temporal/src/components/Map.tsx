import dynamic from 'next/dynamic';

const Map = dynamic(() => import('./MapWithNoSSR'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', display: 'flex', font: 'sans-serif', fontSize: '0.8rem', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', borderRadius: '1rem', color: '#38bdf8' }}>Cargando Mapa...</div>
});

export default Map;
