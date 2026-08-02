/**
 * OMNIPULSE — Motor de Despacho con Jitter de Humanización
 * POST /api/omnipulse/dispatch
 *
 * Recibe un postId y lista de accountIds, y los publica secuencialmente
 * en cada red social con un delay aleatorio entre publicaciones (jitter).
 * Actualiza el estado en tiempo real mediante Server-Sent Events.
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolveSpintax } from '@/lib/omnipulse/spintax';
import type { NetworkId, DispatchResult, DispatchStatus } from '@/lib/omnipulse/types';

const JITTER_MIN_MS = 4_000;
const JITTER_MAX_MS = 12_000;

function humanJitter(): number {
    return Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1)) + JITTER_MIN_MS;
}

// --- ALMACÉN DE RESULTADOS EN MEMORIA ---
// En prod: Prisma OmniDispatch + OmniLog
export const dispatchResults: Map<string, DispatchResult[]> = new Map();
export const postStore: Map<string, { body: string; hashtags: string; mediaUrls: string[]; useSpintax: boolean }> = new Map();

/**
 * Llama al adaptador correcto según la red social.
 * Cada adaptador encapsula la lógica de autenticación y publicación.
 */
async function publishToNetwork(
    network: NetworkId,
    text: string,
    mediaUrls: string[],
    token: string,
    channelId?: string
): Promise<{ success: boolean; externalId?: string; error?: string }> {

    const trimmedText = text.slice(0, getCharLimit(network));

    try {
        switch (network) {
            // ─── GRUPO B: Token Directo ────────────────────────────────────
            case 'telegram': {
                if (!channelId) return { success: false, error: 'Falta el ID del canal de Telegram' };
                const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: channelId, text: trimmedText, parse_mode: 'HTML' }),
                });
                const tgData = await tgRes.json();
                if (tgData.ok) return { success: true, externalId: String(tgData.result.message_id) };
                return { success: false, error: tgData.description };
            }

            case 'discord': {
                // token = Webhook URL completa de Discord
                const dcRes = await fetch(token, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: trimmedText }),
                });
                if (dcRes.ok) return { success: true, externalId: `discord_${Date.now()}` };
                const dcErr = await dcRes.text();
                return { success: false, error: dcErr };
            }

            // ─── GRUPO C: Protocolos Abiertos ─────────────────────────────
            case 'bluesky': {
                // token = "handle:password" o "handle:app_password"
                const [identifier, password] = token.split(':');
                const authRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password }),
                });
                if (!authRes.ok) return { success: false, error: 'Error de autenticación en Bluesky' };
                const { accessJwt, did } = await authRes.json();

                const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessJwt}` },
                    body: JSON.stringify({
                        repo: did,
                        collection: 'app.bsky.feed.post',
                        record: { text: trimmedText.slice(0, 300), createdAt: new Date().toISOString(), '$type': 'app.bsky.feed.post' },
                    }),
                });
                const bsData = await postRes.json();
                if (postRes.ok) return { success: true, externalId: bsData.uri };
                return { success: false, error: bsData.message };
            }

            case 'mastodon': {
                // token = "instance_url|access_token"  ej: "mastodon.social|abc123"
                const [instance, accessToken] = token.split('|');
                const mRes = await fetch(`https://${instance}/api/v1/statuses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({ status: trimmedText.slice(0, 500) }),
                });
                const mData = await mRes.json();
                if (mRes.ok) return { success: true, externalId: mData.id };
                return { success: false, error: mData.error };
            }

            // ─── GRUPO A / C: Simulación (requieren App OAuth) ────────────
            case 'facebook':
            case 'instagram':
            case 'threads':
            case 'linkedin_personal':
            case 'linkedin_company':
            case 'youtube':
            case 'pinterest':
            case 'twitter':
            case 'tiktok':
            case 'reddit':
            case 'whatsapp':
            case 'tumblr': {
                // SIMULACIÓN: en producción llaman a su respectiva API OAuth.
                // Aquí retornamos éxito simulado con el texto truncado.
                await new Promise(r => setTimeout(r, 800)); // Simular latencia de red
                const fakeId = `${network}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                return { success: true, externalId: fakeId };
            }

            default:
                return { success: false, error: `Red '${network}' no implementada aún` };
        }
    } catch (err: any) {
        return { success: false, error: err.message ?? 'Error de red desconocido' };
    }
}

function getCharLimit(network: NetworkId): number {
    const limits: Record<NetworkId, number> = {
        facebook: 63206, instagram: 2200, threads: 500, linkedin_personal: 3000,
        linkedin_company: 3000, youtube: 5000, pinterest: 500, telegram: 4096,
        discord: 2000, whatsapp: 65536, twitter: 280, tiktok: 2200,
        bluesky: 300, mastodon: 500, reddit: 40000, tumblr: 4096,
    };
    return limits[network] ?? 2000;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {
            postId: string;
            postBody: string;
            hashtags?: string;
            mediaUrls?: string[];
            useSpintax?: boolean;
            accounts: Array<{
                id: string;
                network: NetworkId;
                accountName: string;
                token: string;
                channelId?: string;
            }>;
        };

        if (!body.postId || !body.postBody || !body.accounts?.length) {
            return NextResponse.json({ error: 'Faltan campos: postId, postBody, accounts' }, { status: 400 });
        }

        const results: DispatchResult[] = body.accounts.map(acc => ({
            accountId: acc.id,
            network: acc.network,
            accountName: acc.accountName,
            status: 'pending' as DispatchStatus,
        }));

        dispatchResults.set(body.postId, results);

        // Despacho asíncrono (no bloqueamos la respuesta HTTP)
        (async () => {
            for (let i = 0; i < body.accounts.length; i++) {
                const acc = body.accounts[i];

                // Actualizar estado a 'publishing'
                const current = dispatchResults.get(body.postId) ?? [];
                const idx = current.findIndex(r => r.accountId === acc.id);
                if (idx >= 0) current[idx].status = 'publishing';
                dispatchResults.set(body.postId, current);

                // Resolver Spintax si aplica
                const rawText = body.postBody + (body.hashtags ? `\n\n${body.hashtags}` : '');
                const finalText = body.useSpintax ? resolveSpintax(rawText) : rawText;

                // Publicar
                const result = await publishToNetwork(
                    acc.network, finalText, body.mediaUrls ?? [], acc.token, acc.channelId
                );

                // Actualizar resultado
                const updated = dispatchResults.get(body.postId) ?? [];
                const updIdx = updated.findIndex(r => r.accountId === acc.id);
                if (updIdx >= 0) {
                    updated[updIdx] = {
                        ...updated[updIdx],
                        status: result.success ? 'success' : 'failed',
                        externalId: result.externalId,
                        errorMsg: result.error,
                        publishedAt: result.success ? new Date().toISOString() : undefined,
                    };
                }
                dispatchResults.set(body.postId, updated);

                // Jitter de Humanización entre publicaciones
                if (i < body.accounts.length - 1) {
                    await new Promise(r => setTimeout(r, humanJitter()));
                }
            }
        })();

        return NextResponse.json({
            postId: body.postId,
            message: `Despacho iniciado para ${body.accounts.length} cuentas`,
            status: 'dispatching',
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
