# Distinguir **Deshabilitar** vs **Dar de baja**

Documento para el equipo de Docta 4.  
App: Docta Comunitarias (`com.pedrodarrigo.DesitAppV33`)  
API: `https://docta4-api-5pmryov7ba-uc.a.run.app`

Última actualización: 9 de octubre de 2026.

---

## Problema

Hoy **Deshabilitar** y **Dar de baja** responden **401** en pánico y en `GET /modulo/dispositivos/yo`. El cliente no puede diferenciarlos.

| Acción | Lo que debe pasar en la app |
|---|---|
| **Deshabilitar** | El usuario se queda en la app, con un modal bloqueante, hasta que **habiliten** de nuevo la licencia. El token y los datos locales se conservan. |
| **Dar de baja** | La licencia deja de existir. Se avisa al usuario y, al aceptar, vuelve a la pantalla Master (alta de cero). |

Sin un código o `motivo` distinto, la baja queda atrapada en el modal de “cuenta deshabilitada”, que **no tiene botón de salida**.

---

## 1. Deshabilitar (ya cubierto por la app)

La licencia sigue existiendo; solo está inactiva.

| Campo | Valor |
|---|---|
| HTTP | `401` o `403` |
| Token del dispositivo | **No invalidar de forma permanente.** Al **Habilitar**, el mismo `accessToken` tiene que volver a funcionar. |
| `GET /modulo/dispositivos/yo` deshabilitada | `401` / `403`, **o** `200` con status inactivo |
| `GET /modulo/dispositivos/yo` al rehabilitar | `200` (dispositivo válido) |
| Pánico / chat / ubicación deshabilitada | `401` o `403` |

Body recomendado:

```json
{
  "motivo": "deshabilitada",
  "code": "LICENSE_DISABLED",
  "message": "La licencia está deshabilitada"
}
```

La app muestra:

> Su cuenta está deshabilitada, comuníquese con su administrador.

Sin botón. El modal se cierra solo cuando `yo` vuelve a `200` (o deja de ser 401/403).

---

## 2. Dar de baja (cambio a implementar en el servidor)

La licencia se elimina. El dispositivo ya no debe existir.

| Campo | Valor |
|---|---|
| HTTP | **`410 Gone`** (preferido) o **`404 Not Found`** |
| Body | Obligatorio, para no confundir con otros 404 |
| Token | Deja de ser válido. No hay “rehabilitar” esa misma licencia. |
| `GET /modulo/dispositivos/yo` | `410` o `404` con el mismo body |
| Pánico / chat / ubicación | `410` o `404` con el mismo body |

Body requerido:

```json
{
  "motivo": "eliminada",
  "code": "LICENSE_DELETED",
  "message": "La licencia fue dada de baja"
}
```

La app mostrará:

> Licencia eliminada, contactarse con administrador.

Botón **Aceptar** → borra la sesión local y va a la pantalla Master.

**No usar 401 para la baja.** Ese código ya está reservado a deshabilitar / sesión inactiva recuperable.

---

## Resumen

| Acción en el dashboard | HTTP | `motivo` / `code` | Al revertir |
|---|---|---|---|
| Deshabilitar | `401` o `403` | `deshabilitada` / `LICENSE_DISABLED` | El mismo token sirve al Habilitar |
| Habilitar | `200` en `yo` y en pánico | — | — |
| Dar de baja | `410` (o `404`) | `eliminada` / `LICENSE_DELETED` | No aplica; hay que registrar de nuevo |

Endpoints a alinear (mismo criterio en todos):

- `GET /modulo/dispositivos/yo`
- `POST /modulo/panico-comunitario`
- `POST /modulo/eventos/ubicacion`
- `GET` y `POST /modulo/chat/mensajes`
- `POST /modulo/chat/adjuntos`

---

## Qué no hacer

- Mandar **401** tanto en deshabilitar como en baja.
- Borrar el dispositivo al **Deshabilitar** (eso es dar de baja).
- Al **Habilitar**, exigir un register nuevo: la app conserva `@device_token` a propósito.

---

## Cómo probar

1. Licencia activa → pánico `200`.
2. Deshabilitar → pánico / `yo` `401` o `403` + `LICENSE_DISABLED` → modal sin botón.
3. Habilitar → `yo` `200` → el modal desaparece; pánico `200`.
4. Dar de baja → pánico / `yo` `410` + `LICENSE_DELETED` → (cuando esté el cliente) modal con Aceptar → Master.
5. Un **401 de baja no es correcto**.

Cuando esté disponible en un ambiente (aunque sea solo `yo` y pánico), enviar un ejemplo real de status + body para engancharlo en la app.
