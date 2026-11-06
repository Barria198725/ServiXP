import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ApiError, createAccount, signOut, uploadCustomerProfilePhoto, uploadProviderFiles, type ProviderProfile, type UserRole } from '../services/auth';
import { showAlert } from '../utils/showAlert';
import { clearProviderDraft, loadProviderDraft, saveProviderDraft } from '../services/providerDraft';

const categories = ['Electricistas', 'Plomero', 'Construcción', 'Pintura', 'Técnicos en aires acondicionados', 'Limpieza doméstica', 'Jardinería', 'Desinfección y fumigación', 'Carpintería', 'Técnicos de línea blanca', 'Belleza a domicilio'];
const specialtiesByCategory: Record<string, string[]> = {
  Electricistas: ['Instalaciones eléctricas', 'Reparación de cortocircuitos', 'Iluminación', 'Paneles eléctricos', 'Emergencias eléctricas'],
  Plomero: ['Fugas de agua', 'Instalación de grifería', 'Destape de cañerías', 'Instalación de tuberías'],
  Construcción: ['Remodelaciones', 'Albañilería', 'Instalación de pisos', 'Techos'],
  Pintura: ['Pintura interior', 'Pintura exterior', 'Acabados', 'Impermeabilización'],
  'Técnicos en aires acondicionados': ['Instalación', 'Mantenimiento', 'Reparación', 'Carga de refrigerante'],
  'Limpieza doméstica': ['Limpieza profunda', 'Limpieza regular', 'Limpieza post construcción'],
  Jardinería: ['Mantenimiento de jardines', 'Poda', 'Diseño de jardines'],
  'Desinfección y fumigación': ['Control de plagas', 'Desinfección residencial', 'Fumigación comercial'],
  Carpintería: ['Muebles a medida', 'Reparación', 'Instalación de puertas'],
  'Técnicos de línea blanca': ['Refrigeradoras', 'Lavadoras', 'Estufas', 'Secadoras'],
  'Belleza a domicilio': ['Corte y peinado', 'Maquillaje', 'Manicure y pedicure'],
};
const provinces = ['Bocas del Toro', 'Coclé', 'Colón', 'Chiriquí', 'Darién', 'Herrera', 'Los Santos', 'Panamá', 'Panamá Oeste', 'Veraguas'];
const paymentOptions = ['Efectivo', 'Tarjeta', 'Transferencia bancaria', 'Pago por la app', 'Yappy'];
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const timeOptions = ['6:00 a. m.', '7:00 a. m.', '8:00 a. m.', '9:00 a. m.', '10:00 a. m.', '12:00 p. m.', '2:00 p. m.', '4:00 p. m.', '6:00 p. m.', '8:00 p. m.', '10:00 p. m.'];
const rateOptions = ['Precio fijo por servicio', 'Tarifa por hora', 'A cotizar / Bajo inspección previa'];
const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const steps = ['Datos básicos', 'Servicio', 'Disponibilidad', 'Tarifas y fotos'];
type Selector = 'province' | 'category' | 'day' | 'month' | 'year' | 'startHour' | 'endHour' | null;

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const role: UserRole = params.role === 'provider' ? 'provider' : 'customer';
  const isProvider = role === 'provider';
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [category, setCategory] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [province, setProvince] = useState('');
  const [coverage, setCoverage] = useState('');
  const [hours, setHours] = useState('');
  const [startHour, setStartHour] = useState('');
  const [endHour, setEndHour] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [emergency, setEmergency] = useState(false);
  const [liabilityInsurance, setLiabilityInsurance] = useState(false);
  const [experience, setExperience] = useState('');
  const [identityDocument, setIdentityDocument] = useState('');
  const [identityDocumentName, setIdentityDocumentName] = useState('');
  const [certificate, setCertificate] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [portfolioPhotos, setPortfolioPhotos] = useState<string[]>([]);
  const [rateType, setRateType] = useState(rateOptions[2]);
  const [rate, setRate] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [openSelector, setOpenSelector] = useState<Selector>(null);
  const [loading, setLoading] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [restoringDraft, setRestoringDraft] = useState(false);
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 101 }, (_, index) => String(currentYear - index)), [currentYear]);
  const validDays = useMemo(() => {
    const max = birthMonth && birthYear ? new Date(Number(birthYear), Number(birthMonth), 0).getDate() : 31;
    return Array.from({ length: max }, (_, index) => String(index + 1));
  }, [birthMonth, birthYear]);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    if (!isProvider) return;
    let active = true;
    void loadProviderDraft().then((draft) => { if (active) setDraftAvailable(Boolean(draft)); }).catch(() => {});
    return () => { active = false; };
  }, [isProvider]);

  const draftPayload = () => ({ name, identifier, phone, category, specialties: selectedSpecialties.join(', '), selectedSpecialties, description, province, coverage, days: selectedDays.join(', '), selectedDays, hours: startHour && endHour ? `${startHour} - ${endHour}` : hours, startHour, endHour, emergency, liabilityInsurance, experience, certificate, certificateName, profilePhoto, portfolioPhotos, rateType, rate, paymentMethods, step });

  const saveDraft = async () => {
    try {
      await saveProviderDraft(draftPayload());
      showAlert('Borrador guardado', 'Tus datos se guardaron en este dispositivo. Por seguridad, vuelve a ingresar tu contraseña al retomar el registro.');
      router.replace('/');
    } catch {
      showAlert('No se pudo guardar', 'Revisa el espacio disponible e inténtalo nuevamente.');
    }
  };

  const restoreDraft = async () => {
    setRestoringDraft(true);
    try {
      const draft = await loadProviderDraft();
      if (!draft) return;
      const value = (key: string) => typeof draft[key] === 'string' ? draft[key] as string : '';
      setName(value('name')); setIdentifier(value('identifier')); setPhone(value('phone'));
      setCategory(value('category')); setDescription(value('description')); setProvince(value('province')); setCoverage(value('coverage'));
      setSelectedSpecialties(Array.isArray(draft.selectedSpecialties) ? draft.selectedSpecialties as string[] : []);
      setSelectedDays(Array.isArray(draft.selectedDays) ? draft.selectedDays as string[] : []);
      setStartHour(value('startHour')); setEndHour(value('endHour')); setHours(value('hours'));
      setEmergency(draft.emergency === true); setLiabilityInsurance(draft.liabilityInsurance === true);
      setExperience(value('experience')); setCertificate(value('certificate')); setCertificateName(value('certificateName'));
      setProfilePhoto(value('profilePhoto')); setPortfolioPhotos(Array.isArray(draft.portfolioPhotos) ? (draft.portfolioPhotos as string[]).slice(0, 5) : []);
      setRateType(value('rateType') || rateOptions[2]); setRate(value('rate'));
      setPaymentMethods(Array.isArray(draft.paymentMethods) ? draft.paymentMethods as string[] : []);
      // Passwords are intentionally excluded from local drafts, so resume at the
      // credential step where the professional can enter them again.
      setStep(0);
      setDraftAvailable(false);
      showAlert('Borrador recuperado', 'Por seguridad, crea y confirma tu contraseña antes de continuar.');
    } catch {
      showAlert('No se pudo abrir el borrador', 'Inténtalo nuevamente.');
    } finally { setRestoringDraft(false); }
  };

  const validateStep = () => {
    if (!isProvider || step === 0) {
    if (!name.trim() || !identifier.trim()) {
      showAlert('Completa tus datos', 'Escribe tu nombre y correo o nickname.');
      return false;
    }
    const normalizedIdentifier = identifier.trim();
    if (normalizedIdentifier.includes('@') ? !/^\S+@\S+\.\S+$/.test(normalizedIdentifier) : !/^[a-zA-Z0-9._-]{3,32}$/.test(normalizedIdentifier)) {
      showAlert('Identificador no válido', 'Escribe un correo válido o un nickname de 3 a 32 caracteres.');
      return false;
    }
    if (password.length < 8) {
      showAlert('Contraseña muy corta', 'Usa al menos 8 caracteres.');
      return false;
    }
    if (password !== confirmPassword) {
      showAlert('Las contraseñas no coinciden', 'Confirma la misma contraseña para continuar.');
      return false;
    }
    if (isProvider && !phone.trim()) {
      showAlert('Falta tu teléfono', 'Los clientes necesitarán una forma de contactarte.');
      return false;
    }
    if (!isProvider && !(birthDay && birthMonth && birthYear)) {
      showAlert('Completa tu fecha de nacimiento', 'Selecciona día, mes y año.');
      return false;
    }
    if (!isProvider) {
      const date = new Date(`${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}T00:00:00`);
      if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(birthYear) || date.getMonth() + 1 !== Number(birthMonth) || date.getDate() !== Number(birthDay) || date > new Date()) {
        showAlert('Fecha de nacimiento no válida', 'Revisa el día, mes y año seleccionados.');
        return false;
      }
    }
    }
    if (isProvider && step === 1 && (!category || !selectedSpecialties.length || !description.trim())) {
      showAlert('Completa tu servicio', 'Selecciona un oficio, al menos una especialidad y escribe una breve descripción.');
      return false;
    }
    if (isProvider && step === 2 && (!province || !coverage.trim() || !selectedDays.length || !startHour || !endHour)) {
      showAlert('Completa tu disponibilidad', 'Selecciona tu provincia e indica la zona, los días y el horario.');
      return false;
    }
    if (isProvider && step === 2 && timeOptions.indexOf(startHour) >= timeOptions.indexOf(endHour)) {
      showAlert('Horario no válido', 'La hora de cierre debe ser posterior a la hora de inicio.');
      return false;
    }
    if (isProvider && step === 3 && (!paymentMethods.length || portfolioPhotos.length < 3)) {
      showAlert('Completa tu portafolio', 'Agrega al menos 3 fotos y selecciona uno o más métodos de pago.');
      return false;
    }
    return true;
  };

  const pickImage = async (target: 'profile' | 'portfolio', source: 'library' | 'camera' = 'library') => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { showAlert('Permiso requerido', 'Permite el acceso a la cámara para tomar una foto.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75, allowsEditing: target === 'profile' });
      if (!result.canceled) {
        const uri = result.assets[0]?.uri ?? '';
        if (target === 'profile') setProfilePhoto(uri);
        else setPortfolioPhotos((current) => [...current, uri].slice(0, 5));
      }
      return;
    }
    const remaining = Math.max(1, 5 - portfolioPhotos.length);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: target === 'portfolio',
      selectionLimit: target === 'portfolio' ? remaining : 1, quality: 0.75,
    });
    if (result.canceled) return;
    const uris = result.assets.map((asset) => asset.uri);
    if (target === 'profile') setProfilePhoto(uris[0] ?? '');
    else setPortfolioPhotos((current) => [...current, ...uris].slice(0, 5));
  };

  const pickDocument = async (target: 'identity' | 'certificate') => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const document = result.assets[0];
    if (target === 'identity') { setIdentityDocument(document.uri); setIdentityDocumentName(document.name); }
    else { setCertificate(document.uri); setCertificateName(document.name); }
  };

  const startRegistration = async () => {
    if (!validateStep()) return;
    const profile: ProviderProfile | undefined = isProvider
      ? { phone, category, specialties: selectedSpecialties.join(', '), description, province, coverage, days: selectedDays.join(', '), hours: `${startHour} - ${endHour}`, emergency, experience, identityDocument, certificate, profilePhoto, portfolioPhotos, rateType, rate, paymentMethods: paymentMethods.join(', '), liabilityInsurance }
      : undefined;
    const customer = !isProvider ? { birthDate: `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`, phone: phone.trim() } : undefined;
    setLoading(true);
    try {
      const user = await createAccount(name, identifier, password, role, profile, customer);
      let photoFailed = false;
      try {
        if (isProvider && profile) await uploadProviderFiles(profile);
        if (!isProvider && profilePhoto) await uploadCustomerProfilePhoto(profilePhoto);
      } catch { photoFailed = true; }
      await signOut().catch(() => {});
      if (isProvider) await clearProviderDraft().catch(() => {});
      router.replace({ pathname: '/', params: { registered: 'true', identifier: user.username || user.email, photoWarning: photoFailed ? 'true' : undefined } });
    } catch (error) {
      showAlert('No pudimos crear tu cuenta', error instanceof ApiError ? error.message : 'Inténtalo de nuevo.');
    } finally { setLoading(false); }
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (isProvider && step < steps.length - 1) {
      void saveProviderDraft(draftPayload()).catch(() => {});
      setStep((current) => current + 1);
    }
    else void startRegistration();
  };

  const input = (label: string, value: string, onChangeText: (value: string) => void, options: { multiline?: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric'; maxLength?: number; placeholder?: string; secure?: boolean; autoCapitalize?: 'none' | 'sentences' } = {}) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} autoCapitalize={options.autoCapitalize ?? (options.keyboardType === 'email-address' ? 'none' : 'sentences')} keyboardType={options.keyboardType ?? 'default'} maxLength={options.maxLength} multiline={options.multiline} secureTextEntry={options.secure} placeholder={options.placeholder ?? label} placeholderTextColor="#8290A0" style={[styles.input, options.multiline && styles.multilineInput]} value={value} onChangeText={onChangeText} />
    </View>
  );

  const fileButton = (label: string, filename: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.fileButton}><Text style={styles.fileButtonText}>{filename || `＋  ${label}`}</Text></Pressable>
  );
  const chooseProfilePhoto = () => { if (Platform.OS === 'web') { void pickImage('profile'); return; } Alert.alert('Foto profesional', 'Elige cómo agregar tu foto.', [
    { text: 'Tomar fotografía', onPress: () => void pickImage('profile', 'camera') },
    { text: 'Elegir de la galería', onPress: () => void pickImage('profile') },
    { text: 'Cancelar', style: 'cancel' },
  ]); };
  const dateButton = (label: string, value: string, selector: Exclude<Selector, 'province' | 'payment' | null>) => (
    <Pressable accessibilityRole="button" onPress={() => setOpenSelector(selector)} style={styles.dateButton}><Text style={value ? styles.selectText : styles.selectPlaceholder}>{value || label}</Text><Text style={styles.selectArrow}>⌄</Text></Pressable>
  );

  const options = openSelector === 'province' ? provinces
    : openSelector === 'category' ? categories
      : openSelector === 'day' ? validDays
        : openSelector === 'month' ? months.map((month, index) => `${String(index + 1).padStart(2, '0')} · ${month}`)
          : openSelector === 'year' ? years
            : openSelector === 'startHour' || openSelector === 'endHour' ? timeOptions : [];
  const selectorTitle = openSelector === 'province' ? 'Selecciona tu provincia'
    : openSelector === 'category' ? 'Selecciona tu oficio'
      : openSelector === 'day' ? 'Día de nacimiento'
        : openSelector === 'month' ? 'Mes de nacimiento'
          : openSelector === 'startHour' ? 'Hora de inicio'
            : openSelector === 'endHour' ? 'Hora de cierre' : 'Año de nacimiento';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}><Text style={styles.brandName}>Servi<Text style={styles.brandAccent}>XP</Text></Text><Text style={styles.brandTagline}>{isProvider ? 'Únete como profesional' : 'Crea tu cuenta en segundos'}</Text></View>
          <View style={styles.form}>
            {isProvider && <><Text style={styles.stepCount}>PASO {step + 1} DE {steps.length}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]} /></View></>}
            {isProvider && draftAvailable && <Pressable accessibilityRole="button" disabled={restoringDraft} onPress={() => void restoreDraft()} style={styles.restoreDraft}><Text style={styles.restoreDraftText}>{restoringDraft ? 'Abriendo borrador…' : 'Continuar borrador guardado'}</Text></Pressable>}
            <Text style={styles.heading}>{isProvider ? steps[step] : 'Crear cuenta de usuario'}</Text>
            <Text style={styles.description}>{isProvider ? 'Completa tu perfil para que los clientes conozcan tu trabajo.' : 'Regístrate para encontrar profesionales para tu hogar.'}</Text>

            {step === 0 && <>
              {input('Nombre completo', name, setName, { placeholder: 'Nombre y apellidos' })}
              {input('Correo electrónico o nickname', identifier, setIdentifier, { autoCapitalize: 'none', placeholder: 'correo@ejemplo.com o nickname' })}
              {isProvider && <>
                {input('Contraseña', password, setPassword, { secure: true, autoCapitalize: 'none', placeholder: 'Mínimo 8 caracteres' })}
                {input('Confirmar contraseña', confirmPassword, setConfirmPassword, { secure: true, autoCapitalize: 'none', placeholder: 'Escribe nuevamente tu contraseña' })}
                {confirmPassword.length > 0 && <Text style={[styles.passwordFeedback, passwordsMatch ? styles.match : styles.noMatch]}>{passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}</Text>}
                {input('Número de teléfono', phone, setPhone, { keyboardType: 'phone-pad', placeholder: 'Para contactarte por llamada o WhatsApp' })}
              </>}
              {!isProvider && <>
                <Text style={styles.fieldLabel}>Fecha de nacimiento</Text>
                <View style={styles.dateRow}>{dateButton('Día', birthDay, 'day')}{dateButton('Mes', birthMonth ? months[Number(birthMonth) - 1] : '', 'month')}{dateButton('Año', birthYear, 'year')}</View>
                {input('Número de teléfono (opcional)', phone, setPhone, { keyboardType: 'phone-pad', placeholder: 'Tu número de teléfono' })}
              </>}
              {!isProvider && <>
                {input('Contraseña', password, setPassword, { secure: true, autoCapitalize: 'none', placeholder: 'Mínimo 8 caracteres' })}
                {input('Confirmar contraseña', confirmPassword, setConfirmPassword, { secure: true, autoCapitalize: 'none', placeholder: 'Escribe nuevamente tu contraseña' })}
                {confirmPassword.length > 0 && <Text style={[styles.passwordFeedback, passwordsMatch ? styles.match : styles.noMatch]}>{passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}</Text>}
              </>}
              <Text style={styles.fieldLabel}>{isProvider ? 'Foto profesional (opcional)' : 'Foto de perfil (opcional)'}</Text>
              <View style={styles.photoRow}>{profilePhoto ? <Image source={{ uri: profilePhoto }} style={styles.profilePhoto} resizeMode="cover" /> : null}{fileButton('Elegir foto de perfil', profilePhoto ? 'Cambiar foto' : '', chooseProfilePhoto)}</View>
            </>}

            {isProvider && step === 1 && <>
              <Text style={styles.fieldLabel}>Oficio o categoría principal</Text>
              <Pressable accessibilityRole="button" onPress={() => setOpenSelector('category')} style={styles.selectInput}><Text style={category ? styles.selectText : styles.selectPlaceholder}>{category || 'Selecciona tu oficio'}</Text><Text style={styles.selectArrow}>⌄</Text></Pressable>
              {category ? <><Text style={styles.fieldLabel}>Especialidades</Text><View style={styles.categoryGrid}>{(specialtiesByCategory[category] ?? []).map((item) => {
                const selected = selectedSpecialties.includes(item);
                return <Pressable key={item} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => {
                  const next = selected ? selectedSpecialties.filter((value) => value !== item) : [...selectedSpecialties, item];
                  setSelectedSpecialties(next);
                }} style={[styles.categoryChip, selected && styles.categoryChipSelected]}><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{selected ? '✓ ' : '□ '}{item}</Text></Pressable>;
              })}</View></> : null}
              {input('Descripción de tu perfil', description, setDescription, { multiline: true, maxLength: 250, placeholder: 'Técnico electricista certificado con más de 8 años de experiencia en instalaciones residenciales y comerciales…' })}
              <Text style={styles.counter}>{description.length}/250 caracteres</Text>
            </>}

            {isProvider && step === 2 && <>
              <Text style={styles.fieldLabel}>Provincia</Text>
              <Pressable accessibilityRole="button" onPress={() => setOpenSelector('province')} style={styles.selectInput}><Text style={province ? styles.selectText : styles.selectPlaceholder}>{province || 'Selecciona tu provincia'}</Text><Text style={styles.selectArrow}>⌄</Text></Pressable>
              {input('Lugar o zona específica', coverage, setCoverage, { placeholder: 'Corregimiento, distrito o lugar' })}
              <Text style={styles.fieldLabel}>Días disponibles</Text><View style={styles.categoryGrid}>{weekdays.map((day) => {
                const selected = selectedDays.includes(day);
                return <Pressable key={day} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setSelectedDays((current) => selected ? current.filter((item) => item !== day) : [...current, day])} style={[styles.categoryChip, selected && styles.categoryChipSelected]}><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{selected ? '✓ ' : ''}{day}</Text></Pressable>;
              })}</View>
              <Text style={styles.fieldLabel}>Horario de atención</Text><View style={styles.dateRow}>
                <Pressable accessibilityRole="button" onPress={() => setOpenSelector('startHour')} style={styles.dateButton}><Text style={startHour ? styles.selectText : styles.selectPlaceholder}>{startHour || 'Desde'}</Text><Text style={styles.selectArrow}>⌄</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => setOpenSelector('endHour')} style={styles.dateButton}><Text style={endHour ? styles.selectText : styles.selectPlaceholder}>{endHour || 'Hasta'}</Text><Text style={styles.selectArrow}>⌄</Text></Pressable>
              </View>
              <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.fieldLabel}>Atención de emergencia</Text><Text style={styles.helper}>Indica si aceptas trabajos urgentes fuera de horario.</Text></View><Switch value={emergency} onValueChange={setEmergency} trackColor={{ false: '#CBD5E1', true: '#6EE7B7' }} thumbColor={emergency ? '#047857' : '#F8FAFC'} /></View>
              <Text style={styles.fieldLabel}>Documento de identidad (opcional)</Text><Text style={styles.helper}>Se solicita para validación interna del perfil.</Text>
              {fileButton('Adjuntar cédula o pasaporte', identityDocumentName, () => void pickDocument('identity'))}
              <Text style={styles.fieldLabel}>Certificados o títulos (opcional)</Text>{fileButton('Adjuntar certificado en PDF o imagen', certificateName, () => void pickDocument('certificate'))}
              <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.fieldLabel}>Seguro de responsabilidad civil</Text><Text style={styles.helper}>Indica si cuentas con cobertura para daños.</Text></View><Switch value={liabilityInsurance} onValueChange={setLiabilityInsurance} trackColor={{ false: '#CBD5E1', true: '#6EE7B7' }} thumbColor={liabilityInsurance ? '#047857' : '#F8FAFC'} /></View>
            </>}

            {isProvider && step === 3 && <>
              {input('Años de experiencia', experience, setExperience, { keyboardType: 'numeric', placeholder: 'Ej. 5' })}
              <Text style={styles.fieldLabel}>Galería de trabajos (3 a 5 fotos)</Text><Text style={styles.helper}>Incluye fotografías representativas de tus proyectos, por ejemplo el antes y después.</Text>
              {fileButton(`Añadir fotos (${portfolioPhotos.length}/5)`, '', () => void pickImage('portfolio'))}
              <View style={styles.portfolioGrid}>{portfolioPhotos.map((uri) => <Image key={uri} source={{ uri }} style={styles.portfolioImage} resizeMode="cover" />)}</View>
              <Text style={styles.fieldLabel}>Tipo de tarifa</Text>
              <View style={styles.categoryGrid}>{rateOptions.map((item) => <Pressable key={item} onPress={() => setRateType(item)} style={[styles.categoryChip, rateType === item && styles.categoryChipSelected]}><Text style={[styles.categoryText, rateType === item && styles.categoryTextSelected]}>{item}</Text></Pressable>)}</View>
              {rateType !== rateOptions[2] && input('Precio estimado (opcional)', rate, setRate, { keyboardType: 'numeric', placeholder: 'Monto en balboas' })}
              <Text style={styles.fieldLabel}>Métodos de pago aceptados</Text><View style={styles.categoryGrid}>{paymentOptions.map((method) => {
                const selected = paymentMethods.includes(method);
                return <Pressable key={method} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setPaymentMethods((current) => selected ? current.filter((item) => item !== method) : [...current, method])} style={[styles.categoryChip, selected && styles.categoryChipSelected]}><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{selected ? '✓ ' : '□ '}{method}</Text></Pressable>;
              })}</View>
              <Text style={styles.helper}>Tu perfil y archivos se guardarán en el servidor de ServiXP.</Text>
            </>}

            {isProvider && <Pressable accessibilityRole="button" disabled={loading} onPress={() => void saveDraft()} style={styles.draftButton}><Text style={styles.draftButtonText}>Guardar borrador y salir</Text></Pressable>}
            <Pressable accessibilityRole="button" disabled={loading} onPress={goNext} style={({ pressed }) => [styles.submit, pressed && styles.pressed, loading && styles.disabled]}>{loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{isProvider && step < steps.length - 1 ? 'Continuar' : 'Crear cuenta'}</Text>}</Pressable>
            {isProvider && step > 0 && <Pressable onPress={() => setStep((current) => current - 1)} style={styles.backButton}><Text style={styles.backText}>Volver al paso anterior</Text></Pressable>}
            <View style={styles.loginRow}><Text style={styles.loginPrompt}>¿Ya tienes cuenta? </Text><Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={styles.loginLink}>Inicia sesión</Text></Pressable></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={openSelector !== null} transparent animationType="fade" onRequestClose={() => setOpenSelector(null)}>
        <View style={styles.modalRoot}><Pressable accessibilityLabel="Cerrar selector" style={styles.modalBackdrop} onPress={() => setOpenSelector(null)} /><View style={styles.optionsCard}>
          <Text style={styles.optionsTitle}>{selectorTitle}</Text>
          <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">{options.map((option, index) => <Pressable key={option} accessibilityRole="button" onPress={() => {
            if (openSelector === 'province') setProvince(option);
            if (openSelector === 'category') { setCategory(option); setSelectedSpecialties([]); }
            if (openSelector === 'day') setBirthDay(option);
            if (openSelector === 'month') { setBirthMonth(String(index + 1)); if (Number(birthDay) > new Date(Number(birthYear || currentYear), index + 1, 0).getDate()) setBirthDay(''); }
            if (openSelector === 'year') { setBirthYear(option); if (Number(birthDay) > new Date(Number(option), Number(birthMonth || 1), 0).getDate()) setBirthDay(''); }
            if (openSelector === 'startHour') setStartHour(option);
            if (openSelector === 'endHour') setEndHour(option);
            setOpenSelector(null);
          }} style={styles.optionRow}><Text style={styles.optionText}>{option}</Text></Pressable>)}</ScrollView>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: '#F8FAFC' }, content: { flexGrow: 1, alignItems: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 24 }, brandName: { color: '#17232B', fontSize: 32, fontWeight: '900', letterSpacing: 2 }, brandAccent: { color: '#2563EB' }, brandTagline: { color: '#526067', fontSize: 15, marginTop: 5 },
  form: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#E6EBF0' }, stepCount: { color: '#047857', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 9 }, progressTrack: { height: 5, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 19 }, progressFill: { height: '100%', backgroundColor: '#047857', borderRadius: 4 },
  heading: { color: '#1F2937', fontSize: 23, fontWeight: '800' }, description: { color: '#526067', fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: 20 }, field: { marginBottom: 13 }, fieldLabel: { color: '#334155', fontSize: 14, fontWeight: '700', marginBottom: 7 }, input: { minHeight: 50, borderRadius: 13, backgroundColor: '#F1F5F9', paddingHorizontal: 15, paddingVertical: 12, color: '#1F2937', fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0' }, multilineInput: { minHeight: 110, textAlignVertical: 'top' }, counter: { color: '#64748B', fontSize: 12, textAlign: 'right', marginTop: -6, marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 16 }, categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 9 }, categoryChipSelected: { borderColor: '#047857', backgroundColor: '#ECFDF5' }, categoryText: { color: '#475569', fontSize: 13, fontWeight: '600' }, categoryTextSelected: { color: '#047857' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 }, switchCopy: { flex: 1, paddingRight: 12 }, helper: { color: '#64748B', fontSize: 13, lineHeight: 18, marginBottom: 10 }, fileButton: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#94A3B8', borderRadius: 13, backgroundColor: '#F8FAFC', marginTop: 8, marginBottom: 16 }, fileButtonText: { color: '#1D4ED8', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  selectInput: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, backgroundColor: '#F1F5F9', paddingHorizontal: 15, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }, selectText: { color: '#1F2937', fontSize: 15 }, selectPlaceholder: { color: '#8290A0', fontSize: 15 }, selectArrow: { color: '#475569', fontSize: 20 }, dateRow: { flexDirection: 'row', gap: 8, marginBottom: 13 }, dateButton: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, backgroundColor: '#F1F5F9', paddingHorizontal: 11, borderWidth: 1, borderColor: '#E2E8F0' }, passwordFeedback: { fontSize: 12, fontWeight: '700', marginTop: -6, marginBottom: 14 }, match: { color: '#047857' }, noMatch: { color: '#D14343' },
  modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 23, 42, 0.4)' }, optionsCard: { width: '100%', maxWidth: 400, maxHeight: '75%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18 }, optionsTitle: { color: '#1F2937', fontSize: 18, fontWeight: '800', marginBottom: 10 }, optionsList: { flexGrow: 0 }, optionRow: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }, optionText: { color: '#334155', fontSize: 15 }, photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }, profilePhoto: { width: 54, height: 54, borderRadius: 27 }, portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }, portfolioImage: { width: 74, height: 74, borderRadius: 12 },
  submit: { height: 54, borderRadius: 28, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginTop: 8 }, submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, pressed: { opacity: 0.85 }, disabled: { opacity: 0.7 }, backButton: { paddingVertical: 12, alignItems: 'center' }, backText: { color: '#047857', fontSize: 14, fontWeight: '700' }, loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 }, loginPrompt: { color: '#526067', fontSize: 14 }, loginLink: { color: '#047857', fontSize: 14, fontWeight: '800' },
  draftButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46, marginTop: 10 }, draftButtonText: { color: '#047857', fontWeight: '700', fontSize: 14 }, restoreDraft: { alignItems: 'center', paddingVertical: 12, marginBottom: 14, backgroundColor: '#ECFDF5', borderRadius: 12 }, restoreDraftText: { color: '#047857', fontWeight: '800', fontSize: 14 },
});
