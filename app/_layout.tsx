import { Roboto_700Bold, useFonts } from '@expo-google-fonts/roboto';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { requestNotificationPermissions } from './utils/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Roboto_700Bold });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!fontsLoaded) return;
    const timer = setTimeout(async () => {
      await requestNotificationPermissions();
      setReady(true);
      await SplashScreen.hideAsync();
    }, 2000);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={styles.splashTitle}>PONDORA</Text>
        <Text style={styles.splashSub}>Pond Optimization & Regulation Assistant</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: '#F8F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  splashLogo: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
  splashTitle: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 42,
    letterSpacing: 10,
    color: '#F97316',
  },
  splashSub: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#C2896A',
    textTransform: 'uppercase',
  },
});


