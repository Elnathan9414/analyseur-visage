// screens/MetadataScreen.tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';

type Metadata = {
  location?: string;        // format "lat, lon"
  date?: string;
  make?: string;
  model?: string;
  width?: number;
  height?: number;
  orientation?: number;
  fnumber?: number;
  iso?: number;
  exposureTime?: number;
};

export default function MetadataScreen() {
  const [selectedImage, setSelectedImage] = useState<string>();
  const [metadata, setMetadata] = useState<Metadata>();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>();
  const navigation = useNavigation();
  const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const [predictionMode, setPredictionMode] = useState(false);


  // --- Extraction des métadonnées EXIF ---
  const extractLocationFromExif = (exif: any): string | undefined => {
    try {
      let lat = exif.GPSLatitude;
      let lon = exif.GPSLongitude;
      let latRef = exif.GPSLatitudeRef || 'N';
      let lonRef = exif.GPSLongitudeRef || 'E';

      if (Array.isArray(lat) && Array.isArray(lon)) {
        const latDeg = lat[0] + lat[1] / 60 + lat[2] / 3600;
        const lonDeg = lon[0] + lon[1] / 60 + lon[2] / 3600;
        const latValue = latRef === 'S' ? -latDeg : latDeg;
        const lonValue = lonRef === 'W' ? -lonDeg : lonDeg;
        return `${latValue.toFixed(6)}, ${lonValue.toFixed(6)}`;
      } else if (typeof lat === 'number' && typeof lon === 'number') {
        return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      }
      return undefined;
    } catch (error) {
      console.log("Erreur extraction GPS:", error);
      return undefined;
    }
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission de localisation", "Les photos ne seront pas géolocalisées.");
    }
  };

  // --- Sélection d'une image ---
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin d’accéder à vos photos.');
      return;
    }

    await requestLocationPermission();

    setLoading(true);
    setAnalysisResult(undefined);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        exif: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);

        const exif = asset.exif || {};
        const location = extractLocationFromExif(exif);

        let date: string | undefined = undefined;
        if (exif.DateTimeOriginal || exif.DateTime) {
          const rawDate = exif.DateTimeOriginal || exif.DateTime;
          const parts = rawDate.split(' ');
          if (parts.length >= 2) {
            const datePart = parts[0].replace(/:/g, '/');
            const timePart = parts[1].substring(0, 5);
            date = `${datePart} ${timePart}`;
          } else {
            date = rawDate;
          }
        }

        setMetadata({
          location,
          date,
          make: exif.Make,
          model: exif.Model,
          width: exif.PixelXDimension || asset.width,
          height: exif.PixelYDimension || asset.height,
          orientation: exif.Orientation,
          fnumber: exif.FNumber,
          iso: exif.ISOSpeedRatings,
          exposureTime: exif.ExposureTime,
        });
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger l\'image.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- Analyse avec Gemini ---
  const analyzeImage = async () => {
    if (!selectedImage) return;

    setAnalyzing(true);
    setAnalysisResult(undefined);
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        selectedImage,
        [],
        { base64: true, compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64Data = manipResult.base64;
      if (!base64Data) throw new Error("Impossible de convertir l'image en base64");

      let promptText = "";
      if (predictionMode) {
        promptText = `
Analyse cette image en profondeur.

1. Décris précisément ce que tu observes (faits visibles uniquement).
2. Propose des interprétations plausibles (contexte, situation).
3. Fais des hypothèses sur ce qui pourrait se passer ensuite.

Sépare clairement :
- Observations
- Interprétations
- Prédictions

Reste prudent et évite les affirmations incertaines.
fais la mise en forme et evite de mettre des * ou #
`;
      } else {
        promptText = `
Décris précisément cette image (apparence, expression, vêtements, environnement).fais la mise en forme et evite de mettre des * ou #
`;
      };
      if (metadata?.location) {
        promptText = `Cette photo a été prise aux coordonnées GPS suivantes : ${metadata.location}. ` + promptText;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptText },
                { inline_data: { mime_type: "image/jpeg", data: base64Data } }
              ]
            }]
          })
        }
      );

      const data = await response.json();
      console.log("Réponse Gemini:", data);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Aucune analyse disponible.";
      setAnalysisResult(text);
    } catch (error) {
      console.error("Erreur analyse:", error);
      Alert.alert("Erreur", "L'analyse a échoué.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- Ouvrir la carte avec les coordonnées GPS ---

  const openMap = async () => {
    if (!metadata?.location) return;
    const [lat, lon] = metadata.location.split(',').map(coord => coord.trim());
    if (!lat || !lon) return;
    const url = `https://maps.google.com/?q=${lat},${lon}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Erreur", "Impossible d'ouvrir l'application de cartes.");
      }
    } catch (error) {
      Alert.alert("Erreur", "Une erreur est survenue.");
    }
  };

  const resetSelection = () => {
    setSelectedImage(undefined);
    setMetadata(undefined);
    setAnalysisResult(undefined);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {navigation.canGoBack() && (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.title}>📷 Métadonnées & Analyse</Text>
      <Text style={styles.subtitle}>Sélectionnez une photo pour voir ses infos et l'analyser</Text>

      {!selectedImage ? (
        <TouchableOpacity style={styles.selectButton} onPress={pickImage} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.selectButtonText}>📁 Choisir une image</Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.preview} />

          {/* Carte des métadonnées */}
          <View style={styles.metadataCard}>
            <Text style={styles.metadataTitle}>📋 Métadonnées EXIF</Text>
            {metadata && Object.keys(metadata).length > 0 ? (
              <>
                {/* Ligne GPS avec bouton Localiser */}
                {metadata.location && (
                  <View style={styles.locationRow}>
                    <Text style={styles.metadataItem}>
                      <Text style={styles.bold}>📍 GPS :</Text> {metadata.location}
                    </Text>
                    <TouchableOpacity style={styles.mapButton} onPress={openMap}>
                      <Text style={styles.mapButtonText}>🗺️ Localiser</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {metadata.date && (
                  <Text style={styles.metadataItem}>
                    <Text style={styles.bold}>📅 Date :</Text> {metadata.date}
                  </Text>
                )}
                {metadata.make && metadata.model && (
                  <Text style={styles.metadataItem}>
                    <Text style={styles.bold}>📷 Appareil :</Text> {metadata.make} {metadata.model}
                  </Text>
                )}
                {metadata.width && metadata.height && (
                  <Text style={styles.metadataItem}>
                    <Text style={styles.bold}>🔍 Dimensions :</Text> {metadata.width} x {metadata.height} px
                  </Text>
                )}
                {metadata.fnumber && (
                  <Text style={styles.metadataItem}>
                    <Text style={styles.bold}>⚙️ Ouverture :</Text> f/{metadata.fnumber}
                  </Text>
                )}
                {metadata.iso && (
                  <Text style={styles.metadataItem}>
                    <Text style={styles.bold}>🎚️ ISO :</Text> {metadata.iso}
                  </Text>
                )}
                {metadata.exposureTime && (
                  <Text style={styles.metadataItem}>
                    <Text style={styles.bold}>⏱️ Exposition :</Text> {metadata.exposureTime}s
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.noData}>Aucune métadonnée trouvée pour cette image.</Text>
            )}
          </View>
          <MapView
            style={{ width: '100%', height: 200 }}
            initialRegion={{
              latitude: 45.4215,
              longitude: -75.6972,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker coordinate={{ latitude: 45.4215, longitude: -75.6972 }} />
          </MapView>

          {/* Bouton d'analyse Gemini */}
          <TouchableOpacity
            style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
            onPress={analyzeImage}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.analyzeButtonText}>🤖 Analyser</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, predictionMode && styles.modeActive]}
            onPress={() => setPredictionMode(!predictionMode)}
          >
            <Text style={styles.modeText}>
              {predictionMode ? "🔮 Mode prédiction activé" : "🧠 Mode normal"}
            </Text>
          </TouchableOpacity>

          {/* Résultat de l'analyse */}
          {analysisResult && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Résultat de l'analyse</Text>
              <Text style={styles.resultText}>{analysisResult}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.resetButton} onPress={resetSelection}>
            <Text style={styles.resetButtonText}>🔄 Choisir une autre image</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: '#4f46e5',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#64748b',
    marginBottom: 40,
  },
  selectButton: {
    backgroundColor: '#4f46e5',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  previewContainer: {
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metadataCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metadataTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0f172a',
  },
  metadataItem: {
    fontSize: 14,
    marginBottom: 8,
    color: '#334155',
    flex: 1, // pour que le texte prenne l'espace disponible
  },
  bold: {
    fontWeight: '600',
    color: '#0f172a',
  },
  noData: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mapButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#0369a1',
  },
  resultText: {
    fontSize: 14,
    color: '#0c4a6e',
  },
  resetButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    width: '100%',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#334155',
    fontSize: 16,
  },
  modeBtn: {
    backgroundColor: '#e0e7ff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    width: '100%',
    alignItems: 'center',
  },
  modeActive: {
    backgroundColor: '#c7d2fe',
    borderColor: '#a5b4fc',
  },
  modeText: {
    color: '#3730a3',
    fontSize: 14,
    fontWeight: '600',
  },
});