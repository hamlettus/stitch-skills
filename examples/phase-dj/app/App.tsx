import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { ChakraPetch_500Medium, ChakraPetch_600SemiBold, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { colors } from '@/theme';
import { RootTabs } from '@/navigation/RootTabs';
import { DeckProvider } from '@/context/DeckContext';

export interface AppProps {}

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg2,
    border: colors.line,
    primary: colors.key,
    text: colors.text,
  },
};

export default function App(_props: AppProps) {
  const [loaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    ChakraPetch_500Medium,
    ChakraPetch_600SemiBold,
    ChakraPetch_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  if (!loaded) {
    return <View style={styles.loading} />;
  }

  return (
    <SafeAreaProvider>
      <DeckProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <RootTabs />
        </NavigationContainer>
      </DeckProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg },
});
