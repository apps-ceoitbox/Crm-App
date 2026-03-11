/**
 * Edit Task Screen
 * Form to update an existing task — UI updated to match premium AddTaskScreen design
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
  TextInput,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText, AppInput, AppButton, ModalLoader } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { leadsAPI, tasksAPI } from '../../api';
import { showError, showSuccess } from '../../utils';
import { ROUTES } from '../../constants';

// Maps for status conversion
const API_STATUS_TO_UI = {
  open: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const UI_STATUS_TO_API = {
  Pending: 'open',
  'In Progress': 'in_progress',
  Completed: 'done',
};

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
  onSearch,
  loading = false,
  onEndReached,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (onSearch) return items;
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item => (getLabel(item) || '').toLowerCase().includes(q));
  }, [items, query, getLabel, onSearch]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleSearch = (text) => {
    setQuery(text);
    if (onSearch) onSearch(text);
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
              onChangeText={handleSearch}
              autoCorrect={false}
              returnKeyType="search"
            />
            {(query.length > 0 || loading) && (
              <TouchableOpacity onPress={() => handleSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name={loading ? "refresh" : "close-circle"} size={ms(16)} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={allowNone ? [{ __none: true }, ...filtered] : filtered}
            keyExtractor={(item, idx) => (item.__none ? '__none__' : (getKey(item) || String(idx)))}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => {
              if (item.__none) {
                const isSelected = !selectedKey || selectedKey === 'none';
                return (
                  <TouchableOpacity style={[styles.pickerItem, isSelected && styles.pickerItemActive]} onPress={() => onSelect(null)} activeOpacity={0.7}>
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>None</Text>
                    {isSelected && <View style={styles.checkCircle}><Icon name="checkmark" size={ms(12)} color="#fff" /></View>}
                  </TouchableOpacity>
                );
              }
              const key = getKey(item);
              const label = getLabel(item);
              const isSelected = selectedKey === key;
              return (
                <TouchableOpacity style={[styles.pickerItem, isSelected && styles.pickerItemActive]} onPress={() => onSelect(item)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]} numberOfLines={1}>{label}</Text>
                    {item.email && <Text style={styles.pickerItemSubtext} numberOfLines={1}>{item.email}</Text>}
                  </View>
                  {isSelected && <View style={styles.checkCircle}><Icon name="checkmark" size={ms(12)} color="#fff" /></View>}
                </TouchableOpacity>
              );
            }}
            style={styles.pickerList}
            ListEmptyComponent={
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>{loading ? 'Searching...' : 'No results found'}</Text>
              </View>
            }
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

const TASK_PRIORITIES = [
  { id: 'Low', color: '#3B82F6', bg: '#EFF6FF', icon: 'flag-outline' },
  { id: 'Medium', color: '#F59E0B', bg: '#FFFBEB', icon: 'flag-outline' },
  { id: 'High', color: '#EF4444', bg: '#FEF2F2', icon: 'flag-outline' },
  { id: 'Urgent', color: '#DC2626', bg: '#FEF2F2', icon: 'alert-circle-outline' },
];

const TASK_STATUSES = [
  { id: 'Pending', color: '#6B7280', bg: '#F3F4F6' },
  { id: 'In Progress', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'Completed', color: '#10B981', bg: '#ECFDF5' },
];

const EditTaskScreen = ({ navigation, route }) => {
  const taskData = route.params?.task || {};
  const { fetchAllUsers, allUsers } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Store initial form state for comparison to disable/enable Update button
  const initialData = useMemo(() => {
    return {
      title: taskData.title || '',
      description: taskData.description || '',
      remarks: taskData.remark || taskData.remarks || '',
      dueDate: taskData.dueAt ? new Date(taskData.dueAt) : (taskData.dueDate ? new Date(taskData.dueDate) : new Date()),
      priority: taskData.priority
        ? taskData.priority.charAt(0).toUpperCase() + taskData.priority.slice(1).toLowerCase()
        : 'Medium',
      status: API_STATUS_TO_UI[taskData.status?.toLowerCase()] || 'Pending',
      assignedTo: typeof taskData.assignedTo === 'object' ? (taskData.assignedTo?._id || taskData.assignedTo?.id || null) : (taskData.assignedTo || null),
      leadId: taskData.relatedTo?.entityId
        ? (typeof taskData.relatedTo.entityId === 'object' ? (taskData.relatedTo.entityId._id || taskData.relatedTo.entityId.id) : taskData.relatedTo.entityId)
        : null,
    };
  }, [taskData]);

  // Form state pre-filled from existing task
  const [formData, setFormData] = useState(initialData);

  // Determine if form has been modified
  const isModified = useMemo(() => {
    // Check if any field changed
    const basicChanges =
      formData.title !== initialData.title ||
      formData.description !== initialData.description ||
      formData.remarks !== initialData.remarks ||
      formData.priority !== initialData.priority ||
      formData.status !== initialData.status ||
      formData.assignedTo !== initialData.assignedTo ||
      formData.leadId !== initialData.leadId;

    if (basicChanges) return true;

    // Check if due date changed (ignoring slight time differences if any, for better UX)
    const date1 = new Date(formData.dueDate).getTime();
    const date2 = new Date(initialData.dueDate).getTime();
    return Math.abs(date1 - date2) > 1000; // Ignore sub-second differences
  }, [formData, initialData]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Picker dependencies
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsHasMore, setLeadsHasMore] = useState(true);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');

  // UI states
  const [activePicker, setActivePicker] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const descriptionRef = useRef(null);
  const leadSearchTimerRef = useRef(null);
  const LEADS_LIMIT = 20;

  useEffect(() => {
    if (!allUsers || allUsers.length === 0) {
      fetchAllUsers();
    }
    // If editing, try to populate the leads list starting with the specific lead if needed
    fetchLeads('', 1);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchLeads = async (search = '', page = 1) => {
    try {
      if (page === 1) setLeadsLoading(true);
      else setLoadingMoreLeads(true);
      const params = { limit: LEADS_LIMIT, page };
      if (search) params.search = search;
      const response = await leadsAPI.getAll(params);
      if (response.success && response.data) {
        const leadsData = Array.isArray(response.data.data) ? response.data.data :
          Array.isArray(response.data) ? response.data :
            response.data.leads || [];

        const mappedLeads = leadsData.map(l => ({
          id: l.id || l._id,
          label: `${l.contact?.firstName || ''} ${l.contact?.lastName || ''}`.trim() || l.email || 'Unknown Lead',
          email: l.contact?.email || '',
          title: l.title || ''
        }));

        if (page === 1) {
          setLeads(mappedLeads);
        } else {
          setLeads(prev => [...prev, ...mappedLeads]);
        }
        setLeadsHasMore(mappedLeads.length === LEADS_LIMIT);
        setLeadsPage(page);
      }
    } catch (error) {
      console.log('Error fetching leads:', error);
    } finally {
      setLeadsLoading(false);
      setLoadingMoreLeads(false);
    }
  };

  const handleLeadSearch = (text) => {
    setLeadSearchQuery(text);
    if (leadSearchTimerRef.current) clearTimeout(leadSearchTimerRef.current);
    leadSearchTimerRef.current = setTimeout(() => {
      fetchLeads(text, 1);
    }, 500);
  };

  const handleLeadEndReached = () => {
    if (leadsHasMore && !loadingMoreLeads && !leadsLoading) {
      fetchLeads(leadSearchQuery, leadsPage + 1);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required';
    if (!formData.leadId) newErrors.leadId = 'Lead is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    Keyboard.dismiss();
    if (!validateForm()) {
      showError('Validation Error', 'Please complete all required fields.');
      return;
    }

    setLoading(true);
    try {
      const taskId = taskData._id || taskData.id;
      const apiPayload = {
        assignedTo: formData.assignedTo || undefined,
        description: formData.description,
        dueAt: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        priority: formData.priority.toLowerCase(),
        relatedTo: formData.leadId ? {
          entityType: 'lead',
          entityId: formData.leadId
        } : undefined,
        addRemark: formData.remarks, // Matching existing Logic in EditTaskScreen (addRemark)
        status: UI_STATUS_TO_API[formData.status] || 'open',
        title: formData.title,
      };

      const result = await tasksAPI.update(taskId, apiPayload);
      if (result.success) {
        // Automatically update lead followup date (as on website)
        if (formData.leadId && formData.dueDate) {
          try {
            await leadsAPI.update(formData.leadId, {
              followup: formData.dueDate.toISOString()
            });
          } catch (error) {
            console.error('Failed to update lead followup:', error);
          }
        }

        showSuccess('Success', 'Task updated successfully!');
        navigation.navigate(ROUTES.MAIN_TABS, {
          screen: ROUTES.TASKS,
          params: { refresh: true },
        });
      } else {
        showError('Error', result.error || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      showError('Error', 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || event.type === 'set') {
      setShowDatePicker(false);
    }
    if (date) handleInputChange('dueDate', date);
  };

  const formatDateStr = d => {
    if (!d) return 'Pick a date';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const PickerTrigger = ({ value, placeholder, onPress, icon = 'chevron-expand-outline', hasValue, error }) => (
    <TouchableOpacity style={[styles.pickerTrigger, error && { borderColor: Colors.error }]} onPress={onPress} activeOpacity={0.7}>
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
            Edit Task
          </AppText>
          <AppText size="xs" color={Colors.textMuted} numberOfLines={1}>
            {taskData.title || 'Task'}
          </AppText>
        </View>
        <TouchableOpacity
          style={[styles.saveHeaderBtn, (loading || !isModified) && { opacity: 0.6 }]}
          onPress={handleUpdate}
          disabled={loading || !isModified}
          activeOpacity={0.8}
        >
          <Icon name="checkmark" size={ms(18)} color={Colors.white} />
          <Text style={styles.saveHeaderBtnText}>{loading ? 'Saving...' : 'Update'}</Text>
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
            {/* Task Details Section */}
            <View style={styles.section}>
              <SectionHeader icon="clipboard-outline" title="Task Details" />
              <InputField
                icon="clipboard-outline"
                label="Title *"
                placeholder="What needs to be done?"
                value={formData.title}
                onChangeText={(value) => handleInputChange('title', value)}
                error={!!errors.title}
                errorMessage={errors.title}
              />
              <InputField
                icon="document-text-outline"
                label="Description"
                placeholder="Add task description..."
                value={formData.description}
                onChangeText={(value) => handleInputChange('description', value)}
                multiline
                numberOfLines={3}
                containerStyle={styles.textAreaContainer}
              />
              <InputField
                icon="chatbubble-outline"
                label="Remarks"
                placeholder="Internal remarks..."
                value={formData.remarks}
                onChangeText={(value) => handleInputChange('remarks', value)}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Assignment Section */}
            <View style={styles.section}>
              <SectionHeader icon="people-outline" title="Links & Assignment" />

              <View style={styles.inputFieldContainer}>
                <Text style={styles.dropdownLabel}>Related Lead</Text>
                <PickerTrigger
                  value={leads.find(l => l.id === formData.leadId)?.label || (taskData.relatedTo?.entityId?.contact?.firstName ? `${taskData.relatedTo.entityId.contact.firstName} ${taskData.relatedTo.entityId.contact.lastName || ''}` : 'Select Lead')}
                  placeholder="Select Lead"
                  hasValue={!!formData.leadId}
                  onPress={() => setActivePicker('lead')}
                  icon="person-add-outline"
                  error={!!errors.leadId}
                />
                {errors.leadId && <Text style={styles.errorInlineText}>{errors.leadId}</Text>}
              </View>

              <View style={styles.inputFieldContainer}>
                <Text style={styles.dropdownLabel}>Assign To</Text>
                <PickerTrigger
                  value={allUsers.find(u => (u.id || u._id) === formData.assignedTo)?.name || 'Assign to me'}
                  placeholder="Assign to me"
                  hasValue={!!formData.assignedTo}
                  onPress={() => setActivePicker('assignee')}
                  icon="person-outline"
                />
              </View>
            </View>

            {/* Schedule Section */}
            <View style={styles.section}>
              <SectionHeader icon="calendar-outline" title="Schedule & Priority" />

              <View style={styles.inputFieldContainer}>
                <Text style={styles.dropdownLabel}>Due Date *</Text>
                <TouchableOpacity
                  style={[styles.dateTrigger, !!errors.dueDate && { borderColor: Colors.error }]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Icon name="calendar-outline" size={ms(18)} color={Colors.primary} />
                  <Text style={styles.dateTriggerText}>
                    {formatDateStr(formData.dueDate)}
                  </Text>
                  <Icon name="chevron-expand-outline" size={ms(15)} color={Colors.textTertiary} />
                </TouchableOpacity>
                {errors.dueDate && <Text style={styles.errorInlineText}>{errors.dueDate}</Text>}
              </View>

              <Text style={styles.dropdownLabel}>Priority</Text>
              <View style={styles.pillRow}>
                {TASK_PRIORITIES.map(p => {
                  const active = formData.priority === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.pill,
                        active && { backgroundColor: p.color, borderColor: p.color },
                      ]}
                      onPress={() => handleInputChange('priority', p.id)}
                    >
                      <Icon name={p.icon} size={ms(14)} color={active ? '#fff' : p.color} />
                      <Text style={[styles.pillText, active && { color: '#fff' }]}>{p.id}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.dropdownLabel, { marginTop: vs(16) }]}>Status</Text>
              <View style={styles.pillRow}>
                {TASK_STATUSES.map(s => {
                  const active = formData.status === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.pill,
                        active && { backgroundColor: s.color, borderColor: s.color },
                      ]}
                      onPress={() => handleInputChange('status', s.id)}
                    >
                      <Text style={[styles.pillText, active && { color: '#fff' }]}>{s.id}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </Animated.View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={formData.dueDate || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* Lead Picker */}
        <SearchablePicker
          visible={activePicker === 'lead'}
          title="Select Related Lead"
          items={leads}
          getLabel={l => l.label}
          getKey={l => l.id}
          selectedKey={formData.leadId}
          onSelect={l => {
            handleInputChange('leadId', l?.id || null);
            setActivePicker(null);
          }}
          onClose={() => setActivePicker(null)}
          onSearch={handleLeadSearch}
          onEndReached={handleLeadEndReached}
          loading={leadsLoading}
          allowNone={true}
        />

        {/* Assignee Picker */}
        <SearchablePicker
          visible={activePicker === 'assignee'}
          title="Assign Task To"
          items={allUsers}
          getLabel={u => u.name || u.email}
          getKey={u => u.id || u._id}
          selectedKey={formData.assignedTo}
          onSelect={u => {
            handleInputChange('assignedTo', u ? (u.id || u._id) : null);
            setActivePicker(null);
          }}
          onClose={() => setActivePicker(null)}
        />

        <ModalLoader visible={loading} text="Updating Task..." />
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
  textAreaContainer: { minHeight: vs(80) },
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
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: vs(48),
  },
  dateTriggerText: { fontSize: ms(14), color: Colors.textPrimary, marginLeft: ms(8), flex: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(10) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(14),
    paddingVertical: vs(10),
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: ms(6),
  },
  pillText: { fontSize: ms(13), fontWeight: '600', color: Colors.textSecondary },
  errorInlineText: { color: Colors.error, fontSize: ms(11), marginTop: vs(4), marginLeft: ms(4) },
  bottomSpacer: { height: vs(20) },

  // Modal Sheet Styles
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pickerItemActive: { backgroundColor: Colors.primary + '10' },
  pickerItemText: { fontSize: ms(15), color: Colors.textPrimary, fontWeight: '500' },
  pickerItemTextActive: { color: Colors.primary, fontWeight: '700' },
  pickerItemSubtext: { fontSize: ms(12), color: Colors.textTertiary, marginTop: vs(2) },
  checkCircle: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerEmpty: { padding: Spacing.xl, alignItems: 'center' },
  pickerEmptyText: { color: Colors.textTertiary, fontSize: ms(14) },
});

export default EditTaskScreen;
