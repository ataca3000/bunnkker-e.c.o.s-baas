import dynamic from 'next/dynamic';

const AdminRadarMap = dynamic(() => import('./AdminRadarMap'), {
    ssr: false,
    loading: () => <div style={{ height: '500px', width: '100%', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', borderRadius: '12px' }}>Cargando Radar Global...</div>
});

export default AdminRadarMap;
