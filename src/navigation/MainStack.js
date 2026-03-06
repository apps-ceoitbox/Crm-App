/**
 * Main Stack Navigator
 * Handles all app screens including detail screens
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants';
import BottomTabNavigator from './BottomTabNavigator';
import {
    LeadDetailsScreen,
    TaskDetailsScreen,
    AddLeadScreen,
    AddTaskScreen,
    ProfileScreen,
    ContactsScreen,
    AddCompanyScreen,
    ReportsScreen,
    FollowUpEngineScreen,
    NotificationsScreen,
    AIAssistantScreen,
} from '../screens';
import { CompanyScreen } from '../screens/main';
import EditCompanyScreen from '../screens/main/EditCompanyScreen';
import { OverdueDetailScreen, CompanyDetailsScreen, ContactDetailsScreen } from '../screens/details';

const Stack = createNativeStackNavigator();

const MainStack = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
            }}
        >
            {/* Tab Navigator */}
            <Stack.Screen
                name={ROUTES.MAIN_TABS}
                component={BottomTabNavigator}
                options={{
                    animation: 'fade',
                }}
            />

            {/* Lead Screens */}
            <Stack.Screen
                name={ROUTES.LEAD_DETAILS}
                component={LeadDetailsScreen}
            />
            <Stack.Screen
                name={ROUTES.ADD_LEAD}
                component={AddLeadScreen}
                options={{
                    animation: 'slide_from_bottom',
                    presentation: 'modal',
                }}
            />

            {/* Task Screens */}
            <Stack.Screen
                name={ROUTES.TASK_DETAILS}
                component={TaskDetailsScreen}
                options={{
                    animation: 'slide_from_right',
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

            {/* Company Screens (Accessed via Settings) */}
            <Stack.Screen
                name={ROUTES.COMPANY}
                component={CompanyScreen}
                options={{ animation: 'slide_from_right' }}
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
            <Stack.Screen
                name={ROUTES.ADD_COMPANY}
                component={AddCompanyScreen}
                options={{
                    animation: 'slide_from_bottom',
                    presentation: 'modal',
                }}
            />
            <Stack.Screen
                name={ROUTES.EDIT_COMPANY}
                component={EditCompanyScreen}
                options={{
                    animation: 'slide_from_bottom',
                    presentation: 'modal',
                }}
            />

            {/* Contacts Screen (Accessed via Settings) */}
            <Stack.Screen
                name={ROUTES.CONTACTS}
                component={ContactsScreen}
                options={{
                    animation: 'slide_from_right',
                }}
            />

            {/* Reports Screen */}
            <Stack.Screen
                name={ROUTES.REPORTS}
                component={ReportsScreen}
                options={{
                    animation: 'slide_from_right',
                }}
            />

            {/* Follow Up Engine Screen */}
            <Stack.Screen
                name={ROUTES.FOLLOW_UP_ENGINE}
                component={FollowUpEngineScreen}
                options={{
                    animation: 'slide_from_right',
                }}
            />

            {/* Profile Screen */}
            <Stack.Screen
                name={ROUTES.PROFILE}
                component={ProfileScreen}
                options={{
                    animation: 'slide_from_right',
                }}
            />

            {/* Notifications Screen (live list, from API + FCM) */}
            <Stack.Screen
                name={ROUTES.NOTIFICATIONS}
                component={NotificationsScreen}
                options={{
                    animation: 'slide_from_right',
                }}
            />

            {/* AI Assistant Screen */}
            <Stack.Screen
                name={ROUTES.AI_ASSISTANT}
                component={AIAssistantScreen}
                options={{
                    animation: 'slide_from_bottom',
                    presentation: 'fullScreenModal',
                }}
            />
            <Stack.Screen
                name={ROUTES.OVERDUE_DETAIL}
                component={OverdueDetailScreen}
                options={{
                    animation: 'slide_from_right',
                }}
            />
        </Stack.Navigator>
    );
};

export default MainStack;
