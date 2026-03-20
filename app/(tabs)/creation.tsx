import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { fal } from "@fal-ai/client";
import Header from '@/components/Header';

type GeneratedImage = {
  prompt: string;
  imageUrl: string;
  timestamp: number;
};

const STYLES = [
  { label: "🎨 Normal", value: "" },
  { label: "🎌 Anime", value: "anime style, vibrant colors, detailed" },
  { label: "📸 Realistic", value: "photorealistic, ultra detailed, 4k" },
  { label: "🌃 Cyberpunk", value: "cyberpunk, neon lights, futuristic" },
  { label: "🖌️ Painting", value: "oil painting, artistic" },
  { label: "🧊 3D", value: "3D render, cinematic lighting" },
];

const MODELS = [
  { label: "⚡ Schnell", value: "fal-ai/flux/schnell" },
  { label: "🎨 Dev", value: "fal-ai/flux/dev" },
  { label: "🌈 Kolors", value: "fal-ai/kolors" },
  { label: "🎬 Aura", value: "fal-ai/aura-flow" },
];

const FAL_KEY = process.env.EXPO_PUBLIC_FAL_KEY;

if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY });
}

export default function FalImageGenerationScreen() {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const scrollViewRef = useRef<ScrollView>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un prompt.');
      return;
    }

    if (!FAL_KEY) {
      Alert.alert('Erreur', 'Clé API fal.ai manquante.');
      return;
    }

    setLoading(true);
    setCurrentImage(null);

    try {
      const finalPrompt = `${prompt} ${selectedStyle.value}`;
      let result;

      if (selectedImage) {
        let imageUrlToUse = selectedImage;

        if (selectedImage.startsWith("file://")) {
          const response = await fetch(selectedImage);
          const blob = await response.blob();
          imageUrlToUse = await fal.storage.upload(blob);
        }

        result = await fal.subscribe(
          "fal-ai/flux/dev/image-to-image",
          {
            input: {
              prompt: finalPrompt,
              image_url: imageUrlToUse,
              strength: 0.7,
            },
          }
        );
      } else {
        result = await fal.subscribe("fal-ai/flux/schnell", {
          input: {
            prompt: finalPrompt,
          },
        });
      }

      const imageUrl = result?.data?.images?.[0]?.url;
      if (!imageUrl) throw new Error("Aucune image générée");

      setCurrentImage(imageUrl);
      setSelectedImage(null);

      setGeneratedImages(prev => [{
        prompt: finalPrompt,
        imageUrl,
        timestamp: Date.now(),
      }, ...prev]);

      setPrompt('');

    } catch (error: any) {
      console.log("FULL ERROR:", JSON.stringify(error, null, 2));
      Alert.alert("Erreur", error?.message || "Erreur génération");
    } finally {
      setLoading(false);
    }
  };

const saveImage = async () => {
  if (!currentImage) return;

  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return;

    await MediaLibrary.saveToLibraryAsync(currentImage);
    Alert.alert('Image sauvegardée ✅');

  } catch {
    Alert.alert('Erreur sauvegarde');
  }
};

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Header title="🎨 AI Image Studio" />
    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Modèle</Text>
<ScrollView horizontal showsHorizontalScrollIndicator={false}>
  {MODELS.map((model) => (
    <TouchableOpacity
      key={model.value}
      style={[
        styles.styleChip,
        selectedModel.value === model.value && styles.styleChipActive,
      ]}
      onPress={() => setSelectedModel(model)}
    >
      <Text style={{ color: '#fff' }}>{model.label}</Text>
    </TouchableOpacity>
  ))}
</ScrollView>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
        >
          {selectedImage && (
            <View style={styles.previewBox}>
              <Text style={styles.sectionTitle}>Image à modifier</Text>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} />
              <TouchableOpacity onPress={() => setSelectedImage(null)}>
                <Text style={{ color: '#ef4444', marginTop: 6 }}>✕ Retirer</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentImage && (
            <View style={styles.imageBox}>
              <Image source={{ uri: currentImage }} style={styles.mainImage} />

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.saveBtn} onPress={saveImage}>
                  <Text style={styles.btnText}>💾 Save</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.newBtn} onPress={() => setCurrentImage(null)}>
                  <Text style={styles.btnText}>🔄 New</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Styles</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STYLES.map((style) => (
              <TouchableOpacity
                key={style.label}
                style={[
                  styles.styleChip,
                  selectedStyle.label === style.label && styles.styleChipActive,
                ]}
                onPress={() => setSelectedStyle(style)}
              >
                <Text style={{ color: '#fff' }}>{style.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {generatedImages.length > 0 && (
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Historique</Text>
          )}

          {generatedImages.map((item) => (
            <TouchableOpacity key={item.timestamp} onPress={() => setCurrentImage(item.imageUrl)}>
              <Image source={{ uri: item.imageUrl }} style={styles.historyImage} />
              <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{item.prompt}</Text>
            </TouchableOpacity>
          ))}

          {loading && (
            <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 20 }} />
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={pickImage}>
            <Text style={{ fontSize: 24 }}>📷</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Describe your image..."
            placeholderTextColor="#94a3b8"
            value={prompt}
            onChangeText={setPrompt}
          />

          <TouchableOpacity
            style={[styles.generateBtn, loading && { opacity: 0.5 }]}
            onPress={generateImage}
            disabled={loading}
          >
            <Text style={styles.btnText}>Go</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16 },
  sectionTitle: { color: '#fff', marginBottom: 8, fontWeight: '600' },
  previewBox: { marginBottom: 16 },
  previewImage: { width: 120, height: 120, borderRadius: 10 },
  imageBox: { marginBottom: 20 },
  mainImage: { width: '100%', height: 300, borderRadius: 12 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: { flex: 1, backgroundColor: '#10b981', padding: 10, borderRadius: 8, alignItems: 'center' },
  newBtn: { flex: 1, backgroundColor: '#6366f1', padding: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', textAlign: 'center' },
  styleChip: { backgroundColor: '#1e293b', padding: 10, borderRadius: 20, marginRight: 10 },
  styleChipActive: { backgroundColor: '#6366f1' },
  historyImage: { width: '100%', height: 150, borderRadius: 10, marginTop: 10 },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#020617', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#1e293b', color: '#fff', borderRadius: 20, paddingHorizontal: 10, marginHorizontal: 10, height: 44 },
  generateBtn: { backgroundColor: '#6366f1', padding: 10, borderRadius: 20 },
});