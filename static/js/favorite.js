// 매우 간단한 찜하기 시스템 - 팝업 완전 제거
let isSubmitting = false;

document.addEventListener('DOMContentLoaded', function () {
  console.log('찜하기 시스템 초기화');
  
  // 이벤트 위임으로 찜하기 버튼 처리
  document.addEventListener('click', function (e) {
    const favoriteBtn = e.target.closest('[data-favorite-btn]');
    if (!favoriteBtn || isSubmitting) return;

    e.preventDefault();
    e.stopPropagation();
    
    toggleFavorite(favoriteBtn);
  });
});

async function toggleFavorite(btn) {
  if (isSubmitting) return;
  
  isSubmitting = true;
  
  const cafeId = btn.dataset.cafeId;
  const csrfToken = document.querySelector('meta[name=csrf-token]')?.getAttribute('content');

  if (!csrfToken) {
    console.error('CSRF 토큰이 없습니다');
    isSubmitting = false;
    return;
  }

  // UI 즉시 업데이트
  const currentIsFav = btn.innerHTML.trim() === '♥';
  const newIsFav = !currentIsFav;
  
  btn.innerHTML = '⏳';
  btn.disabled = true;

  try {
    const response = await fetch(`/ddoksang/toggle_favorite/${cafeId}/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin'
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('Server response:', data);

    if (data.success) {
      // 성공 - 모든 같은 카페의 버튼 업데이트
      updateAllFavoriteButtons(cafeId, data.is_favorited);
      
      // 조용한 성공 표시 (콘솔만)
      console.log(`✅ ${data.message}`);
      
    } else {
      // 서버에서 실패 응답
      console.error('서버 오류:', data.error);
      btn.innerHTML = currentIsFav ? '♥' : '♡';
      btn.style.color = currentIsFav ? '#ef4444' : '#6b7280';
    }

  } catch (error) {
    // 네트워크 오류
    console.error('네트워크 오류:', error);
    btn.innerHTML = currentIsFav ? '♥' : '♡';
    btn.style.color = currentIsFav ? '#ef4444' : '#6b7280';
    
  } finally {
    btn.disabled = false;
    isSubmitting = false;
  }
}

function updateAllFavoriteButtons(cafeId, isFavorited) {
  const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
  
  buttons.forEach((btn) => {
    btn.innerHTML = isFavorited ? '♥' : '♡';
    btn.style.color = isFavorited ? '#ef4444' : '#6b7280';
    btn.title = isFavorited ? '찜 해제' : '찜하기';
  });
  
  console.log(`${buttons.length}개 버튼 업데이트 완료`);
}