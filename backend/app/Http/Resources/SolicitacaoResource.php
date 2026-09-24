<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class SolicitacaoResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'protocolo' => $this->protocolo,
            'nome_solicitante' => $this->nome_solicitante,
            'categoria' => $this->categoria,
            'prioridade' => $this->prioridade,
            'status' => $this->status,
            'descricao' => $this->descricao,
            'justificativa_prioridade' => $this->justificativa_prioridade,
            'data_criacao' => $this->data_criacao->toISOString(),
            'data_atualizacao' => $this->data_atualizacao->toISOString(),
        ];
    }
}
