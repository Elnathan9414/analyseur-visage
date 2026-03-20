// components/Header.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';


type HeaderProps = {
  title: string;
  showBack?: boolean; // optionnel, pour afficher ou non le bouton retour
};

export default function Header({ title, showBack = true }: HeaderProps) {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {showBack && navigation.canGoBack() && (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title}>{title}</Text>
      {/* Espace vide pour équilibrer si le bouton retour est présent */}
      {showBack && navigation.canGoBack() ? <View style={styles.placeholder} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#02011e',
    borderBottomWidth: 1,
    borderBottomColor: '#b0a101',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backText: {
    fontSize: 24,
    color: '#4f46e5',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 40, // pour équilibrer l'espace du bouton retour
  },
});