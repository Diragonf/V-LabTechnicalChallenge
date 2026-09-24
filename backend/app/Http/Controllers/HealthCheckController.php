<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\HealthCheckService;
use Illuminate\Http\JsonResponse;

final class HealthCheckController
{
    public function __construct(private readonly HealthCheckService $service) {}

    public function __invoke(): JsonResponse
    {
        $connected = $this->service->databaseConnected();

        return response()->json([
            'status' => $connected ? 'ok' : 'error',
            'database' => $connected ? 'connected' : 'disconnected',
            'timestamp' => now()->toISOString(),
        ], $connected ? 200 : 503, ['Cache-Control' => 'no-store']);
    }
}
