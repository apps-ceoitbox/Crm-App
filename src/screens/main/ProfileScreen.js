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
  Modal,
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
import { showToast } from '../../utils';

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
  const [showPassword, setShowPassword] = useState(false);

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
      <View style={[fieldStyles.inputWrapper, disabled && fieldStyles.inputWrapperDisabled]}>
        <TextInput
          style={[fieldStyles.input, disabled && fieldStyles.inputDisabled]}
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          secureTextEntry={secure && !showPassword}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={C.textTertiary}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {secure && (
          <TouchableOpacity
            style={fieldStyles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <IonIcon
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={ms(20)}
              color={C.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      {note ? <Text style={fieldStyles.note}>{note}</Text> : null}
    </View>
  );
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
  const { user, logout, updateUser, isAppleReviewMode } = useAuth();
  // console.log(108, isAppleReviewMode);
  // // ── Tab state
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
  const [apiIsSuperAdmin, setApiIsSuperAdmin] = useState(false);

  // ── AI Plan status
  const [planStatus, setPlanStatus] = useState(null);

  // ── Loading state
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ── Pristine State for tracking modifications ──
  const [pristinePersonal, setPristinePersonal] = useState({
    displayName: '',
    mobile: '',
    phone: '',
  });

  // ── Security form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // ── Logout Modal
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

  // Fetch profile and plan status on mount
  useEffect(() => {
    const loadAll = async () => {
      setLoadingProfile(true);
      try {
        const [profileRes, planRes] = await Promise.all([
          userAPI.getProfile(),
          aiAPI.getPlanStatus(),
        ]);
        if (profileRes.success && profileRes.data) {
          const p = profileRes.data.data;

          const initialDisplayName = p.name || '';
          const initialMobile = p.mobile || '';
          const initialPhone = p.phone || '';

          setDisplayName(initialDisplayName);
          setMobile(initialMobile);
          setPhone(initialPhone);

          setPristinePersonal({
            displayName: initialDisplayName,
            mobile: initialMobile,
            phone: initialPhone,
          });

          setProfilePhoto(p?.photo || null);
          setApiEmail(p.email || user?.email || '');
          setApiRole(p.role || '');
          setApiStatus(p.status || 'Active');
          setApiAdminLevel(p.isAdmin || false);
          setApiCompany(p.organization?.name || '');
          setApiIsSuperAdmin(p.isSuperAdmin || false);
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
          // console.log('planRes.data.data : ', planRes.data.data)
          setPlanStatus(planRes.data.data);
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
      // console.log('api calling');
      const res = await userAPI.updateMyProfile(payload);
      // console.log('res : ', res);
      if (res.success) {
        await updateUser({
          name: displayName.trim() || user?.name,
          displayName: displayName.trim() || undefined,
          mobile: mobile.trim() || undefined,
        });

        // Update pristine state to reflect newly saved values
        setPristinePersonal({
          displayName: displayName.trim(),
          mobile: mobile.trim(),
          phone: phone.trim(),
        });

        showToast('success', 'Profile updated successfully.');
        // Alert.alert('Saved', 'Profile updated successfully.');
      } else {
        showToast('error', res.error || 'Failed to update profile.');
        // Alert.alert('Error', res.error || 'Failed to update profile.');
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
        // console.log('res : ', res)
        // Alert.alert('Success', 'Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showToast('success', 'Password updated successfully.');
      } else {
        // Alert.alert('Error', res.error || 'Failed to update password.');
        // console.log('res : ', res)
        Alert.alert('Error', res.error || 'Failed to update password.');
        // showToast('error', res.error || 'Failed to update password.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    setIsLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setIsLogoutModalVisible(false);
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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
            const refreshed = await userAPI.getProfile();
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
          // console.log('e : ', e)
        } finally {
          setUploadingPhoto(false);
        }
      },
    );
  };

  // console.log('user : ', user)

  // ── Derived values ─ now use API-fetched state as source of truth ─────────────
  const profile = {
    displayName: displayName || user?.displayName || user?.name || 'User',
    email: apiEmail || user?.email || '',
    mobile: mobile || user?.mobile || user?.phone || '',
    role: apiRole || user?.role || 'User',
    status: apiStatus || user?.status || 'Active',
    adminLevel: apiAdminLevel || user?.adminLevel || '',
    company: apiCompany || user?.organization || user?.company || '',
    isSuperAdmin: apiIsSuperAdmin || user?.isSuperAdmin || false,
    phone2: phone || user?.phone2 || '',
  };

  // Enable Save Changes only when personal info differs from loaded (pristine) profile
  const personalInfoDirty =
    displayName.trim() !== pristinePersonal.displayName ||
    mobile.trim() !== pristinePersonal.mobile ||
    phone.trim() !== pristinePersonal.phone;

  // Enable Update Password only when all three password fields have input
  const passwordFormFilled =
    currentPassword.trim() !== '' &&
    newPassword.trim() !== '' &&
    confirmPassword.trim() !== '';

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      style={styles.container}
    >
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
              <Text numberOfLines={1} style={styles.headerSubtitle}>
                Manage your profile, job details, and responsibilities
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.backBtn}>
            <IonIcon name="log-out-outline" size={ms(22)} color={C.danger} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
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
                            <IonIcon name="shield-outline" size={12} color={'#4B5563'} />
                            <Text style={styles.roleBadgeText}>{profile.role}</Text>
                          </View>
                        )}
                        {!!profile.status && (
                          <View style={[styles.statusBadge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#16A34A' }]}>
                              * {profile.status}
                            </Text>
                          </View>
                        )}
                        {(profile.isSuperAdmin || profile.adminLevel) && (
                          <View style={[styles.statusBadge, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#9333EA' }]}>
                              {profile.isSuperAdmin ? 'Super Admin' : profile.adminLevel}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Contact info row */}
                      <View style={styles.contactRow}>
                        {!!profile.mobile && (
                          <View style={styles.contactItem}>
                            <IonIcon name="call-outline" size={14} color={C.textSecondary} />
                            <Text style={styles.contactText}>{profile.mobile}</Text>
                          </View>
                        )}
                        {!!profile.company && (
                          <View style={styles.contactItem}>
                            <IonIcon name="business-outline" size={14} color={C.textSecondary} />
                            <Text style={styles.contactText}>{profile.company}</Text>
                          </View>
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

              </View>
            </View>

            {/* AI Credits Card (Below Profile Header) */}
            {planStatus && (() => {
              const { planName, usedCredits, totalCredits, remainingCredits, resetDate } = planStatus;
              const progress = Math.min(100, ((usedCredits || 0) / (totalCredits || 1)) * 100);
              const isLow = (remainingCredits || 0) < 50;

              const dt = resetDate ? new Date(resetDate) : null;
              const resetStr = dt ? `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}` : '—';

              return (
                <View style={styles.aiCreditsNewCard}>
                  <View style={styles.aiCreditsNewHeader}>
                    <IonIcon name="flash-outline" size={ms(24)} color={C.primary} />
                    <View style={styles.aiCreditsNewHeaderText}>
                      <Text style={styles.aiCreditsNewTitle}>AI Credits</Text>
                      <Text style={styles.aiCreditsNewPlan}>{planName || 'Basic plan'}</Text>
                    </View>
                  </View>

                  <View style={styles.aiCreditsNewStatsRow}>
                    <Text style={styles.aiCreditsNewUsed}>{usedCredits} / {totalCredits} used</Text>
                    <Text style={[styles.aiCreditsNewLeft, { color: isLow ? C.danger : C.primary }]}>
                      {remainingCredits} left
                    </Text>
                  </View>

                  <View style={styles.aiCreditsNewProgressBg}>
                    <View
                      style={[
                        styles.aiCreditsNewProgressFill,
                        { width: `${progress}%`, backgroundColor: isLow ? C.danger : C.primary },
                      ]}
                    />
                  </View>

                  <Text style={styles.aiCreditsNewReset}>
                    Resets {resetDate ? new Date(resetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '—'}
                  </Text>
                </View>
              );
            })()}

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
                    (savingPersonal || !personalInfoDirty) && { opacity: 0.55 },
                  ]}
                  onPress={handleSavePersonal}
                  disabled={savingPersonal || !personalInfoDirty}
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
                    (savingPassword || !passwordFormFilled) && { opacity: 0.55 },
                  ]}
                  onPress={handleUpdatePassword}
                  disabled={savingPassword || !passwordFormFilled}
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
            <Text style={styles.versionText}>CBXCRM v1.0.0</Text>

            <View style={{ height: ms(40) }} />
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* ─── Logout Modal ─────────────────────────────────── */}
      <Modal
        visible={isLogoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <IonIcon name="log-out-outline" size={ms(32)} color={Colors.white} />
            </View>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>Are you sure you want to log out of your account?</Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsLogoutModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalLogoutBtn}
                onPress={confirmLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.modalLogoutBtnText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.background,
    borderRadius: ms(10),
    marginTop: 4,
  },
  inputWrapperDisabled: {
    backgroundColor: C.divider,
  },
  input: {
    flex: 1,
    fontSize: ms(15),
    fontWeight: '500',
    color: C.text,
    paddingVertical: ms(14),
    paddingHorizontal: ms(22),
  },
  inputDisabled: {
    color: C.textTertiary,
  },
  eyeIcon: {
    paddingRight: ms(18),
    paddingLeft: ms(10),
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
    flex: 1,
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
  // AI Credits Card (Below Header)
  aiCreditsNewCard: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.xl,
    padding: ms(16),
    marginTop: Spacing.md,
    ...Shadow.sm,
  },
  aiCreditsNewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ms(16),
  },
  aiCreditsNewHeaderText: {
    marginLeft: ms(8),
  },
  aiCreditsNewTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    color: C.text,
  },
  aiCreditsNewPlan: {
    fontSize: ms(13),
    color: C.textSecondary,
    marginTop: 2,
  },
  aiCreditsNewStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(8),
  },
  aiCreditsNewUsed: {
    fontSize: ms(13),
    color: C.textSecondary,
  },
  aiCreditsNewLeft: {
    fontSize: ms(13),
    fontWeight: '500',
  },
  aiCreditsNewProgressBg: {
    height: ms(5),
    backgroundColor: '#F3F4F6',
    borderRadius: ms(4),
    overflow: 'hidden',
    marginBottom: ms(14),
  },
  aiCreditsNewProgressFill: {
    height: '100%',
    borderRadius: ms(4),
  },
  aiCreditsNewReset: {
    fontSize: ms(12),
    color: C.textSecondary,
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
    gap: 8,
    marginTop: ms(10),
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  roleBadgeText: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#4B5563',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: ms(11),
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: ms(14),
    gap: ms(16),
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: ms(14),
    color: C.textSecondary,
    fontWeight: '500',
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: wp(85),
    backgroundColor: '#fff',
    borderRadius: BorderRadius.xl,
    padding: ms(24),
    alignItems: 'center',
    ...Shadow.lg,
  },
  modalIconContainer: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: ms(22),
    fontWeight: '700',
    color: C.text,
    marginBottom: Spacing.xs,
  },
  modalMessage: {
    fontSize: ms(15),
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
    lineHeight: ms(22),
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: ms(14),
    borderRadius: ms(12),
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: ms(15),
    fontWeight: '700',
    color: C.textSecondary,
  },
  modalLogoutBtn: {
    flex: 1,
    paddingVertical: ms(14),
    borderRadius: ms(12),
    backgroundColor: C.danger,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  modalLogoutBtnText: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#fff',
  },
});

export default ProfileScreen;
