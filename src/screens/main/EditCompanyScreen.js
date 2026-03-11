/**
 * Edit Company Screen
 * Same UI as AddCompanyScreen — prefills from route.params.company
 * and calls companiesAPI.update(id, payload) on save.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    Keyboard,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText, AppInput, AppButton, ModalLoader } from '../../components';
import { companiesAPI } from '../../api';
import { showError, showSuccess } from '../../utils';
import { ROUTES } from '../../constants';

// Section Header Component
const SectionHeader = ({ icon, title }) => (
    <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderContent}>
            <Icon name={icon} size={ms(20)} color={Colors.primary} />
            <AppText size="base" weight="bold" color={Colors.textPrimary} style={styles.sectionTitle}>
                {title}
            </AppText>
        </View>
        <View style={styles.sectionDivider} />
    </View>
);

// Input Field with Icon
const InputField = ({ icon, label, ...props }) => (
    <View style={styles.inputFieldContainer}>
        <AppInput
            label={label}
            leftIcon={icon}
            {...props}
            containerStyle={{ marginBottom: 0 }}
        />
    </View>
);

const EditCompanyScreen = ({ navigation, route }) => {
    const { company } = route.params || {};

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
    const [errors, setErrors] = useState({});

    const initialDataRef = useRef(null);

    // Pre-fill form with existing company data
    useEffect(() => {
        if (company) {
            const initial = {
                name: company.name || '',
                ownerName: company.ownerName || '',
                salesperson: company.salesperson || '',
                city: company.city || '',
                state: company.state || '',
                country: company.country || '',
                website: company.website || '',
                industry: company.industry || '',
                gstin: company.gstin || '',
                email: company.email || '',
                phone: company.phone || '',
                address: company.address || '',
                pincode: company.pincode || '',
            };
            setFormData(initial);
            initialDataRef.current = initial;
        } else {
            initialDataRef.current = formData;
        }

        // Fade in animation
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, []);

    // Handle input changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    // Check if form has been modified
    const hasChanges = initialDataRef.current
        ? Object.keys(formData).some(key => formData[key] !== initialDataRef.current[key])
        : false;

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Company name is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async () => {
        Keyboard.dismiss();

        if (!validateForm()) {
            showError('Validation Error', 'Company name is required');
            return;
        }

        setLoading(true);
        try {
            const companyId = company?._id || company?.id;
            const response = await companiesAPI.update(companyId, formData);

            if (response.success) {
                showSuccess('Success', 'Company updated successfully');
                // Notify parent screen if callback provided
                try {
                    const updated =
                        response.data?.data ||
                        response.data?.company ||
                        response.data ||
                        { ...company, ...formData };
                    route?.params?.onUpdate && route.params.onUpdate(updated);
                } catch {
                    // ignore non-serializable param errors
                }
                // Call refresh callback from parent if provided
                route?.params?.refreshCompanies?.();
                navigation.goBack();
            } else {
                showError('Error', response.error || 'Failed to update company');
            }
        } catch (error) {
            console.error('Error updating company:', error);
            showError('Error', 'Failed to update company');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Icon name="arrow-back" size={ms(24)} color={Colors.black} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    {/* <AppText size="lg" weight="bold" numberOfLines={1} color={Colors.black}>
                        Edit Company
                    </AppText> */}
                    {company?.name ? (
                        <AppText size="lg" weight="bold" numberOfLines={1} color={Colors.black}>
                            {company.name}
                        </AppText>
                    ) : null}
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        style={[styles.saveHeaderBtn, (!formData.name.trim() || loading || !hasChanges) && { opacity: 0.5 }]}
                        onPress={handleSubmit}
                        disabled={loading || !formData.name.trim() || !hasChanges}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                            <>
                                <Icon name="checkmark" size={ms(16)} color={Colors.white} />
                                <AppText size="sm" weight="bold" color={Colors.white} style={{ marginLeft: ms(4) }}>
                                    Update
                                </AppText>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Form Content */}
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : vs(10)}
                >
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Basic Information Section */}
                        <View style={styles.section}>
                            <SectionHeader icon="business-outline" title="Basic Information" />

                            <InputField
                                icon="business-outline"
                                label="Company Name"
                                placeholder="Enter company name"
                                value={formData.name}
                                onChangeText={(value) => handleInputChange('name', value)}
                                autoCapitalize="words"
                                error={!!errors.name}
                                errorMessage={errors.name}
                            />

                            <InputField
                                icon="person-outline"
                                label="Owner Name"
                                placeholder="Enter owner name"
                                value={formData.ownerName}
                                onChangeText={(value) => handleInputChange('ownerName', value)}
                                autoCapitalize="words"
                            />

                            <InputField
                                icon="globe-outline"
                                label="Website"
                                placeholder="Enter website URL (e.g. www.example.com)"
                                value={formData.website}
                                onChangeText={(value) => handleInputChange('website', value)}
                                keyboardType="url"
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Location Section */}
                        <View style={styles.section}>
                            <SectionHeader icon="location-outline" title="Location Details" />

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <InputField
                                        icon="storefront-outline"
                                        label="City"
                                        placeholder="Enter city"
                                        value={formData.city}
                                        onChangeText={(value) => handleInputChange('city', value)}
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <InputField
                                        icon="map-outline"
                                        label="State"
                                        placeholder="Enter state"
                                        value={formData.state}
                                        onChangeText={(value) => handleInputChange('state', value)}
                                        autoCapitalize="words"
                                    />
                                </View>
                            </View>

                            <InputField
                                icon="earth-outline"
                                label="Country"
                                placeholder="Enter country"
                                value={formData.country}
                                onChangeText={(value) => handleInputChange('country', value)}
                                autoCapitalize="words"
                            />
                        </View>

                        {/* Industry & Tax Section */}
                        <View style={styles.section}>
                            <SectionHeader icon="receipt-outline" title="Industry & Tax" />

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <InputField
                                        icon="briefcase-outline"
                                        label="Industry"
                                        placeholder="e.g. Technology"
                                        value={formData.industry}
                                        onChangeText={(value) => handleInputChange('industry', value)}
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <InputField
                                        icon="document-text-outline"
                                        label="GSTIN"
                                        placeholder="Enter GSTIN"
                                        value={formData.gstin}
                                        onChangeText={(value) => handleInputChange('gstin', value)}
                                        autoCapitalize="characters"
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={styles.bottomSpacer} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </Animated.View>

            <ModalLoader visible={loading} text="Updating company..." />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: wp(4),
        paddingVertical: vs(10),
    },
    backButton: {
        width: ms(44),
        height: ms(44),
        borderRadius: BorderRadius.round,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        marginLeft: wp(0),
    },
    headerRight: {
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    saveHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: wp(3),
        paddingVertical: vs(8),
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        ...Shadow.sm,
    },
    content: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: vs(16),
        paddingBottom: vs(100),
    },
    section: {
        marginHorizontal: wp(4),
        marginBottom: vs(20),
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadow.md,
    },
    sectionHeader: {
        marginBottom: vs(16),
    },
    sectionHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(8),
    },
    sectionTitle: {
        marginLeft: ms(8),
    },
    sectionDivider: {
        height: 2,
        backgroundColor: Colors.primary + '20',
        borderRadius: 1,
    },
    inputFieldContainer: {
        marginBottom: vs(16),
    },
    row: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    halfInput: {
        flex: 1,
    },
    bottomSpacer: {
        height: vs(20),
    },
});

export default EditCompanyScreen;
