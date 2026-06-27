import localtunnel from 'localtunnel';

export interface TunnelConfig {
    port: number;
    subdomain?: string;
    onUrlGenerated?: (url: string) => void;
    onClose?: () => void;
    onError?: (err: Error) => void;
}

export class BunkkerTunnel {
    private tunnel: localtunnel.Tunnel | null = null;
    private config: TunnelConfig;
    private reconnectTimer: NodeJS.Timeout | null = null;

    constructor(config: TunnelConfig) {
        this.config = config;
    }

    public async start(): Promise<string> {
        try {
            this.tunnel = await localtunnel({ 
                port: this.config.port, 
                subdomain: this.config.subdomain // Si se pasa, intentará reservar este subdominio
            });

            console.log(`🚀 [Bunkker Tunnel] Abierto en: ${this.tunnel.url}`);

            if (this.config.onUrlGenerated) {
                this.config.onUrlGenerated(this.tunnel.url);
            }

            this.tunnel.on('close', () => {
                console.warn("⚠️ [Bunkker Tunnel] Cerrado. Intentando reconectar...");
                if (this.config.onClose) this.config.onClose();
                this.scheduleReconnect();
            });

            this.tunnel.on('error', (err) => {
                console.error("❌ [Bunkker Tunnel] Error:", err);
                if (this.config.onError) this.config.onError(err);
                this.scheduleReconnect();
            });

            return this.tunnel.url;
        } catch (err: any) {
            console.error("❌ [Bunkker Tunnel] Fallo al iniciar:", err);
            this.scheduleReconnect();
            throw err;
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            try {
                await this.start();
            } catch (err) {
                // Reintentará automáticamente por el catch de start()
            }
        }, 10000); // Reintentar en 10 segundos
    }

    public close() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        if (this.tunnel) {
            this.tunnel.close();
            this.tunnel = null;
        }
    }
}
