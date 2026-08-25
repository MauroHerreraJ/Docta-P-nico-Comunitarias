import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import { postUserData, postToken, getPanicAppByCode, validateCredentials } from "../util/Api";
import { registerForPushNotificationsAsync } from "../util/Notifications";
import { MaterialIcons } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import * as Sentry from "@sentry/react-native";
import SaveButton from "../component/SaveButton";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TERMS_AND_CONDITIONS = {
  title: "Términos y condiciones de uso",
  intro: "Es necesario, para la configuración y uso de esta aplicación, que lea y acepte los términos y condiciones que a continuación se detallan:",
  sections: [
    {
      title: "Pulsador de Pánico",
      content: "Es una aplicación destinada al envío de mensajes de emergencia hacia la central de monitoreo instalada en su barrio, urbanización, ciudad, etc., haciendo uso de los recursos de seguridad con los que cuenta su entorno de aplicación para la atención y/o resolución del evento."
    },
    {
      title: "Condiciones previas para el correcto funcionamiento",
      content: "Para hacer uso de la APP de emergencia, usted deberá contar con el permiso del organismo que previamente haya instalado el Sistema de Monitoreo de Desit SA. Esta aplicación funciona en conjunto con dicho sistema."
    },
    {
      title: "Configuración inicial",
      content: "Para comenzar a utilizar la aplicación usted deberá completar tres campos, el primero con el código de licencia, el segundo con el número de equipo y el tercero con el número de cuenta, todos provistos por el organismo de control de implementación de uso de esta APP. Al ingresar los datos correctos, la aplicación puede solicitar permisos que usted deberá aceptar, de lo contrario la aplicación quedará sin funcionar. Para mayor detalle consultar el instructivo de instalación de la APP que le envió el organismo de control de uso y aplicación de este sistema. Una vez hecho esto la aplicación quedará lista para su uso. Nota: Los datos con los que configuró el envío de eventos hacia la central son ÚNICOS por cada APP individual."
    },
    {
      title: "Uso y cuidados",
      content: "Para utilizar la aplicación ante una situación de emergencia usted simplemente deberá abrirla y mantener presionado durante 1 (un) segundo el botón de aviso del evento que quiera comunicar. La aplicación no tiene límite de eventos que pueden ser enviados. Al enviar un evento a la central de monitoreo se dará aviso que desde su smartphone existe una emergencia de acuerdo a la naturaleza del botón que pulsó dentro de los disponibles en su APP. El pulsador NO ENVÍA información sobre su posición mediante el uso de GPS. Contamos con su entendimiento y compromiso de utilizar solo en casos de emergencia los botones de emergencia, como así también instruir de forma correcta al resto de los miembros de su familia en especial a los más jóvenes. Nota: Para poder enviar eventos de forma correcta usted deberá contar con disponibilidad de servicio de internet y/o paquete de datos, ya que cada evento se envía mediante un mensaje vía Internet."
    },
    {
      title: "Formas de envío de alerta",
      content: "La aplicación cuenta con la capacidad de enviar la alerta vía Internet."
    },
    {
      title: "Costos",
      content: "El envío de eventos por IP (internet) corre por parte del servicio de telefonía y/o paquete de datos que usted tenga contratado por lo que cada evento enviado tendrá el costo de la tarifa vigente de su proveedor."
    },
    {
      title: "Responsabilidades",
      content: "Desit SA no se hace responsable por fallas en envíos de eventos ocasionadas por causas ajenas al propio funcionamiento de la APP."
    },
    {
      title: "Política de privacidad",
      content: "La presente Política de Privacidad establece los términos en que Desit SA usa y protege la información que es proporcionada por sus usuarios al momento de utilizar Docta Pánico. Desit SA está comprometido con la seguridad de los datos de sus usuarios y aseguramos que los mismos serán empleados de acuerdo con los términos de este documento. Sin embargo, esta Política de Privacidad puede cambiar sin previo aviso por lo que le recomendamos revisar estos términos después de cada actualización para asegurarse que está de acuerdo con estos potenciales cambios."
    },
    {
      title: "Información recogida",
      content: "Desit SA no recoge información guardada en la aplicación ni tampoco recoge información sobre el uso de la misma, toda la información introducida por parte del usuario queda almacenada de manera local en el dispositivo y no es enviada ni a Desit SA ni a un tercero por parte de Desit SA."
    },
    {
      title: "Uso de la información recogida",
      content: "Desit SA no recoge información de la aplicación ni de su uso, por lo que no procesamos ningún tipo de información personal."
    },
    {
      title: "Divulgación a Terceros",
      content: "Desit Pánico no comparte información sobre la aplicación con terceros ni tampoco hacemos uso de enlaces hacia terceros dentro de la aplicación."
    },
    {
      title: "Control de su información personal",
      content: "Toda la información que se ingrese a la aplicación queda almacenada de manera local, como así también en el servidor de Desit con el fin de generar y resguardar la licencia de uso de la app. Los números de teléfonos o textos ingresados sólo serán resguardados a tal fin y bajo ningún concepto serán remitidos a ningún otro destino o empresa mediante Desit SA. El usuario acepta estas condiciones al realizar la configuración de la aplicación en su smartphone."
    },
    {
      title: "Reserva de derechos",
      content: "Desit SA se reserva el derecho de cambiar los términos de la presente Política de Privacidad en cualquier momento."
    }
  ]
};

function Configuration({ onAuthorized }) {
  const { width, height } = Dimensions.get("window");
  const navigation = useNavigation();
  const [licencias, setLicencias] = useState({
    panicAppCode: "",
    targetDeviceId: "",
    numberId: "",
    Vecino: "",
    Documento: "",
    Direccion: "",
    Barrio: "",
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isContinueButtonEnabled, setContinueButtonEnabled] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isTermsModalVisible, setIsTermsModalVisible] = useState(false);
  const [panicAppData, setPanicAppData] = useState(null);
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  const altoBox = screenHeight / 100;
  //console.log(altoBox);

  useEffect(() => {
    if (
      licencias.panicAppCode &&
      licencias.targetDeviceId &&
      licencias.numberId &&
      isTermsAccepted
    ) {
      setContinueButtonEnabled(true);
    } else {
      setContinueButtonEnabled(false);
    }
  }, [licencias, isTermsAccepted]); // Dependencias

  useEffect(() => {
    if (
      licencias.Vecino &&
      licencias.Documento &&
      licencias.Direccion &&
      licencias.Barrio
    ) {
      setIsButtonEnabled(true);
    } else {
      setIsButtonEnabled(false);
    }
  }, [licencias]);

  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (name, value) => {
    setLicencias({ ...licencias, [name]: value });
  };

  const saveData = async () => {
    if (!isButtonEnabled) {
      alert("Por favor, complete todos los campos de datos personales antes de continuar.");
      return;
    }
    try {
      setIsLoading(true);
      const data = {
        panicAppCode: String(licencias.panicAppCode).trim().toUpperCase(),
        targetDeviceId: String(licencias.targetDeviceId).trim().padStart(4, '0'),
        numberId: String(licencias.numberId).trim().padStart(4, '0'),
        userCustomFields: [
          { Vecino: licencias.Vecino },
          { Documento: licencias.Documento },
          { Direccion: licencias.Direccion },
          { Barrio: licencias.Barrio },
        ],
      };

      console.log("Datos normalizados enviados:", data); // Para debug
      //console.log("Datos enviados al servidor:", data);
      const result = await postUserData(data);
      console.log("Respuesta completa del servidor:", JSON.stringify(result, null, 2));
console.log("¿Existe licenseCreated?:", !!result?.licenseCreated);
console.log("Status encontrado:", result?.licenseCreated?.status);
console.log("¿Es accepted?:", result?.licenseCreated?.status === "accepted");
      const status = result?.licenseCreated?.status;

      if (status !== "accepted") {
        alert("La licencia no fue aceptada. Verifique los datos.");
        return; // 🔴 DETIENE el flujo aquí
      }

      //console.log("Respuesta del servidor:", result.licenseCreated.status); 

      if (result?.licenseCreated?.code) {
        const codigoExtraido = result.licenseCreated.code;
        //console.log("Código extraído:", codigoExtraido);

        const dataToken = {
          grant_type: "authorization_code".toLowerCase(),
          client_id: "g4Qar6R9X3pPUMxWTbhZH7V5JGFf",
          license_code: codigoExtraido, // Aquí se asigna el código extraído
        };
        console.log("Datos del segundo POST (token):", dataToken);

        //console.log("Datos enviados al servidor:", dataToken);
        const token = await postToken(dataToken);
        //console.log("Respuesta del segundo POST:", token);

        await AsyncStorage.setItem(
          "@licencias",
          JSON.stringify({ result, token, panicAppData })
        );
        console.log("Datos Guardados en AsyncStorage (incluyendo panicAppData)");

        /* 🚫 NOTIFICACIONES ANULADAS TEMPORALMENTE
        try {
          await registerForPushNotificationsAsync(codigoExtraido);
        } catch (error) {
          console.error("Error al registrar notificaciones:", error);
          // No bloqueamos el flujo principal si falla el registro de notificaciones
        }
        */

        if (onAuthorized) {
          onAuthorized();
        } else {
          navigation.replace("Principal");
        }
      }
    } catch (error) {
      console.error("Error al hacer el POST:", error);
      alert("Datos Inválidos");
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = async () => {
    if (!isContinueButtonEnabled) {
      alert("Complete los campos"); // Muestra el alerta si no están completos los campos
      return; // Detiene la ejecución si no está habilitado el botón
    }

    // Validar credenciales antes de avanzar
    try {
      setIsLoading(true);
      
      // Preparar datos para validación
      const validationData = {
        panicAppCode: String(licencias.panicAppCode).trim().toUpperCase(),
        targetDeviceId: String(licencias.targetDeviceId).trim().padStart(4, '0'),
        numberId: String(licencias.numberId).trim().padStart(4, '0'),
      };

      console.log("Validando credenciales:", validationData);
      
      // Validar credenciales
      await validateCredentials(validationData);
      console.log("Credenciales válidas");

      // Obtener datos del panicapp después de validar
      const panicAppCode = String(licencias.panicAppCode).trim().toUpperCase();
      const panicAppInfo = await getPanicAppByCode(panicAppCode);
      console.log("Datos del PanicApp:", panicAppInfo);
      setPanicAppData(panicAppInfo);
      
      if (currentStep < 2) {
        setCurrentStep(currentStep + 1); // Avanza al siguiente paso solo si la validación fue exitosa
      }
    } catch (error) {
      console.error("Error en la validación o al obtener datos del panicapp:", error);
      if (error.response) {
        // Error de respuesta del servidor
        const status = error.response.status;
        const message = error.response.data?.message || "Error al validar las credenciales";
        if (status === 400 || status === 404) {
          alert("Credenciales inválidas. Verifique los datos ingresados.");
        } else {
          alert(message);
        }
      } else if (error.message) {
        alert(error.message);
      } else {
        alert("Error al validar las credenciales. Intente nuevamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const previousStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <View style={styles.title}>
              <Text style={styles.titleText}>Ingrese las Credenciales</Text>
            </View>
            <View style={styles.imputContainer}>
              <View>
                <View style={styles.textContainer}>
                  <TextInput
                    style={styles.textImput}
                    placeholder="Ingrese el código"
                    placeholderTextColor="#616060"
                    onChangeText={(text) => handleChange("panicAppCode", text)}
                    value={licencias.panicAppCode}
                  />
                  <MaterialIcons
                    name={"vpn-key"}
                    size={24}
                    color="#000"
                    style={styles.icon}
                  />
                </View>
              </View>
              <View>
                <View style={styles.textContainer}>
                  <TextInput
                    style={styles.textImput}
                    placeholder="Ingrese número de equipo"
                    placeholderTextColor="#616060"
                    keyboardType="numeric"
                    onChangeText={(text) =>
                      handleChange("targetDeviceId", text)
                    }
                    value={licencias.targetDeviceId}
                  />
                  <MaterialIcons
                    name={"vpn-key"}
                    size={24}
                    color="#000"
                    style={styles.icon}
                  />
                </View>
              </View>
              <View>
                <View style={styles.textContainer}>
                  <TextInput
                    style={styles.textImput}
                    placeholder="Ingrese número de cuenta"
                    placeholderTextColor="#616060"
                    keyboardType="numeric"
                    onChangeText={(text) => handleChange("numberId", text)}
                    value={licencias.numberId}
                  />
                  <MaterialIcons
                    name={"vpn-key"}
                    size={24}
                    color="#000"
                    style={styles.icon}
                  />
                </View>
              </View>

              {/* Checkbox de Términos y Condiciones */}
              <View style={styles.termsContainer}>
                <TouchableOpacity
                  style={[styles.checkbox, isTermsAccepted && styles.checkboxChecked]}
                  onPress={() => setIsTermsAccepted(!isTermsAccepted)}
                >
                  {isTermsAccepted && (
                    <MaterialIcons name="check" size={18} color="white" />
                  )}
                </TouchableOpacity>
                <View style={styles.termsTextContainer}>
                  <Text style={styles.termsText}>
                    Acepto los{" "}
                    <Text
                      style={styles.termsLink}
                      onPress={() => setIsTermsModalVisible(true)}
                    >
                      Términos y condiciones de uso
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </>
        );
      case 2:
        return (
          <>
            <KeyboardAvoidingView
              contentContainerStyle={{ flexGrow: 1 }}
              enableOnAndroid={true}
              extraHeight={150}
            >
              <View style={styles.imputContainer}>
                <View>
                  <View style={styles.textContainer}>
                    <TextInput
                      style={styles.textImput}
                      placeholder="Ingrese vecino"
                      placeholderTextColor="#616060"
                      onChangeText={(text) => handleChange("Vecino", text)}
                      value={licencias.Vecino}
                    />
                    <MaterialIcons
                      name={"person"}
                      size={24}
                      color="#000"
                      style={styles.icon}
                    />
                  </View>
                </View>
                <View>
                  <View style={styles.textContainer}>
                    <TextInput
                      style={styles.textImput}
                      placeholder="Ingrese Referencia"
                      placeholderTextColor="#616060"
                      keyboardType="numeric"
                      onChangeText={(text) => handleChange("Documento", text)}
                      value={licencias.Documento}
                    />
                    <MaterialIcons
                      name={"subtitles"}
                      size={24}
                      color="#000"
                      style={styles.icon}
                    />
                  </View>
                </View>
                <View>
                  <View style={styles.textContainer}>
                    <TextInput
                      style={styles.textImput}
                      placeholder="Ingrese Ubicación"
                      placeholderTextColor="#616060"
                      onChangeText={(text) => handleChange("Direccion", text)}
                      value={licencias.Direccion}
                    />
                    <MaterialIcons
                      name={"location-on"}
                      size={24}
                      color="#000"
                      style={styles.icon}
                    />
                  </View>
                </View>
                <View>
                  <View style={styles.textContainer}>
                    <TextInput
                      style={styles.textImput}
                      placeholder="Ingrese su barrio"
                      placeholderTextColor="#616060"
                      onChangeText={(text) => handleChange("Barrio", text)}
                      value={licencias.Barrio}
                    />
                    <MaterialIcons
                      name={"location-on"}
                      size={24}
                      color="#000"
                      style={styles.icon}
                    />
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {isLoading ? (
        <View style={styles.containerActivity}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <>
          <View>{renderStep()}</View>
          {currentStep > 1 && (
            <View style={styles.buttonContainer1}>
              <TouchableOpacity
                style={styles.buttonUpdate}
                onPress={previousStep}
                //disabled={!isContinueButtonEnabled}
              >
                <MaterialIcons
                  name={"arrow-back"}
                  size={24}
                  color="#222266"
                  style={[styles.icon, { marginLeft: 8 }]} // Aquí le agregamos un margen para separarlo un poco del texto
                />
                <Text style={styles.textImage}>ANTERIOR</Text>
              </TouchableOpacity>
            </View>
          )}
          {currentStep < 2 ? (
            <View style={styles.buttonContainer1}>
              <TouchableOpacity
                style={[styles.buttonUpdate, !isContinueButtonEnabled && { opacity: 0.5 }]}
                onPress={nextStep}
                disabled={!isContinueButtonEnabled}
              >
                <Text style={styles.textImage}>SIGUIENTE</Text>
                <MaterialIcons
                  name="arrow-forward"
                  size={24}
                  color="#222266"
                  style={[styles.icon, { marginLeft: 8 }]} // Aquí le agregamos un margen para separarlo un poco del texto
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.button}>
              <SaveButton onPress={saveData} isEnabled={isButtonEnabled} />
            </View>
          )}
        </>
      )}

      {/* Modal de Términos y Condiciones */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isTermsModalVisible}
        onRequestClose={() => setIsTermsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{TERMS_AND_CONDITIONS.title}</Text>
              <TouchableOpacity onPress={() => setIsTermsModalVisible(false)}>
                <MaterialIcons name="close" size={28} color="#222266" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalIntro}>{TERMS_AND_CONDITIONS.intro}</Text>
              {TERMS_AND_CONDITIONS.sections.map((section, index) => (
                <View key={index} style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{section.title}</Text>
                  <Text style={styles.modalSectionContent}>{section.content}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsTermsModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>ENTENDIDO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default Configuration;

const styles = StyleSheet.create({
  rootScreen: {
    flex: 1,
  },
  button: {
    marginTop: 1,
    alignSelf: "stretch",
  },
  imputContainer: {
    padding: 20,
    marginTop: 5,
  },
  textContainer: {
    marginTop: 3,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    borderRadius: 6,
  },
  textImput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    width: "100%",
    padding: 12,
    color: "#120438",
    borderRadius: 6,
  },
  icon: {
    marginRight: 10,
  },
  containerActivity: {
    flex: 1,
    justifyContent: "center",
  },
  buttonContainer1: {
    marginTop: 0,
    marginLeft: 150,
    alignItems: "center",
  },
  button1: {
    padding: 10,
    width: "90%",
    height: 45,
    margin: 8,
    borderRadius: 8,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: "black",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    alignItems: "center",
    opacity: 0.9,
  },
  textButton: {
    color: "#222266",
    fontSize: 15,
    textAlign: "center",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  icon2: {
    marginLeft: 10,
  },
  title: {
    marginTop: 10,
    marginLeft: 21,
  },
  titleText: {
    fontSize: 17,
    fontFamily: "open-sans-bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingHorizontal: 20,
  },
  buttonUpdate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  textImage: {
    fontSize: 16,
    color: "#222266",
  },
  // Nuevos estilos para Términos y Condiciones
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#222266",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#222266",
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    fontFamily: "open-sans",
    color: "#333",
  },
  termsLink: {
    color: "#0F76C4",
    fontFamily: "open-sans-bold",
    textDecorationLine: "underline",
  },
  // Estilos para el Modal de Términos
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    height: "80%",
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "open-sans-bold",
    color: "#222266",
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
  },
  modalIntro: {
    fontSize: 14,
    fontFamily: "open-sans-bold",
    color: "#444",
    marginBottom: 15,
    lineHeight: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontFamily: "open-sans-bold",
    color: "#222266",
    marginBottom: 5,
  },
  modalSectionContent: {
    fontSize: 14,
    fontFamily: "open-sans",
    color: "#666",
    lineHeight: 20,
    textAlign: "justify",
  },
  modalCloseButton: {
    backgroundColor: "#222266",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  modalCloseButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "open-sans-bold",
  },
});
