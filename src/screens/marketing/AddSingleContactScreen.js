import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Switch,
    LayoutAnimation,
    UIManager,
    Image,
    Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import IonIcon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import CountryPicker from 'react-native-country-picker-modal';
import { Colors } from '../../constants/Colors';
import { Spacing, Shadow, BorderRadius } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';
import LinearGradient from 'react-native-linear-gradient';
import {
    AppText,
    AppInput,
    AppButton,
    ScreenWrapper,
    ModalLoader,
    SearchablePicker,
} from '../../components';
import CommonHeader from '../../components/CommonHeader';
import { useAuth } from '../../context/AuthContext';
import {
    leadsAPI,
    productsAPI,
    dealStagesAPI,
    leadTagsAPI,
    leadSourcesAPI,
    pipelineAPI,
    usersAPI,
    contactsAPI,
    uploadAPI,
    communicationAPI,
    settingsAPI,
} from '../../api/services';
import { showError, showSuccess } from '../../utils';

const { width } = Dimensions.get('window');

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AddSingleContactScreen = ({ navigation }) => {
    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        mobile: '',
        countryCode: 'IN',
        callingCode: '91',
        company: '',
        designation: '',
        dob: null,
        anniversary: null,
        notes: '',
        addToCRM: false,
        pipelineId: '',
        stageId: '',
        productId: '',
        dealValue: '',
        source: '',
        followUpDate: null,
        tags: [],
        city: '',
        crmNotes: '',
        whatsappConsent: true,
        emailConsent: true,
        communicationPurpose: 'intro', // 'intro', 'lead-nurturing', 'reverse-marketing'
        selectedIntroTemplate: '',
        dynamicMessage: '',
        selectedGroups: [], // For Lead Nurturing
        groupAssignments: {}, // For Lead Nurturing: { groupId: { stage, template } }
        selectedReverseGroups: [], // For Reverse Marketing
        reverseGroupTemplates: {}, // For Reverse Marketing: { groupId: templateId }
        refreshAfterSave: true,
    });

    const [formSettings, setFormSettings] = useState({
        defaultQuestionsRequired: {
            name: true,
            email: true,
            mobile: true,
            company: false,
            designation: false,
        },
        extraQuestions: [],
    });

    const [extraAnswers, setExtraAnswers] = useState({});

    // Visibility State
    const [isMoreInfoOpen, setIsMoreInfoOpen] = useState(false);
    const [showPipelinePicker, setShowPipelinePicker] = useState(false);
    const [showStagePicker, setShowStagePicker] = useState(false);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showTagsPicker, setShowTagsPicker] = useState(false);
    const [showIntroTemplatePicker, setShowIntroTemplatePicker] = useState(false);
    const [showCommGroupPicker, setShowCommGroupPicker] = useState(false);
    const [showCommReverseGroupPicker, setShowCommReverseGroupPicker] = useState(false);
    const [showReverseTemplatePicker, setShowReverseTemplatePicker] = useState(false);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [showExtraQuestionPicker, setShowExtraQuestionPicker] = useState(false);

    // Temp selection states for nested pickers
    const [currentGroupId, setCurrentGroupId] = useState(null);
    const [currentStageId, setCurrentStageId] = useState(null);

    // CRM Data States
    const { user } = useAuth();
    const [pipelines, setPipelines] = useState([]);
    const [dealStages, setDealStages] = useState([]);
    const [products, setProducts] = useState([]);
    const [leadTags, setLeadTags] = useState([]);
    const [leadSources, setLeadSources] = useState([]);
    const [introTemplates, setIntroTemplates] = useState([]);
    const [commGroups, setCommGroups] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerTarget, setDatePickerTarget] = useState(null);

    // Role helpers
    const canEditSalesperson =
        user?.role === 'boss' || user?.role === 'admin' ||
        user?.role === 'crm' || user?.role === 'manager';

    // Fetch dropdown data
    useEffect(() => {
        const fetchAll = async () => {
            setDataLoading(true);
            try {
                const promises = [
                    productsAPI.getAll({ page: 1, limit: 1000 }),
                    pipelineAPI.getAll(),
                    dealStagesAPI.getAll(),
                    leadTagsAPI.getAll(),
                    leadSourcesAPI.getAll(),
                    communicationAPI.getIntroTemplates(),
                    communicationAPI.getGroupsWithStages(),
                ];
                if (canEditSalesperson) promises.push(usersAPI.getAll({ limit: 500 }));

                const results = await Promise.allSettled(promises);

                const extractArray = (res, ...paths) => {
                    if (!res || res.status !== 'fulfilled' || !res.value?.success) return [];
                    const data = res.value.data || res.value.data.data;
                    for (const path of paths) {
                        const parts = path.split('.');
                        let val = data;
                        for (const p of parts) val = val?.[p];
                        if (Array.isArray(val)) return val;
                    }
                    return Array.isArray(data) ? data : [];
                };

                setProducts(extractArray(results[0], 'products', 'data'));
                setPipelines(extractArray(results[1], 'pipelines', 'data'));
                setDealStages(extractArray(results[2], 'stages', 'dealStages', 'data'));
                setLeadTags(extractArray(results[3], 'tags', 'data')
                    .filter(t => t.active !== false)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '')));
                setLeadSources(extractArray(results[4], 'sources', 'data').filter(s => s.active !== false));
                setIntroTemplates(extractArray(results[5], 'data'));
                setCommGroups(extractArray(results[6], 'data'));
                if (canEditSalesperson && results[7]) {
                    setAllUsers(extractArray(results[7], 'users', 'data'));
                }
            } catch (err) {
                console.warn('AddSingleContactScreen data fetch error:', err);
            } finally {
                setDataLoading(false);
            }
        };
        fetchAll();
    }, [canEditSalesperson]);

    const fetchFormSettings = React.useCallback(() => {
        settingsAPI.getAll().then((res) => {
            if (!res.success || !res.data?.formSettings) return;
            const fs = res.data.formSettings;
            setFormSettings({
                defaultQuestionsRequired: {
                    name: fs.defaultQuestionsRequired?.name !== false,
                    email: !!fs.defaultQuestionsRequired?.email,
                    mobile: !!fs.defaultQuestionsRequired?.mobile,
                    company: !!fs.defaultQuestionsRequired?.company,
                    designation: !!fs.defaultQuestionsRequired?.designation,
                },
                extraQuestions: (fs.extraQuestions || []).map((q) => ({
                    question: q.question || '',
                    questionType: q.questionType || 'text',
                    starred: !!q.starred,
                    options: q.options || [],
                })),
            });
        }).catch(() => { });
    }, []);

    useEffect(() => {
        fetchFormSettings();
    }, [fetchFormSettings]);

    const availableStages = useMemo(() => {
        if (!formData.pipelineId) return [];
        const pid = String(formData.pipelineId);
        return dealStages.filter(s => {
            const sp = s.pipeline || s.pipelineId;
            return sp && String(sp) === pid;
        });
    }, [dealStages, formData.pipelineId]);

    const selectedStage = useMemo(
        () => availableStages.find(s => (s._id || s.id) === formData.stageId),
        [availableStages, formData.stageId]
    );

    const isStageClosed = useMemo(() => {
        if (!selectedStage) return false;
        const p = selectedStage.probability ?? -1;
        const name = (selectedStage.name || '').toLowerCase();
        return p === 0 || p === 100 || name === 'lost' || name === 'won';
    }, [selectedStage]);

    const isFollowupRequired = !isStageClosed && formData.stageId;

    const selectedProduct = useMemo(
        () => products.find(p => (p._id || p.id) === formData.productId),
        [products, formData.productId]
    );

    // Communication Logic
    const commPipelines = useMemo(
        () => commGroups.filter(g => (g.groupType || 'lead-nurturing') === 'lead-nurturing'),
        [commGroups]
    );

    const commEvents = useMemo(
        () => commGroups.filter(g => (g.groupType || 'lead-nurturing') === 'reverse-marketing'),
        [commGroups]
    );

    const getCommGroup = (id) => commGroups.find(g => (g._id || g.id) === id);

    const getStagesForCommGroup = (groupId) => {
        const group = getCommGroup(groupId);
        return group?.stages || [];
    };

    const getTemplatesForCommStage = (groupId, stageId) => {
        const group = getCommGroup(groupId);
        const stage = group?.stages?.find(s => (s._id || s.id) === stageId);
        return stage?.templates || [];
    };

    const getTemplatesForReverseGroup = (groupId) => {
        const group = getCommGroup(groupId);
        return group?.templates || [];
    };

    const getLabelForId = (list, id, labelField = 'name') => {
        if (!id) return '';
        const item = list.find(i => (i._id || i.id) === id);
        if (!item) return '';
        if (typeof labelField === 'function') return labelField(item);
        return item[labelField] || '';
    };

    const handleInputChange = (field, value) => {
        if (field === 'addToCRM') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }

        if (field === 'pipelineId') {
            setFormData(prev => ({ ...prev, [field]: value, stageId: '' }));
            return;
        }

        if (field === 'productId') {
            const prod = products.find(p => (p._id || p.id) === value);
            setFormData(prev => ({
                ...prev,
                [field]: value,
                dealValue: prod?.price ? String(prod.price) : prev.dealValue
            }));
            return;
        }

        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddCommGroup = (groupId) => {
        if (!formData.selectedGroups.includes(groupId)) {
            setFormData(prev => ({
                ...prev,
                selectedGroups: [...prev.selectedGroups, groupId],
                groupAssignments: {
                    ...prev.groupAssignments,
                    [groupId]: { stageId: '', templateId: '' }
                }
            }));
        }
    };

    const handleRemoveCommGroup = (groupId) => {
        setFormData(prev => {
            const nextAssignments = { ...prev.groupAssignments };
            delete nextAssignments[groupId];
            return {
                ...prev,
                selectedGroups: prev.selectedGroups.filter(id => id !== groupId),
                groupAssignments: nextAssignments
            };
        });
    };

    const handleUpdateCommAssignment = (groupId, field, value) => {
        setFormData(prev => ({
            ...prev,
            groupAssignments: {
                ...prev.groupAssignments,
                [groupId]: {
                    ...prev.groupAssignments[groupId],
                    [field]: value,
                    ...(field === 'stageId' ? { templateId: '' } : {})
                }
            }
        }));
    };

    const handleAddReverseGroup = (groupId) => {
        if (!formData.selectedReverseGroups.includes(groupId)) {
            setFormData(prev => ({
                ...prev,
                selectedReverseGroups: [...prev.selectedReverseGroups, groupId],
                reverseGroupTemplates: {
                    ...prev.reverseGroupTemplates,
                    [groupId]: ''
                }
            }));
        }
    };

    const handleRemoveReverseGroup = (groupId) => {
        setFormData(prev => {
            const nextTemplates = { ...prev.reverseGroupTemplates };
            delete nextTemplates[groupId];
            return {
                ...prev,
                selectedReverseGroups: prev.selectedReverseGroups.filter(id => id !== groupId),
                reverseGroupTemplates: nextTemplates
            };
        });
    };

    const handleUpdateReverseAssignment = (groupId, templateId) => {
        setFormData(prev => ({
            ...prev,
            reverseGroupTemplates: {
                ...prev.reverseGroupTemplates,
                [groupId]: templateId
            }
        }));
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
        setShowDatePicker(true);
    };

    const formatDateString = d => {
        if (!d) return '';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const removeTag = (tag) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tag)
        }));
    };

    const handleSave = async () => {
        if (!formData.fullName || !formData.mobile) {
            showError('Please fill in required fields (Name and Mobile)');
            return;
        }

        if (formData.addToCRM) {
            if (!formData.pipelineId) {
                showError('Please select a pipeline.');
                return;
            }
            if (!formData.stageId) {
                showError('Please select a pipeline stage.');
                return;
            }
            if (isFollowupRequired && !formData.followUpDate) {
                showError('Followup date is required for this stage.');
                return;
            }
        }

        setDataLoading(true);
        try {
            // 1. Validation
            const required = formSettings.defaultQuestionsRequired;
            if (required.name && !formData.fullName.trim()) {
                showError('Full Name is required');
                return;
            }
            if (required.mobile && !formData.mobile.trim()) {
                showError('Mobile Number is required');
                return;
            }
            if (required.email && !formData.email.trim()) {
                showError('Email is required');
                return;
            }
            if (required.company && !formData.company.trim()) {
                showError('Company Name is required');
                return;
            }
            if (required.designation && !formData.designation.trim()) {
                showError('Designation is required');
                return;
            }

            for (let i = 0; i < formSettings.extraQuestions.length; i++) {
                const q = formSettings.extraQuestions[i];
                if (q.starred && !(extraAnswers[i] ?? '').trim()) {
                    showError(`"${q.question}" is required`);
                    return;
                }
            }

            // 2. Build Unified Payload
            const extraPayload = formSettings.extraQuestions.map((q, i) => ({
                question: q.question,
                answer: (extraAnswers[i] ?? '').trim(),
                starred: q.starred,
                questionType: q.questionType,
                options: q.options || [],
            }));

            const companyDetails = {};
            if (formData.company) companyDetails.name = formData.company;
            if (formData.designation) companyDetails.designation = formData.designation;

            const crmDetails = formData.addToCRM ? {
                pipelineId: formData.pipelineId || undefined,
                stageId: formData.stageId || undefined,
                tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
                city: formData.city || undefined,
                notes: (formData.notes?.trim() || formData.crmNotes?.trim()) || undefined,
                productId: formData.productId || undefined,
                dealValue: formData.dealValue ? parseFloat(formData.dealValue) : undefined,
                sourceId: formData.source || undefined,
                followup: formData.followUpDate?.toISOString(),
            } : undefined;

            const payload = {
                name: formData.fullName,
                email: formData.email || undefined,
                mobile: formData.mobile,
                countryCode: `+${formData.callingCode}`,
                uploadDestination: formData.communicationPurpose === 'intro' ? 'intro' : 'lead_nurturing',
                dob: formData.dob?.toISOString(),
                anniversary: formData.anniversary?.toISOString(),
                addedFor: formData.communicationPurpose === 'intro' ? 'intro' : 'lead',
                mediaPreference: {
                    whatsapp: formData.whatsappConsent,
                    email: formData.emailConsent,
                },
                ...(extraPayload.length > 0 && { extraQuestions: extraPayload }),
                ...(Object.keys(companyDetails).length > 0 && { companyDetails }),
                ...(crmDetails && { crmDetails }),

                ...(formData.communicationPurpose === 'intro' && {
                    ...(formData.selectedIntroTemplate && {
                        template: formData.selectedIntroTemplate,
                        introTemplate: formData.selectedIntroTemplate,
                    }),
                    ...(formData.dynamicMessage?.trim() && {
                        dynamicMessage: formData.dynamicMessage.trim(),
                    }),
                }),
                ...(formData.communicationPurpose === 'lead-nurturing' && {
                    groups: formData.selectedGroups,
                    assignments: formData.selectedGroups.map(gId => ({
                        group: gId,
                        ...(formData.groupAssignments[gId]?.stageId && { stage: formData.groupAssignments[gId].stageId }),
                        ...(formData.groupAssignments[gId]?.templateId && { template: formData.groupAssignments[gId].templateId }),
                    })),
                }),
                ...(formData.communicationPurpose === 'reverse-marketing' && {
                    groups: formData.selectedReverseGroups,
                    assignments: formData.selectedReverseGroups.map(gId => ({
                        group: gId,
                        ...(formData.reverseGroupTemplates[gId] ? { template: formData.reverseGroupTemplates[gId] } : {}),
                    })),
                }),
            };

            const contactRes = await contactsAPI.create(payload);

            if (!contactRes.success) {
                showError(contactRes.error || 'Failed to save contact');
                setDataLoading(false);
                return;
            }

            showSuccess('Contact saved successfully!');

            if (formData.refreshAfterSave) {
                setFormData(prev => ({
                    ...prev,
                    fullName: '',
                    email: '',
                    mobile: '',
                    company: '',
                    designation: '',
                    dob: null,
                    anniversary: null,
                    notes: '',
                    dealValue: '',
                    followUpDate: null,
                    crmNotes: '',
                    tags: [],
                    communicationPurpose: 'intro',
                    selectedIntroTemplate: '',
                    dynamicMessage: '',
                    selectedGroups: [],
                    groupAssignments: {},
                    selectedReverseGroups: [],
                    reverseGroupTemplates: {},
                }));
                setExtraAnswers({});
            } else {
                navigation.goBack();
            }
        } catch (err) {
            console.error('Save error:', err);
            showError('A server error occurred while saving.');
        } finally {
            setDataLoading(false);
        }
    };

    const renderRadioButton = (label, value) => {
        const isActive = formData.communicationPurpose === value;
        return (
            <TouchableOpacity
                style={[styles.radioContainer, isActive && styles.radioContainerActive]}
                onPress={() => handleInputChange('communicationPurpose', value)}
                activeOpacity={0.7}
            >
                <IonIcon
                    name={isActive ? "radio-button-on" : "radio-button-off"}
                    size={ms(18)}
                    color={isActive ? Colors.primary : Colors.textTertiary}
                />
                <AppText size="xs" weight={isActive ? "bold" : "medium"} color={isActive ? Colors.primary : Colors.textSecondary} style={{ marginLeft: ms(6) }}>
                    {label}
                </AppText>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenWrapper withPadding={false}>
            <CommonHeader title="Add Contact" navigation={navigation} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Add to CRM Card - TOP */}
                    <View style={styles.topToggleCard}>
                        <View style={styles.row}>
                            <IonIcon name="server" size={ms(20)} color="#15803d" />
                            <AppText weight="bold" style={{ marginLeft: Spacing.sm }}>Add to CRM</AppText>
                        </View>
                        <Switch
                            value={formData.addToCRM}
                            onValueChange={val => handleInputChange('addToCRM', val)}
                            trackColor={{ false: '#D1D5DB', true: '#15803d' }}
                            thumbColor={formData.addToCRM ? '#fff' : '#F3F4F6'}
                        />
                    </View>

                    {/* Animated CRM Details Section */}
                    {formData.addToCRM && (
                        <View style={styles.crmDetailsSection}>
                            <View style={styles.row}>
                                <IonIcon name="layers" size={ms(20)} color="#15803d" />
                                <AppText weight="bold" color="#15803d" style={{ marginLeft: Spacing.sm }}>CRM Details</AppText>
                            </View>
                            <AppText size="xs" color={Colors.textTertiary} style={{ marginTop: 2, marginBottom: Spacing.lg }}>
                                Additional fields for CRM record
                            </AppText>

                            <TouchableOpacity onPress={() => setShowPipelinePicker(true)} activeOpacity={0.7}>
                                <AppInput
                                    label="Pipeline"
                                    placeholder="Select Pipeline"
                                    value={getLabelForId(pipelines, formData.pipelineId)}
                                    editable={false}
                                    required
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    if (!formData.pipelineId) return showError('Please select a pipeline first');
                                    setCurrentGroupId(null);
                                    setShowStagePicker(true);
                                }}
                                activeOpacity={0.7}
                                style={{ opacity: formData.pipelineId ? 1 : 0.6 }}
                            >
                                <AppInput
                                    label="Pipeline Stage"
                                    placeholder={formData.pipelineId ? "Select Stage" : "Select pipeline first"}
                                    value={getLabelForId(availableStages, formData.stageId, s => `${s.name} (${s.probability ?? 0}%)`)}
                                    editable={false}
                                    required
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setShowProductPicker(true)} activeOpacity={0.7}>
                                <AppInput
                                    label="Product/Service"
                                    placeholder="Select Product"
                                    value={selectedProduct?.name || ''}
                                    editable={false}
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>

                            <AppInput
                                label="Deal Value"
                                placeholder="0.00"
                                value={formData.dealValue}
                                onChangeText={val => handleInputChange('dealValue', val)}
                                keyboardType="numeric"
                                leftIcon="cash"
                            />

                            <TouchableOpacity onPress={() => setShowSourcePicker(true)} activeOpacity={0.7}>
                                <AppInput
                                    label="Lead Source"
                                    placeholder="Select Source"
                                    value={getLabelForId(leadSources, formData.source)}
                                    editable={false}
                                    rightIcon="chevron-down-outline"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>

                            {isFollowupRequired && (
                                <TouchableOpacity onPress={() => openDatePicker('followUpDate')} activeOpacity={0.7}>
                                    <AppInput
                                        label="Next Followup Date"
                                        placeholder="Select date"
                                        value={formatDateString(formData.followUpDate)}
                                        editable={false}
                                        required
                                        rightIcon="calendar-outline"
                                        pointerEvents="none"
                                    />
                                </TouchableOpacity>
                            )}

                            <View style={styles.fieldItem}>
                                <AppText size="xs" weight="bold" color={Colors.textPrimary} style={{ marginBottom: 8 }}>Tags</AppText>
                                {formData.tags.length > 0 ? (
                                    <View style={styles.tagList}>
                                        {formData.tags.map(tag => (
                                            <TouchableOpacity
                                                key={tag}
                                                style={styles.tagChip}
                                                onPress={() => removeTag(tag)}
                                            >
                                                <AppText size="xs" weight="medium" color={Colors.primary}>{tag}</AppText>
                                                <IonIcon name="close-circle" size={ms(14)} color={Colors.primary} style={{ marginLeft: 4 }} />
                                            </TouchableOpacity>
                                        ))}
                                        <TouchableOpacity style={styles.addTagInline} onPress={() => setShowTagsPicker(true)}>
                                            <IonIcon name="add-circle" size={ms(24)} color={Colors.primary} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity style={styles.addTagButton} onPress={() => setShowTagsPicker(true)}>
                                        <IonIcon name="add-circle-outline" size={ms(20)} color={Colors.primary} />
                                        <AppText color={Colors.primary} weight="medium" style={{ marginLeft: 8 }}>Add Tags</AppText>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.fieldItem}>
                                <AppInput
                                    label="City"
                                    placeholder="Enter city"
                                    value={formData.city}
                                    onChangeText={val => handleInputChange('city', val)}
                                />
                            </View>

                            <View style={styles.fieldItem}>
                                <AppText size="xs" weight="bold" color={Colors.textPrimary} style={{ marginBottom: 4 }}>Notes</AppText>
                                <AppInput
                                    placeholder="Add notes..."
                                    value={formData.crmNotes}
                                    onChangeText={val => handleInputChange('crmNotes', val)}
                                    multiline
                                    numberOfLines={3}
                                    style={styles.textAreaSmall}
                                />
                            </View>

                            {/* CRM Sync Info Box */}
                            <View style={styles.syncBox}>
                                <View style={styles.row}>
                                    <IonIcon name="sparkles" size={ms(14)} color="#15803d" />
                                    <AppText size="xs" weight="bold" color="#15803d" style={{ marginLeft: 6 }}>CRM Sync</AppText>
                                </View>
                                <AppText size="xs" color="#15803d" style={{ marginTop: 4 }}>
                                    This contact will also appear in CRM → Contacts with all details synced.
                                </AppText>
                            </View>
                        </View>
                    )}

                    {/* Contact Details Section */}
                    <AppText size="md" weight="bold" color={Colors.textPrimary} style={styles.detailsHeader}>
                        Contact Details
                    </AppText>

                    <View style={styles.section}>
                        {formSettings.defaultQuestionsRequired.name && (
                            <AppInput
                                label="Full Name"
                                placeholder="Enter full name"
                                value={formData.fullName}
                                onChangeText={val => handleInputChange('fullName', val)}
                                leftIcon="person"
                                required={formSettings.defaultQuestionsRequired.name}
                            />
                        )}

                        {formSettings.defaultQuestionsRequired.mobile && (
                            <View style={{ marginBottom: Spacing.base }}>
                                <View style={styles.labelContainer}>
                                    <AppText size="sm" weight="medium" color={Colors.textPrimary} style={styles.label}>
                                        Mobile Number
                                    </AppText>
                                    <AppText size="sm" color={Colors.error}>
                                        {' *'}
                                    </AppText>
                                </View>
                                <View style={[styles.row, { alignItems: 'center' }]}>
                                    <View style={styles.countryPickerWrap}>
                                        <View style={styles.countryBox}>
                                            <CountryPicker
                                                countryCode={formData.countryCode}
                                                withFilter
                                                withFlag
                                                withCallingCode
                                                withAlphaFilter
                                                onSelect={(country) => {
                                                    handleInputChange('countryCode', country.cca2);
                                                    handleInputChange('callingCode', country.callingCode[0]);
                                                }}
                                                containerStyle={styles.pickerContainer}
                                            />
                                            <AppText style={{ marginLeft: ms(4) }}>+{formData.callingCode}</AppText>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                                        <AppInput
                                            placeholder="98765 43210"
                                            value={formData.mobile}
                                            onChangeText={val => handleInputChange('mobile', val)}
                                            leftIcon="call"
                                            keyboardType="phone-pad"
                                            containerStyle={{ marginBottom: 0 }}
                                        />
                                    </View>
                                </View>
                            </View>
                        )}

                        {formSettings.defaultQuestionsRequired.email && (
                            <AppInput
                                label="Email"
                                placeholder="email@company.com"
                                value={formData.email}
                                onChangeText={val => handleInputChange('email', val)}
                                leftIcon="mail"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                required={formSettings.defaultQuestionsRequired.email}
                            />
                        )}

                        <View style={styles.row}>
                            {formSettings.defaultQuestionsRequired.company && (
                                <View style={{ flex: 1 }}>
                                    <AppInput
                                        label="Company Name"
                                        placeholder="Company name"
                                        value={formData.company}
                                        onChangeText={val => handleInputChange('company', val)}
                                        leftIcon="business"
                                        required={formSettings.defaultQuestionsRequired.company}
                                    />
                                </View>
                            )}
                            {formSettings.defaultQuestionsRequired.company && formSettings.defaultQuestionsRequired.designation && <View style={{ width: Spacing.lg }} />}
                            {formSettings.defaultQuestionsRequired.designation && (
                                <View style={{ flex: 1 }}>
                                    <AppInput
                                        label="Designation"
                                        placeholder="Job title"
                                        value={formData.designation}
                                        onChangeText={val => handleInputChange('designation', val)}
                                        leftIcon="briefcase"
                                        required={formSettings.defaultQuestionsRequired.designation}
                                    />
                                </View>
                            )}
                        </View>

                        {/* More Info Logic */}
                        <TouchableOpacity
                            style={styles.moreInfoBtn}
                            onPress={() => setIsMoreInfoOpen(!isMoreInfoOpen)}
                        >
                            <AppText size="sm" weight="bold" color={Colors.primary}>
                                {isMoreInfoOpen ? 'Show less info' : 'Add more info (DOB, Anniversary...)'}
                            </AppText>
                            <IonIcon
                                name={isMoreInfoOpen ? 'chevron-up' : 'chevron-down'}
                                size={ms(18)}
                                color={Colors.primary}
                            />
                        </TouchableOpacity>

                        {isMoreInfoOpen && (
                            <View style={{ marginTop: Spacing.md }}>
                                <View style={{ marginBottom: Spacing.md }}>
                                    <AppText size="xs" weight="bold" color={Colors.textPrimary} style={{ marginBottom: 8 }}>Date of Birth</AppText>
                                    <TouchableOpacity
                                        style={styles.dropdownTrigger}
                                        onPress={() => openDatePicker('dob')}
                                    >
                                        <View style={styles.row}>
                                            <IonIcon name="calendar-outline" size={ms(18)} color={Colors.textTertiary} />
                                            <AppText color={formData.dob ? Colors.textPrimary : Colors.textSecondary} style={{ marginLeft: 10 }}>
                                                {formData.dob ? formatDateString(formData.dob) : 'Select date'}
                                            </AppText>
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ marginBottom: Spacing.md }}>
                                    <AppText size="xs" weight="bold" color={Colors.textPrimary} style={{ marginBottom: 8 }}>Date of Anniversary</AppText>
                                    <TouchableOpacity
                                        style={styles.dropdownTrigger}
                                        onPress={() => openDatePicker('anniversary')}
                                    >
                                        <View style={styles.row}>
                                            <IonIcon name="heart-outline" size={ms(18)} color={Colors.textTertiary} />
                                            <AppText color={formData.anniversary ? Colors.textPrimary : Colors.textSecondary} style={{ marginLeft: 10 }}>
                                                {formData.anniversary ? formatDateString(formData.anniversary) : 'Select date'}
                                            </AppText>
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <AppInput
                                    label="Notes"
                                    placeholder="Add general notes about this contact..."
                                    value={formData.notes}
                                    onChangeText={v => handleInputChange('notes', v)}
                                    multiline
                                    numberOfLines={4}
                                    style={styles.textArea}
                                />

                                {formSettings.extraQuestions?.length > 0 && (
                                    <>
                                        <View style={[styles.line, { marginVertical: Spacing.lg, opacity: 0.5 }]} />
                                        <AppText weight="bold" color={Colors.textPrimary} style={{ marginBottom: Spacing.md }}>Custom questions</AppText>

                                        {formSettings.extraQuestions.map((q, i) => (
                                            <View key={i} style={{ marginBottom: Spacing.md }}>
                                                <AppText size="xs" weight="bold" color={Colors.textPrimary} style={{ marginBottom: 8 }}>
                                                    {q.question}{q.starred ? ' *' : ''}
                                                </AppText>
                                                {q.questionType === 'options' && q.options?.length > 0 ? (
                                                    <TouchableOpacity
                                                        style={styles.dropdownTrigger}
                                                        onPress={() => {
                                                            setCurrentGroupId(i);
                                                            setShowExtraQuestionPicker(true);
                                                        }}
                                                    >
                                                        <View style={styles.row}>
                                                            <IonIcon name="help-circle-outline" size={ms(18)} color={Colors.textTertiary} />
                                                            <AppText color={extraAnswers[i] ? Colors.textPrimary : Colors.textSecondary} style={{ marginLeft: 10 }}>
                                                                {extraAnswers[i] || 'Select...'}
                                                            </AppText>
                                                        </View>
                                                        <IonIcon name="chevron-down" size={ms(18)} color={Colors.textTertiary} />
                                                    </TouchableOpacity>
                                                ) : (
                                                    <AppInput
                                                        placeholder="Enter answer"
                                                        value={extraAnswers[i] || ''}
                                                        onChangeText={val => setExtraAnswers(prev => ({ ...prev, [i]: val }))}
                                                        containerStyle={{ marginBottom: 0 }}
                                                        required={q.starred}
                                                    />
                                                )}
                                            </View>
                                        ))}
                                    </>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Communication Purpose */}
                    <View style={styles.sectionHeader}>
                        <IonIcon name="chatbox-ellipses-outline" size={ms(20)} color={Colors.primary} />
                        <AppText weight="bold" style={{ marginLeft: ms(8) }}>Communication Purpose</AppText>
                    </View>

                    <View style={styles.purposeTabs}>
                        {renderRadioButton('Intro Sender', 'intro')}
                        {renderRadioButton('Lead Nurturing', 'lead-nurturing')}
                        {renderRadioButton('Reverse Marketing', 'reverse-marketing')}
                    </View>

                    {/* Intro Sender Settings */}
                    {formData.communicationPurpose === 'intro' && (
                        <View style={styles.settingsCard}>
                            <View style={styles.settingsHeader}>
                                <AppText weight="bold" size="sm" color={Colors.primary}>Intro Sender Settings</AppText>
                            </View>

                            <TouchableOpacity
                                style={styles.dropdownTrigger}
                                onPress={() => setShowIntroTemplatePicker(true)}
                            >
                                <AppText numberOfLines={1} ellipsizeMode="tail" width={width * 0.7} color={formData.selectedIntroTemplate ? Colors.textPrimary : Colors.textSecondary}>
                                    {getLabelForId(introTemplates, formData.selectedIntroTemplate, t => `${t.templateNo}: ${t.emailSubject}`) || 'Select Intro Template'}
                                </AppText>
                                <IonIcon name="chevron-down" size={ms(18)} color={Colors.textTertiary} />
                            </TouchableOpacity>

                            <View style={styles.dividerRow}>
                                <View style={styles.dividerLine} />
                                <AppText size="xs" color={Colors.textTertiary} style={{ marginHorizontal: ms(8) }}>OR</AppText>
                                <View style={styles.dividerLine} />
                            </View>

                            <AppInput
                                label="Dynamic Message"
                                placeholder="Type your custom message..."
                                value={formData.dynamicMessage}
                                onChangeText={v => handleInputChange('dynamicMessage', v)}
                                multiline
                                numberOfLines={4}
                                style={styles.textArea}
                            />
                        </View>
                    )}

                    {/* Lead Nurturing Settings */}
                    {formData.communicationPurpose === 'lead-nurturing' && (
                        <View style={styles.settingsCard}>
                            <View style={styles.settingsHeader}>
                                <AppText weight="bold" size="sm" color={Colors.primary}>Lead Nurturing Settings</AppText>
                            </View>

                            <TouchableOpacity
                                style={styles.addPickerButton}
                                onPress={() => setShowCommGroupPicker(true)}
                            >
                                <IonIcon name="add-circle-outline" size={ms(20)} color={Colors.primary} />
                                <AppText color={Colors.primary} weight="bold" style={{ marginLeft: ms(6) }}>Add Pipeline</AppText>
                            </TouchableOpacity>

                            {formData.selectedGroups.map((groupId) => {
                                const group = getCommGroup(groupId);
                                const assignment = formData.groupAssignments[groupId];
                                return (
                                    <View key={groupId} style={styles.assignmentItem}>
                                        <View style={styles.rowBetween}>
                                            <AppText weight="bold" size="sm">{group?.name}</AppText>
                                            <TouchableOpacity onPress={() => handleRemoveCommGroup(groupId)}>
                                                <IonIcon name="trash-outline" size={ms(18)} color={Colors.error} />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.row}>
                                            <View style={{ flex: 1 }}>
                                                <TouchableOpacity
                                                    style={styles.smallDropdown}
                                                    onPress={() => {
                                                        setCurrentGroupId(groupId);
                                                        setShowStagePicker(true);
                                                    }}
                                                >
                                                    <AppText size="xs" numberOfLines={1}>
                                                        {getLabelForId(getStagesForCommGroup(groupId), assignment.stageId) || 'Select Stage'}
                                                    </AppText>
                                                </TouchableOpacity>
                                            </View>
                                            <View style={{ width: ms(8) }} />
                                            <View style={{ flex: 1 }}>
                                                <TouchableOpacity
                                                    style={[styles.smallDropdown, !assignment.stageId && styles.disabledDropdown]}
                                                    disabled={!assignment.stageId}
                                                    onPress={() => {
                                                        setCurrentGroupId(groupId);
                                                        setCurrentStageId(assignment.stageId);
                                                        setShowTemplatePicker(true);
                                                    }}
                                                >
                                                    <AppText size="xs" numberOfLines={1}>
                                                        {getLabelForId(getTemplatesForCommStage(groupId, assignment.stageId), assignment.templateId, 'templateName') || 'Select Template'}
                                                    </AppText>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Reverse Marketing Settings */}
                    {formData.communicationPurpose === 'reverse-marketing' && (
                        <View style={styles.settingsCard}>
                            <View style={styles.settingsHeader}>
                                <AppText weight="bold" size="sm" color={Colors.primary}>Reverse Marketing Settings</AppText>
                            </View>

                            <TouchableOpacity
                                style={styles.addPickerButton}
                                onPress={() => setShowCommReverseGroupPicker(true)}
                            >
                                <IonIcon name="add-circle-outline" size={ms(20)} color={Colors.primary} />
                                <AppText color={Colors.primary} weight="bold" style={{ marginLeft: ms(6) }}>Add Event</AppText>
                            </TouchableOpacity>

                            {formData.selectedReverseGroups.map((groupId) => {
                                const group = getCommGroup(groupId);
                                const templateId = formData.reverseGroupTemplates[groupId];
                                return (
                                    <View key={groupId} style={styles.assignmentItem}>
                                        <View style={styles.rowBetween}>
                                            <AppText weight="bold" size="sm">{group?.name}</AppText>
                                            <TouchableOpacity onPress={() => handleRemoveReverseGroup(groupId)}>
                                                <IonIcon name="trash-outline" size={ms(18)} color={Colors.error} />
                                            </TouchableOpacity>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.smallDropdown}
                                            onPress={() => {
                                                setCurrentGroupId(groupId);
                                                setShowReverseTemplatePicker(true);
                                            }}
                                        >
                                            <AppText size="xs">
                                                {getLabelForId(getTemplatesForReverseGroup(groupId), templateId, 'templateName') || 'Select Event Template'}
                                            </AppText>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Channel Consent */}
                    <View style={styles.consentSection}>
                        <AppText size="sm" weight="bold" color={Colors.textPrimary}>Channel Consent</AppText>
                        <View style={[styles.row, { marginTop: Spacing.md }]}>
                            <View style={styles.consentItem}>
                                <Switch
                                    value={formData.whatsappConsent}
                                    onValueChange={val => handleInputChange('whatsappConsent', val)}
                                    trackColor={{ false: '#D1D5DB', true: '#15803d' }}
                                />
                                <View style={[styles.row, { marginLeft: Spacing.sm }]}>
                                    <IonIcon name="logo-whatsapp" size={ms(18)} color="#22c55e" />
                                    <AppText size="sm" style={{ marginLeft: 4 }}>WhatsApp</AppText>
                                </View>
                            </View>
                            <View style={{ width: Spacing.xl }} />
                            <View style={styles.consentItem}>
                                <Switch
                                    value={formData.emailConsent}
                                    onValueChange={val => handleInputChange('emailConsent', val)}
                                    trackColor={{ false: '#D1D5DB', true: '#15803d' }}
                                />
                                <View style={[styles.row, { marginLeft: Spacing.sm }]}>
                                    <IonIcon name="mail-outline" size={ms(18)} color="#4f46e5" />
                                    <AppText size="sm" style={{ marginLeft: 4 }}>Email</AppText>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Bottom Actions */}
                    <View style={styles.footerContainer}>
                        <View style={{ flex: 1 }}>
                            <AppButton
                                title="Save Contact"
                                onPress={handleSave}
                                style={styles.saveBtn}
                                backgroundColor="#15803d"
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.refreshCheck}
                            onPress={() => handleInputChange('refreshAfterSave', !formData.refreshAfterSave)}
                        >
                            <IonIcon
                                name={formData.refreshAfterSave ? "checkbox" : "square-outline"}
                                size={ms(22)}
                                color={formData.refreshAfterSave ? "#15803d" : Colors.textTertiary}
                            />
                            <AppText size="sm" style={{ marginLeft: Spacing.xs }}>Refresh form after save</AppText>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: vs(40) }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Modals */}
            {showDatePicker && (
                <DateTimePicker
                    value={formData[datePickerTarget] || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    minimumDate={datePickerTarget === 'followUpDate' ? new Date() : undefined}
                />
            )}

            <SearchablePicker
                visible={showPipelinePicker}
                onClose={() => setShowPipelinePicker(false)}
                title="Select Pipeline"
                items={pipelines}
                getLabel={p => p.name}
                getKey={p => p._id || p.id}
                selectedKey={formData.pipelineId}
                onSelect={p => {
                    handleInputChange('pipelineId', p?._id || p?.id || '');
                    handleInputChange('stageId', '');
                    setShowPipelinePicker(false);
                }}
            />

            <SearchablePicker
                visible={showStagePicker}
                onClose={() => setShowStagePicker(false)}
                title="Select Stage"
                items={currentGroupId ? getStagesForCommGroup(currentGroupId) : availableStages}
                getLabel={s => s.name}
                getKey={s => s._id || s.id}
                selectedKey={currentGroupId ? formData.groupAssignments[currentGroupId]?.stageId : formData.stageId}
                onSelect={s => {
                    const sid = s?._id || s?.id || '';
                    if (currentGroupId) {
                        handleUpdateCommAssignment(currentGroupId, 'stageId', sid);
                    } else {
                        handleInputChange('stageId', sid);
                    }
                    setShowStagePicker(false);
                }}
            />

            <SearchablePicker
                visible={showProductPicker}
                onClose={() => setShowProductPicker(false)}
                title="Select Product"
                items={products}
                getLabel={p => p.name}
                getKey={p => p._id || p.id}
                selectedKey={formData.productId}
                onSelect={p => {
                    handleInputChange('productId', p?._id || p?.id || '');
                    setShowProductPicker(false);
                }}
            />

            <SearchablePicker
                visible={showSourcePicker}
                onClose={() => setShowSourcePicker(false)}
                title="Select Source"
                items={leadSources}
                getLabel={s => s.name}
                getKey={s => s._id || s.id}
                selectedKey={formData.source}
                onSelect={s => {
                    handleInputChange('source', s?._id || s?.id || '');
                    setShowSourcePicker(false);
                }}
            />

            <SearchablePicker
                visible={showTagsPicker}
                onClose={() => setShowTagsPicker(false)}
                title="Select Tags"
                items={leadTags}
                getLabel={t => t.name}
                getKey={t => t._id || t.id}
                onSelect={t => {
                    const name = t.name;
                    if (name && !formData.tags.includes(name)) {
                        handleInputChange('tags', [...formData.tags, name]);
                    }
                    setShowTagsPicker(false);
                }}
            />

            <SearchablePicker
                visible={showIntroTemplatePicker}
                onClose={() => setShowIntroTemplatePicker(false)}
                title="Select Intro Template"
                items={introTemplates}
                getLabel={t => `${t.templateNo}: ${t.emailSubject}`}
                getKey={t => t._id || t.id}
                selectedKey={formData.selectedIntroTemplate}
                onSelect={t => {
                    handleInputChange('selectedIntroTemplate', t?._id || t?.id || '');
                    setShowIntroTemplatePicker(false);
                }}
            />

            <SearchablePicker
                visible={showCommGroupPicker}
                onClose={() => setShowCommGroupPicker(false)}
                title="Select Pipeline"
                items={commPipelines}
                getLabel={g => g.name}
                getKey={g => g._id || g.id}
                onSelect={g => {
                    handleAddCommGroup(g?._id || g?.id);
                    setShowCommGroupPicker(false);
                }}
            />

            <SearchablePicker
                visible={showTemplatePicker}
                onClose={() => setShowTemplatePicker(false)}
                title="Select Template"
                items={currentGroupId && currentStageId ? getTemplatesForCommStage(currentGroupId, currentStageId) : []}
                getLabel={t => t.templateName}
                getKey={t => t._id || t.id}
                onSelect={t => {
                    handleUpdateCommAssignment(currentGroupId, 'templateId', t?._id || t?.id || '');
                    setShowTemplatePicker(false);
                }}
            />

            <SearchablePicker
                visible={showCommReverseGroupPicker}
                onClose={() => setShowCommReverseGroupPicker(false)}
                title="Select Event"
                items={commEvents}
                getLabel={g => g.name}
                getKey={g => g._id || g.id}
                onSelect={g => {
                    handleAddReverseGroup(g?._id || g?.id);
                    setShowCommReverseGroupPicker(false);
                }}
            />

            <SearchablePicker
                visible={showReverseTemplatePicker}
                onClose={() => setShowReverseTemplatePicker(false)}
                title="Select Event Template"
                items={currentGroupId ? getTemplatesForReverseGroup(currentGroupId) : []}
                getLabel={t => t.templateName}
                getKey={t => t._id || t.id}
                onSelect={t => {
                    handleUpdateReverseAssignment(currentGroupId, t?._id || t?.id || '');
                    setShowReverseTemplatePicker(false);
                }}
            />

            <SearchablePicker
                visible={showExtraQuestionPicker}
                onClose={() => setShowExtraQuestionPicker(false)}
                title={formSettings.extraQuestions[currentGroupId]?.question || 'Select...'}
                items={currentGroupId !== null ? formSettings.extraQuestions[currentGroupId]?.options?.map(o => ({ id: o, name: o })) : []}
                getLabel={o => o.name}
                getKey={o => o.id}
                onSelect={o => {
                    setExtraAnswers(prev => ({ ...prev, [currentGroupId]: o?.name || '' }));
                    setShowExtraQuestionPicker(false);
                }}
            />

        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        padding: Spacing.md,
        paddingBottom: vs(100),
    },
    topToggleCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...Shadow.small,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#f0fdf4',
    },
    crmDetailsSection: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        ...Shadow.small,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: '#f0fdf4',
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        ...Shadow.small,
        marginBottom: Spacing.lg,
    },
    detailsHeader: {
        marginBottom: Spacing.sm,
        marginLeft: ms(4),
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ms(8),
    },
    fieldItem: {
        marginBottom: Spacing.md,
    },
    labelContainer: {
        flexDirection: 'row',
        marginBottom: ms(8),
    },
    label: {
        marginLeft: ms(4),
    },
    countryPickerWrap: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: BorderRadius.md,
        height: ms(48),
        justifyContent: 'center',
        paddingHorizontal: ms(12),
        backgroundColor: '#F9FAFB',
    },
    countryBox: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pickerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreInfoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: ms(12),
        marginTop: ms(8),
        gap: ms(4),
    },
    dropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: BorderRadius.md,
        padding: ms(12),
        backgroundColor: '#F9FAFB',
        height: ms(48),
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
        marginTop: Spacing.sm,
        paddingHorizontal: ms(4),
    },
    purposeTabs: {
        flexDirection: 'row',
        gap: ms(8),
        marginBottom: Spacing.lg,
    },
    radioContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(10),
        paddingHorizontal: ms(8),
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
    },
    radioContainerActive: {
        borderColor: Colors.primary,
        backgroundColor: '#f0fdf4',
    },
    settingsCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        ...Shadow.small,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: '#f0f9ff',
    },
    settingsHeader: {
        marginBottom: Spacing.md,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.md,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    textArea: {
        height: ms(100),
        textAlignVertical: 'top',
    },
    textAreaSmall: {
        height: ms(80),
        textAlignVertical: 'top',
        backgroundColor: '#F9FAFB',
        borderRadius: BorderRadius.md,
        padding: ms(8),
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    addPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(12),
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: BorderRadius.md,
        borderStyle: 'dashed',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    assignmentItem: {
        backgroundColor: '#F9FAFB',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    smallDropdown: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: BorderRadius.md,
        padding: ms(8),
        backgroundColor: '#fff',
        height: ms(36),
        justifyContent: 'center',
    },
    disabledDropdown: {
        opacity: 0.5,
        backgroundColor: '#F3F4F6',
    },
    consentSection: {
        marginBottom: Spacing.xl,
        paddingHorizontal: ms(4),
    },
    consentItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    footerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(4),
    },
    saveBtn: {
        borderRadius: BorderRadius.md,
        height: ms(50),
    },
    refreshCheck: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: Spacing.lg,
    },
    syncBox: {
        marginTop: Spacing.md,
        padding: Spacing.sm,
        backgroundColor: '#f0fdf4',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: '#15803d22',
    },
    tagList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    addTagButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary,
        borderStyle: 'dashed',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    addTagInline: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    line: {
        height: 1,
        backgroundColor: '#000',
    },
});

export default AddSingleContactScreen;
