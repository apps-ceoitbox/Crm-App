/**
 * Register Screen
 * User registration screen with form validation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { isValidEmail, isValidPhone } from '../../utils/Helpers';
import { useAuth } from '../../context';
import {
    AppText,
    AppButton,
    AppInput,
    ModalLoader,
} from '../../components';

const RegisterScreen = ({ navigation }) => {
    const { register, googleLogin } = useAuth();

    const [formData, setFormData] = useState({
        name: '',
        organization: '',
        email: '',
        password: '',
    });
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const organizationRef = useRef(null);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Animate on mount
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const updateField = (field, value) => {
        setFormData({ ...formData, [field]: value });
        setErrors({ ...errors, [field]: null, general: null });
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Full name is required';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'Name must be at least 2 characters';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!isValidEmail(formData.email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!formData.password.trim()) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (!agreeTerms) {
            newErrors.terms = 'You must agree to the terms and conditions';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleRegister = async () => {
        Keyboard.dismiss();

        if (!validateForm()) return;

        setLoading(true);

        const result = await register(formData);

        setLoading(false);

        if (result.success) {
            // Navigate to main app
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
            });
        } else {
            setErrors({
                general: result.error || 'Registration failed. Please try again.',
            });
        }
    };

    const handleGoogleLogin = async () => {
        Keyboard.dismiss();
        setLoading(true);

        const result = await googleLogin();

        setLoading(false);

        if (result.success) {
            // Navigate to main app
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
            });
        } else {
            setErrors({
                general: result.error || 'Google Sign-Up failed. Please try again.',
            });
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <View style={styles.container}>
                        {/* Header Section */}
                        <Animated.View
                            style={[
                                styles.header,
                                {
                                    opacity: fadeAnim,
                                    transform: [{ translateY: slideAnim }],
                                },
                            ]}
                        >
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => navigation.goBack()}
                            >
                                <Icon name="arrow-back" size={ms(24)} color={Colors.textPrimary} />
                            </TouchableOpacity>

                            <View style={styles.logoContainer}>
                                <View style={styles.logo}>
                                    <Icon name="person-add" size={ms(40)} color={Colors.white} />
                                </View>
                            </View>
                            <AppText size="xxl" weight="bold" style={styles.title}>
                                Create Account
                            </AppText>
                            <AppText size="sm" color={Colors.textSecondary} style={styles.subtitle}>
                                Join CRM Pro and start managing your leads
                            </AppText>
                        </Animated.View>

                        {/* Form Section */}
                        <Animated.View
                            style={[
                                styles.formContainer,
                                {
                                    opacity: fadeAnim,
                                    transform: [{ translateY: slideAnim }],
                                },
                            ]}
                        >
                            {/* General Error */}
                            {errors.general && (
                                <View style={styles.errorBox}>
                                    <Icon name="alert-circle" size={ms(18)} color={Colors.error} />
                                    <AppText size="sm" color={Colors.error} style={styles.errorText}>
                                        {errors.general}
                                    </AppText>
                                </View>
                            )}

                            {/* Full Name Input */}
                            <AppInput
                                label="Full Name"
                                placeholder="Enter your full name"
                                value={formData.name}
                                onChangeText={(text) => updateField('name', text)}
                                leftIcon="person-outline"
                                error={!!errors.name}
                                errorMessage={errors.name}
                                returnKeyType="next"
                                onSubmitEditing={() => organizationRef.current?.focus()}
                            />

                            {/* Organization Name Input */}
                            <AppInput
                                ref={organizationRef}
                                label="Organization Name"
                                placeholder="Enter your company name"
                                value={formData.organization}
                                onChangeText={(text) => updateField('organization', text)}
                                leftIcon="business-outline"
                                returnKeyType="next"
                                onSubmitEditing={() => emailRef.current?.focus()}
                            />

                            {/* Email Input */}
                            <AppInput
                                ref={emailRef}
                                label="Email Address"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChangeText={(text) => updateField('email', text)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                leftIcon="mail-outline"
                                error={!!errors.email}
                                errorMessage={errors.email}
                                returnKeyType="next"
                                onSubmitEditing={() => passwordRef.current?.focus()}
                            />

                            {/* Password Input */}
                            <AppInput
                                ref={passwordRef}
                                label="Password"
                                placeholder="Create a password"
                                value={formData.password}
                                onChangeText={(text) => updateField('password', text)}
                                secureTextEntry
                                leftIcon="lock-closed-outline"
                                error={!!errors.password}
                                errorMessage={errors.password}
                                helperText="At least 6 characters"
                                returnKeyType="done"
                                onSubmitEditing={handleRegister}
                            />

                            {/* Terms Agreement */}
                            <TouchableOpacity
                                style={styles.termsContainer}
                                onPress={() => {
                                    setAgreeTerms(!agreeTerms);
                                    if (errors.terms) {
                                        setErrors({ ...errors, terms: null });
                                    }
                                }}
                            >
                                <Icon
                                    name={agreeTerms ? 'checkbox' : 'square-outline'}
                                    size={ms(22)}
                                    color={errors.terms ? Colors.error : (agreeTerms ? Colors.primary : Colors.textMuted)}
                                />
                                <View style={styles.termsTextContainer}>
                                    <AppText size="sm" color={Colors.textSecondary}>
                                        I agree to the{' '}
                                    </AppText>
                                    <TouchableOpacity>
                                        <AppText size="sm" weight="medium" color={Colors.primary}>
                                            Terms of Service
                                        </AppText>
                                    </TouchableOpacity>
                                    <AppText size="sm" color={Colors.textSecondary}>
                                        {' '}and{' '}
                                    </AppText>
                                    <TouchableOpacity>
                                        <AppText size="sm" weight="medium" color={Colors.primary}>
                                            Privacy Policy
                                        </AppText>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                            {errors.terms && (
                                <AppText size="xs" color={Colors.error} style={styles.termsError}>
                                    {errors.terms}
                                </AppText>
                            )}

                            {/* Register Button */}
                            <AppButton
                                title="Create Account"
                                onPress={handleRegister}
                                loading={loading}
                                style={styles.registerButton}
                                icon="person-add-outline"
                            />

                            {/* Divider */}
                            <View style={styles.divider}>
                                <View style={styles.dividerLine} />
                                <AppText size="sm" color={Colors.textMuted} style={styles.dividerText}>
                                    OR
                                </AppText>
                                <View style={styles.dividerLine} />
                            </View>

                            {/* Social Login */}
                            <View style={styles.socialContainer}>
                                <TouchableOpacity
                                    style={styles.socialButton}
                                    onPress={handleGoogleLogin}
                                    disabled={loading}
                                >
                                    <Icon name="logo-google" size={ms(24)} color="#DB4437" />
                                </TouchableOpacity>
                                {/* <TouchableOpacity style={styles.socialButton}>
                                    <Icon name="apple" size={ms(24)} color={Colors.black} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.socialButton}>
                                    <Icon name="microsoft" size={ms(24)} color="#00A4EF" />
                                </TouchableOpacity> */}
                            </View>
                        </Animated.View>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <AppText size="sm" color={Colors.textSecondary}>
                                Already have an account?{' '}
                            </AppText>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <AppText size="sm" weight="semiBold" color={Colors.primary}>
                                    Sign In
                                </AppText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <ModalLoader visible={loading} text="Creating account..." />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    keyboardAvoid: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: wp(5),
        paddingVertical: vs(10),
    },
    header: {
        alignItems: 'center',
        marginBottom: vs(24),
    },
    backButton: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: ms(40),
        height: ms(40),
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.sm,
    },
    logoContainer: {
        marginBottom: vs(16),
    },
    logo: {
        width: ms(80),
        height: ms(80),
        borderRadius: ms(20),
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.lg,
    },
    title: {
        marginBottom: vs(8),
    },
    subtitle: {
        textAlign: 'center',
    },
    formContainer: {
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.card,
        padding: Spacing.lg,
        ...Shadow.md,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.errorLight,
        padding: Spacing.md,
        borderRadius: BorderRadius.sm,
        marginBottom: Spacing.base,
    },
    errorText: {
        marginLeft: Spacing.sm,
        flex: 1,
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    termsTextContainer: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginLeft: Spacing.sm,
    },
    termsError: {
        marginLeft: ms(30),
        marginBottom: Spacing.md,
    },
    registerButton: {
        marginTop: Spacing.md,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    dividerText: {
        marginHorizontal: Spacing.md,
    },
    socialContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.md,
    },
    socialButton: {
        width: ms(50),
        height: ms(50),
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: vs(24),
        marginBottom: vs(20),
    },
});

export default RegisterScreen;
