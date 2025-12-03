import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import {IconSymbol} from '@/components/ui/icon-symbol';
import {useRouter} from 'expo-router';
import {useAuthContext} from '@/contexts/AuthContext';
import * as Notifications from 'expo-notifications';

import {db} from '@/config/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  getDocs,
  where,
} from 'firebase/firestore';

interface ChatRoom {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: any;
  avatarBgColor: string;
  unreadCounts?: {[key: string]: number};
  participants?: string[];
}

interface UserData {
  uid: string;
  name: string;
  email: string;
}

export default function ChatScreen() {
  const router = useRouter();
  const {user} = useAuthContext();

  const [chatList, setChatList] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [userMap, setUserMap] = useState<{[key: string]: string}>({});

  // 1. 유저 목록 가져오기
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), snapshot => {
      const map: {[key: string]: string} = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        map[data.uid] = data.name || '알 수 없음';
      });
      setUserMap(map);
    });
    return () => unsubscribe();
  }, []);

  // 2. 채팅방 목록 가져오기
  useEffect(() => {
    if (!user) return;

    // 🔥 [수정됨] 내가 포함된 채팅방만 가져오기 (participants 배열에 내 uid가 있는 경우)
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const rooms: ChatRoom[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const participants = data.participants || [];
        const unreadCounts = data.unreadCounts || {};

        rooms.push({
          id: doc.id,
          name: data.name || '알 수 없는 방',
          lastMessage: data.lastMessage || '대화가 없습니다.',
          lastMessageAt: data.lastMessageAt,
          avatarBgColor: '#EAF2FF',
          unreadCounts: unreadCounts,
          participants: participants,
        });
      });

      setChatList(rooms);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // (알림 함수 생략)
  async function schedulePushNotification(title: string, body: string) {
    await Notifications.scheduleNotificationAsync({
      content: {title, body, sound: true},
      trigger: null,
    });
  }

  // (유저 검색 함수 생략)
  const fetchUsers = async () => {
    if (!user) return;
    setLoadingUsers(true);
    try {
      const q = query(collection(db, 'users'), where('uid', '!=', user.uid));
      const querySnapshot = await getDocs(q);
      const userList: UserData[] = [];
      querySnapshot.forEach(doc => userList.push(doc.data() as UserData));
      setUsers(userList);
    } catch (error) {
      console.error('Error fetching users: ', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (modalVisible) fetchUsers();
  }, [modalVisible]);

  // 채팅방 생성
  const handleCreateChat = async (selectedUser: UserData) => {
    if (!user) return;
    try {
      setModalVisible(false);

      // 🔥 [수정됨] 이미 존재하는 채팅방인지 확인
      // 1. 내가 참여한 모든 방을 가져옴 (쿼리 제약상 'participants' array-contains와 다른 필드 동시 필터링이 까다로울 수 있음)
      //    따라서 일단 내 방을 가져와서 JS단에서 상대방이 있는지 확인하는 방식이 가장 확실하고 간단함.
      const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
      const querySnapshot = await getDocs(q);

      let existingRoomId = null;
      let existingRoomName = '';

      // 2. 상대방(selectedUser.uid)도 포함된 방이 있는지 찾기
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const participants = data.participants || [];
        if (participants.includes(selectedUser.uid)) {
          existingRoomId = doc.id;
          existingRoomName = data.name;
          break; // 찾았으면 중단
        }
      }

      // 3. 이미 존재하면 해당 방으로 이동
      if (existingRoomId) {
        console.log('이미 존재하는 방으로 이동:', existingRoomId);
        router.push({
          pathname: '/chat/[id]',
          params: {id: existingRoomId, name: existingRoomName || selectedUser.name},
        });
        return;
      }

      // 4. 없으면 새로 생성
      const roomName = `${selectedUser.name}`;
      const initialUnreadCounts = {
        [user.uid]: 0,
        [selectedUser.uid]: 0,
      };

      const docRef = await addDoc(collection(db, 'chats'), {
        name: roomName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        participants: [user.uid, selectedUser.uid],
        lastMessage: '대화를 시작해보세요!',
        lastMessageAt: serverTimestamp(),
        unreadCounts: initialUnreadCounts,
      });

      router.push({pathname: '/chat/[id]', params: {id: docRef.id, name: roomName}});
    } catch (error) {
      console.error('Error creating room: ', error);
      Alert.alert('오류', '채팅방 생성 실패');
    }
  };

  // 렌더링
  const renderChatItem = ({item}: {item: ChatRoom}) => {
    // 🔥 [핵심] 내 안 읽은 개수 가져오기
    const myUnreadCount = item.unreadCounts?.[user?.uid || ''] || 0;

    // 상대방 이름 찾기
    let displayName = item.name;
    if (item.participants && item.participants.length > 0) {
      const otherId = item.participants.find(uid => uid !== user?.uid);
      if (otherId && userMap[otherId]) {
        displayName = userMap[otherId];
      }
    }

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() =>
          router.push({pathname: '/chat/[id]', params: {id: item.id, name: displayName}})
        }>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatarHead, {backgroundColor: item.avatarBgColor}]} />
          <View style={[styles.avatarBody, {backgroundColor: item.avatarBgColor}]} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{displayName}</Text>
          <Text style={styles.messageText} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>

        {/* 배지 표시 조건: 0보다 클 때만 */}
        <View style={styles.rightContainer}>
          {myUnreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{myUnreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderUserItem = ({item}: {item: UserData}) => (
    <TouchableOpacity style={styles.userItem} onPress={() => handleCreateChat(item)}>
      <View style={[styles.avatarContainer, {width: 36, height: 36, marginRight: 12}]}>
        <View style={[styles.avatarHead, {backgroundColor: '#E0E0E0'}]} />
        <View style={[styles.avatarBody, {backgroundColor: '#E0E0E0'}]} />
      </View>
      <View>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusBarPlaceholder} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeftButton}>
          <Text style={styles.headerButtonText}>수정</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>채팅 목록</Text>
        </View>
        <TouchableOpacity style={styles.headerRightButton} onPress={() => setModalVisible(true)}>
          <IconSymbol name="plus" size={24} color="#006FFD" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={18} color="#8F9098" style={{marginRight: 8}} />
          <TextInput
            placeholder="Search"
            placeholderTextColor="#8F9098"
            style={styles.searchInput}
          />
        </View>
      </View>

      {loading ? (
        <View style={{flex: 1, justifyContent: 'center'}}>
          <ActivityIndicator size="large" color="#006FFD" />
        </View>
      ) : (
        <FlatList
          data={chatList}
          renderItem={renderChatItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={{padding: 40, alignItems: 'center'}}>
              <Text style={{color: '#8F9098', marginBottom: 8}}>채팅방이 없습니다.</Text>
              <Text style={{color: '#006FFD'}}>우측 상단 + 버튼을 눌러보세요!</Text>
            </View>
          }
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>대화 상대를 선택하세요</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <IconSymbol name="xmark" size={20} color="#71727A" />
              </TouchableOpacity>
            </View>
            {loadingUsers ? (
              <ActivityIndicator size="large" color="#006FFD" style={{marginVertical: 20}} />
            ) : (
              <FlatList
                data={users}
                renderItem={renderUserItem}
                keyExtractor={item => item.uid}
                contentContainerStyle={{paddingBottom: 16}}
                ListEmptyComponent={
                  <Text style={{textAlign: 'center', color: '#8F9098', marginTop: 20}}>
                    친구 없음
                  </Text>
                }
              />
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: 'white'},
  statusBarPlaceholder: {
    height: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    backgroundColor: 'white',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  headerLeftButton: {minWidth: 40, justifyContent: 'center', alignItems: 'flex-start', zIndex: 10},
  headerButtonText: {fontSize: 14, fontWeight: '600', color: '#006FFD'},
  headerTitleWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  headerTitle: {fontSize: 16, fontWeight: '700', color: '#1F2024'},
  headerRightButton: {minWidth: 40, justifyContent: 'center', alignItems: 'flex-end', zIndex: 10},
  searchContainer: {paddingHorizontal: 16, paddingVertical: 12},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FE',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 44,
  },
  searchInput: {flex: 1, fontSize: 14, color: '#1F2024', height: '100%', paddingVertical: 0},
  listContent: {paddingBottom: 20},
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: '#EAF2FF',
    overflow: 'hidden',
    position: 'relative',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHead: {width: 16, height: 16, borderRadius: 8, position: 'absolute', top: 8},
  avatarBody: {width: 24, height: 24, borderRadius: 12, position: 'absolute', bottom: -10},
  textContainer: {flex: 1, justifyContent: 'center', gap: 2},
  nameText: {fontSize: 14, fontWeight: '700', color: '#1F2024', marginBottom: 2},
  messageText: {fontSize: 12, fontWeight: '400', color: '#71727A'},
  rightContainer: {justifyContent: 'center', alignItems: 'flex-end', minWidth: 24},
  badge: {
    backgroundColor: '#006FFD',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {color: 'white', fontSize: 10, fontWeight: '700'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    maxHeight: '60%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {fontSize: 18, fontWeight: '700', color: '#1F2024'},
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  userName: {fontSize: 16, fontWeight: '600', color: '#1F2024'},
  userEmail: {fontSize: 12, color: '#71727A'},
  closeButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
  },
  closeButtonText: {fontSize: 14, fontWeight: '600', color: '#1F2024'},
});
