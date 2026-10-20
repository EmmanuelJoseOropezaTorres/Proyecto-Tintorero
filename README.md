# Valery | Portal de gestión

Aplicación en español para gestionar clientes, productos, precios y cuentas por cobrar, con una herramienta interactiva de análisis estadístico. Está desarrollada con HTML5, CSS3, JavaScript vanilla, PHP puro y MySQL; no usa frameworks.

## Requisitos

- XAMPP con Apache y MySQL.
- PHP 8.1 o superior con PDO, `pdo_mysql` y `mbstring`.
- MySQL 8.0.16 o superior.
- Git y un navegador moderno.

## Instalación local en Windows

1. Copia todos los archivos de este proyecto a `C:\xampp\htdocs\valery\` (o clona el repositorio directamente con ese nombre de carpeta). La carpeta debe contener `index.html`, `api\` y `database\`.
2. Inicia **Apache** y **MySQL** desde el panel de XAMPP.
3. Abre `http://localhost/phpmyadmin/`, selecciona **Importar** y carga `database/database.sql`. El script crea `valery_portal`, sus tablas y registros iniciales.
4. Copia `api/.env.example` como `api/.env`. Para la configuración predeterminada de XAMPP (`root`, contraseña vacía), no es necesario cambiarla.
5. Abre `http://localhost/valery/` y registra una cuenta para ingresar.

La API queda disponible en `http://localhost/valery/api/`. Apache dirige esas rutas a `api/index.php` mediante `.htaccess`; no es necesario iniciar otro servidor ni configurar CORS para el uso local.

## Estructura

```text
Proyecto-Tintorero/
├── .gitignore
├── README.md
├── INFORME_COSTOS.md
├── KANBAN.md
├── manual_usuario.md
├── database/
│   ├── .htaccess
│   └── database.sql
├── api/
│   ├── .htaccess
│   ├── index.php                  # Enrutador REST
│   ├── config/database.php        # Conexión PDO
│   ├── controllers/
│   ├── models/
│   └── middlewares/
├── index.html                     # Panel y módulos CRUD
├── dashboard.html                 # Acceso alternativo al panel
├── crud.html                      # Acceso al módulo de clientes
├── login.html
├── registro.html
├── sistema_diseno.html
├── styles.css
├── app.js
└── auth.js
```

## Funciones

- Registro e inicio de sesión con contraseñas almacenadas mediante `password_hash`.
- Gestión de clientes: consulta paginada, búsqueda, filtro de estado, creación, edición e inactivación.
- Consulta del catálogo con filtro de categoría y actualización masiva de precios.
- Resumen y alertas de cuentas por cobrar.
- Herramienta de Estadística para calcular medidas descriptivas, crear histogramas y tablas de frecuencia, y analizar correlación de Pearson y regresión lineal con datos propios.
- Respuestas de API en JSON, consultas PDO preparadas y mensajes de error en español.

`index.html` contiene el panel y sus módulos, incluida la herramienta interactiva de Estadística; `dashboard.html` y `crud.html` son accesos alternativos al mismo panel, para evitar mantener dos copias de la interfaz.

## Rutas principales de la API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/estado` | Verificar conexión a la base de datos |
| POST | `/api/autenticacion/registro` | Crear cuenta |
| POST | `/api/autenticacion/iniciar-sesion` | Iniciar sesión |
| GET | `/api/autenticacion/sesion` | Consultar sesión actual |
| POST | `/api/autenticacion/cerrar-sesion` | Cerrar sesión |
| GET, POST | `/api/clientes` | Listar y crear clientes (`pagina`, `tamano_pagina`, `busqueda`, `estado`) |
| GET, PUT, DELETE | `/api/clientes/{id}` | Consultar, editar e inactivar cliente |
| GET | `/api/productos` | Consultar catálogo |
| POST | `/api/productos/actualizar-precios-masivo` | Actualizar precios |
| GET | `/api/cuentas-por-cobrar?dias=7` | Consultar saldos |
| GET | `/api/cuentas-por-cobrar/alertas?dias=7` | Consultar alertas |

## Flujo de trabajo en Git para el equipo

El trabajo se propone en ramas `feature/<número>-<título>` y se integra mediante solicitudes de incorporación (Pull Request) a `develop`; luego se prepara otra solicitud de `develop` a `main`. No se deben subir cambios directamente a `main`. La rama `feature/101-valery-academico` contiene esta entrega y debe revisarse antes de integrarla.

## Documentos de entrega

- [Manual de usuario](./manual_usuario.md)
- [Tablero Kanban y horas](./KANBAN.md)
- [Tablero Kanban público en GitHub](https://github.com/users/Nonils0/projects/2)
- [Informe de valoración de costos](./INFORME_COSTOS.md)
- [Guion de demostración y plan alternativo](./GUIA_DEMOSTRACION.md)
