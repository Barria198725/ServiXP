import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();
  const { email, name, role } = useLocalSearchParams<{ email?: string; name?: string; role?: string }>();

  const goToHome = useCallback(
    () => router.replace({ pathname: '/home', params: { email: email ?? '', name: name ?? '', role: role ?? 'customer' } }),
    [email, name, role, router],
  );

  useEffect(() => {
    const timer = setTimeout(goToHome, 2500);
    return () => clearTimeout(timer);
  }, [goToHome]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.logoFrame}>
          <Image source={require('../../assets/servixp-logo.jpg')} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
        <Text style={styles.eyebrow}>INICIO DE SESIÓN CORRECTO</Text>
        <Text style={styles.title}>{name ? `¡Bienvenidos a ServiX XP, ${name}!` : '¡Bienvenidos a ServiX XP!'}</Text>
        <Text style={styles.description}>
          {role === 'provider'
            ? 'Nos alegra tenerte aquí. Tu espacio profesional ya está listo.'
            : 'Encuentra profesionales de confianza para ayudarte en casa.'}
        </Text>
        <ActivityIndicator accessibilityLabel="Abriendo tu inicio" color="#047857" size="large" style={styles.loading} />
        <Text style={styles.redirectText}>Preparando tu inicio…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  logoFrame: { width: 154, height: 112, borderRadius: 21, overflow: 'hidden', backgroundColor: '#111A20', marginBottom: 36 },
  logo: { width: '100%', height: '100%' },
  check: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  checkText: { color: '#047857', fontSize: 32, fontWeight: '800' },
  eyebrow: { color: '#047857', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#1E303B', fontSize: 29, lineHeight: 38, fontWeight: '900', textAlign: 'center', marginTop: 9 },
  description: { color: '#77848D', fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 10, maxWidth: 330 },
  userName: { color: '#047857', fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  loading: { marginTop: 30 },
  redirectText: { color: '#77848D', fontSize: 13, marginTop: 10 },
});
