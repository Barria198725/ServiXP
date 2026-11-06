import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, signIn } from '../services/auth';
import { showAlert } from '../utils/showAlert';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ registered?: string; identifier?: string; photoWarning?: string }>();
  const initialIdentifier = typeof params.identifier === 'string' ? params.identifier : '';
  return <LoginForm key={`${params.registered ?? ''}:${initialIdentifier}`} initialIdentifier={initialIdentifier} registered={params.registered === 'true'} photoWarning={params.photoWarning === 'true'} />;
}

function LoginForm({ initialIdentifier, registered, photoWarning }: { initialIdentifier: string; registered: boolean; photoWarning: boolean }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      showAlert('Completa tus datos', 'Escribe tu correo o nickname y contraseña para continuar.');
      return;
    }
    setLoading(true);
    try {
      const user = await signIn(identifier, password);
      router.replace({ pathname: '/welcome', params: { email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      showAlert('No pudimos iniciar sesión', error instanceof ApiError ? error.message : 'Revisa tus datos e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoFrame}>
            <Image source={require('../../assets/servixp-logo.jpg')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.welcome}>Bienvenidos a ServiXP</Text>
          <Text style={styles.tagline}>¡Conectamos con Profesionales!</Text>
          <View style={styles.form}>
            <Text style={styles.heading}>Iniciar sesión</Text>
            {registered && <View style={styles.successNotice}><Text style={styles.successTitle}>Cuenta creada correctamente</Text><Text style={styles.successMessage}>Inicia sesión con tus credenciales para continuar.{photoWarning ? ' La cuenta está activa; podrás volver a cargar la foto o los documentos más tarde.' : ''}</Text></View>}
            <TextInput
              accessibilityLabel="Correo electrónico o nickname"
              autoCapitalize="none"
              autoComplete="username"
              placeholder="Correo electrónico o nickname"
              placeholderTextColor="#68737A"
              returnKeyType="next"
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
            />
            <TextInput
              accessibilityLabel="Contraseña"
              autoComplete="current-password"
              placeholder="Contraseña"
              placeholderTextColor="#68737A"
              returnKeyType="done"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => showAlert('Recuperar contraseña', 'Contacta al equipo de ServiXP para restablecer tu contraseña.')}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>Olvidé mi contraseña</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={() => void handleLogin()}
              style={({ pressed }) => [styles.submit, pressed && styles.pressed, loading && styles.disabled]}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Iniciar Sesión</Text>}
            </Pressable>
            <View style={styles.registerRow}>
              <Text style={styles.registerPrompt}>¿No tienes cuenta?</Text>
              <View style={styles.registerOptions}>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/register', params: { role: 'provider' } })} style={styles.registerOption}>
                  <Text style={styles.registerLink}>Profesional</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/register', params: { role: 'customer' } })} style={[styles.registerOption, styles.registerOptionPrimary]}>
                  <Text style={styles.registerLinkPrimary}>Usuario normal</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 28 },
  logoFrame: {
    width: '100%',
    maxWidth: 350,
    aspectRatio: 1.08,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#101619',
    marginBottom: 18,
  },
  logo: { width: '100%', height: '100%' },
  welcome: { color: '#1F2937', fontSize: 23, fontWeight: '800', textAlign: 'center' },
  tagline: { color: '#475569', fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  form: { width: '100%', maxWidth: 410, marginTop: 34 },
  heading: { color: '#1F2937', fontSize: 21, fontWeight: '800', marginBottom: 18 },
  input: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 19,
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
  },
  forgotButton: { alignSelf: 'flex-end', marginTop: -7, marginBottom: 24, paddingVertical: 5 },
  forgotText: { color: '#526067', fontSize: 14, fontWeight: '700' },
  submit: {
    height: 58,
    borderRadius: 30,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.17,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  submitText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.7 },
  registerRow: { alignItems: 'center', justifyContent: 'center', marginTop: 17, gap: 10 },
  registerPrompt: { color: '#526067', fontSize: 14 },
  registerOptions: { flexDirection: 'row', gap: 10 },
  registerOption: { minWidth: 112, minHeight: 42, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#047857', alignItems: 'center', justifyContent: 'center' },
  registerOptionPrimary: { backgroundColor: '#047857' },
  registerLink: { color: '#047857', fontSize: 14, fontWeight: '800' },
  registerLinkPrimary: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  successNotice: { backgroundColor: '#ECFDF5', borderRadius: 14, borderWidth: 1, borderColor: '#A7F3D0', padding: 12, marginBottom: 14 },
  successTitle: { color: '#047857', fontSize: 14, fontWeight: '800' },
  successMessage: { color: '#526067', fontSize: 12, lineHeight: 18, marginTop: 4 },
});
