# Bot de Apoyo DANA Valencia 🤖

## Descripción General

Este bot de Telegram facilita la conexión entre las familias afectadas por la DANA (un evento meteorológico severo) en Valencia y los profesionales voluntarios dispuestos a ayudar. El bot actúa como un puente entre aquellos que necesitan ayuda y quienes pueden ofrecer asistencia especializada.

Prueba el bot aquí: [@AyudaDANA_Mamas_Valencia_bot](https://t.me/AyudaDANA_Mamas_Valencia_bot)

## Propósito

El bot fue creado para:

- Ayudar a los padres afectados a registrar sus necesidades
- Permitir que los profesionales voluntarios ofrezcan sus servicios
- Facilitar el proceso de emparejamiento entre necesidades y ayuda disponible
- Proporcionar una forma estructurada de gestionar solicitudes de asistencia

## Funcionalidades

### Sistema de Registro Dual

- Los padres pueden registrarse y enviar solicitudes de ayuda
- Los profesionales pueden registrarse como voluntarios

### Gestión de Solicitudes de Ayuda

- Sistema de formularios estructurado para necesidades específicas
- Seguimiento del estado de las solicitudes

### Gestión de Perfil de Usuario

- Los usuarios pueden ver y gestionar sus datos
- Acceso al historial de solicitudes

## Implementación Técnica

El bot está construido usando:

- **grammY** - Un framework moderno para bots de Telegram
- **Supabase Edge Functions** - Implementación sin servidor (serverless)
- **Deno** - Un entorno de ejecución moderno para JavaScript/TypeScript

## Arquitectura

### Componentes Clave

- Manejo de actualizaciones basadas en webhook
- Gestión de sesiones a través de Supabase
- Control de acceso basado en roles (MADRE/COLABORADOR)
- Gestión de flujo de formularios estructurados

## Contribuciones

¡Las contribuciones son bienvenidas! No dudes en enviar un Pull Request.

## Licencia

Licencia MIT

## Soporte

Si necesitas ayuda o deseas reportar un problema, abre un issue en GitHub o contáctanos a través de Telegram.
