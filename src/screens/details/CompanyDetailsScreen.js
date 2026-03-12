/**
 * CompanyDetailsScreen
 * Mobile adaptation of the website CompanyDetail.tsx.
 * - Header card: 72px building icon, company name, quick-info row (Website / Location / Industry / Owner / GSTIN)
 * - Quick-action buttons: Email, Call, WhatsApp (when company has relevant data)
 * - Animated tab bar: Overview | Contacts | Leads | Activities | Notes
 * - Overview: 3 stats cards (Contacts / Deals / Activities) + Tasks + Followups
 * - API: companiesAPI.getById (returns embedded contacts, leads, tasks, activities, followups, notes)
 * - Full pull-to-refresh, delete with confirmation, edit navigation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
	View,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Linking,
	Alert,
	ActivityIndicator,
	RefreshControl,
	Animated,
	Text,
	TextInput,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';

import AppText from '../../components/AppText';
import { DeleteConfirmationModal } from '../../components';
import { CenteredLoader } from '../../components/Loader';

import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';

import { companiesAPI, notesAPI, uploadAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { showSuccess, showError } from '../../utils';
import { ROUTES } from '../../constants';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Contacts', 'Leads', 'Activities', 'Notes', 'Documents'];

const INDUSTRY_CONFIG = {
	SaaS: { icon: 'cloud', color: '#3B82F6', bg: '#EFF6FF' },
	Finance: { icon: 'wallet', color: '#10B981', bg: '#ECFDF5' },
	Design: { icon: 'color-palette', color: '#EC4899', bg: '#FDF2F8' },
	Tech: { icon: 'hardware-chip', color: '#6366F1', bg: '#EEF2FF' },
};
function getIndustryConfig(industry) {
	return INDUSTRY_CONFIG[industry || ''] || { icon: 'business', color: '#4D8733', bg: '#EEF5E6' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
	if (!dateStr) return '–';
	const d = new Date(dateStr);
	if (isNaN(d)) return dateStr;
	return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
	if (!dateStr) return '–';
	const d = new Date(dateStr);
	if (isNaN(d)) return dateStr;
	return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
		+ ' • ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatCurrency(val, currency = 'INR') {
	if (!val && val !== 0) return '–';
	if (val >= 100000) return `₹${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 1)}L`;
	if (val >= 1000) return `₹${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}K`;
	return `₹${Number(val).toLocaleString('en-IN')}`;
}

function getInitials(name) {
	if (!name) return '?';
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name) {
	const palette = ['#4D8733', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
	if (!name) return palette[0];
	let hash = 0;
	for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
	return palette[Math.abs(hash) % palette.length];
}

function isOverdue(dueDate, status) {
	if (!dueDate || status === 'done' || status === 'completed') return false;
	return new Date(dueDate) < new Date();
}
function isToday(dueDate) {
	if (!dueDate) return false;
	return new Date(dueDate).toDateString() === new Date().toDateString();
}

/**
 * toStr — safely converts any API field value to a renderable string.
 * Handles: plain string/number, MongoDB-populated objects ({_id, name}),
 * objects with email field, null/undefined → ''.
 */
function toStr(val) {
	if (val == null) return '';
	if (typeof val === 'string') return val;
	if (typeof val === 'number') return String(val);
	if (typeof val === 'object') {
		// Populated ref: { _id, name } or { _id, name, email }
		return val.name || val.email || val.title || val._id || '';
	}
	return String(val);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * InfoRow — icon + label (fixed width) + value (right-aligned)
 */
const InfoRow = ({ label, value, icon = 'information-circle-outline', valueColor, onPress }) => {
	if (!value && value !== 0) return null;
	return (
		<TouchableOpacity
			activeOpacity={onPress ? 0.7 : 1}
			onPress={onPress}
			style={styles.infoRow}
		>
			<IonIcon name={icon} size={ms(15)} color={Colors.textTertiary} style={styles.infoRowIcon} />
			<AppText size={12} weight="semiBold" color={Colors.textTertiary} style={styles.infoRowLabel}>
				{label}
			</AppText>
			<AppText
				size={13}
				weight="medium"
				color={valueColor || Colors.textPrimary}
				style={styles.infoRowValue}
				numberOfLines={2}
			>
				{value}
			</AppText>
		</TouchableOpacity>
	);
};

/**
 * SectionCard — white card with icon + uppercase title
 */
const SectionCard = ({ icon, title, children, rightElement }) => (
	<View style={styles.sectionCard}>
		<View style={styles.sectionHeader}>
			<IonIcon name={icon} size={ms(15)} color={Colors.primary} />
			<AppText size={11} weight="bold" color={Colors.textTertiary} style={styles.sectionTitle}>
				{title?.toUpperCase()}
			</AppText>
			{rightElement && <View style={styles.sectionHeaderRight}>{rightElement}</View>}
		</View>
		{children}
	</View>
);

/**
 * StatCard — large number stat (Contacts / Deals / Activities)
 */
const StatCard = ({ icon, label, count, color }) => (
	<View style={[styles.statCard, { borderTopColor: color }]}>
		<View style={styles.statCardHeader}>
			<IonIcon name={icon} size={ms(16)} color={color} />
			<AppText size={12} weight="semiBold" color={Colors.textSecondary} style={{ marginLeft: 5 }}>
				{label}
			</AppText>
		</View>
		<AppText size={28} weight="bold" color={Colors.textPrimary} style={styles.statNumber}>
			{count ?? 0}
		</AppText>
		<AppText size={11} color={Colors.textTertiary}>Total {label.toLowerCase()}</AppText>
	</View>
);

/**
 * EmptyState — centered icon + message
 */
const EmptyState = ({ icon, title, subtitle }) => (
	<View style={styles.emptyState}>
		<View style={styles.emptyCircle}>
			<IonIcon name={icon} size={ms(32)} color={Colors.primary} />
		</View>
		<AppText size={14} weight="semiBold" color={Colors.textSecondary} style={{ marginTop: ms(12) }}>
			{title}
		</AppText>
		{subtitle ? (
			<AppText size={12} color={Colors.textTertiary} style={{ marginTop: 4, textAlign: 'center' }}>
				{subtitle}
			</AppText>
		) : null}
	</View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const CompanyDetailsScreen = ({ navigation, route }) => {
	const initialCompany = route?.params?.company;
	const companyId = route?.params?.companyId || initialCompany?._id || initialCompany?.id;

	const [company, setCompany] = useState(initialCompany || null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [activeTab, setActiveTab] = useState(0);
	const [uploading, setUploading] = useState(false);
	const [documents, setDocuments] = useState([]);

	const tabAnim = useRef(new Animated.Value(0)).current;

	const [companyNotes, setCompanyNotes] = useState([]);
	const [noteSearchQuery, setNoteSearchQuery] = useState('');
	const [newNoteText, setNewNoteText] = useState('');
	const [addingNote, setAddingNote] = useState(false);
	const [deletingNoteId, setDeletingNoteId] = useState(null);
	const [isDeleteNoteModalVisible, setIsDeleteNoteModalVisible] = useState(false);
	const [deletingNote, setDeletingNote] = useState(false);
	const [isEditingNote, setIsEditingNote] = useState(false);
	const [editingNoteId, setEditingNoteId] = useState(null);
	const [isDeleteCompanyModalVisible, setIsDeleteCompanyModalVisible] = useState(false);
	const [isDeletingCompany, setIsDeletingCompany] = useState(false);

	const { user: currentUser } = useAuth();

	// ── Derived data ──────────────────────────────────────────────────────────
	const contacts = company?.contacts || [];
	const leads = company?.leads || [];
	const tasks = company?.tasks || [];
	const activities = company?.activities || [];
	const followups = company?.followups || [];
	const notes = company?.notes || [];

	const contactsCount = company?.stats?.contactsCount ?? contacts.length;
	const dealsCount = company?.stats?.dealsCount ?? leads.length;
	const activitiesCount = company?.stats?.activitiesCount ?? activities.length;

	const ownerName = typeof company?.owner === 'object' ? company?.owner?.name : company?.owner || '';
	const location = [company?.city, company?.state, company?.country].filter(Boolean).join(', ');
	const companyEmail = company?.email || '';
	const companyPhone = company?.phone || '';
	const ic = getIndustryConfig(company?.industry);

	// ── API ───────────────────────────────────────────────────────────────────
	const fetchDocuments = useCallback(async () => {
		if (!companyId) return;
		try {
			const res = await companiesAPI.getDocuments(companyId);
			if (res.success) {
				const data = res.data?.data || res.data || {};
				const docs = data.documents || [];
				setDocuments(Array.isArray(docs) ? docs : []);
			}
		} catch (error) {
			console.error('Error fetching company documents:', error);
		}
	}, [companyId]);

	const fetchNotes = useCallback(async () => {
		if (!companyId) return;
		try {
			const res = await notesAPI.getAll({ entityType: 'company', entityId: companyId });
			if (res.success) {
				setCompanyNotes(res.data?.data || res.data || []);
			}
		} catch (error) {
			console.error('Error fetching company notes:', error);
		}
	}, [companyId]);

	const fetchCompany = useCallback(async () => {
		if (!companyId) { setLoading(false); return; }
		try {
			const res = await companiesAPI.getById(companyId);
			if (res.success) {
				const data = res.data?.data || res.data;
				if (data) {
					setCompany(data);
					if (data.documents) setDocuments(data.documents);
				}
			}
		} catch (e) {
			// keep initial data
		} finally {
			setLoading(false);
		}
	}, [companyId]);

	useEffect(() => {
		fetchCompany();
		fetchNotes();
		fetchDocuments();
	}, []);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await Promise.all([fetchCompany(), fetchNotes(), fetchDocuments()]);
		setRefreshing(false);
	}, [fetchCompany, fetchNotes, fetchDocuments]);

	// ── Handlers ─────────────────────────────────────────────────────────────
	const handleUploadDocument = () => {
		launchImageLibrary(
			{ mediaType: 'mixed', quality: 0.9, selectionLimit: 1 },
			async (response) => {
				if (response.didCancel || response.errorCode) return;
				const asset = response.assets?.[0];
				if (!asset) return;

				// Step 1: Upload file to /api/upload (field name: 'file')
				const formData = new FormData();
				formData.append('file', {
					uri: asset.uri,
					type: asset.type || 'image/jpeg',
					name: asset.fileName || `doc_${Date.now()}.jpg`,
				});

				setUploading(true);
				try {
					const uploadRes = await uploadAPI.uploadFile(formData);
					if (!uploadRes.success) {
						Alert.alert('Upload Failed', uploadRes.error || 'Could not upload file.');
						return;
					}

					// Step 2: Build document object and push to company via PUT
					const uploadData = uploadRes.data?.data || uploadRes.data || {};
					const newDoc = {
						id: uploadData.publicId || `doc_${Date.now()}`,
						name: uploadData.fileName || asset.fileName || `doc_${Date.now()}.jpg`,
						url: uploadData.fileUrl || '',
						publicId: uploadData.publicId || '',
						format: (uploadData.fileName || asset.fileName || '').split('.').pop() || '',
						size: uploadData.fileSize || asset.fileSize || 0,
						type: 'company_profile',
						createdAt: new Date().toISOString(),
					};

					const updatedDocs = [...documents, newDoc];
					const patchRes = await companiesAPI.update(companyId, { documents: updatedDocs });
					if (patchRes.success) {
						setDocuments(updatedDocs);
					} else {
						Alert.alert('Save Failed', patchRes.error || 'Could not save document to company.');
					}
				} catch (e) {
					Alert.alert('Error', 'Something went wrong during upload.');
				} finally {
					setUploading(false);
				}
			},
		);
	};

	const handleDeleteDocument = (doc) => {
		const docId = doc._id || doc.id;
		const docName = doc.name || doc.fileName || doc.originalName || 'this document';
		Alert.alert(
			'Delete Document',
			`Remove "${docName}"? This cannot be undone.`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						// Remove doc from array and PUT back to the server
						const updatedDocs = documents.filter(d => (d._id || d.id) !== docId);
						const res = await companiesAPI.update(companyId, { documents: updatedDocs });
						if (res.success) {
							setDocuments(updatedDocs);
						} else {
							Alert.alert('Error', res.error || 'Failed to delete document.');
						}
					},
				},
			],
		);
	};
	const handleTabChange = (idx) => {
		Animated.spring(tabAnim, {
			toValue: idx,
			useNativeDriver: false,
			tension: 80,
			friction: 10,
		}).start();
		setActiveTab(idx);
	};

	const handleEdit = () => {
		navigation.navigate('EditCompany', {
			company,
			refreshCompanies: route?.params?.refreshCompanies,
			onUpdate: (updatedCompany) => {
				setCompany(updatedCompany);
			}
		});
	};

	const handleDelete = () => {
		setIsDeleteCompanyModalVisible(true);
	};

	const handleConfirmDelete = async () => {
		setIsDeletingCompany(true);
		try {
			const res = await companiesAPI.delete(companyId);
			if (res.success) {
				setIsDeleteCompanyModalVisible(false);
				// Call refresh callback from parent if provided
				route?.params?.refreshCompanies?.();
				navigation.goBack();
			} else {
				showError('Error', res.error || 'Failed to delete company');
			}
		} catch {
			showError('Error', 'Failed to delete company');
		} finally {
			setIsDeletingCompany(false);
		}
	};

	const handleEmail = () => companyEmail && Linking.openURL(`mailto:${companyEmail}`);
	const handleCall = () => companyPhone && Linking.openURL(`tel:${companyPhone}`);
	const handleWhatsApp = () => {
		const phone = companyPhone.replace(/\D/g, '');
		if (phone) Linking.openURL(`https://wa.me/${phone}`);
	};

	// ── Notes Handlers ───────────────────────────────────────────────────────
	const handleAddNote = async () => {
		if (!newNoteText.trim()) return;
		setAddingNote(true);
		try {
			let res;
			if (isEditingNote && editingNoteId) {
				res = await notesAPI.update(editingNoteId, {
					content: newNoteText.trim(),
				});
			} else {
				res = await notesAPI.create({
					entityType: 'company',
					entityId: companyId,
					content: newNoteText.trim(),
				});
			}

			if (res.success) {
				setNewNoteText('');
				setIsEditingNote(false);
				setEditingNoteId(null);
				fetchNotes();
			} else {
				Alert.alert('Error', res.error || `Failed to ${isEditingNote ? 'update' : 'add'} note`);
			}
		} catch (error) {
			Alert.alert('Error', `Failed to ${isEditingNote ? 'update' : 'add'} note`);
		} finally {
			setAddingNote(false);
		}
	};

	const handleEditNote = (note) => {
		setNewNoteText(note.content);
		setIsEditingNote(true);
		setEditingNoteId(note._id || note.id);
	};

	const cancelEditingNote = () => {
		setNewNoteText('');
		setIsEditingNote(false);
		setEditingNoteId(null);
	};

	const confirmDeleteNote = async () => {
		if (!deletingNoteId) return;
		setDeletingNote(true);
		try {
			const res = await notesAPI.delete(deletingNoteId);
			if (res.success) {
				setCompanyNotes(prev => prev.filter(n => (n._id || n.id) !== deletingNoteId));
				setIsDeleteNoteModalVisible(false);
				setDeletingNoteId(null);
			} else {
				Alert.alert('Error', res.error || 'Failed to delete note');
			}
		} catch (error) {
			Alert.alert('Error', 'Failed to delete note');
		} finally {
			setDeletingNote(false);
		}
	};

	// ── Renders ───────────────────────────────────────────────────────────────

	const renderHeader = () => (
		<View style={styles.topBar}>
			{/* Back */}
			<TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
				<IonIcon name="arrow-back" size={ms(20)} color={Colors.textPrimary} />
			</TouchableOpacity>

			{/* Title */}
			<AppText size={17} weight="bold" color={Colors.textPrimary} style={styles.topBarTitle} numberOfLines={1}>
				{company?.name || 'Company Details'}
			</AppText>

			{/* Actions */}
			<View style={styles.topBarActions}>
				<TouchableOpacity style={styles.editBtn} onPress={handleEdit} activeOpacity={0.8}>
					<IonIcon name="create-outline" size={ms(18)} color={Colors.primary} />
				</TouchableOpacity>
				<TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
					<IonIcon name="trash-outline" size={ms(18)} color={Colors.danger} />
				</TouchableOpacity>
			</View>
		</View>
	);

	const renderProfileCard = () => {
		if (!company) return null;
		return (
			<View style={styles.profileCard}>
				{/* Company Icon */}
				<View style={[styles.companyIconCircle, { backgroundColor: ic.bg }]}>
					<IonIcon name={ic.icon} size={ms(36)} color={ic.color} />
				</View>

				{/* Name + industry tag */}
				<AppText size={20} weight="bold" color={Colors.textPrimary} style={styles.companyNameText} numberOfLines={2}>
					{company.name}
				</AppText>
				{company.industry ? (
					<View style={[styles.industryBadge, { backgroundColor: ic.bg }]}>
						<AppText size={11} weight="bold" color={ic.color}>{company.industry}</AppText>
					</View>
				) : null}

				{/* Quick-info row: Website / Location / Industry / Owner / GSTIN */}
				<View style={styles.quickInfoRow}>
					{company.website ? (
						<TouchableOpacity
							style={styles.quickInfoItem}
							onPress={() => Linking.openURL(`https://${company.website.replace(/^https?:\/\//, '')}`)}
						>
							<AppText size={10} color={Colors.textTertiary}>Website</AppText>
							<View style={styles.quickInfoValueRow}>
								<IonIcon name="globe-outline" size={ms(11)} color={Colors.info} />
								<AppText size={12} weight="medium" color={Colors.info} style={{ marginLeft: 3 }} numberOfLines={1}>
									{company.website.replace(/^https?:\/\//, '')}
								</AppText>
							</View>
						</TouchableOpacity>
					) : null}
					{location ? (
						<View style={styles.quickInfoItem}>
							<AppText size={10} color={Colors.textTertiary}>Location</AppText>
							<View style={styles.quickInfoValueRow}>
								<IonIcon name="location-outline" size={ms(11)} color={Colors.textSecondary} />
								<AppText size={12} weight="medium" color={Colors.textPrimary} style={{ marginLeft: 3 }} numberOfLines={1}>
									{location}
								</AppText>
							</View>
						</View>
					) : null}
					{ownerName ? (
						<View style={styles.quickInfoItem}>
							<AppText size={10} color={Colors.textTertiary}>Owner</AppText>
							<View style={styles.quickInfoValueRow}>
								<IonIcon name="person-outline" size={ms(11)} color={Colors.textSecondary} />
								<AppText size={12} weight="medium" color={Colors.textPrimary} style={{ marginLeft: 3 }} numberOfLines={1}>
									{ownerName}
								</AppText>
							</View>
						</View>
					) : null}
					{company.gstin ? (
						<View style={styles.quickInfoItem}>
							<AppText size={10} color={Colors.textTertiary}>GSTIN</AppText>
							<AppText size={12} weight="medium" color={Colors.textPrimary} numberOfLines={1}>
								{company.gstin}
							</AppText>
						</View>
					) : null}
				</View>

				{/* Quick-action buttons */}
				<View style={styles.actionRow}>
					{companyEmail ? (
						<TouchableOpacity style={styles.actionBtn} onPress={handleEmail}>
							<View style={[styles.actionIconCircle, { backgroundColor: '#EFF6FF' }]}>
								<IonIcon name="mail" size={ms(20)} color="#3B82F6" />
							</View>
							<AppText size={11} weight="semiBold" color={Colors.textSecondary} style={{ marginTop: 4 }}>
								Email
							</AppText>
						</TouchableOpacity>
					) : null}
					{companyPhone ? (
						<TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
							<View style={[styles.actionIconCircle, { backgroundColor: '#EEF5E6' }]}>
								<IonIcon name="call" size={ms(20)} color={Colors.primary} />
							</View>
							<AppText size={11} weight="semiBold" color={Colors.textSecondary} style={{ marginTop: 4 }}>
								Call
							</AppText>
						</TouchableOpacity>
					) : null}
					{companyPhone ? (
						<TouchableOpacity style={styles.actionBtn} onPress={handleWhatsApp}>
							<View style={[styles.actionIconCircle, { backgroundColor: '#F0FDF4' }]}>
								<IonIcon name="logo-whatsapp" size={ms(20)} color="#25D366" />
							</View>
							<AppText size={11} weight="semiBold" color={Colors.textSecondary} style={{ marginTop: 4 }}>
								WhatsApp
							</AppText>
						</TouchableOpacity>
					) : null}
				</View>
			</View>
		);
	};

	const renderTabs = () => {
		return (
			<View style={styles.tabContainer}>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.tabBarScrollContent}
				>
					{TABS.map((tab, idx) => {
						const isActive = activeTab === idx;
						return (
							<TouchableOpacity
								key={tab}
								style={[styles.tabItem, isActive && styles.tabItemActive]}
								onPress={() => handleTabChange(idx)}
								activeOpacity={0.7}
							>
								<AppText
									size={13}
									weight={isActive ? 'bold' : 'semiBold'}
									color={isActive ? Colors.primary : Colors.textTertiary}
								>
									{tab}
								</AppText>
								{isActive && <View style={styles.tabActiveLine} />}
							</TouchableOpacity>
						);
					})}
				</ScrollView>
			</View>
		);
	};

	// ── Overview Tab ─────────────────────────────────────────────────────────
	const renderOverview = () => (
		<View>
			{/* Stats cards */}
			<View style={styles.statsRow}>
				<StatCard icon="people-outline" label="Contacts" count={contactsCount} color="#3B82F6" />
				<StatCard icon="cash-outline" label="Deals" count={dealsCount} color="#10B981" />
				<StatCard icon="pulse-outline" label="Activities" count={activitiesCount} color="#8B5CF6" />
			</View>

			{/* Company Info */}
			<SectionCard icon="business-outline" title="Company Info">
				<InfoRow icon="mail-outline" label="Email" value={companyEmail} onPress={handleEmail} valueColor={Colors.info} />
				<InfoRow icon="call-outline" label="Phone" value={companyPhone} onPress={handleCall} valueColor={Colors.info} />
				<InfoRow icon="globe-outline" label="Website" value={toStr(company?.website)} />
				<InfoRow icon="location-outline" label="Address" value={toStr(company?.address)} />
				<InfoRow icon="business-outline" label="Industry" value={toStr(company?.industry)} />
				<InfoRow icon="map-outline" label="City" value={toStr(company?.city)} />
				<InfoRow icon="map-outline" label="State" value={toStr(company?.state)} />
				<InfoRow icon="globe-outline" label="Country" value={toStr(company?.country)} />
				<InfoRow icon="pin-outline" label="Pincode" value={toStr(company?.pincode)} />
				<InfoRow icon="document-text-outline" label="GSTIN" value={toStr(company?.gstin)} />
				<InfoRow icon="person-circle-outline" label="Owner" value={toStr(company?.owner)} />
				<InfoRow icon="people-outline" label="Salesperson" value={toStr(company?.salesperson)} />
				<InfoRow icon="calendar-outline" label="Created" value={formatDate(company?.createdAt)} />
			</SectionCard>

			{/* Followups */}
			{followups.length > 0 ? (
				<SectionCard icon="time-outline" title={`Followups (${followups.length})`}>
					{followups.map((f, i) => {
						const dueDate = f.dueDate || f.dueAt;
						const over = isOverdue(dueDate, f.status);
						const today = isToday(dueDate);
						return (
							<View key={f._id || f.id || i} style={styles.followupItem}>
								<View style={styles.followupMeta}>
									<AppText size={13} weight="semiBold" color={Colors.textPrimary} style={{ flex: 1 }}>
										{f.title}
									</AppText>
									<View style={[
										styles.priorityBadge,
										over ? { backgroundColor: '#FEF2F2' } :
											today ? { backgroundColor: '#FFFBEB' } :
												{ backgroundColor: Colors.primaryBackground },
									]}>
										<AppText size={10} weight="bold" color={over ? Colors.danger : today ? '#F59E0B' : Colors.primary}>
											{over ? 'Overdue' : today ? 'Due Today' : f.priority || 'normal'}
										</AppText>
									</View>
								</View>
								{f.description ? (
									<AppText size={11} color={Colors.textTertiary} style={{ marginTop: 3 }} numberOfLines={2}>
										{f.description}
									</AppText>
								) : null}
								<AppText size={11} color={Colors.textTertiary} style={{ marginTop: 4 }}>
									{dueDate ? formatDateTime(dueDate) : 'No date'}
								</AppText>
							</View>
						);
					})}
				</SectionCard>
			) : null}

			{/* Tasks */}
			<SectionCard icon="checkbox-outline" title="Tasks">
				{tasks.length > 0 ? tasks.map((task, i) => (
					<View key={task._id || task.id || i} style={styles.taskItem}>
						<IonIcon
							name={task.status === 'done' || task.status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
							size={ms(18)}
							color={task.status === 'done' || task.status === 'completed' ? Colors.primary : Colors.textTertiary}
						/>
						<View style={{ flex: 1, marginLeft: ms(10) }}>
							<AppText
								size={13}
								weight="semiBold"
								color={task.status === 'done' ? Colors.textTertiary : Colors.textPrimary}
								style={task.status === 'done' ? styles.taskDone : null}
							>
								{task.title}
							</AppText>
							{task.dueDate ? (
								<AppText size={11} color={Colors.textTertiary} style={{ marginTop: 2 }}>
									Due: {formatDate(task.dueDate)}
								</AppText>
							) : null}
						</View>
						<View style={[
							styles.taskStatusBadge,
							{ backgroundColor: task.status === 'done' ? '#EEF5E6' : '#FFFBEB' },
						]}>
							<AppText size={10} weight="bold" color={task.status === 'done' ? Colors.primary : '#F59E0B'}>
								{task.status || 'pending'}
							</AppText>
						</View>
					</View>
				)) : (
					<EmptyState
						icon="checkbox-outline"
						title="No tasks for this company"
						subtitle="Add a task"
					/>
				)}
			</SectionCard>
		</View>
	);

	// ── Contacts Tab ─────────────────────────────────────────────────────────
	const renderContacts = () => (
		<SectionCard icon="people-outline" title={`Contacts (${contacts.length})`}>
			{contacts.length > 0 ? contacts.map((c, i) => {
				const name = c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown';
				const initials = getInitials(name);
				const bgColor = getAvatarColor(name);
				const phone = c.phone || c.mobile;
				const waUrl = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null;
				return (
					<View key={c._id || c.id || i} style={styles.contactItem}>
						<View style={[styles.contactAvatar, { backgroundColor: bgColor }]}>
							<AppText size={14} weight="bold" color="#fff">{initials}</AppText>
						</View>
						<View style={{ flex: 1, marginLeft: ms(10) }}>
							<AppText size={13} weight="semiBold" color={Colors.textPrimary}>{name}</AppText>
							<AppText size={11} color={Colors.textTertiary}>
								{c.email || phone || '-'}
							</AppText>
							{c.designation ? (
								<AppText size={11} color={Colors.textTertiary}>{c.designation}</AppText>
							) : null}
						</View>
						<View style={styles.contactActions}>
							{c.email ? (
								<TouchableOpacity
									style={styles.contactActionBtn}
									onPress={() => Linking.openURL(`mailto:${c.email}`)}
								>
									<IonIcon name="mail-outline" size={ms(16)} color={Colors.info} />
								</TouchableOpacity>
							) : null}
							{phone ? (
								<TouchableOpacity
									style={styles.contactActionBtn}
									onPress={() => Linking.openURL(`tel:${phone}`)}
								>
									<IonIcon name="call-outline" size={ms(16)} color={Colors.primary} />
								</TouchableOpacity>
							) : null}
							{waUrl ? (
								<TouchableOpacity
									style={styles.contactActionBtn}
									onPress={() => Linking.openURL(waUrl)}
								>
									<IonIcon name="logo-whatsapp" size={ms(16)} color="#25D366" />
								</TouchableOpacity>
							) : null}
						</View>
					</View>
				);
			}) : (
				<EmptyState
					icon="people-outline"
					title="No contacts associated"
					subtitle="Contacts linked to this company will appear here"
				/>
			)}
		</SectionCard>
	);

	// ── Leads Tab ────────────────────────────────────────────────────────────
	const renderLeads = () => (
		<SectionCard icon="cash-outline" title={`Leads / Deals (${leads.length})`}>
			{leads.length > 0 ? leads.map((lead, i) => {
				const stageName = typeof lead.stage === 'object' ? lead.stage?.name : lead.stage;
				const contactName = lead.contact?.name ||
					(lead.contact?.firstName ? `${lead.contact.firstName} ${lead.contact.lastName || ''}`.trim() : '');
				const value = lead.value ? formatCurrency(lead.value, lead.currency) : null;
				return (
					<TouchableOpacity
						key={lead._id || lead.id || i}
						style={styles.leadItem}
						onPress={() => navigation.navigate('LeadDetails', { leadId: lead._id || lead.id, lead })}
						activeOpacity={0.75}
					>
						<View style={{ flex: 1 }}>
							<AppText size={13} weight="semiBold" color={Colors.textPrimary} numberOfLines={1}>
								{lead.title || 'Untitled Lead'}
							</AppText>
							<View style={styles.leadMeta}>
								{contactName ? (
									<AppText size={11} color={Colors.textTertiary}>Contact: {contactName}</AppText>
								) : null}
								{stageName ? (
									<AppText size={11} color={Colors.textTertiary} style={{ marginLeft: 8 }}>
										Stage: {stageName}
									</AppText>
								) : null}
								{value ? (
									<AppText size={11} color="#059669" style={{ marginLeft: 8 }}>
										{value}
									</AppText>
								) : null}
							</View>
						</View>
						<View style={[
							styles.leadStatusBadge,
							{ backgroundColor: lead.status === 'Open' ? '#EEF5E6' : '#F3F4F6' },
						]}>
							<AppText size={10} weight="bold" color={lead.status === 'Open' ? Colors.primary : Colors.textTertiary}>
								{lead.status || 'Open'}
							</AppText>
						</View>
						<IonIcon name="chevron-forward" size={ms(16)} color={Colors.textTertiary} style={{ marginLeft: 6 }} />
					</TouchableOpacity>
				);
			}) : (
				<EmptyState
					icon="cash-outline"
					title="No deals associated"
					subtitle="Leads linked to this company will appear here"
				/>
			)}
		</SectionCard>
	);

	// ── Activities Tab ────────────────────────────────────────────────────────
	const renderActivities = () => {
		const ACTIVITY_STYLE = {
			call: { icon: 'call', color: '#4D8733', bg: '#EEF5E6' },
			email: { icon: 'mail', color: '#3B82F6', bg: '#EFF6FF' },
			meeting: { icon: 'calendar', color: '#8B5CF6', bg: '#F5F3FF' },
			note: { icon: 'document-text', color: '#F59E0B', bg: '#FFFBEB' },
			whatsapp: { icon: 'logo-whatsapp', color: '#25D366', bg: '#F0FDF4' },
			task: { icon: 'checkmark-circle', color: '#EC4899', bg: '#FDF2F8' },
		};
		return (
			<SectionCard icon="pulse-outline" title={`Activities (${activities.length})`}>
				{activities.length > 0 ? activities.map((act, i) => {
					const s = ACTIVITY_STYLE[(act.type || '').toLowerCase()] ||
						{ icon: 'time', color: '#9CA3AF', bg: '#F3F4F6' };
					return (
						<View key={act._id || act.id || i} style={styles.activityItem}>
							<View style={[styles.activityIcon, { backgroundColor: s.bg }]}>
								<IonIcon name={s.icon} size={ms(16)} color={s.color} />
							</View>
							<View style={{ flex: 1, marginLeft: ms(10) }}>
								<AppText size={13} weight="semiBold" color={Colors.textPrimary}>
									{act.title || act.description || act.type || 'Activity'}
								</AppText>
								{act.description && act.description !== act.title ? (
									<AppText size={11} color={Colors.textTertiary} numberOfLines={2} style={{ marginTop: 2 }}>
										{act.description}
									</AppText>
								) : null}
								<AppText size={11} color={Colors.textTertiary} style={{ marginTop: 3 }}>
									{formatDate(act.createdAt || act.date)}
								</AppText>
							</View>
						</View>
					);
				}) : (
					<EmptyState
						icon="pulse-outline"
						title="No activities yet"
						subtitle="Activities related to this company will appear here"
					/>
				)}
			</SectionCard>
		);
	};

	const renderNotes = () => {
		const filteredNotes = (companyNotes || []).filter(note => {
			const noteContent = (note.content || '').toLowerCase();

			// Robust creator name resolution
			let creatorName = 'Unknown User';
			if (typeof note.createdBy === 'object' && note.createdBy?.name) {
				creatorName = note.createdBy.name;
			} else {
				const creatorId = typeof note.createdBy === 'object' ? (note.createdBy?._id || note.createdBy?.id) : note.createdBy;
				const currentUserId = currentUser?._id || currentUser?.id;
				if (creatorId && currentUserId && creatorId === currentUserId) {
					creatorName = currentUser?.name || 'You';
				}
			}

			const query = noteSearchQuery.toLowerCase();
			return noteContent.includes(query) || creatorName.toLowerCase().includes(query);
		});

		return (
			<View style={styles.notesContainer}>
				{/* Notes Header with Search */}
				<View style={styles.notesHeader}>
					<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
						<AppText size={18} weight="semiBold" color={Colors.textPrimary} style={{ marginLeft: ms(4) }}>
							Internal Notes
						</AppText>
						<TouchableOpacity style={{ marginLeft: 6 }}>
							<IonIcon name="information-circle-outline" size={20} color={Colors.textTertiary} />
						</TouchableOpacity>
					</View>
				</View>
				<View style={styles.noteSearchContainer}>
					<IonIcon name="search-outline" size={ms(18)} color={Colors.textTertiary} style={{ marginRight: 6 }} />
					<TextInput
						style={styles.noteSearchInput}
						placeholder="Search notes..."
						placeholderTextColor={Colors.textTertiary}
						value={noteSearchQuery}
						onChangeText={setNoteSearchQuery}
					/>
				</View>

				{/* Add Note Input Area */}
				<View style={styles.addNoteCard}>
					<View style={{ flexDirection: 'row' }}>
						<View style={[styles.noteAvatarCircle, { backgroundColor: Colors.primaryBackground }]}>
							<AppText size={14} weight="medium" color={Colors.primary}>
								{getInitials(currentUser?.name)}
							</AppText>
						</View>
						<View style={styles.noteInputWrapper}>
							<TextInput
								style={styles.noteTextInput}
								placeholder="Write a note..."
								placeholderTextColor={Colors.textTertiary}
								multiline
								value={newNoteText}
								onChangeText={setNewNoteText}
							/>
						</View>
					</View>
					<View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
						{isEditingNote && (
							<TouchableOpacity
								style={[styles.cancelNoteBtn, { marginRight: 8 }]}
								onPress={cancelEditingNote}
							>
								<AppText color={Colors.textSecondary} weight="semiBold">Cancel</AppText>
							</TouchableOpacity>
						)}
						<TouchableOpacity
							style={[styles.addNoteBtn, (!newNoteText.trim() || addingNote) && { opacity: 0.6 }]}
							onPress={handleAddNote}
							disabled={!newNoteText.trim() || addingNote}
						>
							{addingNote ? (
								<ActivityIndicator size="small" color={Colors.white} />
							) : (
								<>
									<IonIcon name={isEditingNote ? "save-outline" : "send"} size={14} color={Colors.white} style={{ marginRight: 8 }} />
									<AppText color={Colors.white} weight="semiBold">{isEditingNote ? 'Update' : 'Add'}</AppText>
								</>
							)}
						</TouchableOpacity>
					</View>
				</View>

				{/* Notes List */}
				{filteredNotes.length > 0 ? (
					filteredNotes.map((note) => (
						<View key={note._id || note.id} style={styles.noteItemCard}>
							<View style={{ flexDirection: 'row' }}>
								<View style={[styles.noteAvatarCircle, { backgroundColor: Colors.primaryBackground }]}>
									<AppText size={14} weight="medium" color={Colors.primary}>
										{(() => {
											let name = '';
											if (typeof note.createdBy === 'object' && note.createdBy?.name) {
												name = note.createdBy.name;
											} else {
												const creatorId = typeof note.createdBy === 'object' ? (note.createdBy?._id || note.createdBy?.id) : note.createdBy;
												const currentUserId = currentUser?._id || currentUser?.id;
												if (creatorId && currentUserId && creatorId === currentUserId) {
													name = currentUser?.name || '';
												}
											}
											return getInitials(name);
										})()}
									</AppText>
								</View>
								<View style={{ flex: 1, marginLeft: 12 }}>
									<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
										<View>
											<AppText weight="semiBold" color={Colors.textPrimary}>
												{(() => {
													if (typeof note.createdBy === 'object' && note.createdBy?.name) {
														return note.createdBy.name;
													} else {
														const creatorId = typeof note.createdBy === 'object' ? (note.createdBy?._id || note.createdBy?.id) : note.createdBy;
														const currentUserId = currentUser?._id || currentUser?.id;
														if (creatorId && currentUserId && creatorId === currentUserId) {
															return currentUser?.name || 'You';
														}
													}
													return 'Unknown User';
												})()}
											</AppText>
											<AppText size={12} color={Colors.textTertiary}>
												{formatDateTime(note.createdAt)}
											</AppText>
										</View>
										<View style={{ flexDirection: 'row' }}>
											<TouchableOpacity
												style={{ padding: 4 }}
												onPress={() => handleEditNote(note)}
											>
												<IonIcon name="pencil-outline" size={18} color={Colors.textPrimary} />
											</TouchableOpacity>
											<TouchableOpacity
												style={{ padding: 4, marginLeft: 12 }}
												onPress={() => {
													setDeletingNoteId(note._id || note.id);
													setIsDeleteNoteModalVisible(true);
												}}
											>
												<IonIcon name="trash-outline" size={18} color={Colors.error} />
											</TouchableOpacity>
										</View>
									</View>
									<AppText size={14} color={Colors.textPrimary} style={{ marginTop: 12, lineHeight: 20 }}>
										{note.content}
									</AppText>
								</View>
							</View>
						</View>
					))
				) : (
					<EmptyState
						icon="chatbubble-outline"
						title={noteSearchQuery ? "No matching notes" : "No notes yet"}
						subtitle={noteSearchQuery ? "Try a different search term" : "Internal notes will appear here"}
					/>
				)}

				<DeleteConfirmationModal
					visible={isDeleteNoteModalVisible}
					onCancel={() => {
						setIsDeleteNoteModalVisible(false);
						setDeletingNoteId(null);
					}}
					onDelete={confirmDeleteNote}
					loading={deletingNote}
					title="Delete Note"
					message="Are you sure you want to delete this note? This action cannot be undone."
				/>
			</View>
		);
	};

	// ── Documents Tab ─────────────────────────────────────────────────
	const DOC_ICONS = {
		pdf: { icon: 'document-text', color: '#EF4444', bg: '#FEF2F2' },
		doc: { icon: 'document', color: '#3B82F6', bg: '#EFF6FF' },
		docx: { icon: 'document', color: '#3B82F6', bg: '#EFF6FF' },
		xls: { icon: 'grid', color: '#10B981', bg: '#ECFDF5' },
		xlsx: { icon: 'grid', color: '#10B981', bg: '#ECFDF5' },
		png: { icon: 'image', color: '#8B5CF6', bg: '#F5F3FF' },
		jpg: { icon: 'image', color: '#8B5CF6', bg: '#F5F3FF' },
		jpeg: { icon: 'image', color: '#8B5CF6', bg: '#F5F3FF' },
	};

	const renderDocuments = () => (
		<SectionCard icon="folder-outline" title={`Documents (${documents.length})`}>
			{/* Upload button */}
			<TouchableOpacity
				style={styles.uploadBtn}
				onPress={handleUploadDocument}
				activeOpacity={0.8}
				disabled={uploading}
			>
				{uploading ? (
					<ActivityIndicator size="small" color="#fff" />
				) : (
					<IonIcon name="cloud-upload-outline" size={ms(16)} color="#fff" />
				)}
				<AppText size={13} weight="semiBold" color="#fff" style={{ marginLeft: ms(6) }}>
					{uploading ? 'Uploading…' : 'Upload Document'}
				</AppText>
			</TouchableOpacity>

			{/* Document list */}
			{documents.length > 0 ? documents.map((doc, i) => {
				const ext = (doc.name || doc.fileName || doc.originalName || '').split('.').pop()?.toLowerCase();
				const ds = DOC_ICONS[ext] || { icon: 'document-attach', color: '#6B7280', bg: '#F3F4F6' };
				const name = doc.name || doc.fileName || doc.originalName || 'Document';
				const url = doc.url || doc.fileUrl || doc.path;
				return (
					<View key={doc._id || doc.id || i} style={styles.docItem}>
						<TouchableOpacity
							style={styles.docItemInner}
							onPress={() => url && Linking.openURL(url)}
							activeOpacity={url ? 0.75 : 1}
							disabled={!url}
						>
							<View style={[styles.docIconBox, { backgroundColor: ds.bg }]}>
								<IonIcon name={ds.icon} size={ms(18)} color={ds.color} />
							</View>
							<View style={{ flex: 1, marginLeft: ms(10) }}>
								<AppText size={13} weight="semiBold" color={Colors.textPrimary} numberOfLines={1}>
									{name}
								</AppText>
								<AppText size={11} color={Colors.textTertiary} style={{ marginTop: 2 }}>
									{ext?.toUpperCase() || 'File'} · {formatDate(doc.createdAt || doc.uploadedAt)}
								</AppText>
							</View>
							{url ? <IonIcon name="open-outline" size={ms(15)} color={Colors.info} style={{ marginLeft: ms(6) }} /> : null}
						</TouchableOpacity>
						{/* Delete button */}
						<TouchableOpacity
							style={styles.docDeleteBtn}
							onPress={() => handleDeleteDocument(doc)}
							activeOpacity={0.7}
						>
							<IonIcon name="trash-outline" size={ms(16)} color={Colors.danger} />
						</TouchableOpacity>
					</View>
				);
			}) : (
				<EmptyState
					icon="folder-open-outline"
					title="No documents yet"
					subtitle="Tap 'Upload Document' above to add one"
				/>
			)}
		</SectionCard>
	);

	const renderTabContent = () => {
		switch (activeTab) {
			case 0: return renderOverview();
			case 1: return renderContacts();
			case 2: return renderLeads();
			case 3: return renderActivities();
			case 4: return renderNotes();
			case 5: return renderDocuments();
			default: return null;
		}
	};

	// ─────────────────────────────────────────────────────────────────────────
	if (loading) return <CenteredLoader />;

	if (!company) {
		return (
			<SafeAreaView style={styles.container} edges={['top']}>
				{renderHeader()}
				<View style={styles.centered}>
					<IonIcon name="business-outline" size={ms(60)} color={Colors.textTertiary} />
					<AppText size={16} weight="semiBold" color={Colors.textTertiary} style={{ marginTop: ms(16) }}>
						Company not found
					</AppText>
					<TouchableOpacity
						style={styles.backBtn2}
						onPress={() => navigation.goBack()}
					>
						<AppText size={14} weight="bold" color={Colors.primary}>Go Back</AppText>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			{renderHeader()}
			<ScrollView
				showsVerticalScrollIndicator={false}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
				contentContainerStyle={styles.scrollContent}
			>
				{/* Profile / Header Card */}
				{renderProfileCard()}

				{/* Tab Bar */}
				<View style={styles.tabsCard}>
					{renderTabs()}
					<View style={styles.tabContent}>
						{renderTabContent()}
					</View>
				</View>

				<View style={{ height: vs(40) }} />
			</ScrollView>

			<DeleteConfirmationModal
				visible={isDeleteCompanyModalVisible}
				onCancel={() => setIsDeleteCompanyModalVisible(false)}
				onDelete={handleConfirmDelete}
				title="Delete Company"
				message={`Are you sure you want to remove "${company?.name}"? This action cannot be undone.`}
				loading={isDeletingCompany}
			/>
		</SafeAreaView>
	);
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: Colors.background },
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
	scrollContent: {
		paddingBottom: vs(20),
		paddingHorizontal: ms(16),
		paddingTop: ms(12),
		gap: ms(12),
	},

	// ─ Top Bar ─
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: ms(16),
		paddingVertical: ms(10),
		backgroundColor: Colors.surface,
		borderBottomWidth: 1,
		borderBottomColor: Colors.surfaceBorder,
	},
	backBtn: {
		width: ms(36),
		height: ms(36),
		borderRadius: ms(18),
		backgroundColor: Colors.background,
		justifyContent: 'center',
		alignItems: 'center',
		...Shadow.sm,
	},
	topBarTitle: { flex: 1, marginLeft: ms(10), marginRight: ms(8) },
	topBarActions: { flexDirection: 'row', gap: ms(8) },
	editBtn: {
		width: ms(36), height: ms(36), borderRadius: ms(10),
		backgroundColor: Colors.primaryBackground,
		justifyContent: 'center', alignItems: 'center',
	},
	deleteBtn: {
		width: ms(36), height: ms(36), borderRadius: ms(10),
		backgroundColor: '#FEF2F2',
		justifyContent: 'center', alignItems: 'center',
	},
	backBtn2: {
		marginTop: ms(16),
		paddingHorizontal: ms(24),
		paddingVertical: ms(10),
		backgroundColor: Colors.primaryBackground,
		borderRadius: ms(12),
	},

	// ─ Profile Card ─
	profileCard: {
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.xl,
		padding: ms(20),
		alignItems: 'center',
		...Shadow.sm,
	},
	companyIconCircle: {
		width: ms(72),
		height: ms(72),
		borderRadius: ms(20),
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: ms(12),
	},
	companyNameText: { textAlign: 'center', marginBottom: ms(6) },
	industryBadge: {
		paddingHorizontal: ms(12), paddingVertical: ms(4),
		borderRadius: ms(20), marginBottom: ms(12),
	},

	// Quick info
	quickInfoRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: ms(12),
		justifyContent: 'center',
		marginTop: ms(4),
		marginBottom: ms(12),
		width: '100%',
	},
	quickInfoItem: { alignItems: 'center', minWidth: ms(80) },
	quickInfoValueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },

	// Action row
	actionRow: {
		flexDirection: 'row',
		gap: ms(24),
		marginTop: ms(8),
		paddingTop: ms(12),
		borderTopWidth: 1,
		borderTopColor: Colors.divider,
		width: '100%',
		justifyContent: 'center',
	},
	actionBtn: { alignItems: 'center' },
	actionIconCircle: {
		width: ms(44), height: ms(44), borderRadius: ms(22),
		justifyContent: 'center', alignItems: 'center',
	},

	// ─ InfoRow ─
	infoRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		paddingVertical: ms(8),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	infoRowIcon: { width: ms(22), marginTop: ms(1) },
	infoRowLabel: { width: ms(90) },
	infoRowValue: { flex: 1, textAlign: 'right' },

	// ─ Section Card ─
	sectionCard: {
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.xl,
		padding: ms(16),
		marginTop: ms(16),
		...Shadow.sm,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: ms(6),
		marginBottom: ms(12),
	},
	sectionTitle: { flex: 1, letterSpacing: 0.6, marginLeft: ms(2) },
	sectionHeaderRight: { marginLeft: 'auto' },

	// ─ Stats ─
	statsRow: {
		flexDirection: 'row',
		gap: ms(10),
	},
	statCard: {
		flex: 1,
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.lg,
		padding: ms(14),
		borderTopWidth: ms(3),
		...Shadow.sm,
	},
	statCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: ms(6) },
	statNumber: { marginVertical: ms(4) },

	// ─ Contact items ─
	contactItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	contactAvatar: {
		width: ms(40), height: ms(40), borderRadius: ms(20),
		justifyContent: 'center', alignItems: 'center',
	},
	contactActions: { flexDirection: 'row', gap: ms(6) },
	contactActionBtn: {
		width: ms(32), height: ms(32), borderRadius: ms(8),
		backgroundColor: Colors.background,
		justifyContent: 'center', alignItems: 'center',
	},

	// ─ Lead items ─
	leadItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	leadMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: ms(3) },
	leadStatusBadge: {
		paddingHorizontal: ms(8), paddingVertical: ms(3),
		borderRadius: ms(10), marginLeft: ms(6),
	},

	// ─ Activity items ─
	activityItem: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	activityIcon: {
		width: ms(36), height: ms(36), borderRadius: ms(10),
		justifyContent: 'center', alignItems: 'center',
	},

	// ─ Notes ─
	notesContainer: {
		paddingBottom: 20,
	},
	notesHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 16,
		marginTop: 8,
	},
	noteSearchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		width: '100%',
		backgroundColor: '#F3F4F6',
		borderRadius: 8,
		paddingHorizontal: 10,
		marginBottom: 10,
		height: 40,
	},
	noteSearchInput: {
		flex: 1,
		fontSize: 13,
		color: Colors.textPrimary,
		padding: 0,
	},
	addNoteCard: {
		backgroundColor: Colors.white,
		borderRadius: 12,
		padding: 16,
		borderWidth: 1,
		borderColor: Colors.border,
		marginBottom: 16,
		...Shadow.small,
	},
	noteAvatarCircle: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#E8F5E9',
		alignItems: 'center',
		justifyContent: 'center',
	},
	noteInputWrapper: {
		flex: 1,
		marginLeft: 12,
		backgroundColor: '#F9FAFB',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: Colors.border,
		minHeight: 80,
	},
	noteTextInput: {
		padding: 12,
		fontSize: 14,
		color: Colors.textPrimary,
		textAlignVertical: 'top',
	},
	addNoteBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.primary,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 8,
	},
	cancelNoteBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#F3F4F6',
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	noteItemCard: {
		backgroundColor: Colors.white,
		borderRadius: 12,
		padding: 16,
		borderWidth: 1,
		borderColor: Colors.border,
		marginBottom: 12,
		...Shadow.small,
	},

	// ─ Task items ─
	taskItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	taskDone: { textDecorationLine: 'line-through' },
	taskStatusBadge: {
		paddingHorizontal: ms(8), paddingVertical: ms(3),
		borderRadius: ms(10),
	},

	// ─ Followup items ─
	followupItem: {
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	followupMeta: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
	priorityBadge: {
		paddingHorizontal: ms(8), paddingVertical: ms(3),
		borderRadius: ms(10),
	},

	// ─ Tabs ─
	tabsCard: {
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.xl,
		overflow: 'hidden',
		...Shadow.sm,
		marginTop: ms(4),
	},
	tabContainer: {
		backgroundColor: Colors.surface,
		borderBottomWidth: 1,
		borderBottomColor: Colors.divider,
	},
	tabBarScrollContent: {
		paddingHorizontal: ms(12),
	},
	tabItem: {
		paddingHorizontal: ms(16),
		paddingVertical: ms(14),
		justifyContent: 'center',
		alignItems: 'center',
		position: 'relative',
	},
	tabItemActive: {
		// optional: background subtle color or just the line
	},
	tabActiveLine: {
		position: 'absolute',
		bottom: 0,
		left: ms(16),
		right: ms(16),
		height: ms(3),
		backgroundColor: Colors.primary,
		borderTopLeftRadius: ms(3),
		borderTopRightRadius: ms(3),
	},
	tabContent: { padding: ms(16) },

	// ─ Empty State ─
	emptyState: { alignItems: 'center', paddingVertical: ms(32) },
	emptyCircle: {
		width: ms(64), height: ms(64), borderRadius: ms(32),
		backgroundColor: Colors.primaryBackground,
		justifyContent: 'center', alignItems: 'center',
	},

	// ─ Documents ─
	uploadBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: Colors.primary,
		borderRadius: ms(8),
		paddingVertical: ms(10),
		paddingHorizontal: ms(16),
		marginBottom: ms(16),
	},
	docItem: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.surface || '#F8F8F8',
		borderRadius: ms(10),
		paddingVertical: ms(8),
		paddingHorizontal: ms(10),
		marginBottom: ms(10),
		borderWidth: 1,
		borderColor: Colors.border || '#E5E7EB',
	},
	docItemInner: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	docIconBox: {
		width: ms(40),
		height: ms(40),
		borderRadius: ms(8),
		alignItems: 'center',
		justifyContent: 'center',
	},
	docDeleteBtn: {
		padding: ms(8),
		marginLeft: ms(4),
	},
});

export default CompanyDetailsScreen;
