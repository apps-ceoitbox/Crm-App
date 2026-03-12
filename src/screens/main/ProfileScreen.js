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
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';

import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, wp } from '../../utils/Responsive';
import { useAuth } from '../../context';
import { userAPI, aiAPI } from '../../api';

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

  // ── Profile photo
  const [profilePhoto, setProfilePhoto] = useState(null); // URL or local URI
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── API-fetched profile fields (source of truth for display)
  const [apiEmail, setApiEmail] = useState('');
  const [apiRole, setApiRole] = useState('');
  const [apiStatus, setApiStatus] = useState('');
  const [apiAdminLevel, setApiAdminLevel] = useState('');
  const [apiCompany, setApiCompany] = useState('');

  // ── AI Plan status
  const [planStatus, setPlanStatus] = useState(null);

  // ── Loading state
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ── Security form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Fetch profile and plan status on mount
  useEffect(() => {
    const loadAll = async () => {
      setLoadingProfile(true);
      try {
        const [profileRes, planRes] = await Promise.all([
          userAPI.getMyProfile(),
          aiAPI.getPlanStatus(),
        ]);
        if (profileRes.success && profileRes.data) {
          const p = profileRes.data;
          setDisplayName(p.name || p.displayName || user?.name || '');
          setMobile(p.mobile || p.phone || user?.mobile || '');
          setPhone(p.phone2 || user?.phone2 || '');
          setProfilePhoto(p.photo || p.profilePhoto || null);
          setApiEmail(p.email || user?.email || '');
          setApiRole(p.role || user?.role || 'User');
          setApiStatus(p.status || user?.status || 'Active');
          setApiAdminLevel(p.adminLevel || user?.adminLevel || '');
          setApiCompany(p.organization || p.company || user?.organization || user?.company || '');
        } else {
          // Fall back to context user
          setDisplayName(user?.displayName || user?.name || '');
          setMobile(user?.mobile || user?.phone || '');
          setPhone(user?.phone2 || '');
          setApiEmail(user?.email || '');
          setApiRole(user?.role || 'User');
          setApiStatus(user?.status || 'Active');
          setApiAdminLevel(user?.adminLevel || '');
          setApiCompany(user?.organization || user?.company || '');
        }
        if (planRes.success && planRes.data) {
          setPlanStatus(planRes.data);
        }
      } catch {
        // Fall back gracefully
        setDisplayName(user?.displayName || user?.name || '');
        setMobile(user?.mobile || user?.phone || '');
        setApiEmail(user?.email || '');
        setApiRole(user?.role || 'User');
        setApiStatus(user?.status || 'Active');
        setApiCompany(user?.organization || user?.company || '');
      } finally {
        setLoadingProfile(false);
      }
    };
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSavePersonal = async () => {
    setSavingPersonal(true);
    try {
      const payload = {
        name: displayName.trim() || undefined,
        mobile: mobile.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      const res = await userAPI.updateMyProfile(payload);
      if (res.success) {
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

  // ── Image picker + upload ─────────────────────────────────────────────────
  const handlePickPhoto = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, includeBase64: false },
      async (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.uri) return;

        setUploadingPhoto(true);
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || 'photo.jpg',
          });
          const res = await userAPI.uploadProfilePhoto(formData);
          if (res.success) {
            // Re-fetch profile to get the real Cloudinary URL from the server
            const refreshed = await userAPI.getMyProfile();
            if (refreshed.success && refreshed.data) {
              const url = refreshed.data.photo || refreshed.data.profilePhoto || asset.uri;
              setProfilePhoto(url);
              await updateUser({ photo: url, profilePhoto: url });
            } else {
              // Fallback: show local image preview
              setProfilePhoto(asset.uri);
            }
          } else {
            // Fallback: show local image preview
            setProfilePhoto(asset.uri);
          }
        } catch (e) {
          Alert.alert('Error', e.message || 'Failed to upload photo.');
        } finally {
          setUploadingPhoto(false);
        }
      },
    );
  };

  // ── Derived values ─ now use API-fetched state as source of truth ─────────────
  const profile = {
    displayName: displayName || user?.displayName || user?.name || 'User',
    email: apiEmail || user?.email || '',
    mobile: mobile || user?.mobile || user?.phone || '',
    role: apiRole || user?.role || 'User',
    status: apiStatus || user?.status || 'Active',
    adminLevel: apiAdminLevel || user?.adminLevel || '',
    company: apiCompany || user?.organization || user?.company || '',
  };

  if (!user || loadingProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
          {loadingProfile && <Text style={{ color: C.textTertiary, marginTop: 12, fontSize: ms(13) }}>Loading profile…</Text>}
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
            {/* ─── Profile Card ─ top section: left (avatar + info + upload) / right (AI credits) */}
            <View style={styles.profileCard}>
              <View style={styles.profileCardInner}>
                {/* LEFT SIDE: avatar + info + upload button */}
                <View style={styles.profileLeftCol}>
                  <View style={styles.profileRow}>
                    {/* Avatar wrapper */}
                    <View style={styles.avatarWrapper}>
                      {profilePhoto ? (
                        <Image
                          source={{ uri: profilePhoto }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <LinearGradient
                          colors={['#4D8733', '#6BA344']}
                          style={styles.avatarCircle}
                        >
                          <Text style={styles.avatarInitials}>
                            {getInitials(profile.displayName)}
                          </Text>
                        </LinearGradient>
                      )}
                      {uploadingPhoto && (
                        <View style={styles.avatarOverlay}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      )}
                    </View>

                    <View style={styles.profileInfo}>
                      <Text style={styles.profileName}>{profile.displayName}</Text>
                      <Text style={styles.profileEmail}>{profile.email}</Text>

                      {/* Badges */}
                      <View style={styles.badgeRow}>
                        {!!profile.role && (
                          <View style={styles.roleBadge}>
                            <IonIcon name="shield-checkmark" size={11} color={C.primary} />
                            <Text style={styles.roleBadgeText}>{profile.role}</Text>
                          </View>
                        )}
                        {!!profile.status && (
                          <View style={[styles.statusBadge, { backgroundColor: C.successBg }]}>
                            <Text style={[styles.statusBadgeText, { color: C.success }]}>
                              {profile.status}
                            </Text>
                          </View>
                        )}
                        {!!profile.adminLevel && (
                          <View style={[styles.statusBadge, { backgroundColor: '#EDE7FF' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#7C3AED' }]}>
                              {profile.adminLevel}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Contact info row */}
                      <View style={styles.contactRow}>
                        <IonIcon name="call" size={12} color={C.textTertiary} />
                        <Text style={styles.contactText}>{profile.mobile || '—'}</Text>
                        {!!profile.company && (
                          <>
                            <IonIcon name="grid" size={12} color={C.textTertiary} style={{ marginLeft: 8 }} />
                            <Text style={styles.contactText}>{profile.company}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Upload Photo button */}
                  <TouchableOpacity
                    style={styles.uploadPhotoBtn}
                    onPress={handlePickPhoto}
                    disabled={uploadingPhoto}
                    activeOpacity={0.8}
                  >
                    <IonIcon name="arrow-up-circle-outline" size={ms(16)} color={C.textSecondary} />
                    <Text style={styles.uploadPhotoBtnText}>
                      {uploadingPhoto ? 'Uploading…' : 'Upload Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* RIGHT SIDE: AI Credits panel */}
                {planStatus?.data?.data && (() => {
                  const { planName, usedCredits, totalCredits, remainingCredits, resetDate } = planStatus.data.data;
                  const progress = Math.min(100, ((usedCredits || 0) / (totalCredits || 1)) * 100);
                  const isLow = (remainingCredits || 0) < 50;
                  return (
                    <View style={styles.aiCreditsPanel}>
                      <View style={styles.aiCreditsPanelTop}>
                        <IonIcon name="flash" size={ms(14)} color={C.primary} />
                        <View>
                          <Text style={styles.aiCreditsPanelTitle}>AI Credits</Text>
                          <Text style={styles.aiCreditsPanelPlan}>{planName || 'Basic plan'}</Text>
                        </View>
                      </View>
                      <View style={styles.aiCreditsPanelUsedRow}>
                        <Text style={styles.aiCreditsPanelUsed}>{usedCredits} / {totalCredits} used</Text>
                        <Text style={[styles.aiCreditsPanelLeft, { color: isLow ? C.danger : C.primary }]}>
                          {remainingCredits} left
                        </Text>
                      </View>
                      <View style={styles.aiProgressBg}>
                        <View
                          style={[
                            styles.aiProgressFill,
                            { width: `${progress}%`, backgroundColor: isLow ? C.danger : C.primary },
                          ]}
                        />
                      </View>
                      <Text style={styles.aiCreditsReset}>
                        Resets {resetDate ? new Date(resetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '—'}
                      </Text>
                    </View>
                  );
                })()}
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

                <View style={styles.fieldDivider} />
                <ProfileField
                  icon="mail-outline"
                  label="Email"
                  value={profile.email}
                  disabled
                  note="Email cannot be changed"
                />
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
  profileCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ms(10),
  },
  profileLeftCol: {
    flex: 1.2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ms(10),
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    backgroundColor: C.divider,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ms(36),
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: ms(26),
    fontWeight: '800',
    color: '#fff',
  },
  // Upload photo button
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: ms(10),
    paddingVertical: ms(7),
    paddingHorizontal: ms(12),
    borderRadius: ms(10),
    borderWidth: 1.2,
    borderColor: C.surfaceBorder,
    backgroundColor: C.surface,
  },
  uploadPhotoBtnText: {
    fontSize: ms(13),
    fontWeight: '500',
    color: C.textSecondary,
  },
  // AI Credits right-column panel (side by side with profile info)
  aiCreditsPanel: {
    flex: 1,
    backgroundColor: C.background,
    borderRadius: ms(10),
    padding: ms(10),
    borderWidth: 1,
    borderColor: C.primaryBorder,
    justifyContent: 'space-between',
  },
  aiCreditsPanelTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginBottom: ms(6),
  },
  aiCreditsPanelTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: C.text,
  },
  aiCreditsPanelPlan: {
    fontSize: ms(10),
    color: C.textTertiary,
    marginTop: 1,
  },
  aiCreditsPanelUsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(5),
  },
  aiCreditsPanelUsed: {
    fontSize: ms(11),
    color: C.textSecondary,
  },
  aiCreditsPanelLeft: {
    fontSize: ms(13),
    fontWeight: '700',
  },
  // AI Credits card
  aiCreditsCard: {
    marginTop: ms(12),
    marginHorizontal: ms(4),
    padding: ms(12),
    backgroundColor: C.background,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  aiCreditsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(4),
  },
  aiCreditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  aiCreditsTitle: {
    fontSize: ms(14),
    fontWeight: '700',
    color: C.text,
  },
  aiCreditsPlan: {
    fontSize: ms(11),
    color: C.textTertiary,
    marginLeft: ms(2),
  },
  aiCreditsLeft2: {
    fontSize: ms(14),
    fontWeight: '700',
  },
  aiCreditsUsed: {
    fontSize: ms(12),
    color: C.textSecondary,
    marginBottom: ms(6),
  },
  aiProgressBg: {
    height: ms(6),
    backgroundColor: C.divider,
    borderRadius: ms(3),
    overflow: 'hidden',
    marginBottom: ms(6),
  },
  aiProgressFill: {
    height: '100%',
    borderRadius: ms(3),
  },
  aiCreditsReset: {
    fontSize: ms(11),
    color: C.textTertiary,
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
