# Borrado de licencia iniciado por el usuario (Google Play)

Documento para el equipo de Docta 4.  
App: Docta Comunitarias (`com.pedrodarrigo.DesitAppV33`)  
API: `https://docta4-api-5pmryov7ba-uc.a.run.app`

Última actualización: 14 de octubre de 2026.

---

## Por qué hace falta

Google Play exige que el usuario pueda borrar su cuenta / datos desde la app.  
En **Sistema** está el botón **Eliminar Licencia y Datos**. El vecino confirma con los últimos 4 caracteres de su licencia.

Hoy ese botón, en Docta 4, debe **dar de baja este teléfono en el servidor**. Si solo se limpia el celular, el dispositivo queda huérfano en Docta 4.

Esto **no** es el “Dar de baja” del dashboard (admin). Es el vecino pidiendo borrar *su* instalación.

El producto **legacy (Desit Server / calle)** sigue usando `DELETE /api/v1/user/delete-account`. No hay que tocarlo.

---

## Contrato pedido

### `DELETE /modulo/dispositivos/yo`

Baja **este dispositivo** autenticado (el del `Authorization`).

| Campo | Valor |
|---|---|
| Método | `DELETE` |
| URL | `/modulo/dispositivos/yo` |
| Headers | `Authorization: Bearer <accessToken>` |
| | `X-Docta-App-Key: <app key>` |
| Body | ninguno (la identidad va en el token) |

### Respuesta OK

HTTP `200` o `204`. Body opcional, por ejemplo:

```json
{
  "status": "deleted",
  "message": "Dispositivo dado de baja por el usuario"
}
```

Efecto en servidor:

- El dispositivo deja de existir (mismo resultado operativo que una baja, pero originada por el vecino).
- Ese `accessToken` deja de servir.
- No debe quedar el teléfono asociado a la licencia.
- La licencia/cupo del equipo puede quedar libre para un alta nueva (definir política: ¿se libera el cupo o solo se desvincula este device?). **Preferencia de la app: liberar el cupo de este teléfono** para que pueda registrarse de nuevo o usar otro celular.

### Errores

| HTTP | Cuándo |
|---|---|
| `401` | Token inválido (no confundir con `LICENSE_DISABLED`) |
| `403` + `LICENSE_DISABLED` | Licencia deshabilitada; el usuario no puede auto-borrarse hasta habilitar, o sí se permite la baja igual. **Preferencia: permitir el DELETE aunque esté deshabilitada**, para cumplir Play. |
| `404` / `410` | Ya no existe; la app puede tratarlo como éxito y limpiar local. |

La app llama este `DELETE` con `skipAuthHandler` para no abrir los modales de deshabilitada/eliminada a mitad del flujo. Si el servidor responde OK, limpia sesión local y vuelve a Master.

---

## Qué no es

| Acción | Quién | Endpoint / código |
|---|---|---|
| Deshabilitar | Admin dashboard | `401` + `LICENSE_DISABLED` |
| Dar de baja (admin) | Admin dashboard | `410` + `LICENSE_DELETED` |
| Eliminar licencia y datos | **Vecino en la app** | `DELETE /modulo/dispositivos/yo` |
| Reset admin (clave Desit) | Soporte en el teléfono | Solo AsyncStorage local; **no** pega al servidor |

---

## Cómo probar

1. App Docta 4 registrada, pánico `200`.
2. Sistema → Eliminar Licencia y Datos → últimos 4 caracteres de la licencia.
3. Servidor recibe `DELETE /modulo/dispositivos/yo` con el Bearer de ese teléfono.
4. Respuesta `200`/`204`.
5. La app borra token/master/licencia local y abre Master.
6. Ese token ya no sirve en `GET /modulo/dispositivos/yo`.
7. Un alta nueva (mismo u otro teléfono, según cupo) debe poder registrarse.

Legacy: el mismo botón sigue pegando a Desit `delete-account`. No debe pasar por `/modulo/dispositivos/yo`.

---

## Resumen para implementar

```
DELETE /modulo/dispositivos/yo
Authorization: Bearer <token>
X-Docta-App-Key: <key>

→ 200/204 y el dispositivo deja de existir en Docta 4
```

Cuando esté en el ambiente, avisar un ejemplo de status + body para validar el cliente.
