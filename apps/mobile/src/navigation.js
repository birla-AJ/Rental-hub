import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Welcome, Login, Otp, ChooseRole } from './screens/Auth';
import TenantHome from './screens/TenantHome';
import Wallet from './screens/Wallet';
import RegisterProperty from './screens/RegisterProperty';
import Checkout from './screens/Checkout';
import Vacancy from './screens/Vacancy';
import OwnerDashboard from './screens/OwnerDashboard';
import OwnerCheckout from './screens/OwnerCheckout';
import Commission from './screens/Commission';
import Consent from './screens/Consent';
import AgentDashboard from './screens/AgentDashboard';
import AgentTasks from './screens/AgentTasks';
import AgentQr from './screens/AgentQr';
import VerifyProperty from './screens/VerifyProperty';
import Search from './screens/Search';
import PropertyDetails from './screens/PropertyDetails';
import BookProperty from './screens/BookProperty';
import Payment from './screens/Payment';
import Bookings, { BookingDetails } from './screens/Bookings';
import Profile from './screens/Profile';
import EditProfile from './screens/EditProfile';
import Kyc from './screens/Kyc';
import { RentalHistory, PaymentHistory, CashbackHistory } from './screens/History';
import Notifications from './screens/Notifications';
import Saved from './screens/Saved';
import Static from './screens/Static';
import OwnerProperties from './screens/OwnerProperties';
import OwnerProperty from './screens/OwnerProperty';
import OwnerRoom from './screens/OwnerRoom';
import OwnerPlacements from './screens/OwnerPlacements';
import PropertyStatus from './screens/PropertyStatus';
import { useSession } from './session';
import { t } from './theme';
import Icon from './components/Icon';
import AppHeader from './components/AppHeader';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const icon = (name) => ({ color, focused }) => <Icon name={name} size={21} color={color} strokeWidth={focused ? 2.3 : 1.8} />;
const Soon = ({ route }) => <Text style={{ padding: 60, color: t.textSecondary }}>{route.name} — coming in next phase</Text>;

// Tenant tabs: Home · Search · Bookings · Wallet · Profile
function TenantTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true, header: (props) => <AppHeader {...props} />, headerShadowVisible: false, tabBarActiveTintColor: t.primary,
      tabBarStyle: { borderTopLeftRadius: 24, borderTopRightRadius: 24, height: 64, position: 'absolute', backgroundColor: '#fff' } }}>
      <Tab.Screen name="Home" component={TenantHome} options={{ tabBarIcon: icon('home') }} />
      <Tab.Screen name="Search" component={Search} options={{ tabBarIcon: icon('search') }} />
      <Tab.Screen name="Bookings" component={Bookings} options={{ tabBarIcon: icon('calendar') }} />
      <Tab.Screen name="Wallet" component={Wallet} options={{ tabBarIcon: icon('wallet') }} />
      <Tab.Screen name="Profile" component={Profile} options={{ headerShown: false, tabBarIcon: icon('user') }} />
    </Tab.Navigator>
  );
}
// Owner tabs: Dashboard · Properties · Vacancy · Placements · Profile
function OwnerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true, header: (props) => <AppHeader {...props} />, headerShadowVisible: false, tabBarActiveTintColor: t.primary,
      tabBarStyle: { borderTopLeftRadius: 24, borderTopRightRadius: 24, height: 64, position: 'absolute', backgroundColor: '#fff' } }}>
      <Tab.Screen name="Dashboard" component={OwnerDashboard} options={{ tabBarIcon: icon('dashboard') }} />
      <Tab.Screen name="Properties" component={OwnerProperties} options={{ tabBarIcon: icon('building') }} />
      <Tab.Screen name="Vacancy" component={Vacancy} options={{ tabBarIcon: icon('clock') }} />
      <Tab.Screen name="Placements" component={OwnerPlacements} options={{ tabBarIcon: icon('handshake') }} />
      <Tab.Screen name="Profile" component={Profile} options={{ headerShown: false, tabBarIcon: icon('user') }} />
    </Tab.Navigator>
  );
}
// Agent tabs: Dashboard · Tasks · QR Tags · History · Profile
function AgentTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true, header: (props) => <AppHeader {...props} />, headerShadowVisible: false, tabBarActiveTintColor: t.primary,
      tabBarStyle: { borderTopLeftRadius: 24, borderTopRightRadius: 24, height: 64, position: 'absolute', backgroundColor: '#fff' } }}>
      <Tab.Screen name="Dashboard" component={AgentDashboard} options={{ tabBarIcon: icon('dashboard') }} />
      <Tab.Screen name="Tasks" component={AgentTasks} options={{ tabBarIcon: icon('calendar') }} />
      <Tab.Screen name="QR Tags" component={AgentQr} options={{ tabBarIcon: icon('tag') }} />
      <Tab.Screen name="History" component={AgentTasks} initialParams={{ filter: 'VERIFIED' }} options={{ tabBarIcon: icon('history') }} />
      <Tab.Screen name="Profile" component={Profile} options={{ headerShown: false, tabBarIcon: icon('user') }} />
    </Tab.Navigator>
  );
}
// Same app, role-based.
const RoleTabs = () => { const { role } = useSession(); return role === 'tenant' ? <TenantTabs /> : role === 'owner' ? <OwnerTabs /> : <AgentTabs />; };

export const navigationRef = createNavigationContainerRef();

const PLAIN_SCREENS = new Set(['Welcome', 'Login', 'Otp', 'Role', 'Main']);
const TITLES = { RegisterProperty: 'Register property', Checkout: 'Checkout', Vacancy: 'Vacancy', OwnerCheckout: 'Confirm checkout', Commission: 'Commission', Consent: 'Owner consent', VerifyProperty: 'Verify property', PropertyDetails: 'Property details', BookProperty: 'Book property', Payment: 'Payment', BookingDetails: 'Booking details', EditProfile: 'Edit profile', KYC: 'KYC', RentalHistory: 'Rental history', PaymentHistory: 'Payment history', CashbackHistory: 'Cashback history', Notifications: 'Notifications', Saved: 'Saved homes', Static: '', OwnerProperty: 'Property', OwnerRoom: 'Room', PropertyStatus: 'Property status' };
const stackOptions = ({ navigation, route }) => {
  if (PLAIN_SCREENS.has(route.name)) return { headerShown: false };
  return {
    headerShown: true, title: TITLES[route.name] ?? '', headerShadowVisible: false,
    header: (props) => <AppHeader {...props} />,
  };
};

export default function RootNavigator({ initialRoute = 'Welcome' }) {
  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={stackOptions}>
      <Stack.Screen name="Welcome" component={Welcome} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Otp" component={Otp} />
      <Stack.Screen name="Role" component={ChooseRole} />
      <Stack.Screen name="Main" component={RoleTabs} />
      <Stack.Screen name="RegisterProperty" component={RegisterProperty} />
      <Stack.Screen name="Checkout" component={Checkout} />
      <Stack.Screen name="Vacancy" component={Vacancy} />
      <Stack.Screen name="OwnerCheckout" component={OwnerCheckout} />
      <Stack.Screen name="Commission" component={Commission} />
      <Stack.Screen name="Consent" component={Consent} />
      <Stack.Screen name="VerifyProperty" component={VerifyProperty} />
      <Stack.Screen name="PropertyDetails" component={PropertyDetails} />
      <Stack.Screen name="BookProperty" component={BookProperty} />
      <Stack.Screen name="Payment" component={Payment} />
      <Stack.Screen name="BookingDetails" component={BookingDetails} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="KYC" component={Kyc} />
      <Stack.Screen name="RentalHistory" component={RentalHistory} />
      <Stack.Screen name="PaymentHistory" component={PaymentHistory} />
      <Stack.Screen name="CashbackHistory" component={CashbackHistory} />
      <Stack.Screen name="Notifications" component={Notifications} />
      <Stack.Screen name="Saved" component={Saved} />
      <Stack.Screen name="Static" component={Static} />
      <Stack.Screen name="OwnerProperty" component={OwnerProperty} />
      <Stack.Screen name="OwnerRoom" component={OwnerRoom} />
      <Stack.Screen name="PropertyStatus" component={PropertyStatus} />
    </Stack.Navigator>
  );
}
