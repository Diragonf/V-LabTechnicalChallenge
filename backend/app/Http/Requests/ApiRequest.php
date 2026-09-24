<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

abstract class ApiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), array_keys($this->rules())) as $campo) {
                $validator->errors()->add((string) $campo, 'Campo não permitido.');
            }
        });
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'required' => 'Este campo é obrigatório.',
            'required_if' => 'A justificativa é obrigatória para prioridade URGENTE.',
            'string' => 'Este campo deve ser um texto.',
            'in' => 'O valor informado não é permitido.',
            'integer' => 'Este campo deve ser um número inteiro.',
            'min' => 'O valor informado é menor que o mínimo permitido (:min).',
            'max' => 'O valor informado excede o limite permitido (:max).',
            'regex' => 'Este campo deve conter texto não vazio.',
        ];
    }
}
