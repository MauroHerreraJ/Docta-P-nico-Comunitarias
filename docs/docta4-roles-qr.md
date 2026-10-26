# Roles Comunitarias: dos códigos / dos QR

Documento para el equipo de Docta 4.  
App: Docta Comunitarias (`com.pedrodarrigo.DesitAppV33`)  
API: `https://docta4-api-5pmryov7ba-uc.a.run.app`  
Host de stickers (hoy): `https://docta-4-sm-front-dev.web.app`

Última actualización: 26 de octubre de 2026.

---

## Contexto

Hay **una sola app** y **un solo package**. Es la misma ficha de Play Store que ya está en calle. No hay app “pro” y app “base”.

En Comunitarias (Docta 4) el vecino puede tener uno de dos roles:

| Rol | Qué habilita la app |
|---|---|
| `botonera` | Solo botonera (pánico, luces, sirena). Sin chat ni adjuntos. |
| `multimedia` | Botonera + Multimedia (fotos, audio, chat con la central). |

El vecino **no elige el rol** en la app. Docta 4 le entrega un QR o un código que **ya corresponde** a un rol. La app solo diferencia un código del otro y prende o apaga Multimedia.

Calle (licencia legacy en AsyncStorage, Desit Server) **no usa estos QR** y no cambia.

---

## Qué tiene que emitir Docta 4

Cada equipo (alarma de calle) tiene **dos alias distintos** de 7 dígitos. Los dos apuntan al **mismo equipo, municipio y sector**. Cambia el identificador, no el destino.

| Acceso | Entrega | Ejemplo |
|---|---|---|
| Botonera | QR A **y** el número impreso bajo ese QR | `https://docta-4-sm-front-dev.web.app/q/1234567` |
| Multimedia | QR B **y** el número impreso bajo ese QR | `https://docta-4-sm-front-dev.web.app/q/7654321` |

`1234567` y `7654321` son **códigos distintos**. Si fueran el mismo, tipeando no se podría saber el rol sin preguntarle al vecino, y eso no está permitido.

En la pantalla de Comunitarias y en el sticker PDF: los dos QR, cada uno con su número.

El formato del link se mantiene: `/q/{codigo}`. No hace falta `?rol=` en la URL: el código ya determina el camino.

### Cámara rota (tipeo)

El tipeo es solo el plan B de la cámara. El vecino ingresa **el número que está impreso bajo el QR que le corresponde**.

- Tipea el de botonera → queda `botonera`.
- Tipea el de multimedia → queda `multimedia`.

No hay pantalla “¿qué acceso necesita?”.

### Si no tiene la app

La landing de **ambos** links manda a la **misma** ficha de Play Store (`com.pedrodarrigo.DesitAppV33`). El Install Referrer lleva el código de **ese** QR:

```
docta_codigo=7654321
```

Al instalar, la app hace lookup de ese código y recibe el rol.

---

## Contrato API

### 1. Lookup

`POST /modulo/onboarding/lookup`

Body (igual que hoy):

```json
{
  "code": "7654321"
}
```

La app **no** manda el rol. Lo infiere Docta 4 a partir del alias.

Respuesta OK (campos actuales + `rol`):

```json
{
  "canRegister": true,
  "rol": "multimedia",
  "municipality": {},
  "equipment": "...",
  "detail": null
}
```

| Campo | Notas |
|---|---|
| `code` | Uno de los dos alias del equipo |
| `rol` | Obligatorio. Solo `botonera` o `multimedia` |
| Cupo | Es del **equipo**, no del rol. Los dos alias consumen el mismo stock |

Código inexistente: `404` como hoy (“Código incorrecto, revise el sticker”).

### 2. Register

`POST /modulo/onboarding/register`

El alta queda asociada al rol de **ese** alias. Guardar `rol` en el dispositivo / licencia.

No hace falta que la app reenvíe el rol si el servidor ya lo tiene atado al `code` del lookup. Si el register igual lo recibe, debe coincidir con el alias; no se puede “cambiar de rol” en el alta.

### 3. Recover (cambio de celular)

Devolver el **mismo rol** que tenía esa licencia. No se vuelve a elegir por QR, salvo un alta nueva.

### 4. Status

`GET /modulo/dispositivos/yo` debe incluir:

```json
{
  "rol": "botonera"
}
```

Así, si el admin cambia el rol en el dashboard, la app lo toma en el poll que ya existe (sin reinstalar).

Si `rol` no viene, la app asume **`botonera`** (no abrir Multimedia por error).

Valores válidos: `botonera` | `multimedia`. Nada más.

---

## Qué hará la app

| Rol | Pánico | “¿Adjuntar información?” | Pestaña Chat | Push de chat |
|---|---|---|---|---|
| `botonera` | Sí | No | No | Se ignora |
| `multimedia` | Sí | Sí | Sí | Abre Multimedia |
| calle / legacy | Sí (Desit Server) | No | No | No aplica |

Flujo de alta:

1. Extrae el código de 7 dígitos (QR `/q/…`, link, `docta_codigo=`, o tipeo).
2. `POST lookup` solo con `{ "code" }`.
3. Guarda el `rol` que devolvió Docta 4.
4. Sigue el registro como hoy (datos del vecino, token, etc.).

---

## Lo que no hay que hacer

- Otro package Android, otro `google-services.json` u otra ficha de store para el QR “pro”.
- El mismo número de 7 dígitos en los dos QR.
- Preguntarle el rol al vecino en la app.
- Registrar el alta de estos QR contra Desit Server. Es **siempre Docta 4**.
- Distinguir el rol con un query `?rol=` en lugar de dos alias. El tipeo tiene que funcionar con el número del sticker.

## App Links / SHA-256

Sigue siendo **una** app. La huella SHA-256 y Digital Asset Links son las de `com.pedrodarrigo.DesitAppV33`. Los dos QR usan el mismo host y el mismo `pathPrefix` `/q/`.
