<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\SolicitacaoFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Solicitacao extends Model
{
    /** @use HasFactory<SolicitacaoFactory> */
    use HasFactory;

    public const CREATED_AT = 'data_criacao';

    public const UPDATED_AT = 'data_atualizacao';

    protected $table = 'solicitacoes';

    /** @var list<string> */
    protected $fillable = [
        'protocolo',
        'nome_solicitante',
        'categoria',
        'prioridade',
        'status',
        'descricao',
        'justificativa_prioridade',
    ];

    /** @var array<string, string> */
    protected $attributes = [
        'status' => 'RECEBIDA',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'data_criacao' => 'datetime',
            'data_atualizacao' => 'datetime',
        ];
    }
}
