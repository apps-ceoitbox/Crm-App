import React from 'react';
import {
	View,
	StyleSheet,
	Modal,
	TouchableOpacity,
} from 'react-native';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../constants/Spacing';
import { ms, vs } from '../utils/Responsive';
import AppText from './AppText';
import AppButton from './AppButton';

const LogoutConfirmationModal = ({
	visible,
	onCancel,
	onConfirm,
	loading = false,
}) => {
	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onCancel}
		>
			<TouchableOpacity
				style={styles.modalOverlay}
				activeOpacity={1}
				onPress={!loading ? onCancel : undefined}
			>
				<TouchableOpacity activeOpacity={1} onPress={() => { }} style={{ width: '100%', alignItems: 'center' }}>
					<View style={styles.modalContent}>
						<View style={styles.iconContainer}>
							<IonIcon name="log-out-outline" size={ms(40)} color={Colors.error} />
						</View>

						<AppText size={ms(18)} weight="bold" color={Colors.textPrimary} style={styles.title}>
							Log Out
						</AppText>

						<AppText size={ms(14)} color={Colors.textSecondary} style={styles.message}>
							Are you sure you want to log out of your account?
						</AppText>

						<View style={styles.buttonContainer}>
							<AppButton
								title="Cancel"
								onPress={onCancel}
								variant="outline"
								disabled={loading}
								style={styles.cancelButton}
								textStyle={styles.cancelButtonText}
							/>
							<View style={styles.buttonSpacer} />
							<AppButton
								title="Log Out"
								onPress={onConfirm}
								variant="danger"
								loading={loading}
								style={styles.logoutButton}
							/>
						</View>
					</View>
				</TouchableOpacity>
			</TouchableOpacity>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: Spacing.xl,
	},
	modalContent: {
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.lg,
		padding: Spacing.xl,
		width: '90%',
		alignItems: 'center',
		...Shadow.md,
	},
	iconContainer: {
		marginBottom: Spacing.md,
		backgroundColor: '#FEF2F2',
		padding: Spacing.md,
		borderRadius: ms(30),
	},
	title: {
		marginBottom: Spacing.sm,
		textAlign: 'center',
	},
	message: {
		textAlign: 'center',
		marginBottom: Spacing.xl,
		lineHeight: vs(20),
	},
	buttonContainer: {
		flexDirection: 'row',
		width: '100%',
	},
	cancelButton: {
		flex: 1,
		borderColor: Colors.borderDark,
	},
	cancelButtonText: {
		color: Colors.textPrimary,
	},
	buttonSpacer: {
		width: Spacing.md,
	},
	logoutButton: {
		flex: 1,
	},
});

export default LogoutConfirmationModal;
