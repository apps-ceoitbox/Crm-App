/**
 * Forgot Password Screen
 * Multi-step flow to reset user password
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
	TextInput,
	ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { isValidEmail } from '../../utils/Helpers';
import { authAPI } from '../../api';
import { AppText, AppButton, AppInput } from '../../components';
import { showToast } from '../../utils';

const ForgotPasswordScreen = ({ navigation }) => {
	const [step, setStep] = useState('EMAIL'); // 'EMAIL' | 'OTP' | 'RESET'
	const [email, setEmail] = useState('');
	const [otp, setOtp] = useState(new Array(6).fill(''));
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState({});

	const passwordRef = useRef(null);
	const confirmPasswordRef = useRef(null);
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const slideAnim = useRef(new Animated.Value(30)).current;

	useEffect(() => {
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
	}, [step]);

	const handleSendOtp = async () => {
		Keyboard.dismiss();
		if (!email.trim()) {
			setErrors({ email: 'Email is required' });
			return;
		}
		if (!isValidEmail(email)) {
			setErrors({ email: 'Please enter a valid email' });
			return;
		}

		setLoading(true);
		const res = await authAPI.forgotPasswordSendOtp(email);
		setLoading(false);

		if (res.success) {
			showToast('success', 'OTP sent to your email.');
			setStep('OTP');
			setErrors({});
		} else {
			setErrors({ general: res.error || 'Failed to send OTP.' });
		}
	};

	const handleVerifyOtp = async () => {
		Keyboard.dismiss();
		const code = otp.join('');
		if (code.length < 6) {
			setErrors({ otp: 'Please enter 6-digit OTP' });
			return;
		}

		setLoading(true);
		const res = await authAPI.verifyForgotPasswordOtp(email, code);
		setLoading(false);

		if (res.success) {
			setStep('RESET');
			setErrors({});
		} else {
			setErrors({ otp: res.error || 'Invalid OTP.' });
		}
	};

	const handleResetPassword = async () => {
		Keyboard.dismiss();
		const newErrors = {};
		if (!password.trim()) newErrors.password = 'Password is required';
		else if (password.length < 6) newErrors.password = 'Min 6 characters required';

		if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		setLoading(true);
		const res = await authAPI.forgotPasswordReset({
			email,
			otp: otp.join(''),
			newPassword: password,
		});
		setLoading(false);

		if (res.success) {
			showToast('success', 'Password reset successfully. Please login.');
			navigation.navigate('Login');
		} else {
			setErrors({ general: res.error || 'Failed to reset password.' });
		}
	};

	const renderProgress = () => (
		<View style={styles.progressContainer}>
			<View style={[styles.dot, step === 'EMAIL' ? styles.dotActive : styles.dotInactive]} />
			<View style={[styles.dot, step === 'OTP' ? styles.dotActive : styles.dotInactive]} />
			<View style={[styles.dot, step === 'RESET' ? styles.dotActive : styles.dotInactive]} />
		</View>
	);

	const inputsRef = useRef([]);
	const focusInput = idx => {
		const ref = inputsRef.current[idx];
		ref && ref.focus && ref.focus();
	};

	const handleOtpChange = (text, idx) => {
		if (!/^[0-9]*$/.test(text)) return;
		const next = [...otp];
		next[idx] = text.slice(-1);
		setOtp(next);
		if (text && idx < 5) focusInput(idx + 1);
	};

	const handleOtpKeyPress = ({ nativeEvent }, idx) => {
		if (nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
			const prev = [...otp];
			prev[idx - 1] = '';
			setOtp(prev);
			focusInput(idx - 1);
		}
	};

	return (
		<SafeAreaView style={styles.safeArea} edges={['top']}>
			<StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				style={styles.keyboardAvoid}
			>
				<ScrollView
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
				>
					<View style={styles.container}>
						<Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
							{step === 'EMAIL' && (
								<>
									<AppText size="xxl" weight="bold" style={styles.title}>Forgot Password?</AppText>
									<AppText size="sm" color={Colors.textSecondary} style={styles.subtitle}>
										Enter your email to receive an OTP
									</AppText>
								</>
							)}
							{step === 'OTP' && (
								<>
									<AppText size="xxl" weight="bold" style={styles.title}>Verify OTP</AppText>
									<AppText size="sm" color={Colors.textSecondary} style={styles.subtitle}>
										Enter the 6-digit code sent to your email
									</AppText>
								</>
							)}
							{step === 'RESET' && (
								<>
									<AppText size="xxl" weight="bold" style={styles.title}>New Password</AppText>
									<AppText size="sm" color={Colors.textSecondary} style={styles.subtitle}>
										Set a secure password for your account
									</AppText>
								</>
							)}
							{renderProgress()}
						</Animated.View>

						<Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
							{errors.general && (
								<View style={styles.errorBox}>
									<Icon name="alert-circle" size={ms(18)} color={Colors.error} />
									<AppText size="sm" color={Colors.error} style={styles.errorText}>{errors.general}</AppText>
								</View>
							)}

							{step === 'EMAIL' && (
								<>
									<AppInput
										label="Email Address"
										placeholder="you@example.com"
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
									/>
									<AppButton
										title="Send OTP"
										onPress={handleSendOtp}
										loading={loading}
										style={styles.button}
									/>
								</>
							)}

							{step === 'OTP' && (
								<>
									<View style={styles.otpBoxesRow}>
										{otp.map((d, i) => (
											<TextInput
												key={i}
												ref={ref => (inputsRef.current[i] = ref)}
												value={d}
												onChangeText={t => handleOtpChange(t, i)}
												onKeyPress={e => handleOtpKeyPress(e, i)}
												keyboardType="numeric"
												maxLength={1}
												style={[styles.otpBox, !!errors.otp && { borderColor: Colors.error }]}
												textAlign="center"
											/>
										))}
									</View>
									{errors.otp && <AppText size="xs" color={Colors.error} style={styles.otpError}>{errors.otp}</AppText>}
									<AppButton
										title="Verify OTP"
										onPress={handleVerifyOtp}
										loading={loading}
										style={styles.button}
									/>
									<TouchableOpacity onPress={() => setStep('EMAIL')} style={styles.resendBtn}>
										<AppText size="sm" color={Colors.primary} weight="medium">Resend OTP</AppText>
									</TouchableOpacity>
								</>
							)}

							{step === 'RESET' && (
								<>
									<AppInput
										label="New Password"
										placeholder="Enter new password"
										value={password}
										onChangeText={text => {
											setPassword(text);
											setErrors({ ...errors, password: null });
										}}
										secureTextEntry
										leftIcon="lock-closed-outline"
										error={!!errors.password}
										errorMessage={errors.password}
									/>
									<AppInput
										label="Confirm Password"
										placeholder="Confirm new password"
										value={confirmPassword}
										onChangeText={text => {
											setConfirmPassword(text);
											setErrors({ ...errors, confirmPassword: null });
										}}
										secureTextEntry
										leftIcon="lock-closed-outline"
										error={!!errors.confirmPassword}
										errorMessage={errors.confirmPassword}
									/>
									<AppButton
										title="Reset Password"
										onPress={handleResetPassword}
										loading={loading}
										style={styles.button}
									/>
								</>
							)}
						</Animated.View>

						<TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
							<Icon name="arrow-back" size={ms(18)} color={Colors.primary} />
							<AppText size="sm" weight="medium" color={Colors.primary} style={styles.backText}>
								Back to Login
							</AppText>
						</TouchableOpacity>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
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
		paddingHorizontal: wp(6),
		paddingVertical: vs(20),
	},
	header: {
		alignItems: 'center',
		marginBottom: vs(32),
	},
	title: {
		marginBottom: vs(8),
		color: '#111827',
	},
	subtitle: {
		textAlign: 'center',
		color: '#6B7280',
		marginBottom: vs(20),
	},
	progressContainer: {
		flexDirection: 'row',
		gap: 8,
		alignItems: 'center',
		marginTop: vs(10),
	},
	dot: {
		height: ms(6),
		borderRadius: ms(3),
	},
	dotActive: {
		width: ms(24),
		backgroundColor: Colors.primary,
	},
	dotInactive: {
		width: ms(6),
		backgroundColor: '#E5E7EB',
	},
	formContainer: {
		backgroundColor: Colors.white,
		borderRadius: BorderRadius.card,
		padding: Spacing.lg,
		...Shadow.md,
	},
	button: {
		marginTop: Spacing.md,
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
	otpBoxesRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: Spacing.md,
	},
	otpBox: {
		width: ms(40),
		height: ms(50),
		borderRadius: BorderRadius.sm,
		borderWidth: 1.5,
		borderColor: '#E5E7EB',
		backgroundColor: '#F9FAFB',
		fontSize: ms(18),
		fontWeight: '600',
		color: '#111827',
	},
	otpError: {
		marginBottom: Spacing.sm,
		textAlign: 'center',
	},
	resendBtn: {
		marginTop: Spacing.md,
		alignItems: 'center',
	},
	backLink: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: vs(30),
		gap: 6,
	},
	backText: {
		// textDecorationLine: 'underline',
	},
});

export default ForgotPasswordScreen;
