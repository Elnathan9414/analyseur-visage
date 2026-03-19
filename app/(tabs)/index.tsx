import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useState, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';


export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back'); // Nouvel état pour le type de caméra
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);

  // 📸 permission + open caméra (choix du type)
  const openCamera = async (facing: 'back' | 'front' = 'back') => {
    if (permission?.granted) {
      setCameraFacing(facing);
      setCameraVisible(true);
    } else {
      const { granted } = await requestPermission();
      if (granted) {
        setCameraFacing(facing);
        setCameraVisible(true);
      } else {
        Alert.alert("Permission refusée", "L'accès à la caméra est nécessaire pour prendre des photos.");
      }
    }
  };

  // 📷 capture
  const takePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
      });

      setCameraVisible(false);
      setImage(photo.uri);
      // analyse directe
      analyzeImage(photo.uri);
    }
  };

  // 🖼️ galerie
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setResult(null);
    }
  };

  // 🧠 analyse
  const analyzeImage = async (customUri?: string) => {
    const uri = customUri || image;
    if (!uri) return;

    try {
      setLoading(true);

      // Utilisation de ImageManipulator pour obtenir le base64 (compatible avec tous les types d'URI)
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [], // aucune modification
        { base64: true, compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64Data = manipResult.base64;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyCVSZ4NwVGSEFGHzqQMZS9CXypHQq0a0ok`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "Décris précisément cette image (apparence, expression, vêtements, environnement)."
                  },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: base64Data
                    }
                  }
                ]
              }
            ]
          })
        }
      );

      const data = await response.json();
      console.log("REPONSE:", data);

      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "Aucune analyse";

      setResult(text);

    } catch (error) {
      console.log("Erreur:", error);
      setResult("Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  // 📸 écran caméra (arrière ou avant selon cameraFacing)
  if (cameraVisible) {
    return (
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          ref={cameraRef}
          facing={cameraFacing} // Utilisation de l'état pour choisir la caméra
        />
        <View style={{ position: 'absolute', bottom: 50, width: '100%', alignItems: 'center' }}>
          <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
            <Text style={{ color: '#fff', fontSize: 18 }}>📸 Capturer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 🖥️ UI principale
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AI Vision</Text>
      <Text style={styles.subtitle}>Analyse intelligente d’image</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={pickImage}>
          <Text style={styles.primaryText}>📁 Galerie</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => openCamera('back')}>
          <Text style={styles.secondaryText}>📸 Caméra</Text>
        </TouchableOpacity>

        {/* Nouveau bouton Selfie */}
        <TouchableOpacity style={styles.selfieBtn} onPress={() => openCamera('front')}>
          <Text style={styles.selfieText}>🤳 Selfie</Text>
        </TouchableOpacity>
      </View>

      {image && (
        <View style={styles.card}>
          <Image source={{ uri: image }} style={styles.preview} />

          <TouchableOpacity style={styles.analyzeBtn} onPress={() => analyzeImage()}>
            <Text style={styles.analyzeText}>
              {loading ? "Analyse..." : "Analyser"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Résultat</Text>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: "#f8fafc" },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", marginTop: 40 },
  subtitle: { textAlign: "center", marginBottom: 30, color: "#666" },
  actions: { 
    flexDirection: "row", 
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10 
  },
  primaryBtn: { 
    flex: 1, 
    backgroundColor: "#111", 
    padding: 16, 
    borderRadius: 12, 
    alignItems: "center" 
  },
  secondaryBtn: { 
    flex: 1, 
    borderWidth: 1, 
    borderColor: "#ccc", 
    padding: 16, 
    borderRadius: 12, 
    alignItems: "center" 
  },
  selfieBtn: { 
    flex: 1, 
    backgroundColor: "#f43f5e", 
    padding: 16, 
    borderRadius: 12, 
    alignItems: "center" 
  },
  primaryText: { color: "#fff" },
  secondaryText: { color: "#333" },
  selfieText: { color: "#fff", fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginTop: 10 },
  preview: { width: "100%", height: 260, borderRadius: 12 },
  analyzeBtn: { marginTop: 12, backgroundColor: "#4f46e5", padding: 14, borderRadius: 12, alignItems: "center" },
  analyzeText: { color: "#fff" },
  resultCard: { marginTop: 20, backgroundColor: "#fff", padding: 16, borderRadius: 16 },
  resultTitle: { fontSize: 20, fontWeight: "600", marginBottom: 10 },
  resultText: { color: "#444" },
  captureBtn: { backgroundColor: "#000", padding: 20, borderRadius: 40, alignItems: "center", width: 200 },
});