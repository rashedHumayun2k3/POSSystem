import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../dashboardStyles";
export default function AppHeader() { return (<View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>L</Text></View>
          <View>
            <Text style={styles.eyebrow}>GOOD MORNING</Text>
            <Text style={styles.businessName}>LavLokshan</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.syncPill}><View style={styles.syncDot} /><Text style={styles.syncText}>Synced</Text></View>
          <Pressable accessibilityLabel="Notifications" style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color="#263248" />
            <View style={styles.notificationDot}><Text style={styles.notificationText}>3</Text></View>
          </Pressable>
          <View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View>
        </View>
      </View>); }
