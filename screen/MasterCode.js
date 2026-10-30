import React, { useState, useEffect, useRef } from "react";
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
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateMasterCode, getPanicAppByCode, lookupOnboardingCode, extractDocta4Role } from "../util/Api";
import { extractOnboardingCode } from "../util/onboardingCode";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from "react-native-safe-area-context";

function MasterCode({ onActivated, navigation, initialCode }) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  
  // Scanner state
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const titleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(titleOpacity, {
      toValue: 1,
      duration: 2400,
      delay: 450,
      useNativeDriver: true,
    }).start();
  }, [titleOpacity]);

  // Auto-procesar código inicial (Deep Link)
  React.useEffect(() => {
    if (initialCode) {
      console.log("🚀 Auto-procesando código inicial:", initialCode);
      processMasterCode(initialCode, { silent: true });
    }
  }, [initialCode]);

  const stayOnCodeScreen = () => {
    setLoading(false);
    setIsScannerVisible(false);
    setShowManualInput(false);
  };

  const proceedToConfiguration = async (activate) => {
    setShowManualInput(false);
    await new Promise((resolve) => setTimeout(resolve, 450));
    activate();
  };

  const processMasterCode = async (inputCode, options = {}) => {
    console.log("Processing code:", inputCode);
    const cleanCode = String(inputCode || "").trim();
    const digitsOnly = extractOnboardingCode(cleanCode);

    setLoading(true);

    // CASO 1: Alias de 7 dígitos (Docta 4 Onboarding) — número o link /q/
    if (digitsOnly && digitsOnly.length === 7) {
      try {
        console.log("Iniciando lookup para alias Docta 4:", digitsOnly);
        const result = await lookupOnboardingCode(digitsOnly);
        
        if (result.canRegister) {
          const municipality = result.municipality || {};
          const municipalityId = municipality.id || municipality._id || municipality.municipality_id || "";
          const rol = extractDocta4Role(result);
          console.log("Rol Docta 4 (lookup):", rol, result.rol || result.role || "(no vino)");
          console.log("Municipio lookup:", municipalityId || "(sin id)", municipality.name || municipality.nombre || "");
          const masterData = {
            product: "docta_comunitarias",
            muniCode: municipality.code || municipality.panicAppCode || municipality.shortCode || digitsOnly,
            equipment: result.equipment || result.target_device_id || result.targetDeviceId || municipality.equipment || municipality.target_device_id || "",
            isDocta4: true,
            rol,
            municipality,
            ...(municipalityId ? { municipalityId } : {}),
            onboardingInfo: result,
            activatedAt: new Date().toISOString()
          };
          
          await AsyncStorage.setItem("@master_config", JSON.stringify(masterData));
          await proceedToConfiguration(() =>
            onActivated("docta_comunitarias", { 
              initialStep: 2,
              masterConfig: masterData,
              onboardingInfo: result
            })
          );
          return true;
        }

        stayOnCodeScreen();
        Alert.alert("Sin cupo", result.detail || "No quedan licencias en este equipo.");
        return true;
      } catch (error) {
        console.error("Error en lookup de alias:", error);
        stayOnCodeScreen();
        const status = error.response?.status;
        if (status === 404) {
          Alert.alert("Error", "Código incorrecto, revise el sticker.");
        } else {
          Alert.alert("Error", "No se pudo validar el código. Verifique su conexión.");
        }
        return true;
      }
    }

    // CASO 2: Formato interno COMU-MUNICIPIO-EQUIPO (ej: COMU-0CBD-1005)
    const upperCode = cleanCode.toUpperCase();
    const parts = upperCode.split("-");
    
    if (parts.length === 3) {
      if (parts[0] !== "COMU") {
        stayOnCodeScreen();
        Alert.alert("Código inválido", "Este código no corresponde a Docta Comunitarias.");
        return true;
      }

      const product = "docta_panico";
      const muniCode = parts[1];
      const equipment = parts[2];

      try {
        const panicAppInfo = await getPanicAppByCode(muniCode);
        
        const masterData = {
          product: product,
          activatedAt: new Date().toISOString(),
          muniCode: muniCode,
          equipment: equipment,
          panicAppData: panicAppInfo,
          isNewFlow: true
        };

        await AsyncStorage.setItem("@master_config", JSON.stringify(masterData));
        await proceedToConfiguration(() =>
          onActivated(product, { 
            initialStep: 2,
            masterConfig: masterData,
            panicAppData: panicAppInfo
          })
        );
        return true;
      } catch (error) {
        stayOnCodeScreen();
        Alert.alert("Error", "No se pudo validar el municipio del código maestro.");
        return true;
      }
    }

    setLoading(false);
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
        const product = response.product || "docta_panico";
        if (product !== "docta_panico" && product !== "docta_comunitarias" && product !== "docta_legacy") {
          stayOnCodeScreen();
          Alert.alert("Código inválido", "Este código no corresponde a Docta Comunitarias.");
          return;
        }

        const masterData = {
          product,
          masterToken: response.masterToken,
          activatedAt: new Date().toISOString(),
        };

        await AsyncStorage.setItem("@master_config", JSON.stringify(masterData));
        await proceedToConfiguration(() => onActivated(product));
      } else {
        stayOnCodeScreen();
        Alert.alert("Error", response.message || "Código inválido.");
      }
    } catch (error) {
      console.error("Error activating master code:", error);
      stayOnCodeScreen();
      Alert.alert("Error", "No se pudo validar el código. Verifique su conexión.");
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    processMasterCode(data).then(processed => {
      if (!processed) {
        setIsScannerVisible(false);
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
      <Animated.Text style={[styles.title, { paddingTop: insets.top + 40, opacity: titleOpacity }]}>
        Bienvenido!
      </Animated.Text>
      <View style={styles.content}>
        <Image
          source={require("../assets/logonuevo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.productName}>Docta Comunitarias</Text>

        <Text style={styles.subtitle}>
          Para comenzar, escanee el código QR del sticker.
        </Text>

        <View style={styles.buttonColumn}>
          <TouchableOpacity
            style={[styles.actionButton, styles.qrButton]}
            activeOpacity={0.85}
            onPress={async () => {
              const { granted, canAskAgain } = await requestPermission();
              if (granted) {
                setIsScannerVisible(true);
              } else {
                if (!canAskAgain) {
                  Alert.alert(
                    "Cámara Bloqueada",
                    "Has denegado el acceso a la cámara permanentemente. Por favor, ve a los Ajustes de tu teléfono y activa el permiso manualmente para Docta.",
                    [{ text: "OK" }]
                  );
                } else {
                  Alert.alert(
                    "Permiso Denegado",
                    "Se necesita acceso a la cámara para escanear el código QR.",
                    [{ text: "OK" }]
                  );
                }
              }
            }}
          >
            <MaterialIcons name="qr-code-scanner" size={40} color="white" />
            <Text style={styles.actionButtonText}>ESCANEAR QR</Text>
          </TouchableOpacity>

          <Text style={styles.secondaryHint}>¿No funciona la cámara?</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            activeOpacity={0.85}
            onPress={() => setShowManualInput(true)}
          >
            <MaterialIcons name="dialpad" size={22} color="white" />
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
              INGRESAR CÓDIGO
            </Text>
          </TouchableOpacity>
        </View>

        {showManualInput && (
          <Modal
            animationType="fade"
            transparent={true}
            visible={showManualInput}
            onRequestClose={() => setShowManualInput(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Ingrese su Código</Text>
                <Text style={styles.modalSubtitle}>Ingrese los 7 dígitos que figuran debajo del QR</Text>
                
                <View style={styles.inputContainer}>
                  <Ionicons name="key-outline" size={24} color="#222266" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 1234567"
                    placeholderTextColor="#999"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="numeric"
                    maxLength={15} // Permitimos más por si es el formato legacy
                    autoFocus={true}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowManualInput(false)}
                  >
                    <Text style={styles.cancelButtonText}>CANCELAR</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton, loading && styles.buttonDisabled]}
                    onPress={handleActivate}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.confirmButtonText}>ACTIVAR</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
          {loading && (
            <View style={styles.scannerLoading}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={loading}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#222266" />
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
    marginBottom: 12,
  },
  productName: {
    fontSize: 20,
    fontFamily: "open-sans-bold",
    color: "#222266",
    textAlign: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: "open-sans-bold",
    color: "#222266",
    textAlign: "center",
    paddingHorizontal: 30,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "open-sans",
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  buttonColumn: {
    width: "100%",
    alignItems: "center",
    marginTop: 20,
  },
  actionButton: {
    width: "100%",
    height: 130,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  qrButton: {
    backgroundColor: "#222266",
  },
  secondaryHint: {
    marginTop: 76,
    marginBottom: 8,
    color: "#666",
    fontSize: 13,
    fontFamily: "open-sans",
    textAlign: "center",
  },
  secondaryButton: {
    width: "58%",
    height: 62,
    borderRadius: 14,
    backgroundColor: "#0F76C4",
    elevation: 4,
    shadowOpacity: 0.2,
  },
  secondaryButtonText: {
    marginTop: 4,
    fontSize: 11,
  },
  actionButtonText: {
    color: "white",
    fontSize: 14,
    fontFamily: "open-sans-bold",
    marginTop: 15,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "open-sans-bold",
    color: "#222266",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#EEE",
  },
  confirmButton: {
    backgroundColor: "#222266",
  },
  cancelButtonText: {
    color: "#666",
    fontFamily: "open-sans-bold",
  },
  confirmButtonText: {
    color: "white",
    fontFamily: "open-sans-bold",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDD",
    paddingHorizontal: 15,
    marginBottom: 25,
    width: "100%",
    height: 60,
  },
  icon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontFamily: "open-sans-bold",
    color: "#333",
    textAlign: "center",
    letterSpacing: 2,
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
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(245, 247, 250, 0.94)",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    position: "absolute",
    bottom: 30,
    fontSize: 12,
    color: "#AAA",
    fontFamily: "open-sans",
  },
  scannerLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
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
