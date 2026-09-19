/**
 * BUNKKER — Pagina de Tienda Incorrecta
 * Se muestra cuando el storeId del QR no coincide con esta instancia.
 * Disenio limpio, sin detalles tecnicos, instruccion clara para el usuario.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Acceso no disponible | Bunkker",
    robots: { index: false, follow: false },
};

export default function TiendaIncorrectaPage() {
    return (
        <main style={{
            minHeight: "100vh",
            background: "#020617",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            fontFamily: "system-ui, sans-serif",
        }}>
            <div style={{
                maxWidth: "420px",
                width: "100%",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                alignItems: "center",
            }}>
                {/* Icono */}
                <div style={{
                    fontSize: "4rem",
                    lineHeight: 1,
                    filter: "grayscale(0.3)",
                }}>
                    🔒
                </div>

                {/* Titulo */}
                <h1 style={{
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    color: "#f1f5f9",
                    margin: 0,
                    lineHeight: 1.3,
                }}>
                    Este acceso no esta disponible en este dispositivo
                </h1>

                {/* Descripcion */}
                <p style={{
                    fontSize: "0.9rem",
                    color: "#64748b",
                    margin: 0,
                    lineHeight: 1.7,
                }}>
                    El codigo QR que escaneaste corresponde a una tienda diferente.
                    Cada tienda opera de forma independiente en su propio dispositivo.
                </p>

                {/* Separador */}
                <div style={{
                    width: "40px",
                    height: "2px",
                    background: "rgba(99,102,241,0.4)",
                    borderRadius: "99px",
                }} />

                {/* Instruccion */}
                <p style={{
                    fontSize: "0.85rem",
                    color: "#475569",
                    margin: 0,
                    lineHeight: 1.6,
                }}>
                    📱 Solicita el codigo QR correcto al encargado de esta tienda
                    y escanea nuevamente.
                </p>

                {/* Badge */}
                <div style={{
                    marginTop: "0.5rem",
                    padding: "0.4rem 0.9rem",
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.15)",
                    borderRadius: "99px",
                    fontSize: "0.72rem",
                    color: "#6366f1",
                    letterSpacing: "0.05em",
                    fontWeight: 600,
                    textTransform: "uppercase",
                }}>
                    Bunkker E.C.O.S.
                </div>
            </div>
        </main>
    );
}
