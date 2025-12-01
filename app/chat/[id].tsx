import React, {useState, useEffect, useRef} from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
  ScrollView,
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {IconSymbol} from '@/components/ui/icon-symbol';
import {useAuthContext} from '@/contexts/AuthContext';

// 🔥 Firebase 관련
import {db} from '@/config/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  doc,
  setDoc, // 🔥 updateDoc 대신 setDoc 사용 (중요)
  deleteDoc,
  getDoc,
  updateDoc, // 배열 수정용으로 남겨둠
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: Timestamp | null;
}

interface UserInfo {
  uid: string;
  name: string;
  email: string;
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const {id, name} = useLocalSearchParams();
  const {user} = useAuthContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  // 방 정보 및 설정 상태
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(true);
  const [participants, setParticipants] = useState<UserInfo[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const roomId = Array.isArray(id) ? id[0] : id;

  // 1. [수정됨] 채팅방 입장 시 '내 안 읽은 메시지 수' 0으로 초기화 (안전하게 setDoc 사용)
  useEffect(() => {
    if (!roomId || !user) return;

    const resetUnreadCount = async () => {
      try {
        const roomRef = doc(db, 'chats', roomId);
        // 🔥 setDoc + merge를 사용하면 필드가 없어도 에러 없이 생성해줍니다.
        await setDoc(
          roomRef,
          {
            unreadCounts: {
              [user.uid]: 0,
            },
          },
          {merge: true},
        );
      } catch (e) {
        console.error('읽음 처리 실패:', e);
      }
    };

    resetUnreadCount();
  }, [roomId, user]);

  // 2. 메시지 데이터 구독
  useEffect(() => {
    if (!roomId) return;

    const messagesRef = collection(db, 'chats', roomId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, snapshot => {
      const fetchedMessages: Message[] = snapshot.docs.map(
        doc =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Message),
      );

      setMessages(fetchedMessages);
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({animated: true}), 100);
    });

    return () => unsubscribe();
  }, [roomId]);

  // 3. 방 정보 구독 (참여자 & 알림설정)
  useEffect(() => {
    if (!roomId || !user) return;

    const roomRef = doc(db, 'chats', roomId);
    const unsubscribe = onSnapshot(roomRef, async docSnap => {
      if (docSnap.exists()) {
        const roomData = docSnap.data();

        // 알림 설정 확인
        const mutedList = roomData.mutedBy || [];
        setIsNotificationEnabled(!mutedList.includes(user.uid));

        // 참여자 정보 가져오기
        const participantIds = roomData.participants || [];
        if (participantIds.length > 0) {
          try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('uid', 'in', participantIds));
            const querySnapshot = await getDocs(q);

            const users: UserInfo[] = [];
            querySnapshot.forEach(doc => {
              users.push(doc.data() as UserInfo);
            });
            setParticipants(users);
          } catch (error) {
            console.error('참여자 정보 불러오기 실패:', error);
          }
        } else {
          setParticipants([]);
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, user]);

  // 알림 토글
  const toggleNotification = async (value: boolean) => {
    if (!roomId || !user) return;
    setIsNotificationEnabled(value);
    try {
      const roomRef = doc(db, 'chats', roomId);
      if (value) {
        // 배열 수정은 updateDoc이 편함 (이미 문서가 있으므로)
        await updateDoc(roomRef, {mutedBy: arrayRemove(user.uid)});
      } else {
        await updateDoc(roomRef, {mutedBy: arrayUnion(user.uid)});
      }
    } catch (error) {
      console.error('알림 설정 변경 실패:', error);
      setIsNotificationEnabled(!value);
    }
  };

  // 4. [수정됨] 메시지 전송 (setDoc + merge 사용으로 필드 누락 방지)
  const sendMessage = async () => {
    if (!text.trim() || !roomId || !user) return;

    const messageToSend = text;
    setText('');

    try {
      // (1) 메시지 저장
      await addDoc(collection(db, 'chats', roomId, 'messages'), {
        text: messageToSend,
        sender: user.displayName || 'Anonymous',
        createdAt: serverTimestamp(),
      });

      // (2) 방 정보 업데이트 준비
      const roomRef = doc(db, 'chats', roomId);
      const roomSnap = await getDoc(roomRef);

      const updateData: any = {
        lastMessage: messageToSend,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        // name 필드 업데이트 제거 (상대방 이름 덮어쓰기 방지)
        unreadCounts: {},
      };

      if (roomSnap.exists()) {
        const roomData = roomSnap.data();
        const currentParticipants = roomData.participants || [];

        // 나를 제외한 유저 unreadCounts +1
        currentParticipants.forEach((uid: string) => {
          if (uid !== user.uid) {
            // 🔥 setDoc merge를 위한 중첩 객체 방식
            updateData.unreadCounts[uid] = increment(1);
          }
        });
      }

      // 🔥 핵심: setDoc({ ... }, { merge: true }) 사용
      // unreadCounts 필드가 없으면 자동으로 생성해줍니다.
      await setDoc(roomRef, updateData, {merge: true});
    } catch (error) {
      console.error('Error sending message: ', error);
      alert('전송 실패');
    }
  };

  // 5. [수정됨] 채팅방 나가기 (웹 호환성 추가)
  const performLeaveChat = async () => {
    if (!roomId || !user) return;
    try {
      const roomRef = doc(db, 'chats', roomId);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        setSettingsVisible(false);
        router.back();
        return;
      }

      const roomData = roomSnap.data();
      const currentParticipants = roomData.participants || [];
      const updatedParticipants = currentParticipants.filter((uid: string) => uid !== user.uid);

      // 남은 사람이 1명 이하면 방 폭파
      if (updatedParticipants.length < 2) {
        // 메시지 컬렉션 삭제 로직은 복잡하므로 여기선 방만 삭제 (실무에선 Cloud Functions 추천)
        await deleteDoc(roomRef);
      } else {
        await updateDoc(roomRef, {participants: updatedParticipants});
      }

      setSettingsVisible(false);
      router.replace('/(tabs)/chat');
    } catch (e) {
      console.error('Error leaving chat:', e);
      Alert.alert('오류', '나가기 처리 중 문제가 발생했습니다.');
    }
  };

  const handleLeaveChat = () => {
    if (Platform.OS === 'web') {
      // 웹: window.confirm 사용
      if (window.confirm('정말로 이 채팅방을 나가시겠습니까?')) {
        performLeaveChat();
      }
    } else {
      // 앱: Alert 사용
      Alert.alert('채팅방 나가기', '정말로 이 채팅방을 나가시겠습니까?', [
        {text: '취소', style: 'cancel'},
        {
          text: '나가기',
          style: 'destructive',
          onPress: performLeaveChat,
        },
      ]);
    }
  };

  const renderItem = ({item}: {item: Message}) => {
    const isMe = item.sender === (user?.displayName || 'me') || item.sender === 'me';
    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
        {!isMe && <Text style={styles.senderName}>{item.sender}</Text>}
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <IconSymbol name="chevron.left" size={24} color="#006FFD" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name || '채팅방'}</Text>
        <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconButton}>
          <IconSymbol name="gear" size={24} color="#1F2024" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#006FFD" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* 입력창 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.plusButton}>
            <IconSymbol name="plus" size={24} color="#006FFD" />
          </TouchableOpacity>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="메시지 입력"
              value={text}
              onChangeText={setText}
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
              <IconSymbol name="arrow.up" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ⚙️ 설정 모달 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsVisible}
        onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>그룹 채팅방 설정</Text>
              <TouchableOpacity
                onPress={() => setSettingsVisible(false)}
                style={{position: 'absolute', right: 0}}>
                <IconSymbol name="xmark" size={24} color="#1F2024" />
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingText}>채팅방 알림</Text>
              <Switch
                value={isNotificationEnabled}
                onValueChange={toggleNotification}
                trackColor={{false: '#767577', true: '#006FFD'}}
              />
            </View>
            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <Text style={styles.settingText}>참여자 ({participants.length}명)</Text>
            </View>
            <View style={styles.divider} />

            <ScrollView style={styles.participantList}>
              {participants.length > 0 ? (
                participants.map(p => (
                  <View key={p.uid} style={styles.participantItem}>
                    <View style={styles.avatarSmall} />
                    <View>
                      <Text style={styles.participantName}>
                        {p.name || '이름 없음'} {p.uid === user?.uid ? '(나)' : ''}
                      </Text>
                      <Text style={styles.participantEmail}>{p.email}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{color: '#8F9098', padding: 10, textAlign: 'center'}}>
                  참여자 정보가 없습니다.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveChat}>
              <Text style={styles.leaveButtonText}>채팅방 나가기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  container: {flex: 1, backgroundColor: 'white'},
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {fontSize: 16, fontWeight: '700', color: '#1F2024'},
  iconButton: {padding: 4},
  listContent: {padding: 16, gap: 16, paddingBottom: 80},
  messageRow: {marginBottom: 4, maxWidth: '80%'},
  myRow: {alignSelf: 'flex-end', alignItems: 'flex-end'},
  otherRow: {alignSelf: 'flex-start', alignItems: 'flex-start'},
  senderName: {fontSize: 12, color: '#71727A', fontWeight: '700', marginBottom: 4, marginLeft: 4},
  bubble: {paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20},
  myBubble: {backgroundColor: '#006FFD', borderTopRightRadius: 4},
  otherBubble: {backgroundColor: '#F8F9FE', borderTopLeftRadius: 4},
  messageText: {fontSize: 14, lineHeight: 20},
  myText: {color: 'white'},
  otherText: {color: '#1F2024'},
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: 'white',
  },
  plusButton: {marginRight: 12},
  textInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FE',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  textInput: {flex: 1, height: 40, paddingHorizontal: 12, fontSize: 14, color: '#1F2024'},
  sendButton: {
    width: 32,
    height: 32,
    backgroundColor: '#006FFD',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 모달 스타일
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  modalTitle: {fontSize: 16, fontWeight: '700', color: '#1F2024'},
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  settingText: {fontSize: 14, color: '#1F2024'},
  divider: {height: 1, backgroundColor: '#F0F0F0'},
  participantList: {marginTop: 10, marginBottom: 20, maxHeight: 200},
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    backgroundColor: '#F8F9FE',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatarSmall: {width: 32, height: 32, borderRadius: 12, backgroundColor: '#B4DBFF'},
  participantName: {fontSize: 14, fontWeight: '600', color: '#1F2024'},
  participantEmail: {fontSize: 12, color: '#71727A'},
  leaveButton: {
    backgroundColor: '#006FFD',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  leaveButtonText: {color: 'white', fontWeight: '600', fontSize: 14},
});
