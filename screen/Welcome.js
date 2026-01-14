import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  ImageBackground,
  Pressable,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";

function Welcome({ navigation }) {
  const [isChecked, setIsChecked] = useState(false); // Estado del checkbox
  
  // Debug: Verificar si la imagen se carga
  console.log("Welcome: Logo local cargado");
  
  function pressHandler() {
    navigation.navigate("Configuration");
  }
  function toggleCheckbox() {
    setIsChecked((prevState) => !prevState); // Alterna entre seleccionado y no seleccionado
  }

  return (
    <>
      <ImageBackground
        source={require("../assets/126353.jpg")}
        resizeMode="cover"
        style={styles.rootScreen}
      >
        <View style={styles.imageContainer}>
          <Image
            source={require("../assets/logonuevo.png")}
            style={{ width: 70, height: 70 }}
          />
        </View>
        <View>
          <Text style={styles.textImage}>Desit SA</Text>
        </View>

        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <Text style={styles.textTitle}>Términos y condiciones de uso</Text>
          <Text style={styles.politicText}>
            Es necesario, para la configuración y uso de esta aplicación, que
            lea y acepte los términos y condiciones que a continuación se
            detallan:
          </Text>
          <Text style={styles.textTitle}>Pulsador de Pánico</Text>
          <Text style={styles.politicText}>
            Es una aplicación destinada al envío de mensajes de emergencia hacia
            la central de monitoreo instalada en su barrio, urbanización,
            ciudad, etc., haciendo uso de los recursos de seguridad con los que
            cuenta su entorno de aplicación para la atención y/o resolución del
            evento.
          </Text>
          <Text style={styles.textTitle}>
            Condiciones previas para el correcto funcionamiento
          </Text>
          <Text style={styles.politicText}>
            Para hacer uso de la APP de emergencia, usted deberá contar con el
            permiso del organismo que previamente haya instalado el Sistema de
            Monitoreo de Desit SA. Esta aplicación funciona en conjunto con
            dicho sistema.
          </Text>
          <Text style={styles.textTitle}>Configuración inicial</Text>
          <Text style={styles.politicText}>
            Para comenzar a utilizar la aplicación usted deberá completar tres
            campos, el primero con el código de licencia, el segundo con el
            número de equipo y el tercero con el número de cuenta, todos
            provistos por el organismo de control de implementación de uso de
            esta APP. Al ingresar los datos correctos, la aplicación puede
            solicitar permisos que usted deberá aceptar, de lo contrario la
            aplicación quedará sin funcionar. Para mayor detalle consultar el
            instructivo de instalación de la APP que le envió el organismo de
            control de uso y aplicación de este sistema. Una vez hecho esto la
            aplicación quedará lista para su uso. Nota: Los datos con los que
            configuró el envío de eventos hacia la central son ÚNICOS por cada
            APP individual.
          </Text>
          <Text style={styles.textTitle}>Uso y cuidados</Text>
          <Text style={styles.politicText}>
            Para utilizar la aplicación ante una situación de emergencia usted
            simplemente deberá abrirla y mantener presionado durante 1 (un)
            segundo el botón de aviso del evento que quiera comunicar. La
            aplicación no tiene límite de eventos que pueden ser enviados. Al
            enviar un evento a la central de monitoreo se dará aviso que desde
            su smartphone existe una emergencia de acuerdo a la naturaleza del
            botón que pulsó dentro de los disponibles en su APP. El pulsador NO
            ENVÍA información sobre su posición mediante el uso de GPS. Contamos
            con su entendimiento y compromiso de utilizar solo en casos de
            emergencia los botones de emergencia, como así también instruir de
            forma correcta al resto de los miembros de su familia en especial a
            los más jóvenes. Nota: Para poder enviar eventos de forma correcta
            usted deberá contar con disponibilidad de servicio de internet y/o
            paquete de datos, ya que cada evento se envía mediante un mensaje
            vía Internet.
          </Text>
          <Text style={styles.textTitle}>Formas de envío de alerta</Text>
          <Text style={styles.politicText}>
            La aplicación cuenta con la capacidad de enviar la alerta vía
            Internet.
          </Text>

          <Text style={styles.textTitle}>Costos</Text>
          <Text style={styles.politicText}>
            El envío de eventos por IP (internet) corre por parte del servicio
            de telefonía y/o paquete de datos que usted tenga contratado por lo
            que cada evento enviado tendrá el costo de la tarifa vigente de su
            proveedor.
          </Text>
          <Text style={styles.textTitle}>Responsabilidades</Text>
          <Text style={styles.politicText}>
            Desit SA no se hace responsable por fallas en envíos de eventos
            ocasionadas por causas ajenas al propio funcionamiento de la APP.
          </Text>
          <Text style={styles.textTitle}>Política de privacidad</Text>

          <Text style={styles.politicText}>
            La presente Política de Privacidad establece los términos en que
            Desit SA usa y protege la información que es proporcionada por sus
            usuarios al momento de utilizar Docta Pánico. Desit SA está
            comprometido con la seguridad de los datos de sus usuarios y
            aseguramos que los mismos serán empleados de acuerdo con los
            términos de este documento. Sin embargo, esta Política de Privacidad
            puede cambiar sin previo aviso por lo que le recomendamos revisar
            estos términos después de cada actualización para asegurarse que
            está de acuerdo con estos potenciales cambios.
          </Text>
          <Text style={styles.textTitle}>Información recogida</Text>
          <Text style={styles.politicText}>
            Desit SA no recoge información guardada en la aplicación ni tampoco
            recoge información sobre el uso de la misma, toda la información
            introducida por parte del usuario queda almacenada de manera local
            en el dispositivo y no es enviada ni a Desit SA ni a un tercero por
            parte de Desit SA.
          </Text>
          <Text style={styles.textTitle}>Uso de la información recogida</Text>
          <Text style={styles.politicText}>
            Desit SA no recoge información de la aplicación ni de su uso, por lo
            que no procesamos ningún tipo de información personal.
          </Text>
          <Text style={styles.textTitle}>Divulgación a Terceros</Text>
          <Text style={styles.politicText}>
            Desit Pánico no comparte información sobre la aplicación con
            terceros ni tampoco hacemos uso de enlaces hacia terceros dentro de
            la aplicación.
          </Text>
          <Text style={styles.textTitle}>
            Control de su información personal
          </Text>
          <Text style={styles.politicText}>
            Toda la información que se ingrese a la aplicación queda almacenada
            de manera local, como así también en el servidor de Desit con el fin
            de generar y resguardar la licencia de uso de la app. Los números de
            teléfonos o textos ingresados sólo serán resguardados a tal fin y
            bajo ningún concepto serán remitidos a ningún otro destino o empresa
            mediante Desit SA. El usuario acepta estas condiciones al realizar
            la configuración de la aplicación en su smartphone.
          </Text>
          <Text style={styles.textTitle}>
            Desit SA Se reserva el derecho de cambiar los términos de la
            presente Política de Privacidad en cualquier momento
          </Text>
        </ScrollView>

        <View style={styles.container}>
          <Pressable
            onPress={toggleCheckbox}
            style={[styles.checkbox, isChecked && styles.checked]}
          >
            {isChecked && <Text style={styles.checkmark}>✓</Text>}
          </Pressable>
          <Text style={styles.label}>Aceptar términos y condiciones</Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            onPress={isChecked ? pressHandler : null} // Solo habilita onPress si isChecked es true
            style={[
              styles.button,
              !isChecked && styles.buttonDisabled, // Aplica estilo deshabilitado si isChecked es false
            ]}
          >
            <Text style={styles.textButton}>CONTINUAR</Text>
          </Pressable>
        </View>
      </ImageBackground>
    </>
  );
}

export default Welcome;

const styles = StyleSheet.create({
  text: {
    padding: 16,
    fontSize: 30,
    color: "white",
    textAlign: "center",
    marginTop: 80,
  },
  buttonContainer: {
    marginTop: 6,
  },
  button: {
    padding: 6,
    marginBottom: 20,
    marginHorizontal: 10,
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 50,
    overflow: Platform.OS === "android" ? "hidden" : "visible",
    backgroundColor: "#0F76C4",
    elevation: 4,
    shadowColor: "black",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    alignItems: "center",
  },
  textButton: {
    color: "white",
    fontSize: 20,
  },
  rootScreen: {
    flex: 1,
  },
  imageContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 5,
  },
  textImage: {
    textAlign: "center",
    fontSize: 14,
    color: "white",
    marginBottom: 10,
  },
  politicText: {
    fontSize: 14,
    color: "white",
    textAlign: "justify",
    marginTop: 0,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    margin: 10,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: "#0d47a1",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checked: {
    backgroundColor: "#0d47a1",
  },
  checkmark: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  label: {
    fontSize: 16,
    color: "white",
  },
  listContainer: {
    flex: 1,
    padding: 10,
  },
  textTitle: {
    padding: 1,
    fontSize: 14,
    color: "white",
    marginTop: 15,
    textAlign: "justify",
    fontWeight: "bold",
  },
  buttonDisabled: {
    backgroundColor: "#ccc", // Color de fondo más tenue
    opacity: 0.5, // Reduce la opacidad
  },
});
