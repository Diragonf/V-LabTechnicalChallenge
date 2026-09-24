<?php

declare(strict_types=1);

use App\Exceptions\InvalidStatusTransitionException;
use App\Http\Middleware\ValidateJsonBody;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(api: __DIR__.'/../routes/api.php')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(ValidateJsonBody::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontReport([InvalidStatusTransitionException::class]);
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $exception): bool => true);
        $exceptions->render(function (Throwable $exception, Request $request) {
            $status = 500;
            $message = 'Ocorreu um erro interno. Tente novamente mais tarde.';
            $errors = (object) [];
            $headers = [];

            if ($exception instanceof ValidationException) {
                $status = 422;
                $message = 'Os dados informados são inválidos.';
                $errors = (object) $exception->errors();
            } elseif ($exception instanceof InvalidStatusTransitionException) {
                $status = 400;
                $message = 'A transição de status solicitada não é permitida.';
            } elseif ($exception instanceof ModelNotFoundException) {
                $status = 404;
                $message = 'Recurso não encontrado.';
            } elseif ($exception instanceof HttpExceptionInterface) {
                $status = $exception->getStatusCode();
                $headers = $exception->getHeaders();
                $message = match ($status) {
                    400 => 'Requisição inválida. Envie um objeto JSON válido.',
                    401 => 'Autenticação necessária.',
                    403 => 'Acesso não permitido.',
                    404 => 'Recurso não encontrado.',
                    405 => 'Método HTTP não permitido.',
                    413 => 'O conteúdo enviado excede o tamanho permitido.',
                    415 => 'Envie o conteúdo como application/json.',
                    422 => 'Os dados informados são inválidos.',
                    429 => 'Muitas requisições. Tente novamente mais tarde.',
                    default => $status >= 500
                        ? 'Ocorreu um erro interno. Tente novamente mais tarde.'
                        : 'Não foi possível processar a requisição.',
                };
            }

            return response()->json([
                'message' => $message,
                'errors' => $errors,
            ], $status, $headers);
        });
    })->create();
