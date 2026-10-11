# Manual de usuario — Valery

## Antes de empezar

1. Instala XAMPP y abre su panel de control.
2. Inicia Apache y MySQL.
3. Comprueba que no haya otro programa ocupando los puertos configurados (normalmente 80 y 3306).
4. Verifica que el proyecto esté en `C:\xampp\htdocs\valery\`.
5. Importa `database/database.sql` desde phpMyAdmin (`http://localhost/phpmyadmin/`).
6. Revisa `api/.env`; los valores iniciales corresponden a MySQL de XAMPP con usuario `root` y contraseña vacía.
7. Abre `http://localhost/valery/registro.html`, crea una cuenta y luego inicia sesión.

## Acceso

- **Registro:** escribe tu nombre, correo y una contraseña de al menos 8 caracteres. El correo debe ser único.
- **Inicio de sesión:** usa el correo y la contraseña registrados.
- **Cerrar sesión:** utiliza la opción del encabezado del panel.

Las contraseñas se guardan en la base de datos como hashes; no se almacenan en texto legible.

## Módulos del portal

- **Clientes:** busca por cédula/RIF o razón social, filtra por estado, recorre páginas y crea, edita o inactiva registros. Inactivar conserva el historial de facturas.
- **Ajustes de precios:** consulta los productos y recalcula los precios activos usando una tasa de cambio o un porcentaje. Puedes limitar la operación a una categoría.
- **Cuentas por cobrar:** revisa saldos pendientes, facturas vencidas y próximas a vencer; ajusta los días de anticipación.

Los registros que aparecen en pantalla se consultan a la API y a MySQL. Las inserciones incluidas en `database/database.sql` son datos iniciales para probar el sistema; no son arreglos estáticos del frontend.

## Solución de problemas

| Problema | Qué revisar |
|---|---|
| No abre `localhost/valery` | Que Apache esté iniciado y la carpeta esté dentro de `C:\xampp\htdocs\`. |
| Error de conexión con MySQL | Que MySQL esté iniciado y los datos de `api/.env` coincidan con XAMPP. |
| Error 404 en `/api/` | Que Apache tenga `mod_rewrite` habilitado y permita `.htaccess` (`AllowOverride All`). |
| Error de PDO o driver | Habilita `pdo_mysql` y `mbstring` en `php.ini` y reinicia Apache. |
| No inicia sesión | Registra primero una cuenta y revisa que la importación de `database/database.sql` haya terminado sin errores. |
| Error en una solicitud del navegador | Abre F12 → Consola y Red; comparte el mensaje y la dirección solicitada. |
