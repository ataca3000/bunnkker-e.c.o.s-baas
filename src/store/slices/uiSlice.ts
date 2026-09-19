import type { StateCreator } from 'zustand';
import type { ERPState, UISlice } from './types';

export const createUISlice: StateCreator<ERPState, [['zustand/immer', never]], [], UISlice> = (set) => ({
    loading: true,
    firebaseStatus: 'connecting',
    guidedTourActive: false,
    guidedTourStep: 1,
    hasCustomizedCanvas: false,
    hasPublishedCanvas: false,
    hasAddedProductToSimulator: false,
    hasPaidInSimulator: false,

    setLoading: (loading) => set((state) => { state.loading = loading; }),
    setFirebaseStatus: (status) => set((state) => { state.firebaseStatus = status; }),

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
