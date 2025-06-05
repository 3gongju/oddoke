// static/js/favorite.js - 통합 찜하기 시스템

window.favoriteManager = {
    favorites: new Set(),
    callbacks: [],
    
    // 초기화
    init() {
        this.bindEvents();
        console.log('찜하기 매니저 초기화 완료');
    },
    
    // 이벤트 바인딩
    bindEvents() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-favorite-btn]');
            if (btn) {
                e.preventDefault();
                this.handleClick(btn);
            }
        });
    },
    
    // 찜하기 버튼 클릭 처리
    async handleClick(button) {
        const cafeId = button.dataset.cafeId;
        if (!cafeId) {
            console.error('카페 ID가 없습니다.');
            return;
        }
        
        // 로그인 확인
        if (!this.isAuthenticated()) {
            alert('로그인이 필요합니다.');
            window.location.href = '/accounts/login/';
            return;
        }
        
        // 로딩 상태 표시
        const originalContent = button.innerHTML;
        this.setLoadingState(button);
        
        try {
            const response = await this.toggleFavorite(cafeId);
            
            if (response.success) {
                // 상태 업데이트
                this.updateFavoriteState(cafeId, response.is_favorited);
                
                // 모든 해당 카페 버튼 업데이트
                this.updateAllButtons(cafeId, response.is_favorited);
                
                // 콜백 실행
                this.executeCallbacks(cafeId, response.is_favorited);
                
                // 토스트 메시지
                this.showToast(response.message || (response.is_favorited ? '찜 목록에 추가되었습니다.' : '찜 목록에서 제거되었습니다.'));
                
            } else {
                throw new Error(response.error || '처리 중 오류가 발생했습니다.');
            }
            
        } catch (error) {
            console.error('찜하기 처리 오류:', error);
            this.showToast(error.message || '오류가 발생했습니다.', 'error');
            button.innerHTML = originalContent;
        }
    },
    
    // 서버에 찜하기 요청
    async toggleFavorite(cafeId) {
        const csrfToken = this.getCsrfToken();
        
        const response = await fetch(`/ddoksang/cafe/${cafeId}/toggle-favorite/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    },
    
    // 모든 해당 카페 버튼 업데이트
    updateAllButtons(cafeId, isFavorited) {
        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        buttons.forEach(button => {
            this.updateButtonDisplay(button, isFavorited);
        });
    },
    
    // 개별 버튼 표시 업데이트
    updateButtonDisplay(button, isFavorited) {
        // 하트 아이콘과 색상 통일
        if (isFavorited) {
            button.innerHTML = '♥';
            button.style.color = '#ef4444'; // 빨간색
            button.classList.add('favorited');
            button.title = '찜 해제';
        } else {
            button.innerHTML = '♡';
            button.style.color = '#6b7280'; // 회색
            button.classList.remove('favorited');
            button.title = '찜하기';
        }
        
        // 호버 효과 추가
        button.classList.add('transition-all', 'duration-200', 'hover:scale-125');
    },
    
    // 로딩 상태 표시
    setLoadingState(button) {
        button.innerHTML = '⏳';
        button.style.color = '#9ca3af';
        button.disabled = true;
    },
    
    // 찜하기 상태 업데이트
    updateFavoriteState(cafeId, isFavorited) {
        if (isFavorited) {
            this.favorites.add(cafeId);
        } else {
            this.favorites.delete(cafeId);
        }
    },
    
    // 찜하기 상태 설정 (초기화용)
    setFavoriteState(cafeId, isFavorited) {
        this.updateFavoriteState(cafeId, isFavorited);
        this.updateAllButtons(cafeId, isFavorited);
    },
    
    // 콜백 등록
    onFavoriteChange(callback) {
        this.callbacks.push(callback);
    },
    
    // 콜백 실행
    executeCallbacks(cafeId, isFavorited) {
        this.callbacks.forEach(callback => {
            try {
                callback(cafeId, isFavorited);
            } catch (error) {
                console.error('콜백 실행 오류:', error);
            }
        });
    },
    
    // 유틸리티 함수들
    isAuthenticated() {
        // Django에서 user.is_authenticated 상태를 확인
        return document.body.dataset.userAuthenticated === 'true' || 
               document.querySelector('meta[name="user-authenticated"]')?.content === 'true';
    },
    
    getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
               document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ||
               this.getCookieValue('csrftoken');
    },
    
    getCookieValue(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    },
    
    // 토스트 메시지
    showToast(message, type = 'success') {
        // 기존 토스트 제거
        const existingToast = document.getElementById('favorite-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.id = 'favorite-toast';
        toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transform transition-all duration-300 translate-x-full`;
        
        // 타입별 배경색
        const bgColors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        toast.classList.add(bgColors[type] || bgColors.success);
        
        // 메시지와 아이콘
        const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
        toast.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="text-lg">${icon}</span>
                <span class="text-sm font-medium">${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // 애니메이션
        setTimeout(() => toast.classList.remove('translate-x-full'), 100);
        
        // 자동 제거
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
    }
};

// DOM 로드 시 자동 초기화
document.addEventListener('DOMContentLoaded', function() {
    window.favoriteManager.init();
});

// 전역 노출 (하위 호환성)
window.toggleFavorite = function(cafeId) {
    const button = document.querySelector(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
    if (button) {
        window.favoriteManager.handleClick(button);
    }
};