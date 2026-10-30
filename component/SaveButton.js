import { View, StyleSheet, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";

function SaveButton({ onPress, isEnabled }) {
  return (
    <View style={[styles.buttonOuterContainer, !isEnabled && styles.disabled]}>
      <Pressable
        onPress={onPress}
        disabled={!isEnabled}
        android_ripple={{ color: "#0A4A80" }}
        style={({ pressed }) => [pressed && isEnabled && styles.pressed]}
      >
        <LinearGradient
          colors={["#1280CE", "#0F76C4", "#0D6BB3"]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.buttonInnerContainer}
        >
          <MaterialIcons name="verified-user" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>GUARDAR</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default SaveButton;

const styles = StyleSheet.create({
  buttonOuterContainer: {
    borderRadius: 10,
    margin: 4,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#0B5A96",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonInnerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 10,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontFamily: "open-sans-bold",
    letterSpacing: 1.4,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
