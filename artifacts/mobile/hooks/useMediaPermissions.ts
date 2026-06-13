import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export interface MediaPermissions {
  cameraGranted: boolean;
  mediaLibraryGranted: boolean;
  requestPermissions: () => Promise<boolean>;
  checkAndRequestCamera: () => Promise<boolean>;
  checkAndRequestMediaLibrary: () => Promise<boolean>;
}

export function useMediaPermissions(): MediaPermissions {
  const [cameraGranted, setCameraGranted] = useState(false);
  const [mediaLibraryGranted, setMediaLibraryGranted] = useState(false);

  useEffect(() => {
    void checkCurrentStatus();
  }, []);

  async function checkCurrentStatus() {
    try {
      const cameraStatus = await ImagePicker.getCameraPermissionsAsync();
      const mediaStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
      setCameraGranted(cameraStatus.granted);
      setMediaLibraryGranted(mediaStatus.granted);
    } catch {
      setCameraGranted(false);
      setMediaLibraryGranted(false);
    }
  }

  async function checkAndRequestCamera(): Promise<boolean> {
    try {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status === 'granted') {
        setCameraGranted(true);
        return true;
      }
      if (!canAskAgain) {
        Alert.alert(
          'Kamerazugriff benötigt',
          'FahrtDoc benötigt Kamerazugriff um Belege zu fotografieren. Bitte erlaube den Zugriff in den Einstellungen.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Einstellungen öffnen', onPress: () => void Linking.openSettings() },
          ]
        );
        return false;
      }
      Alert.alert(
        'Kamerazugriff verweigert',
        'Ohne Kamerazugriff kannst du keine Belege fotografieren.',
        [{ text: 'OK', style: 'cancel' }]
      );
      return false;
    } catch {
      return false;
    }
  }

  async function checkAndRequestMediaLibrary(): Promise<boolean> {
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status === 'granted') {
        setMediaLibraryGranted(true);
        return true;
      }
      if (!canAskAgain) {
        Alert.alert(
          'Fotobibliothek-Zugriff benötigt',
          'FahrtDoc benötigt Zugriff auf deine Fotos um Belege hochzuladen. Bitte erlaube den Zugriff in den Einstellungen.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Einstellungen öffnen', onPress: () => void Linking.openSettings() },
          ]
        );
        return false;
      }
      Alert.alert(
        'Zugriff verweigert',
        'Ohne Zugriff auf die Fotobibliothek kannst du keine Belege hochladen.',
        [{ text: 'OK', style: 'cancel' }]
      );
      return false;
    } catch {
      return false;
    }
  }

  async function requestPermissions(): Promise<boolean> {
    const camera = await checkAndRequestCamera();
    const media = await checkAndRequestMediaLibrary();
    return camera && media;
  }

  return {
    cameraGranted,
    mediaLibraryGranted,
    requestPermissions,
    checkAndRequestCamera,
    checkAndRequestMediaLibrary,
  };
}
