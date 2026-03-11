/**
 * Lead Details Screen
 * Full-featured lead details with tabs: Activities, Call History, Notes, Documents
 * Data fetched live from the API
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Linking,
    Alert,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Animated,
    LayoutAnimation,
    UIManager,
    Platform,
    TextInput,
    KeyboardAvoidingView,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';
import { leadsAPI, settingsAPI, notesAPI, uploadAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { showError } from '../../utils';
import { DeleteConfirmationModal, AppText } from '../../components';

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = ['Activities', 'Call History', 'Notes', 'Documents'];

const STAGE_CONFIG = {
    New: { color: '#3B82F6', bg: '#EFF6FF', label: 'New' },
    Contacted: { color: '#F59E0B', bg: '#FFFBEB', label: 'Contacted' },
    Qualified: { color: '#4D8733', bg: '#EEF5E6', label: 'Qualified' },
    Converted: { color: '#10B981', bg: '#ECFDF5', label: 'Converted' },
    Lost: { color: '#EF4444', bg: '#FEF2F2', label: 'Lost' },
};

const ACTIVITY_ICON_MAP = {
    call: { icon: 'call', color: '#4D8733', bg: '#EEF5E6' },
    email: { icon: 'mail', color: '#3B82F6', bg: '#EFF6FF' },
    meeting: { icon: 'calendar', color: '#8B5CF6', bg: '#F5F3FF' },
    note: { icon: 'document-text', color: '#F59E0B', bg: '#FFFBEB' },
    whatsapp: { icon: 'logo-whatsapp', color: '#25D366', bg: '#F0FDF4' },
    task: { icon: 'checkmark-circle', color: '#EC4899', bg: '#FDF2F8' },
    default: { icon: 'time', color: '#9CA3AF', bg: '#F3F4F6' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(val) {
    if (!val && val !== 0) return '–';
    return `₹${Number(val).toLocaleString('en-IN')}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '–';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '–';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const datePart = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${datePart} • ${timePart}`;
}

function formatDuration(secs) {
    if (!secs && secs !== 0) return '–';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name) {
    const palette = ['#4D8733', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];
    if (!name) return palette[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

function getActivityStyle(type) {
    const key = (type || '').toLowerCase();
    return ACTIVITY_ICON_MAP[key] || ACTIVITY_ICON_MAP.default;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow = ({ label, value, valueColor, onPress, renderRight, bold }) => {
    if (!renderRight && !value && value !== 0) return null;
    return (
        <TouchableOpacity
            activeOpacity={onPress ? 0.7 : 1}
            onPress={onPress}
            style={styles.infoRow}
        >
            <Text style={styles.infoLabel}>{label}</Text>
            {renderRight
                ? renderRight()
                : <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null, bold ? { fontWeight: '700' } : null]}>{value}</Text>
            }
        </TouchableOpacity>
    );
};

const StageBadge = ({ stage }) => {
    const cfg = STAGE_CONFIG[stage] || { color: '#9CA3AF', bg: '#F3F4F6', label: stage || 'Unknown' };
    return (
        <View style={[styles.stageBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.stageBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
    );
};

const ProbabilityBadge = ({ probability }) => {
    if (!probability && probability !== 0) return null;
    return (
        <View style={styles.probBadge}>
            <Text style={styles.probBadgeText}>{probability}%</Text>
        </View>
    );
};

// ─── AccordionCard ────────────────────────────────────────────────────────────
const AccordionCard = ({ icon, title, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    const rotateAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

    const toggle = () => {
        LayoutAnimation.configureNext({
            duration: 260,
            create: { type: 'easeInEaseOut', property: 'opacity' },
            update: { type: 'easeInEaseOut' },
            delete: { type: 'easeInEaseOut', property: 'opacity' },
        });
        Animated.timing(rotateAnim, {
            toValue: open ? 0 : 1,
            duration: 240,
            useNativeDriver: true,
        }).start();
        setOpen(prev => !prev);
    };

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <View style={styles.sideCard}>
            <TouchableOpacity style={styles.accordionHeader} onPress={toggle} activeOpacity={0.75}>
                <IonIcon name={icon} size={ms(16)} color={Colors.primary} />
                <Text style={styles.accordionTitle}>{title}</Text>
                <Animated.View style={{ transform: [{ rotate }] }}>
                    <IonIcon name="chevron-down" size={ms(16)} color={Colors.textTertiary} />
                </Animated.View>
            </TouchableOpacity>
            {open ? <View style={styles.accordionBody}>{children}</View> : null}
        </View>
    );
};

const ActivityItem = ({ item }) => {
    const style = getActivityStyle(item.type);
    const title = item.title || item.subject || item.description || item.type || 'Activity';
    const note = item.notes || item.description || item.outcome || '';
    const dateStr = item.dueDate || item.completedAt || item.createdAt;

    return (
        <View style={styles.activityItem}>
            <View style={[styles.activityIconCircle, { backgroundColor: style.bg }]}>
                <IonIcon name={style.icon} size={ms(18)} color={style.color} />
            </View>
            <View style={styles.activityItemLine} />
            <View style={styles.activityContent}>
                <View style={styles.activityHeader}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.activityDate}>{formatDate(dateStr)}</Text>
                </View>
                {note ? <Text style={styles.activityNote} numberOfLines={2}>{note}</Text> : null}
                {item.assignedTo?.name ? (
                    <View style={styles.activityAssignee}>
                        <IonIcon name="person-circle-outline" size={12} color={Colors.textTertiary} />
                        <Text style={styles.activityAssigneeText}>{item.assignedTo.name}</Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
};

const CallHistoryItem = ({ item, index, total }) => {
    const isIncoming = (item.direction || '').toLowerCase() === 'inbound' || (item.callType || '').toLowerCase() === 'incoming';
    const isAnswered = (item.status || '').toLowerCase() === 'answered' || (item.callStatus || '').toLowerCase() === 'connected';
    const statusColor = isAnswered ? Colors.primary : Colors.error;
    const dirIcon = isIncoming ? 'call-outline' : 'arrow-up-circle-outline';
    const dirColor = isIncoming ? '#3B82F6' : '#4D8733';
    const dateStr = item.startTime || item.callTime || item.createdAt;

    return (
        <View style={[styles.callItem, index === total - 1 && { borderBottomWidth: 0 }]}>
            <View style={[styles.callIconCircle, { backgroundColor: dirColor + '12' }]}>
                <IonIcon name={dirIcon} size={ms(18)} color={dirColor} />
            </View>
            <View style={styles.callContent}>
                <View style={styles.callRow1}>
                    <Text style={styles.callNumber} numberOfLines={1}>
                        {item.callerNumber || item.clientNumber || item.phoneNumber || 'Unknown'}
                    </Text>
                    <Text style={[styles.callStatus, { color: statusColor }]}>
                        {item.status || item.callStatus || '–'}
                    </Text>
                </View>
                <View style={styles.callRow2}>
                    <Text style={styles.callDateTime}>{formatDate(dateStr)} {formatTime(dateStr)}</Text>
                    <Text style={styles.callDuration}>{formatDuration(item.duration || item.callDuration)}</Text>
                </View>
                {item.agentName || item.agent?.name ? (
                    <Text style={styles.callAgent}>
                        Agent: {item.agentName || item.agent?.name}
                    </Text>
                ) : null}
            </View>
        </View>
    );
};

const EmptyState = ({ icon, title, subtitle }) => (
    <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
            <IonIcon name={icon} size={ms(32)} color={Colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>{title}</Text>
        {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const LeadDetailsScreen = ({ route, navigation }) => {
    const { lead: initialLead } = route.params || {};
    const leadId = initialLead?._id || initialLead?.id;

    // ── State ──
    const [lead, setLead] = useState(null);
    const [loadingLead, setLoadingLead] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    // Activities
    const [activities, setActivities] = useState([]);
    const [activitiesPage, setActivitiesPage] = useState(1);
    const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);
    const [hasMoreActivities, setHasMoreActivities] = useState(true);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [activitiesLoaded, setActivitiesLoaded] = useState(false);

    // Call history
    const [callHistory, setCallHistory] = useState([]);
    const [loadingCalls, setLoadingCalls] = useState(false);
    const [callsLoaded, setCallsLoaded] = useState(false);

    // Notes
    const [leadNotes, setLeadNotes] = useState([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [newNoteText, setNewNoteText] = useState('');
    const [noteSearchQuery, setNoteSearchQuery] = useState('');
    const [addingNote, setAddingNote] = useState(false);
    const [deletingNoteId, setDeletingNoteId] = useState(null);
    const [isDeleteNoteModalVisible, setIsDeleteNoteModalVisible] = useState(false);
    const [deletingNote, setDeletingNote] = useState(false);
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null);

    // Documents
    const [documents, setDocuments] = useState([]);
    const [loadingDocuments, setLoadingDocuments] = useState(false);
    const [documentsLoaded, setDocumentsLoaded] = useState(false);
    const [uploading, setUploading] = useState(false);

    const { user: currentUser } = useAuth();

    const tabAnim = useRef(new Animated.Value(0)).current;

    // ── API calls ──

    const fetchLeadDetail = useCallback(async () => {
        if (!leadId) return;
        try {
            const res = await leadsAPI.getById(leadId);
            if (res.success) {
                const data = res.data?.data || res.data;
                if (data) {
                    setLead(data);
                    if (data.contactDocuments) {
                        setDocuments(data.contactDocuments);
                        setDocumentsLoaded(true);
                    } else if (data.documents) {
                        setDocuments(data.documents);
                        setDocumentsLoaded(true);
                    }
                }
            }
        } catch (e) {
            // Keep initial lead data
        } finally {
            setLoadingLead(false);
        }
    }, [leadId]);

    const fetchNotes = useCallback(async () => {
        if (!leadId || loadingNotes) return;
        setLoadingNotes(true);
        try {
            const res = await notesAPI.getAll({ entityType: 'lead', entityId: leadId });
            if (res.success) {
                setLeadNotes(res.data?.data || res.data || []);
            }
        } catch (e) {
            // silently fail
        } finally {
            setLoadingNotes(false);
            setNotesLoaded(true);
        }
    }, [leadId]);


    const fetchActivities = useCallback(async (page = 1) => {
        if (!leadId || (page === 1 && loadingActivities) || (page > 1 && loadingMoreActivities)) return;

        if (page === 1) {
            setLoadingActivities(true);
        } else {
            setLoadingMoreActivities(true);
        }

        try {
            const limit = 20;
            const res = await leadsAPI.getActivities(leadId, { page, limit });
            // console.log('Activities response:', res);
            if (res.success) {
                const data = res.data?.data?.activities;
                const newList = Array.isArray(data) ? data : [];

                if (page === 1) {
                    setActivities(newList);
                } else {
                    setActivities(prev => [...prev, ...newList]);
                }

                setHasMoreActivities(newList.length === limit);
                setActivitiesPage(page);
            }
        } catch (e) {
            // silently fail
        } finally {
            setLoadingActivities(false);
            setLoadingMoreActivities(false);
            setActivitiesLoaded(true);
        }
    }, [leadId, loadingActivities, loadingMoreActivities]);

    const fetchCallHistory = useCallback(async () => {
        if (!leadId || loadingCalls) return;
        setLoadingCalls(true);
        try {
            const phone =
                lead?.contact?.mobile ||
                lead?.contact?.phone ||
                lead?.phone ||
                '';
            const res = await settingsAPI.getCallHistory({
                client_numbers: phone,
                lead_id: leadId,
                page_size: 100,
            });
            // console.log('Call history response:', res);
            if (res.success) {
                const data = res.data?.data || res.data?.history || res.data || [];
                setCallHistory(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            // silently fail
        } finally {
            setLoadingCalls(false);
            setCallsLoaded(true);
        }
    }, [leadId, lead]);

    useEffect(() => {
        fetchLeadDetail();
        fetchNotes();
    }, []);

    useEffect(() => {
        if (activeTab === 0 && !activitiesLoaded) {
            fetchActivities();
        } else if (activeTab === 1 && !callsLoaded) {
            fetchCallHistory();
        } else if (activeTab === 2 && !notesLoaded) {
            fetchNotes();
        } else if (activeTab === 3 && !documentsLoaded) {
            // Documents are already loaded via fetchLeadDetail
            setDocumentsLoaded(true);
        }
    }, [activeTab]);

    const handleTabChange = (idx) => {
        Animated.spring(tabAnim, {
            toValue: idx,
            useNativeDriver: false,
            tension: 80,
            friction: 10,
        }).start();
        setActiveTab(idx);
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setActivitiesLoaded(false);
        setActivitiesPage(1);
        setHasMoreActivities(true);
        setCallsLoaded(false);
        setNotesLoaded(false);
        setDocumentsLoaded(false);
        await Promise.all([
            fetchLeadDetail(),
            fetchNotes(),
            activeTab === 0 ? fetchActivities(1) : Promise.resolve(),
            activeTab === 1 ? fetchCallHistory() : Promise.resolve(),
        ]);
        setRefreshing(false);
    }, [activeTab, fetchLeadDetail, fetchNotes, fetchActivities, fetchCallHistory]);

    const handleLoadMoreActivities = () => {
        if (!loadingMoreActivities && hasMoreActivities) {
            fetchActivities(activitiesPage + 1);
        }
    };

    // ── Derived data ──

    console.log("lead", lead);

    const leadName = lead
        ? lead.title || 'Untitled Lead'
        : initialLead?.title || 'Lead Details';

    const stage = lead?.stage?.name || lead?.status || 'New';
    const company = lead?.company?.name || lead?.companyName || '';
    const email = lead?.contact?.email || lead?.email || '';
    const phone = lead?.contact?.mobile || lead?.contact?.phone || lead?.phone || '';
    const salesperson = lead?.salesperson?.name || lead?.salesperson || '';
    const salespersonEmail = lead?.salesperson?.email || '';
    const leadValue = lead?.value || lead?.estimatedValue || 0;
    const probability = lead?.stage?.probability;
    const expectedClose = lead?.expectedCloseDate || lead?.closeDate;
    const followup = lead?.followup;
    const currency = lead?.currency || 'INR';
    const owner = lead?.createdBy?.name || '';
    const tags = lead?.tags || [];
    const source = lead?.source?.name || lead?.source || '';
    const avatarColor = getAvatarColor(leadName);
    const created = lead?.createdAt;
    const createdBy = lead?.createdBy?.name || '';
    const updatedAt = lead?.updatedAt;
    const updatedBy = lead?.updatedBy?.name || '';

    // ── Actions ──

    const handleCall = () => {
        if (phone) Linking.openURL(`tel:${phone}`);
    };

    const handleEmail = () => {
        if (email) Linking.openURL(`mailto:${email}`);
    };

    const handleWhatsApp = () => {
        if (phone) Linking.openURL(`whatsapp://send?phone=${phone}`);
    };

    // ── Notes Handlers ──
    const handleAddNote = async () => {
        if (!newNoteText.trim() || !leadId) return;
        setAddingNote(true);
        try {
            let res;
            if (isEditingNote && editingNoteId) {
                res = await notesAPI.update(editingNoteId, {
                    content: newNoteText.trim(),
                });
            } else {
                res = await notesAPI.create({
                    entityType: 'lead',
                    entityId: leadId,
                    content: newNoteText.trim()
                });
            }
            if (res.success) {
                setNewNoteText('');
                setIsEditingNote(false);
                setEditingNoteId(null);
                fetchNotes();
            } else {
                showError(res.error || `Failed to ${isEditingNote ? 'update' : 'add'} note`);
            }
        } catch (e) {
            showError(`Failed to ${isEditingNote ? 'update' : 'add'} note`);
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

    const handleDeleteNote = async (noteId) => {
        setDeletingNote(true);
        try {
            const res = await notesAPI.delete(noteId);
            if (res.success) {
                setLeadNotes(prev => prev.filter(n => (n._id || n.id) !== noteId));
                setIsDeleteNoteModalVisible(false);
                setDeletingNoteId(null);
            } else {
                showError(res.error || 'Failed to delete note');
            }
        } catch (e) {
            showError('Something went wrong');
        } finally {
            setDeletingNote(false);
        }
    };

    // ── Documents Handlers ──
    const handleUploadDocument = () => {
        launchImageLibrary(
            { mediaType: 'mixed', quality: 0.9, selectionLimit: 1 },
            async (response) => {
                if (response.didCancel || response.errorCode) return;
                const asset = response.assets?.[0];
                if (!asset) return;

                const formData = new FormData();
                formData.append('file', {
                    uri: asset.uri,
                    type: asset.type || 'image/jpeg',
                    name: asset.fileName || `doc_${Date.now()}.jpg`,
                });

                setUploading(true);
                try {
                    const uploadRes = await uploadAPI.uploadFile(formData);
                    // console.log('Upload response:', uploadRes);
                    if (!uploadRes.success) {
                        Alert.alert('Upload Failed', uploadRes.error || 'Could not upload file.');
                        return;
                    }

                    const uploadData = uploadRes.data?.fileUrl
                        || {};
                    const newDoc = {
                        id: uploadData.publicId || `doc_${Date.now()}`,
                        name: uploadData.fileName || asset.fileName || `doc_${Date.now()}.jpg`,
                        url: uploadData.fileUrl || '',
                        publicId: uploadData.publicId || '',
                        format: (uploadData.fileName || asset.fileName || '').split('.').pop() || '',
                        size: uploadData.fileSize || asset.fileSize || 0,
                        type: 'lead_profile',
                        createdAt: new Date().toISOString(),
                    };

                    const updatedDocs = [...documents, newDoc];
                    const patchRes = await leadsAPI.update(leadId, { documents: updatedDocs });
                    if (patchRes.success) {
                        setDocuments(updatedDocs);
                    } else {
                        Alert.alert('Save Failed', patchRes.error || 'Could not save document to lead.');
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
                        const updatedDocs = documents.filter(d => (d._id || d.id) !== docId);
                        const res = await leadsAPI.update(leadId, { documents: updatedDocs });
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

    const handleDelete = () => {
        Alert.alert(
            'Delete Lead',
            'Are you sure you want to delete this lead? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const res = await leadsAPI.delete(leadId);
                        if (res.success) {
                            route?.params?.refreshLeads?.();
                            route?.params?.refreshPipeline?.();
                            route?.params?.refreshFollowUps?.();
                            navigation.goBack();
                        } else {
                            Alert.alert('Error', res.error || 'Failed to delete lead');
                        }
                    },
                },
            ],
        );
    };

    // ── Render: Header ──

    const renderHeader = () => (
        <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <IonIcon name="arrow-back" size={ms(22)} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Lead Details</Text>
            <View style={styles.topBarActions}>
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => navigation.navigate('EditLead', {
                        lead,
                        onUpdate: (updatedLead) => {
                            setLead(updatedLead);
                        },
                        refreshLeads: route?.params?.refreshLeads,
                        refreshPipeline: route?.params?.refreshPipeline,
                        refreshFollowUps: route?.params?.refreshFollowUps,
                    })}
                >
                    <IonIcon name="create-outline" size={ms(18)} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <IonIcon name="trash-outline" size={ms(18)} color={Colors.error} />
                </TouchableOpacity>
            </View>
        </View>
    );

    // ── Render: Profile card (Expo-style: centered avatar, badges, quick actions) ──

    const renderHeroCard = () => (
        <View style={styles.profileCard}>
            {/* Circular avatar */}
            <View style={[styles.profileAvatar, { backgroundColor: avatarColor + '18' }]}>
                <Text style={[styles.profileAvatarText, { color: avatarColor }]}>
                    {getInitials(leadName)}
                </Text>
            </View>

            {/* Name */}
            <Text style={styles.profileName}>{leadName}</Text>

            {/* Company */}
            {company ? (
                <Text style={styles.profileCompany}>{company}</Text>
            ) : null}

            {/* Badges: stage + source */}
            <View style={styles.profileBadgeRow}>
                {(() => {
                    const cfg = STAGE_CONFIG[stage] || { color: '#9CA3AF', bg: '#F3F4F6', label: stage };
                    return (
                        <View style={[styles.profileStatusBadge, { backgroundColor: cfg.bg }]}>
                            <IonIcon name={{
                                New: 'sparkles', Contacted: 'chatbubble', Qualified: 'checkmark-circle',
                                Converted: 'trophy', Lost: 'close-circle',
                            }[stage] || 'ellipse'} size={13} color={cfg.color} />
                            <Text style={[styles.profileBadgeText, { color: cfg.color }]}>{stage}</Text>
                        </View>
                    );
                })()}
                {source ? (
                    <View style={styles.profileSourceBadge}>
                        <Text style={styles.profileSourceText}>{source}</Text>
                    </View>
                ) : null}
            </View>

            {/* Value */}
            {leadValue > 0 ? (
                <View style={styles.profileValueBadge}>
                    <Text style={styles.profileValueText}>{formatCurrency(leadValue)}</Text>
                    {expectedClose ? (
                        <Text style={styles.profileExpectedText}>Expected: {formatDate(expectedClose)}</Text>
                    ) : null}
                </View>
            ) : null}

            {/* Quick action buttons */}
            <View style={styles.profileQuickActions}>
                {phone ? (
                    <TouchableOpacity style={styles.profileActionBtn} onPress={handleCall}>
                        <IonIcon name="call" size={ms(20)} color={Colors.primary} />
                        <Text style={styles.profileActionLabel}>Call</Text>
                    </TouchableOpacity>
                ) : null}
                {email ? (
                    <TouchableOpacity style={styles.profileActionBtn} onPress={handleEmail}>
                        <IonIcon name="mail" size={ms(20)} color="#3B82F6" />
                        <Text style={styles.profileActionLabel}>Email</Text>
                    </TouchableOpacity>
                ) : null}
                {phone ? (
                    <TouchableOpacity style={styles.profileActionBtn} onPress={() => Linking.openURL(`sms:${phone}`)}>
                        <IonIcon name="chatbubble" size={ms(20)} color="#8B5CF6" />
                        <Text style={styles.profileActionLabel}>SMS</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );

    // ── Render: Contact card ──

    const renderContactCard = () => (
        <AccordionCard icon="person-outline" title="Contact">
            {leadName ? <Text style={styles.contactName}>{leadName}</Text> : null}
            {email ? (
                <TouchableOpacity onPress={handleEmail} style={styles.contactRow}>
                    <IonIcon name="mail-outline" size={ms(14)} color={Colors.textSecondary} />
                    <Text style={styles.contactEmail} numberOfLines={1}>{email}</Text>
                </TouchableOpacity>
            ) : null}
            {phone ? (
                <TouchableOpacity onPress={handleCall} style={styles.contactRow}>
                    <IonIcon name="call-outline" size={ms(14)} color={Colors.textSecondary} />
                    <Text style={styles.contactPhone}>{phone}</Text>
                </TouchableOpacity>
            ) : null}
        </AccordionCard>
    );

    // ── Render: Quick Actions card ──

    const renderQuickActions = () => (
        <AccordionCard icon="flash-outline" title="Quick Actions">
            <TouchableOpacity style={styles.quickActionBtn} onPress={handleEmail}>
                <IonIcon name="mail-outline" size={ms(16)} color={Colors.textSecondary} />
                <Text style={styles.quickActionText}>Send Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={handleCall}>
                <IonIcon name="call-outline" size={ms(16)} color={Colors.textSecondary} />
                <Text style={styles.quickActionText}>Log Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={handleWhatsApp}>
                <IonIcon name="logo-whatsapp" size={ms(16)} color="#25D366" />
                <Text style={styles.quickActionText}>Send WhatsApp</Text>
            </TouchableOpacity>
        </AccordionCard>
    );

    // ── Render: Company card ──

    const renderCompanyCard = () => {
        if (!company) return null;
        return (
            <AccordionCard icon="business-outline" title="Company">
                <Text style={styles.companyName}>{company}</Text>
            </AccordionCard>
        );
    };

    // ── Render: Salesperson card ──

    const renderSalespersonCard = () => {
        if (!salesperson) return null;
        return (
            <AccordionCard icon="person-outline" title="Salesperson">
                <Text style={styles.salespersonName}>{salesperson}</Text>
                {salespersonEmail ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`mailto:${salespersonEmail}`)} style={styles.contactRow}>
                        <IonIcon name="mail-outline" size={ms(13)} color={Colors.textSecondary} />
                        <Text style={styles.salespersonEmail} numberOfLines={1}>{salespersonEmail}</Text>
                    </TouchableOpacity>
                ) : null}
            </AccordionCard>
        );
    };

    // ── Render: Tags card ──

    const renderTagsCard = () => (
        <AccordionCard icon="pricetag-outline" title="Tags">
            {tags.length === 0 ? (
                <Text style={styles.tagsEmpty}>No tags</Text>
            ) : (
                <View style={styles.tagsRow}>
                    {tags.map((tag, i) => (
                        <View key={i} style={styles.tag}>
                            <Text style={styles.tagText}>{typeof tag === 'string' ? tag : tag.name}</Text>
                        </View>
                    ))}
                </View>
            )}
        </AccordionCard>
    );

    // ── Render: Next Follow-Up card ──

    const renderFollowUpCard = () => (
        <AccordionCard icon="time-outline" title="Next Follow-Up">
            {followup ? (
                <Text style={styles.followUpDate}>{formatDate(followup)}</Text>
            ) : (
                <Text style={styles.noFollowUp}>No follow-ups scheduled</Text>
            )}
        </AccordionCard>
    );

    // ── Render: Lead Details card ──

    const renderLeadDetailsCard = () => (
        <AccordionCard icon="cash-outline" title="Lead Details" defaultOpen={false}>
            <InfoRow label="Value" value={formatCurrency(leadValue)} />
            <InfoRow label="Currency" value={currency} />
            <InfoRow label="Stage" renderRight={() => <StageBadge stage={stage} />} />
            <InfoRow label="Probability" renderRight={() => <ProbabilityBadge probability={probability} />} />
            <InfoRow label="Followup" value={formatDate(followup)} />
            <InfoRow label="Owner" value={owner} bold />
            <InfoRow label="Created" value={formatDate(created)} />
            <InfoRow label="Created By" value={createdBy} />
            <InfoRow label="Last Updated" value={formatDate(updatedAt)} />
            <InfoRow label="Updated By" value={updatedBy} />
        </AccordionCard>
    );

    // ── Render: Relevant Documents card ──

    const renderDocumentsCard = () => (
        <AccordionCard icon="document-text-outline" title="Relevant Documents">
            <EmptyState
                icon="document-outline"
                title="No documents from linked products or company"
                subtitle="Documents are managed at Product and Company level"
            />
        </AccordionCard>
    );

    // ── Render: Tabs ──

    const renderTabs = () => {
        const tabWidth = 100 / TABS.length;
        const indicatorLeft = tabAnim.interpolate({
            inputRange: TABS.map((_, i) => i),
            outputRange: TABS.map((_, i) => `${i * tabWidth}%`),
        });

        return (
            <View style={styles.tabBar}>
                {TABS.map((tab, idx) => (
                    <TouchableOpacity
                        key={tab}
                        style={styles.tabItem}
                        onPress={() => handleTabChange(idx)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.tabText, activeTab === idx && styles.tabTextActive]}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
                <Animated.View style={[styles.tabIndicator, { left: indicatorLeft, width: `${tabWidth}%` }]} />
            </View>
        );
    };

    // ── Render: Tab content ──

    // ── Render: Tabs ──

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

    const renderActivitiesTab = () => {
        if (loadingActivities) {
            return (
                <View style={styles.tabLoader}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.tabLoaderText}>Loading activities…</Text>
                </View>
            );
        }
        if (activities.length === 0) {
            return (
                <EmptyState
                    icon="chatbox-outline"
                    title="No activities yet"
                    subtitle="Click the button above to log an activity"
                />
            );
        }
        return (
            <View style={styles.activitiesContainer}>
                <Text style={styles.activityTimelineLabel}>Activity Timeline</Text>
                {activities.map((item, idx) => (
                    <ActivityItem key={item._id || item.id || idx} item={item} />
                ))}

                {hasMoreActivities && (
                    <TouchableOpacity
                        style={styles.loadMoreBtn}
                        onPress={handleLoadMoreActivities}
                        disabled={loadingMoreActivities}
                    >
                        {loadingMoreActivities ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <AppText color={Colors.primary} weight="semiBold">Load More Activities</AppText>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderCallHistoryTab = () => {
        if (loadingCalls) {
            return (
                <View style={styles.tabLoader}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.tabLoaderText}>Loading call history…</Text>
                </View>
            );
        }
        if (callHistory.length === 0) {
            return (
                <EmptyState
                    icon="call-outline"
                    title="No call history"
                    subtitle="Call history will appear here"
                />
            );
        }
        return (
            <View style={styles.callHistoryContainer}>
                {callHistory.map((item, idx) => (
                    <CallHistoryItem key={item._id || item.id || idx} item={item} index={idx} total={callHistory.length} />
                ))}
            </View>
        );
    };

    const renderNotesTab = () => {
        const filteredNotes = (leadNotes || []).filter(note => {
            const noteContent = (note.content || '').toLowerCase();

            // Creator name resolution
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
                        <AppText size='md' weight="semiBold" color={Colors.textPrimary} style={{ marginLeft: 8 }}>
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
                    onDelete={() => handleDeleteNote(deletingNoteId)}
                    loading={deletingNote}
                    title="Delete Note"
                    message="Are you sure you want to delete this note? This action cannot be undone."
                />
            </View>
        );
    };

    const renderDocumentsTab = () => (
        <View style={styles.documentsContainer}>
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
                    <IonIcon name="cloud-upload-outline" size={ms(18)} color="#fff" />
                )}
                <Text style={styles.uploadBtnText}>
                    {uploading ? 'Uploading…' : 'Upload Document'}
                </Text>
            </TouchableOpacity>

            {loadingDocuments && documents.length === 0 ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 10 }} />
            ) : documents.length > 0 ? (
                documents.map((doc, i) => {
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
                                    <IonIcon name={ds.icon} size={ms(20)} color={ds.color} />
                                </View>
                                <View style={{ flex: 1, marginLeft: ms(12) }}>
                                    <Text style={styles.docName} numberOfLines={1}>
                                        {name}
                                    </Text>
                                    <Text style={styles.docMeta}>
                                        {ext?.toUpperCase() || 'File'} · {formatDate(doc.createdAt || doc.uploadedAt)}
                                    </Text>
                                </View>
                                {url ? (
                                    <IonIcon name="open-outline" size={ms(16)} color={Colors.primary} style={{ marginLeft: 8 }} />
                                ) : null}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.docDeleteBtn}
                                onPress={() => handleDeleteDocument(doc)}
                                activeOpacity={0.7}
                            >
                                <IonIcon name="trash-outline" size={ms(18)} color={Colors.error} />
                            </TouchableOpacity>
                        </View>
                    );
                })
            ) : (
                <EmptyState
                    icon="folder-open-outline"
                    title="No documents yet"
                    subtitle="Tap 'Upload Document' above to add one"
                />
            )}
        </View>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 0: return renderActivitiesTab();
            case 1: return renderCallHistoryTab();
            case 2: return renderNotesTab();
            case 3: return renderDocumentsTab();
            default: return null;
        }
    };

    // ── Loading state ──

    if (loadingLead) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : null}
                    style={{ flex: 1 }}
                >
                    {renderHeader()}
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.loadingText}>Loading lead details…</Text>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // ── Main render ──

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {renderHeader()}
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[Colors.primary]}
                            tintColor={Colors.primary}
                        />
                    }
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Hero Card */}
                    {renderHeroCard()}

                    {/* Two-column layout for left sidebar and main*/}
                    <View style={styles.mainLayout}>
                        {/* Left Column */}
                        <View style={styles.leftColumn}>
                            {renderContactCard()}
                            {renderQuickActions()}
                            {renderCompanyCard()}
                            {renderSalespersonCard()}
                            {renderTagsCard()}
                        </View>


                    </View>
                    {/* Center Column: Tabs */}
                    <View style={styles.centerColumn}>
                        <View style={styles.tabsCard}>
                            {renderTabs()}
                            <View style={styles.tabContent}>
                                {renderTabContent()}
                            </View>
                        </View>
                    </View>

                    {/* Right section full width – stacked below on mobile */}
                    <View style={styles.rightColumns}>
                        {renderFollowUpCard()}
                        {renderLeadDetailsCard()}
                        {renderDocumentsCard()}
                    </View>

                    <View style={{ height: vs(40) }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.md,
    },
    loadingText: {
        fontSize: ms(14),
        color: Colors.textTertiary,
    },
    scrollContent: {
        paddingBottom: vs(20),
    },

    // ─ Top Bar ─
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    backBtn: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(14),
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.sm,
    },
    topBarTitle: {
        fontSize: ms(18),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    topBarActions: {
        flexDirection: 'row',
        gap: ms(8),
        alignItems: 'center',
    },
    editBtn: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(14),
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBtnText: {
        fontSize: ms(13),
        fontWeight: '600',
        color: Colors.primary,
    },
    deleteBtn: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(14),
        backgroundColor: Colors.errorBg || '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteBtnText: {
        fontSize: ms(13),
        fontWeight: '600',
        color: Colors.white,
    },

    // ─ Profile Card (Expo-style) ─
    profileCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: ms(20),
        alignItems: 'center',
        marginHorizontal: ms(12),
        marginTop: ms(12),
        ...Shadow.sm,
    },
    profileAvatar: {
        width: ms(72),
        height: ms(72),
        borderRadius: ms(36),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    profileAvatarText: {
        fontSize: ms(28),
        fontWeight: '800',
    },
    profileName: {
        fontSize: ms(22),
        fontWeight: '800',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    profileCompany: {
        fontSize: ms(14),
        color: Colors.textSecondary,
        marginTop: ms(4),
        textAlign: 'center',
    },
    profileBadgeRow: {
        flexDirection: 'row',
        gap: ms(8),
        marginTop: Spacing.md,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    profileStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(10),
        paddingVertical: ms(5),
        borderRadius: ms(10),
        gap: ms(4),
    },
    profileBadgeText: {
        fontSize: ms(12),
        fontWeight: '600',
    },
    profileSourceBadge: {
        backgroundColor: Colors.background,
        paddingHorizontal: ms(10),
        paddingVertical: ms(5),
        borderRadius: ms(10),
    },
    profileSourceText: {
        fontSize: ms(12),
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    profileQuickActions: {
        flexDirection: 'row',
        gap: Spacing.xl,
        marginTop: Spacing.lg,
        paddingTop: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
        width: '100%',
        justifyContent: 'center',
    },
    profileActionBtn: {
        alignItems: 'center',
        gap: ms(4),
    },
    profileActionLabel: {
        fontSize: ms(11),
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    profileValueBadge: {
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderRadius: ms(12),
        paddingHorizontal: ms(16),
        paddingVertical: ms(8),
        marginTop: Spacing.md,
        gap: ms(2),
    },
    profileValueText: {
        fontSize: ms(20),
        fontWeight: '800',
        color: '#059669',
        letterSpacing: -0.5,
    },
    profileExpectedText: {
        fontSize: ms(11),
        color: Colors.textTertiary,
    },

    // ─ Stage badge ─
    stageBadge: {
        paddingHorizontal: ms(10),
        paddingVertical: ms(3),
        borderRadius: ms(20),
    },
    stageBadgeText: {
        fontSize: ms(11),
        fontWeight: '700',
    },

    // ─ Prob badge ─
    probBadge: {
        backgroundColor: Colors.warningBg,
        paddingHorizontal: ms(10),
        paddingVertical: ms(3),
        borderRadius: ms(20),
    },
    probBadgeText: {
        fontSize: ms(11),
        fontWeight: '700',
        color: Colors.warning,
    },

    // ─ Main layout ─
    mainLayout: {
        flexDirection: 'row',
        paddingHorizontal: ms(12),
        marginTop: ms(10),
        gap: ms(10),
        alignItems: 'flex-start',
    },
    leftColumn: {
        // width: '100%',
        flex: 1,
        gap: ms(10),
    },
    centerColumn: {
        flex: 1,
        gap: ms(10),
        marginHorizontal: ms(10),
        marginTop: ms(10),
    },
    rightColumns: {
        paddingHorizontal: ms(12),
        marginTop: ms(10),
        gap: ms(10),
    },

    // ─ Side cards ─
    sideCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: ms(12),
        ...Shadow.sm,
    },
    sideCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
        marginBottom: ms(10),
    },
    sideCardTitle: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    // ─ Accordion ─
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
    },
    accordionTitle: {
        flex: 1,
        fontSize: ms(15),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    accordionBody: {
        paddingTop: ms(10),
    },

    // ─ Contact ─
    contactName: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.primary,
        marginBottom: ms(8),
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(5),
        marginBottom: ms(6),
    },
    contactEmail: {
        fontSize: ms(14),
        color: Colors.textSecondary,
        flex: 1,
    },
    contactPhone: {
        fontSize: ms(14),
        color: Colors.textSecondary,
    },

    // ─ Quick actions ─
    quickActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(8),
        paddingVertical: ms(8),
        paddingHorizontal: ms(10),
        borderRadius: ms(8),
        backgroundColor: Colors.background,
        marginBottom: ms(6),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    quickActionText: {
        fontSize: ms(14),
        fontWeight: '500',
        color: Colors.textPrimary,
    },

    // ─ Company ─
    companyName: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.primary,
    },

    // ─ Salesperson ─
    salespersonName: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: ms(6),
    },
    salespersonEmail: {
        fontSize: ms(14),
        color: Colors.textSecondary,
        flex: 1,
    },

    // ─ Tags ─
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ms(4),
    },
    tag: {
        backgroundColor: Colors.primaryBackground,
        paddingHorizontal: ms(8),
        paddingVertical: ms(3),
        borderRadius: ms(6),
    },
    tagText: {
        fontSize: ms(14),
        color: Colors.primary,
        fontWeight: '600',
    },
    tagsEmpty: {
        fontSize: ms(14),
        color: Colors.textTertiary,
    },

    // ─ Follow-up ─
    followUpDate: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    noFollowUp: {
        fontSize: ms(14),
        color: Colors.textTertiary,
        textAlign: 'center',
        paddingVertical: ms(8),
    },

    // ─ Info rows ─
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: ms(10),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    infoLabel: {
        fontSize: ms(14),
        color: Colors.textTertiary,
        flex: 1,
    },
    infoValue: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'right',
        flex: 1,
    },

    // ─ Tabs ─
    tabsCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        ...Shadow.sm,
        overflow: 'hidden',
    },
    tabBar: {
        flexDirection: 'row',
        position: 'relative',
        borderBottomWidth: 2,
        borderBottomColor: Colors.surfaceBorder,
    },
    tabItem: {
        flex: 1,
        paddingVertical: ms(13),
        alignItems: 'center',
    },
    tabText: {
        fontSize: ms(13),
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    tabTextActive: {
        color: Colors.primary,
        fontWeight: '700',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: -2,
        height: 2,
        backgroundColor: Colors.primary,
        borderRadius: 1,
    },
    tabContent: {
        minHeight: vs(160),
        padding: ms(12),
    },
    tabLoader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: vs(32),
        gap: ms(8),
    },
    tabLoaderText: {
        fontSize: ms(12),
        color: Colors.textTertiary,
    },

    // ─ Activities ─
    activitiesContainer: {
        gap: ms(0),
    },
    activityTimelineLabel: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: ms(12),
    },
    activityItem: {
        flexDirection: 'row',
        gap: ms(10),
        marginBottom: ms(14),
        position: 'relative',
    },
    activityIconCircle: {
        width: ms(36),
        height: ms(36),
        borderRadius: ms(18),
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    activityItemLine: {
        position: 'absolute',
        left: ms(17),
        top: ms(36),
        width: 2,
        bottom: -ms(14),
        backgroundColor: Colors.surfaceBorder,
    },
    activityContent: {
        flex: 1,
        paddingTop: ms(4),
        paddingBottom: ms(6),
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: ms(4),
    },
    activityTitle: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
        flex: 1,
    },
    activityDate: {
        fontSize: ms(10),
        color: Colors.textTertiary,
        fontWeight: '500',
        flexShrink: 0,
    },
    activityNote: {
        fontSize: ms(12),
        color: Colors.textSecondary,
        marginTop: ms(3),
        lineHeight: ms(17),
    },
    activityAssignee: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(4),
        marginTop: ms(4),
    },
    activityAssigneeText: {
        fontSize: ms(11),
        color: Colors.textTertiary,
    },
    loadMoreBtn: {
        alignItems: 'center',
        paddingVertical: ms(12),
        marginTop: ms(8),
        backgroundColor: Colors.white,
        borderRadius: ms(8),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },

    // ─ Call history ─
    callHistoryContainer: {
        gap: 0,
    },
    callItem: {
        flexDirection: 'row',
        gap: ms(10),
        paddingVertical: ms(10),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    callIconCircle: {
        width: ms(36),
        height: ms(36),
        borderRadius: ms(18),
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    callContent: {
        flex: 1,
        gap: ms(3),
    },
    callRow1: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    callNumber: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
        flex: 1,
    },
    callStatus: {
        fontSize: ms(11),
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    callRow2: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    callDateTime: {
        fontSize: ms(11),
        color: Colors.textTertiary,
    },
    callDuration: {
        fontSize: ms(11),
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    callAgent: {
        fontSize: ms(11),
        color: Colors.textTertiary,
    },

    // ── Notes ──
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
        borderColor: Colors.surfaceBorder,
        marginBottom: 16,
        ...Shadow.sm,
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
        borderColor: Colors.surfaceBorder,
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
    addNoteBtnText: {
        fontSize: ms(13),
        fontWeight: '700',
        color: '#fff',
    },
    cancelNoteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    noteItemCard: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        marginBottom: 12,
        ...Shadow.sm,
    },
    noteItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: ms(6),
    },
    noteUserBox: {
        flex: 1,
    },
    noteUserText: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    noteDateText: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        marginTop: 1,
    },
    noteItemActions: {
        flexDirection: 'row',
        gap: ms(12),
    },
    noteContentText: {
        fontSize: ms(14),
        color: Colors.textSecondary,
        lineHeight: ms(20),
    },

    // ─ Documents ─
    documentsContainer: {
        paddingVertical: ms(4),
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: ms(12),
        borderRadius: ms(12),
        gap: ms(8),
        marginBottom: ms(16),
        ...Shadow.sm,
    },
    uploadBtnText: {
        fontSize: ms(15),
        fontWeight: '700',
        color: '#fff',
    },
    docItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: ms(12),
        marginBottom: ms(10),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        overflow: 'hidden',
    },
    docItemInner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: ms(10),
    },
    docIconBox: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    docName: {
        fontSize: ms(14),
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    docMeta: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        marginTop: 2,
    },
    docDeleteBtn: {
        padding: ms(12),
        justifyContent: 'center',
        alignItems: 'center',
        borderLeftWidth: 1,
        borderLeftColor: Colors.divider,
    },

    // ─ Empty State ─
    emptyState: {
        alignItems: 'center',
        paddingVertical: vs(24),
        paddingHorizontal: ms(16),
        gap: ms(8),
    },
    emptyIconCircle: {
        width: ms(52),
        height: ms(52),
        borderRadius: ms(26),
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: ms(4),
    },
    emptyTitle: {
        fontSize: ms(13),
        fontWeight: '600',
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        textAlign: 'center',
        lineHeight: ms(16),
    },
});

export default LeadDetailsScreen;
