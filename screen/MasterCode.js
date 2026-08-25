import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateMasterCode } from "../util/Api";
import { Ionicons } from "@expo/vector-icons";

function MasterCode({ onActivated }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!code.trim()) {
      Alert.alert("Error", "Por favor, ingrese un código maestro.");
      return;
    }

    setLoading(true);
    try {
      const response = await activateMasterCode(code.trim());
      
      // La respuesta del servidor debería ser algo como:
      // { success: true, product: "docta_panico", masterToken: "..." }
      
      if (response.success) {
        const masterData = {
          product: response.product,
          masterToken: response.masterToken,
          activatedAt: new Date().toISOString(),
        };

        await AsyncStorage.setItem("@master_config", JSON.stringify(masterData));
        
        Alert.alert("Éxito", "Producto activado correctamente.", [
          { text: "Continuar", onPress: () => onActivated(response.product) }
        ]);
      } else {
        Alert.alert("Error", response.message || "Código inválido.");
      }
    } catch (error) {
      console.error("Error activating master code:", error);
      Alert.alert("Error", "No se pudo validar el código. Verifique su conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.content}>
        <Image
          source={require("../assets/logonuevo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        
        <Text style={styles.title}>Activación de Producto</Text>
        <Text style={styles.subtitle}>
          Ingrese su código maestro para comenzar la configuración.
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons name="key-outline" size={24} color="#222266" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="CÓDIGO MASTER"
            placeholderTextColor="#999"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleActivate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>ACTIVAR</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>Desit SA - Seguridad Integral</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  content: {
    flex: 1,
    padding: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontFamily: "open-sans-bold",
    color: "#222266",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "open-sans",
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDD",
    paddingHorizontal: 15,
    marginBottom: 25,
    width: "100%",
    height: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  icon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: "open-sans-bold",
    color: "#333",
  },
  button: {
    backgroundColor: "#222266",
    width: "100%",
    height: 55,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontFamily: "open-sans-bold",
    letterSpacing: 1,
  },
  footerText: {
    position: "absolute",
    bottom: 30,
    fontSize: 12,
    color: "#AAA",
    fontFamily: "open-sans",
  },
});

export default MasterCode;
