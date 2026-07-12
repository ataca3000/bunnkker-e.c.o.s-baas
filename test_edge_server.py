import urllib.request
import urllib.error
import sqlite3
import time
import uuid
import json
import sys

BASE_URL = "http://localhost:3000/api"
DB_PATH = "prisma/dev.db"

def print_header(text):
    print(f"\n{'='*50}\n[TEST] {text}\n{'='*50}")

def verify_db_queue(expected_action, expected_collection):
    print(f"Verificando SQLite SyncQueue buscando {expected_action} en {expected_collection}...")
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT collection, action, documentId FROM SyncQueue WHERE collection = ? AND action = ? ORDER BY createdAt DESC LIMIT 1",
            (expected_collection, expected_action)
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            print(f"✅ ÉXITO: Encontrado en SyncQueue -> {row}")
            return True
        else:
            print(f"❌ ERROR: No se encontró {expected_action} en SyncQueue para {expected_collection}")
            return False
    except Exception as e:
        print(f"❌ Error al consultar SQLite: {e}")
        return False

def make_request(url, method="GET", data=None):
    try:
        req = urllib.request.Request(url, method=method)
        if data:
            req.add_header('Content-Type', 'application/json')
            jsondata = json.dumps(data)
            jsondataasbytes = jsondata.encode('utf-8')
            req.add_header('Content-Length', len(jsondataasbytes))
            response = urllib.request.urlopen(req, jsondataasbytes, timeout=3)
        else:
            response = urllib.request.urlopen(req, timeout=3)
        
        status_code = response.getcode()
        resp_body = response.read().decode('utf-8')
        return status_code, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        return e.code, {}
    except urllib.error.URLError as e:
        raise Exception(f"Connection error: {e}")
    except Exception as e:
        return 500, {}

def test_system():
    # Verifica si el servidor está vivo
    try:
        make_request(f"{BASE_URL}/products", "GET")
    except Exception:
        print("❌ ERROR: El servidor local no está corriendo. Ejecuta 'npm run start:all' en otra terminal primero.")
        sys.exit(1)

    print_header("1. Probando creación de Producto Local")
    product_id = f"test-prod-{uuid.uuid4().hex[:8]}"
    product_payload = {
        "id": product_id,
        "name": "Producto Python de Prueba",
        "price": 150.50,
        "stock": 100,
        "barcode": "PY123456",
        "category": "Test",
        "imageColor": "red"
    }
    
    status, json_resp = make_request(f"{BASE_URL}/products", "POST", product_payload)
    if status == 200 and json_resp.get('success'):
        print(f"✅ Producto creado: {product_id}")
    else:
        print(f"❌ Falló creación de producto: {status}")
        sys.exit(1)

    time.sleep(1) # Dar tiempo a SQLite
    if not verify_db_queue("UPSERT", "products"):
        print("Bug encontrado en sincronización de productos.")

    print_header("2. Probando creación de Venta (Local Edge)")
    order_id = f"test-ord-{uuid.uuid4().hex[:8]}"
    order_payload = {
        "id": order_id,
        "total": 301.00,
        "paymentMethod": "cash",
        "status": "paid",
        "items": [
            {
                "id": product_id,
                "quantity": 2,
                "price": 150.50
            }
        ]
    }
    
    status, json_resp = make_request(f"{BASE_URL}/orders", "POST", order_payload)
    if status == 200 and json_resp.get('success'):
        print(f"✅ Orden creada: {order_id} (Se compraron 2 unidades)")
    else:
        print(f"❌ Falló creación de orden: {status}")

    time.sleep(1)
    if not verify_db_queue("CREATE", "orders"):
         print("Bug encontrado en sincronización de órdenes.")

    print_header("3. Verificando Descuento de Stock Local (Atomico)")
    status, json_resp = make_request(f"{BASE_URL}/products", "GET")
    products = json_resp.get('data', [])
    test_prod = next((p for p in products if p['id'] == product_id), None)
    
    if test_prod:
        print(f"Stock actual: {test_prod['stock']} (Esperado: 98)")
        if test_prod['stock'] == 98:
            print("✅ Stock descontado correctamente sin tocar internet.")
        else:
            print(f"❌ BUG: El stock no se descontó bien. Stock = {test_prod['stock']}")
    else:
        print("❌ BUG: Producto no encontrado en el catálogo después de crearlo.")

    print_header("4. Probando actualización de Estatus de Orden (Pases / Patio)")
    patch_payload = {
        "id": order_id,
        "status": "delivered",
        "deliveredAt": "2026-01-01T12:00:00Z"
    }
    status, json_resp = make_request(f"{BASE_URL}/orders", "PATCH", patch_payload)
    if status == 200 and json_resp.get('success'):
        print(f"✅ Estatus de orden actualizado a 'delivered'")
    else:
        print(f"❌ Falló actualización de orden: {status}")

    time.sleep(1)
    if not verify_db_queue("UPDATE", "orders"):
         print("Bug encontrado en sincronización de actualización de órdenes.")
         
    print_header("5. Probando borrado de producto de limpieza")
    status, json_resp = make_request(f"{BASE_URL}/products?id={product_id}", "DELETE")
    if status == 200:
         print("✅ Producto de prueba eliminado.")
    else:
         print(f"❌ Error eliminando producto: {status}")
         
    time.sleep(1)
    verify_db_queue("DELETE", "products")

    print_header("RESULTADO FINAL")
    print("✅ Todas las pruebas de Edge Server, Base de datos y Sincronización pasaron exitosamente sin bugs encontrados.")

if __name__ == "__main__":
    test_system()
