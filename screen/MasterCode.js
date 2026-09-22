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
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateMasterCode, getPanicAppByCode } from "../util/Api";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from 'expo-camera';

function MasterCode({ onActivated, navigation }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  
  // Scanner state
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  const processMasterCode = async (inputCode) => {
    const cleanCode = inputCode.trim().toUpperCase();
    
    // Formato nuevo: PRODUCTO-MUNICIPIO-EQUIPO (ej: COMU-0CBD-1005)
    const parts = cleanCode.split("-");
    
    if (parts.length === 3) {
      const product = parts[0] === "COMU" ? "docta_panico" : parts[0].toLowerCase();
      const muniCode = parts[1];
      const equipment = parts[2];

      setLoading(true);
      try {
        // Obtenemos los datos del municipio basados en el código corto
        const panicAppInfo = await getPanicAppByCode(muniCode);
        
        const masterData = {
          product: product,
          activatedAt: new Date().toISOString(),
          muniCode: muniCode,
          equipment: equipment,
          isNewFlow: true
        };

        await AsyncStorage.setItem("@master_config", JSON.stringify(masterData));
        
        // Avisamos a App.js que el producto está activado
        Alert.alert("Éxito", "Código reconocido. Proceda a ingresar sus datos personales.", [
          { 
            text: "Continuar", 
            onPress: () => onActivated(product, { 
              initialStep: 2,
              masterConfig: masterData,
              panicAppData: panicAppInfo
            }) 
          }
        ]);
      } catch (error) {
        Alert.alert("Error", "No se pudo validar el municipio del código maestro.");
      } finally {
        setLoading(false);
      }
      return true;
    }
    return false;
  };

  const handleActivate = async () => {
    if (!code.trim()) {
      Alert.alert("Error", "Por favor, ingrese un código maestro.");
      return;
    }

    const isNewFormat = await processMasterCode(code);
    if (isNewFormat) return;

    setLoading(true);
    try {
      const response = await activateMasterCode(code.trim());
      
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

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setIsScannerVisible(false);
    
    processMasterCode(data).then(processed => {
      if (!processed) {
        Alert.alert("Error", "El código QR no tiene un formato válido.");
      }
      setScanned(false);
    });
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
          Use el código QR proporcionado por el referente para activar su aplicación.
        </Text>

        {!showManualInput && (
          <TouchableOpacity 
            style={styles.qrButton}
            onPress={async () => {
              if (permission?.status === 'undetermined') {
                await requestPermission();
              } else if (permission?.granted) {
                setIsScannerVisible(true);
              } else {
                Alert.alert("Permiso denegado", "Se necesita acceso a la cámara.");
              }
            }}
          >
            <MaterialIcons name="qr-code-scanner" size={32} color="white" />
            <Text style={styles.qrButtonText}>ESCANEAR CÓDIGO QR</Text>
          </TouchableOpacity>
        )}

        {showManualInput ? (
          <View style={{ width: "100%", alignItems: "center" }}>
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
                <Text style={styles.buttonText}>ACTIVAR MANUALMENTE</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ marginTop: 20 }}
              onPress={() => setShowManualInput(false)}
            >
              <Text style={styles.linkText}>Volver al escáner QR</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.manualLink}
            onPress={() => setShowManualInput(true)}
          >
            <Ionicons name="create-outline" size={18} color="#666" />
            <Text style={styles.manualLinkText}>¿Problemas con la cámara? Ingrese el código aquí</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footerText}>Desit SA - Seguridad Integral</Text>
      </View>

      <Modal
        animationType="slide"
        transparent={false}
        visible={isScannerVisible}
        onRequestClose={() => setIsScannerVisible(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerHeader}>
              <TouchableOpacity 
                style={styles.closeScannerButton}
                onPress={() => setIsScannerVisible(false)}
              >
                <Ionicons name="close" size={32} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.scannerFocusFrame} />
            <Text style={styles.scannerText}>Enfoque el código QR de activación</Text>
          </View>
        </View>
      </Modal>
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
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  qrButton: {
    backgroundColor: "#222266",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    paddingHorizontal: 25,
    borderRadius: 20,
    marginBottom: 20,
    width: "100%",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  qrButtonText: {
    color: "white",
    fontSize: 18,
    fontFamily: "open-sans-bold",
    marginTop: 15,
    letterSpacing: 1,
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
  manualLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    padding: 10,
  },
  manualLinkText: {
    color: "#666",
    fontSize: 14,
    fontFamily: "open-sans",
    marginLeft: 8,
    textDecorationLine: "underline",
  },
  linkText: {
    color: "#222266",
    fontFamily: "open-sans-bold",
    textDecorationLine: "underline",
  },
  footerText: {
    position: "absolute",
    bottom: 30,
    fontSize: 12,
    color: "#AAA",
    fontFamily: "open-sans",
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 50,
  },
  scannerHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
  },
  closeScannerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerFocusFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#0F76C4",
    backgroundColor: "transparent",
    borderRadius: 20,
  },
  scannerText: {
    color: "white",
    fontSize: 16,
    fontFamily: "open-sans-bold",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});

export default MasterCode;
