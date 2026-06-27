import { config } from 'dotenv';
config({ path: '.env.local' });
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection } from "firebase/firestore";

// Configuración leída de .env
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

import { fallbackProducts, defaultSiteConfig } from "./src/store/useERPStore";

async function seed() {
  console.log("Iniciando sembrado de Ferretería en Firestore...");
  
  // 1. Escribir productos
  const productsRef = collection(db, "products");
  for (const p of fallbackProducts) {
    await setDoc(doc(productsRef, p.id), p);
    console.log(`Producto ${p.name} insertado.`);
  }

  // 2. Escribir configuración
  await setDoc(doc(db, "settings", "site_config"), defaultSiteConfig);
  console.log("Configuración del sitio de Ferretería insertada.");

  console.log("¡Sembrado completado con éxito!");
  process.exit(0);
}

seed().catch(console.error);
