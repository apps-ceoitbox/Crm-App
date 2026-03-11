/**
 * ContactDetailsScreen
 * Mobile adaptation of the website ContactDetail.tsx.
 * - Profile card: 72px avatar (initials), name, quick-info list
 *   (email / phone / whatsapp / company / designation / location / owner / birthday / anniversary)
 * - Tags row at the bottom of profile card
 * - Quick Actions: Send Email, Log Call, WhatsApp
 * - Animated tab bar: Activities | Notes | Leads
 * - Tasks section + Followups section
 * - API: contactsAPI.getById (embedded leads, tasks, activities, followups, notes)
 * - Pull-to-refresh, delete with confirm, edit navigation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
	View,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Linking,
	Alert,
	RefreshControl,
	Animated,
	ActivityIndicator,
	TextInput,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';

import { CenteredLoader } from '../../components/Loader';
import { AppText, DeleteConfirmationModal } from '../../components';

import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, hs } from '../../utils/Responsive';

import { contactsAPI, notesAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ['Activities', 'Notes', 'Leads', 'Documents'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toStr(val) {
	if (val == null) return '';
	if (typeof val === 'string') return val;
	if (typeof val === 'number') return String(val);
	if (typeof val === 'object') return val.name || val.email || val.title || val._id || '';
	return String(val);
}

function formatDate(dateStr) {
	if (!dateStr) return '–';
	const d = new Date(dateStr);
	if (isNaN(d)) return dateStr;
	return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMonthDay(dateStr) {
	if (!dateStr) return '';
	const d = new Date(dateStr);
	if (isNaN(d)) return dateStr;
	return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatDateTime(dateStr) {
	if (!dateStr) return '–';
	const d = new Date(dateStr);
	if (isNaN(d)) return dateStr;
	const datePart = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
	const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
	return `${datePart} • ${timePart}`;
}

function formatCurrency(val) {
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
	const palette = ['#4D8733'];
	if (!name) return palette[0];
	let hash = 0;
	for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
	return palette[Math.abs(hash) % palette.length];
}

function isOverdue(dueDate, status) {
	if (!dueDate) return false;
	if (status === 'done' || status === 'completed' || status === 'cancelled') return false;
	return new Date(dueDate) < new Date();
}
function isToday(dueDate) {
	if (!dueDate) return false;
	return new Date(dueDate).toDateString() === new Date().toDateString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** InfoRow — icon + text, optionally tappable */
const InfoRow = ({ icon, text, onPress, textColor }) => {
	if (!text) return null;
	return (
		<TouchableOpacity
			style={styles.infoRow}
			onPress={onPress}
			activeOpacity={onPress ? 0.7 : 1}
			disabled={!onPress}
		>
			<IonIcon name={icon} size={ms(15)} color={Colors.textTertiary} style={styles.infoRowIcon} />
			<AppText size={13} color={textColor || Colors.textSecondary} style={styles.infoRowText} numberOfLines={2}>
				{text}
			</AppText>
		</TouchableOpacity>
	);
};

/** SectionCard — white rounded card with a header icon + uppercase title */
const SectionCard = ({ icon, title, children }) => (
	<View style={styles.sectionCard}>
		<View style={styles.sectionCardHeader}>
			<IonIcon name={icon} size={ms(14)} color={Colors.primary} />
			<AppText size={11} weight="bold" color={Colors.textTertiary} style={styles.sectionCardTitle}>
				{title?.toUpperCase()}
			</AppText>
		</View>
		{children}
	</View>
);

/** EmptyState — centered icon + message */
const EmptyState = ({ icon, title, subtitle }) => (
	<View style={styles.emptyState}>
		<View style={styles.emptyCircle}>
			<IonIcon name={icon} size={ms(28)} color={Colors.primary} />
		</View>
		<AppText size={13} weight="semiBold" color={Colors.textSecondary} style={{ marginTop: ms(12) }}>
			{title}
		</AppText>
		{subtitle ? (
			<AppText size={11} color={Colors.textTertiary} style={{ marginTop: 4, textAlign: 'center' }}>
				{subtitle}
			</AppText>
		) : null}
	</View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ContactDetailsScreen = ({ navigation, route }) => {
	const initial = route?.params?.contact;
	const contactId = route?.params?.contactId || initial?._id || initial?.id;

	const [contact, setContact] = useState(initial || null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [activeTab, setActiveTab] = useState(0);
	const [uploading, setUploading] = useState(false);
	const [documents, setDocuments] = useState([]);
	const [deleteModalVisible, setDeleteModalVisible] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [contactNotes, setContactNotes] = useState([]);
	const [noteSearchQuery, setNoteSearchQuery] = useState('');
	const [newNoteText, setNewNoteText] = useState('');
	const [addingNote, setAddingNote] = useState(false);
	const [deletingNoteId, setDeletingNoteId] = useState(null);
	const [isDeleteNoteModalVisible, setIsDeleteNoteModalVisible] = useState(false);
	const [deletingNote, setDeletingNote] = useState(false);
	const [isEditingNote, setIsEditingNote] = useState(false);
	const [editingNoteId, setEditingNoteId] = useState(null);

	const { user: currentUser } = useAuth();

	const tabAnim = useRef(new Animated.Value(0)).current;

	// ── Derived ───────────────────────────────────────────────────────────────
	const displayName = contact?.name || [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || 'Contact';
	const initials = getInitials(displayName);
	const avatarColor = getAvatarColor(displayName);
	const companyName = toStr(contact?.company);
	const companyId = typeof contact?.company === 'object' ? (contact?.company?._id || contact?.company?.id) : contact?.companyId;
	const ownerName = typeof contact?.userId === 'object' ? contact?.userId?.name : contact?.userId || '';
	const location = [contact?.city, contact?.state, contact?.country].filter(Boolean).join(', ');
	const contactEmail = contact?.email || '';
	const contactPhone = contact?.phone || contact?.mobile || '';
	const contactWA = contact?.whatsapp || contact?.phone || contact?.mobile || '';

	const leads = contact?.leads || [];
	const tasks = contact?.tasks || [];
	const activities = contact?.activities || [];
	const followups = contact?.followups || [];
	const notes = contact?.notes || [];
	const tags = contact?.tags || [];


	// ── API ───────────────────────────────────────────────────────────────────
	const fetchContact = useCallback(async () => {
		if (!contactId) { setLoading(false); return; }
		try {
			const res = await contactsAPI.getById(contactId);
			if (res.success) {
				const data = res.data?.data || res.data;
				if (data) {
					setContact(data);
					setDocuments(data.documents || []);
				}
			}
		} catch (_) { }
		finally { setLoading(false); }
	}, [contactId]);

	const fetchNotes = useCallback(async () => {
		if (!contactId) return;
		try {
			const res = await notesAPI.getAll({ entityType: 'contact', entityId: contactId });
			if (res.success) {
				const data = res.data?.data || res.data || [];
				setContactNotes(Array.isArray(data) ? data : []);
			}
		} catch (_) { }
	}, [contactId]);

	useEffect(() => {
		fetchContact();
		fetchNotes();
	}, []);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await Promise.all([fetchContact(), fetchNotes()]);
		setRefreshing(false);
	}, [fetchContact, fetchNotes]);

	// ── Handlers ──────────────────────────────────────────────────────────────
	const handleTabChange = (idx) => {
		Animated.spring(tabAnim, {
			toValue: idx,
			useNativeDriver: false,
			tension: 80,
			friction: 10,
		}).start();
		setActiveTab(idx);
	};

	const handleEdit = () => navigation.navigate('EditContact', {
		contact,
		refreshContacts: route?.params?.refreshContacts
	});
	const handleEmail = () => contactEmail && Linking.openURL(`mailto:${contactEmail}`);
	const handleCall = () => contactPhone && Linking.openURL(`tel:${contactPhone}`);
	const handleWA = () => {
		const phone = contactWA.replace(/\D/g, '');
		if (phone) Linking.openURL(`https://wa.me/${phone}`);
	};

	const handleDelete = () => {
		setDeleteModalVisible(true);
	};

	const confirmDelete = async () => {
		setDeleting(true);
		try {
			const res = await contactsAPI.delete(contactId);
			if (res.success) {
				setDeleteModalVisible(false);
				route?.params?.refreshContacts?.();
				navigation.goBack();
			} else {
				Alert.alert('Error', res.error || 'Failed to delete contact');
			}
		} catch (error) {
			Alert.alert('Error', 'Failed to delete contact');
		} finally {
			setDeleting(false);
		}
	};

	const handleUploadDocument = () => {
		launchImageLibrary(
			{ mediaType: 'mixed', quality: 0.9, selectionLimit: 1 },
			async (response) => {
				if (response.didCancel || response.errorCode) return;
				const asset = response.assets?.[0];
				if (!asset) return;

				const formData = new FormData();
				formData.append('files', {
					uri: asset.uri,
					type: asset.type || 'image/jpeg',
					name: asset.fileName || `doc_${Date.now()}.jpg`,
				});

				setUploading(true);
				try {
					const res = await contactsAPI.uploadDocument(contactId, formData);
					if (res.success) {
						// Try to refresh documents list from server
						const docsRes = await contactsAPI.getDocuments(contactId);
						if (docsRes.success) {
							const data = docsRes.data?.data || docsRes.data || {};
							const docs = data.documents || [];
							setDocuments(Array.isArray(docs) ? docs : []);
						} else {
							// Fallback: append the returned doc(s)
							const newDocs = res.data?.data || res.data;
							if (newDocs) {
								if (Array.isArray(newDocs)) {
									setDocuments(prev => [...prev, ...newDocs]);
								} else {
									setDocuments(prev => [...prev, newDocs]);
								}
							}
						}
					} else {
						Alert.alert('Upload Failed', res.error || 'Could not upload document.');
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
						const res = await contactsAPI.deleteDocument(contactId, docId);
						if (res.success) {
							setDocuments(prev => prev.filter(d => (d._id || d.id) !== docId));
						} else {
							Alert.alert('Error', res.error || 'Failed to delete document.');
						}
					},
				},
			],
		);
	};

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
					entityType: 'contact',
					entityId: contactId,
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
		// Scroll to top or to the input area might be needed in a large list
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
				setContactNotes(prev => prev.filter(n => (n._id || n.id) !== deletingNoteId));
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

	// ── Top Bar ───────────────────────────────────────────────────────────────
	const renderHeader = () => (
		<View style={styles.topBar}>
			<TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
				<IonIcon name="arrow-back" size={ms(20)} color={Colors.textPrimary} />
			</TouchableOpacity>
			<AppText size={17} weight="bold" color={Colors.textPrimary} style={styles.topBarTitle} numberOfLines={1}>
				{displayName}
			</AppText>
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

	// ── Profile Card ──────────────────────────────────────────────────────────
	const renderProfileCard = () => (
		<View style={styles.profileCard}>
			{/* Avatar */}
			<View style={[styles.avatar, { backgroundColor: avatarColor }]}>
				<AppText size={28} weight="bold" color="#fff">{initials}</AppText>
			</View>

			<AppText size={20} weight="bold" color={Colors.textPrimary} style={styles.displayName} numberOfLines={1}>
				{displayName}
			</AppText>
			{contact?.designation ? (
				<AppText size={12} color={Colors.textTertiary} style={{ marginBottom: ms(8) }}>
					{contact.designation}
				</AppText>
			) : null}

			{/* Info rows */}
			<View style={styles.infoBlock}>
				<InfoRow icon="mail-outline" text={contactEmail} onPress={handleEmail} textColor={Colors.info} />
				<InfoRow icon="call-outline" text={contactPhone} onPress={handleCall} textColor={Colors.info} />
				<InfoRow icon="logo-whatsapp" text={contact?.whatsapp && contact.whatsapp !== contactPhone ? contact.whatsapp : null}
					onPress={handleWA} textColor="#25D366" />
				<InfoRow icon="business-outline" text={companyName}
					onPress={companyId ? () => navigation.navigate('CompanyDetails', { companyId }) : null}
					textColor={companyId ? Colors.info : Colors.textSecondary} />
				<InfoRow icon="location-outline" text={location} />
				<InfoRow icon="person-outline" text={ownerName ? `${ownerName} (Owner)` : null} />
				<InfoRow icon="gift-outline" text={contact?.birthday ? `Birthday: ${formatMonthDay(contact.birthday)}` : null} />
				<InfoRow icon="heart-outline" text={contact?.anniversary ? `Anniversary: ${formatMonthDay(contact.anniversary)}` : null} />
				<InfoRow icon="globe-outline" text={toStr(contact?.source) ? `Source: ${toStr(contact?.source)}` : null} />
			</View>

			{/* Tags */}
			{tags.length > 0 ? (
				<View style={styles.tagsBlock}>
					<AppText size={10} color={Colors.textTertiary} style={{ marginBottom: ms(6) }}>TAGS</AppText>
					<View style={styles.tagsRow}>
						{tags.map((tag, i) => (
							<View key={i} style={styles.tagPill}>
								<AppText size={11} weight="semiBold" color={Colors.primary}>{toStr(tag)}</AppText>
							</View>
						))}
					</View>
				</View>
			) : null}

			{/* Quick Actions */}
			<View style={styles.quickActionsBlock}>
				<AppText size={11} weight="bold" color={Colors.textTertiary} style={styles.quickActionsTitle}>
					⚡ QUICK ACTIONS
				</AppText>
				<View style={styles.quickActionRow}>
					{contactEmail ? (
						<TouchableOpacity style={styles.quickActionBtn} onPress={handleEmail} activeOpacity={0.8}>
							<View style={[styles.qaBtnIcon, { backgroundColor: '#EFF6FF' }]}>
								<IonIcon name="mail" size={ms(18)} color="#3B82F6" />
							</View>
							<AppText size={11} weight="semiBold" color={Colors.textSecondary} style={{ marginTop: 4 }}>Email</AppText>
						</TouchableOpacity>
					) : null}
					{contactPhone ? (
						<TouchableOpacity style={styles.quickActionBtn} onPress={handleCall} activeOpacity={0.8}>
							<View style={[styles.qaBtnIcon, { backgroundColor: '#EEF5E6' }]}>
								<IonIcon name="call" size={ms(18)} color={Colors.primary} />
							</View>
							<AppText size={11} weight="semiBold" color={Colors.textSecondary} style={{ marginTop: 4 }}>Call</AppText>
						</TouchableOpacity>
					) : null}
					{contactWA ? (
						<TouchableOpacity style={styles.quickActionBtn} onPress={handleWA} activeOpacity={0.8}>
							<View style={[styles.qaBtnIcon, { backgroundColor: '#F0FDF4' }]}>
								<IonIcon name="logo-whatsapp" size={ms(18)} color="#25D366" />
							</View>
							<AppText size={11} weight="semiBold" color={Colors.textSecondary} style={{ marginTop: 4 }}>WhatsApp</AppText>
						</TouchableOpacity>
					) : null}
				</View>
			</View>
		</View>
	);

	// ── Tabs ──────────────────────────────────────────────────────────────────
	const renderTabs = () => {
		const w = 100 / TABS.length;
		const left = tabAnim.interpolate({
			inputRange: TABS.map((_, i) => i),
			outputRange: TABS.map((_, i) => `${i * w}%`),
		});
		return (
			<View style={styles.tabBar}>
				<Animated.View style={[styles.tabIndicator, { left, width: `${w}%` }]} />
				{TABS.map((tab, idx) => (
					<TouchableOpacity
						key={tab}
						style={styles.tabItem}
						onPress={() => handleTabChange(idx)}
						activeOpacity={0.8}
					>
						<AppText
							size={12}
							weight={activeTab === idx ? 'bold' : 'regular'}
							color={activeTab === idx ? Colors.primary : Colors.textTertiary}
						>
							{tab}
						</AppText>
					</TouchableOpacity>
				))}
			</View>
		);
	};

	// ── Activities Tab ────────────────────────────────────────────────────────
	const ACT_STYLE = {
		call: { icon: 'call', color: '#4D8733', bg: '#EEF5E6' },
		email: { icon: 'mail', color: '#3B82F6', bg: '#EFF6FF' },
		meeting: { icon: 'calendar', color: '#8B5CF6', bg: '#F5F3FF' },
		note: { icon: 'document-text', color: '#F59E0B', bg: '#FFFBEB' },
		whatsapp: { icon: 'logo-whatsapp', color: '#25D366', bg: '#F0FDF4' },
		task: { icon: 'checkmark-circle', color: '#EC4899', bg: '#FDF2F8' },
	};

	const renderActivities = () => (
		<SectionCard icon="pulse-outline" title={`Activity Timeline (${activities.length})`}>
			{activities.length > 0 ? activities.map((act, i) => {
				const s = ACT_STYLE[(act.type || '').toLowerCase()] || { icon: 'time', color: '#9CA3AF', bg: '#F3F4F6' };
				const expansion = act.summary || act.details || act.changes;
				return (
					<View key={act._id || act.id || i} style={styles.activityItem}>
						<View style={[styles.activityIconBox, { backgroundColor: s.bg }]}>
							<IonIcon name={s.icon} size={ms(14)} color={s.color} />
						</View>
						<View style={{ flex: 1, marginLeft: ms(10) }}>
							<View style={styles.activityMeta}>
								<AppText size={12} weight="semiBold" color={Colors.textPrimary} style={{ flex: 1 }} numberOfLines={2}>
									{act.title || act.description || act.action || act.type || 'Activity'}
								</AppText>
								<AppText size={10} color={Colors.textTertiary}>
									{formatDate(act.createdAt || act.date)}
								</AppText>
							</View>
							{act.performedBy?.name ? (
								<AppText size={11} color={Colors.textTertiary}>by {act.performedBy.name}</AppText>
							) : null}
							{/* Summary block (matching website's expandable summary) */}
							{expansion ? (
								<View style={styles.activityExpansion}>
									{act.summary ? (
										<AppText size={11} color={Colors.textSecondary} style={{ marginBottom: ms(4) }}>
											{act.summary}
										</AppText>
									) : null}
									{act.changes ? (
										<View style={styles.changesBox}>
											<AppText size={10} weight="bold" color={Colors.textTertiary} style={{ marginBottom: ms(4) }}>
												CHANGES
											</AppText>
											<AppText size={11} color={Colors.textSecondary}>
												{typeof act.changes === 'string' ? act.changes : JSON.stringify(act.changes)}
											</AppText>
										</View>
									) : null}
								</View>
							) : null}
						</View>
					</View>
				);
			}) : (
				<EmptyState icon="pulse-outline" title="No activity yet" subtitle="All timeline events will appear here" />
			)}
		</SectionCard>
	);

	// ── Notes Tab ─────────────────────────────────────────────────────────────
	const renderNotes = () => {
		const filteredNotes = (contactNotes || []).filter(note => {
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
						{/* <IonIcon name="chatbubble-outline" size={20} color={Colors.primary} /> */}
						<AppText size='md' weight="semiBold" color={Colors.textPrimary} style={{ marginLeft: 8 }}>
							Internal Notes
						</AppText>
						<TouchableOpacity style={{ marginLeft: 6 }}>
							<IonIcon name="information-circle-outline" size={20} color={Colors.textTertiary} />
						</TouchableOpacity>
					</View>
				</View>
				<View style={styles.noteSearchContainer}>
					<IonIcon name="search-outline" size={hs(18)} color={Colors.textTertiary} style={{ marginRight: 6 }} />
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
									<AppText size='sm' color={Colors.white} weight="semiBold">{isEditingNote ? 'Update' : 'Add'}</AppText>
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

	// ── Leads Tab ─────────────────────────────────────────────────────────────
	const renderLeads = () => (
		<SectionCard icon="cash-outline" title={`Leads (${leads.length})`}>
			{leads.length > 0 ? leads.map((lead, i) => {
				const stageName = typeof lead.stage === 'object' ? lead.stage?.name : lead.stage;
				const leadCompany = lead.company?.name || (typeof lead.company === 'string' ? lead.company : '');
				const val = lead.value ? formatCurrency(lead.value) : null;
				const statusColors = {
					Open: { bg: '#EEF5E6', color: Colors.primary },
					Won: { bg: '#ECFDF5', color: '#059669' },
					Lost: { bg: '#FEF2F2', color: Colors.danger },
				};
				const sc = statusColors[lead.status] || { bg: '#F3F4F6', color: Colors.textTertiary };
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
								{leadCompany ? <AppText size={11} color={Colors.textTertiary}>Company: {leadCompany}</AppText> : null}
								{stageName ? <AppText size={11} color={Colors.textTertiary} style={{ marginLeft: 6 }}>Stage: {stageName}</AppText> : null}
								{val ? <AppText size={11} color="#059669" style={{ marginLeft: 6 }}>{val}</AppText> : null}
							</View>
						</View>
						<View style={[styles.leadStatusBadge, { backgroundColor: sc.bg }]}>
							<AppText size={10} weight="bold" color={sc.color}>{lead.status || 'Open'}</AppText>
						</View>
						<IonIcon name="chevron-forward" size={ms(15)} color={Colors.textTertiary} style={{ marginLeft: 4 }} />
					</TouchableOpacity>
				);
			}) : (
				<EmptyState icon="cash-outline" title="No leads associated" subtitle="Leads linked to this contact appear here" />
			)}
		</SectionCard>
	);

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
			case 0: return renderActivities();
			case 1: return renderNotes();
			case 2: return renderLeads();
			case 3: return renderDocuments();
			default: return null;
		}
	};

	// ── Tasks section ─────────────────────────────────────────────────────────
	const renderTasks = () => (
		<SectionCard icon="checkbox-outline" title="Tasks">
			{tasks.length > 0 ? tasks.map((task, i) => {
				const done = task.status === 'done' || task.status === 'completed';
				return (
					<View key={task._id || task.id || i} style={styles.taskItem}>
						<IonIcon
							name={done ? 'checkmark-circle' : 'ellipse-outline'}
							size={ms(18)}
							color={done ? Colors.primary : Colors.textTertiary}
						/>
						<View style={{ flex: 1, marginLeft: ms(10) }}>
							<AppText
								size={13}
								weight="semiBold"
								color={done ? Colors.textTertiary : Colors.textPrimary}
								style={done ? styles.strikethrough : null}
							>
								{task.title}
							</AppText>
							{task.dueDate ? (
								<AppText size={11} color={Colors.textTertiary} style={{ marginTop: 2 }}>
									Due: {formatDate(task.dueDate)}
								</AppText>
							) : null}
						</View>
						<View style={[styles.taskBadge, { backgroundColor: done ? '#EEF5E6' : '#FFFBEB' }]}>
							<AppText size={10} weight="bold" color={done ? Colors.primary : '#F59E0B'}>
								{task.status || 'pending'}
							</AppText>
						</View>
					</View>
				);
			}) : (
				<EmptyState icon="checkbox-outline" title="No tasks for this contact" subtitle="Add a task" />
			)}
		</SectionCard>
	);

	// ── Followups section ─────────────────────────────────────────────────────
	const renderFollowups = () => {
		if (!followups.length) return null;
		return (
			<SectionCard icon="time-outline" title={`Followups (${followups.length})`}>
				{followups.map((f, i) => {
					const dueDate = f.dueDate || f.dueAt;
					const over = isOverdue(dueDate, f.status);
					const today = isToday(dueDate);
					const done = f.status === 'completed' || f.status === 'done';
					return (
						<View key={f._id || f.id || i} style={styles.followupItem}>
							<View style={styles.followupRow}>
								<AppText size={13} weight="semiBold" color={Colors.textPrimary} style={{ flex: 1 }}>
									{f.title}
								</AppText>
								<View style={[
									styles.followupBadge,
									done ? { backgroundColor: '#EEF5E6' } :
										over ? { backgroundColor: '#FEF2F2' } :
											today ? { backgroundColor: '#FFFBEB' } :
												{ backgroundColor: Colors.primaryBackground },
								]}>
									<AppText size={10} weight="bold" color={
										done ? Colors.primary :
											over ? Colors.danger :
												today ? '#F59E0B' :
													Colors.primary
									}>
										{done ? 'Done' : over ? 'Overdue' : today ? 'Due Today' : (f.priority || 'normal')}
									</AppText>
								</View>
							</View>
							{f.description ? (
								<AppText size={11} color={Colors.textTertiary} style={{ marginTop: 3 }} numberOfLines={2}>
									{f.description}
								</AppText>
							) : null}
							<AppText size={11} color={Colors.textTertiary} style={{ marginTop: 3 }}>
								{dueDate ? formatDateTime(dueDate) : 'No date'}
							</AppText>
						</View>
					);
				})}
			</SectionCard>
		);
	};

	// ─────────────────────────────────────────────────────────────────────────
	if (loading) return <CenteredLoader />;

	if (!contact) {
		return (
			<SafeAreaView style={styles.container} edges={['top']}>
				{renderHeader()}
				<View style={styles.centered}>
					<IonIcon name="person-outline" size={ms(60)} color={Colors.textTertiary} />
					<AppText size={15} weight="semiBold" color={Colors.textTertiary} style={{ marginTop: ms(16) }}>
						Contact not found
					</AppText>
					<TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
						<AppText size={14} weight="bold" color={Colors.primary}>Go Back</AppText>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<SafeAreaView style={styles.container} edges={['top']}>
				{renderHeader()}
				<ScrollView
					showsVerticalScrollIndicator={false}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
					contentContainerStyle={styles.scrollContent}
				>
					{/* Profile Card */}
					{renderProfileCard()}

					{/* Tabs + Content */}
					<View style={styles.tabsCard}>
						{renderTabs()}
						<View style={styles.tabContent}>
							{renderTabContent()}
						</View>
					</View>

					{/* Tasks */}
					{renderTasks()}

					{/* Followups */}
					{renderFollowups()}

					<View style={{ height: vs(40) }} />
				</ScrollView>

				<DeleteConfirmationModal
					visible={deleteModalVisible}
					title="Delete Contact"
					message={`Are you sure you want to delete "${displayName}"? This action cannot be undone.`}
					onCancel={() => setDeleteModalVisible(false)}
					onDelete={confirmDelete}
					loading={deleting}
				/>
			</SafeAreaView>
		</KeyboardAvoidingView>
	);
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: Colors.background },
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
	scrollContent: {
		paddingHorizontal: ms(16),
		paddingTop: ms(12),
		paddingBottom: ms(20),
		gap: ms(12),
	},

	// Top bar
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
		width: ms(36), height: ms(36), borderRadius: ms(18),
		backgroundColor: Colors.background,
		justifyContent: 'center', alignItems: 'center',
		...Shadow.sm,
	},
	topBarTitle: { flex: 1, marginHorizontal: ms(10) },
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
	goBackBtn: {
		marginTop: ms(16),
		paddingHorizontal: ms(24), paddingVertical: ms(10),
		backgroundColor: Colors.primaryBackground, borderRadius: ms(12),
	},

	// Profile card
	profileCard: {
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.xl,
		padding: ms(20),
		alignItems: 'center',
		...Shadow.sm,
	},
	avatar: {
		width: ms(72), height: ms(72), borderRadius: ms(36),
		justifyContent: 'center', alignItems: 'center',
		marginBottom: ms(10),
	},
	displayName: { marginBottom: ms(4), textAlign: 'center' },

	// Info rows
	infoBlock: { width: '100%', marginTop: ms(12) },
	infoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: ms(7),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	infoRowIcon: { width: ms(22) },
	infoRowText: { flex: 1 },

	// Tags
	tagsBlock: {
		width: '100%',
		marginTop: ms(14),
		paddingTop: ms(14),
		borderTopWidth: 1,
		borderTopColor: Colors.divider,
	},
	tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(6) },
	tagPill: {
		paddingHorizontal: ms(10), paddingVertical: ms(4),
		backgroundColor: Colors.primaryBackground,
		borderRadius: ms(20),
	},

	// Quick Actions
	quickActionsBlock: {
		width: '100%',
		marginTop: ms(16),
		paddingTop: ms(14),
		borderTopWidth: 1,
		borderTopColor: Colors.divider,
	},
	quickActionsTitle: { letterSpacing: 0.6, marginBottom: ms(10), textAlign: 'center' },
	quickActionRow: { flexDirection: 'row', justifyContent: 'center', gap: ms(28) },
	quickActionBtn: { alignItems: 'center' },
	qaBtnIcon: {
		width: ms(44), height: ms(44), borderRadius: ms(22),
		justifyContent: 'center', alignItems: 'center',
	},

	// Section card
	sectionCard: {
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.xl,
		padding: ms(16),
		...Shadow.sm,
	},
	sectionCardHeader: {
		flexDirection: 'row', alignItems: 'center',
		gap: ms(6), marginBottom: ms(12),
	},
	sectionCardTitle: { flex: 1, letterSpacing: 0.6, marginLeft: ms(2) },

	// Tabs
	tabsCard: {
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.xl,
		overflow: 'hidden',
		...Shadow.sm,
	},
	tabBar: {
		flexDirection: 'row',
		height: ms(44),
		backgroundColor: Colors.background,
		borderBottomWidth: 1,
		borderBottomColor: Colors.divider,
		position: 'relative',
	},
	tabIndicator: {
		position: 'absolute', bottom: 0,
		height: ms(3), backgroundColor: Colors.primary,
		borderRadius: ms(2),
	},
	tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	tabContent: { padding: ms(16) },

	// Activity
	activityItem: {
		flexDirection: 'row', alignItems: 'flex-start',
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	activityIconBox: {
		width: ms(32), height: ms(32), borderRadius: ms(8),
		justifyContent: 'center', alignItems: 'center',
	},
	activityMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(6) },

	// Documents
	docItem: {
		flexDirection: 'row', alignItems: 'center',
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	uploadBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: Colors.primary,
		borderRadius: ms(10),
		paddingVertical: ms(10),
		marginBottom: ms(12),
		gap: ms(6),
	},
	docIconBox: {
		width: ms(40), height: ms(40), borderRadius: ms(10),
		justifyContent: 'center', alignItems: 'center',
	},
	docItemInner: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	docDeleteBtn: {
		width: ms(32), height: ms(32), borderRadius: ms(8),
		backgroundColor: '#FEF2F2',
		justifyContent: 'center', alignItems: 'center',
		marginLeft: ms(8),
	},
	activityExpansion: {
		marginTop: ms(6), padding: ms(10),
		backgroundColor: Colors.background,
		borderRadius: ms(8), borderWidth: 1,
		borderColor: Colors.divider,
	},
	changesBox: {
		marginTop: ms(6),
		padding: ms(8),
		backgroundColor: Colors.primaryBackground,
		borderRadius: ms(6),
	},

	// Notes
	noteItem: {
		flexDirection: 'row',
		paddingVertical: vs(12),
		borderBottomWidth: 1,
		borderBottomColor: Colors.divider,
	},
	noteDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: Colors.primary,
		marginTop: 6,
		marginRight: 12,
	},
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

	// Leads
	leadItem: {
		flexDirection: 'row', alignItems: 'center',
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	leadMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: ms(3) },
	leadStatusBadge: {
		paddingHorizontal: ms(8), paddingVertical: ms(3),
		borderRadius: ms(10), marginLeft: ms(6),
	},

	// Tasks
	taskItem: {
		flexDirection: 'row', alignItems: 'center',
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	strikethrough: { textDecorationLine: 'line-through' },
	taskBadge: {
		paddingHorizontal: ms(8), paddingVertical: ms(3), borderRadius: ms(10),
	},

	// Followups
	followupItem: {
		paddingVertical: ms(10),
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.divider,
	},
	followupRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
	followupBadge: {
		paddingHorizontal: ms(8), paddingVertical: ms(3), borderRadius: ms(10),
	},

	// Empty
	emptyState: { alignItems: 'center', paddingVertical: ms(28) },
	emptyCircle: {
		width: ms(56), height: ms(56), borderRadius: ms(28),
		backgroundColor: Colors.primaryBackground,
		justifyContent: 'center', alignItems: 'center',
	},
});

export default ContactDetailsScreen;
