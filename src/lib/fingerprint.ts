export const getDeviceFingerprint = (): string => {
    // Basic fingerprint using userAgent, screen res, and language
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const win = typeof window !== 'undefined' ? window : null;
    
    if (!nav || !win) return 'unknown_device';

    const userAgent = nav.userAgent || '';
    const language = nav.language || '';
    const screenW = win.screen?.width || '';
    const screenH = win.screen?.height || '';
    const colorDepth = win.screen?.colorDepth || '';

    const rawString = `${userAgent}-${language}-${screenW}x${screenH}-${colorDepth}`;
    
    // Simple hash function for the raw string
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
        const char = rawString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // Fallback to localStorage UUID to make it persistent even if browser updates slightly
    let persistentId = localStorage.getItem('bunkker_device_uuid');
    if (!persistentId) {
        persistentId = `DEV-${Math.abs(hash).toString(16)}-${Date.now().toString(36)}`;
        localStorage.setItem('bunkker_device_uuid', persistentId);
    }

    return persistentId;
};
