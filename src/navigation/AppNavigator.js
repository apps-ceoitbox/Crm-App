/**
 * App Navigator
 * Root navigation container with unified navigation structure
 */

import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants';
import { setNavigationRef } from '../api';

// Import screens
import {
    SplashScreen,
    LoginScreen,
    RegisterScreen,
    OnboardingScreen,
    LeadDetailsScreen,
    TaskDetailsScreen,
    AddLeadScreen,
    AddTaskScreen,
    ProfileScreen,
    AddCompanyScreen,
    EditLeadScreen,
    EditContactScreen,
    CompanyScreen,
    ContactsScreen,
    ReportsScreen,
    TeamPerformanceScreen,
    ForecastScreen,
    SmartCallDashboardScreen,
    FollowUpEngineScreen,
    NotificationsScreen,
    AIAssistantScreen,
} from '../screens';
// Import company screens
import EditCompanyScreen from '../screens/main/EditCompanyScreen';

// Import navigators
import BottomTabNavigator from './BottomTabNavigator';
import { OverdueDetailScreen, CompanyDetailsScreen, ContactDetailsScreen } from '../screens/details';

const Stack = createNativeStackNavigator();

// Navigation ref for use outside of React components
export const navigationRef = React.createRef();

/**
 * Navigate from anywhere in the app
 * @param {string} name - Route name
 * @param {object} params - Route params
 */
export const navigate = (name, params) => {
    navigationRef.current?.navigate(name, params);
};

/**
 * Reset navigation stack
 * @param {object} state - New navigation state
 */
export const resetNavigation = (state) => {
    navigationRef.current?.reset(state);
};

const AppNavigator = () => {
    useEffect(() => {
        // Set navigation ref for API interceptor to use on auth errors
        if (navigationRef.current) {
            console.log('Navigation ref set', navigationRef.current);
            setNavigationRef(navigationRef.current);
        }
    }, []);

    const onReady = () => {
        // Set navigation ref for API interceptor when navigation is ready
        setNavigationRef(navigationRef.current);
    };

    return (
        <NavigationContainer ref={navigationRef} onReady={onReady}>
            <Stack.Navigator
                initialRouteName={ROUTES.SPLASH}
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                    gestureEnabled: true,
                }}
            >
                {/* Auth Screens */}
                <Stack.Screen
                    name={ROUTES.SPLASH}
                    component={SplashScreen}
                    options={{ animation: 'fade' }}
                />
                <Stack.Screen
                    name={ROUTES.ONBOARDING}
                    component={OnboardingScreen}
                    options={{ animation: 'fade' }}
                />
                <Stack.Screen
                    name={ROUTES.LOGIN}
                    component={LoginScreen}
                    options={{ animation: 'fade' }}
                />
                <Stack.Screen
                    name={ROUTES.REGISTER}
                    component={RegisterScreen}
                />

                {/* Main Tab Navigator */}
                <Stack.Screen
                    name={ROUTES.MAIN_TABS}
                    component={BottomTabNavigator}
                    options={{ animation: 'fade' }}
                />

                {/* Detail Screens */}
                <Stack.Screen
                    name={ROUTES.LEAD_DETAILS}
                    component={LeadDetailsScreen}
                />
                <Stack.Screen
                    name={ROUTES.TASK_DETAILS}
                    component={TaskDetailsScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                    name={ROUTES.ADD_LEAD}
                    component={AddLeadScreen}
                    options={{
                        animation: 'slide_from_bottom',
                        presentation: 'modal',
                    }}
                />
                <Stack.Screen
                    name={ROUTES.ADD_TASK}
                    component={AddTaskScreen}
                    options={{
                        animation: 'slide_from_bottom',
                        presentation: 'modal',
                    }}
                />

                {/* Company Screens */}
                <Stack.Screen
                    name="EditCompany"
                    component={EditCompanyScreen}
                    options={{
                        animation: 'slide_from_bottom',
                        presentation: 'modal',
                    }}
                />
                <Stack.Screen
                    name={ROUTES.ADD_COMPANY}
                    component={AddCompanyScreen}
                    options={{
                        // animation: 'slide_from_bottom',
                        presentation: 'modal',
                    }}
                />

                {/* Lead Edit Screen */}
                <Stack.Screen
                    name={ROUTES.EDIT_LEAD}
                    component={EditLeadScreen}
                    options={{
                        animation: 'slide_from_bottom',
                        presentation: 'modal',
                    }}
                />

                <Stack.Screen
                    name={ROUTES.EDIT_CONTACT}
                    component={EditContactScreen}
                    options={{
                        animation: 'slide_from_bottom',
                        presentation: 'modal',
                    }}
                />

                {/* Settings Sub-Screens */}
                <Stack.Screen
                    name={ROUTES.COMPANY}
                    component={CompanyScreen}
                />
                <Stack.Screen
                    name={ROUTES.CONTACTS}
                    component={ContactsScreen}
                />
                <Stack.Screen
                    name={ROUTES.REPORTS}
                    component={ReportsScreen}
                />
                <Stack.Screen
                    name={ROUTES.TEAM_PERFORMANCE}
                    component={TeamPerformanceScreen}
                />
                <Stack.Screen
                    name={ROUTES.FORECAST}
                    component={ForecastScreen}
                />
                <Stack.Screen
                    name={ROUTES.SMART_CALL_DASHBOARD}
                    component={SmartCallDashboardScreen}
                />
                <Stack.Screen
                    name={ROUTES.FOLLOW_UP_ENGINE}
                    component={FollowUpEngineScreen}
                />

                <Stack.Screen
                    name={ROUTES.PROFILE}
                    component={ProfileScreen}
                />

                <Stack.Screen
                    name={ROUTES.NOTIFICATIONS}
                    component={NotificationsScreen}
                />
                <Stack.Screen
                    name={ROUTES.AI_ASSISTANT}
                    component={AIAssistantScreen}

                />
                <Stack.Screen
                    name={ROUTES.OVERDUE_DETAIL}
                    component={OverdueDetailScreen}
                />
                <Stack.Screen
                    name={ROUTES.COMPANY_DETAILS}
                    component={CompanyDetailsScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                    name={ROUTES.CONTACT_DETAILS}
                    component={ContactDetailsScreen}
                    options={{ animation: 'slide_from_right' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;

