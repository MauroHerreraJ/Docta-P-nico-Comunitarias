import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import { postUserData, postToken } from "../util/Api";
import { MaterialIcons } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import SaveButton from "../component/SaveButton";
import AsyncStorage from "@react-native-async-storage/async-storage";

function Configuration() {
  const { width, height } = Dimensions.get("window");
  const navigation = useNavigation();
  const [licencias, setLicencias] = useState({
    panicAppCode: "",
    targetDeviceId: "",
    accountNumber: "",
    Nombre: "",
    Apellido: "",
    Documento: "",
    Direccion: "",
    Barrio: "",
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isContinueButtonEnabled, setContinueButtonEnabled] = useState(false);
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  const altoBox = screenHeight / 100;
  //console.log(altoBox);

  useEffect(() => {
    if (
      licencias.panicAppCode &&
      licencias.targetDeviceId &&
      licencias.accountNumber
    ) {
      setContinueButtonEnabled(true);
    } else {
      setContinueButtonEnabled(false);
    }
  }, [licencias]); // Dependencias

  useEffect(() => {
    if (
      licencias.Nombre &&
      licencias.Apellido &&
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
    try {
      setIsLoading(true);
      const data = {
        panicAppCode: licencias.panicAppCode,
        targetDeviceId: licencias.targetDeviceId,
        accountNumber: licencias.accountNumber,
        userCustomFields: [
          { Nombre: licencias.Nombre },
          { Apellido: licencias.Apellido },
          { Documento: licencias.Documento },
          { Direccion: licencias.Direccion },
          { Barrio: licencias.Barrio },
        ],
      };
      //console.log("Datos enviados al servidor:", data);
      const result = await postUserData(data);
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
          grant_type: "authorization_code",
          client_id: "7R9dxaPej6g1DPJ30vw9QpeG1L5A",
          license_code: codigoExtraido, // Aquí se asigna el código extraído
        };

        //console.log("Datos enviados al servidor:", dataToken);
        const token = await postToken(dataToken);
        //console.log("Respuesta del segundo POST:", token);

        await AsyncStorage.setItem(
          "@licencias",
          JSON.stringify({ result, token })
        );
        console.log("Datos Guardados en AsyncStorage");
        navigation.replace("Principal");
      }
    } catch (error) {
      console.error("Error al hacer el POST:", error);
      alert("Datos Inválidos");
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (!isContinueButtonEnabled) {
      alert("Complete los campos"); // Muestra el alerta si no están completos los campos
      return; // Detiene la ejecución si no está habilitado el botón
    }

    if (currentStep < 2) {
      setCurrentStep(currentStep + 1); // Avanza al siguiente paso solo si el botón está habilitado
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
                    onChangeText={(text) => handleChange("accountNumber", text)}
                    value={licencias.accountNumber}
                  />
                  <MaterialIcons
                    name={"vpn-key"}
                    size={24}
                    color="#000"
                    style={styles.icon}
                  />
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
                      placeholder="Ingrese su nombre"
                      placeholderTextColor="#616060"
                      onChangeText={(text) => handleChange("Nombre", text)}
                      value={licencias.Nombre}
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
                      placeholder="Ingrese su apellido"
                      placeholderTextColor="#616060"
                      onChangeText={(text) => handleChange("Apellido", text)}
                      value={licencias.Apellido}
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
                      placeholder="Ingrese su documento"
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
                      placeholder="Ingrese su dirección"
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
                style={styles.buttonUpdate}
                onPress={nextStep}
                //disabled={!isContinueButtonEnabled}
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
    flexDirection: "row", // Alinea los botones horizontalmente
    justifyContent: "space-between", // Espacio entre los botones
    marginTop: 20,
    paddingHorizontal: 20, // Ajusta el padding horizontal
  },
  buttonUpdate: {
    flexDirection: "row", // Esto asegura que los elementos estén en una fila
    alignItems: "center", // Centra el texto e icono verticalmente
    justifyContent: "center", // Centra todo el contenido horizontalmente
    padding: 10, // Puedes ajustar el padding según sea necesario
  },
  textImage: {
    fontSize: 16,
    color: "#222266",
  },
});
