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
import { activateMasterCode, getPanicAppByCode, lookupOnboardingCode } from "../util/Api";
import { extractOnboardingCode } from "../util/onboardingCode";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from 'expo-camera';

function MasterCode({ onActivated, navigation, initialCode }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  
  // Scanner state
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Auto-procesar código inicial (Deep Link)
  React.useEffect(() => {
    if (initialCode) {
      console.log("🚀 Auto-procesando código inicial:", initialCode);
      processMasterCode(initialCode, { silent: true });
    }
  }, [initialCode]);

  const processMasterCode = async (inputCode, options = {}) => {
    console.log("Processing code:", inputCode);
    const cleanCode = String(inputCode || "").trim();
    const digitsOnly = extractOnboardingCode(cleanCode);
    
    // CASO 1: Alias de 7 dígitos (Docta 4 Onboarding) — número o link /q/
    if (digitsOnly && digitsOnly.length === 7) {
      setLoading(true);
      try {
        console.log("Iniciando lookup para alias Docta 4:", digitsOnly);
        const result = await lookupOnboardingCode(digitsOnly);
        
        if (result.canRegister) {
          const masterData = {
            product: "docta_comunitarias",
            muniCode: digitsOnly,
            isDocta4: true,
            onboardingInfo: result,
            activatedAt: new Date().toISOString()
          };
          
          await AsyncStorage.setItem("@master_config", JSON.stringify(masterData));

          const goToRegister = () => onActivated("docta_comunitarias", { 
            initialStep: 2,
            masterConfig: masterData,
            onboardingInfo: result
          });

          if (options.silent) {
            goToRegister();
          } else {
            Alert.alert("Éxito", `Código reconocido para ${result.municipality.name}.`, [
              { text: "Continuar", onPress: goToRegister }
            ]);
          }
          return true;
        } else {
          Alert.alert("Sin cupo", result.detail || "No quedan licencias en este equipo.");
          return true;
        }
      } catch (error) {
        console.error("Error en lookup de alias:", error);
        const status = error.response?.status;
        if (status === 404) {
          Alert.alert("Error", "Código incorrecto, revise el sticker.");
        } else {
          Alert.alert("Error", "No se pudo validar el código. Verifique su conexión.");
        }
        return true;
      } finally {
        setLoading(false);
      }
    }

    // CASO 2: Formato Interno PRODUCTO-MUNICIPIO-EQUIPO (ej: COMU-0CBD-1005)
    const upperCode = cleanCode.toUpperCase();
    const parts = upperCode.split("-");
    
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
          panicAppData: panicAppInfo,
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
        
        <Text style={styles.title}>Bienvenido a Docta</Text>
        <Text style={styles.subtitle}>
          Para comenzar, escanee el código QR del sticker o ingrese el código de 7 dígitos.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.qrButton]}
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

          <TouchableOpacity 
            style={[styles.actionButton, styles.manualButton]}
            onPress={() => setShowManualInput(true)}
          >
            <MaterialIcons name="dialpad" size={40} color="white" />
            <Text style={styles.actionButtonText}>INGRESAR CÓDIGO</Text>
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
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
    marginTop: 20,
  },
  actionButton: {
    width: "48%",
    height: 140,
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
  manualButton: {
    backgroundColor: "#0F76C4",
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
