import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ScanAddContactScreen from '../screens/marketing/ScanAddContactScreen';
import AddSingleContactScreen from '../screens/marketing/AddSingleContactScreen';
import { ROUTES } from '../constants';

const Stack = createNativeStackNavigator();

const MarketingModule = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen
                name={ROUTES.SCAN_ADD_CONTACT}
                component={ScanAddContactScreen}
            />
            {/* <Stack.Screen
                name={ROUTES.ADD_SINGLE_CONTACT}
                component={AddSingleContactScreen}
            /> */}
        </Stack.Navigator>
    );
};

export default MarketingModule;
