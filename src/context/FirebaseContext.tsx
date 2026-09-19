"use client";

import React, { createContext, useContext, type ReactNode } from 'react';
import { db } from '@/lib/firebase';

interface FirebaseContextType {
    db: typeof db;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
    return (
        <FirebaseContext.Provider value={{ db }}>
            {children}
        </FirebaseContext.Provider>
    );
}

export function useFirebase() {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebase debe ser usado dentro de un FirebaseProvider');
    }
    return context;
}
