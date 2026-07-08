import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  Keyboard,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { AppText } from '../../components';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { aiAPI } from '../../api/services';
import ThinkingState from '../../components/ThinkingState';
import Markdown from 'react-native-markdown-display';

// ─── Theme ────────────────────────────────────────────────────────────────────

const THEME_COLOR = '#22c55e';
const BG_COLOR = '#f8fafc';

const markdownStyles = {
  body: { color: Colors.textPrimary, fontSize: ms(14), lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  text: { color: Colors.textPrimary, fontSize: ms(14) },
  code_inline: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    color: '#be185d',
    fontSize: ms(13),
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  code_block: {
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    fontSize: ms(12),
    padding: 12,
    borderRadius: 8,
    marginVertical: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fence: {
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    fontSize: ms(12),
    padding: 12,
    borderRadius: 8,
    marginVertical: 6,
  },
  link: { color: THEME_COLOR },
  heading1: {
    fontSize: ms(18),
    fontWeight: '700',
    color: Colors.textPrimary,
    marginVertical: 8,
  },
  heading2: {
    fontSize: ms(16),
    fontWeight: '700',
    color: Colors.textPrimary,
    marginVertical: 6,
  },
  heading3: {
    fontSize: ms(15),
    fontWeight: '600',
    color: Colors.textPrimary,
    marginVertical: 4,
  },
  strong: { fontWeight: '700', color: Colors.textPrimary },
  list_item: { marginVertical: 3 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  blockquote: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: THEME_COLOR,
    paddingLeft: 10,
    paddingVertical: 4,
    marginVertical: 4,
    borderRadius: 4,
  },
  table: {
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
  },
  th: {
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#f1f5f9',
  },
  td: { padding: 8, borderWidth: 1, borderColor: Colors.border },
  hr: { borderColor: Colors.border, marginVertical: 8 },
};

// ─── Streaming cursor blink component ─────────────────────────────────────────

const StreamingCursor = () => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.Text
      style={{
        opacity,
        color: THEME_COLOR,
        fontSize: ms(15),
        fontWeight: '700',
        lineHeight: 22,
      }}
    >
      ▍
    </Animated.Text>
  );
};

// ─── Timestamp helper ─────────────────────────────────────────────────────────

const formatTime = iso => {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const AIAssistantScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false); // separate flag for cursor
  const [planStatus, setPlanStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(ms(44));
  const abortRef = useRef(false); // for future abort support

  const flatListRef = useRef(null);

  const suggestions = [
    {
      id: 1,
      icon: 'trending-up',
      color: '#4D8733',
      text: 'Show me overall sales performance this month',
    },
    {
      id: 2,
      icon: 'alert-circle',
      color: '#F59E0B',
      text: 'Which teams are underperforming?',
    },
    {
      id: 3,
      icon: 'bar-chart',
      color: '#3B82F6',
      text: 'Generate a revenue forecast for next quarter',
    },
    {
      id: 4,
      icon: 'people',
      color: '#8B5CF6',
      text: 'Show user activity and adoption metrics',
    },
  ];

  useEffect(() => {
    fetchPlanStatus();
    fetchSessions();
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 80);
  }, []);

  const fetchPlanStatus = async () => {
    const response = await aiAPI.getPlanStatus();
    if (response.success) setPlanStatus(response.data);
  };

  const fetchSessions = async () => {
    const response = await aiAPI.getSessions();
    if (response.success) setSessions(response.data?.sessions || []);
  };

  const fetchHistory = async sessionId => {
    setCurrentSessionId(sessionId);
    setIsHistoryVisible(false);
    const response = await aiAPI.getHistory(sessionId);
    if (response.success) {
      const history = (response.data?.messages || []).map(msg => ({
        id: msg._id || Math.random().toString(),
        text: msg.content,
        sender: msg.role === 'user' ? 'user' : 'ai',
        createdAt: msg.createdAt,
      }));
      setMessages(history);
      scrollToBottom(false);
    } else {
      Alert.alert('Error', 'Failed to load chat history');
    }
  };

  const handleNewChat = async () => {
    setMessages([]);
    setCurrentSessionId(null);
    setIsHistoryVisible(false);
    const response = await aiAPI.createSession();
    if (response.success && response.data?.session) {
      setCurrentSessionId(response.data.session._id);
      fetchSessions();
    }
  };

  const handleSend = async (text = inputText) => {
    if (!text.trim() || isLoading) return;

    Keyboard.dismiss();

    const userMsg = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      createdAt: new Date().toISOString(),
    };

    const tempAiMsgId = `streaming-${Date.now()}`;
    const aiPlaceholder = {
      id: tempAiMsgId,
      text: '',
      sender: 'ai',
      createdAt: new Date().toISOString(),
      streaming: true,
    };

    setMessages(prev => [...prev, userMsg, aiPlaceholder]);
    setInputText('');
    setInputHeight(ms(44));
    setIsLoading(true);
    setIsStreaming(true);
    abortRef.current = false;

    scrollToBottom();

    try {
      await aiAPI.sendMessageStreamXHR(text.trim(), currentSessionId, {
        onChunk: fullText => {
          if (abortRef.current) return;
          setMessages(prev => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            const last = next[lastIdx];
            if (last && last.sender === 'ai') {
              next[lastIdx] = { ...last, text: fullText, streaming: true };
            }
            return next;
          });
          scrollToBottom();
        },
        onInit: sessionId => setCurrentSessionId(sessionId),
        onError: message => {
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.sender === 'ai') {
              next[next.length - 1] = {
                ...last,
                text: message || 'An error occurred.',
                isError: true,
                streaming: false,
              };
            }
            return next;
          });
        },
        onDone: () => {
          // Mark streaming done — remove cursor
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.sender === 'ai') {
              next[next.length - 1] = { ...last, streaming: false };
            }
            return next;
          });
          setIsStreaming(false);
          fetchPlanStatus();
          fetchSessions();
          scrollToBottom();
        },
      });
    } catch (error) {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.sender === 'ai') {
          next[next.length - 1] = {
            ...last,
            text:
              error.message || 'Network error. Please check your connection.',
            isError: true,
            streaming: false,
          };
        }
        return next;
      });
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = sessionId => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await aiAPI.deleteSession(sessionId);
          fetchSessions();
          if (currentSessionId === sessionId) handleNewChat();
        },
      },
    ]);
  };

  // ── Render blocks ──────────────────────────────────────────────────────────

  const renderMessage = ({ item, index }) => {
    const isUser = item.sender === 'user';
    const isAiEmpty = !isUser && (item.text === '' || item.text === undefined);

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAi,
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatarSmall}>
            <Icon name="sparkles" size={ms(13)} color={THEME_COLOR} />
          </View>
        )}
        <View style={{ maxWidth: '82%' }}>
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.messageBubbleUser : styles.messageBubbleAi,
            ]}
          >
            {isAiEmpty ? (
              <ThinkingState />
            ) : item.isError ? (
              <View style={styles.errorBubble}>
                <Icon
                  name="alert-circle-outline"
                  size={ms(14)}
                  color={Colors.error}
                  style={{ marginRight: 6 }}
                />
                <AppText
                  size={13}
                  color={Colors.error}
                  style={{ flex: 1, lineHeight: 20 }}
                >
                  {item.text}
                </AppText>
              </View>
            ) : isUser ? (
              <AppText
                size={14}
                color={Colors.white}
                style={{ lineHeight: 22 }}
              >
                {item.text}
              </AppText>
            ) : (
              <View>
                <Markdown
                  style={markdownStyles}
                  onLinkPress={url => {
                    if (url) Linking.openURL(url);
                    return false;
                  }}
                >
                  {item.text}
                </Markdown>
                {item.streaming && <StreamingCursor />}
              </View>
            )}
          </View>
          {/* Timestamp */}
          <AppText
            size="xs"
            color={Colors.textMuted}
            style={[styles.timestamp, isUser && styles.timestampUser]}
          >
            {formatTime(item.createdAt)}
            {item.streaming ? '  Generating…' : ''}
          </AppText>
        </View>
      </View>
    );
  };

  const renderWelcome = () => (
    <Pressable style={styles.contentContainer} onPress={Keyboard.dismiss}>
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeIconContainer}>
          <Icon name="sparkles" size={ms(36)} color={THEME_COLOR} />
        </View>
        <AppText size="xl" weight="bold" style={styles.welcomeTitle}>
          How can I help you today?
        </AppText>
        <AppText
          size="sm"
          color={Colors.textMuted}
          style={{ textAlign: 'center', marginTop: 8 }}
        >
          Ask me anything about your CRM data, performance, or forecasts.
        </AppText>
      </View>

      <View style={styles.suggestionsContainer}>
        {suggestions.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.suggestionButton}
            onPress={() => handleSend(item.text)}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.suggestionIcon,
                { backgroundColor: item.color + '18' },
              ]}
            >
              <Icon name={item.icon} size={ms(18)} color={item.color} />
            </View>
            <AppText style={styles.suggestionText}>{item.text}</AppText>
            <Icon
              name="chevron-forward"
              size={ms(14)}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        ))}
      </View>
    </Pressable>
  );

  const renderCreditBar = () => {
    if (!planStatus?.data) return null;
    const { planName, usedCredits, totalCredits, remainingCredits, resetDate } =
      planStatus.data;
    const progress = Math.min(100, (usedCredits / totalCredits) * 100);
    const isLow = remainingCredits < 50;

    return (
      <View style={styles.creditBar}>
        <View style={styles.creditRow}>
          <View style={styles.creditLabelRow}>
            <Icon
              name="flash"
              size={ms(13)}
              color={isLow ? Colors.error : THEME_COLOR}
            />
            <AppText weight="semiBold" size="xs" style={{ marginLeft: 4 }}>
              {planName || 'Basic'}
            </AppText>
            <AppText
              size="xs"
              color={Colors.textMuted}
              style={{ marginLeft: 8 }}
            >
              {remainingCredits} credits left
            </AppText>
          </View>
          <AppText size="xs" color={Colors.textMuted}>
            Resets {new Date(resetDate).toLocaleDateString('en-IN')}
          </AppText>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progress}%`,
                backgroundColor: isLow ? Colors.error : THEME_COLOR,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  // ── Input footer ──────────────────────────────────────────────────────────

  const renderFooter = () => (
    <View style={styles.footer}>
      <View style={[styles.inputContainer, { minHeight: ms(52) }]}>
        <TextInput
          style={[styles.input, { height: Math.max(ms(36), inputHeight) }]}
          placeholder="Message AI Assistant…"
          placeholderTextColor={Colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
          onContentSizeChange={e => {
            const h = e.nativeEvent.contentSize.height;
            setInputHeight(Math.min(ms(120), Math.max(ms(36), h)));
          }}
          returnKeyType="default"
          blurOnSubmit={false}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            inputText.trim().length > 0 &&
              !isLoading &&
              styles.sendButtonActive,
            isLoading && styles.sendButtonLoading,
          ]}
          onPress={() => handleSend()}
          disabled={isLoading || inputText.trim().length === 0}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Icon name="send" size={ms(16)} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>
      <AppText size="xs" color={Colors.textMuted} style={styles.disclaimer}>
        AI responses may not be 100% accurate. Verify important information.
      </AppText>
    </View>
  );

  // ── Return ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoContainer}>
            <Icon name="sparkles" size={ms(20)} color={THEME_COLOR} />
          </View>
          <View>
            <AppText size="base" weight="bold">
              AI Assistant
            </AppText>
            <View style={styles.statusContainer}>
              {isStreaming ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={THEME_COLOR}
                    style={{ marginRight: 4, transform: [{ scale: 0.65 }] }}
                  />
                  <AppText size="xs" color={THEME_COLOR}>
                    Generating…
                  </AppText>
                </>
              ) : isLoading ? (
                <AppText size="xs" color={THEME_COLOR}>
                  Thinking…
                </AppText>
              ) : (
                <>
                  <View style={styles.statusDot} />
                  <AppText size="xs" color={Colors.textMuted}>
                    Online
                  </AppText>
                </>
              )}
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={handleNewChat}>
            <Icon
              name="add-outline"
              size={ms(22)}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setIsHistoryVisible(true)}
          >
            <Icon
              name="time-outline"
              size={ms(22)}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="close" size={ms(22)} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {Platform.OS !== 'ios' && renderCreditBar()}

      <View style={styles.divider} /* Divider */ />

      {/* Keyboard-aware body */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {messages.length === 0 ? (
          <FlatList
            data={[{ key: 'welcome' }]}
            renderItem={renderWelcome}
            keyExtractor={item => item.key}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.chatListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollToBottom()}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          />
        )}

        {renderFooter()}
      </KeyboardAvoidingView>

      {/* History Modal */}
      <Modal
        visible={isHistoryVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsHistoryVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Icon
                name="time-outline"
                size={ms(20)}
                color={Colors.textPrimary}
              />
              <AppText size="lg" weight="bold">
                Chat History
              </AppText>
            </View>
            <TouchableOpacity
              onPress={() => setIsHistoryVisible(false)}
              style={styles.headerButton}
            >
              <Icon name="close" size={ms(22)} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.newChatBtn}
            onPress={handleNewChat}
            activeOpacity={0.8}
          >
            <Icon
              name="add-circle-outline"
              size={ms(18)}
              color={Colors.white}
            />
            <AppText
              size="sm"
              weight="semiBold"
              color={Colors.white}
              style={{ marginLeft: 8 }}
            >
              New Chat
            </AppText>
          </TouchableOpacity>

          {sessions.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Icon
                name="chatbubble-outline"
                size={ms(44)}
                color={Colors.textMuted}
              />
              <AppText color={Colors.textMuted} style={{ marginTop: 12 }}>
                No chat history yet
              </AppText>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={item => item._id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.historyItem,
                    currentSessionId === item._id && styles.historyItemActive,
                  ]}
                  onPress={() => fetchHistory(item._id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.historyIconWrap}>
                    <Icon
                      name="chatbubble-ellipses-outline"
                      size={ms(16)}
                      color={
                        currentSessionId === item._id
                          ? THEME_COLOR
                          : Colors.textMuted
                      }
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText weight="semiBold" numberOfLines={1} size="sm">
                      {item.title || 'New Chat'}
                    </AppText>
                    <AppText
                      size="xs"
                      color={Colors.textMuted}
                      style={{ marginTop: 2 }}
                    >
                      {new Date(item.updatedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </AppText>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteHistoryButton}
                    onPress={() => handleDeleteSession(item._id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon
                      name="trash-outline"
                      size={ms(18)}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
  },
  logoContainer: {
    width: ms(34),
    height: ms(34),
    borderRadius: BorderRadius.md,
    backgroundColor: THEME_COLOR + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME_COLOR,
    marginRight: 5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
  },
  headerButton: {
    padding: ms(7),
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.background,
  },
  closeButton: {
    padding: ms(7),
    marginLeft: ms(2),
  },

  // ── Credit Bar ──
  creditBar: {
    backgroundColor: Colors.white,
    paddingHorizontal: ms(14),
    paddingVertical: ms(8),
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  creditLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

    // ── Welcome ──
    contentContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: ms(20),
        paddingVertical: ms(20),

    },
    welcomeContainer: {
        alignItems: 'center',
        marginBottom: ms(28),
    },
    welcomeIconContainer: {
        width: ms(64),
        height: ms(64),
        borderRadius: ms(32),
        backgroundColor: THEME_COLOR + '18',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: ms(16),
    },
    welcomeTitle: {
        textAlign: 'center',
        color: Colors.textPrimary,
    },

  // ── Suggestions ──
  suggestionsContainer: {
    gap: ms(10),
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: ms(14),
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: ms(12),
    ...Shadow.sm,
  },
  suggestionIcon: {
    width: ms(32),
    height: ms(32),
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
  },

  // ── Chat List ──
  chatListContent: {
    paddingHorizontal: ms(14),
    paddingTop: ms(16),
    paddingBottom: ms(16),
  },
  messageRow: {
    marginBottom: ms(14),
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAi: {
    justifyContent: 'flex-start',
  },
  aiAvatarSmall: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(13),
    backgroundColor: THEME_COLOR + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(8),
    marginBottom: ms(18),
  },
  messageBubble: {
    padding: ms(12),
    borderRadius: BorderRadius.lg,
  },
  messageBubbleUser: {
    backgroundColor: THEME_COLOR,
    borderBottomRightRadius: ms(4),
  },
  messageBubbleAi: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: ms(4),
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  errorBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timestamp: {
    marginTop: ms(4),
    marginLeft: ms(4),
    opacity: 0.6,
    fontSize: ms(10),
  },
  timestampUser: {
    textAlign: 'right',
    marginRight: ms(4),
  },

  // ── Footer / Input ──
  footer: {
    paddingHorizontal: ms(12),
    paddingTop: ms(10),
    paddingBottom: ms(10),
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: BG_COLOR,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: ms(14),
    paddingVertical: ms(6),
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: ms(6),
  },
  input: {
    flex: 1,
    fontSize: ms(14),
    color: Colors.textPrimary,
    maxHeight: ms(120),
    paddingTop: ms(8),
    paddingBottom: ms(8),
    lineHeight: ms(20),
  },
  sendButton: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: ms(8),
    marginBottom: ms(1),
  },
  sendButtonActive: {
    backgroundColor: THEME_COLOR,
  },
  sendButtonLoading: {
    backgroundColor: THEME_COLOR,
    opacity: 0.8,
  },
  disclaimer: {
    textAlign: 'center',
    opacity: 0.55,
    fontSize: ms(10),
    lineHeight: ms(14),
  },

  // ── History Modal ──
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: ms(16),
    paddingTop: Platform.OS === 'ios' ? ms(40) : ms(16),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(16),
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLOR,
    borderRadius: BorderRadius.md,
    padding: ms(12),
    marginBottom: ms(16),
    justifyContent: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: ms(12),
    borderRadius: BorderRadius.md,
    marginBottom: ms(8),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyItemActive: {
    borderColor: THEME_COLOR,
    backgroundColor: THEME_COLOR + '0D',
  },
  historyIconWrap: {
    width: ms(32),
    height: ms(32),
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteHistoryButton: {
    padding: ms(6),
    marginLeft: ms(8),
  },
  emptyHistory: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  divider: {
    height: 1,
    // backgroundColor: Colors.border,
    marginVertical: ms(16),
  },
});

export default AIAssistantScreen;
