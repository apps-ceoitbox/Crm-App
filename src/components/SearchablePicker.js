import React, { useState, useMemo } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Modal,
    FlatList,
    TextInput,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/Colors';
import { Spacing, BorderRadius } from '../constants/Spacing';
import { ms, vs } from '../utils/Responsive';
import AppText from './AppText';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

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
                                        <AppText width={width * 0.8} color={isSelected ? Colors.primary : Colors.textPrimary} weight={isSelected ? "bold" : "regular"} numberOfLines={1}>{label}</AppText>
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

const styles = StyleSheet.create({
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

export default SearchablePicker;
