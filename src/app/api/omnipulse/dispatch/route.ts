/**
 * OMNIPULSE — Motor de Despacho con Jitter de Humanización
 * POST /api/omnipulse/dispatch
 *
 * Recibe un postId y lista de cuentas destino, resuelve tokens cifrados en BD
 * y publica vía API REST oficial en cada red sin simulaciones ficticias.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, requireRole } from '@/lib/apiAuth';
import { resolveSpintax } from '@/lib/omnipulse/spintax';
import type { NetworkId, DispatchResult, DispatchStatus } from '@/lib/omnipulse/types';
import { dispatchResults } from '@/lib/omnipulse/store';
import { getOmniAccountCredentials } from '@/lib/omnipulse/persistence';

const JITTER_MIN_MS = 4_000;
const JITTER_MAX_MS = 12_000;

function humanJitter(): number {
    return Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1)) + JITTER_MIN_MS;
}

/**
 * Llama al adaptador real de la red social.
 */
async function publishToNetwork(
    network: NetworkId,
    text: string,
    mediaUrls: string[],
    token: string,
    channelId?: string,
    accountId?: string
): Promise<{ success: boolean; externalId?: string; error?: string }> {
    const trimmedText = text.slice(0, getCharLimit(network));

    if (!token || !token.trim()) {
        return { success: false, error: 'Token de acceso no configurado o expirado' };
    }

    try {
        switch (network) {
            case 'telegram': {
                if (!channelId) return { success: false, error: 'Falta el ID del canal de Telegram' };
                if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
                    return { success: false, error: 'Token de Telegram con formato inválido' };
                }
                const safeChannelId = channelId.replace(/[^@a-zA-Z0-9_-]/g, '');
                const tgRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: safeChannelId, text: trimmedText, parse_mode: 'HTML' }),
                });
                const tgData = await tgRes.json();
                if (tgData.ok) return { success: true, externalId: String(tgData.result.message_id) };
                return { success: false, error: tgData.description || 'Error en API de Telegram' };
            }

            case 'discord': {
                try {
                    const parsed = new URL(token);
                    if (
                        (parsed.hostname !== 'discord.com' && parsed.hostname !== 'discordapp.com') ||
                        parsed.protocol !== 'https:' ||
                        !parsed.pathname.startsWith('/api/webhooks/')
                    ) {
                        return { success: false, error: 'URL de webhook de Discord inválida o no autorizada' };
                    }
                    const parts = parsed.pathname.split('/').filter(Boolean);
                    const webhookId = parts[2];
                    const webhookToken = parts[3];
                    if (!webhookId || !/^\d+$/.test(webhookId) || !webhookToken || !/^[A-Za-z0-9_-]+$/.test(webhookToken)) {
                        return { success: false, error: 'Identificadores de webhook de Discord inválidos' };
                    }
                    const safeDiscordUrl = `https://discord.com/api/webhooks/${encodeURIComponent(webhookId)}/${encodeURIComponent(webhookToken)}`;
                    const dcRes = await fetch(safeDiscordUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: trimmedText }),
                    });
                    if (dcRes.ok) return { success: true, externalId: `discord_${webhookId}_${Date.now()}` };
                    const dcErr = await dcRes.text();
                    return { success: false, error: dcErr || `HTTP ${dcRes.status}` };
                } catch {
                    return { success: false, error: 'URL de webhook de Discord malformada' };
                }
            }

            case 'bluesky': {
                const [identifier, password] = token.split(':');
                if (!identifier || !password) {
                    return { success: false, error: 'Formato Bluesky inválido. Usa usuario.bsky.social:app_password' };
                }
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
                        record: { text: trimmedText.slice(0, 300), createdAt: new Date().toISOString(), $type: 'app.bsky.feed.post' },
                    }),
                });
                const bsData = await postRes.json();
                if (postRes.ok) return { success: true, externalId: bsData.uri };
                return { success: false, error: bsData.message || 'Error publicando en Bluesky' };
            }

            case 'mastodon': {
                const [instance, accessToken] = token.split('|');
                if (!instance || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(instance)) {
                    return { success: false, error: 'Instancia de Mastodon inválida' };
                }
                const cleanInstance = instance.toLowerCase();
                const isPrivateIp = /^(?:10\.|127\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.|::1|fc00:|fe80:)/.test(cleanInstance);
                if (isPrivateIp || cleanInstance === 'localhost' || cleanInstance.endsWith('.local') || cleanInstance.endsWith('.internal')) {
                    return { success: false, error: 'Instancia de red privada no permitida' };
                }
                const safeToken = (accessToken || '').replace(/[^a-zA-Z0-9_-]/g, '');
                const mRes = await fetch(`https://${cleanInstance}/api/v1/statuses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${safeToken}` },
                    body: JSON.stringify({ status: trimmedText.slice(0, 500) }),
                });
                const mData = await mRes.json();
                if (mRes.ok) return { success: true, externalId: mData.id };
                return { success: false, error: mData.error || 'Error publicando en Mastodon' };
            }

            case 'facebook': {
                const [rawPageId, inlineToken] = token.includes('|') ? token.split('|') : [channelId || accountId, token];
                const pageId = (rawPageId || '').replace(/[^a-zA-Z0-9._-]/g, '');
                const pageToken = (inlineToken || token).trim();
                if (!pageId || !/^[a-zA-Z0-9._-]+$/.test(pageId)) {
                    return { success: false, error: 'Falta Page ID de Facebook (usa formato pageId|accessToken o ID Canal)' };
                }
                const fbRes = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/feed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pageToken}` },
                    body: JSON.stringify({ message: trimmedText }),
                });
                const fbData = await fbRes.json();
                if (fbRes.ok && fbData.id) return { success: true, externalId: String(fbData.id) };
                return { success: false, error: fbData?.error?.message || `Error Graph API Facebook (${fbRes.status})` };
            }

            case 'instagram': {
                const [rawIgId, inlineToken] = token.includes('|') ? token.split('|') : [channelId || accountId, token];
                const igUserId = (rawIgId || '').replace(/[^a-zA-Z0-9._-]/g, '');
                const igToken = (inlineToken || token).trim();
                const imageUrl = mediaUrls[0];
                if (!igUserId) {
                    return { success: false, error: 'Falta IG User ID (formato igUserId|accessToken)' };
                }
                if (!imageUrl) {
                    return { success: false, error: 'Instagram Graph API requiere una URL de imagen pública para publicar en el feed' };
                }
                const containerRes = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(igUserId)}/media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${igToken}` },
                    body: JSON.stringify({ image_url: imageUrl, caption: trimmedText }),
                });
                const containerData = await containerRes.json();
                if (!containerRes.ok || !containerData.id) {
                    return { success: false, error: containerData?.error?.message || 'Error creando contenedor de Instagram' };
                }
                const publishRes = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(igUserId)}/media_publish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${igToken}` },
                    body: JSON.stringify({ creation_id: containerData.id }),
                });
                const publishData = await publishRes.json();
                if (publishRes.ok && publishData.id) return { success: true, externalId: String(publishData.id) };
                return { success: false, error: publishData?.error?.message || 'Error publicando en Instagram' };
            }

            case 'whatsapp': {
                const [rawPhoneId, inlineToken] = token.includes('|') ? token.split('|') : [channelId, token];
                const phoneNumberId = (rawPhoneId || '').replace(/[^0-9]/g, '');
                const waToken = (inlineToken || token).trim();
                const recipient = (channelId || accountId || '').replace(/[^0-9]/g, '');
                if (!phoneNumberId || !recipient) {
                    return { success: false, error: 'WhatsApp Cloud API requiere phoneNumberId|token y teléfono destino en ID Canal' };
                }
                const waRes = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(phoneNumberId)}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: recipient,
                        type: 'text',
                        text: { body: trimmedText },
                    }),
                });
                const waData = await waRes.json();
                const msgId = waData?.messages?.[0]?.id;
                if (waRes.ok && msgId) return { success: true, externalId: String(msgId) };
                return { success: false, error: waData?.error?.message || 'Error en WhatsApp Cloud API' };
            }

            case 'twitter': {
                const twRes = await fetch('https://api.x.com/2/tweets', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token.trim()}`,
                    },
                    body: JSON.stringify({ text: trimmedText.slice(0, 280) }),
                });
                const twData = await twRes.json();
                if (twRes.ok && twData?.data?.id) return { success: true, externalId: String(twData.data.id) };
                return { success: false, error: twData?.detail || twData?.title || `Error X API (${twRes.status})` };
            }

            case 'linkedin_personal':
            case 'linkedin_company': {
                const [rawUrn, inlineToken] = token.includes('|') ? token.split('|') : [channelId || accountId, token];
                const liToken = (inlineToken || token).trim();
                if (!rawUrn) {
                    return { success: false, error: 'Falta URN de autor en LinkedIn (formato urn:li:person:ID|accessToken)' };
                }
                const author = rawUrn.startsWith('urn:li:')
                    ? rawUrn
                    : `${network === 'linkedin_company' ? 'urn:li:organization:' : 'urn:li:person:'}${rawUrn}`;
                const liRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${liToken}`,
                        'X-Restli-Protocol-Version': '2.0.0',
                    },
                    body: JSON.stringify({
                        author,
                        lifecycleState: 'PUBLISHED',
                        specificContent: {
                            'com.linkedin.ugc.ShareContent': {
                                shareCommentary: { text: trimmedText },
                                shareMediaCategory: 'NONE',
                            },
                        },
                        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
                    }),
                });
                if (liRes.ok) {
                    const postIdHeader = liRes.headers.get('x-restli-id') || `linkedin_${Date.now()}`;
                    return { success: true, externalId: postIdHeader };
                }
                const liErr = await liRes.json().catch(() => ({}));
                return { success: false, error: liErr?.message || `Error LinkedIn API (${liRes.status})` };
            }

            case 'threads':
            case 'youtube':
            case 'pinterest':
            case 'tiktok':
            case 'reddit':
            case 'tumblr':
                return {
                    success: false,
                    error: `${network} requiere vinculación OAuth 2.0 oficial aprobada para publicación directa.`,
                };

            default:
                return { success: false, error: `Red '${network}' no soportada` };
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
    const auth = requireRole(request, ['superadmin', 'admin', 'marketing']);
    if (!auth.ok) return auth.response;
    const tenantId = auth.tenantId || getTenantId(request);

    try {
        const body = (await request.json()) as {
            postId: string;
            postBody: string;
            hashtags?: string;
            mediaUrls?: string[];
            useSpintax?: boolean;
            accounts: Array<{
                id: string;
                network: NetworkId;
                accountName: string;
                token?: string;
                channelId?: string;
            }>;
        };

        if (!body.postId || !body.postBody || !body.accounts?.length) {
            return NextResponse.json({ error: 'Faltan campos: postId, postBody, accounts' }, { status: 400 });
        }

        const results: DispatchResult[] = body.accounts.map((acc) => ({
            accountId: acc.id,
            network: acc.network,
            accountName: acc.accountName,
            status: 'pending' as DispatchStatus,
        }));

        if (dispatchResults.size >= 200) {
            const oldestKey = dispatchResults.keys().next().value;
            if (oldestKey) dispatchResults.delete(oldestKey);
        }
        dispatchResults.set(body.postId, results);

        // Despacho asíncrono con tokens descifrados desde BD
        (async () => {
            for (let i = 0; i < body.accounts.length; i++) {
                const acc = body.accounts[i];

                const current = dispatchResults.get(body.postId) ?? [];
                const idx = current.findIndex((r) => r.accountId === acc.id);
                if (idx >= 0) current[idx].status = 'publishing';
                dispatchResults.set(body.postId, current);

                const storedCreds = await getOmniAccountCredentials(tenantId, acc.id);
                const resolvedToken = (acc.token && acc.token.trim()) || storedCreds?.token || '';
                const resolvedChannelId = acc.channelId || storedCreds?.channelId;
                const resolvedAccountId = storedCreds?.accountId;

                const rawText = body.postBody + (body.hashtags ? `\n\n${body.hashtags}` : '');
                const finalText = body.useSpintax ? resolveSpintax(rawText) : rawText;

                const result = await publishToNetwork(
                    acc.network,
                    finalText,
                    body.mediaUrls ?? [],
                    resolvedToken,
                    resolvedChannelId,
                    resolvedAccountId
                );

                const updated = dispatchResults.get(body.postId) ?? [];
                const updIdx = updated.findIndex((r) => r.accountId === acc.id);
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

                if (i < body.accounts.length - 1) {
                    await new Promise((r) => setTimeout(r, humanJitter()));
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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
