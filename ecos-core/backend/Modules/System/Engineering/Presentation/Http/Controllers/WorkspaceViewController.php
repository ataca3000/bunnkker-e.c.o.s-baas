<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Domain\Models\WorkspaceView;

class WorkspaceViewController
{
    use HasApiResponse;

    public function index(Request $request): JsonResponse
    {
        $user = auth()->user();

        $views = WorkspaceView::query()
            ->where('company_id', $user->company_id)
            ->where(fn ($q) => $q
                ->where('user_id', $user->id)
                ->orWhere('is_shared', true))
            ->when($request->query('context'), fn ($q, $context) => $q->where('context', $context))
            ->orderBy('name')
            ->get();

        return $this->success($views);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'      => 'required|string|max:120',
            'context'   => 'required|string|max:64',
            'filters'   => 'nullable|array',
            'is_shared' => 'nullable|boolean',
        ]);

        $user = auth()->user();

        $view = WorkspaceView::create(array_merge($data, [
            'company_id' => $user->company_id,
            'user_id'    => $user->id,
        ]));

        return $this->success($view, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'name'      => 'nullable|string|max:120',
            'filters'   => 'nullable|array',
            'is_shared' => 'nullable|boolean',
        ]);

        $view = $this->findOwnView($id);
        $view->update($data);

        return $this->success($view->fresh());
    }

    public function destroy(string $id): JsonResponse
    {
        $this->findOwnView($id)->delete();

        return $this->success(['deleted' => true]);
    }

    private function findOwnView(string $id): WorkspaceView
    {
        $user = auth()->user();

        return WorkspaceView::query()
            ->where('company_id', $user->company_id)
            ->where('user_id', $user->id)
            ->findOrFail($id);
    }
}
