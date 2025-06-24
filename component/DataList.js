import { View, Text, StyleSheet, TouchableWithoutFeedback, Keyboard } from "react-native";

import TextImputClient from "../UI/TextImputClient";


function DataList({setUserName,setDocument,setRegistrationCode,userName,document,registrationCode}) {

  return (
    <>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.imputContainer}>
          <View>
            <Text style={styles.text}>Apellido/Nombre</Text>
            <TextImputClient
              text={"Ingrese Apellido/Nombre"}
              onDattaChange={setUserName}
              value={userName}
              name={"person"}
              />
          </View>
          <View>
            <Text style={styles.text}>Documento</Text>
            <TextImputClient
              text={"Ingrese número de documento"}
              onDattaChange={setDocument}
              value={document}
              name={"subtitles"}
              type="numeric"
              maxLength={8}
            />
          </View>
          <View>
            <Text style={styles.text}>Código de Alta</Text>
            <TextImputClient
              text={"Ingrese código de alta"}
              onDattaChange={setRegistrationCode}
              value={registrationCode}
              name={"vpn-key"}
              type="numeric"
              maxLength={6}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}

export default DataList;

const styles = StyleSheet.create({
  imputContainer: {
    padding: 20,
    marginTop: 50
  },
 
  text: {
    color: "white"
  },
  container:{
    flexDirection: 'row',
   
  }
})

