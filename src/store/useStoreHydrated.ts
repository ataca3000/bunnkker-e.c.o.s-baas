"use client";

import { useState, useEffect } from 'react';

export function useStoreHydrated<T, F>(
    store: (callback: (state: T) => unknown) => unknown,
    selector: (state: T) => F
): F | undefined {
    const result = store(selector) as F;
    const [data, setData] = useState<F>();

    useEffect(() => {
        let isMounted = true;
        Promise.resolve().then(() => {
            if (isMounted) setData(result);
        });
        return () => { isMounted = false; };
    }, [result]);

    return data;
}
