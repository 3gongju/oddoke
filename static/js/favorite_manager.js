// 통합 찜하기 관리 시스템

// static/js/favorite_manager.js - 통합 찜하기 관리 시스템

class FavoriteManager {
    constructor() {
        this.isInitialized = false;
        this.favoriteState = new Map(); // 카페 ID -> 찜 상태 맵
        this.pendingRequests = new Set(); // 진행 중인 요청들
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        // 초기 찜 상태 로드
        this.loadInitialFavoriteState();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        this.isInitialized = true;
        console.log('FavoriteManager 초기화 완료');
    }

    loadInitialFavoriteState() {
        // 페이지에 있는 모든 찜하기 버튼의 상태를 파악
        const favoriteButtons = document.querySelectorAll('[data-favorite-btn]');
        
        favoriteButtons.forEach(btn => {
            const cafeId = btn.dataset.cafeId;
            const currentState = this.getCurrentButtonState(btn);
            this.favoriteState.set(cafeId, currentState);
        });
        
        console.log('초기 찜 상태 로드:', this.favoriteState);
    }

    getCurrentButtonState(button) {
        // 하트 모양이나 색상으로 현재 상태 판단
        const text = button.textContent.trim();
        const color = button.style.color || window.getComputedStyle(button).color;
        
        // ♥ (채워진 하트) 또는 빨간색이면 찜된 상태
        return text === '♥' || color.includes('244, 68, 68') || color.includes('#ef4444') || color.includes('rgb(239, 68, 68)');
    }

    setupEventListeners() {
        // 클릭 이벤트 위임
        document.addEventListener('click', (e) => {
            const favoriteBtn = e.target.closest('[data-favorite-btn]');
            if (!favoriteBtn) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            this.handleFavoriteClick(favoriteBtn);
        });
    }

    async handleFavoriteClick(button) {
        const cafeId = button.dataset.cafeId;
        
        if (!cafeId) {
            console.error('카페 ID가 없습니다.');
            return;
        }

        // 중복 요청 방지
        if (this.pendingRequests.has(cafeId)) {
            console.log('이미 처리 중인 요청입니다.');
            return;
        }

        try {
            this.pendingRequests.add(cafeId);
            
            // UI 즉시 업데이트 (낙관적 업데이트)
            const currentState = this.favoriteState.get(cafeId) || false;
            const newState = !currentState;
            
            this.updateAllButtonsForCafe(cafeId, newState, true); // 로딩 상태
            
            // 서버 요청
            const response = await this.sendFavoriteRequest(cafeId);
            
            if (response.success) {
                // 서버 응답으로 최종 상태 확정
                this.favoriteState.set(cafeId, response.is_favorited);
                this.updateAllButtonsForCafe(cafeId, response.is_favorited, false);
                
                // 성공 메시지
                this.showToast(response.message || (response.is_favorited ? '찜 목록에 추가되었습니다.' : '찜 목록에서 제거되었습니다.'), 'success');
                
                // 커스텀 이벤트 발생 (다른 컴포넌트에서 필요시 사용)
                this.dispatchFavoriteEvent(cafeId, response.is_favorited);
                
            } else {
                // 실패 시 원래 상태로 복원
                this.updateAllButtonsForCafe(cafeId, currentState, false);
                this.showToast(response.error || '오류가 발생했습니다.', 'error');
            }
            
        } catch (error) {
            console.error('찜하기 요청 오류:', error);
            
            // 오류 시 원래 상태로 복원
            const currentState = this.favoriteState.get(cafeId) || false;
            this.updateAllButtonsForCafe(cafeId, currentState, false);
            
            // 에러 메시지
            if (error.message.includes('401') || error.message.includes('403')) {
                this.showToast('로그인이 필요합니다.', 'warning');
                setTimeout(() => {
                    window.location.href = '/accounts/login/';
                }, 1500);
            } else {
                this.showToast('네트워크 오류가 발생했습니다.', 'error');
            }
            
        } finally {
            this.pendingRequests.delete(cafeId);
        }
    }

    async sendFavoriteRequest(cafeId) {
        const csrfToken = this.getCSRFToken();
        
        if (!csrfToken) {
            throw new Error('CSRF 토큰을 찾을 수 없습니다.');
        }

        const response = await fetch(`/ddoksang/cafe/${cafeId}/toggle-favorite/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    getCSRFToken() {
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

    updateAllButtonsForCafe(cafeId, isFavorited, isLoading = false) {
        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        
        buttons.forEach(button => {
            if (isLoading) {
                // 로딩 상태
                button.innerHTML = '<span class="animate-pulse">⏳</span>';
                button.disabled = true;
                button.style.pointerEvents = 'none';
            } else {
                // 정상 상태
                button.innerHTML = isFavorited ? '♥' : '♡';
                button.style.color = isFavorited ? '#ef4444' : '#6b7280';
                button.disabled = false;
                button.style.pointerEvents = 'auto';
                
                // 접근성 개선
                button.setAttribute('aria-label', isFavorited ? '찜 해제' : '찜하기');
                button.title = isFavorited ? '찜 해제' : '찜하기';
            }
        });

        // 상태 업데이트
        if (!isLoading) {
            this.favoriteState.set(cafeId, isFavorited);
        }
    }

    dispatchFavoriteEvent(cafeId, isFavorited) {
        const event = new CustomEvent('favoriteChanged', {
            detail: { cafeId, isFavorited }
        });
        document.dispatchEvent(event);
    }

    showToast(message, type = 'info') {
        // 기존 토스트 제거
        const existingToast = document.querySelector('.favorite-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'favorite-toast fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transform transition-all duration-300 translate-x-full';
        
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

    // 외부에서 찜 상태 확인
    isFavorited(cafeId) {
        return this.favoriteState.get(cafeId) || false;
    }

    // 외부에서 찜 상태 설정 (초기 로드 시 사용)
    setFavoriteState(cafeId, isFavorited) {
        this.favoriteState.set(cafeId, isFavorited);
        this.updateAllButtonsForCafe(cafeId, isFavorited);
    }

    // 디버깅용
    getDebugInfo() {
        return {
            favoriteState: Object.fromEntries(this.favoriteState),
            pendingRequests: Array.from(this.pendingRequests),
            isInitialized: this.isInitialized
        };
    }
}

// 전역 인스턴스 생성
window.favoriteManager = null;

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    if (!window.favoriteManager) {
        window.favoriteManager = new FavoriteManager();
    }
});

// 페이지 이동 시에도 다시 초기화 (SPA에서 유용)
document.addEventListener('turbo:load', function() {
    if (!window.favoriteManager) {
        window.favoriteManager = new FavoriteManager();
    }
});

// 디버깅용 전역 함수
window.getFavoriteDebugInfo = function() {
    return window.favoriteManager ? window.favoriteManager.getDebugInfo() : 'FavoriteManager not initialized';
};