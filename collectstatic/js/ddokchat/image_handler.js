// static/js/ddokchat/image_handler.js

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

// 이미지 업로드 처리
export function handleImageUpload(file) {
  if (!file) return;
  
  if (!checkTradeCompletedBeforeSend()) {
    return;
  }

  // 파일 크기 체크 (10MB 제한)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('파일 크기가 10MB를 초과합니다.', 'error');
    return;
  }

  // 파일 타입 체크
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('지원하지 않는 파일 형식입니다. (JPEG, PNG, GIF, WebP만 가능)', 'error');
    return;
  }

  const loadingToast = showLoadingToast('이미지 업로드 중...');

  // EXIF 데이터 추출
  extractExifData(file, function(exifData) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('room_id', window.roomId);
    
    if (exifData && exifData.taken_datetime) {
      formData.append('taken_datetime', exifData.taken_datetime);
    }

    const csrfToken = getCSRFToken();
    if (!csrfToken) {
      hideLoadingToast(loadingToast);
      showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
      return;
    }

    fetch("/ddokchat/upload_image/", {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
      },
      body: formData,
    })
    .then(response => response.json())
    .then(data => {
      hideLoadingToast(loadingToast);
      
      if (data.success) {
        sendMessage({
          type: 'chat_image',
          room_code: window.roomCode,
          image_url: data.image_url,
          sender_id: window.currentUserId,
          message_id: data.message_id,
          taken_datetime: exifData ? exifData.taken_datetime : null
        });
        showToast('이미지가 전송되었습니다.', 'success');
      } else {
        showToast('이미지 업로드 실패: ' + (data.error || ''), 'error');
      }
    })
    .catch(error => {
      hideLoadingToast(loadingToast);
      console.error('이미지 업로드 오류:', error);
      showToast('이미지 업로드 중 오류가 발생했습니다.', 'error');
    });
  });
}

// EXIF 데이터 추출 함수
function extractExifData(file, callback) {
  if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
    callback(null);
    return;
  }

  const img = new Image();
  const url = URL.createObjectURL(file);
  
  img.onload = function() {
    EXIF.getData(img, function() {
      try {
        const dateTimeOriginal = EXIF.getTag(this, "DateTimeOriginal");
        
        let takenDatetime = null;
        
        if (dateTimeOriginal) {
          const formattedDate = dateTimeOriginal.replace(/:/g, '-').replace(' ', 'T');
          const date = new Date(formattedDate);
          
          if (!isNaN(date.getTime())) {
            takenDatetime = date.toISOString();
          }
        }
        
        URL.revokeObjectURL(url);
        
        callback({
          taken_datetime: takenDatetime
        });
        
      } catch (error) {
        console.error('EXIF 데이터 추출 오류:', error);
        URL.revokeObjectURL(url);
        callback(null);
      }
    });
  };
  
  img.onerror = function() {
    console.error('이미지 로딩 실패');
    URL.revokeObjectURL(url);
    callback(null);
  };
  
  img.src = url;
}

// 이미지 라이트박스 설정
export function setupImageLightbox() {
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const closeLightboxBtn = document.getElementById('closeLightbox');
  const lightboxInfo = document.getElementById('lightboxInfo');
  const lightboxLoading = document.getElementById('lightboxLoading');
  const zoomControls = document.getElementById('zoomControls');

  let currentScale = 1;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let translateX = 0;
  let translateY = 0;

  // 촬영시간 포맷팅 함수
  function formatTakenDateTime(takenDatetime) {
    if (!takenDatetime) return null;
    
    try {
      const date = new Date(takenDatetime);
      if (isNaN(date.getTime())) return null;
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}.${month}.${day} ${hours}:${minutes}`;
    } catch (error) {
      console.error('날짜 포맷팅 오류:', error);
      return null;
    }
  }

  // 확대/축소 적용 함수
  function applyTransform() {
    if (lightboxImage) {
      lightboxImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
      lightboxImage.style.cursor = currentScale > 1 ? 'grab' : 'default';
      updateZoomIcon();
    }
  }

  // 줌 아이콘 업데이트
  function updateZoomIcon() {
    const zoomIcon = document.getElementById('zoomIcon');
    if (zoomIcon) {
      if (currentScale > 1) {
        zoomIcon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6" />
        `;
      } else {
        zoomIcon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
        `;
      }
    }
  }

  // 줌 레벨 조정
  function setZoom(scale, centerX = 0, centerY = 0) {
    const prevScale = currentScale;
    currentScale = Math.min(Math.max(scale, 0.5), 3);
    
    if (prevScale !== currentScale) {
      const scaleChange = currentScale / prevScale;
      translateX = centerX + (translateX - centerX) * scaleChange;
      translateY = centerY + (translateY - centerY) * scaleChange;
    }
    
    applyTransform();
  }

  // 위치 리셋
  function resetPosition() {
    currentScale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  // 라이트박스 열기 함수
  function openLightbox(imageSrc, imageAlt = '', takenDatetime = null) {
    if (lightbox && lightboxImage) {
      resetPosition();
      
      if (lightboxLoading) {
        lightboxLoading.classList.remove('hidden');
      }
      
      lightboxImage.style.opacity = '0';
      lightboxImage.src = imageSrc;
      lightboxImage.alt = imageAlt;
      
      if (lightboxInfo) {
        const formattedDate = formatTakenDateTime(takenDatetime);
        if (formattedDate) {
          lightboxInfo.innerHTML = `
            <div class="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
                <path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clip-rule="evenodd" />
              </svg>
              <span>${formattedDate} 촬영</span>
            </div>
          `;
          lightboxInfo.classList.remove('hidden');
        } else {
          lightboxInfo.classList.add('hidden');
        }
      }
      
      if (zoomControls && window.innerWidth >= 768) {
        zoomControls.classList.remove('hidden');
      }
      
      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      
      lightboxImage.onload = function() {
        this.style.opacity = '1';
        if (lightboxLoading) {
          lightboxLoading.classList.add('hidden');
        }
        updateZoomIcon();
      };
    }
  }

  // 라이트박스 닫기 함수
  function closeLightbox() {
    if (lightbox) {
      lightbox.classList.add('hidden');
      document.body.style.overflow = '';
      
      if (lightboxImage) {
        lightboxImage.src = '';
      }
      
      if (lightboxInfo) {
        lightboxInfo.innerHTML = '';
        lightboxInfo.classList.add('hidden');
      }
      
      if (zoomControls) {
        zoomControls.classList.add('hidden');
      }
      
      resetPosition();
    }
  }

  // 이벤트 리스너 설정
  if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener('click', closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  });

  // 데스크탑 전용 이벤트
  if (lightboxImage) {
    // 마우스 휠 줌
    lightboxImage.addEventListener('wheel', function(e) {
      if (window.innerWidth >= 768) {
        e.preventDefault();
        const rect = this.getBoundingClientRect();
        const centerX = e.clientX - rect.left - rect.width / 2;
        const centerY = e.clientY - rect.top - rect.height / 2;
        
        const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
        setZoom(currentScale * zoomFactor, centerX, centerY);
      }
    });

    // 더블클릭으로 줌 토글
    lightboxImage.addEventListener('dblclick', function(e) {
      if (window.innerWidth >= 768) {
        e.preventDefault();
        if (currentScale > 1) {
          resetPosition();
        } else {
          const rect = this.getBoundingClientRect();
          const centerX = e.clientX - rect.left - rect.width / 2;
          const centerY = e.clientY - rect.top - rect.height / 2;
          setZoom(2, centerX, centerY);
        }
      }
    });

    // 드래그 기능
    lightboxImage.addEventListener('mousedown', function(e) {
      if (currentScale > 1 && window.innerWidth >= 768) {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        this.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', function(e) {
      if (isDragging && currentScale > 1) {
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
      }
    });

    document.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        if (lightboxImage) {
          lightboxImage.style.cursor = currentScale > 1 ? 'grab' : 'default';
        }
      }
    });

    // 모바일 터치 이벤트
    let initialDistance = 0;
    let initialScale = 1;

    lightboxImage.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialDistance = getDistance(e.touches[0], e.touches[1]);
        initialScale = currentScale;
      } else if (e.touches.length === 1 && currentScale > 1) {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX - translateX;
        startY = touch.clientY - translateY;
      }
    });

    lightboxImage.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = (currentDistance / initialDistance) * initialScale;
        setZoom(scale);
      } else if (e.touches.length === 1 && isDragging && currentScale > 1) {
        e.preventDefault();
        const touch = e.touches[0];
        translateX = touch.clientX - startX;
        translateY = touch.clientY - startY;
        applyTransform();
      }
    });

    lightboxImage.addEventListener('touchend', function(e) {
      if (e.touches.length === 0) {
        isDragging = false;
      }
    });

    function getDistance(touch1, touch2) {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }

  // 줌 컨트롤 버튼 이벤트
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const resetBtn = document.getElementById('resetBtn');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', function() {
      setZoom(currentScale * 1.3);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', function() {
      setZoom(currentScale * 0.7);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      resetPosition();
    });
  }

  // 이미지 클릭 이벤트 추가 함수
  function addImageClickEvents() {
    const chatImages = document.querySelectorAll('#chat-log img');
    chatImages.forEach(img => {
      if (!img.hasAttribute('data-lightbox-enabled')) {
        img.style.cursor = 'pointer';
        img.setAttribute('title', '클릭하여 확대');
        
        img.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const takenDatetime = this.getAttribute('data-taken-datetime');
          openLightbox(this.src, this.alt || '채팅 이미지', takenDatetime);
        });
        
        img.addEventListener('mouseenter', function() {
          this.style.transform = 'scale(1.02)';
          this.style.transition = 'transform 0.2s ease';
        });
        
        img.addEventListener('mouseleave', function() {
          this.style.transform = 'scale(1)';
        });
        
        img.setAttribute('data-lightbox-enabled', 'true');
      }
    });
  }

  // 초기 이미지들에 이벤트 추가
  addImageClickEvents();

  // MutationObserver로 새로 추가되는 이미지들 감지
  const chatLog = document.getElementById('chat-log');
  if (chatLog) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          setTimeout(() => {
            addImageClickEvents();
          }, 100);
        }
      });
    });

    observer.observe(chatLog, {
      childList: true,
      subtree: true
    });
  }

  // 전역 함수로 노출
  window.openImageLightbox = openLightbox;
  window.closeImageLightbox = closeLightbox;
}