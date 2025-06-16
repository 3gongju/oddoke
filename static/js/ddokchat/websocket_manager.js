// static/js/ddokchat/websocket_manager.js

let socket;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectInterval = null;
let roomId;

// 메시지 핸들러 콜백들
let messageHandlers = {};

export function setupWebSocket(chatRoomId) {
  roomId = chatRoomId;
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
  socket = new WebSocket(
    window.location.protocol === "https:"
      ? `wss://${window.location.host}/ws/chat/${roomId}/`
      : `ws://${window.location.host}/ws/chat/${roomId}/`
  );

  socket.onopen = handleOpen;
  socket.onclose = handleClose;
  socket.onmessage = handleMessage;
  socket.onerror = handleError;
}

function handleOpen() {
  console.log('WebSocket 연결 성공');
  reconnectAttempts = 0;
  
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
  
  // 채팅방 입장 알림
  sendMessage({
    'type': 'enter_chatroom',
    'room_id': roomId
  });
}

function handleClose(e) {
  console.log('WebSocket 연결 종료:', e.code, e.reason);
  
  if (reconnectAttempts < maxReconnectAttempts) {
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
  console.error('WebSocket 오류:', error);
  if (messageHandlers.showToast) {
    messageHandlers.showToast('연결 오류가 발생했습니다.', 'error');
  }
}

// 페이지 이벤트 리스너들
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && socket.readyState === WebSocket.CLOSED) {
    console.log('페이지 포커스 시 WebSocket 재연결 시도');
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
  if (socket.readyState === WebSocket.CLOSED) {
    connectWebSocket();
  }
});

window.addEventListener('offline', function() {
  if (messageHandlers.showToast) {
    messageHandlers.showToast('네트워크 연결이 끊어졌습니다.', 'error');
  }
});

export { socket };