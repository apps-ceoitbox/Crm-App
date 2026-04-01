import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants';
import BottomTabNavigator from './BottomTabNavigator';
import {
    LeadDetailsScreen,
    TaskDetailsScreen,
    AddLeadScreen,
    AddTaskScreen,
    EditLeadScreen,
    EditTaskScreen,
    OverdueDetailScreen,
} from '../screens';

const Stack = createNativeStackNavigator();

const SalesModule = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen
                name={ROUTES.MAIN_TABS}
                component={BottomTabNavigator}
            />
            
            {/* Sales Detail Screens moved into the module stack */}
            <Stack.Screen
                name={ROUTES.LEAD_DETAILS}
                component={LeadDetailsScreen}
            />
            <Stack.Screen
                name={ROUTES.TASK_DETAILS}
                component={TaskDetailsScreen}
            />
            <Stack.Screen
                name={ROUTES.ADD_LEAD}
                component={AddLeadScreen}
                options={{ presentation: 'modal' }}
            />
            <Stack.Screen
                name={ROUTES.ADD_TASK}
                component={AddTaskScreen}
                options={{ presentation: 'modal' }}
            />
            <Stack.Screen
                name={ROUTES.EDIT_LEAD}
                component={EditLeadScreen}
                options={{ presentation: 'modal' }}
            />
            <Stack.Screen
                name={ROUTES.EDIT_TASK}
                component={EditTaskScreen}
                options={{ presentation: 'modal' }}
            />
            <Stack.Screen
                name={ROUTES.OVERDUE_DETAIL}
                component={OverdueDetailScreen}
            />
        </Stack.Navigator>
    );
};

export default SalesModule;
