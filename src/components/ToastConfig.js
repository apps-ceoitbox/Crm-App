/**
 * Toast Configuration
 * Professional toast notifications with custom styling
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/Colors';
import { BorderRadius, Shadow, Spacing } from '../constants/Spacing';
import { ms, vs, wp } from '../utils/Responsive';
import AppText from './AppText';

/**
 * Custom toast config with professional styling
 */
export const toastConfig = {
    /**
     * Success Toast - Green theme
     */
    success: ({ text1, text2, onPress, props }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[styles.container, styles.successContainer]}
        >
            <View style={[styles.iconContainer, styles.successIcon]}>
                <Icon name="checkmark-circle" size={ms(24)} color={Colors.white} />
            </View>
            <View style={styles.textContainer}>
                {text1 && (
                    <AppText size="base" weight="semiBold" color={Colors.white} numberOfLines={1}>
                        {text1}
                    </AppText>
                )}
                {text2 && (
                    <AppText size="sm" color="rgba(255,255,255,0.9)" numberOfLines={2} style={styles.text2}>
                        {text2}
                    </AppText>
                )}
            </View>
            <TouchableOpacity onPress={() => Toast.hide()} style={styles.closeButton}>
                <Icon name="close" size={ms(18)} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
        </TouchableOpacity>
    ),

    /**
     * Error Toast - Red theme
     */
    error: ({ text1, text2, onPress, props }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[styles.container, styles.errorContainer]}
        >
            <View style={[styles.iconContainer, styles.errorIcon]}>
                <Icon name="close-circle" size={ms(24)} color={Colors.white} />
            </View>
            <View style={styles.textContainer}>
                {text1 && (
                    <AppText size="base" weight="semiBold" color={Colors.white} numberOfLines={1}>
                        {text1}
                    </AppText>
                )}
                {text2 && (
                    <AppText size="sm" color="rgba(255,255,255,0.9)" numberOfLines={2} style={styles.text2}>
                        {text2}
                    </AppText>
                )}
            </View>
            <TouchableOpacity onPress={() => Toast.hide()} style={styles.closeButton}>
                <Icon name="close" size={ms(18)} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
        </TouchableOpacity>
    ),

    /**
     * Info Toast - Blue theme
     */
    info: ({ text1, text2, onPress, props }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[styles.container, styles.infoContainer]}
        >
            <View style={[styles.iconContainer, styles.infoIcon]}>
                <Icon name="information-circle" size={ms(24)} color={Colors.white} />
            </View>
            <View style={styles.textContainer}>
                {text1 && (
                    <AppText size="base" weight="semiBold" color={Colors.white} numberOfLines={1}>
                        {text1}
                    </AppText>
                )}
                {text2 && (
                    <AppText size="sm" color="rgba(255,255,255,0.9)" numberOfLines={2} style={styles.text2}>
                        {text2}
                    </AppText>
                )}
            </View>
            <TouchableOpacity onPress={() => Toast.hide()} style={styles.closeButton}>
                <Icon name="close" size={ms(18)} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
        </TouchableOpacity>
    ),

    /**
     * Warning Toast - Orange theme
     */
    warning: ({ text1, text2, onPress, props }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[styles.container, styles.warningContainer]}
        >
            <View style={[styles.iconContainer, styles.warningIcon]}>
                <Icon name="warning" size={ms(24)} color={Colors.white} />
            </View>
            <View style={styles.textContainer}>
                {text1 && (
                    <AppText size="base" weight="semiBold" color={Colors.white} numberOfLines={1}>
                        {text1}
                    </AppText>
                )}
                {text2 && (
                    <AppText size="sm" color="rgba(255,255,255,0.9)" numberOfLines={2} style={styles.text2}>
                        {text2}
                    </AppText>
                )}
            </View>
            <TouchableOpacity onPress={() => Toast.hide()} style={styles.closeButton}>
                <Icon name="close" size={ms(18)} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
        </TouchableOpacity>
    ),
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        width: wp(92),
        minHeight: vs(60),
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
        marginHorizontal: wp(4),
        ...Shadow.lg,
    },
    successContainer: {
        backgroundColor: '#059669',
    },
    errorContainer: {
        backgroundColor: '#DC2626',
    },
    infoContainer: {
        backgroundColor: '#0EA5E9',
    },
    warningContainer: {
        backgroundColor: '#F59E0B',
    },
    iconContainer: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(20),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    successIcon: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    errorIcon: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    infoIcon: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    warningIcon: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    text2: {
        marginTop: vs(2),
    },
    closeButton: {
        width: ms(30),
        height: ms(30),
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Spacing.sm,
    },
});

export default toastConfig;
