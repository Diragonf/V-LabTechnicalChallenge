<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\IndexSolicitacaoRequest;
use App\Http\Requests\StoreSolicitacaoRequest;
use App\Http\Requests\UpdateStatusSolicitacaoRequest;
use App\Http\Resources\SolicitacaoResource;
use App\Services\SolicitacaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class SolicitacaoController
{
    public function __construct(private readonly SolicitacaoService $service) {}

    public function store(StoreSolicitacaoRequest $request): JsonResponse
    {
        return (new SolicitacaoResource($this->service->criar($request->validated())))
            ->response()
            ->setStatusCode(201);
    }

    public function index(IndexSolicitacaoRequest $request): AnonymousResourceCollection
    {
        return SolicitacaoResource::collection($this->service->listar($request->validated()));
    }

    public function show(string $id): SolicitacaoResource
    {
        return new SolicitacaoResource($this->service->detalhar($id));
    }

    public function updateStatus(UpdateStatusSolicitacaoRequest $request, string $id): SolicitacaoResource
    {
        return new SolicitacaoResource($this->service->atualizarStatus($id, $request->validated('status')));
    }
}
