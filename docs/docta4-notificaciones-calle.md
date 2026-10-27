# Notificaciones de alarma de calle

Documento para el equipo de Docta 4.  
App: Docta Comunitarias (`com.pedrodarrigo.DesitAppV33`)  
API: `https://docta4-api-5pmryov7ba-uc.a.run.app`  
Firebase: proyecto `pushappcomunitarias` (misma cuenta de servicio que ya tienen)

Última actualización: 26 de octubre de 2026.

---

## Contexto

En calle (Desit Server + Thunder) esto **ya funciona**. Hay que replicarlo en Docta 4 **sin cambiar el envío del pánico**.

El pánico y la notificación **no son el mismo momento**.

1. El vecino toca pánico → la app manda el evento al instante → Docta 4 lo procesa y se lo dispara a Thunder / al software, como hoy. Multimedia, GPS y chat siguen su curso.
2. Recién cuando **el equipo de calle despierta y suena**, Thunder avisa. Ahí se arma el push.

Si el FCM sale al recibir el evento `120`, se avisa antes de que suene la calle. Eso no es el producto.

Calle (licencia legacy, Desit Server) no cambia. Este documento es solo para Comunitarias en Docta 4.

---

## Flujo

```
App  -- POST pánico (120) -->  Docta 4  -->  Thunder  -->  equipo de calle
App: botonera activa, multimedia, ubicación          (no espera el push)

Equipo suena
Thunder  -- callback -->  Docta 4
          { deviceId, accountNumber }

Docta 4:
  - busca la licencia de ese equipo + cuenta  →  nombre de quien disparó
  - busca todas las licencias de ese equipo   →  fcm_token de cada teléfono
  - manda FCM
```

---

## 1. Lo que la app ya manda (no tocar)

`POST /modulo/panico-comunitario`  
Bearer del dispositivo + `X-Docta-App-Key`

Evento típico de pánico: código **`120`**.

También van:

| Código | Botón |
|---|---|
| `120` | Pánico |
| `140` | Cancelar pánico |
| `104` | Desactivar |
| `121` | Sirena |
| `122` | Reflector |

El body incluye `event` (id, code, timestamp, target_device, location) y `user` (Vecino, etc.).

La app **no** espera confirmación de calle. Un 200 del POST alcanza para seguir (Multimedia, GPS).

Cada teléfono ya registra `fcm_token` en el alta (`register` / `recover`) y en `PATCH /modulo/dispositivos/fcm`.

---

## 2. Lo que Thunder avisa a Docta 4

Cuando el equipo **se activó de verdad**, Thunder llama al servidor. En Desit es:

`POST /api/v1/push-notification/thunder-webhook`

Body:

```json
{
  "deviceId": "1005",
  "accountNumber": "0042"
}
```

| Campo | Qué es |
|---|---|
| `deviceId` | Número de equipo (4 dígitos, ej. `1005` / `5016`) |
| `accountNumber` | Número de cuenta de quien disparó (ej. `0042` / `0008`) |

Thunder **no** manda el nombre ni los tokens. Solo esos dos datos, **después** de que sonó.

Docta 4 necesita un endpoint equivalente. URL y autenticación se definen con Thunder. Respuesta esperada: **200**.

---

## 3. Qué hace Docta 4 con ese callback

1. Buscar la licencia `deviceId` + `accountNumber` → nombre (campo de perfil, p. ej. Vecino / Nombre).
2. Listar **todas** las licencias activas de ese `deviceId`, con `fcm_token`.
3. Enviar FCM HTTP v1 (proyecto `pushappcomunitarias`) a cada token.

### Textos

| Destinatario | Título | Cuerpo |
|---|---|---|
| Quien disparó (esa `accountNumber`) | Alarma activada | La alarma ha sonado exitosamente en la calle. |
| Resto del mismo equipo | Alarma activada | Mauro activó la alarma. |

Usar el nombre real de la licencia. Si no hay nombre: “Un vecino activó la alarma.”

Quien disparó **también** recibe push. Si no, no se entera de que la calle sonó.

---

## 4. Payload FCM que la app ya entiende

Quien disparó:

```json
{
  "title": "!Alarma Activada!",
  "body": "La alarma ha sonado exitosamente en la calle.",
  "data": {
    "tipo": "evento",
    "deviceId": "1005",
    "accountNumber": "0042"
  }
}
```

Vecinos: mismo `tipo`, otro `body` (`"Mauro activó la alarma"`).

La app muestra el `body` en el modal. No hace falta que el cliente arme el texto.

No usar `tipo: chat` (eso abre Multimedia).

Opcional en `data`: `triggeredByAccountNumber` o `isSelf`, por si más adelante la app quiere distinguir sin mirar el texto.

---

## 5. Qué no hay que hacer

- No mandar este push al aceptar el `POST` de pánico.
- No frenar el evento a Thunder hasta el callback.
- No mezclar equipos distintos.
- No notificar a dispositivos sin token o con licencia dada de baja.

Cancelación (`140`) y desactivar (`104`) siguen yendo a Thunder como eventos. Este documento cubre el aviso de **“la calle sonó”** del `120`.

---

## 6. Prueba de punta a punta

1. Dos teléfonos en el **mismo equipo**, cuentas distintas, `fcm_token` cargado.
2. Uno dispara pánico → el evento llega a Thunder / al software **ya**.
3. Hasta que el equipo no suene, **nadie** recibe este push.
4. Cuando suena, Thunder pega el callback.
5. El que apretó ve “sonó en la calle”; el otro ve “{nombre} activó la alarma”.

Si el callback llega y no hay push: revisar tokens y que el `deviceId` / `accountNumber` coincidan con el alta (en Comunitarias el equipo a veces es `license.deviceId` / `targetDeviceId`).

---

## Resumen para implementar

1. Endpoint de callback Thunder → Docta 4 (`deviceId` + `accountNumber`).
2. Lookup de disparador + vecinos del equipo.
3. FCM con dos textos, `data.tipo = evento`.
4. Disparo del push **solo** en ese callback.

La app Comunitarias en `feature/multiApp` ya recibe y muestra ese push. Del lado cliente no hace falta un contrato nuevo de pantalla.
