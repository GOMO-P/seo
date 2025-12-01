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

// 🔥 Firebase 관련
import {db} from '@/config/firebase';
import {collection, onSnapshot, query, orderBy, addDoc, serverTimestamp} from 'firebase/firestore';

// 데이터 타입 정의
interface ChatRoom {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: any;
  avatarBgColor: string;
}

export default function ChatScreen() {
  const router = useRouter();
  const {user} = useAuthContext();

  const [chatList, setChatList] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // 모달(팝업) 관련 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);

  // 1. [읽기] 채팅방 목록 실시간 구독
  useEffect(() => {
    // lastMessageAt(마지막 대화 시간) 기준 내림차순 정렬 (최신 대화가 위로)
    const q = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));

    const unsubscribe = onSnapshot(q, snapshot => {
      const rooms: ChatRoom[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '알 수 없는 방',
          lastMessage: data.lastMessage || '대화가 없습니다.',
          lastMessageAt: data.lastMessageAt,
          avatarBgColor: '#EAF2FF', // 고정 색상 (나중에 랜덤이나 유저별 색상으로 변경 가능)
        };
      });
      setChatList(rooms);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. [쓰기] 새로운 채팅방 생성 함수
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      Alert.alert('알림', '방 이름을 입력해주세요.');
      return;
    }
    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    try {
      setCreating(true);
      // chats 컬렉션에 새 문서 추가
      const docRef = await addDoc(collection(db, 'chats'), {
        name: newRoomName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastMessage: '새 채팅방이 생성되었습니다.',
        lastMessageAt: serverTimestamp(),
      });

      // 모달 닫기 및 초기화
      setModalVisible(false);
      setNewRoomName('');

      // 생성된 방으로 바로 이동
      router.push({
        pathname: '/chat/[id]',
        params: {id: docRef.id, name: newRoomName},
      });
    } catch (error) {
      console.error('Error creating room: ', error);
      Alert.alert('오류', '채팅방 생성 중 문제가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const renderItem = ({item}: {item: ChatRoom}) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() =>
        router.push({
          pathname: '/chat/[id]',
          params: {id: item.id, name: item.name},
        })
      }>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarHead, {backgroundColor: item.avatarBgColor}]} />
        <View style={[styles.avatarBody, {backgroundColor: item.avatarBgColor}]} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.nameText}>{item.name}</Text>
        <Text style={styles.messageText} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusBarPlaceholder} />

      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeftButton}>
          <Text style={styles.headerButtonText}>수정</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>채팅 목록</Text>
        </View>

        {/* 채팅방 추가 버튼 (+ 아이콘) */}
        <TouchableOpacity style={styles.headerRightButton} onPress={() => setModalVisible(true)}>
          <IconSymbol name="plus" size={24} color="#006FFD" />
        </TouchableOpacity>
      </View>

      {/* 검색창 */}
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

      {/* 채팅 리스트 */}
      {loading ? (
        <View style={{flex: 1, justifyContent: 'center'}}>
          <ActivityIndicator size="large" color="#006FFD" />
        </View>
      ) : (
        <FlatList
          data={chatList}
          renderItem={renderItem}
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

      {/* 🆕 채팅방 생성 모달 (팝업) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>새 채팅방 만들기</Text>
            <Text style={styles.modalSubtitle}>채팅방의 이름을 입력해주세요.</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="예: 맛집 탐방대"
              value={newRoomName}
              onChangeText={setNewRoomName}
              autoFocus={true}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateRoom}
                disabled={creating}>
                {creating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>만들기</Text>
                )}
              </TouchableOpacity>
            </View>
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

  // --- 모달 스타일 ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {fontSize: 18, fontWeight: '700', color: '#1F2024', marginBottom: 8},
  modalSubtitle: {fontSize: 14, color: '#71727A', marginBottom: 20},
  modalInput: {
    width: '100%',
    height: 48,
    backgroundColor: '#F8F9FE',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {flexDirection: 'row', gap: 12, width: '100%'},
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {backgroundColor: '#F0F0F0'},
  cancelButtonText: {color: '#1F2024', fontWeight: '600'},
  createButton: {backgroundColor: '#006FFD'},
  createButtonText: {color: 'white', fontWeight: '600'},
});
