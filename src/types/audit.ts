export interface AuditLog {
    id: string;
    type: string;
    description: string;
    userName?: string;
    userId?: string;
    timestamp: {
        seconds: number;
        nanoseconds: number;
    };
    isoDate?: string;
    isLocal?: boolean;
    metadata?: any;
}
