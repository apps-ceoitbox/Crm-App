/**
 * Auth Stack Navigator
 * Handles authentication flow screens
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants';
import { SplashScreen, LoginScreen, RegisterScreen, ForgotPasswordScreen } from '../screens';

const Stack = createNativeStackNavigator();

const AuthStack = () => {
    return (
        <Stack.Navigator
            initialRouteName={ROUTES.SPLASH}
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
            }}
        >
            <Stack.Screen
                name={ROUTES.SPLASH}
                component={SplashScreen}
                options={{
                    animation: 'fade',
                }}
            />
            <Stack.Screen
                name={ROUTES.LOGIN}
                component={LoginScreen}
                options={{
                    animation: 'fade',
                }}
            />
            <Stack.Screen
                name={ROUTES.REGISTER}
                component={RegisterScreen}
            />
            <Stack.Screen
                name={ROUTES.FORGOT_PASSWORD}
                component={ForgotPasswordScreen}
            />
        </Stack.Navigator>
    );
};

export default AuthStack;
