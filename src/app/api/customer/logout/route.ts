import { NextResponse } from 'next/server';

export async function POST() {
    const res = NextResponse.json({ success: true, message: 'Sesión cerrada correctamente' });
    const clearOpts = { path: '/', maxAge: 0, expires: new Date(0) };
    res.cookies.set('admincom_session', '', clearOpts);
    res.cookies.set('msj-session', '', clearOpts);
    res.cookies.set('msj-role', '', clearOpts);
    res.cookies.set('msj-role-sig', '', clearOpts);
    return res;
}
