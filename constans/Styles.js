import { StyleSheet, Platform } from "react-native";
import { GlobalStyles } from "./Colors";

//const deviceWidth = Dimensions.get("window").width;

export const styles1 = StyleSheet.create({
    buttonContainer: {
        padding: 30,
        margin: 8,
        width: "120%",
        height: 150,
        borderRadius: 26,
        overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
        backgroundColor: GlobalStyles.colors.accent500,
        elevation: 4,
        shadowColor: 'black',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        alignItems: "center"
    },
})

export const styles2 = StyleSheet.create({
    buttonContainer: {
        padding: 30,
        margin: 8,
        width: "120%",
        height: 150,
        borderRadius: 26,
        overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
        backgroundColor: GlobalStyles.colors.colorbuttonI,
        elevation: 4,
        shadowColor: 'black',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        alignItems: "center"
    },
})

export const styles3 = StyleSheet.create({
    buttonContainer: {
        padding: 20,
        margin: 8,
        width: 395,
        height: 130,
        borderRadius: 26,
        overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
        backgroundColor: GlobalStyles.colors.gray500,
        elevation: 4,
        shadowColor: 'black',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        alignItems: "center"
    },
})

export const styles4 = StyleSheet.create({
    buttonContainer: {
        padding: 30,
        margin: 8,
        width: 189,
        height: 150,
        borderRadius: 26,
        overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
        backgroundColor: "#0088cc",
        elevation: 4,
        shadowColor: 'black',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        alignItems: "center"
    },
})