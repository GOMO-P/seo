import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import {Image} from 'expo-image'; // 또는 'react-native'의 Image 사용 가능
import {IconSymbol} from '@/components/ui/icon-symbol'; // 프로젝트에 있는 아이콘 컴포넌트 활용
import {ThemedText} from '@/components/themed-text';
import {ThemedView} from '@/components/themed-view';

// 1. 데이터 타입 정의
interface ChatRoom {
  id: string;
  name: string;
  lastMessage: string;
  unreadCount?: number;
  avatarColor: string; // 예시용 색상 (실제 이미지가 있다면 uri로 변경)
}

// 2. 더미 데이터 (Figma 내용 반영)
const CHAT_DATA: ChatRoom[] = [
  {
    id: '1',
    name: '토익 스터디',
    lastMessage: '넵 그래요',
    unreadCount: 0,
    avatarColor: '#B4DBFF',
  },
  {
    id: '2',
    name: '김철수',
    lastMessage: 'ㅇㅋ',
    unreadCount: 1,
    avatarColor: '#EAF2FF',
  },
  // 데이터가 늘어나면 스크롤이 자동으로 생깁니다.
];

export default function ChatScreen() {
  // 3. 채팅 리스트 아이템 렌더링 함수
  const renderItem = ({item}: {item: ChatRoom}) => (
    <TouchableOpacity style={styles.chatItem}>
      {/* 아바타 영역 */}
      <View style={[styles.avatarContainer, {backgroundColor: '#EAF2FF'}]}>
        <View style={[styles.avatarInner, {backgroundColor: item.avatarColor}]} />
      </View>

      {/* 텍스트 영역 */}
      <View style={styles.textContainer}>
        <Text style={styles.nameText}>{item.name}</Text>
        <Text style={styles.messageText}>{item.lastMessage}</Text>
      </View>

      {/* 배지(알림 수) 영역 */}
      {item.unreadCount && item.unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.unreadCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 영역 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>스터디 그룹 / 채팅 목록</Text>
        <TouchableOpacity>
          <Text style={styles.editButton}>수정</Text>
        </TouchableOpacity>
      </View>

      {/* 검색창 영역 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color="#8F9098" />
          {/* 아이콘 이름은 SF Symbol 기준, IconSymbol 구현에 따라 'search' 등으로 변경 필요 */}
          <TextInput
            placeholder="Search"
            placeholderTextColor="#8F9098"
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* 채팅 리스트 */}
      <FlatList
        data={CHAT_DATA}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

// 4. 스타일 정의 (Figma CSS 값 기반으로 변환)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center', // 타이틀 가운데 정렬을 위해
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0', // 구분선 추가 (선택사항)
    position: 'relative',
    height: 56,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2024',
  },
  editButton: {
    position: 'absolute',
    right: -130, // 적절한 위치 조정 필요 (부모가 center 정렬이라 절대 위치 사용)
    bottom: -8,
    fontSize: 14,
    fontWeight: '600',
    color: '#006FFD',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FE',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2024',
  },
  listContent: {
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 16, // Figma의 radius 값
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2024',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#71727A',
  },
  badge: {
    backgroundColor: '#006FFD',
    borderRadius: 20,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
});
