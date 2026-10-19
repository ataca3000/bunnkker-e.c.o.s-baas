import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dispatchBoardService } from '../services/dispatch-board-service';
import type {
  OverrideAssignmentPayload,
  ProposePayload,
  SetBoardStatusPayload,
} from '../types/dispatch-board';

const KEY = 'logistics-dispatch';

export function useDispatchBoardOptions() {
  return useQuery({
    queryKey: [KEY, 'board-options'],
    queryFn: () => dispatchBoardService.options(),
    staleTime: 5 * 60_000,
  });
}

export function useDispatchBoard(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'board', id],
    queryFn: () => dispatchBoardService.board(id as string),
    enabled: id !== null,
  });
}

/**
 * The pool is the live availability picture, so it is never served stale: a
 * vehicle that has since been committed elsewhere would make a proposal look
 * possible when it is not.
 */
export function useResourcePool() {
  return useQuery({
    queryKey: [KEY, 'resource-pool'],
    queryFn: () => dispatchBoardService.resourcePool(),
    staleTime: 0,
  });
}

/**
 * Dispatch writes ripple across the whole module — a release changes boards,
 * proposals, the resource pool, the queue and the session views. Invalidating
 * the dispatch prefix keeps them from contradicting each other.
 */
function useDispatchInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useSetBoardStatus(boardId: string) {
  const invalidate = useDispatchInvalidation();

  return useMutation({
    mutationFn: (payload: SetBoardStatusPayload) =>
      dispatchBoardService.setBoardStatus(boardId, payload),
    onSuccess: invalidate,
  });
}

export function useProposeDispatch(boardId: string) {
  const invalidate = useDispatchInvalidation();

  return useMutation({
    mutationFn: (payload: ProposePayload) => dispatchBoardService.propose(boardId, payload),
    onSuccess: invalidate,
  });
}

export function useAcceptProposal() {
  const invalidate = useDispatchInvalidation();

  return useMutation({
    mutationFn: (id: string) => dispatchBoardService.acceptProposal(id),
    onSuccess: invalidate,
  });
}

export function useRejectProposal() {
  const invalidate = useDispatchInvalidation();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      dispatchBoardService.rejectProposal(id, reason),
    onSuccess: invalidate,
  });
}

export function useReleaseProposal() {
  const invalidate = useDispatchInvalidation();

  return useMutation({
    mutationFn: (id: string) => dispatchBoardService.release(id),
    onSuccess: invalidate,
  });
}

export function useOverrideAssignment() {
  const invalidate = useDispatchInvalidation();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: OverrideAssignmentPayload }) =>
      dispatchBoardService.overrideAssignment(id, payload),
    onSuccess: invalidate,
  });
}
