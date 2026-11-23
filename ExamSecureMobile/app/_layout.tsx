import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#F8FAFC' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="candidate/login" options={{ headerShown: false }} />
        <Stack.Screen name="candidate/role-application" options={{ headerShown: false }} />
        <Stack.Screen name="candidate/system-check" options={{ headerShown: false }} />
        <Stack.Screen
          name="candidate/exam"
          options={{
            headerShown: false,
            gestureEnabled: false, // Prevent swipe-back during exam
            animation: 'fade',
          }}
        />
        <Stack.Screen name="candidate/submitted" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
