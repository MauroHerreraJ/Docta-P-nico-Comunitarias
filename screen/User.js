import { Text, View, StyleSheet, Image, TouchableOpacity, ScrollView, Alert, Modal, TextInput } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { deleteLicenseAccount } from "../util/Api";

function User({ navigation }) {
  const [licencia, setLicencia] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isBorrarAccess, setIsBorrarAccess] = useState(false);
  const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [licenseInput, setLicenseInput] = useState("");
  const [isLicenseValid, setIsLicenseValid] = useState(null); // null, true, false
  const insets = useSafeAreaInsets();

  // Función para traducir el estado
  const translateStatus = (status) => {
    switch (status) {
      case "active":
        return "Activo";
      case "inactive":
        return "Inactivo";
      case "pending":
        return "Pendiente";
      case "expired":
        return "Expirado";
      case "accepted":
        return "Aceptado"; // Traducción de "accepted"
      default:
        return status; // Si no se encuentra una traducción, se muestra el valor original
    }
  };
  const maskLicenseCode = (code) => {
    if (!code) return ""; // Devuelve una cadena vacía si code es null o undefined
    return code; // Se devuelve el código completo sin censura
  };

  // Función para recuperar la licencia almacenada
  const loadLicencia = async () => {
    try {
      const storedLicencia = await AsyncStorage.getItem("@licencias");
      if (storedLicencia) {
        const parsedData = JSON.parse(storedLicencia);

        //console.log("parseData", parsedData.result.licenseCreated.panicAppCode);

        setLicencia(parsedData.result.licenseCreated); // Accedemos a "licenseCreated"
        //console.log(parsedData.result.licenseCreated);
      }
    } catch (error) {
      console.log("Error al cargar la licencia", error);
    }
  };

  // Ejecuta la función cada vez que la pantalla se enfoca
  useFocusEffect(
    useCallback(() => {
      loadLicencia();
    }, [])
  );

  // Ejecuta la función cuando se monta el componente
  useEffect(() => {
    loadLicencia();
  }, []);

  const Borrar = async () => {
    await AsyncStorage.removeItem("@licencias");
    setLicencia(null);
    console.log("borrado");
  };

  const handleAdminDelete = () => {
    Alert.alert(
      "Acceso Administrativo",
      "¿Desea resetear la configuración local de la aplicación?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Continuar", 
          onPress: () => {
            setAdminPasswordInput("");
            setIsAdminModalVisible(true);
          } 
        }
      ]
    );
  };

  const confirmAdminDelete = async () => {
    if (adminPasswordInput === "253614") {
      await Borrar();
      setIsAdminModalVisible(false);
      Alert.alert("Éxito", "La configuración local ha sido reseteada.");
    } else {
      Alert.alert("Error", "Clave incorrecta.");
    }
  };

  //Verifica si hay datos de licencia para mostrar
  if (!licencia) {
    return (
      <>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.withoutLicenseContainer}
        >
          <View>
            <Text style={styles.withoutLicense}>No posee Licencia...</Text>
            <Text style={styles.restartApp}>Por favor, reinicie su aplicación</Text>
          </View>
          <View style={[styles.withoutLicenseImage, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Image
              source={require("../assets/logonuevo.png")}
              style={{ width: 59, height: 59 }}
            />
          </View>
          <TouchableOpacity style={styles.buttonUpdate} onPress={handleAdminDelete}>
            <Text style={styles.textImage}>
              Producto desarrollado por Desit SA
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    );
  }

  {
    /* borrado */
  }

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Eliminar Licencia",
      "Para continuar, deberás validar tu identidad ingresando los últimos 4 dígitos de tu licencia.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Continuar", 
          onPress: () => {
            setLicenseInput("");
            setIsLicenseValid(null);
            setIsDeleteModalVisible(true);
          } 
        }
      ]
    );
  };

  const confirmDelete = async () => {
    if (!isLicenseValid) return;

    try {
      if (licencia && licencia.code) {
        await deleteLicenseAccount(licencia.code);
      }
      await AsyncStorage.removeItem("@licencias");
      setLicencia(null);
      setIsDeleteModalVisible(false);
      Alert.alert("Éxito", "La licencia ha sido eliminada correctamente.");
    } catch (error) {
      Alert.alert("Error", "No se pudo eliminar la licencia del servidor. Inténtalo de nuevo.");
    }
  };

  const handleLicenseInputChange = (text) => {
    setLicenseInput(text);
    if (text.length === 4) {
      const lastFour = licencia.code.slice(-4);
      if (text === lastFour) {
        setIsLicenseValid(true);
      } else {
        setIsLicenseValid(false);
      }
    } else {
      setIsLicenseValid(null);
    }
  };

  return (
    <>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View>
          <View style={styles.textContainer}>
            <Text style={styles.text}>Cuenta: </Text>
            <Text style={styles.textData}>{licencia.accountNumber}</Text>
            <View style={styles.underline}></View>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.text}>CodigoApp: </Text>
            <Text style={styles.textData}>{licencia.panicAppCode}</Text>
            <View style={styles.underline}></View>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.text}>Licencia: </Text>
            <Text style={styles.textData}>
              {maskLicenseCode(licencia.code)}
            </Text>
            <View style={styles.underline}></View>
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.text}>Equipo: </Text>
            <Text style={styles.textData}>{licencia.targetDeviceId}</Text>
            <View style={styles.underline}></View>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.text}>Estado </Text>
            <Text style={styles.textData}>
              {licencia.status
                ? translateStatus(licencia.status)
                : "Desconocido"}
            </Text>
            <View style={styles.underline}></View>
          </View>
        </View>
        <View style={[styles.container2, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.imageContainer}>
            <Image
              source={require("../assets/logonuevo.png")}
              style={{ width: 59, height: 59 }}
            />
          </View>
          
          <TouchableOpacity onPress={handleAdminDelete}>
            <Text style={styles.textImage}>
              Producto desarrollado por Desit SA
            </Text>
          </TouchableOpacity>
          <Text style={styles.textImage}>Version 6.0.1 Docta Comunitarias</Text>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteButtonText}>
              Eliminar Licencia y Datos
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Validación para Eliminación */}
      <Modal
        visible={isDeleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.validationModalContent}>
            <Text style={styles.modalTitle}>Validar Eliminación</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa los últimos 4 caracteres de tu licencia para confirmar:
            </Text>
            
            <Text style={styles.licenseDisplay}>
              Licencia: {licencia.code}
            </Text>
            
            <TextInput
              style={[
                styles.licenseInput,
                isLicenseValid === true && styles.licenseInputValid,
                isLicenseValid === false && styles.licenseInputInvalid,
              ]}
              value={licenseInput}
              onChangeText={handleLicenseInputChange}
              keyboardType="default"
              autoCapitalize="none"
              maxLength={4}
              placeholder="XXXX"
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setIsDeleteModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.confirmButton,
                  !isLicenseValid && styles.disabledButton
                ]} 
                onPress={confirmDelete}
                disabled={!isLicenseValid}
              >
                <Text style={styles.modalButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal de Acceso Administrativo */}
      <Modal
        visible={isAdminModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAdminModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.validationModalContent}>
            <Text style={styles.modalTitle}>Acceso Administrador</Text>
            <Text style={styles.modalSubtitle}>
              Ingrese la clave de seguridad para resetear la configuración:
            </Text>
            
            <TextInput
              style={styles.licenseInput}
              value={adminPasswordInput}
              onChangeText={setAdminPasswordInput}
              keyboardType="numeric"
              secureTextEntry={true}
              placeholder="******"
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setIsAdminModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={confirmAdminDelete}
              >
                <Text style={styles.modalButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default User;

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    marginTop: 2,
    justifyContent: 'space-between', // Separa el contenido superior del inferior
  },
  textContainer: {
    marginTop: 3,
    marginBottom: 15,
    fontSize: 36,
  },
  text: {
    fontSize: 16,
    fontFamily: "open-sans-bold",
  },
  textData: {
    fontSize: 17,
    fontFamily: "open-sans",
  },
  underline: {
    height: 1,
    backgroundColor: "grey",
    width: "100%",
    marginTop: 1,
    opacity: 0.55,
  },
  textImage: {
    textAlign: "center",
    marginBottom: 10,
    fontSize: 15,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 10,
  },
  withoutLicense: {
    marginTop: 150,
    fontFamily: "open-sans",
    fontSize: 19,
    textAlign: "center",
  },
  restartApp: {
    marginTop: 10,
    fontFamily: "open-sans-bold",
    fontSize: 16,
    color: "#f44336",
    textAlign: "center",
  },
  withoutLicenseImage: {
    marginTop: 300,
  },
  withoutLicenseContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container2: {
    alignItems: "center", // Asegurarse de que el contenido esté centrado
  },
  deleteButton: {
    backgroundColor: "#f44336",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deleteButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "open-sans-bold",
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  validationModalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'open-sans-bold',
    color: '#333',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'open-sans',
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  licenseDisplay: {
    fontSize: 15,
    fontFamily: 'open-sans-bold',
    color: '#EB7F27',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    textAlign: 'center',
    width: '100%',
  },
  licenseInput: {
    width: '60%',
    height: 50,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'open-sans-bold',
    color: '#333',
    marginBottom: 25,
  },
  licenseInputValid: {
    borderColor: '#4CAF50',
    color: '#4CAF50',
  },
  licenseInputInvalid: {
    borderColor: '#f44336',
    color: '#f44336',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: 45,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
  },
  confirmButton: {
    backgroundColor: '#f44336',
  },
  disabledButton: {
    backgroundColor: '#ef9a9a',
    opacity: 0.6,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'open-sans-bold',
  },
});
