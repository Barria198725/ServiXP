import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getProviderReviews, getProvidersByCategory, type ProviderDirectoryEntry, type ProviderReview } from '../services/auth';
import { showAlert } from '../utils/showAlert';
import colors from '../theme/colors';

function readProvider(value?: string): ProviderDirectoryEntry | null {
  if (!value) return null;
  try { return JSON.parse(value) as ProviderDirectoryEntry; } catch { return null; }
}

export default function ProfessionalDetailScreen() {
  const router = useRouter();
  const { provider: providerParam } = useLocalSearchParams<{ provider?: string }>();
  const [provider, setProvider] = useState(() => readProvider(providerParam));
  const [reviews, setReviews] = useState<ProviderReview[]>(provider?.reviews ?? []);
  const [loading, setLoading] = useState(Boolean(provider?.id));

  const providerId = provider?.id;
  const category = provider?.profile.category;
  useEffect(() => {
    if (!providerId || !category) return;
    let mounted = true;
    const refresh = async () => {
      try {
        const [freshReviews, entries] = await Promise.all([getProviderReviews(providerId), getProvidersByCategory(category)]);
        if (!mounted) return;
        setReviews(freshReviews);
        const freshProvider = entries.find((entry) => entry.id === providerId);
        if (freshProvider) setProvider(freshProvider);
      } catch { /* Mantiene los datos recibidos por navegación si la API no está disponible. */ }
      finally { if (mounted) setLoading(false); }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 30000);
    return () => { mounted = false; clearInterval(timer); };
  }, [providerId, category]);

  if (!provider) return <SafeAreaView style={styles.safeArea}><Text style={styles.error}>No se pudo cargar el perfil del profesional.</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>Volver</Text></Pressable></SafeAreaView>;

  const photos = provider.profile.portfolioPhotos ?? [];
  const rating = provider.rating ?? (reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : 0);
  const contact = (message: boolean) => {
    const digits = (provider.profile.phone ?? '').replace(/\D/g, '');
    if (!digits) return showAlert('Contacto no disponible', 'Este profesional aún no ha publicado su teléfono.');
    const url = message ? `https://wa.me/${digits}` : `tel:${digits}`;
    void Linking.openURL(url).catch(() => showAlert('No se pudo abrir el contacto', 'Inténtalo de nuevo desde tu dispositivo.'));
  };

  return <SafeAreaView style={styles.safeArea} edges={['top']}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable><Text style={styles.headerTitle} numberOfLines={1}>{provider.profile.category}</Text><View style={styles.backSpacer} /></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {photos[0] ? <Image source={{ uri: photos[0] }} style={styles.banner} resizeMode="cover" /> : <View style={[styles.banner, styles.bannerFallback]}><Text style={styles.bannerText}>{provider.profile.category}</Text></View>}
      </View>
      <View style={styles.profileRow}>
        {provider.profile.profilePhoto ? <Image source={{ uri: provider.profile.profilePhoto }} style={styles.avatar} resizeMode="cover" /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{provider.name.slice(0, 1).toUpperCase()}</Text></View>}
        <View style={styles.identity}>
          <View style={styles.nameRow}><Text style={styles.name} numberOfLines={1}>{provider.name}</Text>{provider.verified && <Text accessibilityLabel="Verificado" style={styles.verified}>✓</Text>}</View>
          <Text style={styles.specialty} numberOfLines={2}>{provider.profile.specialties || provider.profile.category}</Text>
          <View style={styles.metaRow}><Text style={styles.stars}>★</Text><Text style={styles.rating}>{rating.toFixed(1)}</Text><Text style={styles.separator}>|</Text><Text style={styles.reviewCount}>{provider.reviewCount ?? reviews.length} reseñas</Text></View>
        </View>
      </View>
      {!!provider.profile.description && <Text style={styles.description}>{provider.profile.description}</Text>}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Información del profesional</Text>
        {[['Oficio', provider.profile.category], ['Especialidades', provider.profile.specialties], ['Experiencia', provider.profile.experience], ['Provincia', provider.profile.province], ['Zonas de servicio', provider.profile.coverage], ['Disponibilidad', provider.profile.days], ['Horario', provider.profile.hours], ['Tarifa', [provider.profile.rateType, provider.profile.rate].filter(Boolean).join(' · ')], ['Métodos de pago', provider.profile.paymentMethods], ['Emergencias', provider.profile.emergency ? 'Sí' : 'No'], ['Seguro de responsabilidad civil', provider.profile.liabilityInsurance ? 'Sí' : 'No'], ['Teléfono', provider.profile.phone], ['Correo', provider.email]].filter(([, value]) => Boolean(value)).map(([label, value]) => <View key={String(label)} style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>)}
      </View>
      <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => contact(false)} style={[styles.actionButton, styles.contactButton]}><Text style={styles.actionText}>Contactar</Text></Pressable><Pressable accessibilityRole="button" onPress={() => contact(true)} style={[styles.actionButton, styles.messageButton]}><Text style={styles.actionText}>Mensaje</Text></Pressable></View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Clasificación &amp; Reseñas</Text>{loading && <ActivityIndicator color={colors.primary} size="small" />}</View>
      {reviews.length ? reviews.map((review) => <View key={review.id} style={styles.reviewRow}><View style={styles.reviewStars}><Text style={styles.stars}>{'★'.repeat(Math.max(0, Math.min(5, review.rating)))}</Text></View><View style={styles.reviewCopy}><Text style={styles.reviewer}>{review.customerName}</Text><Text style={styles.comment}>{review.comment}</Text></View></View>) : <Text style={styles.empty}>Este profesional aún no tiene reseñas.</Text>}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Galería</Text></View>
      {photos.length ? <FlatList data={photos} numColumns={3} scrollEnabled={false} keyExtractor={(uri, index) => `${uri}-${index}`} columnWrapperStyle={styles.galleryRow} contentContainerStyle={styles.gallery} renderItem={({ item }) => <Image source={{ uri: item }} style={styles.workPhoto} resizeMode="cover" />} /> : <Text style={styles.empty}>Todavía no hay fotos de trabajos publicados.</Text>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, header: { height: 61, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 }, back: { width: 52, justifyContent: 'center' }, backGlyph: { color: colors.text, fontSize: 38, lineHeight: 42 }, headerTitle: { flex: 1, color: colors.text, fontSize: 21, fontWeight: '800', textAlign: 'center' }, backSpacer: { width: 52 }, content: { paddingBottom: 30 }, hero: { height: 177, backgroundColor: colors.surface }, banner: { width: '100%', height: '100%' }, bannerFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised }, bannerText: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginTop: -35, paddingHorizontal: 18 }, avatar: { width: 103, height: 103, borderRadius: 52, backgroundColor: colors.surfaceRaised, borderWidth: 3, borderColor: colors.background }, avatarFallback: { alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.text, fontSize: 32, fontWeight: '800' }, identity: { flex: 1, paddingLeft: 13, paddingTop: 27 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, name: { color: colors.text, fontSize: 18, fontWeight: '800', flexShrink: 1 }, verified: { color: colors.success, fontSize: 21, fontWeight: '900' }, specialty: { color: colors.muted, fontSize: 13, marginTop: 3 }, metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }, stars: { color: colors.star, fontSize: 16 }, rating: { color: colors.text, fontSize: 13, fontWeight: '700' }, separator: { color: colors.muted }, reviewCount: { color: colors.muted, fontSize: 12 }, description: { color: colors.text, textAlign: 'center', fontSize: 14, lineHeight: 22, paddingHorizontal: 25, marginTop: 28 }, infoCard: { marginHorizontal: 18, marginTop: 25, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }, infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }, infoLabel: { flex: 1, color: colors.muted, fontSize: 13 }, infoValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 17, paddingHorizontal: 18, marginTop: 24 }, actionButton: { flex: 1, borderRadius: 28, minHeight: 47, justifyContent: 'center', alignItems: 'center' }, contactButton: { backgroundColor: colors.primary }, messageButton: { backgroundColor: colors.secondary }, actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, marginTop: 34, marginBottom: 15 }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' }, reviewRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, paddingVertical: 8 }, reviewStars: { width: '35%', paddingTop: 2 }, reviewCopy: { flex: 1 }, reviewer: { color: colors.text, fontSize: 13, fontWeight: '700' }, comment: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }, empty: { color: colors.subtle, fontSize: 13, paddingHorizontal: 25, paddingBottom: 4 }, gallery: { paddingHorizontal: 14, gap: 9 }, galleryRow: { gap: 9, justifyContent: 'flex-start' }, workPhoto: { width: '31.5%', aspectRatio: 1, borderRadius: 16, backgroundColor: colors.surfaceRaised }, error: { color: colors.text, textAlign: 'center', marginTop: 60 }, link: { color: colors.primary, textAlign: 'center', marginTop: 15 },
});
