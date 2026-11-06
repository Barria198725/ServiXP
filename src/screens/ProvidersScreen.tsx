import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getProvidersByCategory, type ProviderDirectoryEntry } from '../services/auth';

export default function ProvidersScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const [providers, setProviders] = useState<ProviderDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getProvidersByCategory(category ?? '')
      .then((entries) => { if (mounted) setProviders(entries); })
      .catch(() => { if (mounted) setProviders([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [category]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>SERVIXP · PROFESIONALES</Text>
          <Text style={styles.title}>{category || 'Todos los profesionales'}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color="#2563EB" size="large" /> : providers.length ? providers.map((provider) => (
          <Pressable key={provider.email} onPress={() => router.push({ pathname: '/professional', params: { provider: JSON.stringify(provider) } })} style={styles.card}>
            <View style={styles.profileHeader}>
              {provider.profile.profilePhoto
                ? <Image source={{ uri: provider.profile.profilePhoto }} style={styles.avatar} resizeMode="cover" />
                : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{provider.name.slice(0, 2).toLocaleUpperCase()}</Text></View>}
              <View style={styles.nameBlock}>
                <Text style={styles.name}>{provider.name}</Text>
                <Text style={styles.category}>{provider.profile.category}</Text>
                {!!provider.profile.experience && <Text style={styles.meta}>{provider.profile.experience} años de experiencia</Text>}
              </View>
            </View>
            {!!provider.profile.description && <Text style={styles.description}>{provider.profile.description}</Text>}
            {!!provider.profile.specialties && <Text style={styles.detail}><Text style={styles.detailLabel}>Especialidades: </Text>{provider.profile.specialties}</Text>}
            {!!(provider.profile.province || provider.profile.coverage) && <Text style={styles.detail}><Text style={styles.detailLabel}>Cobertura: </Text>{[provider.profile.coverage, provider.profile.province].filter(Boolean).join(', ')}</Text>}
            {!!(provider.profile.days || provider.profile.hours) && <Text style={styles.detail}><Text style={styles.detailLabel}>Horario: </Text>{[provider.profile.days, provider.profile.hours].filter(Boolean).join(' · ')}</Text>}
            {!!provider.profile.emergency && <Text style={styles.emergency}>Disponible para emergencias</Text>}
            <View style={styles.cardFooter}>
              <Text style={styles.rate}>{provider.profile.rateType}{provider.profile.rate ? ` · B/. ${provider.profile.rate}` : ''}</Text>
              <Text style={styles.payment}>{provider.profile.paymentMethods}</Text>
            </View>
            <Text selectable style={styles.email}>{provider.email}</Text>
            {!!provider.profile.phone && <Text selectable style={styles.phone}>{provider.profile.phone}</Text>}
            {!!provider.profile.portfolioPhotos.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                {provider.profile.portfolioPhotos.map((uri) => <Image key={uri} source={{ uri }} style={styles.workPhoto} resizeMode="cover" />)}
              </ScrollView>
            )}
          </Pressable>
        )) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aún no hay profesionales en esta categoría</Text>
            <Text style={styles.emptyCopy}>Cuando alguien se registre para ofrecer este servicio, su perfil aparecerá aquí.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { minHeight: 86, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8EDF2' },
  backButton: { width: 42, height: 46, justifyContent: 'center' },
  backGlyph: { color: '#1F2937', fontSize: 34 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#047857', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#1F2937', fontSize: 20, fontWeight: '800', marginTop: 3 },
  content: { padding: 18, gap: 14, flexGrow: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E6EBF0' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#047857', fontSize: 19, fontWeight: '800' },
  nameBlock: { flex: 1, marginLeft: 12 },
  name: { color: '#1F2937', fontSize: 17, fontWeight: '800' },
  category: { color: '#047857', fontSize: 14, fontWeight: '700', marginTop: 3 },
  meta: { color: '#64748B', fontSize: 12, marginTop: 4 },
  description: { color: '#475569', fontSize: 15, lineHeight: 22, marginBottom: 10 },
  detail: { color: '#475569', fontSize: 13, lineHeight: 19, marginTop: 5 },
  detailLabel: { color: '#334155', fontWeight: '700' },
  emergency: { alignSelf: 'flex-start', color: '#047857', fontSize: 12, fontWeight: '700', backgroundColor: '#ECFDF5', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#EEF2F6', paddingTop: 12, marginTop: 13 },
  rate: { color: '#1D4ED8', fontSize: 13, fontWeight: '800' },
  payment: { color: '#64748B', fontSize: 13 },
  email: { color: '#475569', fontSize: 13, marginTop: 12 },
  phone: { color: '#475569', fontSize: 13, marginTop: 4 },
  gallery: { gap: 8, marginTop: 13 },
  workPhoto: { width: 88, height: 88, borderRadius: 12 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: '#E6EBF0' },
  emptyTitle: { color: '#1F2937', fontSize: 16, fontWeight: '800' },
  emptyCopy: { color: '#64748B', fontSize: 14, lineHeight: 21, marginTop: 8 },
});
