import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText, AppButton } from '../../components';
import { useAuth } from '../../context';

const BOX_COUNT = 6;

const TwoFactorScreen = ({
  tempToken,
  email,
  rememberMe = false,
  onSuccess,
  onCancel,
}) => {
  const { verifyTwoFactor } = useAuth();
  const navigation = useNavigation();

  const [values, setValues] = useState(Array(BOX_COUNT).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inputsRef = useRef([]);
  const hiddenRef = useRef(null);

  useEffect(() => {
    // Focus hidden input first to allow platform autofill suggestions to appear
    const t = setTimeout(() => {
      try {
        hiddenRef.current &&
          hiddenRef.current.focus &&
          hiddenRef.current.focus();
      } catch (e) {}
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const focusIndex = idx => {
    const ref = inputsRef.current[idx];
    if (ref && ref.focus) ref.focus();
  };

  const handleBoxChange = (text, idx) => {
    setError(null);
    const digit = (text || '').replace(/[^0-9]/g, '');
    if (!digit) return;

    // If user pasted multiple digits into a box, distribute them
    if (digit.length > 1) {
      const next = [...values];
      let i = idx;
      for (const ch of digit) {
        if (i >= BOX_COUNT) break;
        next[i] = ch;
        i += 1;
      }
      setValues(next);
      const pos = Math.min(BOX_COUNT - 1, idx + digit.length);
      focusIndex(pos);
      return;
    }

    const next = [...values];
    next[idx] = digit;
    setValues(next);
    if (idx < BOX_COUNT - 1) focusIndex(idx + 1);
  };

  const handleKeyPress = ({ nativeEvent }, idx) => {
    if (nativeEvent.key === 'Backspace') {
      if (values[idx]) {
        const next = [...values];
        next[idx] = '';
        setValues(next);
      } else if (idx > 0) {
        const prev = idx - 1;
        focusIndex(prev);
        const next = [...values];
        next[prev] = '';
        setValues(next);
      }
    }
  };

  // Handle platform autofill into hidden input
  const handleHiddenChange = txt => {
    const digits = (txt || '').replace(/[^0-9]/g, '').slice(0, BOX_COUNT);
    if (!digits) return;
    const next = Array(BOX_COUNT).fill('');
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    setValues(next);
    const pos = Math.min(BOX_COUNT - 1, digits.length - 1);
    focusIndex(pos);
  };

  const code = values.join('');
  const isComplete = code.length === BOX_COUNT && /^[0-9]+$/.test(code);

  const handleVerify = async () => {
    setError(null);
    if (!isComplete) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyTwoFactor(tempToken, code, rememberMe);
      if (res.success) {
        onSuccess && onSuccess();
      } else {
        setError(res.error || 'Invalid code. Please try again.');
      }
    } catch (e) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (onCancel) return onCancel();
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <AppText size="sm" color={Colors.primary}>
                &lt; Back
              </AppText>
            </TouchableOpacity>
            <AppText size="lg" weight="bold" style={styles.headerTitle}>
              Verify OTP
            </AppText>
            <View style={{ width: ms(64) }} />
          </View>

          <View style={styles.content}>
            <AppText
              size="sm"
              color={Colors.textSecondary}
              style={styles.instruction}
            >
              Enter the 6-digit code sent to your email
            </AppText>

            <View style={styles.otpRow}>
              {Array.from({ length: BOX_COUNT }).map((_, i) => {
                const isActive =
                  values[i] !== '' ||
                  (values[i] === '' && values.slice(0, i).every(Boolean));
                return (
                  <TextInput
                    key={i}
                    ref={el => (inputsRef.current[i] = el)}
                    value={values[i]}
                    onChangeText={text => handleBoxChange(text, i)}
                    onKeyPress={e => handleKeyPress(e, i)}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={1}
                    textContentType="none"
                    importantForAutofill="no"
                    style={[
                      styles.otpBox,
                      values[i] ? styles.otpBoxFilled : null,
                      isActive ? styles.otpBoxActive : null,
                    ]}
                    textAlign="center"
                    placeholder="•"
                    placeholderTextColor={Colors.textTertiary}
                    selectTextOnFocus
                  />
                );
              })}
            </View>

            {error ? (
              <AppText size="sm" color={Colors.error} style={styles.errorText}>
                {error}
              </AppText>
            ) : null}

            <AppButton
              title={loading ? 'Verifying...' : 'Verify'}
              onPress={handleVerify}
              disabled={!isComplete || loading}
              style={styles.verifyBtn}
            />

            {/* Hidden autofill input (captures SMS/OS suggestions) */}
            <TextInput
              ref={hiddenRef}
              style={styles.hiddenInput}
              value={code}
              onChangeText={handleHiddenChange}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              importantForAutofill="yes"
              // Android
              autoCompleteType={
                Platform.OS === 'android' ? 'sms-otp' : undefined
              }
              placeholder=""
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  wrap: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: wp(6),
    paddingVertical: vs(18),
    backgroundColor: Colors.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(20),
  },
  backBtn: { padding: ms(8) },
  headerTitle: { textAlign: 'center', flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  instruction: {
    marginBottom: vs(20),
    textAlign: 'center',
    paddingHorizontal: wp(4),
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: vs(14),
  },
  otpBox: {
    width: ms(48),
    height: ms(56),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: ms(20),
    color: Colors.textPrimary,
    marginHorizontal: ms(6),
    backgroundColor: Colors.white,
  },
  otpBoxActive: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    ...Shadow.sm,
  },
  otpBoxFilled: { borderColor: Colors.primary },
  verifyBtn: {
    width: '80%',
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  errorText: { marginBottom: vs(8), marginTop: vs(4) },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
});

export default TwoFactorScreen;
