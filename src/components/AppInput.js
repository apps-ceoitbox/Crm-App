/**
 * AppInput - Reusable Input Component
 * Provides consistent text input styling across the app
 */

import React, { useState, forwardRef } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/Colors';
import { BorderRadius, Spacing } from '../constants/Spacing';
import { FontSize } from '../constants/Fonts';
import { ms, hs, vs } from '../utils/Responsive';
import AppText from './AppText';

const AppInput = forwardRef(({
    label,
    placeholder,
    value,
    onChangeText,
    error,
    errorMessage,
    secureTextEntry = false,
    keyboardType = 'default',
    autoCapitalize = 'none',
    autoCorrect = false,
    maxLength,
    multiline = false,
    numberOfLines = 1,
    editable = true,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    inputStyle,
    labelStyle,
    required = false,
    helperText,
    onFocus,
    onBlur,
    returnKeyType = 'done',
    onSubmitEditing,
    ...props
}, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

    const handleFocus = (e) => {
        setIsFocused(true);
        onFocus && onFocus(e);
    };

    const handleBlur = (e) => {
        setIsFocused(false);
        onBlur && onBlur(e);
    };

    const togglePasswordVisibility = () => {
        setIsPasswordVisible(!isPasswordVisible);
    };

    const getBorderColor = () => {
        if (error) return Colors.error;
        if (isFocused) return Colors.inputFocusBorder;
        return Colors.inputBorder;
    };

    return (
        <View style={[styles.container, containerStyle]}>
            {/* Label */}
            {label && (
                <View style={styles.labelContainer}>
                    <AppText
                        style={[styles.label, labelStyle]}
                        size="sm"
                        weight="medium"
                        color={error ? Colors.error : Colors.textPrimary}
                    >
                        {label}
                    </AppText>
                    {required && (
                        <AppText size="sm" color={Colors.error}>
                            {' *'}
                        </AppText>
                    )}
                </View>
            )}

            {/* Input Container */}
            <View
                style={[
                    styles.inputContainer,
                    {
                        borderColor: getBorderColor(),
                        backgroundColor: editable ? Colors.inputBackground : Colors.borderLight,
                    },
                    multiline && styles.multilineContainer,
                ]}
            >
                {/* Left Icon */}
                {leftIcon && (
                    <Icon
                        name={leftIcon}
                        size={ms(20)}
                        color={isFocused ? Colors.primary : Colors.textMuted}
                        style={[styles.leftIcon, multiline && { paddingTop: vs(Spacing.inputPadding) }]}
                    />
                )}

                {/* Text Input */}
                <TextInput
                    ref={ref}
                    style={[
                        styles.input,
                        leftIcon && styles.inputWithLeftIcon,
                        (rightIcon || secureTextEntry) && styles.inputWithRightIcon,
                        multiline && styles.multilineInput,
                        inputStyle,
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.inputPlaceholder}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry && !isPasswordVisible}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    autoCorrect={autoCorrect}
                    maxLength={maxLength}
                    multiline={multiline}
                    numberOfLines={multiline ? numberOfLines : 1}
                    editable={editable}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    {...props}
                />

                {/* Right Icon / Password Toggle */}
                {secureTextEntry ? (
                    <TouchableOpacity
                        onPress={togglePasswordVisibility}
                        style={styles.rightIconButton}
                    >
                        <Icon
                            name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                            size={ms(20)}
                            color={Colors.textMuted}
                        />
                    </TouchableOpacity>
                ) : rightIcon ? (
                    <TouchableOpacity
                        onPress={onRightIconPress}
                        style={styles.rightIconButton}
                        disabled={!onRightIconPress}
                    >
                        <Icon
                            name={rightIcon}
                            size={ms(20)}
                            color={Colors.textMuted}
                        />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Error Message */}
            {error && errorMessage && (
                <View style={styles.errorContainer}>
                    <Icon name="alert-circle" size={ms(14)} color={Colors.error} />
                    <AppText size="xs" color={Colors.error} style={styles.errorText}>
                        {errorMessage}
                    </AppText>
                </View>
            )}

            {/* Helper Text */}
            {!error && helperText && (
                <AppText size="xs" color={Colors.textMuted} style={styles.helperText}>
                    {helperText}
                </AppText>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.base,
    },
    labelContainer: {
        flexDirection: 'row',
        marginBottom: Spacing.xs,
    },
    label: {
        marginLeft: Spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: BorderRadius.input,
        paddingHorizontal: hs(Spacing.inputPadding),
    },
    multilineContainer: {
        alignItems: 'flex-start',
        minHeight: vs(100),
    },
    input: {
        flex: 1,
        fontSize: ms(FontSize.base),
        color: Colors.textPrimary,
        paddingVertical: vs(Spacing.inputPadding),
        includeFontPadding: false,
    },
    inputWithLeftIcon: {
        paddingLeft: Spacing.xs,
    },
    inputWithRightIcon: {
        paddingRight: Spacing.xs,
    },
    multilineInput: {
        textAlignVertical: 'top',
        paddingTop: vs(Spacing.inputPadding),
    },
    leftIcon: {
        marginRight: Spacing.sm,
    },
    rightIconButton: {
        padding: Spacing.xs,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.xs,
        marginLeft: Spacing.xs,
    },
    errorText: {
        marginLeft: Spacing.xs,
    },
    helperText: {
        marginTop: Spacing.xs,
        marginLeft: Spacing.xs,
    },
});

export default AppInput;
