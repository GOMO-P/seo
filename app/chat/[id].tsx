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
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {IconSymbol} from '@/components/ui/icon-symbol';

// 🔥 Firebase 관련 임포트
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
  setDoc,
} from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: Timestamp | null;
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const {id, name} = useLocalSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // 2. [읽기] 실시간 데이터 구독
  useEffect(() => {
    if (!id) return;
    const roomId = Array.isArray(id) ? id[0] : id;

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
  }, [id]);

  // 3. [쓰기] 메시지 전송 + 마지막 대화 업데이트
  const sendMessage = async () => {
    if (!text.trim() || !id) return;

    const roomId = Array.isArray(id) ? id[0] : id;
    const messageToSend = text;
    setText('');

    try {
      // (1) 메시지 기록 저장 (기존과 동일)
      await addDoc(collection(db, 'chats', roomId, 'messages'), {
        text: messageToSend,
        sender: 'me',
        createdAt: serverTimestamp(),
      });

      // (2) 🔥 [추가됨] 채팅방 정보(마지막 대화) 업데이트
      // chats 컬렉션의 해당 방 문서에 'lastMessage' 필드를 갱신합니다.
      await setDoc(
        doc(db, 'chats', roomId),
        {
          lastMessage: messageToSend, // 리스트에 보여줄 마지막 대화
          lastMessageAt: serverTimestamp(), // 정렬을 위한 시간
          name: name || '채팅방', // 방 이름도 저장 (없으면 생성)
        },
        {merge: true},
      ); // merge: true는 기존 필드는 유지하고 변경된 것만 덮어씀
    } catch (error) {
      console.error('Error sending message: ', error);
      alert('전송 실패');
    }
  };

  // ... 렌더링 부분 (기존과 동일)
  const renderItem = ({item}: {item: Message}) => {
    const isMe = item.sender === 'me';
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <IconSymbol name="chevron.left" size={24} color="#006FFD" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name || '채팅방'}</Text>
        <TouchableOpacity style={styles.iconButton}>
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({animated: false})}
        />
      )}

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
  listContent: {padding: 16, gap: 16},
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
});
