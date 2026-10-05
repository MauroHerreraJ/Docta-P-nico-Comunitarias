import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getMiHombreVivoApp } from "../../util/NuevaApi";
import {
  alarmaHombreVivoApagada,
  setAlarmaHombreVivo,
} from "./HombreVivoAlerta";
import { formatHoraBA } from "../../util/horaBA";

export default function HombreVivoTurno() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [alarma, setAlarma] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getMiHombreVivoApp());
    } catch (error) {
      console.warn("[HombreVivo]", error?.message || error);
      Alert.alert("Sin conexión", "No se pudo abrir Hombre vivo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      alarmaHombreVivoApagada().then((apagada) => setAlarma(!apagada));
    }, [load]),
  );

  const onAlarma = async (valor) => {
    setAlarma(valor);
    await setAlarmaHombreVivo(valor);
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C0392B" />
      </View>
    );
  }

  const marcas = data?.marcas || [];
  const geoLista = (item) => {
    if (item.dentroGeocerca === true) return "Dentro de la geocerca";
    if (item.dentroGeocerca === false) return "Fuera de la geocerca";
    return "Sin geocerca en el objetivo";
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.titulo}>Hombre vivo</Text>
      <Text style={styles.sub} numberOfLines={2}>
        {data?.objetivo || "Sin objetivo"}
        {data?.enCurso ? "" : " · el turno no está en curso"}
      </Text>
      <Text style={styles.ayuda}>
        Cuando toca, el teléfono vibra y suena. Aceptás y se manda tu
        ubicación contra la geocerca de este objetivo.
      </Text>
      <View style={styles.alarmaFila}>
        <View style={{ flex: 1 }}>
          <Text style={styles.alarmaTitulo}>Alarma</Text>
          <Text style={styles.alarmaSub}>
            {alarma
              ? "Con la pantalla apagada abre Acá estoy."
              : "Apagada. No suena ni abre la pantalla."}
          </Text>
        </View>
        <Switch value={alarma} onValueChange={onAlarma} />
      </View>

      <Text style={styles.listaTitulo}>Aceptados</Text>
      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 12 }}>
        {marcas.length === 0 ? (
          <Text style={styles.vacio}>Todavía no aceptaste ninguno.</Text>
        ) : (
          marcas.map((item) => (
            <View key={item._id} style={styles.fila}>
              <Ionicons
                name={item.dentroGeocerca === false ? "alert-circle" : "checkmark-circle"}
                size={18}
                color={item.dentroGeocerca === false ? "#C0392B" : "#16A085"}
              />
              <View>
                <Text style={styles.filaTexto}>{formatHoraBA(item.at)}</Text>
                <Text style={styles.filaSub}>{geoLista(item)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  titulo: { fontSize: 18, fontWeight: "800", color: "#1A2332" },
  sub: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  ayuda: { marginTop: 8, fontSize: 13, lineHeight: 18, color: "#475569" },
  alarmaFila: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  alarmaTitulo: { fontSize: 15, fontWeight: "800", color: "#1A2332" },
  alarmaSub: { marginTop: 2, fontSize: 12, color: "#64748B" },
  filaSub: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  boton: {
    marginTop: 16,
    backgroundColor: "#C0392B",
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: "center",
    gap: 4,
  },
  botonOff: { backgroundColor: "#94A3B8" },
  botonTexto: { color: "#fff", fontWeight: "900", fontSize: 20, letterSpacing: 0.4 },
  botonSub: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  listaTitulo: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "800",
    color: "#1A2332",
  },
  lista: { flex: 1 },
  vacio: { fontSize: 13, color: "#6B7280" },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  filaTexto: { fontSize: 15, fontWeight: "700", color: "#1A2332" },
});
