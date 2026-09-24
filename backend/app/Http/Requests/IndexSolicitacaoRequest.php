<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

final class IndexSolicitacaoRequest extends ApiRequest
{
    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'required', 'string', Rule::in(['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'])],
            'categoria' => ['sometimes', 'required', 'string', Rule::in(['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'])],
            'prioridade' => ['sometimes', 'required', 'string', Rule::in(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'])],
            'page' => ['sometimes', 'required', 'integer', 'min:1', 'max:2147483647'],
            'per_page' => ['sometimes', 'required', 'integer', 'min:1', 'max:100'],
        ];
    }
}
