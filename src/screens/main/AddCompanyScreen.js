/**
 * Add Company Screen
 * Screen for creating a new company — UI matched to Expo AddCompanyScreen
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText, AppButton } from '../../components';
import { companiesAPI } from '../../api';
import { showError, showSuccess } from '../../utils';

// Form field with focus state — matching Expo AddCompanyScreen
function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  required,
  keyboardType,
  multiline,
  disabled,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[fStyles.container, focused && fStyles.focused]}>
      <View style={fStyles.labelRow}>
        <IonIcon
          name={icon}
          size={15}
          color={focused ? Colors.primary : Colors.textTertiary}
        />
        <Text style={[fStyles.label, focused && { color: Colors.primary }]}>
          {label}
          {required ? ' *' : ''}
        </Text>
      </View>
      <TextInput
        style={[
          fStyles.input,
          multiline && { minHeight: 60, textAlignVertical: 'top' },
          disabled && fStyles.inputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

// Half-width field — matching Expo
function HalfField({ label, value, onChangeText, placeholder, icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[fStyles.halfContainer, focused && fStyles.focused]}>
      <View style={fStyles.labelRow}>
        <IonIcon
          name={icon}
          size={14}
          color={focused ? Colors.primary : Colors.textTertiary}
        />
        <Text style={[fStyles.label, focused && { color: Colors.primary }]}>
          {label}
        </Text>
      </View>
      <TextInput
        style={fStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

const AddCompanyScreen = ({ navigation, route }) => {
  // Animation ref
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    salesperson: '',
    city: '',
    state: '',
    country: '',
    website: '',
    industry: '',
    gstin: '',
    email: '',
    phone: '',
    address: '',
    pincode: '',
  });

  const [loading, setLoading] = useState(false);

  // Fade in animation on mount
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showError('Validation Error', 'Company name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await companiesAPI.create(formData);

      if (response.success) {
        showSuccess('Success', 'Company created successfully');
        // Get created company from response (handle different API shapes)
        const createdCompany =
          response.data?.data ||
          response.data?.company ||
          response.data ||
          null;
        // If caller provided a callback, notify with new company so list can update locally
        try {
          route?.params?.onCreate && route.params.onCreate(createdCompany);
        } catch (e) {
          // ignore non-serializable param errors
        }
        navigation.goBack();
      } else {
        showError('Error', response.error || 'Failed to create company');
      }
    } catch (error) {
      console.error('Error creating company:', error);
      showError('Error', 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — matching Expo */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <IonIcon name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Company</Text>
        <View style={{ width: ms(40) }} />
      </View>

      {/* Form Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Basic Information */}
            <View style={styles.sectionHeader}>
              <IonIcon
                name="information-circle"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>Basic Information</Text>
            </View>
            <View style={styles.sectionCard}>
              <FormField
                icon="grid-outline"
                label="Company Name"
                value={formData.name}
                onChangeText={v => handleInputChange('name', v)}
                placeholder="Enter company name"
                required
              />
              <View style={styles.divider} />
              <FormField
                icon="person-outline"
                label="Owner Name"
                value={formData.ownerName}
                onChangeText={v => handleInputChange('ownerName', v)}
                placeholder="Enter owner name"
              />
              <View style={styles.divider} />
              <FormField
                icon="people-outline"
                label="Salesperson"
                value={formData.salesperson}
                onChangeText={v => handleInputChange('salesperson', v)}
                placeholder="Enter salesperson name"
              />
              <View style={styles.divider} />
              <FormField
                icon="business-outline"
                label="Industry"
                value={formData.industry}
                onChangeText={v => handleInputChange('industry', v)}
                placeholder="Enter industry"
              />
            </View>

            {/* Contact Information */}
            <View style={styles.sectionHeader}>
              <IonIcon name="call-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Contact Information</Text>
            </View>
            <View style={styles.sectionCard}>
              <FormField
                icon="mail-outline"
                label="Email Address"
                value={formData.email}
                onChangeText={v => handleInputChange('email', v)}
                placeholder="Enter email address"
                keyboardType="email-address"
              />
              <View style={styles.divider} />
              <FormField
                icon="call-outline"
                label="Phone Number"
                value={formData.phone}
                onChangeText={v => handleInputChange('phone', v)}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
              <View style={styles.divider} />
              <FormField
                icon="globe-outline"
                label="Website"
                value={formData.website}
                onChangeText={v => handleInputChange('website', v)}
                placeholder="Enter website URL"
              />
            </View>

            {/* Address Details */}
            <View style={styles.sectionHeader}>
              <IonIcon
                name="location-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>Address Details</Text>
            </View>
            <View style={styles.sectionCard}>
              <FormField
                icon="home-outline"
                label="Street Address"
                value={formData.address}
                onChangeText={v => handleInputChange('address', v)}
                placeholder="Enter street address"
                multiline
              />
              <View style={styles.divider} />
              <View style={styles.halfRow}>
                <HalfField
                  icon="business-outline"
                  label="City"
                  value={formData.city}
                  onChangeText={v => handleInputChange('city', v)}
                  placeholder="Enter city"
                />
                <HalfField
                  icon="map-outline"
                  label="State"
                  value={formData.state}
                  onChangeText={v => handleInputChange('state', v)}
                  placeholder="Enter state"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.halfRow}>
                <HalfField
                  icon="globe-outline"
                  label="Country"
                  value={formData.country}
                  onChangeText={v => handleInputChange('country', v)}
                  placeholder="Enter"
                />
                <HalfField
                  icon="pin-outline"
                  label="Pincode"
                  value={formData.pincode}
                  onChangeText={v => handleInputChange('pincode', v)}
                  placeholder="Enter"
                />
              </View>
            </View>

            {/* Tax Information */}
            <View style={styles.sectionHeader}>
              <IonIcon
                name="receipt-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>Tax Information</Text>
            </View>
            <View style={styles.sectionCard}>
              <FormField
                icon="document-text-outline"
                label="GSTIN"
                value={formData.gstin}
                onChangeText={v => handleInputChange('gstin', v)}
                placeholder="Enter GSTIN"
              />
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!formData.name.trim() || loading) && { opacity: 0.5 },
              ]}
              onPress={handleSubmit}
              disabled={!formData.name.trim() || loading}
              activeOpacity={0.85}
            >
              <View style={styles.saveBtnInner}>
                <IonIcon name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {loading ? 'Saving...' : 'Save Company'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={{ height: ms(40) }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
};

const fStyles = StyleSheet.create({
  container: {
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
  },
  halfContainer: {
    flex: 1,
    paddingHorizontal: ms(10),
    paddingVertical: ms(10),
  },
  focused: {
    backgroundColor: Colors.primaryBackground + '40',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  label: {
    fontSize: ms(12),
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  input: {
    fontSize: ms(15),
    fontWeight: '500',
    color: Colors.textPrimary,
    paddingVertical: ms(4),
    paddingHorizontal: ms(20),
    backgroundColor: Colors.background,
    borderRadius: ms(10),
    marginTop: 4,
  },
  inputDisabled: {
    backgroundColor: Colors.divider,
    color: Colors.textTertiary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Header — matching Expo
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(14),
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: ms(15),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: ms(14),
  },
  halfRow: {
    flexDirection: 'row',
  },
  saveBtn: {
    marginTop: Spacing.xl,
    borderRadius: ms(16),
    overflow: 'hidden',
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ms(16),
    backgroundColor: Colors.primary,
    gap: 8,
  },
  saveBtnText: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#fff',
  },
});

export default AddCompanyScreen;
