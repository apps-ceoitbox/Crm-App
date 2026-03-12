/**
 * Add Contact Screen
 * Screen for adding a new contact with modern UI matching EditContactScreen
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	Animated,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Modal,
	FlatList,
	TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText, AppInput, AppButton, ModalLoader } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { contactsAPI, companiesAPI, usersAPI, leadTagsAPI } from '../../api/services';
import { showError, showSuccess } from '../../utils';

// ─── Searchable Bottom-Sheet Picker ──────────────────────────────────────────
const SearchablePicker = ({
	visible,
	title,
	items,
	getLabel,
	getKey,
	selectedKey,
	onSelect,
	onClose,
	allowNone = true,
	multiple = false,
}) => {
	const [query, setQuery] = useState('');

	const filtered = useMemo(() => {
		if (!query.trim()) return items;
		const q = query.toLowerCase();
		return items.filter(item => (getLabel(item) || '').toLowerCase().includes(q));
	}, [items, query, getLabel]);

	const handleClose = () => {
		setQuery('');
		onClose();
	};

	const handleSelect = item => {
		if (multiple) {
			if (!item) return; // 'None' not supported for multiple natively here
			const key = getKey(item);
			let newSelected = Array.isArray(selectedKey) ? [...selectedKey] : [];
			if (newSelected.includes(key)) {
				newSelected = newSelected.filter(k => k !== key);
			} else {
				newSelected.push(key);
			}
			onSelect(newSelected);
			return; // don't close picker for multi-select
		}
		setQuery('');
		onSelect(item);
	};

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
			<View style={styles.modalBackdrop}>
				<TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
				<View style={styles.pickerSheet}>
					<View style={styles.handleBar} />
					<View style={styles.pickerHeader}>
						<Text style={styles.pickerTitle}>{title}</Text>
						<TouchableOpacity onPress={handleClose} style={styles.pickerCloseBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
							<Icon name="close" size={ms(20)} color={Colors.textSecondary} />
						</TouchableOpacity>
					</View>
					<View style={styles.pickerSearch}>
						<Icon name="search-outline" size={ms(15)} color={Colors.textTertiary} />
						<TextInput
							style={styles.pickerSearchInput}
							placeholder="Search..."
							placeholderTextColor={Colors.textTertiary}
							value={query}
							onChangeText={setQuery}
							autoCorrect={false}
							returnKeyType="search"
						/>
						{query.length > 0 && (
							<TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
								<Icon name="close-circle" size={ms(16)} color={Colors.textTertiary} />
							</TouchableOpacity>
						)}
					</View>
					<FlatList
						data={allowNone ? [{ __none: true }, ...filtered] : filtered}
						keyExtractor={(item, idx) => (item.__none ? '__none__' : (getKey(item) || String(idx)))}
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
						renderItem={({ item }) => {
							if (item.__none) {
								if (multiple) return null;
								const isSelected = !selectedKey || selectedKey === 'none';
								return (
									<TouchableOpacity style={[styles.pickerItem, isSelected && styles.pickerItemActive]} onPress={() => handleSelect(null)} activeOpacity={0.7}>
										<Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>None</Text>
										{isSelected && <View style={styles.checkCircle}><Icon name="checkmark" size={ms(12)} color="#fff" /></View>}
									</TouchableOpacity>
								);
							}
							const key = getKey(item);
							const label = getLabel(item);
							const isSelected = multiple ? (Array.isArray(selectedKey) && selectedKey.includes(key)) : selectedKey === key;
							return (
								<TouchableOpacity style={[styles.pickerItem, isSelected && styles.pickerItemActive]} onPress={() => handleSelect(item)} activeOpacity={0.7}>
									<Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]} numberOfLines={1}>{label}</Text>
									{isSelected && <View style={styles.checkCircle}><Icon name="checkmark" size={ms(12)} color="#fff" /></View>}
								</TouchableOpacity>
							);
						}}
						style={styles.pickerList}
						ListEmptyComponent={<View style={styles.pickerEmpty}><Text style={styles.pickerEmptyText}>No results found</Text></View>}
						contentContainerStyle={{ paddingBottom: vs(20) }}
					/>
				</View>
			</View>
		</Modal>
	);
};

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
			containerStyle={{ ...styles.inputFieldAdjust, ...(props.containerStyle || {}) }}
		/>
	</View>
);

const AddContactScreen = ({ navigation, route }) => {
	const { user } = useAuth();
	const fadeAnim = useRef(new Animated.Value(0)).current;

	// Data fetching
	const [companies, setCompanies] = useState([]);
	const [allUsers, setAllUsers] = useState([]);
	const [leadTags, setLeadTags] = useState([]);
	const [dataLoading, setDataLoading] = useState(false);

	// Form state
	const [formData, setFormData] = useState({
		firstName: '',
		lastName: '',
		email: '',
		phone: '',
		whatsapp: '',
		companyId: 'none',
		designation: '',
		tags: [],
		city: '',
		state: '',
		country: '',
		birthday: undefined,
		anniversary: undefined,
		userId: 'none',
		telesalesId: 'none',
	});

	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState({});

	// Pickers state
	const [activePicker, setActivePicker] = useState(null); // 'company', 'salesperson', 'telesales'

	// Date Pickers state
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [datePickerTarget, setDatePickerTarget] = useState(null);

	// Role helpers
	const canEditSalesperson =
		user?.role === 'boss' || user?.role === 'admin' ||
		user?.role === 'crm' || user?.role === 'manager';

	const isAdminOrBoss = user?.role === 'boss' || user?.role === 'admin' || user?.role === 'crm';
	const isManager = user?.role === 'manager';

	useEffect(() => {
		const fetchDependencies = async () => {
			setDataLoading(true);
			try {
				const promises = [
					companiesAPI.getAll({ page: 1, limit: 1000 }),
					leadTagsAPI.getAll()
				];
				if (canEditSalesperson) {
					promises.push(usersAPI.getAll({ limit: 500 }));
				}

				const results = await Promise.allSettled(promises);

				const extractArray = (res, ...paths) => {
					if (!res || res.status !== 'fulfilled' || !res.value?.success) return [];
					const data = res.value.data;
					for (const path of paths) {
						const parts = path.split('.');
						let val = data;
						for (const p of parts) val = val?.[p];
						if (Array.isArray(val)) return val;
					}
					return Array.isArray(data) ? data : [];
				};

				setCompanies(extractArray(results[0], 'companies', 'data'));
				setLeadTags(extractArray(results[1], 'tags', 'data').filter(t => t.active !== false));

				if (canEditSalesperson && results[2]) {
					setAllUsers(extractArray(results[2], 'users', 'data'));
				}

				// Default assignment
				if (!canEditSalesperson && user) {
					setFormData(prev => ({ ...prev, userId: user._id || user.id }));
				}
			} catch (err) {
				console.warn('Error fetching deps for AddContact:', err);
			} finally {
				setDataLoading(false);
			}
		};

		fetchDependencies();

		Animated.timing(fadeAnim, {
			toValue: 1,
			duration: 300,
			useNativeDriver: true,
		}).start();
	}, [canEditSalesperson, user]);

	const availableSalespersons = useMemo(() => {
		if (!canEditSalesperson) return [];
		if (isAdminOrBoss) {
			return allUsers.filter(u => u.status === 'active' && (u.role === 'sales' || u.role === 'manager'));
		} else if (isManager) {
			const managerId = user?._id || user?.id;
			return allUsers.filter(u =>
				u.status === 'active' && u.role === 'sales' &&
				(typeof u.superior === 'string' ? u.superior === managerId : u.superior?._id === managerId)
			);
		}
		return [];
	}, [allUsers, canEditSalesperson, isAdminOrBoss, isManager, user]);

	const availableTelesales = useMemo(() => {
		if (!canEditSalesperson) return [];
		if (isAdminOrBoss) {
			return allUsers.filter(u => u.status === 'active' && u.role === 'telesales');
		} else if (isManager) {
			const managerId = user?._id || user?.id;
			return allUsers.filter(u =>
				u.status === 'active' && u.role === 'telesales' &&
				Array.isArray(u.managers) &&
				u.managers.some(m => (typeof m === 'object' ? m?._id : m) === managerId)
			);
		}
		return [];
	}, [allUsers, canEditSalesperson, isAdminOrBoss, isManager, user]);

	const handleInputChange = (field, value) => {
		setFormData(prev => ({ ...prev, [field]: value }));
		if (errors[field]) {
			setErrors(prev => ({ ...prev, [field]: null }));
		}
	};

	const validateForm = () => {
		const newErrors = {};

		if (!formData.firstName.trim()) {
			newErrors.firstName = 'First name is required';
		}

		if (formData.email.trim()) {
			// const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
			// if (!emailRegex.test(formData.email)) {
			// 	newErrors.email = 'Valid email is required';
			// }
		} else {
			newErrors.email = 'Email is required';
		}

		if (!formData.phone.trim()) {
			newErrors.phone = 'Phone number is required';
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async () => {
		Keyboard.dismiss();

		if (!validateForm()) {
			showError('Validation Error', 'Please complete all required fields correctly.');
			return;
		}

		setLoading(true);
		try {
			// Process tags into array
			const tagsArray = formData.tags;

			const payload = {
				firstName: formData.firstName,
				lastName: formData.lastName || undefined,
				email: formData.email,
				phone: formData.phone,
				whatsapp: formData.whatsapp || undefined,
				companyId: formData.companyId !== 'none' ? formData.companyId : undefined,
				designation: formData.designation || undefined,
				tags: tagsArray,
				city: formData.city || undefined,
				state: formData.state || undefined,
				country: formData.country || undefined,
				birthday: formData.birthday ? formData.birthday.toISOString() : undefined,
				anniversary: formData.anniversary ? formData.anniversary.toISOString() : undefined,
			};

			// Role-based salesperson assignments matches AddLeadScreen logic
			if (canEditSalesperson) {
				if (formData.userId && formData.userId !== 'none') {
					payload.userId = formData.userId;
				}
				if (formData.telesalesId && formData.telesalesId !== 'none') {
					payload.telesalesId = formData.telesalesId;
				}
			} else {
				payload.userId = user?._id || user?.id;
			}

			const response = await contactsAPI.create(payload);

			if (response.success) {
				showSuccess('Success', 'Contact created successfully');
				route?.params?.refreshContacts?.();
				navigation.goBack();
			} else {
				showError('Error', response.error || 'Failed to create contact');
			}
		} catch (error) {
			console.error('Error creating contact:', error);
			showError('Error', 'Failed to create contact');
		} finally {
			setLoading(false);
		}
	};

	const handleDateChange = (event, date) => {
		if (Platform.OS === 'android') setShowDatePicker(false);
		if (event.type === 'dismissed' || event.type === 'set') {
			setShowDatePicker(false);
		}
		if (date && datePickerTarget) handleInputChange(datePickerTarget, date);
	};

	const openDatePicker = target => {
		setDatePickerTarget(target);
		Keyboard.dismiss();
		setShowDatePicker(true);
	};

	const formatDate = d => {
		if (!d) return null;
		return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
	};

	// UI Helpers
	const getIdFromItem = item => item?._id || item?.id || '';
	const getContactName = c => c?.name || `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || '';
	const getCompanyName = c => c?.name || '';
	const getUserLabel = u => `${u?.name || ''}${u?.email ? ` (${u.email})` : ''}`;

	const getSelectedLabel = (list, id, getLabelFn, fallback = 'Select...') => {
		if (!id || id === 'none') return fallback;
		const item = list.find(i => getIdFromItem(i) === id);
		return item ? getLabelFn(item) : fallback;
	};

	const PickerTrigger = ({ value, placeholder, onPress, icon = 'chevron-expand-outline', hasValue }) => (
		<TouchableOpacity style={styles.pickerTrigger} onPress={onPress} activeOpacity={0.7}>
			<Text style={[styles.pickerTriggerText, !hasValue && styles.pickerPlaceholder]} numberOfLines={1}>
				{hasValue ? value : placeholder}
			</Text>
			<Icon name={icon} size={ms(15)} color={Colors.textTertiary} />
		</TouchableOpacity>
	);

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
					<Icon name="arrow-back" size={ms(24)} color={Colors.black} />
				</TouchableOpacity>
				<View style={styles.headerCenter}>
					<AppText size="lg" weight="bold" numberOfLines={1} color={Colors.black}>
						Add Contact
					</AppText>
					<AppText size="xs" color={Colors.textMuted} numberOfLines={1}>
						New Contact Profile
					</AppText>
				</View>
				<TouchableOpacity
					style={[styles.saveHeaderBtn, (loading || dataLoading) && { opacity: 0.6 }]}
					onPress={handleSubmit}
					disabled={loading || dataLoading}
					activeOpacity={0.8}
				>
					<Icon name="checkmark" size={ms(18)} color={Colors.white} />
					<Text style={styles.saveHeaderBtnText}>{loading ? 'Saving...' : 'Add'}</Text>
				</TouchableOpacity>
			</View>

			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : vs(10)}
			>
				<Animated.View style={[styles.content, { opacity: fadeAnim }]}>
					<ScrollView
						style={styles.scrollView}
						contentContainerStyle={styles.scrollContent}
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
					>
						{/* Basic Information Section */}
						<View style={styles.section}>
							<SectionHeader icon="person-outline" title="Basic Information" />
							<View style={styles.row}>
								<View style={styles.halfInput}>
									<InputField
										icon="person-outline"
										label="First Name *"
										placeholder="Enter first name"
										value={formData.firstName}
										onChangeText={(value) => handleInputChange('firstName', value)}
										autoCapitalize="words"
										error={!!errors.firstName}
										errorMessage={errors.firstName}
									/>
								</View>
								<View style={styles.halfInput}>
									<InputField
										icon="person-outline"
										label="Last Name"
										placeholder="Enter last name"
										value={formData.lastName}
										onChangeText={(value) => handleInputChange('lastName', value)}
										autoCapitalize="words"
									/>
								</View>
							</View>
							<InputField
								icon="mail-outline"
								label="Email Address"
								placeholder="Enter email address"
								value={formData.email}
								onChangeText={(value) => handleInputChange('email', value)}
								keyboardType="email-address"
								autoCapitalize="none"
							/>
							<View style={styles.row}>
								<View style={styles.halfInput}>
									<InputField
										icon="call-outline"
										label="Phone *"
										placeholder="Enter phone"
										value={formData.phone}
										onChangeText={(value) => handleInputChange('phone', value)}
										keyboardType="phone-pad"
										error={!!errors.phone}
										errorMessage={errors.phone}
									/>
								</View>
								<View style={styles.halfInput}>
									<InputField
										icon="logo-whatsapp"
										label="WhatsApp"
										placeholder="Enter whatsapp"
										value={formData.whatsapp}
										onChangeText={(value) => handleInputChange('whatsapp', value)}
										keyboardType="phone-pad"
									/>
								</View>
							</View>
						</View>

						{/* Company & Role Section */}
						<View style={styles.section}>
							<SectionHeader icon="business-outline" title="Business Details" />
							<View style={styles.inputFieldContainer}>
								<Text style={styles.dropdownLabel}>Company</Text>
								<PickerTrigger
									value={getSelectedLabel(companies, formData.companyId, getCompanyName, 'Select company')}
									placeholder="Select company"
									hasValue={formData.companyId !== 'none'}
									onPress={() => setActivePicker('company')}
								/>
							</View>
							<InputField
								icon="briefcase-outline"
								label="Designation"
								placeholder="Enter job title / designation"
								value={formData.designation}
								onChangeText={(value) => handleInputChange('designation', value)}
								autoCapitalize="words"
							/>
							<View style={styles.inputFieldContainer}>
								<Text style={styles.dropdownLabel}>Tags</Text>
								<PickerTrigger
									value={formData.tags.length > 0 ? `${formData.tags.length} selected` : ''}
									placeholder="Select Tags"
									hasValue={formData.tags.length > 0}
									onPress={() => setActivePicker('tags')}
									icon="pricetags-outline"
								/>
								{formData.tags.length > 0 && (
									<View style={styles.tagsContainer}>
										{formData.tags.map(tagName => {
											const tData = leadTags.find(lt => lt.name === tagName);
											return (
												<View key={tagName} style={[styles.tagBadge, { backgroundColor: tData?.color || Colors.primary }]}>
													<Text style={styles.tagBadgeText}>{tagName}</Text>
													<TouchableOpacity onPress={() => handleInputChange('tags', formData.tags.filter(t => t !== tagName))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
														<Icon name="close" size={ms(12)} color={Colors.white} style={{ marginLeft: ms(4) }} />
													</TouchableOpacity>
												</View>
											);
										})}
									</View>
								)}
							</View>
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
							<View style={styles.row}>
								<View style={{ flex: 1 }}>
									<InputField
										icon="earth-outline"
										label="Country"
										placeholder="Enter country"
										value={formData.country}
										onChangeText={(value) => handleInputChange('country', value)}
										autoCapitalize="words"
									/>
								</View>
							</View>
						</View>

						{/* Dates Section */}
						<View style={styles.section}>
							<SectionHeader icon="calendar-outline" title="Important Dates" />
							<View style={styles.row}>
								<View style={{ flex: 1 }}>
									<Text style={styles.dropdownLabel}>Birthday</Text>
									<TouchableOpacity
										style={styles.dateTrigger}
										onPress={() => openDatePicker('birthday')}
										activeOpacity={0.7}
									>
										<Icon name="calendar-outline" size={ms(18)} color={formData.birthday ? Colors.primary : Colors.textTertiary} />
										<Text style={[styles.dateTriggerText, !formData.birthday && styles.pickerPlaceholder]}>
											{formData.birthday ? formatDate(formData.birthday) : 'Pick a date'}
										</Text>
										{formData.birthday && (
											<TouchableOpacity onPress={() => handleInputChange('birthday', undefined)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
												<Icon name="close-circle" size={ms(16)} color={Colors.textTertiary} />
											</TouchableOpacity>
										)}
									</TouchableOpacity>
								</View>
								<View style={{ flex: 1, marginLeft: Spacing.md }}>
									<Text style={styles.dropdownLabel}>Anniversary</Text>
									<TouchableOpacity
										style={styles.dateTrigger}
										onPress={() => openDatePicker('anniversary')}
										activeOpacity={0.7}
									>
										<Icon name="calendar-outline" size={ms(18)} color={formData.anniversary ? Colors.primary : Colors.textTertiary} />
										<Text style={[styles.dateTriggerText, !formData.anniversary && styles.pickerPlaceholder]}>
											{formData.anniversary ? formatDate(formData.anniversary) : 'Pick a date'}
										</Text>
										{formData.anniversary && (
											<TouchableOpacity onPress={() => handleInputChange('anniversary', undefined)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
												<Icon name="close-circle" size={ms(16)} color={Colors.textTertiary} />
											</TouchableOpacity>
										)}
									</TouchableOpacity>
								</View>
							</View>
						</View>

						{/* Assignment Section */}
						<View style={styles.section}>
							<SectionHeader icon="person-circle-outline" title="Assignment" />
							{canEditSalesperson ? (
								<>
									<View style={styles.inputFieldContainer}>
										<Text style={styles.dropdownLabel}>Salesperson</Text>
										<PickerTrigger
											value={getSelectedLabel(availableSalespersons, formData.userId, getUserLabel, 'Unassigned')}
											placeholder="Unassigned"
											hasValue={formData.userId !== 'none'}
											onPress={() => setActivePicker('salesperson')}
											icon="people-outline"
										/>
									</View>
									<View style={styles.inputFieldContainer}>
										<Text style={styles.dropdownLabel}>Telesales</Text>
										<PickerTrigger
											value={getSelectedLabel(availableTelesales, formData.telesalesId, getUserLabel, 'Unassigned')}
											placeholder="Unassigned"
											hasValue={formData.telesalesId !== 'none'}
											onPress={() => setActivePicker('telesales')}
											icon="headset-outline"
										/>
									</View>
								</>
							) : (
								<View style={styles.readOnlyField}>
									<Icon name="person-outline" size={ms(16)} color={Colors.textTertiary} />
									<Text style={styles.readOnlyText} numberOfLines={1}>
										{user?.name || user?.email || 'Current User'}
									</Text>
									<Icon name="lock-closed-outline" size={ms(14)} color={Colors.textTertiary} />
								</View>
							)}
						</View>

						<View style={styles.bottomSpacer} />
					</ScrollView>


				</Animated.View>

				{/* Date Pickers */}
				{showDatePicker && (
					<DateTimePicker
						value={formData[datePickerTarget] || new Date()}
						mode="date"
						display="default"
						onChange={handleDateChange}
					/>
				)}

				{/* Bottom Sheet Pickers */}
				<SearchablePicker
					visible={activePicker === 'company'}
					title="Select Company"
					items={companies}
					getLabel={c => c.name}
					getKey={c => c._id || c.id}
					selectedKey={formData.companyId}
					onSelect={c => {
						handleInputChange('companyId', c ? (c._id || c.id) : 'none');
						setActivePicker(null);
					}}
					onClose={() => setActivePicker(null)}
				/>

				<SearchablePicker
					visible={activePicker === 'salesperson'}
					title="Select Salesperson"
					items={availableSalespersons}
					getLabel={u => u.name || u.email}
					getKey={u => u._id || u.id}
					selectedKey={formData.userId}
					onSelect={u => {
						handleInputChange('userId', u ? (u._id || u.id) : 'none');
						setActivePicker(null);
					}}
					onClose={() => setActivePicker(null)}
				/>

				<SearchablePicker
					visible={activePicker === 'tags'}
					title="Select Tags"
					items={leadTags}
					getLabel={t => t.name}
					getKey={t => t.name}
					selectedKey={formData.tags}
					onSelect={t => handleInputChange('tags', t)}
					onClose={() => setActivePicker(null)}
					allowNone={false}
					multiple={true}
				/>

				<SearchablePicker
					visible={activePicker === 'telesales'}
					title="Select Telesales"
					items={availableTelesales}
					getLabel={u => u.name || u.email}
					getKey={u => u._id || u.id}
					selectedKey={formData.telesalesId}
					onSelect={u => {
						handleInputChange('telesalesId', u ? (u._id || u.id) : 'none');
						setActivePicker(null);
					}}
					onClose={() => setActivePicker(null)}
				/>

				<ModalLoader visible={loading} text="Saving Contact..." />
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: Colors.background },
	flex: { flex: 1 },
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
	headerCenter: { flex: 1, marginLeft: wp(3) },
	saveHeaderBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.primary,
		paddingHorizontal: ms(12),
		paddingVertical: vs(6),
		borderRadius: BorderRadius.lg,
		gap: ms(4),
	},
	saveHeaderBtnText: {
		color: Colors.white,
		fontSize: ms(14),
		fontWeight: '700',
	},
	content: { flex: 1 },
	scrollView: { flex: 1 },
	scrollContent: { paddingTop: vs(16), paddingBottom: vs(40) },
	section: {
		marginHorizontal: wp(4),
		marginBottom: vs(20),
		backgroundColor: Colors.white,
		borderRadius: BorderRadius.xl,
		padding: Spacing.lg,
		...Shadow.md,
	},
	sectionHeader: { marginBottom: vs(16) },
	sectionHeaderContent: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(8) },
	sectionTitle: { marginLeft: ms(8) },
	sectionDivider: { height: 2, backgroundColor: Colors.primary + '20', borderRadius: 1 },
	inputFieldContainer: { marginBottom: vs(16) },
	inputFieldAdjust: { marginBottom: 0 },
	row: { flexDirection: 'row', gap: Spacing.md },
	halfInput: { flex: 1 },
	dropdownLabel: {
		fontSize: ms(13),
		fontWeight: '600',
		color: Colors.textSecondary,
		marginBottom: vs(6),
		marginLeft: ms(4),
	},
	pickerTrigger: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: Colors.surface,
		borderWidth: 1,
		borderColor: Colors.border,
		borderRadius: BorderRadius.md,
		paddingHorizontal: Spacing.md,
		minHeight: vs(48),
	},
	pickerTriggerText: { flex: 1, fontSize: ms(14), color: Colors.textPrimary },
	pickerPlaceholder: { color: Colors.textTertiary },
	dateTrigger: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.surface,
		borderWidth: 1,
		borderColor: Colors.border,
		borderRadius: BorderRadius.md,
		paddingHorizontal: Spacing.md,
		minHeight: vs(48),
		gap: ms(8),
	},
	dateTriggerText: { flex: 1, fontSize: ms(14), color: Colors.textPrimary },
	tagsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: ms(8),
		marginTop: ms(8),
	},
	tagBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: ms(8),
		paddingVertical: ms(4),
		borderRadius: BorderRadius.sm,
	},
	tagBadgeText: {
		fontSize: ms(12),
		color: Colors.white,
		fontWeight: '500',
	},
	readOnlyField: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.surface,
		borderWidth: 1,
		borderColor: Colors.border,
		borderRadius: BorderRadius.md,
		paddingHorizontal: Spacing.md,
		minHeight: vs(48),
		gap: ms(8),
		opacity: 0.7,
	},
	readOnlyText: { flex: 1, fontSize: ms(14), color: Colors.textSecondary },
	bottomSpacer: { height: vs(20) },

	// Bottom Sheet Picker Styles
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'flex-end',
	},
	pickerSheet: {
		backgroundColor: Colors.white,
		borderTopLeftRadius: BorderRadius.xl,
		borderTopRightRadius: BorderRadius.xl,
		maxHeight: '80%',
		paddingBottom: Platform.OS === 'ios' ? vs(20) : Spacing.md,
	},
	handleBar: {
		width: wp(12),
		height: 5,
		backgroundColor: Colors.border,
		borderRadius: 3,
		alignSelf: 'center',
		marginTop: Spacing.sm,
		marginBottom: Spacing.xs,
	},
	pickerHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border,
	},
	pickerTitle: { fontSize: ms(16), fontWeight: '700', color: Colors.textPrimary },
	pickerCloseBtn: { padding: Spacing.xs },
	pickerSearch: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.surface,
		margin: Spacing.lg,
		paddingHorizontal: Spacing.md,
		paddingVertical: Platform.OS === 'ios' ? vs(10) : 0,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	pickerSearchInput: {
		flex: 1,
		marginLeft: Spacing.sm,
		fontSize: ms(14),
		color: Colors.textPrimary,
		minHeight: vs(40),
	},
	pickerList: {},
	pickerItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.border,
	},
	pickerItemActive: { backgroundColor: Colors.primary + '10' },
	pickerItemText: { fontSize: ms(15), color: Colors.textPrimary, flex: 1 },
	pickerItemTextActive: { color: Colors.primary, fontWeight: '600' },
	checkCircle: {
		width: ms(20),
		height: ms(20),
		borderRadius: ms(10),
		backgroundColor: Colors.primary,
		justifyContent: 'center',
		alignItems: 'center',
	},
	pickerEmpty: { alignItems: 'center', padding: Spacing.xl },
	pickerEmptyText: { marginTop: Spacing.sm, fontSize: ms(14), color: Colors.textTertiary },
});

export default AddContactScreen;
