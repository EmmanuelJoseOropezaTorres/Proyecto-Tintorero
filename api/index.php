<?php
declare(strict_types=1);

require_once __DIR__ . '/middlewares/response.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/Cliente.php';
require_once __DIR__ . '/models/Producto.php';
require_once __DIR__ . '/models/CuentasPorCobrar.php';
require_once __DIR__ . '/models/Pagos.php';
require_once __DIR__ . '/controllers/ApiController.php';

set_exception_handler('errorHandler');

if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'httponly' => true,
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$scriptDirectory = dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'));
$projectPath = $scriptDirectory === DIRECTORY_SEPARATOR ? '' : rtrim($scriptDirectory, '/');
$apiPrefix = $projectPath . '/api';
if ($requestPath !== $apiPrefix && !str_starts_with($requestPath, $apiPrefix . '/')) {
    throw new ApiException(404, 'Ruta no encontrada.');
}

$apiPath = substr($requestPath, strlen($apiPrefix));
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'GET' && $apiPath === '/estado') {
    database()->query('SELECT 1');
    sendJson(200, ['estado' => 'disponible']);
}

if (str_starts_with($apiPath, '/autenticacion/')) {
    dispatchAuth(database(), $method, $apiPath);
}

if (!isset($_SESSION['usuario_id'])) {
    throw new ApiException(401, 'Inicia sesión para continuar.');
}

dispatchApi(database(), $method, $apiPath, $_GET);
