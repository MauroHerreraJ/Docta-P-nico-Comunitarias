import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
//import { GlobalStyles } from '../constans/Styles';

function GrabarBorrar() {
  const licencia = {
    storagelicencia: 'nppepe',
    storegeCuenta: '9999'
  };

  const token = '1234'

  const Grabar = async () => {
    await AsyncStorage.setItem('@licencias', JSON.stringify({ licencia, token }));
    console.log('grabado');
  };

  const Borrar = async () => {
    await AsyncStorage.removeItem('@licencias');
    console.log('borrado');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Opciones de Licencia</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.buttonSave} onPress={Grabar}>
          <Text style={styles.buttonText}>Grabar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonDelete} onPress={Borrar}>
          <Text style={styles.buttonText}>Borrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default GrabarBorrar;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#9fa8da',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  buttonSave: {
    width: '80%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3639f4',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  buttonDelete: {
    width: '80%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f44336',
    alignItems: 'center',
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
