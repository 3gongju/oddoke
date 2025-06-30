// static/js/ddokchat/websocket_manager.js

let socket;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectInterval = null;
let roomCode;

// 메시지 핸들러 콜백들
let messageHandlers = {};

export function setupWebSocket(chatRoomCode) {
  // roomCode 검증
  if (!chatRoomCode || chatRoomCode === 'undefined' || chatRoomCode === '' || chatRoomCode === 'null') {
    // 전역 변수에서 다시 시도
    const fallbackRoomCode = window.roomCode || window.room_code;
    if (fallbackRoomCode && fallbackRoomCode !== 'undefined' && fallbackRoomCode !== '') {
      roomCode = fallbackRoomCode;
    } else {
      if (messageHandlers.showToast) {
        messageHandlers.showToast('채팅방 정보를 불러올 수 없습니다. 페이지를 새로고침해주세요.', 'error');
      }
      return;
    }
  } else {
    roomCode = chatRoomCode;
  }
  
  connectWebSocket();
}

export function registerMessageHandler(type, handler) {
  messageHandlers[type] = handler;
}

export function sendMessage(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  } else {
    console.error('WebSocket이 연결되어 있지 않습니다.');
  }
}

export function getSocketState() {
  return socket ? socket.readyState : WebSocket.CLOSED;
}

function connectWebSocket() {
  // 최종 검증
  if (!roomCode || roomCode === 'undefined') {
    return;
  }
  
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/chat/${roomCode}/`;
  
  try {
    socket = new WebSocket(wsUrl);
    socket.onopen = handleOpen;
    socket.onclose = handleClose;
    socket.onmessage = handleMessage;
    socket.onerror = handleError;
  } catch (error) {
    if (messageHandlers.showToast) {
      messageHandlers.showToast('채팅 연결에 실패했습니다.', 'error');
    }
  }
}

function handleOpen() {
  reconnectAttempts = 0;
  
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
  
  // 채팅방 입장 알림
  sendMessage({
    'type': 'enter_chatroom',
    'room_code': roomCode
  });
}

function handleClose(e) {
  if (reconnectAttempts < maxReconnectAttempts && roomCode && roomCode !== 'undefined') {
    reconnectAttempts++;
    
    // UI 업데이트 콜백 호출
    if (messageHandlers.showToast) {
      messageHandlers.showToast(
        `연결이 끊어졌습니다. 재연결 시도 중... (${reconnectAttempts}/${maxReconnectAttempts})`, 
        'error'
      );
    }
    
    setTimeout(() => {
      try {
        connectWebSocket();
      } catch (error) {
        console.error('재연결 실패:', error);
      }
    }, 1000 * reconnectAttempts);
  } else {
    if (messageHandlers.showToast) {
      messageHandlers.showToast('서버 연결에 실패했습니다. 페이지를 새로고침해주세요.', 'error');
    }
  }
}

function handleMessage(e) {
  try {
    const data = JSON.parse(e.data);
    
    // 등록된 핸들러가 있으면 호출
    if (messageHandlers[data.type]) {
      messageHandlers[data.type](data);
    } else {
      console.warn('처리되지 않은 메시지 타입:', data.type);
    }
  } catch (error) {
    console.error('메시지 파싱 오류:', error);
  }
}

function handleError(error) {
  if (messageHandlers.showToast) {
    messageHandlers.showToast('연결 오류가 발생했습니다.', 'error');
  }
}

// 페이지 이벤트 리스너들
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && socket && socket.readyState === WebSocket.CLOSED && roomCode) {
    connectWebSocket();
  }
});

window.addEventListener('beforeunload', function() {
  if (socket) {
    socket.close();
  }
});

window.addEventListener('online', function() {
  if (messageHandlers.showToast) {
    messageHandlers.showToast('네트워크가 연결되었습니다.', 'success');
  }
  if (socket && socket.readyState === WebSocket.CLOSED && roomCode) {
    connectWebSocket();
  }
});

window.addEventListener('offline', function() {
  if (messageHandlers.showToast) {
    messageHandlers.showToast('네트워크 연결이 끊어졌습니다.', 'error');
  }
});

export { socket };