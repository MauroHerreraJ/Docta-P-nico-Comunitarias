import { Text, View, StyleSheet, Image, TouchableOpacity, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ClaveModal from "../component/ClaveModal";

function User({ navigation }) {
  const [licencia, setLicencia] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isBorrarAccess, setIsBorrarAccess] = useState(false);
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
    if (code.length >= 4) {
      // Reemplazar los últimos 4 caracteres con asteriscos
      return code.slice(0, -4) + "****";
    }
    return code; // Si el código tiene menos de 24 caracteres, se devuelve tal cual
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
    console.log("borrado");
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
          </View>
          <View style={[styles.withoutLicenseImage, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Image
              source={require("../assets/logonuevo.png")}
              style={{ width: 59, height: 59 }}
            />
          </View>
          <TouchableOpacity style={styles.buttonUpdate} onPress={Borrar}>
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

  const openClaveModal = () => {
    setIsModalVisible(true); // Mostrar modal para ingresar la clave
  };
  const closeClaveModal = () => {
    setIsModalVisible(false); // Cerrar modal
  };
  const handleClaveSubmit = (claveIngresada) => {
    if (claveIngresada === "253614") {
      setIsBorrarAccess(true); // Si la clave es correcta, permitir acceso
      navigation.navigate("GrabarBorrar"); // Navegar a la pantalla GrabarBorrar
    } else {
      alert("Clave incorrecta"); // Si la clave es incorrecta
    }
    closeClaveModal(); // Cerrar modal
  };
  {
    /* borrado */
  }

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
          <TouchableOpacity
            style={styles.buttonUpdate}
            onPress={openClaveModal}
          >
            <Text style={styles.textImage}>
              Producto desarrollado por Desit SA
            </Text>
          </TouchableOpacity>
          <Text style={styles.textImage}>Version 6.0.1 Docta Comunitarias</Text>
        </View>
      </ScrollView>
      <ClaveModal
        visible={isModalVisible}
        onClose={closeClaveModal}
        onSubmit={handleClaveSubmit}
      />
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
    marginBottom: 20,
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
});
