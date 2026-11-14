import type { StateCreator } from 'zustand';
import type { ERPState, UISlice } from './types';

export const createUISlice: StateCreator<ERPState, [['zustand/immer', never]], [], UISlice> = (set) => ({
    loading: true,
    firebaseStatus: 'connecting',
    syncErrorCode: null,
    syncErrorDetail: null,
    pendingOfflineCount: 0,
    lastSyncAt: null,
    reconnectAttempt: 0,
    guidedTourActive: false,
    guidedTourStep: 1,
    hasCustomizedCanvas: false,
    hasPublishedCanvas: false,
    hasAddedProductToSimulator: false,
    hasPaidInSimulator: false,

    setLoading: (loading) => set((state) => { state.loading = loading; }),
    setFirebaseStatus: (status) => set((state) => { state.firebaseStatus = status; }),
    setSyncHealth: (health) => set((state) => {
        if (health.syncErrorCode !== undefined) state.syncErrorCode = health.syncErrorCode;
        if (health.syncErrorDetail !== undefined) state.syncErrorDetail = health.syncErrorDetail;
        if (health.pendingOfflineCount !== undefined) state.pendingOfflineCount = health.pendingOfflineCount;
        if (health.lastSyncAt !== undefined) state.lastSyncAt = health.lastSyncAt;
        if (health.reconnectAttempt !== undefined) state.reconnectAttempt = health.reconnectAttempt;
    }),

    startGuidedTour: () => set((state) => {
        state.guidedTourActive = true;
        state.guidedTourStep = 1;
        state.hasCustomizedCanvas = false;
        state.hasPublishedCanvas = false;
        state.hasAddedProductToSimulator = false;
        state.hasPaidInSimulator = false;
    }),
    nextGuidedTourStep: () => set((state) => { state.guidedTourStep = Math.min(state.guidedTourStep + 1, 6); }),
    prevGuidedTourStep: () => set((state) => { state.guidedTourStep = Math.max(state.guidedTourStep - 1, 1); }),
    stopGuidedTour: () => set((state) => { state.guidedTourActive = false; }),
    setGuidedTourStep: (step) => set((state) => { state.guidedTourStep = step; }),
    setHasCustomizedCanvas: (val) => set((state) => { state.hasCustomizedCanvas = val; }),
    setHasPublishedCanvas: (val) => set((state) => { state.hasPublishedCanvas = val; }),
    setHasAddedProductToSimulator: (val) => set((state) => { state.hasAddedProductToSimulator = val; }),
    setHasPaidInSimulator: (val) => set((state) => { state.hasPaidInSimulator = val; }),
});
