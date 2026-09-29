import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getMisDespachosApp } from "../../util/NuevaApi";

function objetivoLabel(cuenta) {
  if (!cuenta || typeof cuenta !== "object") return "Objetivo";
  return (
    String(cuenta.nombrefantasia || "").trim() ||
    String(cuenta.nombre || "").trim() ||
    "Objetivo"
  );
}

function prioridadColor(p) {
  if (p === "alta") return "#E74C3C";
  if (p === "baja") return "#7F8C8D";
  return "#EB7F27";
}

export default function AsignacionesPendientes() {
  const navigation = useNavigation();
  const { height } = useWindowDimensions();
  const compact = height < 720;

  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState([]);
  const [activos, setActivos] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMisDespachosApp();
      setPendientes(Array.isArray(data?.pendientes) ? data.pendientes : []);
      setActivos(Array.isArray(data?.activos) ? data.activos : []);
    } catch (error) {
      console.warn("[AsignacionesPendientes]", error?.message || error);
      Alert.alert("Sin conexión", "No se pudieron cargar las tareas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const abrir = (item) => {
    navigation.navigate("AsignacionDetalle", { id: item._id, despacho: item });
  };

  const maxPendientes = compact ? 3 : 4;
  const lista = pendientes.slice(0, maxPendientes);
  const extra = Math.max(0, pendientes.length - lista.length);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#EB7F27" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Tareas pendientes</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {pendientes.length
            ? `${pendientes.length} por aceptar · tocá IR`
            : "Sin tareas nuevas"}
        </Text>
      </View>

      {activos.length > 0 ? (
        <TouchableOpacity
          style={styles.activoBaner}
          onPress={() => abrir(activos[0])}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={16} color="#0F76C4" />
          <Text style={styles.activoTexto} numberOfLines={1}>
            En curso: {activos[0].titulo}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#0F76C4" />
        </TouchableOpacity>
      ) : null}

      <View style={styles.lista}>
        {lista.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={40} color="#B0B8C4" />
            <Text style={styles.emptyTitulo}>Sin pendientes</Text>
            <Text style={styles.emptySub} numberOfLines={2}>
              Cuando el operador envíe una tarea desde Asignaciones del DASH,
              aparece acá.
            </Text>
          </View>
        ) : (
          lista.map((item) => (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardMain}>
                <View
                  style={[
                    styles.prio,
                    { backgroundColor: prioridadColor(item.prioridad) },
                  ]}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitulo} numberOfLines={1}>
                    {item.titulo || "Tarea"}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {objetivoLabel(item.cuentaId)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.btnIr}
                  onPress={() => abrir(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnIrTexto}>IR</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        {extra > 0 ? (
          <Text style={styles.extra}>+{extra} más al actualizar</Text>
        ) : null}
      </View>

      <TouchableOpacity style={styles.refresh} onPress={load} activeOpacity={0.8}>
        <Ionicons name="refresh" size={16} color="#6B7280" />
        <Text style={styles.refreshTexto}>Actualizar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  header: { marginBottom: 8 },
  titulo: { fontSize: 18, fontWeight: "800", color: "#1A2332" },
  sub: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  activoBaner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(15,118,196,0.1)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  activoTexto: { flex: 1, fontSize: 12, fontWeight: "600", color: "#0F76C4" },
  lista: { flex: 1, justifyContent: "flex-start", gap: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  cardMain: { flexDirection: "row", alignItems: "center", gap: 10 },
  prio: { width: 8, height: 8, borderRadius: 4 },
  cardTitulo: { fontSize: 14, fontWeight: "700", color: "#1A2332" },
  cardMeta: { marginTop: 1, fontSize: 12, color: "#6B7280" },
  btnIr: {
    backgroundColor: "#EB7F27",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  btnIrTexto: { color: "#fff", fontWeight: "800", fontSize: 12 },
  extra: { textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 4 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  emptyTitulo: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    color: "#1A2332",
  },
  emptySub: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 17,
  },
  refresh: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  refreshTexto: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
});
