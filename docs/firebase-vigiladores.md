# Firebase y notificaciones push — Comunitarias / Vigiladores

Documento para el equipo de Vigiladores y productos futuros de la misma app.

Última actualización: 7 de octubre de 2026.

---

## Decisión de arquitectura

Docta Comunitarias, Vigiladores y los productos que se sumen viven **en el mismo binario**.

| Pieza | Valor |
|---|---|
| Package Android | `com.pedrodarrigo.DesitAppV33` |
| Bundle iOS | `com.pedrodarrigo.DesitAppV33` |
| Proyecto Firebase | uno solo: `pushappcomunitarias` |

No hay que crear otro proyecto Firebase ni otra app Android por producto.

Firebase identifica la app por el package, no por “Comunitarias” o “Vigiladores”. El backend distingue el producto por **usuario / licencia / código maestro**, no por package.

### Por qué no es un problema

- Una sola ficha en Play Store / App Store.
- Un solo `google-services.json`.
- Un token FCM por instalación de la app.
- Escala a productos futuros sin reconfigurar Firebase.

### Cuándo sí haría falta otro package

Solo si se quisieran **dos apps instaladas a la vez** (por ejemplo un ícono “Docta Comunitarias” y otro “Docta Vigiladores”). Ese no es el caso.

---

## Proyecto Firebase

| Campo | Valor |
|---|---|
| Project ID | `pushappcomunitarias` |
| Project number | `541814841492` |
| Storage bucket | `pushappcomunitarias.firebasestorage.app` |
| Consola | https://console.firebase.google.com/project/pushappcomunitarias |

### App Android (la única)

| Campo | Valor |
|---|---|
| Package / applicationId | `com.pedrodarrigo.DesitAppV33` |
| App ID (`mobilesdk_app_id`) | `1:541814841492:android:050050190bc8072cb81481` |
| Archivo cliente | `google-services.json` (ya está en el repo de la app) |

El `google-services.json` de la app **no sirve para enviar push desde el servidor**.

---

## Cómo llega un evento al celular

1. El usuario acepta permiso de notificaciones (dispositivo físico).
2. La app obtiene el **token FCM nativo** con `expo-notifications` (`getDevicePushTokenAsync`).
3. Ese token se registra en el backend como `fcm_token`.
4. Cuando hay un evento, el servidor envía un push FCM HTTP v1 a ese token.
5. La app lo recibe (`expo-notifications`) y muestra modal / abre el flujo correspondiente.

Canal Android configurado en la app:

- nombre: `default`
- importancia: máxima
- vibración activa

El token es **de la instalación**, no del producto. Si el mismo celular pasa de Comunitarias a Vigiladores, hay que **volver a registrar el token** contra la licencia/usuario de Vigi. Si no, los eventos pueden quedar atados a la sesión anterior.

---

## Qué tiene que hacer el backend de Vigiladores

1. Usar el proyecto `pushappcomunitarias` (pedir acceso a quien lo administra).
2. Activar **Firebase Cloud Messaging API (V1)**.
3. Crear una **cuenta de servicio**:
   - Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.
   - El JSON resultante es **solo servidor**. No va en la app ni en el repo público.
4. Guardar el `fcm_token` de cada dispositivo vinculado al usuario/licencia de Vigiladores.
5. Al ocurrir un evento, enviar el push con **FCM HTTP v1** (no la API legacy / server key).

### Payload mínimo que la app ya entiende

```json
{
  "title": "Evento de vigilancia",
  "body": "Texto que ve el vigilador",
  "data": {
    "tipo": "evento",
    "producto": "vigilantes"
  }
}
```

Comportamiento actual del cliente (`App.js`):

| `data.tipo` | Qué hace la app |
|---|---|
| `chat` | Flujo de chat (Comunitarias) |
| `cambio_celular` | Se ignora |
| cualquier otro (o sin tipo) | Modal de evento en primer plano |

Conviene incluir siempre `producto: vigilantes` (u otro código de producto) para filtrar en el cliente más adelante.

### Qué no hace falta

- Nuevo proyecto Firebase
- Nuevo package
- Otro `google-services.json` para Vigi

---

## iOS

La lógica de la app (permiso, listeners, modal, abrir un flujo al tocar el push) puede correr en iPhone. **Que el push llegue todavía no está cerrado.**

Hace falta, además de lo de Android:

- iPhone físico y build nativo (IPA / TestFlight), no simulador
- capability **Push Notifications** en Apple
- app iOS en el mismo proyecto Firebase y `GoogleService-Info.plist`
- clave APNs subida a Firebase
- que el backend envíe a un token válido de iOS (FCM de iOS, no un token APNs crudo si el servidor solo habla FCM)

Hoy en `app.json` hay `google-services.json` solo para Android: no hay `GoogleService-Info.plist` ni `aps-environment`.

Cuando eso esté, el mismo contrato de `fcm_token` + payload puede usarse en iPhone.

---

## Accesos

Quien administre `pushappcomunitarias` debe invitar al equipo de Vigiladores (rol Editor, o IAM equivalente para Cloud Messaging) para:

- ver el proyecto
- generar la cuenta de servicio de envío
- (más adelante) configurar la app iOS y APNs

---

## Referencia rápida para copiar

```
Proyecto:     pushappcomunitarias
Número:       541814841492
Package:      com.pedrodarrigo.DesitAppV33
App ID:       1:541814841492:android:050050190bc8072cb81481
Consola:      https://console.firebase.google.com/project/pushappcomunitarias
Token cliente: FCM nativo (fcm_token)
Envío:        FCM HTTP v1 + cuenta de servicio
Productos:    same package; distinguir por licencia / data.producto
```
