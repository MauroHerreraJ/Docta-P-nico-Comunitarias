import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

function formatValue(raw) {
  if (raw == null) return "null";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return String(raw);
  }
}

/**
 * Botón + modal: muestra todas las claves/valores de AsyncStorage del teléfono.
 */
export default function AsyncStorageDumpButton({
  label = "VER ASYNCSTORAGE",
  buttonStyle,
  textStyle,
}) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b));
      const pairs = await AsyncStorage.multiGet(sortedKeys);
      setEntries(
        pairs.map(([key, value]) => ({
          key,
          value,
          formatted: formatValue(value),
        })),
      );
    } catch (error) {
      console.warn("[AsyncStorageDump]", error?.message || error);
      Alert.alert(
        "Error",
        error?.message || "No se pudo leer AsyncStorage.",
      );
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const onOpen = async () => {
    setVisible(true);
    await loadAll();
  };

  const onClose = () => setVisible(false);

  return (
    <>
      <TouchableOpacity
        onPress={onOpen}
        style={[styles.button, buttonStyle]}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, textStyle]}>{label}</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>AsyncStorage</Text>
                <Text style={styles.subtitle}>
                  {loading
                    ? "Leyendo…"
                    : `${entries.length} clave${entries.length === 1 ? "" : "s"}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={loadAll}
                disabled={loading}
                style={styles.headerBtn}
              >
                <Text style={styles.headerBtnText}>Actualizar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0F76C4" />
              </View>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
              >
                {entries.length === 0 ? (
                  <Text style={styles.empty}>No hay datos en AsyncStorage.</Text>
                ) : (
                  entries.map((item) => (
                    <View key={item.key} style={styles.card}>
                      <Text selectable style={styles.key}>
                        {item.key}
                      </Text>
                      <Text selectable style={styles.value}>
                        {item.formatted}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#0F766E",
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748B",
  },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F76C4",
  },
  centered: {
    paddingVertical: 48,
    alignItems: "center",
  },
  scroll: {
    maxHeight: "100%",
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 32,
  },
  empty: {
    textAlign: "center",
    color: "#94A3B8",
    marginTop: 24,
    fontSize: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  key: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F76C4",
    marginBottom: 8,
  },
  value: {
    fontSize: 12,
    color: "#334155",
    fontFamily: "monospace",
    lineHeight: 18,
  },
});
