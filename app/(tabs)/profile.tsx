import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  TextInput,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuthContext} from '@/contexts/AuthContext';
import {useRouter} from 'expo-router';
import useAuth from '@/hooks/useAuth';
import Avatar from '@/components/ui/Avatar';
import StatCounter from '@/components/ui/StatCounter';
import {Colors, Typography, Spacing, BorderRadius} from '@/constants/design-tokens';
import {Ionicons} from '@expo/vector-icons';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const {user} = useAuthContext();
  const {logout} = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState('내 이름은 닥터 탐정이요.');

  const backgroundColor = isDark ? Colors.background.dark : Colors.background.light;
  const textColor = isDark ? Colors.text.primary.dark : Colors.text.primary.light;
  const secondaryTextColor = isDark ? Colors.text.secondary.dark : Colors.text.secondary.light;
  const inputBg = isDark ? '#1E1E1E' : '#F5F5F5';

  const userName = user?.displayName || '민덕팔';
  const userTag = user?.email?.split('@')[0] || 'lucasscott3';
  const followerCount = 199;
  const followingCount = 0;

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      router.replace('/sign-in');
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor}]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: textColor}]}>프로필 관리</Text>
          <TouchableOpacity onPress={handleEditToggle} style={styles.editButton}>
            <Ionicons name="create-outline" size={24} color={Colors.primary[600]} />
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Avatar name={userName} size="xl" />
          <Text style={[styles.nickname, {color: textColor}]}>닉네임 : {userName}</Text>
          <Text style={[styles.tag, {color: secondaryTextColor}]}>Tag : @{userTag}</Text>

          {/* Stats */}
          <View style={styles.stats}>
            <StatCounter label="팔로우" count={followerCount} />
            <View style={[styles.divider, {backgroundColor: secondaryTextColor}]} />
            <StatCounter label="팔로워" count={followingCount} />
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioSection}>
          <Text style={[styles.bioLabel, {color: textColor}]}>자기소개</Text>
          <TextInput
            style={[
              styles.bioInput,
              {
                backgroundColor: inputBg,
                color: textColor,
                borderColor: isDark ? '#333333' : '#E0E0E0',
              },
            ]}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={8}
            placeholder="내 이름은 닥터 탐정이요."
            placeholderTextColor={secondaryTextColor}
            editable={isEditing}
            textAlignVertical="top"
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, {borderColor: Colors.error.main}]}
          onPress={handleLogout}>
          <Text style={[styles.logoutText, {color: Colors.error.main}]}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  editButton: {
    padding: Spacing.sm,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  nickname: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.md,
  },
  tag: {
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: Spacing.md,
  },
  bioSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  bioLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  bioInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.base,
    minHeight: 150,
  },
  logoutButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
});
