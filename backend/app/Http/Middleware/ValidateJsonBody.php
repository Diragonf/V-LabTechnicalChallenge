<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use JsonException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\UnsupportedMediaTypeHttpException;

final class ValidateJsonBody
{
    public function handle(Request $request, Closure $next): Response
    {
        if (in_array($request->method(), ['POST', 'PATCH', 'PUT'], true)) {
            if (! $request->isJson()) {
                throw new UnsupportedMediaTypeHttpException;
            }

            try {
                $body = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                throw new BadRequestHttpException;
            }

            if (! is_object($body)) {
                throw new BadRequestHttpException;
            }
        }

        return $next($request);
    }
}
