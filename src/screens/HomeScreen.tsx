import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getProvidersByCategory, signOut as signOutApi, type ProviderDirectoryEntry } from '../services/auth';
import { showAlert } from '../utils/showAlert';
import colors from '../theme/colors';

type Service = { id: string; name: string; icon: number };
const services: Service[] = [
  { id: 'plumbing', name: 'Plomeros', icon: require('../../assets/services/plumbing.png') },
  { id: 'electricity', name: 'Electricistas', icon: require('../../assets/services/electricity.png') },
  { id: 'construction', name: 'Construcción', icon: require('../../assets/services/construction.png') },
  { id: 'painting', name: 'Pintura', icon: require('../../assets/services/painting.png') },
  { id: 'ac', name: 'Técnicos en aires acondicionados', icon: require('../../assets/services/air-conditioning.png') },
  { id: 'cleaning', name: 'Limpieza doméstica', icon: require('../../assets/services/cleaning.png') },
  { id: 'gardening', name: 'Jardinería', icon: require('../../assets/services/gardening.png') },
  { id: 'fumigation', name: 'Desinfección y fumigación', icon: require('../../assets/services/fumigation.png') },
  { id: 'carpentry', name: 'Carpintería', icon: require('../../assets/services/carpentry.png') },
  { id: 'appliances', name: 'Técnicos de línea blanca', icon: require('../../assets/services/appliances.png') },
  { id: 'beauty', name: 'Belleza a domicilio', icon: require('../../assets/services/beauty.png') },
];

export default function HomeScreen() {
  const { email, name, role } = useLocalSearchParams<{ email?: string; name?: string; role?: string }>();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [professionals, setProfessionals] = useState<ProviderDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const displayName = name?.trim() || email?.split('@')[0] || 'Usuario';
  const filteredServices = useMemo(() => services.filter((service) => service.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [search]);

  const refreshProfessionals = useCallback(() => {
    getProvidersByCategory().then(setProfessionals).catch(() => setProfessionals([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    refreshProfessionals();
    const timer = setInterval(refreshProfessionals, 30000);
    return () => clearInterval(timer);
  }, [refreshProfessionals]);

  const openService = (service: Service) => router.push({ pathname: '/providers', params: { category: service.name } });
  const openProfessional = (professional: ProviderDirectoryEntry) => router.push({ pathname: '/professional', params: { provider: JSON.stringify(professional) } });

  const header = <>
    <View style={styles.topHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir menú" onPress={() => setMenuVisible(true)} style={styles.iconButton}><Text style={styles.headerIcon}>☰</Text></Pressable>
      <View style={styles.brand}><View style={styles.logoMark}><Text style={styles.logoLetters}>S<Text style={styles.logoAccent}>X</Text></Text></View><Text style={styles.brandText}>SERVIXP</Text></View>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Perfil" style={styles.iconButton} onPress={() => showAlert('Mi perfil', displayName)}><Text style={styles.headerIcon}>◉</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Notificaciones" style={styles.iconButton} onPress={() => showAlert('Notificaciones', 'No tienes notificaciones nuevas.')}><Text style={styles.headerIcon}>♟</Text><View style={styles.dot} /></Pressable>
      </View>
    </View>
    <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel="Buscar servicios" placeholder="¿Qué servicio necesitas hoy?" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} returnKeyType="search" style={styles.searchInput} /></View>
    <Text style={styles.sectionTitle}>Servicios Populares</Text>
  </>;

  const footer = <>
    <View style={styles.recommendedHeader}><Text style={styles.sectionTitle}>Profesionales Recomendados</Text><Pressable onPress={() => router.push('/providers')}><Text style={styles.seeAll}>Ver todos</Text></Pressable></View>
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : professionals.length ? <FlatList
      horizontal data={professionals} keyExtractor={(item) => item.id ?? item.email} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.proList}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => openProfessional(item)} style={({ pressed }) => [styles.professionalCard, pressed && styles.pressed]}>
        {item.profile.profilePhoto ? <Image source={{ uri: item.profile.profilePhoto }} style={styles.avatar} resizeMode="cover" /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{item.name.slice(0, 1).toLocaleUpperCase()}</Text></View>}
        <View style={styles.ratingRow}><Text style={styles.stars}>{'★'.repeat(Math.round(item.rating ?? 0))}{'☆'.repeat(5 - Math.round(item.rating ?? 0))}</Text><Text style={styles.ratingText}>{(item.rating ?? 0).toFixed(1)}</Text></View>
        <Text style={styles.professionalName} numberOfLines={1}>{item.name}</Text><Text style={styles.professionalTrade} numberOfLines={1}>({item.profile.category})</Text>
      </Pressable>}
    /> : <Text style={styles.emptyText}>Aún no hay profesionales registrados.</Text>}
    <Text style={styles.bottomNote}>SERVIXP · Profesionales para cada necesidad</Text>
  </>;

  return <SafeAreaView style={styles.safeArea} edges={['top']}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    <FlatList
      key="services-grid" data={filteredServices} numColumns={3} keyExtractor={(item) => item.id} ListHeaderComponent={header} ListFooterComponent={footer}
      contentContainerStyle={styles.content} columnWrapperStyle={styles.serviceRow} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => openService(item)} style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}>
        <Image source={item.icon} style={styles.serviceIcon} resizeMode="contain" tintColor={colors.primary} /><Text style={styles.serviceName} numberOfLines={2}>{item.name}</Text>
      </Pressable>}
      ListEmptyComponent={<Text style={styles.emptyText}>No encontramos ese servicio.</Text>}
    />
    <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
      <View style={styles.modalRoot}><Pressable style={styles.scrim} onPress={() => setMenuVisible(false)} /><View style={styles.drawer}>
        <Text style={styles.drawerName}>{displayName}</Text>{!!email && <Text style={styles.drawerEmail}>{email}</Text>}
        <Pressable style={styles.drawerItem} onPress={() => { setMenuVisible(false); showAlert('Mi perfil', displayName); }}><Text style={styles.drawerText}>Mi perfil</Text></Pressable>
        {role === 'provider' && <Pressable style={styles.drawerItem} onPress={() => { setMenuVisible(false); router.push('/profile-edit'); }}><Text style={styles.drawerText}>Editar perfil profesional</Text></Pressable>}
        <Pressable style={styles.drawerItem} onPress={() => { setMenuVisible(false); void signOutApi().finally(() => router.replace('/')); }}><Text style={styles.drawerText}>Cerrar sesión</Text></Pressable>
        {role === 'provider' && <Text style={styles.drawerHint}>Tu perfil profesional aparece en los resultados de tu oficio.</Text>}
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: 15, paddingBottom: 30 },
  topHeader: { height: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { color: colors.text, fontSize: 25, fontWeight: '700' }, headerActions: { flexDirection: 'row', gap: 7 }, dot: { position: 'absolute', right: 7, top: 9, width: 7, height: 7, borderRadius: 5, backgroundColor: colors.primary },
  brand: { alignItems: 'center', justifyContent: 'center' }, logoMark: { width: 54, height: 44, alignItems: 'center', justifyContent: 'center' }, logoLetters: { color: colors.secondary, fontSize: 35, fontWeight: '900', fontStyle: 'italic' }, logoAccent: { color: colors.primary }, brandText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: -4 },
  searchBox: { height: 52, borderRadius: 18, backgroundColor: colors.surfaceRaised, marginHorizontal: 8, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 31, borderWidth: 1, borderColor: colors.border }, searchIcon: { color: colors.primary, fontSize: 29, marginRight: 10 }, searchInput: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800', textAlign: 'center', marginBottom: 22 }, serviceRow: { justifyContent: 'center', gap: 6, marginBottom: 7 }, serviceCard: { width: '32%', minHeight: 98, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 9, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border }, serviceIcon: { width: 41, height: 41, marginBottom: 5 }, serviceName: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }, pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  recommendedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 27, marginBottom: 1 }, seeAll: { color: colors.primary, fontSize: 12, fontWeight: '700' }, proList: { gap: 12, paddingHorizontal: 2, paddingBottom: 8 }, professionalCard: { width: 145, minHeight: 175, backgroundColor: colors.surface, borderRadius: 27, alignItems: 'center', padding: 10, borderWidth: 1, borderColor: colors.border }, avatar: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.surfaceRaised }, avatarFallback: { alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.text, fontSize: 26, fontWeight: '800' }, ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 }, stars: { color: colors.star, fontSize: 15, letterSpacing: -1 }, ratingText: { color: colors.text, fontSize: 10, fontWeight: '700' }, professionalName: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 7 }, professionalTrade: { color: colors.muted, fontSize: 11, marginTop: 2 }, loader: { marginVertical: 20 }, emptyText: { color: colors.muted, textAlign: 'center', marginVertical: 18, fontSize: 13 }, bottomNote: { color: colors.subtle, fontSize: 10, textAlign: 'center', marginTop: 18 },
  modalRoot: { flex: 1, flexDirection: 'row' }, scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.65)' }, drawer: { width: '78%', maxWidth: 330, backgroundColor: colors.surface, padding: 22, paddingTop: 68 }, drawerName: { color: colors.text, fontSize: 21, fontWeight: '800' }, drawerEmail: { color: colors.muted, marginTop: 5, marginBottom: 25 }, drawerItem: { paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.border }, drawerText: { color: colors.text, fontSize: 15, fontWeight: '600' }, drawerHint: { color: colors.muted, marginTop: 24, lineHeight: 20 },
});
