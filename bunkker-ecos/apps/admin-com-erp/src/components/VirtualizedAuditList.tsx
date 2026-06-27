"use client";
import { useRef, useState, useCallback, useMemo } from 'react';
// @ts-ignore
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { type AuditLog } from '@/types/audit';

export interface AuditRowData {
    logs: AuditLog[];
    loading: boolean;
    hasMore: boolean;
}

interface VirtualizedAuditListProps {
    logs: AuditLog[];
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    RowComponent: React.ComponentType<ListChildComponentProps<AuditRowData>>;
    itemSize: number;
    height?: number;
    className?: string;
    theme?: 'dark' | 'light';
}

export default function VirtualizedAuditList({
    logs,
    loading,
    hasMore,
    onLoadMore,
    RowComponent,
    itemSize,
    height = 600,
    className = "",
    theme = 'dark'
}: VirtualizedAuditListProps) {
    const listRef = useRef<List>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);

    const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
        setShowScrollTop(scrollOffset > 300);
    }, []);

    const onItemsRendered = useCallback(({ visibleStopIndex }: { visibleStopIndex: number }) => {
        if (hasMore && !loading && visibleStopIndex >= logs.length - 5) {
            onLoadMore();
        }
    }, [logs.length, hasMore, loading, onLoadMore]);

    const scrollToTop = () => {
        listRef.current?.scrollToItem(0);
    };

    const itemData = useMemo(() => ({
        logs,
        loading,
        hasMore
    }), [logs, loading, hasMore]);

    const scrollbarStyles = theme === 'dark' 
        ? "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
        : "[scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.1)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-black/20";

    return (
        <div className="relative w-full h-full">
            <List
                ref={listRef}
                height={height}
                itemCount={hasMore ? logs.length + 1 : logs.length}
                itemData={itemData}
                itemSize={itemSize}
                width="100%"
                onScroll={handleScroll}
                onItemsRendered={onItemsRendered}
                className={`${scrollbarStyles} transition-colors ${className} scrollbar-hide`}
            >
                {RowComponent}
            </List>

            <AnimatePresence>
                {showScrollTop && (
                    <motion.button
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.8 }}
                        onClick={scrollToTop}
                        className={`fixed bottom-20 right-12 p-3 rounded-full shadow-lg z-50 transition-all active:scale-90 border border-white/10 ${
                            theme === 'dark' ? 'bg-[#0ea5e9] text-white' : 'bg-white text-[#0ea5e9] shadow-md'
                        }`}
                        title="Subir al inicio"
                    >
                        <ArrowUp size={20} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
