import { useState, useEffect } from "react";
import { StyleSheet, TextInput, View } from "react-native"
import { MaterialIcons } from "@expo/vector-icons";

function TextImputClient({ text, onDattaChange, value,name,type,maxLength }) {
    const [data, setData] = useState(""); 

    function InputHandler(enteredText) {
        setData(enteredText);
    }

    useEffect(() => { 
        onDattaChange(data);
    }, [data]);

    return (
        <View style={styles.textContainer}>
            <TextInput
                style={styles.textImput}
                placeholder={text}
                onChangeText={InputHandler}
                keyboardType={type}
                value={licencias}
                maxLength={maxLength}
            />
            <MaterialIcons name={name} size={24} color="#000" style={styles.icon} />
        </View>
    );
}
export default TextImputClient;

const styles = StyleSheet.create({
    textImput: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#dbd9df",
        backgroundColor: "#dbd9df",
        width: "100%",
        padding: 12,
        color: "#120438",
        borderRadius: 6,
    },
    textContainer: {
        marginTop: 3,
        marginBottom: 15,
        flexDirection: "row",
        alignItems: "center",
        borderColor: "#dbd9df",
        backgroundColor: "#dbd9df",
        borderRadius: 6,

    },
    pressed: {
        opacity: 0.7
    },
    icon: {
        marginRight: 10,
    }
})