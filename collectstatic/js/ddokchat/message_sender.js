// static/js/ddokchat/message_sender.js

import { showToast, showLoadingToast, hideLoadingToast, checkTradeCompletedBeforeSend } from './ui_manager.js';
import { sendMessage } from './websocket_manager.js';

// CSRF 토큰 가져오는 함수
function getCSRFToken() {
  if (window.csrfToken) {
    return window.csrfToken;
  }
  
  const metaToken = document.querySelector('meta[name="csrf-token"]');
  if (metaToken && metaToken.content) {
    return metaToken.content;
  }
  
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken' && value) {
      return decodeURIComponent(value);
    }
  }
  
  const hiddenInput = document.querySelector('[name=csrfmiddlewaretoken]');
  if (hiddenInput && hiddenInput.value) {
    return hiddenInput.value;
  }
  
  console.error('CSRF 토큰을 찾을 수 없습니다!');
  return null;
}

// 텍스트 메시지 전송
export function sendTextMessage() {
  if (!checkTradeCompletedBeforeSend()) return;

  const input = document.getElementById('chat-message-input');
  const message = input.value.trim();
  
  if (message) {
    sendMessage({ 
      'room_code': window.roomCode,
      'message': message
    });
    input.value = '';
  }
}

// 계좌정보 전송
export function sendBankInfo() {
  if (!checkTradeCompletedBeforeSend()) return;

  const loadingToast = showLoadingToast('계좌정보 전송 중...');
  
  const csrfToken = getCSRFToken();
  if (!csrfToken) {
    hideLoadingToast(loadingToast);
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }

  fetch(`/ddokchat/send-bank/${window.roomCode}/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    },
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    hideLoadingToast(loadingToast);
    
    if (data.success) {
      sendMessage({
        type: 'bank_info',
        room_code: window.roomCode,
        bank_info: data.bank_info,
        sender_id: window.currentUserId,
        message_id: data.message_id
      });
      showToast('계좌정보가 전송되었습니다.', 'success');
    } else {
      if (data.redirect_to_mypage) {
        if (confirm('계좌 정보를 먼저 등록해주세요. 마이페이지로 이동하시겠습니까?')) {
          window.location.href = '/banks/mypage/';
        }
      } else {
        showToast(data.error || '계좌정보 전송에 실패했습니다.', 'error');
      }
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('Fetch 오류:', error);
    showToast('계좌정보 전송 중 오류가 발생했습니다.', 'error');
  });
}

// 주소정보 전송
export function sendAddressInfo() {
  if (!checkTradeCompletedBeforeSend()) return;

  const loadingToast = showLoadingToast('주소정보 전송 중...');
  
  const csrfToken = getCSRFToken();
  if (!csrfToken) {
    hideLoadingToast(loadingToast);
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }

  fetch(`/ddokchat/send-address/${window.roomCode}/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    },
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    hideLoadingToast(loadingToast);
    
    if (data.success) {
      sendMessage({
        type: 'address_info',
        room_code: window.roomCode,
        address_info: data.address_info,
        sender_id: window.currentUserId,
        message_id: data.message_id
      });
      showToast('주소정보가 전송되었습니다.', 'success');
    } else {
      if (data.redirect_to_mypage) {
        if (confirm('주소 정보를 먼저 등록해주세요. 마이페이지로 이동하시겠습니까?')) {
          window.location.href = '/accounts/mypage/';
        }
      } else {
        showToast(data.error || '주소정보 전송에 실패했습니다.', 'error');
      }
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('Fetch 오류:', error);
    showToast('주소정보 전송 중 오류가 발생했습니다.', 'error');
  });
}