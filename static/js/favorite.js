let isSubmitting = false;

document.addEventListener('DOMContentLoaded', function () {
  document.addEventListener('click', function (e) {
    const favoriteBtn = e.target.closest('[data-favorite-btn]');
    if (!favoriteBtn || isSubmitting) return;

    e.preventDefault();
    isSubmitting = true;

    const cafeId = favoriteBtn.dataset.cafeId;
    const csrfToken =
      document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
      document.querySelector('meta[name=csrf-token]')?.getAttribute('content');

    if (!csrfToken) {
      console.error('CSRF 토큰을 찾을 수 없습니다.');
      isSubmitting = false;
      return;
    }

    const originalContent = favoriteBtn.innerHTML;
    favoriteBtn.innerHTML = '⏳';
    favoriteBtn.disabled = true;

    fetch(`/ddoksang/cafe/${cafeId}/toggle-favorite/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.card_html) {
            window.lastFavoriteCardHtml = `
              <div class="min-w-[280px] sm:min-w-[300px] scroll-snap-align-start flex-shrink-0" data-cafe-id="${data.cafe_id}">
                ${data.card_html}
              </div>`;
          }

          updateAllFavoriteButtons(cafeId, data.is_favorited);
          updateFavoritesSection(cafeId, data.is_favorited);

          showToast(data.message, 'success');
        } else {
          showToast(data.error || '오류가 발생했습니다.', 'error');
          favoriteBtn.innerHTML = originalContent;
        }
      })
      .catch((err) => {
        console.error('찜하기 요청 오류:', err);
        showToast('네트워크 오류가 발생했습니다.', 'error');
        favoriteBtn.innerHTML = originalContent;
      })
      .finally(() => {
        favoriteBtn.disabled = false;
        isSubmitting = false;
      });
  });
});

function updateAllFavoriteButtons(cafeId, isFavorited) {
  const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
  buttons.forEach((btn) => {
    btn.innerHTML = isFavorited ? '♥' : '♡';
    btn.style.color = isFavorited ? '#ef4444' : '#6b7280';
  });
}


function updateFavoritesSection(cafeId, isFavorited) {
  const section = document.querySelector('#favoritesSection');
  const container = document.querySelector('#favoriteCarousel');

  if (!section || !container) return;

  if (!isFavorited) {
    // 찜 해제 시 삭제
    const cards = container.querySelectorAll(`[data-cafe-id="${cafeId}"]`);
    cards.forEach((card) => {
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9)';
      setTimeout(() => {
        card.remove();
        if (container.children.length === 0) {
          section.style.display = 'none';
        }
      }, 300);
    });
  } else {
    // 찜 추가 시 삽입
    const exists = container.querySelector(`[data-cafe-id="${cafeId}"]`);
    if (!exists && window.lastFavoriteCardHtml) {
      const temp = document.createElement('div');
      temp.innerHTML = window.lastFavoriteCardHtml.trim();
      const newCard = temp.firstElementChild;
      if (newCard) {
        container.prepend(newCard);
        section.style.display = 'block';
      }
    }
  }
}

// ✅ toast 메시지 기본 제공
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast-message');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-message fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white transition-all duration-300';
  toast.classList.add({
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
  }[type] || 'bg-blue-500');

  toast.textContent = message;
  toast.style.transform = 'translateX(100%)';
  document.body.appendChild(toast);

  setTimeout(() => toast.style.transform = 'translateX(0)', 50);
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
