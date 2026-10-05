import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { codigoNfcDocta } from "../../util/codigoNfc";

export function textoDeTagNfc(tag, Ndef) {
  const records = Array.isArray(tag?.ndefMessage) ? tag.ndefMessage : [];
  for (const record of records) {
    try {
      const texto = Ndef.text.decodePayload(record.payload);
      if (texto) return texto;
    } catch {
      /* otro tipo de registro */
    }
    try {
      const uri = Ndef.uri.decodePayload(record.payload);
      if (uri) return uri;
    } catch {
      /* no es uri */
    }
  }
  return "";
}

export default function LectorNfc() {
  const ultimo = useRef({ codigo: "", at: 0 });

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    let activo = true;
    let NfcManager;
    let Ndef;
    let NfcTech;
    try {
      const lib = require("react-native-nfc-manager");
      NfcManager = lib.default;
      Ndef = lib.Ndef;
      NfcTech = lib.NfcTech;
    } catch {
      return undefined;
    }

    const avisar = (codigo) => {
      const ahora = Date.now();
      if (ultimo.current.codigo === codigo && ahora - ultimo.current.at < 4000) return;
      ultimo.current = { codigo, at: ahora };
      Alert.alert("Tag NFC", `Código ${codigo}`);
    };

    const escuchar = async () => {
      try {
        const hay = await NfcManager.isSupported();
        if (!hay || !activo) return;
        await NfcManager.start();
      } catch {
        return;
      }
      while (activo) {
        try {
          await NfcManager.requestTechnology(NfcTech.Ndef, {
            alertMessage: "Acercá el tag del puesto",
          });
          const tag = await NfcManager.getTag();
          const codigo = codigoNfcDocta(textoDeTagNfc(tag, Ndef));
          if (codigo) avisar(codigo);
        } catch {
          if (!activo) break;
        } finally {
          try {
            await NfcManager.cancelTechnologyRequest();
          } catch {
            /* ya estaba cerrado */
          }
        }
      }
    };

    escuchar();
    return () => {
      activo = false;
      NfcManager?.cancelTechnologyRequest?.().catch(() => {});
    };
  }, []);

  return null;
}
