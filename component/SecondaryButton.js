import { View, Pressable, StyleSheet, Text } from "react-native"
import { MaterialIcons } from "@expo/vector-icons";


function SecondaryButton({ onPress, name, styles, text, text2 }) {
    return <View >
        <Pressable onPress={onPress} style={({ pressed }) => pressed && styless.pressed}>
            <View style={styles}>
                <MaterialIcons name={name} size={40} color="white" />
                <Text style={styless.textButton}>{text}</Text>
                <Text style={styless.textButton}>{text2}</Text>
            </View>
        </Pressable>
    </View>
}

export default SecondaryButton;

const styless = StyleSheet.create({
    pressed: {
        opacity: 0.5
    },
    textButton: {
        color: "white",
        fontSize: 15
    }
})