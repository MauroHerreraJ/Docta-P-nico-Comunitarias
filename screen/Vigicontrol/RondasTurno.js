import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getMisRondasApp } from "../../util/NuevaApi";
import { flushRondaQueue, getRondaQueue } from "../../util/rondaQueue";

function horaLabel(value) {
  const text = String(value || "").trim();
  return text || "Sin hora";
}

function estadoTexto(ronda) {
  if (ronda.estado === "cerrada") return "Cerrada";
  if (ronda.estado === "cierre_pendiente") return "Cierre pendiente";
  if (ronda.estado === "en_curso") return `${ronda.hechas}/${ronda.total} puntos`;
  if (ronda.estado === "pendiente") return "Sin iniciar";
  return ronda.total ? `${ronda.total} puntos` : "Sin puntos";
}

function mergeQueue(rondas, queue) {
  return (rondas || []).map((ronda) => {
    const extra = queue.filter(
      (item) =>
        item.kind === "marcar" && String(item.rondaId) === String(ronda.rondaId),
    );
    const marcas = [...(ronda.marcas || [])];
    for (const item of extra) {
      const puntoId = String(item.puntoId);
      if (!marcas.some((marca) => marca.puntoId === puntoId)) {
        marcas.push({ puntoId, at: item.at, pending: true });
      }
    }
    const hechas = (ronda.puntos || []).filter((punto) =>
      marcas.some((marca) => marca.puntoId === String(punto._id)),
    ).length;
    const cierrePendiente = queue.some(
      (item) =>
        item.kind === "cerrar" && String(item.rondaId) === String(ronda.rondaId),
    );
    const inicioPendiente = queue.some(
      (item) =>
        item.kind === "iniciar" && String(item.rondaId) === String(ronda.rondaId),
    );
    let estado = ronda.estado;
    if (ronda.estado !== "cerrada" && cierrePendiente) estado = "cierre_pendiente";
    else if (ronda.estado === "pendiente" && (inicioPendiente || hechas > 0)) {
      estado = "en_curso";
    }
    return { ...ronda, marcas, hechas, estado };
  });
}

export default function RondasTurno() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await flushRondaQueue().catch(() => {});
      const [payload, queue] = await Promise.all([
        getMisRondasApp(),
        getRondaQueue(),
      ]);
      setData({
        ...payload,
        rondas: mergeQueue(payload?.rondas, queue),
        pendientes: queue.length,
      });
    } catch (error) {
      console.warn("[RondasTurno]", error?.message || error);
      Alert.alert("Sin conexión", "No se pudieron cargar las rondas del turno.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E86C1" />
      </View>
    );
  }

  const rondas = data?.rondas || [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Rondas del turno</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {data?.objetivo || "Sin objetivo"}
          {data?.enCurso ? "" : " · el turno no está en curso"}
        </Text>
      </View>

      {data?.pendientes > 0 ? (
        <View style={styles.banner}>
          <Ionicons name="cloud-upload-outline" size={16} color="#B45309" />
          <Text style={styles.bannerTexto}>
            {data.pendientes} marca{data.pendientes === 1 ? "" : "s"} sin enviar
          </Text>
        </View>
      ) : null}

      <View style={styles.lista}>
        {rondas.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="walk-outline" size={40} color="#B0B8C4" />
            <Text style={styles.emptyTitulo}>Sin rondas</Text>
            <Text style={styles.emptySub}>
              {data?.asignacionId
                ? "Este turno no tiene recorridos cargados."
                : "Cuando tengas un turno con rondas, aparecen acá."}
            </Text>
          </View>
        ) : (
          rondas.map((ronda) => {
            const cerrada = ronda.estado === "cerrada";
            return (
              <TouchableOpacity
                key={ronda.rondaId}
                style={styles.card}
                onPress={() =>
                  navigation.navigate("RondaRecorrido", { rondaId: ronda.rondaId })
                }
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.punto,
                    cerrada && styles.puntoHecho,
                    ronda.estado === "en_curso" && styles.puntoCurso,
                  ]}
                >
                  <Ionicons
                    name={cerrada ? "checkmark" : "walk"}
                    size={16}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitulo} numberOfLines={1}>
                    {ronda.nombre}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {horaLabel(ronda.horaInicio)} · {estadoTexto(ronda)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            );
          })
        )}
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  bannerTexto: { flex: 1, fontSize: 12, fontWeight: "600", color: "#B45309" },
  lista: { flex: 1, gap: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  punto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2E86C1",
    alignItems: "center",
    justifyContent: "center",
  },
  puntoCurso: { backgroundColor: "#EB7F27" },
  puntoHecho: { backgroundColor: "#16A085" },
  cardTitulo: { fontSize: 15, fontWeight: "700", color: "#1A2332" },
  cardMeta: { marginTop: 2, fontSize: 12, color: "#6B7280" },
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
