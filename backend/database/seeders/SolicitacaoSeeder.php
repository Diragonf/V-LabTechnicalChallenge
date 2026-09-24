<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Solicitacao;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

final class SolicitacaoSeeder extends Seeder
{
    public function run(): void
    {
        $categorias = ['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'];
        $prioridades = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'];
        $status = ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'];

        DB::transaction(function () use ($categorias, $prioridades, $status): void {
            // Vinte registros garantem cada prioridade em todos os cinco status.
            for ($i = 0; $i < 20; $i++) {
                Solicitacao::factory()->create([
                    'categoria' => $categorias[$i % count($categorias)],
                    'prioridade' => $prioridades[intdiv($i, count($status))],
                    'status' => $status[$i % count($status)],
                ]);
            }
        });
    }
}
