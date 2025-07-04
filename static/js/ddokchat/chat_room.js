// static/js/ddokchat/chat_room.js - 메인 초기화 파일 수정

import { setupWebSocket, registerMessageHandler, sendMessage } from './websocket_manager.js';
import { setupTradeCancel } from './trade_cancel.js';
import { 
  setupMessageHandlers, 
  handleTextMessage, 
  handleImageMessage, 
  handleBankMessage, 
  handleAddressMessage,
  handleReadUpdate,
  handleReadMessageSyncFinish,
  handleEnterChatroomFinish,
  handleTradeCompleted,
  handleTradeProgressNotification, // 🔥 NEW: 추가
  handleTradeCancelNotification,
  handleTradeStatusUpdate
} from './message_handler.js';
import { 
  setupUIManager, 
  showToast
} from './ui_manager.js';
import { setupFraudCheck } from './fraud_check.js';
import { setupAutoDetect } from './auto_detect.js';
import { setupImageLightbox } from './image_handler.js';
import { setupPlusMenu, setupTradeCompleteModal, setupHeaderMenu } from './ui_setup.js';import { sendTextMessage } from './message_sender.js';
import { setupTradeReport } from './trade_report.js';

document.addEventListener("DOMContentLoaded", () => {
  // 전역 변수에서 데이터 가져오기
  const roomCode = window.roomCode;
  const currentUser = window.currentUser;
  const currentUserId = window.currentUserId;
  const isTradeCompleted = window.isTradeCompleted;

  // 각 모듈 초기화
  setupUIManager(isTradeCompleted);
  setupMessageHandlers(currentUser, currentUserId);
  setupFraudCheck();
  setupAutoDetect();
  setupTradeReport();
  setupTradeCancel();
  
  // WebSocket 메시지 핸들러 등록
  registerMessageHandler('showToast', showToast);
  registerMessageHandler('chat_message', handleTextMessage);
  registerMessageHandler('chat_image', handleImageMessage);
  registerMessageHandler('bank_info', handleBankMessage);
  registerMessageHandler('address_info', handleAddressMessage);
  registerMessageHandler('read_update', handleReadUpdate);
  registerMessageHandler('read_message_sync_finish', handleReadMessageSyncFinish);
  registerMessageHandler('enter_chatroom_finish', handleEnterChatroomFinish);
  registerMessageHandler('trade_completed', handleTradeCompleted);
  registerMessageHandler('trade_progress_notification', handleTradeProgressNotification); // 🔥 NEW
  registerMessageHandler('trade_cancel_notification', handleTradeCancelNotification);
  registerMessageHandler('trade_status_update', handleTradeStatusUpdate);
  
  // WebSocket 연결
  setupWebSocket(roomCode);
  
  // 전역 함수로 노출
  window.sendWebSocketMessage = sendMessage;
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // UI 컴포넌트 설정
  setupUIComponents();
  
  // 🔥 REMOVED: 리뷰 모달 체크 제거 (이제 WebSocket으로 처리)
  // setTimeout(() => {
  //   setupReviewModal();
  // }, 500);
});

function setupEventListeners() {
  const input = document.getElementById('chat-message-input');
  const submit = document.getElementById('chat-message-submit');
  
  // 메시지 전송
  if (submit) {
    submit.onclick = sendTextMessage;
  }

  // 엔터키 전송
  if (input) {
    input.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        sendTextMessage();
      }
    });
    
    // 입력창 포커스
    input.focus();
  }
}

function setupUIComponents() {
  // 플러스 메뉴 설정
  setupPlusMenu();
  
  // 거래 완료 모달 설정
  setupTradeCompleteModal();
  
  // 헤더 메뉴 설정 (신고 기능 포함)
  setupHeaderMenu();
  
  // 이미지 라이트박스 설정
  setupImageLightbox();
}