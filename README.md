# ☕ Sede Café · Sistema de Pedidos Internos y Control de Productos

**Implementación de un Sistema Informático para el Registro, Control de Productos y Gestión de Pedidos Internos de Sede Café.**
Proyecto académico de UPIICSA (IPN), materias de Diseño de Proyectos y Cómputo en la Nube.

El sistema es un **monolito modular**: un solo servidor Node.js expone la API REST y entrega la interfaz web ya compilada, conectado a una base de datos PostgreSQL. Así se puede correr en local y desplegar en una máquina virtual en la nube con un solo script.

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Productos e insumos** | Altas, edición, baja lógica y reactivación; categorías; tipo (producto, insumo, material); unidad de medida; stock actual y mínimo; control de disponibilidad; entradas y ajustes de inventario con historial de movimientos. |
| **Pedidos internos** | Cada empleado registra solicitudes con varios productos indicando sucursal, área y observaciones. Folio automático `SC-AAAA-00001`. |
| **Seguimiento y entrega** | Flujo de estados **Pendiente → En proceso → Atendido** (o **Rechazado** con motivo). Al marcar *Atendido* se descuenta el inventario automáticamente y se valida que haya existencia suficiente. Historial de cada cambio. |
| **Usuarios y roles** | **Administración** (todo), **Almacén** (atiende pedidos y gestiona inventario) y **Empleado/Sucursal** (solicita y consulta sus pedidos). Autenticación con JWT. |
| **Panel de inicio** | Conteo de pedidos por estado, pedidos recientes y productos con stock bajo. |

## Tecnologías

- **Backend:** Node.js 20+, Express 5, Sequelize (ORM), PostgreSQL, JWT, bcrypt, Zod
- **Frontend:** React 19, Vite, React Router, Tailwind CSS 4
- **Despliegue:** Ubuntu en VM (Azure / IBM Cloud), Nginx como proxy inverso, PM2 como gestor de procesos

## Estructura

```
sede-cafe/
├── backend/
│   ├── src/
│   │   ├── app.js              # Configuración de Express y rutas
│   │   ├── server.js           # Punto de entrada
│   │   ├── config.js           # Variables de entorno
│   │   ├── db.js               # Conexión y modelos (tablas y relaciones)
│   │   ├── middleware/         # Autenticación, roles y manejo de errores
│   │   └── modules/            # auth, usuarios, sucursales, categorias, productos, pedidos, dashboard
│   ├── scripts/                # db-init.js (crea tablas) y seed.js (datos demo)
│   └── .env.example            # Plantilla de variables de entorno
├── frontend/
│   └── src/                    # pages/, components/, context/, api.js
├── deploy/
│   ├── setup-vm.sh             # Instalación completa en la VM
│   ├── actualizar.sh           # Actualizar la VM tras un git push
│   └── nginx-sede-cafe.conf    # Configuración de Nginx
└── ecosystem.config.cjs        # Configuración de PM2
```

## Modelo de datos

`sucursales`, `usuarios`, `categorias`, `productos`, `pedidos`, `detalle_pedidos`, `historial_estados_pedido` y `movimientos_inventario`. Las tablas se crean automáticamente con `npm run db:init` a partir de los modelos definidos en `backend/src/db.js`.

## Usuarios de demostración

Contraseña para todos: **`SedeCafe2026`**

| Correo | Rol |
|---|---|
| admin@sedecafe.com | Administración |
| almacen@sedecafe.com | Almacén |
| centro@sedecafe.com | Empleado · Sucursal Centro |
| norte@sedecafe.com | Empleado · Sucursal Norte |

> Cambia estas contraseñas si el sistema se va a usar con datos reales.

---

## Despliegue en una máquina virtual (Azure)

Resumen; el procedimiento con capturas va en el manual de la práctica.

1. **Crear la VM** en el portal de Azure: imagen **Ubuntu Server 24.04 LTS**, tamaño **B1s** o **B2ats v2** (incluidos en Azure for Students), autenticación por contraseña o clave SSH, y en *Puertos de entrada* habilitar **SSH (22)** y **HTTP (80)**.
2. **Conectarse** desde el portal (botón *Conectar → SSH* o *Cloud Shell*) o desde una terminal:
   `ssh usuario@IP_PUBLICA`
3. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/TU_USUARIO/sede-cafe.git
   cd sede-cafe
   ```
4. **Ejecutar el instalador** (tarda de 5 a 10 minutos):
   ```bash
   bash deploy/setup-vm.sh
   ```
5. Abrir en el navegador `http://IP_PUBLICA` e iniciar sesión con un usuario demo.
6. **Al terminar, detener la VM** desde el portal (botón *Detener*) para que quede *desasignada* y no consuma créditos. La app arranca sola cuando la vuelvas a encender (PM2 está configurado para iniciar con el sistema). Ojo: si la IP pública no es estática, puede cambiar al volver a encender la VM.

Comandos útiles en la VM:

```bash
pm2 status                 # ver si la app está corriendo
pm2 logs sede-cafe         # ver los registros
pm2 restart sede-cafe      # reiniciar la app
curl localhost/api/health  # probar conexión a la base de datos
bash deploy/actualizar.sh  # traer cambios de GitHub y reiniciar
```

---

## Correr en local (opcional)

Requisitos: Node.js 20 o superior y PostgreSQL.

```bash
# 1. Crear la base de datos (desde psql como superusuario)
CREATE USER sedecafe WITH PASSWORD 'tu_contrasena';
CREATE DATABASE sede_cafe OWNER sedecafe;

# 2. Configurar variables de entorno
cp backend/.env.example backend/.env     # y edita DATABASE_URL y JWT_SECRET

# 3. Instalar, crear tablas y cargar datos demo
npm run instalar
npm run db:init
npm run db:seed

# 4a. Modo desarrollo (dos terminales)
npm run dev:backend      # API en http://localhost:3000
npm run dev:frontend     # Interfaz en http://localhost:5173

# 4b. Modo producción (un solo servidor)
npm run build
npm start                # http://localhost:3000  (con NODE_ENV=production en .env)
```

## API REST (resumen)

Todas las rutas, salvo login y health, requieren el encabezado `Authorization: Bearer <token>`.

| Método | Ruta | Rol |
|---|---|---|
| POST | `/api/auth/login` | público |
| GET | `/api/auth/me` · PUT `/api/auth/password` | todos |
| GET | `/api/productos?q=&categoriaId=&tipo=&bajoStock=true` | todos |
| POST / PUT / DELETE | `/api/productos[/:id]` | Admin, Almacén |
| PATCH | `/api/productos/:id/disponibilidad` · `/reactivar` | Admin, Almacén |
| GET / POST | `/api/productos/:id/movimientos` | Admin, Almacén |
| GET / POST / PUT / DELETE | `/api/categorias[/:id]` | lectura todos · escritura Admin, Almacén |
| GET / POST | `/api/pedidos` | todos (el empleado solo ve los suyos) |
| GET | `/api/pedidos/:id` | todos |
| PATCH | `/api/pedidos/:id/estado` `{ estado, comentario }` | Admin, Almacén |
| PATCH | `/api/pedidos/:id/cancelar` | solicitante (si está pendiente) |
| GET / POST / PUT / PATCH | `/api/usuarios[/:id][/estado]` | Admin |
| GET / POST / PUT | `/api/sucursales[/:id]` | lectura todos · escritura Admin |
| GET | `/api/dashboard` | todos |
| GET | `/api/health` | público |
