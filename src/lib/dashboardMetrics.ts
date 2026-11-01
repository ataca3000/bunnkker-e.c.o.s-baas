type DashboardOrderItem = {
    price?: unknown;
    cost?: unknown;
    quantity?: unknown;
};

type DashboardOrder = {
    status?: string;
    confirmedAt?: unknown;
    date?: string | number | Date | null;
    total?: unknown;
    items?: DashboardOrderItem[] | null;
    ownerCut?: unknown;
    profit?: unknown;
};

type DashboardProduct = {
    category?: unknown;
    stock?: unknown;
    price?: unknown;
};

type DailyMetrics = {
    name: string;
    dateKey: string;
    isToday: boolean;
    sales: number;
    profit: number;
    orders: number;
};

export type DashboardMetrics = {
    todaySales: number;
    todayOrders: number;
    weeklyTotalSales: number;
    weeklyTotalProfit: number;
    weeklyTotalOrders: number;
    chartSalesData: Array<{ name: string; ventas: number; pedidos: number; isToday: boolean }>;
    chartProfitData: Array<{ name: string; ganancia: number; pedidos: number; isToday: boolean }>;
    chartOrdersData: Array<{ name: string; pedidos: number; isToday: boolean }>;
    chartInventoryData: Array<{ name: string; piezas: number; valor: number }>;
    lowStockCount: number;
    totalPieces: number;
    totalInvestment: number;
};

const VALID_SALE_STATUSES = new Set([
    'paid',
    'COMPLETED',
    'READY_TO_SHIP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'READY_FOR_PICKUP_PAID',
]);

function isValidSale(order: DashboardOrder): boolean {
    if (order.status === 'cancelled' || order.status === 'refunded') return false;
    return Boolean(order.confirmedAt) || VALID_SALE_STATUSES.has(order.status ?? '');
}

function getOrderProfit(order: DashboardOrder): number {
    if (Array.isArray(order.items) && order.items.length > 0) {
        return order.items.reduce((total, item) => {
            const price = Number(item.price) || 0;
            const cost = Number(item.cost) || price * 0.72;
            const quantity = Number(item.quantity) || 1;
            return total + Math.max(0, (price - cost) * quantity);
        }, 0);
    }

    return Number(order.ownerCut || order.profit || (Number(order.total || 0) * 0.28)) || 0;
}

export function buildDashboardMetrics(
    orders: DashboardOrder[],
    products: DashboardProduct[],
    now = new Date(),
): DashboardMetrics {
    const todayKey = now.toDateString();
    const days: DailyMetrics[] = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (6 - index));
        const dateKey = date.toDateString();

        return {
            name: date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
            dateKey,
            isToday: dateKey === todayKey,
            sales: 0,
            profit: 0,
            orders: 0,
        };
    });
    const dailyMetrics = new Map(days.map((day) => [day.dateKey, day]));

    for (const order of orders) {
        if (!isValidSale(order)) continue;

        const orderDate = order.date instanceof Date ? order.date : new Date(order.date || '');
        if (Number.isNaN(orderDate.getTime())) continue;

        const day = dailyMetrics.get(orderDate.toDateString());
        if (!day) continue;

        day.sales += Number(order.total) || 0;
        day.profit += getOrderProfit(order);
        day.orders += 1;
    }

    const inventoryByCategory = new Map<string, { name: string; piezas: number; valor: number }>();
    let lowStockCount = 0;
    let totalPieces = 0;
    let totalInvestment = 0;

    for (const product of products) {
        const stock = Number(product.stock) || 0;
        const price = Number(product.price) || 0;
        const rawCategory = product.category ? String(product.category).trim() : 'General';
        const category = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1).toLowerCase();
        const current = inventoryByCategory.get(category) ?? { name: category, piezas: 0, valor: 0 };

        if (stock < 10) lowStockCount += 1;
        totalPieces += stock;
        totalInvestment += stock * price;
        current.piezas += stock;
        current.valor += stock * price;
        inventoryByCategory.set(category, current);
    }

    const chartSalesData = days.map((day) => ({
        name: day.name,
        ventas: day.sales,
        pedidos: day.orders,
        isToday: day.isToday,
    }));
    const chartProfitData = days.map((day) => ({
        name: day.name,
        ganancia: Math.round(day.profit),
        pedidos: day.orders,
        isToday: day.isToday,
    }));
    const chartOrdersData = days.map((day) => ({
        name: day.name,
        pedidos: day.orders,
        isToday: day.isToday,
    }));
    const chartInventoryData = [...inventoryByCategory.values()]
        .sort((left, right) => right.piezas - left.piezas)
        .slice(0, 7);

    if (chartInventoryData.length === 0) {
        chartInventoryData.push({ name: 'General', piezas: 0, valor: 0 });
    }

    const todayMetrics = dailyMetrics.get(todayKey);

    return {
        todaySales: todayMetrics?.sales ?? 0,
        todayOrders: todayMetrics?.orders ?? 0,
        weeklyTotalSales: days.reduce((total, day) => total + day.sales, 0),
        weeklyTotalProfit: chartProfitData.reduce((total, day) => total + day.ganancia, 0),
        weeklyTotalOrders: days.reduce((total, day) => total + day.orders, 0),
        chartSalesData,
        chartProfitData,
        chartOrdersData,
        chartInventoryData,
        lowStockCount,
        totalPieces,
        totalInvestment,
    };
}
