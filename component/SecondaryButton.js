import { View, Pressable, StyleSheet, Text, Platform } from "react-native"
import { MaterialIcons } from "@expo/vector-icons";


function SecondaryButton({ onPress, name, styles: containerStyles, text, text2, iconSize = 40, fontSize = 15 }) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => pressed && localStyles.pressed}>
            <View style={containerStyles}>
                <MaterialIcons name={name} size={iconSize} color="white" />
                {!!text && (
                    <Text style={[localStyles.textButton, { fontSize }]}>
                        {text}
                    </Text>
                )}
                {!!text2 && (
                    <Text style={[localStyles.textButton, { fontSize }]}>
                        {text2}
                    </Text>
                )}
            </View>
        </Pressable>
    );
}

export default SecondaryButton;

const localStyles = StyleSheet.create({
    pressed: {
        opacity: 0.5
    },
    textButton: {
        color: "white",
        fontFamily: "open-sans",
        textAlign: "center",
        alignSelf: "stretch",
        paddingHorizontal: 10,
        ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
    }
})
