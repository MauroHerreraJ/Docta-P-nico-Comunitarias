import { View, Pressable, StyleSheet, Text } from "react-native"
import { MaterialIcons } from "@expo/vector-icons";


function SecondaryButton({ onPress, name, styles: containerStyles, text, text2 }) {
    return <View >
        <Pressable onPress={onPress} style={({ pressed }) => pressed && localStyles.pressed}>
            <View style={containerStyles}>
                <MaterialIcons name={name} size={40} color="white" />
                <Text style={localStyles.textButton}>{text}</Text>
                <Text style={localStyles.textButton}>{text2}</Text>
            </View>
        </Pressable>
    </View>
}

export default SecondaryButton;

const localStyles = StyleSheet.create({
    pressed: {
        opacity: 0.5
    },
    textButton: {
        color: "white",
        fontSize: 15,
        fontWeight: "500"
    }
})