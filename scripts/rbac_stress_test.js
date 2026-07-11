import http from 'k6/http';
import { check, group, sleep } from 'k6';

// Configuración de la prueba de estrés "Sin Piedad" (Concurrencia extrema y ataques cruzados)
export let options = {
  stages: [
    { duration: '15s', target: 100 },   // Escalado ultra rápido a 100 usuarios
    { duration: '30s', target: 500 },   // Subida de presión a 500 usuarios
    { duration: '1m30s', target: 1000 }, // Pico extremo de 1000 usuarios concurrentes
    { duration: '15s', target: 0 },     // Bajada rápida
  ],
  thresholds: {
    // 95% de las solicitudes deben ser respondidas en menos de 400ms
    http_req_duration: ['p(95)<400'],
  },
};

const BASE_URL = 'http://localhost:3000';

const roles = [
  { name: 'inventory', path: '/dashboard/inventory' },
  { name: 'sales', path: '/dashboard/sales' },
  { name: 'billing', path: '/dashboard/audit' },
  { name: 'driver', path: '/dashboard/patio' },
  { name: 'marketing', path: '/dashboard/marketing' },
  { name: 'superadmin', path: '/dashboard/users' },
];

export default function () {
  // Distribución aleatoria de acciones por iteración
  const rand = Math.random();

  if (rand < 0.60) {
    // --- GRUPO 1: TRÁFICO NORMAL Y REDIRECCIONES CORRECTAS (60%) ---
    group('Acceso Autorizado y Redirecciones', function () {
      const role = roles[Math.floor(Math.random() * roles.length)];
      
      // Simular llamadas al middleware /dashboard con la cookie de rol
      const res = http.get(`${BASE_URL}/dashboard`, {
        headers: { 
          'Cookie': `msj-session=user-123; msj-role=${role.name}; msj-role-sig=mock-sig; msj-worker-vip=10.240.1.1; msj-worker-vip-sig=mock-vip-sig`,
          'Host': 'localhost:3000'
        },
        redirects: 0, // No seguir redirecciones para verificar código 307
      });

      check(res, {
        'Status de redireccion o exito': (r) => r.status === 307 || (role.name === 'superadmin' && r.status === 200),
      });
    });

  } else if (rand < 0.80) {
    // --- GRUPO 2: ATAQUE DE FUERZA BRUTA A LOGIN (20%) ---
    group('Simulación de Ataque Fuerza Bruta', function () {
      const payload = JSON.stringify({
        pin: '9999', // PIN incorrecto
        deviceId: 'stress-test-device'
      });

      const params = {
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `192.168.stress.${Math.floor(Math.random() * 50)}` // IP variable para no bloquear toda la red
        },
      };

      const res = http.post(`${BASE_URL}/api/auth/session`, payload, params);

      check(res, {
        'PIN incorrecto bloqueado (401 o 429)': (r) => r.status === 401 || r.status === 429,
      });
    });

  } else if (rand < 0.90) {
    // --- GRUPO 3: INTENTOS DE INTRUSIÓN (10%) ---
    group('Intentos de Intrusión (Acceso no Autorizado)', function () {
      // Intentar acceder a secciones de admin con rol de inventario
      const res = http.get(`${BASE_URL}/dashboard/users`, {
        headers: { 
          'Cookie': 'msj-session=user-123; msj-role=inventory; msj-role-sig=mock-sig',
          'Host': 'localhost:3000'
        },
        redirects: 0,
      });

      check(res, {
        'Acceso denegado (Redirigido a catalogo/login)': (r) => r.status === 307,
      });
    });

  } else {
    // --- GRUPO 4: ACCESO ANÓNIMO A RUTA PROTEGIDA (10%) ---
    group('Acceso Anónimo a Dashboard', function () {
      const res = http.get(`${BASE_URL}/dashboard`, {
        headers: { 'Host': 'localhost:3000' },
        redirects: 0,
      });

      check(res, {
        'Usuario anonimo redirigido a login': (r) => r.status === 307,
      });
    });
  }

  sleep(0.5); // Espera de 500ms entre solicitudes por usuario virtual
}
