/**
 * Splash Screen
 * Initial loading screen with auto-navigation based on auth state
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { ms, vs } from '../../utils/Responsive';
import { useAuth } from '../../context';
import AppText from '../../components/AppText';
import { isOnboardingCompleted } from '../../storage';

const SplashScreen = ({ navigation }) => {
    const { isLoading, isAuthenticated } = useAuth();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        // Start animations
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 40,
                friction: 6,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // Navigate when auth state is loaded
    useEffect(() => {
        if (!isLoading) {
            const timer = setTimeout(async () => {
                const onboarded = await isOnboardingCompleted();
                if (!onboarded) {
                    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
                } else if (isAuthenticated) {
                    navigation.reset({ index: 0, routes: [{ name: 'MainDrawer' }] });
                } else {
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }
            }, 500); // slightly longer to appreciate the splash

            return () => clearTimeout(timer);
        }
    }, [isLoading, isAuthenticated, navigation]);

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.logoWrapper,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                <View style={styles.iconContainer}>
                    {/* <IonIcon name="briefcase" size={ms(50)} color={Colors.white} /> */}
                    <Image
                        source={require('../../assets/splace.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>

                <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>

                    <AppText
                        size={ms(25)}
                        weight="extraBold"
                        color={Colors.primary}
                        style={styles.companyName}
                    >
                        CBX CRM
                    </AppText>
                    {/* <View style={styles.taglineContainer}>
                        <View style={styles.line} />
                        <AppText
                            size={12}
                            weight="semiBold"
                            color={Colors.textTertiary}
                            style={styles.tagline}
                        >
                            INTELLIGENT CRM
                        </AppText>
                        <View style={styles.line} />
                    </View> */}
                </Animated.View>
            </Animated.View>

            <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                <AppText size="xs" color={Colors.textMuted}>
                    © {new Date().getFullYear()} CEOITBOX. All rights reserved.
                </AppText>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: ms(120),
        height: ms(120),
        borderRadius: ms(28),
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(15),
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    logo: {
        width: ms(80),
        height: ms(80),
        borderRadius: ms(28),
    },
    companyName: {
        letterSpacing: 2,
        marginBottom: vs(7),
    },
    taglineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '60%',
        justifyContent: 'center',
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.divider,
        marginHorizontal: 8,
    },
    tagline: {
        letterSpacing: 1.5,
    },
    footer: {
        position: 'absolute',
        bottom: vs(32),
    },
});

export default SplashScreen;
