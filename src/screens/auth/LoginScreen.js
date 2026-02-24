/**
 * Login Screen
 * User authentication screen with form validation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
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
import { isValidEmail } from '../../utils/Helpers';
import { useAuth } from '../../context';
import { AppText, AppButton, AppInput, ModalLoader } from '../../components';

const LoginScreen = ({ navigation }) => {
  const { login, googleLogin, appleLogin, rememberedEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

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

  useEffect(() => {
    // Pre-fill remembered email
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, [rememberedEmail]);

  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 5) {
      newErrors.password = 'Password must be at least 5 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    Keyboard.dismiss();

    if (!validateForm()) return;

    setLoading(true);

    const result = await login(email, password, rememberMe);

    setLoading(false);

    if (result.success) {
      // Navigate to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } else {
      setErrors({
        general:
          result.error ||
          'Invalid email or password. Try demo@crm.com / demo123',
      });
    }
  };

  const handleForgotPassword = () => {
    // Navigate to forgot password screen (can be added later)
    console.log('Forgot password pressed');
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
        general: result.error || 'Google Sign-In failed. Please try again.',
      });
    }
  };

  const handleAppleLogin = async () => {
    Keyboard.dismiss();
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Apple Sign-In',
        'Apple Sign-In is available only on iOS devices.',
      );
      return;
    }

    if (typeof appleLogin !== 'function') {
      Alert.alert(
        'Not configured',
        'Apple Sign-In is not configured in this app. Please contact support.',
      );
      return;
    }

    setLoading(true);
    const result = await appleLogin();
    console.log('apple login  result', result);
    setLoading(false);

    if (result.success) {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } else {
      setErrors({
        general: result.error || 'Apple Sign-In failed. Please try again.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
              <View style={styles.logoContainer}>
                <View style={styles.logo}>
                  <Icon name="people" size={ms(40)} color={Colors.white} />
                </View>
              </View>
              <AppText size="xxl" weight="bold" style={styles.title}>
                Welcome Back
              </AppText>
              <AppText
                size="sm"
                color={Colors.textSecondary}
                style={styles.subtitle}
              >
                Sign in to continue managing your leads
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
                  <Icon
                    name="alert-circle"
                    size={ms(18)}
                    color={Colors.error}
                  />
                  <AppText
                    size="sm"
                    color={Colors.error}
                    style={styles.errorText}
                  >
                    {errors.general}
                  </AppText>
                </View>
              )}

              {/* Email Input */}
              <AppInput
                label="Email Address"
                placeholder="Enter your email"
                value={email}
                onChangeText={text => {
                  setEmail(text);
                  setErrors({ ...errors, email: null, general: null });
                }}
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
                placeholder="Enter your password"
                value={password}
                onChangeText={text => {
                  setPassword(text);
                  setErrors({ ...errors, password: null, general: null });
                }}
                secureTextEntry
                leftIcon="lock-closed-outline"
                error={!!errors.password}
                errorMessage={errors.password}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              {/* Remember Me & Forgot Password */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <Icon
                    name={rememberMe ? 'checkbox' : 'square-outline'}
                    size={ms(22)}
                    color={rememberMe ? Colors.primary : Colors.textMuted}
                  />
                  <AppText
                    size="sm"
                    color={Colors.textSecondary}
                    style={styles.rememberText}
                  >
                    Remember me
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleForgotPassword}>
                  <AppText size="sm" weight="medium" color={Colors.primary}>
                    Forgot Password?
                  </AppText>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <AppButton
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
                style={styles.loginButton}
                icon="log-in-outline"
              />

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <AppText
                  size="sm"
                  color={Colors.textMuted}
                  style={styles.dividerText}
                >
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
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={handleAppleLogin}
                    disabled={loading}
                  >
                    <Icon
                      name="logo-apple"
                      size={ms(24)}
                      color={Colors.black}
                    />
                  </TouchableOpacity>
                )}
                {/*
                <TouchableOpacity style={styles.socialButton}>
                    <Icon name="microsoft" size={ms(24)} color="#00A4EF" />
                </TouchableOpacity>
                */}
              </View>
            </Animated.View>

            {/* Footer */}
            <View style={styles.footer}>
              <AppText size="sm" color={Colors.textSecondary}>
                Don't have an account?{' '}
              </AppText>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <AppText size="sm" weight="semiBold" color={Colors.primary}>
                  Sign Up
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ModalLoader visible={loading} text="Signing in..." />
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
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: vs(20),
  },
  header: {
    alignItems: 'center',
    marginBottom: vs(32),
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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    marginLeft: Spacing.xs,
  },
  loginButton: {
    marginTop: Spacing.sm,
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
  },
  demoHint: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: vs(16),
    padding: Spacing.sm,
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.sm,
  },
  demoText: {
    marginLeft: Spacing.xs,
  },
});

export default LoginScreen;
