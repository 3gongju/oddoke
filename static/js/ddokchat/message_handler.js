// static/js/ddokchat/message_handler.js

import { 
  scrollToBottom, 
  scrollToBottomAfterImageLoad, 
  registerObserver, 
  updateSensitiveInfoCards, 
  updateUIAfterTradeComplete 
} from './ui_manager.js';

let currentUser = '';
let currentUserId = '';
let chatLog;

export function setupMessageHandlers(user, userId) {
  currentUser = user;
  currentUserId = userId;
  chatLog = document.getElementById('chat-log');
}

export function handleTextMessage(data) {
  const isMine = data.sender === currentUser;
  
  const messageContainer = document.createElement("div");
<<<<<<< HEAD
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} group message-enter mb-2`;
  
  if (isMine) {
    messageContainer.innerHTML = `
      <div class="max-w-xs">
        <div class="bg-gray-900 text-white px-4 py-2 rounded-2xl rounded-br-md shadow-sm">
          <p class="text-sm break-words">${data.message}</p>
        </div>
        <div class="flex justify-end items-center gap-1 mt-1">
          ${!data.is_read ? '<span class="text-xs text-red-500 font-semibold unread-label">안읽음</span><span class="text-xs text-gray-400">•</span>' : ''}
          <span class="text-xs text-gray-400">${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
      </div>`;
  } else {
    messageContainer.innerHTML = `
      <div class="max-w-xs">
        <p class="text-sm font-semibold text-gray-800 mb-1">${data.sender}</p>
        <div class="bg-white text-gray-800 px-4 py-2 rounded-2xl rounded-bl-md shadow-sm border border-gray-200">
          <p class="text-sm break-words">${data.message}</p>
        </div>
        <div class="flex justify-start items-center gap-1 mt-1">
          <span class="text-xs text-gray-400">${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
=======
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} group message-enter mb-3`;
  
  if (isMine) {
    // 내 메시지: 시간/읽음상태가 말풍선 왼쪽에
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 시간/읽음상태 (왼쪽) -->
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        
        <!-- 말풍선 (오른쪽) -->
        <div class="max-w-xs">
          <div class="bg-gray-900 text-white px-4 py-2 rounded-2xl rounded-br-md shadow-sm">
            <p class="text-sm break-words">${data.message}</p>
          </div>
        </div>
      </div>`;
  } else {
    // 상대방 메시지: 시간/읽음상태가 말풍선 오른쪽에 (닉네임 제거)
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 말풍선 (왼쪽) -->
        <div class="max-w-xs">
          <div class="bg-white text-gray-800 px-4 py-2 rounded-2xl rounded-bl-md shadow-sm border border-gray-200">
            <p class="text-sm break-words">${data.message}</p>
          </div>
        </div>
        
        <!-- 시간 (오른쪽) -->
        <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258
        </div>
      </div>`;
  }
  
  if (chatLog) {
    chatLog.appendChild(messageContainer);
    registerObserver(messageContainer, data.sender);
    scrollToBottom();
  }
}

export function handleImageMessage(data) {
  const isMine = data.sender === currentUser;
  const messageContainer = document.createElement("div");
<<<<<<< HEAD
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} message-enter mb-2`;

  messageContainer.innerHTML = `
    <div class="max-w-xs">
      ${isMine ? '' : `<p class="text-sm font-semibold text-gray-800 mb-1">${data.sender}</p>`}
      <div class="${isMine ? 'bg-gray-900 text-white' : 'bg-white text-gray-800 border border-gray-200'} px-3 py-2 rounded-2xl shadow-sm message-image">
        <img src="${data.image_url}" alt="전송 이미지" class="w-full max-h-64 rounded-lg object-cover image-loading">
      </div>
      <div class="flex ${isMine ? 'justify-end' : 'justify-start'} items-center gap-1 mt-1">
        ${isMine && !data.is_read ? '<span class="text-xs text-red-500 font-semibold unread-label">안읽음</span><span class="text-xs text-gray-400">•</span>' : ''}
        <span class="text-xs text-gray-400">${new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })}</span>
      </div>
    </div>
  `;
=======
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} message-enter mb-3`;

  if (isMine) {
    // 내 메시지: 시간/읽음상태가 말풍선 왼쪽에
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 시간/읽음상태 (왼쪽) -->
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        
        <!-- 말풍선 (오른쪽) -->
        <div class="max-w-xs">
          <div class="bg-gray-900 text-white px-3 py-2 rounded-2xl rounded-br-md shadow-sm message-image">
            <img src="${data.image_url}" alt="전송 이미지" class="w-full max-h-64 rounded-lg object-cover image-loading">
          </div>
        </div>
      </div>`;
  } else {
    // 상대방 메시지: 시간/읽음상태가 말풍선 오른쪽에 (닉네임 제거)
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 말풍선 (왼쪽) -->
        <div class="max-w-xs">
          <div class="bg-white text-gray-800 border border-gray-200 px-3 py-2 rounded-2xl rounded-bl-md shadow-sm message-image">
            <img src="${data.image_url}" alt="전송 이미지" class="w-full max-h-64 rounded-lg object-cover image-loading">
          </div>
        </div>
        
        <!-- 시간 (오른쪽) -->
        <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
      </div>`;
  }
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258

  if (chatLog) {
    chatLog.appendChild(messageContainer);
    registerObserver(messageContainer, data.sender);
    
    // 이미지 로딩 처리
    const imgElement = messageContainer.querySelector('img');
    if (imgElement) {
      imgElement.style.opacity = '0.7';
      
      imgElement.onload = function() {
        this.style.opacity = '1';
        this.classList.remove('image-loading');
        scrollToBottom();
      };
      
      imgElement.onerror = function() {
        this.style.opacity = '1';
        this.classList.remove('image-loading');
        scrollToBottom();
      };
      
      if (imgElement.complete) {
        imgElement.style.opacity = '1';
        imgElement.classList.remove('image-loading');
        scrollToBottom();
      }
      
      setTimeout(() => {
        imgElement.style.opacity = '1';
        imgElement.classList.remove('image-loading');
        scrollToBottom();
      }, 3000);
    } else {
      scrollToBottom();
    }
  }
}

export function handleAccountMessage(data) {
  const accountInfo = data.account_info;
<<<<<<< HEAD
  const isMineForPosition = data.sender === currentUser;
  const isMineForButton = data.sender === currentUser;
  
  const messageContainer = document.createElement("div");
  messageContainer.className = `flex ${isMineForPosition ? 'justify-end' : 'justify-start'} message-enter mb-2`;

  let buttonsHtml = '';
  if (!isMineForButton && !accountInfo.is_deleted) {
=======
  const isMine = data.sender === currentUser;
  
  const messageContainer = document.createElement("div");
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} message-enter mb-3`;

  let buttonsHtml = '';
  if (!isMine && !accountInfo.is_deleted) {
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258
    buttonsHtml = `
      <div class="flex space-x-2 mt-3">
        <button onclick="copyAccountNumber('${accountInfo.account_number}')" 
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg transition-colors action-button">
          계좌번호 복사
        </button>
        <button onclick="checkFraudHistory('${accountInfo.bank_code || ''}', '${accountInfo.account_number}', '${accountInfo.account_holder}')" 
                class="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-2 rounded-lg transition-colors action-button">
          신고이력 조회
        </button>
      </div>
    `;
  }

  let contentHtml = '';
  if (accountInfo.is_deleted) {
    contentHtml = `
<<<<<<< HEAD
      <div class="bg-${isMineForPosition ? 'gray-800' : 'gray-100'} rounded-lg p-4 text-center">
        <p class="text-sm ${isMineForPosition ? 'text-gray-300' : 'text-gray-600'} font-medium">계좌정보가 삭제되었습니다</p>
        <p class="text-xs ${isMineForPosition ? 'text-gray-400' : 'text-gray-500'} mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
=======
      <div class="bg-${isMine ? 'gray-800' : 'gray-100'} rounded-lg p-4 text-center">
        <p class="text-sm ${isMine ? 'text-gray-300' : 'text-gray-600'} font-medium">계좌정보가 삭제되었습니다</p>
        <p class="text-xs ${isMine ? 'text-gray-400' : 'text-gray-500'} mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258
      </div>
    `;
  } else {
    contentHtml = `
<<<<<<< HEAD
      <div class="bg-${isMineForPosition ? 'gray-800' : 'gray-50'} rounded-lg p-3 space-y-2 info-card">
        <div class="flex justify-between">
          <span class="text-sm ${isMineForPosition ? 'text-gray-300' : 'text-gray-600'}">은행</span>
          <span class="font-medium">${accountInfo.bank_name}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm ${isMineForPosition ? 'text-gray-300' : 'text-gray-600'}">계좌번호</span>
          <span class="font-mono">${accountInfo.account_number}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm ${isMineForPosition ? 'text-gray-300' : 'text-gray-600'}">예금주</span>
          <span class="font-medium">${accountInfo.account_holder}</span>
=======
      <div class="bg-${isMine ? 'gray-800' : 'gray-50'} rounded-lg p-${isMine ? '4' : '3'} space-y-2 info-card ${isMine ? 'min-w-[220px]' : ''}">
        <div class="flex justify-between">
          <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">은행</span>
          <span class="text-sm">${accountInfo.bank_name}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">계좌번호</span>
          <span class="text-sm">${accountInfo.account_number}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">예금주</span>
          <span class="text-sm">${accountInfo.account_holder}</span>
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258
        </div>
      </div>
      ${buttonsHtml}
    `;
  }

<<<<<<< HEAD
  const fullHTML = `
    <div class="max-w-xs">
      ${isMineForPosition ? '' : `<p class="text-sm font-semibold text-gray-800 mb-1">${data.sender}</p>`}
      <div class="${isMineForPosition ? 'bg-gray-900 text-white' : 'bg-white text-gray-800 border border-gray-200'} px-4 py-3 rounded-2xl shadow-sm">
        <div class="space-y-3">
          <div class="flex items-center space-x-2 mb-2">
            <span class="text-lg">💳</span>
            <span class="font-semibold">${isMineForPosition ? '계좌정보 전송' : '계좌정보'}</span>
          </div>
          ${contentHtml}
        </div>
      </div>
      <div class="flex ${isMineForPosition ? 'justify-end' : 'justify-start'} items-center gap-1 mt-1">
        ${isMineForPosition && !data.is_read ? '<span class="text-xs text-red-500 font-semibold unread-label">안읽음</span><span class="text-xs text-gray-400">•</span>' : ''}
        <span class="text-xs text-gray-400">${new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })}</span>
      </div>
    </div>
  `;
  
  messageContainer.innerHTML = fullHTML;
=======
  // Heroicons Credit Card Icon SVG
  const creditCardIcon = `
    <svg class="w-4 h-4 ${isMine ? 'text-white' : 'text-blue-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"></path>
    </svg>
  `;

  if (isMine) {
    // 내 메시지: 시간/읽음상태가 말풍선 왼쪽에
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 시간/읽음상태 (왼쪽) -->
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        
        <!-- 말풍선 (오른쪽) -->
        <div class="max-w-sm">
          <div class="bg-gray-900 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-sm">
            <div class="space-y-3">
              <div class="flex items-center space-x-2 mb-2">
                ${creditCardIcon}
                <span class="text-sm">계좌정보 전송</span>
              </div>
              ${contentHtml}
            </div>
          </div>
        </div>
      </div>`;
  } else {
    // 상대방 메시지: 시간/읽음상태가 말풍선 오른쪽에 (닉네임 제거)
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 말풍선 (왼쪽) -->
        <div class="max-w-sm">
          <div class="bg-white text-gray-800 border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
            <div class="space-y-3">
              <div class="flex items-center space-x-2 mb-2">
                ${creditCardIcon}
                <span class="text-sm">계좌정보</span>
              </div>
              ${contentHtml}
            </div>
          </div>
        </div>
        
        <!-- 시간 (오른쪽) -->
        <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
      </div>`;
  }
  
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258
  if (chatLog) {
    chatLog.appendChild(messageContainer);
    registerObserver(messageContainer, data.sender);
    scrollToBottom();
  }
}

export function handleAddressMessage(data) {
  const addressInfo = data.address_info;
<<<<<<< HEAD
  const isMineForPosition = data.sender === currentUser;
  const isMineForButton = data.sender === currentUser;
  
  const messageContainer = document.createElement("div");
  messageContainer.className = `flex ${isMineForPosition ? 'justify-end' : 'justify-start'} message-enter mb-2`;

  let buttonsHtml = '';
  if (!isMineForButton && !addressInfo.is_deleted) {
=======
  const isMine = data.sender === currentUser;
  
  const messageContainer = document.createElement("div");
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} message-enter mb-3`;

  let buttonsHtml = '';
  if (!isMine && !addressInfo.is_deleted) {
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258
    buttonsHtml = `
      <div class="flex space-x-2 mt-3">
        <button onclick="copyDeliveryInfo('${addressInfo.phone_number}', '${addressInfo.full_address}')" 
                class="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-2 rounded-lg transition-colors action-button">
          배송정보 복사
        </button>
        <button onclick="copyPhoneNumber('${addressInfo.phone_number}')" 
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg transition-colors action-button">
          연락처 복사
        </button>
      </div>
    `;
  }

  let contentHtml = '';
  if (addressInfo.is_deleted) {
    contentHtml = `
<<<<<<< HEAD
      <div class="bg-${isMineForPosition ? 'gray-800' : 'gray-100'} rounded-lg p-4 text-center">
        <p class="text-sm ${isMineForPosition ? 'text-gray-300' : 'text-gray-600'} font-medium">배송정보가 삭제되었습니다</p>
        <p class="text-xs ${isMineForPosition ? 'text-gray-400' : 'text-gray-500'} mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
=======
      <div class="bg-${isMine ? 'gray-800' : 'gray-100'} rounded-lg p-4 text-center">
        <p class="text-sm ${isMine ? 'text-gray-300' : 'text-gray-600'} font-medium">배송정보가 삭제되었습니다</p>
        <p class="text-xs ${isMine ? 'text-gray-400' : 'text-gray-500'} mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258
      </div>
    `;
  } else {
    contentHtml = `
<<<<<<< HEAD
      <div class="bg-${isMineForPosition ? 'gray-800' : 'gray-50'} rounded-lg p-3 space-y-2 info-card">
        <div class="flex justify-between">
          <span class="text-sm ${isMineForPosition ? 'text-gray-300' : 'text-gray-600'}">연락처</span>
          <span class="font-mono">${addressInfo.phone_number}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm ${isMineForPosition ? 'text-gray-300' : 'text-gray-600'}">우편번호</span>
          <span class="font-medium">${addressInfo.postal_code}</span>
        </div>
        <div>
          <span class="text-sm ${isMineForPosition ? 'text-gray-300' : 'text-gray-600'}">배송주소</span>
          <p class="font-medium mt-1">${addressInfo.full_address}</p>
=======
      <div class="bg-${isMine ? 'gray-800' : 'gray-50'} rounded-lg p-${isMine ? '4' : '3'} space-y-2 info-card ${isMine ? 'min-w-[220px]' : ''}">
        <div class="flex justify-between">
          <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">연락처</span>
          <span class="text-sm">${addressInfo.phone_number}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">우편번호</span>
          <span class="text-sm">${addressInfo.postal_code}</span>
        </div>
        <div>
          <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">배송주소</span>
          <p class="text-sm mt-1">${addressInfo.full_address}</p>
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258
        </div>
      </div>
      ${buttonsHtml}
    `;
  }

<<<<<<< HEAD
  const fullHTML = `
    <div class="max-w-xs">
      ${isMineForPosition ? '' : `<p class="text-sm font-semibold text-gray-800 mb-1">${data.sender}</p>`}
      <div class="${isMineForPosition ? 'bg-gray-900 text-white' : 'bg-white text-gray-800 border border-gray-200'} px-4 py-3 rounded-2xl shadow-sm">
        <div class="space-y-3">
          <div class="flex items-center space-x-2 mb-2">
            <span class="text-lg">📦</span>
            <span class="font-semibold">${isMineForPosition ? '배송정보 전송' : '배송정보'}</span>
          </div>
          ${contentHtml}
        </div>
      </div>
      <div class="flex ${isMineForPosition ? 'justify-end' : 'justify-start'} items-center gap-1 mt-1">
        ${isMineForPosition && !data.is_read ? '<span class="text-xs text-red-500 font-semibold unread-label">안읽음</span><span class="text-xs text-gray-400">•</span>' : ''}
        <span class="text-xs text-gray-400">${new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })}</span>
      </div>
    </div>
  `;
  
  messageContainer.innerHTML = fullHTML;
=======
  // Heroicons Map Pin Icon SVG
  const mapPinIcon = `
    <svg class="w-4 h-4 ${isMine ? 'text-white' : 'text-green-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z"></path>
    </svg>
  `;

  if (isMine) {
    // 내 메시지: 시간/읽음상태가 말풍선 왼쪽에
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 시간/읽음상태 (왼쪽) -->
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        
        <!-- 말풍선 (오른쪽) -->
        <div class="max-w-sm">
          <div class="bg-gray-900 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-sm">
            <div class="space-y-3">
              <div class="flex items-center space-x-2 mb-2">
                ${mapPinIcon}
                <span class="text-sm">배송정보 전송</span>
              </div>
              ${contentHtml}
            </div>
          </div>
        </div>
      </div>`;
  } else {
    // 상대방 메시지: 시간/읽음상태가 말풍선 오른쪽에 (닉네임 제거)
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 말풍선 (왼쪽) -->
        <div class="max-w-sm">
          <div class="bg-white text-gray-800 border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
            <div class="space-y-3">
              <div class="flex items-center space-x-2 mb-2">
                ${mapPinIcon}
                <span class="text-sm">배송정보</span>
              </div>
              ${contentHtml}
            </div>
          </div>
        </div>
        
        <!-- 시간 (오른쪽) -->
        <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
      </div>`;
  }
  
>>>>>>> 4611217bbc1c039e53f8c8a5b69959cd13d99258
  if (chatLog) {
    chatLog.appendChild(messageContainer);
    registerObserver(messageContainer, data.sender);
    scrollToBottom();
  }
}

// 읽음 처리 관련 핸들러들
export function handleReadUpdate(data) {
  document.querySelectorAll(".unread-label").forEach(el => el.remove());
}

export function handleReadMessageSyncFinish(data) {
  document.querySelectorAll(".unread-label").forEach(el => el.remove());
}

export function handleEnterChatroomFinish(data) {
  const currentUser = window.currentUser || '';
  if (data.reader !== currentUser) {
    document.querySelectorAll(".unread-label").forEach(el => el.remove());
  }
}

export function handleTradeCompleted(data) {
  console.log('거래 완료 알림 수신');
  updateSensitiveInfoCards();
  updateUIAfterTradeComplete(true);
}