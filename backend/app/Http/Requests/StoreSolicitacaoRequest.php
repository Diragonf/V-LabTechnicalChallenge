<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

final class StoreSolicitacaoRequest extends ApiRequest
{
    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'nome_solicitante' => ['required', 'string', 'max:255', 'regex:/\S/u'],
            'categoria' => ['required', 'string', Rule::in(['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'])],
            'prioridade' => ['required', 'string', Rule::in(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'])],
            'descricao' => ['required', 'string', 'max:10000', 'regex:/\S/u'],
            'justificativa_prioridade' => ['required_if:prioridade,URGENTE', 'nullable', 'string', 'max:10000', 'regex:/\S/u'],
        ];
    }
}
