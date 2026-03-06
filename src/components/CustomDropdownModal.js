import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../constants/Spacing';
import { ms, vs } from '../utils/Responsive';

const CustomDropdownModal = ({
  visible,
  onClose,
  options,
  onSelect,
  title,
  searchable = false,
  hideHeader = false,
  selectedValue = null,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = searchable
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : options;

  const handleSelect = item => {
    onSelect(item.value, item);
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {!hideHeader && (
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{title}</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <IonIcon name="close" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {searchable && (
                <View style={styles.searchContainer}>
                  <IonIcon
                    name="search-outline"
                    size={20}
                    color={Colors.textSecondary}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by contact name, email or product..."
                    placeholderTextColor={Colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus={hideHeader}
                  />
                </View>
              )}

              <FlatList
                data={filteredOptions}
                keyExtractor={item => String(item.value)}
                renderItem={({ item }) => {
                  const isSelected = selectedValue === item.value;
                  return (
                    <TouchableOpacity
                      style={[styles.optionItem, isSelected && styles.selectedOptionItem]}
                      onPress={() => handleSelect(item)}
                    >
                      {isSelected && (
                        <IonIcon name="checkmark" size={20} color={Colors.primary} style={styles.checkIcon} />
                      )}
                      <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No options found</Text>
                }
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    width: '90%',
    maxHeight: '60%',
    ...Shadow.md,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  closeButton: {
    padding: Spacing.xs,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: BorderRadius.round,
  },
  modalTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: vs(44),
    fontSize: ms(14),
    color: Colors.textPrimary,
  },
  listContent: {
    paddingBottom: Spacing.md,
  },
  optionItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedOptionItem: {
    backgroundColor: '#ECFDF5', // Light emerald green background
  },
  checkIcon: {
    marginRight: Spacing.sm,
  },
  optionText: {
    fontSize: ms(15),
    color: Colors.textPrimary,
  },
  selectedOptionText: {
    color: Colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.xl,
    color: Colors.textSecondary,
    fontSize: ms(14),
  },
});

export default CustomDropdownModal;
