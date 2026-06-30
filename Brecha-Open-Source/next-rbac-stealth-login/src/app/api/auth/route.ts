import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        // SIMULATED DATABASE CHECK
        // In a real app, query Firebase or your DB for the user's role
        let role = 'customer'; 
        if (email === 'admin@admin.com') role = 'superadmin';
        if (email === 'cajero@admin.com') role = 'employee';

        // STEALTH ROUTING LOGIC
        let redirectUrl = '/home'; // Default for normal customers

        if (role === 'superadmin') {
            redirectUrl = '/dashboard'; // Hidden admin panel
        } else if (role === 'employee') {
            redirectUrl = '/pos'; // Point of Sale
        }

        return NextResponse.json({ 
            success: true, 
            role: role,
            redirectTo: redirectUrl 
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
}
