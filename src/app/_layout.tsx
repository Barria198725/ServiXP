import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="home" />
        <Stack.Screen name="providers" />
        <Stack.Screen name="professional" />
        <Stack.Screen name="profile-edit" />
      </Stack>
    </>
  );
}
