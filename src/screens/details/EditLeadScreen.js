/**
 * EditLeadScreen
 * Edit an existing lead – same UI as AddLeadScreen, prefills all fields
 * from route.params.lead and calls leadsAPI.update() on save.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Keyboard,
    KeyboardAvoidingView,
    Alert,
    Modal,
    FlatList,
    TextInput,
    ScrollView,
    Platform,
    StatusBar,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { useAuth } from '../../context/AuthContext';
import { AppText, AppInput, AppButton, ModalLoader } from '../../components';
import {
    leadsAPI,
    productsAPI,
    dealStagesAPI,
    leadTagsAPI,
    leadSourcesAPI,
    usersAPI,
    contactsAPI,
    companiesAPI,
    pipelineAPI,
} from '../../api/services';
import { showError, showSuccess } from '../../utils';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

// ─── Helper: extract ID string from an object or string ──────────────────────
const toId = val => {
    if (!val) return 'none';
    if (typeof val === 'string') return val;
    return val._id || val.id || 'none';
};

// ─── Section Header ──────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title }) => (
    <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
            <Icon name={icon} size={ms(16)} color={Colors.primary} />
        </View>
        <AppText size="md" weight="bold" color={Colors.textPrimary}>{title}</AppText>
    </View>
);

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
            if (!item) return;
            const key = getKey(item);
            let newSelected = Array.isArray(selectedKey) ? [...selectedKey] : [];
            if (newSelected.includes(key)) {
                newSelected = newSelected.filter(k => k !== key);
            } else {
                newSelected.push(key);
            }
            onSelect(newSelected);
            return;
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
                        <AppText size="lg" weight="bold" color={Colors.textPrimary}>{title}</AppText>
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
                        data={allowNone && !multiple ? [{ __none: true }, ...filtered] : filtered}
                        keyExtractor={(item, idx) => (item.__none ? '__none__' : (getKey(item) || String(idx)))}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                            if (item.__none) {
                                const isSelected = !selectedKey || selectedKey === 'none';
                                return (
                                    <TouchableOpacity
                                        style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                                        onPress={() => handleSelect(null)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.pickerItemLeft}>
                                            <View style={[styles.colorDot, { backgroundColor: Colors.textTertiary + '40' }]} />
                                            <AppText color={isSelected ? Colors.primary : Colors.textPrimary} weight={isSelected ? "bold" : "regular"}>None</AppText>
                                        </View>
                                        {isSelected && <Icon name="checkmark-circle" size={ms(20)} color={Colors.primary} />}
                                    </TouchableOpacity>
                                );
                            }
                            const key = getKey(item);
                            const label = getLabel(item);
                            const isSelected = multiple
                                ? Array.isArray(selectedKey) && selectedKey.includes(key)
                                : selectedKey === key;
                            return (
                                <TouchableOpacity
                                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                                    onPress={() => handleSelect(item)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.pickerItemLeft}>
                                        <View style={[styles.colorDot, { backgroundColor: (item.color || Colors.primary) + '40' }]} />
                                        <AppText color={isSelected ? Colors.primary : Colors.textPrimary} weight={isSelected ? "bold" : "regular"} numberOfLines={1}>{label}</AppText>
                                    </View>
                                    {isSelected && <Icon name="checkmark-circle" size={ms(20)} color={Colors.primary} />}
                                </TouchableOpacity>
                            );
                        }}
                        style={styles.pickerList}
                        ListEmptyComponent={
                            <View style={styles.pickerEmpty}>
                                <Icon name="search-outline" size={ms(28)} color={Colors.textTertiary} />
                                <AppText color={Colors.textTertiary}>No results found</AppText>
                            </View>
                        }
                        contentContainerStyle={{ paddingBottom: vs(20) }}
                    />
                </View>
            </View>
        </Modal>
    );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
const EditLeadScreen = ({ navigation, route }) => {
    const { lead } = route.params || {};
    const { user } = useAuth();
    const scrollY = useRef(new Animated.Value(0)).current;

    // Role helpers
    const canEditSalesperson =
        user?.role === 'boss' || user?.role === 'admin' ||
        user?.role === 'crm' || user?.role === 'manager';
    const isManager = user?.role === 'manager';
    const isAdminOrBoss = user?.role === 'boss' || user?.role === 'admin' || user?.role === 'crm';

    // ── Dropdown data ──
    const [contacts, setContacts] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [products, setProducts] = useState([]);
    const [pipelines, setPipelines] = useState([]);
    const [dealStages, setDealStages] = useState([]);
    const [leadTags, setLeadTags] = useState([]);
    const [leadSources, setLeadSources] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [dataLoading, setDataLoading] = useState(false);

    // ── Form state (initialised with lead data) ──
    const [formData, setFormData] = useState({
        title: lead?.title || '',
        contactId: toId(lead?.contactId || lead?.contact),
        companyId: toId(lead?.companyId || lead?.company),
        productId: toId(lead?.productId || lead?.product),
        userId: toId(lead?.userId || lead?.salesperson || lead?.user),
        telesalesId: toId(lead?.telesalesId || lead?.telesales),
        pipelineId: toId(lead?.pipelineId || lead?.pipeline),
        stage: toId(lead?.stageId || lead?.stage),
        value: lead?.value !== undefined && lead?.value !== null ? String(lead.value) : '',
        currency: lead?.currency || 'INR',
        source: toId(lead?.sourceId || lead?.source),
        expectedCloseDate: lead?.expectedCloseDate ? new Date(lead.expectedCloseDate) : undefined,
        followup: lead?.followup ? new Date(lead.followup) : undefined,
        tags: Array.isArray(lead?.tags)
            ? lead.tags.map(t => (typeof t === 'string' ? t : t?.name || ''))
            : [],
        notes: lead?.notes || '',
    });

    const [loading, setLoading] = useState(false);
    const [activePicker, setActivePicker] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerTarget, setDatePickerTarget] = useState(null);

    // ── Computed ──
    const effectivePipelineId = formData.pipelineId !== 'none' ? formData.pipelineId : null;

    const availableStages = useMemo(() => {
        if (!effectivePipelineId) {
            return dealStages;
        }
        const pid = String(effectivePipelineId);
        return dealStages.filter(s => {
            const sp = s.pipeline || s.pipelineId;
            return sp && String(sp) === pid;
        });
    }, [dealStages, effectivePipelineId]);

    const selectedStage = useMemo(
        () => availableStages.find(s => (s._id || s.id) === formData.stage),
        [availableStages, formData.stage]
    );

    const isStageClosed = useMemo(() => {
        if (!selectedStage) return false;
        const p = selectedStage.probability ?? -1;
        const name = (selectedStage.name || '').toLowerCase();
        return p === 0 || p === 100 || name === 'lost' || name === 'won';
    }, [selectedStage]);

    const isFollowupRequired = !isStageClosed;

    const availableSalespersons = useMemo(() => {
        if (!canEditSalesperson) return [];
        if (isAdminOrBoss) return allUsers.filter(u => u.status === 'active' && (u.role === 'sales' || u.role === 'manager'));
        if (isManager) {
            const mid = user?._id || user?.id;
            return allUsers.filter(u =>
                u.status === 'active' && u.role === 'sales' &&
                (typeof u.superior === 'string' ? u.superior === mid : u.superior?._id === mid)
            );
        }
        return [];
    }, [allUsers, canEditSalesperson, isAdminOrBoss, isManager, user]);

    const availableTelesales = useMemo(() => {
        if (!canEditSalesperson) return [];
        if (isAdminOrBoss) return allUsers.filter(u => u.status === 'active' && u.role === 'telesales');
        if (isManager) {
            const mid = user?._id || user?.id;
            return allUsers.filter(u =>
                u.status === 'active' && u.role === 'telesales' &&
                Array.isArray(u.managers) &&
                u.managers.some(m => (typeof m === 'object' ? m?._id : m) === mid)
            );
        }
        return [];
    }, [allUsers, canEditSalesperson, isAdminOrBoss, isManager, user]);

    // ── Fetch dropdown data ──
    useEffect(() => {
        const fetchAll = async () => {
            setDataLoading(true);
            try {
                const promises = [
                    contactsAPI.getAll({ page: 1, limit: 1000 }),
                    companiesAPI.getAll({ page: 1, limit: 1000 }),
                    productsAPI.getAll({ page: 1, limit: 1000 }),
                    pipelineAPI.getAll(),
                    dealStagesAPI.getAll(),
                    leadTagsAPI.getAll(),
                    leadSourcesAPI.getAll(),
                ];
                if (canEditSalesperson) promises.push(usersAPI.getAll({ limit: 500 }));

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

                setContacts(extractArray(results[0], 'contacts', 'data'));
                setCompanies(extractArray(results[1], 'companies', 'data'));
                setProducts(extractArray(results[2], 'products', 'data'));
                setPipelines(extractArray(results[3], 'pipelines', 'data'));
                setDealStages(extractArray(results[4], 'stages', 'dealStages', 'data'));
                setLeadTags(extractArray(results[5], 'tags', 'data').filter(t => t.active !== false));
                setLeadSources(extractArray(results[6], 'sources', 'data').filter(s => s.active !== false));
                if (canEditSalesperson && results[7]) {
                    setAllUsers(extractArray(results[7], 'users', 'data'));
                }
            } catch (err) {
                console.warn('EditLeadScreen data fetch error:', err);
            } finally {
                setDataLoading(false);
            }
        };
        fetchAll();
    }, [canEditSalesperson]);

    // ── Helpers ──
    const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const getContactName = c => c?.name || `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || '';
    const getCompanyName = c => c?.name || '';
    const getUserLabel = u => `${u?.name || ''}${u?.email ? ` (${u.email})` : ''}`;
    const getStageLabel = s => `${s?.name || ''} (${s?.probability ?? 0}%)`;
    const getIdFromItem = item => item?._id || item?.id || '';

    const getSelectedLabel = (list, id, getLabelFn, fallback = 'Select...') => {
        if (!id || id === 'none') return fallback;
        const item = list.find(i => getIdFromItem(i) === id);
        return item ? getLabelFn(item) : fallback;
    };

    const formatDateString = d => {
        if (!d) return null;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const removeTag = tagName => updateField('tags', formData.tags.filter(t => t !== tagName));

    // ── Validation & Submit ──
    const validateAndSave = async () => {
        Keyboard.dismiss();

        if (!formData.productId || formData.productId === 'none') {
            showError('Please select a product.');
            return;
        }
        if (isFollowupRequired && !formData.followup) {
            showError('Followup date is required for this pipeline stage.');
            return;
        }

        const payload = {
            title: formData.title.trim() || undefined,
            contactId: formData.contactId !== 'none' ? formData.contactId : undefined,
            companyId: formData.companyId !== 'none' ? formData.companyId : undefined,
            productId: formData.productId !== 'none' ? formData.productId : undefined,
            pipelineId: effectivePipelineId && effectivePipelineId !== 'none' ? effectivePipelineId : undefined,
            stage: formData.stage !== 'none' ? formData.stage : undefined,
            value: formData.value ? parseFloat(formData.value) : 0,
            currency: formData.currency,
            source: formData.source !== 'none' ? formData.source : undefined,
            expectedCloseDate: formData.expectedCloseDate?.toISOString(),
            followup: formData.followup?.toISOString(),
            tags: formData.tags,
            notes: formData.notes || undefined,
        };

        if (canEditSalesperson) {
            if (formData.userId && formData.userId !== 'none') payload.userId = formData.userId;
        } else {
            payload.userId = user?._id || user?.id;
        }

        if (canEditSalesperson && formData.telesalesId && formData.telesalesId !== 'none') {
            payload.telesalesId = formData.telesalesId;
        }

        setLoading(true);
        try {
            const leadId = lead?._id || lead?.id;
            const result = await leadsAPI.update(leadId, payload);
            setLoading(false);
            if (result.success) {
                showSuccess('Lead updated successfully!');
                const updatedLead = result.data?.data || result.data?.lead || result.data || { ...lead, ...payload };
                try {
                    route?.params?.onUpdate && route.params.onUpdate(updatedLead);
                } catch (e) { }
                route?.params?.refreshLeads?.();
                route?.params?.refreshPipeline?.();
                route?.params?.refreshFollowUps?.();
                navigation.goBack();
            } else {
                showError(result.error || 'Failed to update lead');
            }
        } catch {
            setLoading(false);
            showError('Failed to update lead');
        }
    };

    // ── Date picker ──
    const handleDateChange = (event, date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (event.type === 'dismissed' || event.type === 'set') setShowDatePicker(false);
        if (date && datePickerTarget) updateField(datePickerTarget, date);
    };

    const openDatePicker = target => {
        setDatePickerTarget(target);
        Keyboard.dismiss();
        setShowDatePicker(true);
    };

    // ── Header Component ──
    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Icon name="chevron-back" size={ms(24)} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View>
                    <AppText size="xl" weight="bold" color={Colors.textPrimary}>Edit Lead</AppText>
                    {(lead?.title || lead?.name) && (
                        <AppText size="sm" color={Colors.textSecondary} numberOfLines={1}>{lead.title || lead.name}</AppText>
                    )}
                </View>
            </View>
            <TouchableOpacity
                onPress={validateAndSave}
                style={[styles.saveButton, loading && { opacity: 0.6 }]}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <AppText color="#fff" weight="bold">Update</AppText>
                )}
            </TouchableOpacity>
        </View>
    );

    const isProductSelected = formData.productId !== 'none';
    const selectedProduct = isProductSelected ? products.find(p => getIdFromItem(p) === formData.productId) : null;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

            {renderHeader()}

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                        { useNativeDriver: false }
                    )}
                >
                    <Animated.View style={{
                        opacity: scrollY.interpolate({
                            inputRange: [0, 50],
                            outputRange: [1, 0.95],
                            extrapolate: 'clamp'
                        }),
                        transform: [{
                            translateY: scrollY.interpolate({
                                inputRange: [-100, 0],
                                outputRange: [50, 0],
                                extrapolate: 'clamp'
                            })
                        }]
                    }}>

                        {/* ── Section: Lead Info ── */}
                        <SectionHeader icon="pricetag-outline" title="Lead Info" />
                        <View style={styles.card}>
                            <AppInput
                                label="Title"
                                placeholder="e.g. Enterprise Software Deal"
                                value={formData.title}
                                onChangeText={t => updateField('title', t)}
                                leftIcon="create-outline"
                            />
                        </View>

                        {/* ── Section: Related Contact & Company ── */}
                        <SectionHeader icon="people-outline" title="Contact & Company" />
                        <View style={styles.card}>
                            <TouchableOpacity onPress={() => setActivePicker('contact')} activeOpacity={0.7}>
                                <AppInput
                                    label="Contact"
                                    placeholder="Select contact"
                                    value={getSelectedLabel(contacts, formData.contactId, getContactName, '')}
                                    editable={false}
                                    leftIcon="person-outline"
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setActivePicker('company')} activeOpacity={0.7}>
                                <AppInput
                                    label="Company"
                                    placeholder="Select company"
                                    value={getSelectedLabel(companies, formData.companyId, getCompanyName, '')}
                                    editable={false}
                                    leftIcon="business-outline"
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* ── Section: Product & Value ── */}
                        <SectionHeader icon="cube-outline" title="Product & Value" />
                        <View style={styles.card}>
                            <TouchableOpacity onPress={() => setActivePicker('product')} activeOpacity={0.7}>
                                <AppInput
                                    label="Product"
                                    placeholder="Select product"
                                    value={selectedProduct?.name || ''}
                                    editable={false}
                                    required
                                    leftIcon="cube-outline"
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>

                            <View style={styles.row}>
                                <View style={{ flex: 2 }}>
                                    <AppInput
                                        label="Deal Value"
                                        placeholder="0.00"
                                        value={formData.value}
                                        onChangeText={t => updateField('value', t.replace(/[^0-9.]/g, ''))}
                                        keyboardType="numeric"
                                        leftIcon="cash-outline"
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                                    <TouchableOpacity onPress={() => setActivePicker('currency')} activeOpacity={0.7}>
                                        <AppInput
                                            label="Currency"
                                            value={formData.currency}
                                            editable={false}
                                            rightIcon="chevron-down-outline"
                                            pointerEvents="none"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {isProductSelected && selectedProduct && (
                                <View style={styles.infoBadge}>
                                    <Icon name="information-circle" size={ms(16)} color={Colors.primary} />
                                    <AppText size="sm" color={Colors.primary} weight="medium" style={{ marginLeft: 6 }}>
                                        {selectedProduct.price !== undefined
                                            ? `Default Price: ${formData.currency} ${selectedProduct.price}`
                                            : 'No default price set'}
                                    </AppText>
                                </View>
                            )}
                        </View>

                        {/* ── Section: Pipeline & Stage ── */}
                        <SectionHeader icon="git-network-outline" title="Pipeline & Stage" />
                        <View style={styles.card}>
                            {pipelines.length >= 2 && (
                                <TouchableOpacity onPress={() => setActivePicker('pipeline')} activeOpacity={0.7}>
                                    <AppInput
                                        label="Pipeline"
                                        placeholder="Select pipeline"
                                        value={getSelectedLabel(pipelines, formData.pipelineId, p => p.name, '')}
                                        required
                                        editable={false}
                                        leftIcon="git-branch-outline"
                                        rightIcon="chevron-down-outline"
                                        pointerEvents="none"
                                    />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => setActivePicker('stage')} activeOpacity={0.7}>
                                <AppInput
                                    label="Stage"
                                    placeholder="Select stage"
                                    value={selectedStage ? getStageLabel(selectedStage) : ''}
                                    required
                                    editable={false}
                                    leftIcon="stats-chart-outline"
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>

                            {selectedStage && (
                                <View style={[styles.infoBadge, { backgroundColor: (selectedStage.color || Colors.primary) + '10' }]}>
                                    <View style={[styles.colorDot, { backgroundColor: selectedStage.color || Colors.primary, width: 8, height: 8 }]} />
                                    <AppText size="sm" color={selectedStage.color || Colors.primary} weight="medium" style={{ marginLeft: 6 }}>
                                        {isStageClosed ? 'Closed stage — followup not required' : `${selectedStage.probability ?? 0}% probability`}
                                    </AppText>
                                </View>
                            )}
                        </View>

                        {/* ── Section: Assignment ── */}
                        <SectionHeader icon="person-circle-outline" title="Assignment" />
                        <View style={styles.card}>
                            {canEditSalesperson ? (
                                <>
                                    <TouchableOpacity onPress={() => setActivePicker('salesperson')} activeOpacity={0.7}>
                                        <AppInput
                                            label="Salesperson"
                                            placeholder="Unassigned"
                                            value={getSelectedLabel(availableSalespersons, formData.userId, getUserLabel, '')}
                                            editable={false}
                                            leftIcon="person-outline"
                                            rightIcon="chevron-down-outline"
                                            pointerEvents="none"
                                        />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setActivePicker('telesales')} activeOpacity={0.7}>
                                        <AppInput
                                            label="Telesales"
                                            placeholder="Unassigned"
                                            value={getSelectedLabel(availableTelesales, formData.telesalesId, getUserLabel, '')}
                                            editable={false}
                                            leftIcon="call-outline"
                                            rightIcon="chevron-down-outline"
                                            pointerEvents="none"
                                        />
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <AppInput
                                    label="Salesperson"
                                    value={user?.name || user?.email || 'Current User'}
                                    editable={false}
                                    leftIcon="person-outline"
                                    rightIcon="lock-closed-outline"
                                />
                            )}
                        </View>

                        {/* ── Section: Source & Dates ── */}
                        <SectionHeader icon="calendar-outline" title="Source & Dates" />
                        <View style={styles.card}>
                            <TouchableOpacity onPress={() => setActivePicker('source')} activeOpacity={0.7}>
                                <AppInput
                                    label="Lead Source"
                                    placeholder="Select source"
                                    value={getSelectedLabel(leadSources, formData.source, s => s.name, '')}
                                    editable={false}
                                    leftIcon="globe-outline"
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => openDatePicker('expectedCloseDate')} activeOpacity={0.7}>
                                <AppInput
                                    label="Expected Close Date"
                                    placeholder="Pick a date"
                                    value={formatDateString(formData.expectedCloseDate)}
                                    editable={false}
                                    leftIcon="calendar-outline"
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => openDatePicker('followup')} activeOpacity={0.7}>
                                <AppInput
                                    label="Followup Date"
                                    placeholder="Pick a date"
                                    value={formatDateString(formData.followup)}
                                    required={isFollowupRequired}
                                    editable={false}
                                    leftIcon="notifications-outline"
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                    error={isFollowupRequired && !formData.followup}
                                    errorMessage="Required for this stage"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* ── Section: Tags ── */}
                        <SectionHeader icon="pricetags-outline" title="Tags" />
                        <View style={styles.card}>
                            {formData.tags.length > 0 ? (
                                <View style={styles.tagWrap}>
                                    {formData.tags.map(tag => {
                                        const tagData = leadTags.find(t => t.name === tag);
                                        return (
                                            <TouchableOpacity
                                                key={tag}
                                                style={[styles.tagChip, { backgroundColor: (tagData?.color || Colors.primary) + '20' }]}
                                                onPress={() => removeTag(tag)}
                                            >
                                                <AppText size="xs" weight="medium" color={tagData?.color || Colors.primary}>{tag}</AppText>
                                                <Icon name="close-circle" size={ms(14)} color={tagData?.color || Colors.primary} style={{ marginLeft: 4 }} />
                                            </TouchableOpacity>
                                        );
                                    })}
                                    <TouchableOpacity style={styles.addTagInline} onPress={() => setActivePicker('tags')}>
                                        <Icon name="add-circle" size={ms(24)} color={Colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.addTagButton} onPress={() => setActivePicker('tags')}>
                                    <Icon name="add-circle-outline" size={ms(20)} color={Colors.primary} />
                                    <AppText color={Colors.primary} weight="medium" style={{ marginLeft: 8 }}>Add Tags</AppText>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* ── Section: Notes ── */}
                        <SectionHeader icon="document-text-outline" title="Notes" />
                        <View style={[styles.card, { paddingBottom: Spacing.lg }]}>
                            <AppInput
                                label="Additional Notes"
                                placeholder="Type any details..."
                                value={formData.notes}
                                onChangeText={t => updateField('notes', t)}
                                multiline
                                numberOfLines={4}
                                leftIcon="document-text-outline"
                            />
                        </View>

                        <View style={{ height: vs(40) }} />
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            <ModalLoader visible={loading} text="Updating lead..." />

            {showDatePicker && (
                <DateTimePicker
                    value={formData[datePickerTarget] || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                />
            )}

            {/* ─────────────── PICKERS ─────────────── */}
            <SearchablePicker
                visible={activePicker === 'contact'}
                title="Select Contact"
                items={contacts}
                getLabel={getContactName}
                getKey={getIdFromItem}
                selectedKey={formData.contactId}
                onSelect={item => { updateField('contactId', item ? getIdFromItem(item) : 'none'); setActivePicker(null); }}
                onClose={() => setActivePicker(null)}
            />
            <SearchablePicker
                visible={activePicker === 'company'}
                title="Select Company"
                items={companies}
                getLabel={getCompanyName}
                getKey={getIdFromItem}
                selectedKey={formData.companyId}
                onSelect={item => { updateField('companyId', item ? getIdFromItem(item) : 'none'); setActivePicker(null); }}
                onClose={() => setActivePicker(null)}
            />
            <SearchablePicker
                visible={activePicker === 'product'}
                title="Select Product"
                items={products}
                getLabel={p => p.name || ''}
                getKey={getIdFromItem}
                selectedKey={formData.productId}
                onSelect={item => {
                    if (item) {
                        setFormData(prev => ({
                            ...prev,
                            productId: getIdFromItem(item),
                            value: item.price !== undefined && item.price !== null
                                ? String(item.price)
                                : prev.value,
                        }));
                    } else {
                        updateField('productId', 'none');
                    }
                    setActivePicker(null);
                }}
                onClose={() => setActivePicker(null)}
            />
            <SearchablePicker
                visible={activePicker === 'salesperson'}
                title="Select Salesperson"
                items={availableSalespersons}
                getLabel={getUserLabel}
                getKey={getIdFromItem}
                selectedKey={formData.userId}
                onSelect={item => { updateField('userId', item ? getIdFromItem(item) : 'none'); setActivePicker(null); }}
                onClose={() => setActivePicker(null)}
            />
            <SearchablePicker
                visible={activePicker === 'telesales'}
                title="Select Telesales"
                items={availableTelesales}
                getLabel={getUserLabel}
                getKey={getIdFromItem}
                selectedKey={formData.telesalesId}
                onSelect={item => { updateField('telesalesId', item ? getIdFromItem(item) : 'none'); setActivePicker(null); }}
                onClose={() => setActivePicker(null)}
            />
            <SearchablePicker
                visible={activePicker === 'pipeline'}
                title="Select Pipeline"
                items={pipelines}
                getLabel={p => p.name || ''}
                getKey={getIdFromItem}
                selectedKey={formData.pipelineId}
                onSelect={item => {
                    if (item) {
                        const pid = String(getIdFromItem(item));
                        const stagesForPipeline = dealStages.filter(s => {
                            const sp = s.pipeline || s.pipelineId;
                            return sp && String(sp) === pid;
                        });
                        setFormData(prev => ({
                            ...prev,
                            pipelineId: pid,
                            stage: stagesForPipeline.length > 0 &&
                                stagesForPipeline.some(s => (s._id || s.id) === prev.stage)
                                ? prev.stage
                                : (stagesForPipeline.length > 0 ? (stagesForPipeline[0]._id || stagesForPipeline[0].id || 'none') : 'none'),
                        }));
                    } else {
                        updateField('pipelineId', 'none');
                    }
                    setActivePicker(null);
                }}
                onClose={() => setActivePicker(null)}
            />
            <SearchablePicker
                visible={activePicker === 'stage'}
                title="Select Stage"
                items={availableStages}
                getLabel={getStageLabel}
                getKey={getIdFromItem}
                selectedKey={formData.stage}
                onSelect={item => {
                    if (item) {
                        const prob = item.probability ?? -1;
                        const name = (item.name || '').toLowerCase();
                        const isClosed = prob === 0 || prob === 100 || name === 'lost' || name === 'won';
                        setFormData(prev => ({
                            ...prev,
                            stage: getIdFromItem(item),
                            ...(isClosed ? { followup: undefined } : {}),
                        }));
                    } else {
                        updateField('stage', 'none');
                    }
                    setActivePicker(null);
                }}
                onClose={() => setActivePicker(null)}
                allowNone={false}
            />
            <SearchablePicker
                visible={activePicker === 'currency'}
                title="Select Currency"
                items={CURRENCIES.map(c => ({ id: c, name: c }))}
                getLabel={c => c.name}
                getKey={c => c.id}
                selectedKey={formData.currency}
                onSelect={item => { if (item) updateField('currency', item.id); setActivePicker(null); }}
                onClose={() => setActivePicker(null)}
                allowNone={false}
            />
            <SearchablePicker
                visible={activePicker === 'source'}
                title="Select Source"
                items={leadSources}
                getLabel={s => s.name || ''}
                getKey={getIdFromItem}
                selectedKey={formData.source}
                onSelect={item => { updateField('source', item ? getIdFromItem(item) : 'none'); setActivePicker(null); }}
                onClose={() => setActivePicker(null)}
            />
            <SearchablePicker
                visible={activePicker === 'tags'}
                title="Select Tags"
                items={leadTags}
                getLabel={t => t.name}
                getKey={getIdFromItem}
                selectedKey={formData.tags}
                onSelect={newTags => updateField('tags', newTags)}
                onClose={() => setActivePicker(null)}
                multiple={true}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    flex: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.base,
        paddingVertical: vs(12),
        backgroundColor: '#f8f9fa',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: Spacing.sm,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: ms(20),
        paddingVertical: vs(8),
        borderRadius: BorderRadius.round,
        ...Shadow.sm,
    },
    scrollContent: {
        paddingHorizontal: Spacing.base,
        paddingBottom: vs(30),
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    sectionIconWrap: {
        width: ms(32),
        height: ms(32),
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.base,
        ...Shadow.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    infoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        padding: Spacing.sm,
        borderRadius: BorderRadius.sm,
        marginTop: Spacing.xs,
    },
    tagWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(10),
        paddingVertical: vs(4),
        borderRadius: BorderRadius.round,
        marginRight: ms(8),
        marginBottom: vs(8),
    },
    addTagInline: {
        marginBottom: vs(8),
    },
    addTagButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: vs(4),
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    pickerSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        maxHeight: '80%',
        paddingBottom: vs(20),
    },
    handleBar: {
        width: ms(40),
        height: vs(5),
        backgroundColor: Colors.borderLight,
        borderRadius: BorderRadius.round,
        alignSelf: 'center',
        marginVertical: vs(12),
    },
    pickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.base,
        paddingBottom: Spacing.sm,
    },
    pickerCloseBtn: {
        backgroundColor: Colors.borderLight,
        borderRadius: BorderRadius.round,
        padding: 4,
    },
    pickerSearch: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f3f5',
        marginHorizontal: Spacing.base,
        marginBottom: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
        height: vs(40),
    },
    pickerSearchInput: {
        flex: 1,
        marginLeft: Spacing.xs,
        color: Colors.textPrimary,
        fontSize: ms(14),
        padding: 0,
    },
    pickerList: {
        paddingHorizontal: Spacing.base,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: vs(12),
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    pickerItemActive: {
        backgroundColor: Colors.primary + '05',
    },
    pickerItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    colorDot: {
        width: ms(12),
        height: ms(12),
        borderRadius: ms(6),
        marginRight: Spacing.sm,
    },
    pickerEmpty: {
        alignItems: 'center',
        marginTop: vs(40),
    },
});

export default EditLeadScreen;
