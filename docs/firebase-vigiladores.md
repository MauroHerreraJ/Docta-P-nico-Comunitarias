# Firebase y notificaciones push — Docta Comunitarias

Vigiladores **ya no vive en esta app**. Es un producto aparte (otro binario, otro package, otra ficha de store). Este documento queda para Comunitarias / calle y para no reutilizar la arquitectura vieja de “un solo APK, varios productos”.

Última actualización: 23 de octubre de 2026.

---

## Decisión de arquitectura

Esta ficha de Play Store es **solo Docta Comunitarias** (actualiza la app de calle). Mismo package que hoy está publicado.

| Pieza | Valor |
|---|---|
| Package Android | `com.pedrodarrigo.DesitAppV33` |
| Bundle iOS | `com.pedrodarrigo.DesitAppV33` |
| Proyecto Firebase | `pushappcomunitarias` |

Vigi necesita **su propia app Android** (otro `applicationId` y su propio `google-services.json`, aunque el proyecto Firebase pueda ser el mismo o uno nuevo). No se elige producto con código maestro en este cliente.

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

El token FCM es **de esta instalación** (Comunitarias). No se comparte con Vigi: esa app tendrá el suyo.

---

## Vigiladores (app aparte)

Vigi no debe reutilizar el package `com.pedrodarrigo.DesitAppV33` ni este `google-services.json`. Si el equipo de Vigi usa el mismo proyecto Firebase, hay que **registrar otra app Android** y generar otro archivo cliente.

1. Pedir acceso a quien administra `pushappcomunitarias` (o usar un proyecto nuevo).
2. Activar **Firebase Cloud Messaging API (V1)**.
3. Crear una **cuenta de servicio** de envío (JSON solo servidor).
4. Guardar el `fcm_token` de cada dispositivo de la app Vigi.
5. Enviar push con **FCM HTTP v1**.

### Payload mínimo que Comunitarias ya entiende

```json
{
  "title": "Alarma",
  "body": "La alarma de su zona se ha activado.",
  "data": {
    "tipo": "evento"
  }
}
```

Comportamiento actual del cliente (`App.js`):

| `data.tipo` | Qué hace la app |
|---|---|
| `chat` | Flujo de chat (Comunitarias) |
| `cambio_celular` | Se ignora |
| cualquier otro (o sin tipo) | Modal de evento en primer plano |

Este cliente **no filtra por producto**. Un push a este package llega a Comunitarias.

### Qué sí hace falta para Vigi

- Otro package / ficha de store
- Otro `google-services.json` (otra app Firebase)
- Registrar el token contra la licencia de Vigi, no contra la de Comunitarias

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

Quien administre `pushappcomunitarias` puede invitar al equipo de Vigi (rol Editor, o IAM equivalente para Cloud Messaging) solo si comparten proyecto, para:

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
Productos:    Comunitarias = este package; Vigi = otra app
```
