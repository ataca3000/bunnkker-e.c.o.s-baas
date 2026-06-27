import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBJ1opv0NzTWl3XILcno6Q7Eldj-2-0Sv8",
  authDomain: "admin-erp-pro-1.firebaseapp.com",
  projectId: "admin-erp-pro-1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usersToCreate = [
    { email: 'almacen1@empresa.com', role: 'inventory', name: 'Gestor Almacén' },
    { email: 'repartidor1@empresa.com', role: 'delivery', name: 'Repartidor' },
    { email: 'ventas1@empresa.com', role: 'sales', name: 'Ventas Demo' },
    { email: 'marketing1@empresa.com', role: 'marketing', name: 'Marketing Demo' },
    { email: 'nodo1@empresa.com', role: 'node', name: 'Nodo Básico' }
];

async function run() {
    console.log("Iniciando inyección de usuarios reales en Firebase...");
    for (const u of usersToCreate) {
        try {
            // Firebase exige mínimo 6 caracteres, así que usaremos 123456
            const userCredential = await createUserWithEmailAndPassword(auth, u.email, '123456');
            const uid = userCredential.user.uid;
            
            await setDoc(doc(db, 'users', uid), {
                email: u.email,
                role: u.role,
                tenantId: 'demo-tenant',
                displayName: u.name,
                password: 'Cambiar al entrar', 
                needsSetup: true,
                createdAt: new Date().toISOString()
            });
            console.log(`✅ Creado: ${u.email} (Rol: ${u.role})`);
        } catch (e) {
            console.error(`❌ Falló ${u.email}:`, e.message);
        }
    }
    console.log("Proceso completado. Ya puedes entrar con esos correos y contraseña 123456.");
    process.exit(0);
}

run();
