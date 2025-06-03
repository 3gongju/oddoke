
document.addEventListener('DOMContentLoaded', function() {
    // 찜하기 버튼 이벤트 리스너
    document.addEventListener('click', function(e) {
        const favoriteBtn = e.target.closest('[data-favorite-btn]');
        if (!favoriteBtn) return;
        
        e.preventDefault();
        
        const cafeId = favoriteBtn.dataset.cafeId;
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                         document.querySelector('meta[name=csrf-token]')?.getAttribute('content');
        
        if (!csrfToken) {
            console.error('CSRF 토큰을 찾을 수 없습니다.');
            return;
        }
        
        // 로딩 상태 표시
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
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 찜하기 상태에 따라 하트 변경
                if (data.is_favorited) {
                    favoriteBtn.innerHTML = '♥';
                    favoriteBtn.style.color = '#ef4444';
                } else {
                    favoriteBtn.innerHTML = '♡';
                    favoriteBtn.style.color = '#6b7280';
                }
                
                // 토스트 메시지 표시 (있다면)
                if (typeof showToast === 'function') {
                    showToast(data.message, 'success');
                }
            } else {
                console.error('찜하기 실패:', data.error);
                favoriteBtn.innerHTML = originalContent;
                
                if (typeof showToast === 'function') {
                    showToast('오류가 발생했습니다.', 'error');
                }
            }
        })
        .catch(error => {
            console.error('찜하기 요청 오류:', error);
            favoriteBtn.innerHTML = originalContent;
            
            if (typeof showToast === 'function') {
                showToast('네트워크 오류가 발생했습니다.', 'error');
            }
        })
        .finally(() => {
            favoriteBtn.disabled = false;
        });
    });
});

// 간단한 토스트 메시지 함수 (showToast가 없는 경우)
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type = 'info') {
        // 기존 토스트 제거
        const existingToast = document.querySelector('.toast-message');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = 'toast-message fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white transform transition-all duration-300';
        
        // 타입별 색상
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        toast.classList.add(colors[type] || colors.info);
        toast.textContent = message;
        toast.style.transform = 'translateX(100%)';
        
        document.body.appendChild(toast);
        
        // 애니메이션
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // 자동 제거
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    };
}