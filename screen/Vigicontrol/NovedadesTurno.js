import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { crearNovedadApp, getMisNovedadesApp } from "../../util/NuevaApi";
import { formatHoraBA } from "../../util/horaBA";

function apiMessage(error, fallback) {
  const msg = error?.response?.data?.message;
  if (Array.isArray(msg)) return String(msg[0] || fallback);
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export default function NovedadesTurno() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await getMisNovedadesApp();
      setData(payload);
    } catch (error) {
      console.warn("[NovedadesTurno]", error?.message || error);
      Alert.alert("Sin conexión", "No se pudo abrir el libro de novedades.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onEnviar = async () => {
    const nota = String(texto || "").trim();
    if (!nota || sending) return;
    if (!data?.enCurso) {
      Alert.alert("Turno", "El turno no está en curso.");
      return;
    }
    setSending(true);
    try {
      const res = await crearNovedadApp({
        texto: nota,
        at: new Date().toISOString(),
        clientId: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
      const creada = res?.novedad;
      if (creada) {
        setData((prev) => ({
          ...(prev || {}),
          novedades: [...(prev?.novedades || []), creada],
        }));
      }
      setTexto("");
    } catch (error) {
      Alert.alert("No se guardó", apiMessage(error, "Probá de nuevo."));
    } finally {
      setSending(false);
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8E44AD" />
      </View>
    );
  }

  const novedades = data?.novedades || [];
  const puedeEscribir = Boolean(data?.enCurso && data?.asignacionId);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.titulo}>Libro de novedades</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {data?.objetivo || "Sin objetivo"}
          {data?.enCurso ? "" : " · el turno no está en curso"}
        </Text>
      </View>

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 8 }}>
        {novedades.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={40} color="#B0B8C4" />
            <Text style={styles.emptyTitulo}>Sin novedades</Text>
            <Text style={styles.emptySub}>
              {data?.asignacionId
                ? "Lo que anotes queda en este turno."
                : "Cuando tengas un turno, el libro aparece acá."}
            </Text>
          </View>
        ) : (
          novedades.map((item) => (
            <View key={item._id} style={styles.nota}>
              <Text style={styles.hora}>{formatHoraBA(item.at)}</Text>
              <Text style={styles.cuerpo}>{item.texto}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder={
            puedeEscribir ? "Anotá una novedad del turno" : "El turno no está en curso"
          }
          placeholderTextColor="#9CA3AF"
          multiline
          editable={puedeEscribir && !sending}
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.btn, (!puedeEscribir || !texto.trim() || sending) && styles.btnOff]}
          onPress={onEnviar}
          disabled={!puedeEscribir || !texto.trim() || sending}
        >
          <Text style={styles.btnTexto}>{sending ? "..." : "Enviar"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
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
  lista: { flex: 1 },
  nota: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  hora: { fontSize: 12, fontWeight: "800", color: "#8E44AD" },
  cuerpo: { marginTop: 4, fontSize: 14, lineHeight: 20, color: "#1A2332" },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 48,
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
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1A2332",
  },
  btn: {
    backgroundColor: "#8E44AD",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnOff: { backgroundColor: "#94A3B8" },
  btnTexto: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
