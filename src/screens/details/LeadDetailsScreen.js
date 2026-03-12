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
} from 'react-native';

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
import { leadsAPI, settingsAPI } from '../../api';
import { showError } from '../../utils';

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
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [activitiesLoaded, setActivitiesLoaded] = useState(false);

    // Call history
    const [callHistory, setCallHistory] = useState([]);
    const [loadingCalls, setLoadingCalls] = useState(false);
    const [callsLoaded, setCallsLoaded] = useState(false);

    const tabAnim = useRef(new Animated.Value(0)).current;

    // ── API calls ──

    const fetchLeadDetail = useCallback(async () => {
        if (!leadId) return;
        try {
            const res = await leadsAPI.getById(leadId);
            if (res.success) {
                const data = res.data?.data || res.data;
                if (data) setLead(data);
            }
        } catch (e) {
            // Keep initial lead data
        } finally {
            setLoadingLead(false);
        }
    }, [leadId]);

    const fetchActivities = useCallback(async () => {
        if (!leadId || loadingActivities) return;
        setLoadingActivities(true);
        try {
            const res = await leadsAPI.getActivities(leadId, { page: 1, limit: 20 });
            if (res.success) {
                const data = res.data?.data || res.data?.activities || res.data || [];
                setActivities(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            // silently fail
        } finally {
            setLoadingActivities(false);
            setActivitiesLoaded(true);
        }
    }, [leadId]);

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
    }, []);

    useEffect(() => {
        if (activeTab === 0 && !activitiesLoaded) {
            fetchActivities();
        } else if (activeTab === 1 && !callsLoaded) {
            fetchCallHistory();
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
        setCallsLoaded(false);
        await fetchLeadDetail();
        if (activeTab === 0) await fetchActivities();
        if (activeTab === 1) await fetchCallHistory();
        setRefreshing(false);
    }, [activeTab]);

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
                        }
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
        const notes = lead?.notes || lead?.description || '';
        if (!notes) {
            return (
                <EmptyState
                    icon="document-text-outline"
                    title="No notes yet"
                    subtitle="Notes will appear here"
                />
            );
        }
        return (
            <View style={styles.notesContainer}>
                <Text style={styles.notesText}>{notes}</Text>
            </View>
        );
    };

    const renderDocumentsTab = () => (
        <EmptyState
            icon="cloud-upload-outline"
            title="No documents uploaded"
            subtitle="Upload documents to attach them to this lead"
        />
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
                {renderHeader()}
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading lead details…</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ── Main render ──

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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

    // ─ Notes ─
    notesContainer: {
        paddingVertical: ms(8),
    },
    notesText: {
        fontSize: ms(13),
        color: Colors.textSecondary,
        lineHeight: ms(20),
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
