// static/js/favorite.js - FavoriteManager를 사용하도록 수정

document.addEventListener('DOMContentLoaded', function() {
    // FavoriteManager가 로드되었는지 확인
    if (typeof window.favoriteManager === 'undefined') {
        console.warn('FavoriteManager가 로드되지 않았습니다. favorite_manager.js를 먼저 로드해주세요.');
        
        // Fallback: 기본 찜하기 기능
        setupFallbackFavoriteSystem();
        return;
    }
    
    console.log('FavoriteManager 기반 찜하기 시스템이 활성화되었습니다.');
    
    // FavoriteManager 이벤트 리스너 등록
    document.addEventListener('favoriteChanged', function(e) {
        const { cafeId, isFavorited } = e.detail;
        console.log(`카페 ${cafeId} 찜 상태 변경: ${isFavorited}`);
        
        // 필요시 추가 처리 (예: 분석 이벤트 전송)
        if (typeof gtag === 'function') {
            gtag('event', 'favorite_toggle', {
                'event_category': 'engagement',
                'event_label': cafeId,
                'value': isFavorited ? 1 : 0
            });
        }
    });
});

// FavoriteManager가 없을 때의 fallback 시스템
function setupFallbackFavoriteSystem() {
    console.log('Fallback 찜하기 시스템을 초기화합니다.');
    
    document.addEventListener('click', function(e) {
        const favoriteBtn = e.target.closest('[data-favorite-btn]');
        if (!favoriteBtn) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const cafeId = favoriteBtn.dataset.cafeId;
        const csrfToken = getCSRFToken();
        
        if (!csrfToken) {
            showFallbackToast('로그인이 필요합니다.', 'warning');
            return;
        }
        
        // 로딩 상태
        const originalContent = favoriteBtn.innerHTML;
        favoriteBtn.innerHTML = '⏳';
        favoriteBtn.disabled = true;
        
        // 서버 요청
        fetch(`/ddoksang/cafe/${cafeId}/toggle-favorite/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
            },
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // 성공 시 상태 업데이트
                favoriteBtn.innerHTML = data.is_favorited ? '♥' : '♡';
                favoriteBtn.style.color = data.is_favorited ? '#ef4444' : '#6b7280';
                showFallbackToast(data.message, 'success');
            } else {
                favoriteBtn.innerHTML = originalContent;
                showFallbackToast(data.error || '오류가 발생했습니다.', 'error');
            }
        })
        .catch(error => {
            console.error('Fallback 찜하기 오류:', error);
            favoriteBtn.innerHTML = originalContent;
            showFallbackToast('네트워크 오류가 발생했습니다.', 'error');
        })
        .finally(() => {
            favoriteBtn.disabled = false;
        });
    });
}

// CSRF 토큰 가져오기 함수
function getCSRFToken() {
    // 1. Hidden input에서 찾기
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    if (csrfInput && csrfInput.value) {
        return csrfInput.value;
    }

    // 2. Meta 태그에서 찾기
    const csrfMeta = document.querySelector('meta[name=csrf-token]');
    if (csrfMeta && csrfMeta.getAttribute('content')) {
        return csrfMeta.getAttribute('content');
    }

    // 3. 쿠키에서 찾기
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') {
            return value;
        }
    }

    return null;
}

// Fallback 토스트 메시지
function showFallbackToast(message, type = 'info') {
    // FavoriteManager의 토스트가 있으면 사용
    if (window.favoriteManager && typeof window.favoriteManager.showToast === 'function') {
        window.favoriteManager.showToast(message, type);
        return;
    }
    
    // 기존 토스트 제거
    const existingToast = document.querySelector('.fallback-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'fallback-toast fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transform transition-all duration-300 translate-x-full';
    
    // 타입별 색상
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    toast.classList.add(colors[type] || colors.info);
    
    // 아이콘 추가
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <div class="flex items-center space-x-2">
            <span class="font-bold">${icons[type] || icons.info}</span>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // 애니메이션
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full');
    });
    
    // 자동 제거
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 전역 함수로 노출 (호환성)
if (typeof window.showToast === 'undefined') {
    window.showToast = function(message, type = 'info') {
        if (window.favoriteManager && typeof window.favoriteManager.showToast === 'function') {
            window.favoriteManager.showToast(message, type);
        } else {
            showFallbackToast(message, type);
        }
    };
}

// 디버깅용 함수
window.favoriteDebug = function() {
    if (window.favoriteManager) {
        console.log('FavoriteManager Debug Info:', window.favoriteManager.getDebugInfo());
    } else {
        console.log('FavoriteManager가 초기화되지 않았습니다.');
    }
};

// 외부에서 사용할 수 있는 유틸리티 함수들
window.favoriteUtils = {
    getCSRFToken,
    showToast: window.showToast
};