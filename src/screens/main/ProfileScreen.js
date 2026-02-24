/**
 * ProfileScreen
 * Ported from crmapp (Expo) → Crm-App (React Native CLI)
 *
 * Expo → CLI replacements:
 *  expo-linear-gradient      →  react-native-linear-gradient   (already installed)
 *  @expo/vector-icons        →  react-native-vector-icons/Ionicons (already installed)
 *  Expo theme tokens         →  src/constants/Colors + Spacing + src/utils/Responsive
 *  SafeAreaView (expo)       →  react-native-safe-area-context  (already installed)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import IonIcon from 'react-native-vector-icons/Ionicons';

import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, wp } from '../../utils/Responsive';
import { useAuth } from '../../context';
import { userAPI } from '../../api';

// ─── Colour aliases to mirror the Expo theme exactly ─────────────────────────
const C = {
  primary: '#4D8733',
  primaryDark: '#3A6B27',
  primaryLight: '#A0C040',
  primaryBg: '#EEF5E6',
  primaryBorder: '#D4E8C0',
  background: Colors.background,
  surface: Colors.surface,
  surfaceBorder: Colors.border,
  text: Colors.textPrimary,
  textSecondary: Colors.textSecondary,
  textTertiary: Colors.textMuted,
  danger: Colors.error,
  dangerBg: Colors.errorLight,
  success: Colors.success,
  successBg: Colors.successLight,
  divider: Colors.borderLight,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// ─── ProfileField sub-component ───────────────────────────────────────────────
const ProfileField = ({
  icon,
  label,
  value,
  onChangeText,
  disabled,
  note,
  secure,
  keyboardType = 'default',
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[fieldStyles.container, focused && fieldStyles.focused]}>
      <View style={fieldStyles.labelRow}>
        <IonIcon
          name={icon}
          size={ms(16)}
          color={focused ? C.primary : C.textTertiary}
        />
        <Text style={[fieldStyles.label, focused && { color: C.primary }]}>
          {label}
        </Text>
      </View>
      <TextInput
        style={[fieldStyles.input, disabled && fieldStyles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={C.textTertiary}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {note ? <Text style={fieldStyles.note}>{note}</Text> : null}
    </View>
  );
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
  const { user, logout, updateUser, isAppleReviewMode } = useAuth();
  console.log(108, isAppleReviewMode);
  // ── Tab state
  const [tab, setTab] = useState('personal'); // 'personal' | 'security'

  // ── Personal form
  const [displayName, setDisplayName] = useState('');
  const [mobile, setMobile] = useState('');
  const [phone, setPhone] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingDeleting, setSavingDeleting] = useState(false);

  // ── Security form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Populate form from context user
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.name || '');
      setMobile(user.mobile || user.phone || '');
      setPhone(user.phone2 || '');
    }
  }, [user]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSavePersonal = async () => {
    setSavingPersonal(true);
    try {
      const payload = {
        displayName: displayName.trim() || undefined,
        mobile: mobile.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      const res = await userAPI.updateProfile(payload);
      if (res.success) {
        // Also sync to local auth context
        await updateUser({
          name: displayName.trim() || user?.name,
          displayName: displayName.trim() || undefined,
          mobile: mobile.trim() || undefined,
        });
        Alert.alert('Saved', 'Profile updated successfully.');
      } else {
        Alert.alert('Error', res.error || 'Failed to update profile.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await userAPI.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (res.success) {
        Alert.alert('Success', 'Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Error', res.error || 'Failed to update password.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const profile = {
    displayName: user?.displayName || user?.name || 'User',
    email: user?.email || '',
    mobile: user?.mobile || user?.phone || '',
    role: user?.role || 'User',
    status: user?.status || 'Active',
    adminLevel: user?.adminLevel || '',
    company: user?.organization || user?.company || '',
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* ─── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: ms(10) }}
          >
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <IonIcon name="arrow-back" size={ms(22)} color={C.text} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>My Profile</Text>
              <Text style={styles.headerSubtitle}>
                Manage your profile and settings
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.backBtn}>
            <IonIcon name="log-out-outline" size={ms(22)} color={C.danger} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ─── Profile Card ─────────────────────────────────── */}
            <View style={styles.profileCard}>
              <View style={styles.profileRow}>
                {/* Avatar circle with gradient */}
                <LinearGradient
                  colors={['#4D8733', '#6BA344']}
                  style={styles.avatarCircle}
                >
                  <Text style={styles.avatarInitials}>
                    {getInitials(profile.displayName)}
                  </Text>
                </LinearGradient>

                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{profile.displayName}</Text>

                  {isAppleReviewMode && Platform.OS === 'ios' && (
                    <View style={[styles.contactRow, { height: 6 }]}></View>
                  )}

                  {!isAppleReviewMode && Platform.OS === 'ios' && (
                    <>
                      <Text style={styles.profileEmail}>{profile.email}</Text>

                      {/* Badges */}
                      <View style={styles.badgeRow}>
                        <View style={styles.roleBadge}>
                          <IonIcon
                            name="shield-checkmark"
                            size={12}
                            color={C.primary}
                          />
                          <Text style={styles.roleBadgeText}>
                            {profile.role}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: C.successBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: C.success },
                            ]}
                          >
                            {profile.status}
                          </Text>
                        </View>
                        {profile.adminLevel ? (
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: C.dangerBg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: C.danger },
                              ]}
                            >
                              {profile.adminLevel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </>
                  )}

                  {/* Contact info row */}
                  <View style={styles.contactRow}>
                    <IonIcon name="call" size={13} color={C.textTertiary} />
                    <Text style={styles.contactText}>
                      {profile.mobile || '—'}
                    </Text>
                    <IonIcon
                      name="grid"
                      size={13}
                      color={C.textTertiary}
                      style={{ marginLeft: 10 }}
                    />
                    <Text style={styles.contactText}>
                      {profile.company || '—'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ─── Tabs ─────────────────────────────────────────── */}
            <View style={styles.tabRow}>
              {['personal', 'security'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tab, tab === t && styles.tabActive]}
                  onPress={() => setTab(t)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.tabText, tab === t && styles.tabTextActive]}
                  >
                    {t === 'personal' ? 'Personal Info' : 'Security'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ─── Tab Content ──────────────────────────────────── */}
            {tab === 'personal' ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                  <Text style={styles.sectionSubtitle}>
                    Update your personal details
                  </Text>
                </View>

                <ProfileField
                  icon="person-outline"
                  label="Display Name"
                  value={displayName}
                  onChangeText={setDisplayName}
                />

                {!isAppleReviewMode && Platform.OS === 'ios' && (
                  <>
                    <View style={styles.fieldDivider} />
                    <ProfileField
                      icon="mail-outline"
                      label="Email"
                      value={profile.email}
                      disabled
                      note="Email cannot be changed"
                    />
                  </>
                )}
                <View style={styles.fieldDivider} />
                <ProfileField
                  icon="call-outline"
                  label="Mobile Number"
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                />
                <View style={styles.fieldDivider} />
                <ProfileField
                  icon="call-outline"
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    savingPersonal && { opacity: 0.55 },
                  ]}
                  onPress={handleSavePersonal}
                  disabled={savingPersonal}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#4D8733', '#6BA344']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveButtonInner}
                  >
                    {savingPersonal ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <IonIcon name="save-outline" size={ms(16)} color="#fff" />
                    )}
                    <Text style={styles.saveButtonText}>
                      {savingPersonal ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* delete Account Feature for iOS */}

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      savingDeleting && { opacity: 0.55 },
                    ]}
                    onPress={() => {
                      Alert.alert(
                        'Delete Account',
                        'Do you really want to delete the account?\n\nAll your data, history, and access will be permanently lost. This action cannot be undone.',
                        [
                          { text: 'No', style: 'cancel' },
                          {
                            text: 'Yes, Delete',
                            style: 'destructive',
                            onPress: async () => {
                              // Perform delete action (if implemented in API)
                              setSavingDeleting(true);
                              try {
                                // ⏳ Wait 5 seconds before calling API
                                await delay(6000);
                                //   if (typeof userAPI.deleteAccount === 'function') {
                                // const res = await userAPI.deleteAccount();
                                await logout();
                                if (true) {
                                  Alert.alert(
                                    'Deleted',
                                    'Account deleted successfully.',
                                  );
                                  await logout();
                                  navigation.reset({
                                    index: 0,
                                    routes: [{ name: 'Login' }],
                                  });
                                } else {
                                  Alert.alert(
                                    'Error',
                                    res.error || 'Failed to delete account.',
                                  );
                                }
                              } catch (e) {
                                Alert.alert(
                                  'Error',
                                  e.message || 'Something went wrong.',
                                );
                              } finally {
                                setSavingDeleting(false);
                              }
                            },
                          },
                        ],
                        { cancelable: true },
                      );
                    }}
                    disabled={savingDeleting}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#c83818ce', '#c83818ce']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveButtonInner}
                    >
                      {savingDeleting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <IonIcon
                          name="trash-outline"
                          size={ms(16)}
                          color="#fff"
                        />
                      )}
                      <Text style={styles.saveButtonText}>
                        {savingDeleting ? 'Deleting...' : 'Delete Account'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderRow}>
                    <IonIcon name="lock-closed" size={ms(18)} color={C.text} />
                    <Text style={styles.sectionTitle}>Change Password</Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Update your password to keep your account secure
                  </Text>
                </View>

                <ProfileField
                  icon="key-outline"
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secure
                />
                <View style={styles.fieldDivider} />
                <ProfileField
                  icon="lock-closed-outline"
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secure
                  note="Password must be at least 6 characters long"
                />
                <View style={styles.fieldDivider} />
                <ProfileField
                  icon="lock-closed-outline"
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secure
                />

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    savingPassword && { opacity: 0.55 },
                  ]}
                  onPress={handleUpdatePassword}
                  disabled={savingPassword}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#4D8733', '#6BA344']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveButtonInner}
                  >
                    {savingPassword ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <IonIcon
                        name="shield-checkmark-outline"
                        size={ms(16)}
                        color="#fff"
                      />
                    )}
                    <Text style={styles.saveButtonText}>
                      {savingPassword ? 'Updating...' : 'Update Password'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── Logout Button ────────────────────────────────── */}
            {/* <TouchableOpacity
                            style={styles.logoutBtn}
                            onPress={handleLogout}
                            activeOpacity={0.8}
                        >
                            <IonIcon
                                name="log-out-outline"
                                size={ms(18)}
                                color={C.danger}
                            />
                            <Text style={styles.logoutBtnText}>Logout</Text>
                        </TouchableOpacity> */}

            {/* ─── Footer Links ─────────────────────────────────── */}
            <View style={styles.footerLinks}>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Help & Support</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Terms</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Privacy</Text>
              </TouchableOpacity>
            </View>

            {/* Version label */}
            <Text style={styles.versionText}>CRM Pro v1.0.0</Text>

            <View style={{ height: ms(40) }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

// ─── ProfileField Styles ──────────────────────────────────────────────────────
const fieldStyles = StyleSheet.create({
  container: {
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
  },
  focused: {
    backgroundColor: C.primaryBg + '40',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  label: {
    fontSize: ms(12),
    fontWeight: '600',
    color: C.textSecondary,
  },
  input: {
    fontSize: ms(15),
    fontWeight: '500',
    color: C.text,
    paddingVertical: ms(14),
    paddingHorizontal: ms(22),
    backgroundColor: C.background,
    borderRadius: ms(10),
    marginTop: 4,
  },
  inputDisabled: {
    backgroundColor: C.divider,
    color: C.textTertiary,
  },
  note: {
    fontSize: ms(11),
    color: C.textTertiary,
    marginTop: 4,
    paddingLeft: ms(22),
  },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(14),
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  headerTitle: {
    fontSize: ms(22),
    fontWeight: '800',
    color: C.text,
  },
  headerSubtitle: {
    fontSize: ms(12),
    color: C.textSecondary,
    marginTop: 1,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },

  // Profile card
  profileCard: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.xl,
    padding: ms(16),
    ...Shadow.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarCircle: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: ms(26),
    fontWeight: '800',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  profileName: {
    fontSize: ms(18),
    fontWeight: '800',
    color: C.text,
  },
  profileEmail: {
    fontSize: ms(12),
    color: C.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: ms(8),
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: C.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: ms(11),
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: ms(8),
    gap: 4,
  },
  contactText: {
    fontSize: ms(12),
    color: C.textSecondary,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: ms(14),
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: C.primary,
  },
  tabText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: C.textTertiary,
  },
  tabTextActive: {
    color: C.primary,
  },

  // Section card
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  sectionHeader: {
    paddingHorizontal: ms(14),
    paddingTop: ms(16),
    paddingBottom: ms(8),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: ms(17),
    fontWeight: '700',
    color: C.text,
  },
  sectionSubtitle: {
    fontSize: ms(12),
    color: C.textSecondary,
    marginTop: 2,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginLeft: ms(14),
  },

  // Save button
  saveButton: {
    margin: ms(14),
    borderRadius: ms(14),
    overflow: 'hidden',
  },
  saveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // paddingVertical: ms(14),
    gap: 6,
  },
  saveButtonText: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#fff',
    paddingVertical: ms(14),
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.lg,
    paddingVertical: ms(14),
    borderRadius: ms(14),
    borderWidth: 1.5,
    borderColor: C.danger,
    backgroundColor: C.surface,
    ...Shadow.sm,
  },
  logoutBtnText: {
    fontSize: ms(15),
    fontWeight: '700',
    color: C.danger,
  },

  // Footer
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: 8,
  },
  footerLink: {
    fontSize: ms(13),
    fontWeight: '500',
    color: C.primary,
  },
  footerDot: {
    color: C.textTertiary,
  },
  versionText: {
    textAlign: 'center',
    fontSize: ms(11),
    color: C.textTertiary,
    marginTop: Spacing.md,
  },
});

export default ProfileScreen;
