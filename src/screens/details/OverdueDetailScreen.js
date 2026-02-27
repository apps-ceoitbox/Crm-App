/**
 * Overdue Detail Screen
 * Modern CRM-style mobile UI with card sections, edit modal, and polished UX
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Linking,
    Modal,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';

import { leadsAPI, settingsAPI } from '../../api';
import { showSuccess, showError } from '../../utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'activities', label: 'Activities', icon: 'time-outline' },
    { id: 'call_history', label: 'Call History', icon: 'call-outline' },
    { id: 'notes', label: 'Notes', icon: 'document-text-outline' },
    { id: 'documents', label: 'Documents', icon: 'folder-outline' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Section card wrapper */
const Card = ({ style, children }) => (
    <View style={[styles.card, style]}>{children}</View>
);

/** Section card header row */
const CardHeader = ({ icon, title, rightElement }) => (
    <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIconWrap}>
                <IonIcon name={icon} size={ms(15)} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {rightElement && <View>{rightElement}</View>}
    </View>
);

/** Key-value detail row */
const InfoRow = ({ label, value, isLast, badgeColor, valueStyle }) => (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
        <Text style={styles.infoLabel}>{label}</Text>
        {badgeColor ? (
            <View style={[styles.infoBadge, { backgroundColor: badgeColor + '20' }]}>
                <Text style={[styles.infoBadgeText, { color: badgeColor }]}>{value || 'N/A'}</Text>
            </View>
        ) : (
            <Text style={[styles.infoValue, valueStyle]} numberOfLines={2}>{value || 'N/A'}</Text>
        )}
    </View>
);

/** Thin divider */
const Divider = () => <View style={styles.divider} />;

/** Editable form input */
const FormInput = ({ label, value, onChangeText, placeholder, keyboardType, multiline, error }) => (
    <View style={styles.formField}>
        <Text style={styles.formLabel}>{label}</Text>
        <TextInput
            style={[styles.formInput, multiline && styles.formInputMulti, error && styles.formInputError]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder || ''}
            placeholderTextColor={Colors.textTertiary}
            keyboardType={keyboardType || 'default'}
            multiline={multiline}
            numberOfLines={multiline ? 3 : 1}
            textAlignVertical={multiline ? 'top' : 'center'}
        />
        {error ? <Text style={styles.formError}>{error}</Text> : null}
    </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const OverdueDetailScreen = ({ route, navigation }) => {
    const leadId = route.params?.id;
    const clientNumber = route.params?.phoneNumber;

    // Data state
    const [lead, setLead] = useState(null);
    const [callHistory, setCallHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // UI state
    const [activeTab, setActiveTab] = useState('activities');
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [updateLoading, setUpdateLoading] = useState(false);

    // Edit form state
    const [formData, setFormData] = useState({
        title: '',
        value: '',
        currency: '',
        notes: '',
        expectedCloseDate: '',
        followupDate: '',
    });
    const [formErrors, setFormErrors] = useState({});

    // Animation
    const slideAnim = useRef(new Animated.Value(30)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [leadRes, historyRes] = await Promise.all([
                leadsAPI.getById(leadId),
                settingsAPI.getCallHistory({
                    client_numbers: clientNumber,
                    lead_id: leadId,
                    page_size: 100,
                }),
            ]);

            if (leadRes.success) {
                const leadData = leadRes.data?.data || leadRes.data;
                setLead(leadData);
                // Pre-fill edit form
                setFormData({
                    title: leadData?.title || '',
                    value: leadData?.value?.toString() || '',
                    currency: leadData?.currency || 'INR',
                    notes: leadData?.notes || '',
                    expectedCloseDate: leadData?.expectedCloseDate || '',
                    followupDate: leadData?.followupDate || '',
                });
            } else {
                setError('Failed to load lead details');
            }

            if (historyRes.success) {
                setCallHistory(historyRes.data?.data || historyRes.data || []);
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
            // Animate content in
            Animated.parallel([
                Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
            ]).start();
        }
    }, [leadId, clientNumber]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Edit ───────────────────────────────────────────────────────────────────

    const validateForm = () => {
        const errors = {};
        if (!formData.title.trim()) errors.title = 'Title is required';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleUpdate = async () => {
        if (!validateForm()) return;
        setUpdateLoading(true);
        try {
            const payload = {
                title: formData.title.trim(),
                value: formData.value ? parseFloat(formData.value) : undefined,
                currency: formData.currency,
                notes: formData.notes,
            };
            const res = await leadsAPI.update(leadId, payload);
            if (res.success) {
                showSuccess('Success', 'Lead updated successfully');
                setEditModalVisible(false);
                fetchData(); // Re-fetch to reflect changes
            } else {
                showError('Error', res.error || 'Failed to update lead');
            }
        } catch {
            showError('Error', 'Failed to update lead');
        } finally {
            setUpdateLoading(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────

    const handleDelete = () => {
        Alert.alert(
            'Delete Lead',
            `Are you sure you want to delete "${lead?.title}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleteLoading(true);
                        try {
                            const res = await leadsAPI.delete(leadId);
                            if (res.success) {
                                showSuccess('Deleted', 'Lead deleted successfully');
                                navigation.goBack();
                            } else {
                                showError('Error', res.error || 'Failed to delete lead');
                            }
                        } catch {
                            showError('Error', 'Failed to delete lead');
                        } finally {
                            setDeleteLoading(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Helpers ────────────────────────────────────────────────────────────────

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch {
            return dateStr;
        }
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    };

    const getStageColor = (stageName) => {
        if (!stageName) return Colors.textTertiary;
        const name = stageName.toLowerCase();
        if (name.includes('contacted')) return Colors.primary;
        if (name.includes('proposal')) return Colors.info;
        if (name.includes('negotiation')) return Colors.warning;
        if (name.includes('won')) return Colors.success;
        if (name.includes('lost')) return Colors.danger;
        return Colors.secondary;
    };

    // ── Loading / Error States ─────────────────────────────────────────────────

    if (loading) {
        return (
            <SafeAreaView style={styles.centered} edges={['top']}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading details…</Text>
            </SafeAreaView>
        );
    }

    if (error || !lead) {
        return (
            <SafeAreaView style={styles.centered} edges={['top']}>
                <View style={styles.errorIconWrap}>
                    <IonIcon name="alert-circle-outline" size={ms(56)} color={Colors.danger} />
                </View>
                <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
                <Text style={styles.errorSubtitle}>{error || 'Lead not found'}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
                    <IonIcon name="refresh-outline" size={ms(16)} color="#fff" />
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const contactName = [lead.contact?.firstName, lead.contact?.lastName].filter(Boolean).join(' ') || 'N/A';
    const stageColor = getStageColor(lead.stage?.name);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* ── Top Nav Bar ── */}
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navIconBtn}>
                    <IonIcon name="arrow-back" size={ms(20)} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.navTitle} numberOfLines={1}>Overdue Detail</Text>
                <View style={styles.navActions}>
                    <TouchableOpacity
                        style={styles.navIconBtn}
                        onPress={() => Linking.openURL(`tel:${clientNumber}`)}
                    >
                        <IonIcon name="call" size={ms(18)} color={Colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            <Animated.ScrollView
                style={{ opacity: opacityAnim, transform: [{ translateY: slideAnim }] }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ══ HERO CARD ══ */}
                <Card style={styles.heroCard}>
                    <View style={styles.heroTop}>
                        {/* Avatar */}
                        <View style={styles.heroAvatar}>
                            <Text style={styles.heroAvatarText}>{getInitials(lead.title)}</Text>
                        </View>
                        <View style={styles.heroInfo}>
                            <Text style={styles.heroTitle} numberOfLines={2}>{lead.title || 'N/A'}</Text>
                            <View style={[styles.stageBadge, { backgroundColor: stageColor + '18' }]}>
                                <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
                                <Text style={[styles.stageBadgeText, { color: stageColor }]}>
                                    {lead.stage?.name || 'Unknown Stage'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Divider />

                    {/* Value + Expected close */}
                    <View style={styles.heroStats}>
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatLabel}>Deal Value</Text>
                            <Text style={styles.heroStatValue}>
                                ₹{lead.value?.toLocaleString('en-IN') || '0'}
                            </Text>
                        </View>
                        <View style={styles.heroStatDivider} />
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatLabel}>Expected Close</Text>
                            <Text style={styles.heroStatDate}>{formatDate(lead.expectedCloseDate)}</Text>
                        </View>
                        <View style={styles.heroStatDivider} />
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatLabel}>Probability</Text>
                            <Text style={styles.heroStatValue}>{lead.stage?.probability ? `${lead.stage.probability}%` : 'N/A'}</Text>
                        </View>
                    </View>

                    <Divider />

                    {/* Salesperson row */}
                    <View style={styles.heroBottom}>
                        <View style={styles.heroSalesperson}>
                            <IonIcon name="person-circle-outline" size={ms(16)} color={Colors.textTertiary} />
                            <Text style={styles.heroSalespersonText}>
                                {lead.salesperson?.name || 'No salesperson'}
                            </Text>
                        </View>
                        {/* Call Now button */}
                        <TouchableOpacity
                            style={styles.callBtn}
                            onPress={() => Linking.openURL(`tel:${clientNumber}`)}
                            activeOpacity={0.85}
                        >
                            <IonIcon name="call" size={ms(14)} color="#fff" />
                            <Text style={styles.callBtnText}>Call Now</Text>
                        </TouchableOpacity>
                    </View>
                </Card>

                {/* ══ ACTION BUTTONS ══ */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => setEditModalVisible(true)}
                        activeOpacity={0.85}
                    >
                        <IonIcon name="create-outline" size={ms(16)} color={Colors.primary} />
                        <Text style={styles.editBtnText}>Edit Lead</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={handleDelete}
                        activeOpacity={0.85}
                        disabled={deleteLoading}
                    >
                        {deleteLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <IonIcon name="trash-outline" size={ms(16)} color="#fff" />
                                <Text style={styles.deleteBtnText}>Delete</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ══ CONTACT CARD ══ */}
                <Card>
                    <CardHeader icon="person-outline" title="Contact" />
                    <Divider />
                    {/* Avatar row */}
                    <View style={styles.contactAvatarRow}>
                        <View style={styles.contactAvatar}>
                            <Text style={styles.contactAvatarText}>{getInitials(contactName)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.contactName}>{contactName}</Text>
                            {lead.company?.name ? (
                                <Text style={styles.contactCompany}>{lead.company.name}</Text>
                            ) : null}
                        </View>
                    </View>
                    <View style={styles.contactActions}>
                        {lead.contact?.email ? (
                            <TouchableOpacity
                                style={styles.contactChip}
                                onPress={() => Linking.openURL(`mailto:${lead.contact.email}`)}
                            >
                                <IonIcon name="mail-outline" size={ms(13)} color={Colors.info} />
                                <Text style={styles.contactChipText} numberOfLines={1}>
                                    {lead.contact.email}
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                        {lead.contact?.phone ? (
                            <TouchableOpacity
                                style={styles.contactChip}
                                onPress={() => Linking.openURL(`tel:${lead.contact.phone}`)}
                            >
                                <IonIcon name="call-outline" size={ms(13)} color={Colors.success} />
                                <Text style={styles.contactChipText}>{lead.contact.phone}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </Card>

                {/* ══ COMPANY CARD ══ */}
                <Card>
                    <CardHeader icon="business-outline" title="Company" />
                    <Divider />
                    <Text style={styles.companyName}>{lead.company?.name || 'N/A'}</Text>
                </Card>

                {/* ══ SALESPERSON CARD ══ */}
                <Card>
                    <CardHeader icon="people-outline" title="Salesperson" />
                    <Divider />
                    <Text style={styles.salespersonName}>{lead.salesperson?.name || 'N/A'}</Text>
                    {lead.salesperson?.email ? (
                        <TouchableOpacity
                            style={styles.emailLinkRow}
                            onPress={() => Linking.openURL(`mailto:${lead.salesperson.email}`)}
                        >
                            <IonIcon name="mail-outline" size={ms(13)} color={Colors.textTertiary} />
                            <Text style={styles.emailLinkText}>{lead.salesperson.email}</Text>
                        </TouchableOpacity>
                    ) : null}
                </Card>

                {/* ══ TABS ══ */}
                <Card style={styles.tabCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
                        {TABS.map(tab => {
                            const active = activeTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.tabItem, active && styles.tabItemActive]}
                                    onPress={() => setActiveTab(tab.id)}
                                    activeOpacity={0.8}
                                >
                                    <IonIcon
                                        name={tab.icon}
                                        size={ms(14)}
                                        color={active ? Colors.primary : Colors.textTertiary}
                                    />
                                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.tabContent}>
                        {activeTab === 'activities' && <ActivitiesPanel />}
                        {activeTab === 'call_history' && <CallHistoryPanel callHistory={callHistory} />}
                        {activeTab === 'notes' && <EmptyPanel icon="document-text-outline" message="No notes added yet" />}
                        {activeTab === 'documents' && <EmptyPanel icon="folder-outline" message="No documents linked" />}
                    </View>
                </Card>

                {/* ══ LEAD DETAILS CARD ══ */}
                <Card>
                    <CardHeader icon="cash-outline" title="Lead Details" />
                    <Divider />
                    <View style={styles.detailsList}>
                        <InfoRow label="Deal Value" value={lead.value ? `₹${lead.value.toLocaleString('en-IN')}` : 'N/A'} />
                        <InfoRow label="Currency" value={lead.currency || 'INR'} />
                        <InfoRow label="Stage" value={lead.stage?.name} badgeColor={stageColor} />
                        <InfoRow label="Probability" value={lead.stage?.probability ? `${lead.stage.probability}%` : 'N/A'} />
                        <InfoRow label="Expected Close" value={formatDate(lead.expectedCloseDate)} />
                        <InfoRow label="Follow-up Date" value={formatDate(lead.followupDate)} />
                        <InfoRow label="Owner" value={lead.owner?.name} />
                        <InfoRow label="Created" value={formatDate(lead.createdAt)} />
                        <InfoRow label="Created By" value={lead.createdBy?.name} />
                        <InfoRow label="Last Updated" value={formatDate(lead.updatedAt)} />
                        <InfoRow label="Updated By" value={lead.updatedBy?.name} isLast />
                    </View>
                </Card>

                {/* ══ NEXT FOLLOW-UP CARD ══ */}
                <Card>
                    <CardHeader icon="calendar-outline" title="Next Follow-Up" />
                    <Divider />
                    {lead.followupDate ? (
                        <View style={styles.followupRow}>
                            <View style={styles.followupIconWrap}>
                                <IonIcon name="calendar" size={ms(20)} color={Colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.followupDate}>{formatDate(lead.followupDate)}</Text>
                                <Text style={styles.followupSub}>Scheduled follow-up</Text>
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.emptyMiniText}>No follow-ups scheduled</Text>
                    )}
                </Card>

                {/* ══ TAGS CARD ══ */}
                <Card>
                    <CardHeader icon="pricetag-outline" title="Tags" />
                    <Divider />
                    {lead.tags && lead.tags.length > 0 ? (
                        <View style={styles.tagsWrap}>
                            {lead.tags.map((tag, i) => (
                                <View key={i} style={styles.tag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyMiniText}>No tags</Text>
                    )}
                </Card>

                <View style={{ height: ms(40) }} />
            </Animated.ScrollView>

            {/* ══════════════════════════════════════════════════
                  EDIT LEAD MODAL
             ══════════════════════════════════════════════════ */}
            <Modal
                visible={editModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <SafeAreaView style={styles.modalContainer} edges={['top']}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Edit Lead</Text>
                                <Text style={styles.modalSubtitle}>Update the lead details below</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setEditModalVisible(false)}
                                style={styles.modalCloseBtn}
                            >
                                <IonIcon name="close" size={ms(22)} color={Colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <Divider />

                        <ScrollView
                            contentContainerStyle={styles.modalContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Read-only contact/company context */}
                            <View style={styles.modalContextRow}>
                                <View style={styles.modalContextItem}>
                                    <Text style={styles.modalContextLabel}>Contact</Text>
                                    <Text style={styles.modalContextValue}>{contactName}</Text>
                                </View>
                                <View style={styles.modalContextDivider} />
                                <View style={styles.modalContextItem}>
                                    <Text style={styles.modalContextLabel}>Company</Text>
                                    <Text style={styles.modalContextValue}>
                                        {lead.company?.name || 'N/A'}
                                    </Text>
                                </View>
                            </View>

                            {/* Editable fields */}
                            <FormInput
                                label="Lead Title *"
                                value={formData.title}
                                onChangeText={(v) => setFormData(p => ({ ...p, title: v }))}
                                placeholder="Enter lead title"
                                error={formErrors.title}
                            />

                            <View style={styles.formRow}>
                                <View style={{ flex: 1, marginRight: ms(8) }}>
                                    <FormInput
                                        label="Deal Value"
                                        value={formData.value}
                                        onChangeText={(v) => setFormData(p => ({ ...p, value: v.replace(/[^0-9.]/g, '') }))}
                                        placeholder="0"
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FormInput
                                        label="Currency"
                                        value={formData.currency}
                                        onChangeText={(v) => setFormData(p => ({ ...p, currency: v.toUpperCase() }))}
                                        placeholder="INR"
                                    />
                                </View>
                            </View>

                            <FormInput
                                label="Expected Close Date"
                                value={formData.expectedCloseDate ? formatDate(formData.expectedCloseDate) : ''}
                                onChangeText={(v) => setFormData(p => ({ ...p, expectedCloseDate: v }))}
                                placeholder="e.g. Jan 20, 2026"
                            />

                            <FormInput
                                label="Follow-up Date"
                                value={formData.followupDate ? formatDate(formData.followupDate) : ''}
                                onChangeText={(v) => setFormData(p => ({ ...p, followupDate: v }))}
                                placeholder="e.g. Jan 19, 2026"
                            />

                            <FormInput
                                label="Notes"
                                value={formData.notes}
                                onChangeText={(v) => setFormData(p => ({ ...p, notes: v }))}
                                placeholder="Add any notes…"
                                multiline
                            />

                            <View style={{ height: ms(20) }} />
                        </ScrollView>

                        {/* Modal Footer Buttons */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalUpdateBtn, updateLoading && { opacity: 0.7 }]}
                                onPress={handleUpdate}
                                disabled={updateLoading}
                            >
                                {updateLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <IonIcon name="save-outline" size={ms(16)} color="#fff" />
                                        <Text style={styles.modalUpdateText}>Update Lead</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

// ─── Panel Sub-components ─────────────────────────────────────────────────────

const ActivitiesPanel = () => {
    const activities = [
        { type: 'activity', date: 'Feb 6, 2026 11:11 AM', content: 'Stage changed from Proposal Sent to Contacted' },
        { type: 'task', date: 'Jan 28, 2026 11:00 AM', content: 'Follow-up task created: Follow up: Accelerator Plan Inquiry' },
        { type: 'task', date: 'Jan 28, 2026 11:00 AM', content: 'Task created: Follow up: Accelerator Plan Inquiry' },
        { type: 'activity', date: 'Jan 18, 2026 7:04 PM', content: 'Stage changed from Final Review to Proposal Sent' },
        { type: 'activity', date: 'Jan 18, 2026 6:58 PM', content: 'Stage changed from Proposal Sent to Final Review' },
        { type: 'activity', date: 'Jan 18, 2026 5:24 PM', content: 'Stage changed from Contacted to Proposal Sent' },
    ];

    return (
        <View>
            <Text style={styles.panelTitle}>Activity Timeline</Text>
            {activities.map((item, idx) => {
                const isTask = item.type === 'task';
                const isLast = idx === activities.length - 1;
                return (
                    <View key={idx} style={styles.timelineItem}>
                        <View style={styles.timelineTrack}>
                            <View style={[styles.timelineDot, { backgroundColor: isTask ? Colors.success : Colors.primary }]}>
                                <IonIcon
                                    name={isTask ? 'checkbox' : 'swap-horizontal'}
                                    size={ms(9)}
                                    color="#fff"
                                />
                            </View>
                            {!isLast && <View style={styles.timelineLine} />}
                        </View>
                        <View style={[styles.timelineBody, isLast && { marginBottom: 0 }]}>
                            <View style={styles.timelineMeta}>
                                <View style={[styles.timelineBadge, { backgroundColor: isTask ? Colors.successBg : Colors.primaryBackground }]}>
                                    <Text style={[styles.timelineBadgeText, { color: isTask ? Colors.success : Colors.primary }]}>
                                        {isTask ? 'Task' : 'Activity'}
                                    </Text>
                                </View>
                                <Text style={styles.timelineDate}>{item.date}</Text>
                            </View>
                            <Text style={styles.timelineContent}>{item.content}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const CallHistoryPanel = ({ callHistory }) => {
    const getCallIcon = (type) => {
        if (!type) return 'call-outline';
        const t = type.toLowerCase();
        if (t.includes('incoming') || t.includes('inbound')) return 'call-outline';
        if (t.includes('missed')) return 'call-outline';
        return 'call-outline';
    };

    const getCallColor = (type) => {
        if (!type) return Colors.primary;
        const t = type.toLowerCase();
        if (t.includes('missed')) return Colors.danger;
        if (t.includes('incoming') || t.includes('inbound')) return Colors.info;
        return Colors.success;
    };

    if (!callHistory || callHistory.length === 0) {
        return <EmptyPanel icon="call-outline" message="No call history found" />;
    }

    return (
        <View>
            <Text style={styles.panelTitle}>Call History ({callHistory.length})</Text>
            {callHistory.map((call, idx) => {
                const callType = call.type || call.call_type || 'Outgoing';
                const callColor = getCallColor(callType);
                return (
                    <View key={idx} style={[styles.callItem, idx === callHistory.length - 1 && { borderBottomWidth: 0 }]}>
                        <View style={[styles.callIconWrap, { backgroundColor: callColor + '15' }]}>
                            <IonIcon name={getCallIcon(callType)} size={ms(16)} color={callColor} />
                        </View>
                        <View style={styles.callMeta}>
                            <Text style={styles.callType}>{callType}</Text>
                            <Text style={styles.callTime}>{call.date || call.call_date || 'N/A'}</Text>
                        </View>
                        <View style={styles.callRight}>
                            <Text style={styles.callDuration}>{call.duration || call.call_duration || 'N/A'}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const EmptyPanel = ({ icon, message }) => (
    <View style={styles.emptyPanel}>
        <View style={styles.emptyIconWrap}>
            <IonIcon name={icon} size={ms(32)} color={Colors.textTertiary} />
        </View>
        <Text style={styles.emptyPanelText}>{message}</Text>
    </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centered: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: ms(24),
    },

    // ── Nav ──
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(16),
        paddingVertical: ms(10),
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    navIconBtn: {
        width: ms(36),
        height: ms(36),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navTitle: {
        flex: 1,
        fontSize: ms(17),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginLeft: ms(10),
    },
    navActions: {
        flexDirection: 'row',
        gap: ms(6),
    },

    // ── Scroll ──
    scrollContent: {
        paddingHorizontal: ms(16),
        paddingTop: ms(16),
        paddingBottom: ms(24),
    },

    // ── Card ──
    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: ms(16),
        marginBottom: ms(12),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        ...Shadow.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ms(10),
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(8),
    },
    cardIconWrap: {
        width: ms(28),
        height: ms(28),
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: 0.1,
    },

    // ── Divider ──
    divider: {
        height: 1,
        backgroundColor: Colors.surfaceBorder,
        marginVertical: ms(10),
    },

    // ── Hero ──
    heroCard: {
        marginBottom: ms(10),
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: ms(12),
    },
    heroAvatar: {
        width: ms(48),
        height: ms(48),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: ms(12),
    },
    heroAvatarText: {
        fontSize: ms(17),
        fontWeight: '800',
        color: Colors.primary,
    },
    heroInfo: {
        flex: 1,
    },
    heroTitle: {
        fontSize: ms(17),
        fontWeight: '800',
        color: Colors.textPrimary,
        lineHeight: ms(22),
        marginBottom: ms(6),
    },
    stageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: ms(10),
        paddingVertical: ms(4),
        borderRadius: BorderRadius.full,
        gap: ms(5),
    },
    stageDot: {
        width: ms(6),
        height: ms(6),
        borderRadius: ms(3),
    },
    stageBadgeText: {
        fontSize: ms(11),
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(4),
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatDivider: {
        width: 1,
        height: ms(30),
        backgroundColor: Colors.surfaceBorder,
    },
    heroStatLabel: {
        fontSize: ms(10),
        color: Colors.textTertiary,
        marginBottom: ms(3),
        fontWeight: '500',
    },
    heroStatValue: {
        fontSize: ms(15),
        fontWeight: '800',
        color: Colors.success,
    },
    heroStatDate: {
        fontSize: ms(12),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    heroBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    heroSalesperson: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(5),
    },
    heroSalespersonText: {
        fontSize: ms(12),
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    callBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.success,
        paddingHorizontal: ms(14),
        paddingVertical: ms(7),
        borderRadius: BorderRadius.md,
        gap: ms(5),
    },
    callBtnText: {
        color: '#fff',
        fontSize: ms(13),
        fontWeight: '700',
    },

    // ── Action Row ──
    actionRow: {
        flexDirection: 'row',
        gap: ms(10),
        marginBottom: ms(12),
    },
    editBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ms(6),
        paddingVertical: ms(11),
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.primary,
        backgroundColor: Colors.surface,
    },
    editBtnText: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.primary,
    },
    deleteBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ms(6),
        paddingVertical: ms(11),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.danger,
    },
    deleteBtnText: {
        fontSize: ms(14),
        fontWeight: '700',
        color: '#fff',
    },

    // ── Contact Card ──
    contactAvatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(12),
        marginBottom: ms(10),
    },
    contactAvatar: {
        width: ms(42),
        height: ms(42),
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.infoBg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contactAvatarText: {
        fontSize: ms(15),
        fontWeight: '800',
        color: Colors.info,
    },
    contactName: {
        fontSize: ms(15),
        fontWeight: '700',
        color: Colors.primary,
    },
    contactCompany: {
        fontSize: ms(12),
        color: Colors.textTertiary,
        marginTop: ms(2),
    },
    contactActions: {
        gap: ms(6),
    },
    contactChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
        backgroundColor: Colors.background,
        paddingHorizontal: ms(10),
        paddingVertical: ms(7),
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    contactChipText: {
        fontSize: ms(12),
        color: Colors.textSecondary,
        flex: 1,
    },

    // ── Company / Salesperson ──
    companyName: {
        fontSize: ms(15),
        fontWeight: '700',
        color: Colors.primary,
    },
    salespersonName: {
        fontSize: ms(15),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: ms(4),
    },
    emailLinkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(5),
        marginTop: ms(4),
    },
    emailLinkText: {
        fontSize: ms(12),
        color: Colors.textSecondary,
    },

    // ── Tabs ──
    tabCard: {
        paddingHorizontal: 0,
        paddingTop: 0,
        overflow: 'hidden',
    },
    tabBar: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(14),
        paddingVertical: ms(12),
        gap: ms(5),
    },
    tabItemActive: {
        borderBottomWidth: 2.5,
        borderBottomColor: Colors.primary,
    },
    tabText: {
        fontSize: ms(12),
        fontWeight: '600',
        color: Colors.textTertiary,
    },
    tabTextActive: {
        color: Colors.primary,
    },
    tabContent: {
        padding: ms(16),
        minHeight: ms(140),
    },

    // ── Panel common ──
    panelTitle: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: ms(14),
    },
    emptyPanel: {
        alignItems: 'center',
        paddingVertical: ms(30),
    },
    emptyIconWrap: {
        width: ms(56),
        height: ms(56),
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: ms(10),
    },
    emptyPanelText: {
        fontSize: ms(13),
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },

    // ── Activity Timeline ──
    timelineItem: {
        flexDirection: 'row',
        marginBottom: ms(12),
    },
    timelineTrack: {
        alignItems: 'center',
        width: ms(22),
        marginRight: ms(10),
    },
    timelineDot: {
        width: ms(22),
        height: ms(22),
        borderRadius: ms(11),
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: Colors.surfaceBorder,
        marginTop: 2,
    },
    timelineBody: {
        flex: 1,
        marginBottom: ms(4),
    },
    timelineMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ms(4),
    },
    timelineBadge: {
        paddingHorizontal: ms(7),
        paddingVertical: ms(2),
        borderRadius: BorderRadius.xs,
    },
    timelineBadgeText: {
        fontSize: ms(10),
        fontWeight: '700',
    },
    timelineDate: {
        fontSize: ms(10),
        color: Colors.textTertiary,
    },
    timelineContent: {
        fontSize: ms(12),
        color: Colors.textSecondary,
        lineHeight: ms(17),
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.sm,
        padding: ms(8),
    },

    // ── Call History ──
    callItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(10),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    callIconWrap: {
        width: ms(36),
        height: ms(36),
        borderRadius: BorderRadius.round,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: ms(12),
    },
    callMeta: {
        flex: 1,
    },
    callType: {
        fontSize: ms(13),
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    callTime: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        marginTop: ms(2),
    },
    callRight: {
        alignItems: 'flex-end',
    },
    callDuration: {
        fontSize: ms(12),
        color: Colors.textSecondary,
        fontWeight: '500',
    },

    // ── Info Rows ──
    detailsList: {},
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: ms(9),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    infoRowLast: {
        borderBottomWidth: 0,
    },
    infoLabel: {
        fontSize: ms(12),
        color: Colors.textTertiary,
        fontWeight: '500',
        flex: 1,
    },
    infoValue: {
        fontSize: ms(12),
        fontWeight: '600',
        color: Colors.textPrimary,
        textAlign: 'right',
        flex: 1,
    },
    infoBadge: {
        paddingHorizontal: ms(8),
        paddingVertical: ms(3),
        borderRadius: BorderRadius.xs,
    },
    infoBadgeText: {
        fontSize: ms(11),
        fontWeight: '700',
    },

    // ── Follow-up ──
    followupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(12),
    },
    followupIconWrap: {
        width: ms(40),
        height: ms(40),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    followupDate: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    followupSub: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        marginTop: ms(2),
    },

    // ── Tags ──
    tagsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ms(6),
    },
    tag: {
        backgroundColor: Colors.primaryBackground,
        paddingHorizontal: ms(10),
        paddingVertical: ms(4),
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        borderColor: Colors.primaryBorder,
    },
    tagText: {
        fontSize: ms(11),
        color: Colors.primary,
        fontWeight: '600',
    },
    emptyMiniText: {
        fontSize: ms(12),
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },

    // ── Loading / Error ──
    loadingText: {
        marginTop: ms(12),
        fontSize: ms(14),
        color: Colors.textSecondary,
    },
    errorIconWrap: {
        width: ms(80),
        height: ms(80),
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.dangerBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: ms(16),
    },
    errorTitle: {
        fontSize: ms(17),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: ms(6),
    },
    errorSubtitle: {
        fontSize: ms(13),
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: ms(24),
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
        backgroundColor: Colors.primary,
        paddingHorizontal: ms(24),
        paddingVertical: ms(12),
        borderRadius: BorderRadius.md,
    },
    retryText: {
        color: '#fff',
        fontSize: ms(14),
        fontWeight: '700',
    },

    // ══ MODAL ══
    modalContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: ms(20),
        paddingTop: ms(16),
        paddingBottom: ms(12),
        backgroundColor: Colors.surface,
    },
    modalTitle: {
        fontSize: ms(20),
        fontWeight: '800',
        color: Colors.textPrimary,
    },
    modalSubtitle: {
        fontSize: ms(12),
        color: Colors.textSecondary,
        marginTop: ms(2),
    },
    modalCloseBtn: {
        width: ms(34),
        height: ms(34),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: ms(4),
    },
    modalContent: {
        paddingHorizontal: ms(20),
        paddingTop: ms(16),
    },
    modalContextRow: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: ms(12),
        marginBottom: ms(16),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    modalContextItem: {
        flex: 1,
    },
    modalContextDivider: {
        width: 1,
        backgroundColor: Colors.surfaceBorder,
        marginHorizontal: ms(12),
    },
    modalContextLabel: {
        fontSize: ms(10),
        color: Colors.textTertiary,
        fontWeight: '500',
        marginBottom: ms(3),
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    modalContextValue: {
        fontSize: ms(13),
        color: Colors.textPrimary,
        fontWeight: '600',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: ms(10),
        paddingHorizontal: ms(20),
        paddingVertical: ms(14),
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.surfaceBorder,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: ms(13),
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelText: {
        fontSize: ms(14),
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    modalUpdateBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ms(6),
        paddingVertical: ms(13),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
    },
    modalUpdateText: {
        fontSize: ms(14),
        fontWeight: '700',
        color: '#fff',
    },

    // ── Form Inputs ──
    formField: {
        marginBottom: ms(14),
    },
    formRow: {
        flexDirection: 'row',
    },
    formLabel: {
        fontSize: ms(12),
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: ms(6),
    },
    formInput: {
        backgroundColor: Colors.surface,
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
        borderRadius: BorderRadius.md,
        paddingHorizontal: ms(12),
        paddingVertical: ms(11),
        fontSize: ms(14),
        color: Colors.textPrimary,
        height: ms(46),
    },
    formInputMulti: {
        height: ms(90),
        paddingTop: ms(10),
    },
    formInputError: {
        borderColor: Colors.danger,
    },
    formError: {
        fontSize: ms(11),
        color: Colors.danger,
        marginTop: ms(4),
    },
});

export default OverdueDetailScreen;
