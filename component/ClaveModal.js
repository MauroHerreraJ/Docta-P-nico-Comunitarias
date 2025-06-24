import React, { useState } from 'react';
import { Modal, View, TextInput, Text, TouchableOpacity } from 'react-native';

const ClaveModal = ({ visible, onClose, onSubmit }) => {
  const [clave, setClave] = useState(''); // Estado para el valor del campo de texto

  const handleSubmit = () => {
    onSubmit(clave); // Enviar la clave al método onSubmit
    setClave(''); // Limpiar el campo de texto después de enviar
  };

  const handleClose = () => {
    onClose(); // Cerrar el modal
    setClave(''); // Limpiar el campo de texto cuando se cierra el modal
  };

  return (
    <Modal visible={visible} onRequestClose={handleClose} transparent={true} animationType="fade">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Ingresa la clave</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Clave"
            value={clave} // Vínculo con el estado de clave
            onChangeText={setClave} // Actualiza el estado cuando cambia el texto
            keyboardType="numeric" // Aseguramos que el campo sea solo para números
            placeholderTextColor="#888" // Color del texto de placeholder
            secureTextEntry={true} // Esta propiedad oculta el texto con asteriscos
          />
          
          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Confirmar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose}>
            <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    alignItems: 'center',
    elevation: 10, // Sombra para el modal (en Android)
    shadowColor: '#000', // Sombra para iOS
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 6,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 20,
    paddingLeft: 15,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  button: {
    backgroundColor: '#0d47a1',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  cancelButtonText: {
    color: '#fff',
  },
};

export default ClaveModal;
