const fs = require('fs');

const content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf-8');

// Match each section
const rxSuperAdmin = /\/\* ─── 1\. SUPER ADMIN \/ ADMIN DASHBOARD ───[\s\S]*?(?=\/\* ─── 2\.)/;
const rxSales = /\/\* ─── 2\. SALES DASHBOARD ───[\s\S]*?(?=\/\* ─── 3\.)/;
const rxInventory = /\/\* ─── 3\. INVENTORY DASHBOARD ───[\s\S]*?(?=\/\* ─── 3\.5\.)/;
const rxCarga = /\/\* ─── 3\.5\. CARGA Y DESCARGA DASHBOARD ───[\s\S]*?(?=\/\* ─── 3\.8\.)/;
const rxMarketing = /\/\* ─── 3\.8\. MARKETING DASHBOARD ───[\s\S]*?(?=\/\* ─── 4\.)/;
const rxDelivery = /\/\* ─── 4\. DELIVERY DASHBOARD ───[\s\S]*?(?=\/\* ─── MAIN ROUTER)/;

// Extract code
const superAdminCode = content.match(rxSuperAdmin)[0].replace('const SuperAdminDashboard =', 'export default function SuperAdminDashboard(').replace(/=> {/, '{');
const salesCode = content.match(rxSales)[0].replace('const SalesDashboardWorker =', 'export default function SalesDashboardWorker(').replace(/=> {/, '{');
const inventoryCode = content.match(rxInventory)[0].replace('const InventoryDashboardWorker =', 'export default function InventoryDashboardWorker(').replace(/=> {/, '{');
const cargaCode = content.match(rxCarga)[0].replace('const CargaDescargaDashboardWorker =', 'export default function CargaDescargaDashboardWorker(').replace(/=> {/, '{');
const marketingCode = content.match(rxMarketing)[0].replace('const MarketingDashboardWorker =', 'export default function MarketingDashboardWorker(').replace(/=> {/, '{');
const deliveryCode = content.match(rxDelivery)[0].replace('const DeliveryDashboardWorker =', 'export default function DeliveryDashboardWorker(').replace(/=> {/, '{');

// Extract premiumBtn
const premiumBtnCode = `const premiumBtn: React.CSSProperties = {
    display:         'inline-flex',
    alignItems:      'center',
    gap:             '8px',
    padding:         '10px 20px',
    borderRadius:    '14px',
    fontWeight:      '700',
    fontSize:        '0.82rem',
    letterSpacing:   '0.04em',
    border:          'none',
    cursor:          'pointer',
    transition:      'all 0.18s cubic-bezier(0.4,0,0.2,1)',
    userSelect:      'none',
};`;

// Write SuperAdmin
fs.writeFileSync('src/components/dashboard/SuperAdminDashboard.tsx', `
"use client";
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, FileText, ShieldCheck, CheckCircle, Maximize2, Share2, Map, TrendingUp, Zap, Package, ShoppingCart, Truck, Settings, ReceiptText, BookOpen, Cloud, BarChart3, Headphones, Terminal } from 'lucide-react';
import Link from 'next/link';
import StaffRankingWidget from '@/components/admin/StaffRankingWidget';
import RestockAlertWidget from '@/components/admin/RestockAlertWidget';
import ModuleSection from '@/components/admin/ModuleSection';
import KPICard from '@/components/admin/KPICard';
import { Palette } from 'lucide-react';

${premiumBtnCode}

${superAdminCode}
`);

fs.writeFileSync('src/components/dashboard/SalesDashboardWorker.tsx', `
"use client";
import { motion } from 'framer-motion';
import { LogOut, ScanLine, ChevronRight, Clock, AlertTriangle, Users } from 'lucide-react';
import Link from 'next/link';

${salesCode}
`);

fs.writeFileSync('src/components/dashboard/InventoryDashboardWorker.tsx', `
"use client";
import { motion } from 'framer-motion';
import { Package, LogOut, PackageCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

${inventoryCode}
`);

fs.writeFileSync('src/components/dashboard/CargaDescargaDashboardWorker.tsx', `
"use client";
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Truck, LogOut, CheckCircle, MapPin, Clock, Loader2, Play } from 'lucide-react';

${cargaCode}
`);

fs.writeFileSync('src/components/dashboard/MarketingDashboardWorker.tsx', `
"use client";
import { motion } from 'framer-motion';
import { Share2, LogOut, Palette, ChevronRight, QrCode, TrendingUp } from 'lucide-react';
import Link from 'next/link';

${marketingCode}
`);

fs.writeFileSync('src/components/dashboard/DeliveryDashboardWorker.tsx', `
"use client";
import { motion } from 'framer-motion';
import { LogOut, Route, ChevronRight, Truck, MapPin } from 'lucide-react';
import Link from 'next/link';

${deliveryCode}
`);

console.log("Done extracting components.");
