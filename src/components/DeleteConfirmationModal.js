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

const DeleteConfirmationModal = ({
	visible,
	title = "Delete Item",
	message = "Are you sure you want to delete this item? This action cannot be undone.",
	onCancel,
	onDelete,
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
							<IonIcon name="alert-circle-outline" size={ms(48)} color={Colors.danger} />
						</View>

						<AppText size={ms(18)} weight="bold" color={Colors.textPrimary} style={styles.title}>
							{title}
						</AppText>

						<AppText size={ms(14)} color={Colors.textSecondary} style={styles.message}>
							{message}
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
								title="Delete"
								onPress={onDelete}
								variant="danger"
								loading={loading}
								style={styles.deleteButton}
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
		backgroundColor: Colors.overlay,
		justifyContent: 'center',
		alignItems: 'center',
		padding: Spacing.xl,
	},
	modalContent: {
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.lg,
		padding: Spacing.xl,
		width: '100%',
		alignItems: 'center',
		...Shadow.md,
	},
	iconContainer: {
		marginBottom: Spacing.md,
		backgroundColor: Colors.dangerBg,
		padding: Spacing.sm,
		borderRadius: BorderRadius.round,
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
	deleteButton: {
		flex: 1,
	},
});

export default DeleteConfirmationModal;
