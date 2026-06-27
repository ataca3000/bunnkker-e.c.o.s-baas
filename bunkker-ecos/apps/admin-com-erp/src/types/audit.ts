export interface AuditLog {
    id: string;
    type: string;
    description: string;
    userName?: string;
    timestamp: {
        seconds: number;
        nanoseconds: number;
    };
    isLocal?: boolean;
    metadata?: any;
}
