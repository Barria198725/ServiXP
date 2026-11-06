import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { getMyProviderProfile, removeMyProviderPhoto, updateMyProviderProfile, uploadProviderFiles, type ProviderProfile } from '../services/auth';
import { showAlert } from '../utils/showAlert';
import colors from '../theme/colors';

const emptyProfile: ProviderProfile = { phone: '', category: '', specialties: '', description: '', province: '', coverage: '', days: '', hours: '', emergency: false, experience: '', identityDocument: '', certificate: '', profilePhoto: '', portfolioPhotos: [], rateType: '', rate: '', paymentMethods: '', liabilityInsurance: false };

export default function ProfileEditScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<ProviderProfile>(emptyProfile);
  const [newAvatar, setNewAvatar] = useState('');
  const [newWorkPhotos, setNewWorkPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key: keyof ProviderProfile, value: string | boolean) => setProfile((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    getMyProviderProfile().then((entry) => { setName(entry.name); setProfile(entry.profile); setAuthorized(true); }).catch((error) => { setAccessError(error instanceof Error ? error.message : 'Inicia sesión con tu cuenta profesional.'); }).finally(() => setLoading(false));
  }, []);

  const pick = async (multiple: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, selectionLimit: multiple ? 8 : 1, quality: 0.8 });
    if (result.canceled) return;
    const uris = result.assets.map((asset) => asset.uri);
    if (multiple) setNewWorkPhotos((current) => [...current, ...uris].slice(0, 8));
    else setNewAvatar(uris[0] ?? '');
  };

  const save = async () => {
    if (!authorized) return;
    if (!name.trim() || !profile.phone.trim() || !profile.category.trim() || !profile.description.trim() || !profile.province?.trim()) return showAlert('Faltan datos', 'Completa nombre, teléfono, oficio, descripción y provincia.');
    setSaving(true);
    try {
      await updateMyProviderProfile(name, profile);
      if (newAvatar || newWorkPhotos.length) await uploadProviderFiles({ ...profile, profilePhoto: newAvatar, portfolioPhotos: newWorkPhotos, identityDocument: '', certificate: '' });
      showAlert('Perfil actualizado', 'Tus datos y fotos quedaron guardados.');
      router.back();
    } catch (error) { showAlert('No se pudo guardar', error instanceof Error ? error.message : 'Inténtalo nuevamente.'); }
    finally { setSaving(false); }
  };

  const removePhoto = async (uri: string, kind: 'avatar' | 'work') => {
    try {
      await removeMyProviderPhoto(uri);
      if (kind === 'avatar') setProfile((current) => ({ ...current, profilePhoto: '' }));
      else setProfile((current) => ({ ...current, portfolioPhotos: current.portfolioPhotos.filter((photo) => photo !== uri) }));
    } catch (error) { showAlert('No se pudo quitar la foto', error instanceof Error ? error.message : 'Inténtalo nuevamente.'); }
  };

  const field = (label: string, key: keyof ProviderProfile, multiline = false) => <View style={styles.field} key={key}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={String(profile[key] ?? '')} onChangeText={(value) => set(key, value)} multiline={multiline} style={[styles.input, multiline && styles.multiline]} placeholder={label} placeholderTextColor={colors.muted} /></View>;
  const toggle = (label: string, key: 'emergency' | 'liabilityInsurance') => <View style={styles.toggle} key={key}><Text style={styles.label}>{label}</Text><Switch value={Boolean(profile[key])} onValueChange={(value) => set(key, value)} /></View>;

  return <SafeAreaView style={styles.safe} edges={['top']}><StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.title}>Editar perfil profesional</Text><View style={{ width: 34 }} /></View>
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : !authorized ? <View style={styles.accessDenied}><Text style={styles.section}>Perfil no disponible</Text><Text style={styles.label}>{accessError}</Text><Text style={styles.hint}>Inicia sesión con la cuenta profesional propietaria del perfil para modificar sus datos y fotos.</Text><Pressable style={styles.secondaryButton} onPress={() => router.back()}><Text style={styles.secondaryText}>Volver</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.section}>Información del perfil</Text>
      <View style={styles.field}><Text style={styles.label}>Nombre</Text><TextInput accessibilityLabel="Nombre" value={name} onChangeText={setName} style={styles.input} /></View>
      {field('Teléfono', 'phone')}{field('Oficio', 'category')}{field('Especialidades', 'specialties')}{field('Descripción', 'description', true)}{field('Provincia', 'province')}{field('Zonas que cubres', 'coverage')}{field('Días disponibles', 'days')}{field('Horario', 'hours')}{field('Años de experiencia', 'experience')}{field('Tipo de tarifa', 'rateType')}{field('Precio o rango', 'rate')}{field('Métodos de pago', 'paymentMethods')}
      {toggle('Atiende emergencias', 'emergency')}{toggle('Seguro de responsabilidad civil', 'liabilityInsurance')}
      <Text style={styles.section}>Fotos</Text>
      {(newAvatar || profile.profilePhoto) ? <View style={styles.avatarWrap}><Image source={{ uri: newAvatar || profile.profilePhoto }} style={styles.avatar} resizeMode="cover" />{!newAvatar && <Pressable accessibilityRole="button" accessibilityLabel="Quitar foto de perfil" style={styles.removeAvatar} onPress={() => void removePhoto(profile.profilePhoto, 'avatar')}><Text style={styles.removeText}>Quitar foto</Text></Pressable>}</View> : null}
      <Pressable style={styles.secondaryButton} onPress={() => void pick(false)}><Text style={styles.secondaryText}>{newAvatar ? 'Cambiar foto de perfil seleccionada' : 'Cargar o cambiar foto de perfil'}</Text></Pressable>
      <View style={styles.photoGrid}>{[...profile.portfolioPhotos.map((uri) => ({ uri, existing: true })), ...newWorkPhotos.map((uri) => ({ uri, existing: false }))].map(({ uri, existing }, index) => <View key={`${uri}-${index}`} style={styles.photoWrap}><Image source={{ uri }} style={styles.photo} resizeMode="cover" />{existing ? <Pressable accessibilityRole="button" accessibilityLabel="Quitar foto de trabajo" style={styles.removePhoto} onPress={() => void removePhoto(uri, 'work')}><Text style={styles.removeText}>Quitar</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Quitar foto seleccionada" style={styles.removePhoto} onPress={() => setNewWorkPhotos((current) => current.filter((photo) => photo !== uri))}><Text style={styles.removeText}>Quitar</Text></Pressable>}</View>)}</View>
      <Pressable style={styles.secondaryButton} onPress={() => void pick(true)}><Text style={styles.secondaryText}>Agregar fotos de trabajos</Text></Pressable>
      <Pressable disabled={saving} style={[styles.saveButton, saving && { opacity: 0.65 }]} onPress={() => void save()}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Guardar cambios</Text>}</Pressable>
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, header: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { fontSize: 36, color: colors.text }, title: { color: colors.text, fontSize: 17, fontWeight: '800' }, content: { padding: 18, paddingBottom: 40 }, accessDenied: { padding: 24, marginTop: 28 }, hint: { color: colors.muted, lineHeight: 21, marginTop: 12 }, section: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 12, marginBottom: 12 }, field: { marginBottom: 12 }, label: { color: colors.text, fontWeight: '700', marginBottom: 6 }, input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.surface }, multiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }, toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 }, avatarWrap: { alignItems: 'center' }, avatar: { width: 100, height: 100, borderRadius: 50, margin: 12 }, removeAvatar: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.danger }, removeText: { color: '#fff', fontSize: 11, fontWeight: '800' }, secondaryButton: { padding: 14, backgroundColor: colors.surfaceRaised, borderRadius: 12, alignItems: 'center', marginVertical: 8 }, secondaryText: { color: colors.primary, fontWeight: '700' }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }, photoWrap: { width: '31%', aspectRatio: 1, position: 'relative' }, photo: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: colors.surfaceRaised }, removePhoto: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }, saveButton: { padding: 16, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', marginTop: 20 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 16 } });
