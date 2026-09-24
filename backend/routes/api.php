<?php

declare(strict_types=1);

use App\Http\Controllers\HealthCheckController;
use App\Http\Controllers\SolicitacaoController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('health', HealthCheckController::class);
    Route::post('solicitacoes', [SolicitacaoController::class, 'store']);
    Route::get('solicitacoes', [SolicitacaoController::class, 'index']);
    Route::get('solicitacoes/{id}', [SolicitacaoController::class, 'show'])->whereNumber('id');
    Route::patch('solicitacoes/{id}/status', [SolicitacaoController::class, 'updateStatus'])->whereNumber('id');
});
