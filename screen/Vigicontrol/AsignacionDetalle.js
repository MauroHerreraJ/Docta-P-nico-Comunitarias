import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  aceptarDespachoApp,
  getDespachoApp,
  llegadaDespachoApp,
  partidaDespachoApp,
} from "../../util/NuevaApi";

function objetivoLabel(cuenta) {
  if (!cuenta || typeof cuenta !== "object") return "Objetivo";
  return (
    String(cuenta.nombrefantasia || "").trim() ||
    String(cuenta.nombre || "").trim() ||
    "Objetivo"
  );
}

function direccionLabel(cuenta) {
  if (!cuenta || typeof cuenta !== "object") return "";
  return [cuenta.direccion, cuenta.barrio, cuenta.ciudad]
    .filter((x) => String(x || "").trim())
    .join(", ");
}

function estadoLabel(estado) {
  const map = {
    pendiente: "Pendiente",
    aceptada: "Aceptada",
    en_sitio: "En sitio",
    partida: "Partida",
    finalizada: "Finalizada",
    cancelada: "Cancelada",
  };
  return map[estado] || estado || "—";
}

export default function AsignacionDetalle() {
  const route = useRoute();
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const id = route.params?.id;
  const [row, setRow] = useState(route.params?.despacho || null);
  const [loading, setLoading] = useState(!route.params?.despacho);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getDespachoApp(id);
      setRow(data);
    } catch (error) {
      console.warn("[AsignacionDetalle]", error?.message || error);
      Alert.alert("Error", "No se pudo cargar la tarea.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const runAction = async (fn, okMsg) => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const updated = await fn(id);
      setRow(updated);
      if (okMsg) Alert.alert("Listo", okMsg);
    } catch (error) {
      Alert.alert(
        "Atención",
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo completar",
      );
    } finally {
      setBusy(false);
    }
  };

  const onAceptar = () =>
    Alert.alert("Aceptar tarea", "¿Confirmás la recepción?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aceptar",
        onPress: () =>
          runAction(aceptarDespachoApp, "Tarea aceptada. Dirigite al objetivo."),
      },
    ]);

  const onLlegada = () =>
    runAction(llegadaDespachoApp, "Presencia notificada.");

  const onPartida = () =>
    Alert.alert("Partida", "¿Salís del objetivo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Partida",
        style: "destructive",
        onPress: () => runAction(partidaDespachoApp, "Partida registrada."),
      },
    ]);

  if (loading && !row) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#EB7F27" />
      </View>
    );
  }

  if (!row) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#6B7280" }}>Tarea no encontrada</Text>
      </View>
    );
  }

  const cuenta =
    row.cuentaId && typeof row.cuentaId === "object" ? row.cuentaId : null;
  const estado = row.estado || "pendiente";
  const dir = direccionLabel(cuenta);

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <Text style={styles.estado}>{estadoLabel(estado)}</Text>
        <Text style={styles.titulo} numberOfLines={compact ? 1 : 2}>
          {row.titulo}
        </Text>
        {row.detalle ? (
          <Text style={styles.detalle} numberOfLines={compact ? 2 : 3}>
            {row.detalle}
          </Text>
        ) : null}
        <Text style={styles.chips} numberOfLines={1}>
          {(row.tipo || "tarea").toUpperCase()} · Prioridad{" "}
          {(row.prioridad || "media").toUpperCase()}
        </Text>
      </View>

      <View style={[styles.card, { flex: 1 }]}>
        <Text style={styles.cardLabel}>Datos de la cuenta</Text>
        <Text style={styles.objetivo} numberOfLines={1}>
          {objetivoLabel(cuenta)}
        </Text>
        {cuenta?.nroorden ? (
          <Text style={styles.meta} numberOfLines={1}>
            Nº {cuenta.nroorden}
          </Text>
        ) : null}
        {dir ? (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color="#0F76C4" />
            <Text style={styles.rowTexto} numberOfLines={2}>
              {dir}
            </Text>
          </View>
        ) : null}
        {cuenta?.telefono ? (
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              Linking.openURL(`tel:${cuenta.telefono}`).catch(() => {})
            }
          >
            <Ionicons name="call-outline" size={16} color="#27AE60" />
            <Text style={[styles.rowTexto, styles.link]} numberOfLines={1}>
              {cuenta.telefono}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.meta}>Sin teléfono en el objetivo</Text>
        )}
      </View>

      <View style={styles.acciones}>
        {estado === "pendiente" ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={onAceptar}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTexto}>ACEPTAR</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {estado === "aceptada" ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnBlue]}
            onPress={onLlegada}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTexto}>LLEGADA</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {estado === "en_sitio" || estado === "aceptada" ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnDark]}
            onPress={onPartida}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTexto}>PARTIDA</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {["partida", "finalizada", "cancelada"].includes(estado) ? (
          <Text style={styles.cerrado}>Cerrada · {estadoLabel(estado)}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  hero: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
  },
  heroCompact: { paddingVertical: 10 },
  estado: {
    fontSize: 10,
    fontWeight: "800",
    color: "#EB7F27",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  titulo: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: "800",
    color: "#1A2332",
  },
  detalle: {
    marginTop: 4,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
  chips: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0F76C4",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  objetivo: { fontSize: 15, fontWeight: "700", color: "#1A2332" },
  meta: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
  },
  rowTexto: { flex: 1, fontSize: 13, color: "#1A2332", lineHeight: 18 },
  link: { color: "#27AE60", fontWeight: "600" },
  acciones: { gap: 8 },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 11,
  },
  btnPrimary: { backgroundColor: "#EB7F27" },
  btnBlue: { backgroundColor: "#0F76C4" },
  btnDark: { backgroundColor: "#2C3E50" },
  btnTexto: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.4,
  },
  cerrado: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 12,
    paddingVertical: 8,
  },
});
