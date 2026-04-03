# Elevation - Plataforma de Acompañamiento Emocional con IA

## Visión del Producto

Elevation es un espacio seguro de apoyo en salud mental que combina frameworks psicológicos (como la Terapia de Aceptación y Compromiso - ACT) con inteligencia artificial ética. Su objetivo es brindar un acompañamiento empático y confidencial para la introspección.

## Arquitectura y Estructura

El proyecto sigue una arquitectura limpia orientada a features, diseñada para escalar y mantener altos estándares de seguridad.

### Capas de la Aplicación

1.  **Frontend (Presentation Layer)**:
    *   **Tecnología**: React 19 + Vite + Tailwind CSS v4.
    *   **Diseño**: Minimalismo japonés, enfocado en reducir la carga cognitiva (Trauma-Informed Design).
    *   **Componentes**: Arquitectura basada en Shadcn UI, con gestión de estado global mínima y uso intensivo de tRPC para comunicación tipada.

2.  **Backend (Application & Domain Layers)**:
    *   **Tecnología**: Node.js + Express + tRPC.
    *   **Dominio**: Lógica de negocio pura (ej. `piiAnonymizer`, `crisisDetector`) sin dependencias externas.
    *   **Aplicación**: Orquestación de casos de uso mediante routers de tRPC agrupados por feature (ej. `auth`, `chat`, `reflections`).

3.  **Persistencia (Infrastructure Layer)**:
    *   **Tecnología**: MySQL / TiDB + Drizzle ORM.
    *   **Servicios**: Integraciones externas (Claude LLM, S3 para exportaciones) y utilidades criptográficas (`passwordService`, `emailEncryption`).

### Estructura de Carpetas

```text
platform/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── _core/          # Hooks y utilidades base (auth, hooks)
│   │   ├── components/     # Componentes UI reutilizables (Shadcn)
│   │   ├── pages/          # Vistas principales (Chat, Profile, Login)
│   │   └── lib/            # Configuración de cliente (tRPC)
├── server/                 # Backend Node.js
│   ├── _core/              # Configuración de servidor (Express, tRPC, SDK)
│   ├── domain/             # Reglas de negocio puras (PII, Crisis)
│   ├── features/           # Módulos agrupados por dominio (Auth, Chat)
│   ├── infrastructure/     # Servicios externos (Criptografía, LLM)
│   └── db.ts               # Acceso a base de datos
├── shared/                 # Tipos y constantes compartidas
└── drizzle/                # Esquema de base de datos y migraciones
```

## Seguridad (OWASP Top 10)

Elevation implementa rigurosos controles de seguridad para proteger la privacidad del usuario:

1.  **A01 - Broken Access Control**: Todas las rutas de tRPC están protegidas mediante `protectedProcedure`. Los datos están aislados por `userId`.
2.  **A02 - Cryptographic Failures**:
    *   Contraseñas encriptadas con **bcrypt** (costo 12). Nunca se almacenan en texto plano.
    *   Correos electrónicos encriptados con **AES-256-GCM** en la base de datos.
    *   Conexiones forzadas por HTTPS (HSTS configurado).
3.  **A03 - Injection**: Uso exclusivo de **Drizzle ORM** para consultas parametrizadas. Validación estricta de inputs con **Zod**.
4.  **A04 - Insecure Design**: Arquitectura de **Proxy Seguro**; el cliente nunca se conecta a la IA. Los mensajes pasan por un anonimizador de PII antes de llegar a Claude. Límite de tasa (Rate Limiting) implementado.
5.  **A05 - Security Misconfiguration**: Cabeceras de seguridad gestionadas con **Helmet** (CSP, NoSniff, Frameguard).
6.  **A07 - Identification and Authentication Failures**: Sesiones gestionadas mediante **JWT en cookies HttpOnly, Secure y SameSite=Strict**. Protección contra fuerza bruta en endpoints de login.

## Privacidad y Anonimización (Proxy Seguro)

El pilar de Elevation es la "Bóveda de Identidad Cero-Conocimiento":

1.  **Escudo PII**: Antes de enviar cualquier mensaje a la IA, el `piiAnonymizer` intercepta y reemplaza nombres propios, correos, teléfonos y números de identificación por tokens (ej. `[NOMBRE_1]`).
2.  **Detección de Crisis**: El `crisisDetector` evalúa el riesgo antes de invocar a la IA. Si detecta ideación suicida o riesgo inminente, intercepta el flujo y provee recursos de ayuda regionales de forma inmediata.

## Testing

El proyecto incluye una suite de pruebas unitarias robusta utilizando **Vitest**.

*   **Dominio**: Tests para el anonimizador PII y el detector de crisis.
*   **Infraestructura**: Tests para los servicios criptográficos (bcrypt, AES-256).
*   **Aplicación**: Tests para los routers de tRPC (sesiones, recordatorios, exportación).

### Ejecutar Tests

```bash
cd platform
pnpm test
```

## Desarrollo Local

1.  Clonar el repositorio.
2.  Instalar dependencias: `pnpm install`
3.  Configurar variables de entorno (`.env`).
4.  Aplicar migraciones: `pnpm db:push`
5.  Iniciar servidor de desarrollo: `pnpm dev`