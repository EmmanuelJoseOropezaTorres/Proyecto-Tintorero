<?php
declare(strict_types=1);

function dispatchAuth(PDO $db, string $method, string $path): never
{
    if ($method === 'GET' && $path === '/autenticacion/sesion') {
        if (!isset($_SESSION['usuario_id'], $_SESSION['usuario_nombre'])) {
            throw new ApiException(401, 'Inicia sesión para continuar.');
        }
        sendJson(200, [
            'data' => [
                'id' => $_SESSION['usuario_id'],
                'nombre' => $_SESSION['usuario_nombre'],
            ],
        ]);
    }

    if ($method === 'POST' && $path === '/autenticacion/registro') {
        $data = jsonBody();
        requireFields($data, ['nombre', 'correo', 'contrasena']);
        $nombre = trim((string) $data['nombre']);
        $correo = mb_strtolower(trim((string) $data['correo']));
        $contrasena = (string) $data['contrasena'];
        if (mb_strlen($nombre) < 2 || mb_strlen($nombre) > 120
            || strlen($correo) > 190 || !filter_var($correo, FILTER_VALIDATE_EMAIL)
            || strlen($contrasena) < 8 || strlen($contrasena) > 200) {
            throw new ApiException(422, 'Revisa el nombre, el correo y la contraseña. La contraseña debe tener entre 8 y 200 caracteres.');
        }

        $statement = $db->prepare(
            'INSERT INTO usuarios (nombre, correo, contrasena_hash) VALUES (:nombre, :correo, :contrasena_hash)',
        );
        $statement->execute([
            'nombre' => $nombre,
            'correo' => $correo,
            'contrasena_hash' => password_hash($contrasena, PASSWORD_DEFAULT),
        ]);
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = (int) $db->lastInsertId();
        $_SESSION['usuario_nombre'] = $nombre;
        sendJson(201, ['data' => ['id' => $_SESSION['usuario_id'], 'nombre' => $nombre]]);
    }

    if ($method === 'POST' && $path === '/autenticacion/iniciar-sesion') {
        $data = jsonBody();
        requireFields($data, ['correo', 'contrasena']);
        $correo = mb_strtolower(trim((string) $data['correo']));
        $statement = $db->prepare(
            'SELECT id, nombre, contrasena_hash FROM usuarios WHERE correo = :correo',
        );
        $statement->execute(['correo' => $correo]);
        $usuario = $statement->fetch();
        if ($usuario === false || !password_verify((string) $data['contrasena'], $usuario['contrasena_hash'])) {
            throw new ApiException(401, 'Correo o contraseña incorrectos.');
        }

        session_regenerate_id(true);
        $_SESSION['usuario_id'] = (int) $usuario['id'];
        $_SESSION['usuario_nombre'] = $usuario['nombre'];
        sendJson(200, ['data' => ['id' => $_SESSION['usuario_id'], 'nombre' => $_SESSION['usuario_nombre']]]);
    }

    if ($method === 'POST' && $path === '/autenticacion/cerrar-sesion') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $parameters = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $parameters['path'],
                'domain' => $parameters['domain'],
                'secure' => $parameters['secure'],
                'httponly' => $parameters['httponly'],
                'samesite' => $parameters['samesite'] ?? 'Lax',
            ]);
        }
        session_destroy();
        sendJson(200, ['message' => 'Sesión cerrada correctamente.']);
    }

    throw new ApiException(404, 'Ruta de autenticación no encontrada.');
}

function dispatchApi(PDO $db, string $method, string $path, array $query): never
{
    if ($method === 'GET' && $path === '/clientes') {
        $page = positiveInteger($query['pagina'] ?? 1, 'pagina');
        $pageSize = positiveInteger($query['tamano_pagina'] ?? 10, 'tamano_pagina');
        if ($pageSize > 100) {
            throw new ApiException(422, 'El tamaño de página no puede superar 100.');
        }
        $search = trim((string) ($query['busqueda'] ?? ''));
        if (mb_strlen($search) > 120) {
            throw new ApiException(422, 'La búsqueda no puede superar 120 caracteres.');
        }
        $status = strtoupper(trim((string) ($query['estado'] ?? 'ACTIVO')));
        if (!in_array($status, ['ACTIVO', 'INACTIVO', 'TODOS'], true)) {
            throw new ApiException(422, 'El filtro de estado debe ser ACTIVO, INACTIVO o TODOS.');
        }
        sendJson(200, listClients($db, $page, $pageSize, $search, $status));
    }

    if (preg_match('#^/clientes/(\d+)$#', $path, $matches)) {
        $id = positiveInteger($matches[1], 'id');
        if ($method === 'GET') {
            sendJson(200, ['data' => getClient($db, $id)]);
        }
        if ($method === 'POST' || $method === 'PUT') {
            $payload = validateClientPayload(jsonBody());
            if ($method === 'POST') {
                sendJson(201, [
                    'data' => createClient($db, $payload),
                    'message' => 'Cliente creado correctamente.',
                ]);
            }
            sendJson(200, [
                'data' => updateClient($db, $id, $payload),
                'message' => 'Cliente actualizado correctamente.',
            ]);
        }
        if ($method === 'DELETE') {
            deactivateClient($db, $id);
            sendJson(200, ['message' => 'Cliente inactivado correctamente.']);
        }
        throw new ApiException(405, 'Método HTTP no permitido para este recurso.');
    }

    if ($method === 'POST' && $path === '/clientes') {
        $payload = validateClientPayload(jsonBody());
        sendJson(201, [
            'data' => createClient($db, $payload),
            'message' => 'Cliente creado correctamente.',
        ]);
    }

    if ($method === 'GET' && $path === '/productos') {
        sendJson(200, ['data' => listarProductos($db)]);
    }

    if ($method === 'POST' && $path === '/productos/actualizar-precios-masivo') {
        $result = updateProductPrices($db, jsonBody());
        sendJson(200, [
            'data' => $result,
            'message' => $result['cantidad_actualizada'] === 0
                ? 'No hay productos activos que coincidan con el alcance.'
                : "Se actualizaron {$result['cantidad_actualizada']} productos correctamente.",
        ]);
    }

    if ($method === 'GET' && ($path === '/cuentas-por-cobrar' || $path === '/cuentas-por-cobrar/alertas')) {
        $days = positiveInteger($query['dias'] ?? 7, 'dias', true);
        if ($days > 365) {
            throw new ApiException(422, 'dias debe estar entre 0 y 365.');
        }
        if ($path === '/cuentas-por-cobrar') {
            sendJson(200, ['data' => getReceivablesDashboard($db, $days)]);
        }
        sendJson(200, [
            'data' => getReceivablesAlerts($db, $days),
            'meta' => ['dias_anticipacion' => $days],
        ]);
    }

    throw new ApiException(404, 'Ruta API no encontrada.');
}

function positiveInteger(mixed $value, string $field, bool $allowZero = false): int
{
    $integer = filter_var($value, FILTER_VALIDATE_INT);
    if ($integer === false || ($allowZero ? $integer < 0 : $integer < 1)) {
        throw new ApiException(422, "El campo {$field} debe ser un entero válido.");
    }
    return $integer;
}
