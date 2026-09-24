<?php

declare(strict_types=1);
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

for ($attempt = 1; $attempt <= 30; $attempt++) {
    try {
        DB::select('SELECT 1');
        fwrite(STDOUT, "PostgreSQL pronto.\n");
        exit(0);
    } catch (Throwable) {
        DB::purge();
        fwrite(STDERR, "Aguardando PostgreSQL ($attempt/30)…\n");
        sleep(2);
    }
}
fwrite(STDERR, "PostgreSQL indisponível; inicialização interrompida.\n");
exit(1);
