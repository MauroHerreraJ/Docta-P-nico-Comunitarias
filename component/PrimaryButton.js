import { View,Pressable, StyleSheet, Platform,Text } from "react-native"
import {Ionicons} from "@expo/vector-icons";
import { GlobalStyles } from "../constans/Colors";

function PrimaryButton({ onPress }) {
    return <View >
        <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
            <View style={styles.buttonContainer}>
               <Ionicons name="warning" size={80} color="white"/>
               <Text style={styles.textButton}>Pánico</Text>
            </View>
        </Pressable>
    </View>
}

export default PrimaryButton;

const styles = StyleSheet.create({
    buttonContainer: {
        padding: 70,
        margin: 16,
        borderRadius: 8,
        overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
        backgroundColor: GlobalStyles.colors.titlecolor,
        elevation: 4,
        shadowColor: 'black',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        alignItems: "center"
    },
    pressed: {
        opacity: 0.5
    },  
    textButton:{
        color:"white",
        fontSize:17
    }
})