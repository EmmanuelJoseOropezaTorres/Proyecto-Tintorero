# Guion de demostración — Valery

Duración recomendada: **6 minutos**. Ajusta el guion a las funciones verificadas en el equipo donde se hará la presentación.

| Tiempo | Qué mostrar | Qué explicar |
|---|---|---|
| 0:00–0:40 | Portada del repositorio y README | El portal Valery está organizado con HTML, CSS y JavaScript; el servidor está hecho en PHP puro y la base de datos es MySQL. |
| 0:40–1:30 | XAMPP y phpMyAdmin | Apache y MySQL están iniciados. La base `valery_portal` tiene usuarios, clientes, categorías, productos y facturas relacionadas mediante claves foráneas. |
| 1:30–2:10 | Registro e inicio de sesión | Se crea una cuenta y se ingresa al sistema. La contraseña se almacena como hash y la sesión se gestiona desde PHP. |
| 2:10–3:10 | Módulo Clientes | Se consulta información guardada en MySQL, se busca un cliente, se aplica el filtro de estado y se muestra el formulario para crear o editar. Explica que la inactivación pide confirmación y conserva el historial. |
| 3:10–4:00 | Productos y precios | Se consulta el catálogo de la base de datos, se filtra por categoría y se explica la actualización de precios por tasa o porcentaje. No hace falta aplicar cambios durante la exposición. |
| 4:00–4:40 | Cuentas por cobrar | Se muestran saldos y alertas de facturas próximas a vencer o vencidas. |
| 4:40–5:20 | Sistema de diseño y vista móvil | Se revisan los colores, tipografía, formularios y estados; activa el modo adaptable del navegador y muestra el menú en una pantalla angosta. |
| 5:20–6:00 | Git, Kanban y costos | Se explican las ramas de trabajo, la revisión mediante solicitudes de incorporación, las tarjetas con horas registradas y la metodología de valoración en siete pasos. |

## Preparación antes de exponer

1. Copia el proyecto en `C:\xampp\htdocs\valery\`.
2. Inicia Apache y MySQL en XAMPP.
3. Importa `database/database.sql` mediante phpMyAdmin y verifica que se crearon las tablas.
4. Comprueba la conexión en `http://localhost/valery/api/estado`.
5. Crea una cuenta de exposición y verifica el acceso, la búsqueda, los formularios y la consulta del catálogo.
6. Abre las herramientas de desarrollo del navegador y comprueba que no haya errores en **Consola** ni solicitudes fallidas en **Red**.
7. Usa `sistema_diseno.html` para mostrar la guía visual y el modo adaptable del navegador para la vista móvil.

## Plan alternativo

- **Falla la conexión o MySQL:** no afirmes que la operación en vivo funciona. Muestra el código, `README.md` y `database/database.sql`; explica el paso exacto pendiente y utiliza capturas propias tomadas durante una ejecución correcta, si existen.
- **Apache no abre el sitio:** verifica la ruta `C:\xampp\htdocs\valery\`, el puerto de Apache y el estado del servicio en el panel de XAMPP.
- **Falla una ruta de la API:** revisa el estado HTTP, la dirección en la pestaña **Red**, que `api/.htaccess` esté activo y que el usuario haya iniciado sesión.
- **No hay conexión a Internet:** la tipografía usa alternativas locales; las demás funciones trabajan con Apache y MySQL locales. Si se necesita la fuente DM Sans, descárgala previamente y prepara la copia local antes de la presentación.
- **Se daña o modifica la base de datos de exposición:** conserva un respaldo autorizado de la base y vuelve a importar el script SQL antes de continuar.
