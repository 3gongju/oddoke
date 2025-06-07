// ✅ 기존 FavoriteManager가 있다면 제거
if (window.favoriteManager) {
    delete window.favoriteManager;
}

class FavoriteManager {
    constructor() {
        this.isSubmitting = false;
        this.favoriteStates = new Map();
        this.callbacks = [];
        this.initialized = false;
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
        
        this.initialized = true;
    }

    setupEventListeners() {
        // ✅ 중복 이벤트 리스너 방지
        if (this._eventListenerAdded) return;
        
        document.addEventListener('click', (e) => {
            const favoriteBtn = e.target.closest('[data-favorite-btn]');
            if (!favoriteBtn || this.isSubmitting) return;

            e.preventDefault();
            e.stopPropagation();

            const cafeId = favoriteBtn.dataset.cafeId;
            if (cafeId) {
                this.toggleFavorite(cafeId);
            }
        });

        this._eventListenerAdded = true;
        console.log('FavoriteManager 초기화 완료');
    }

    async toggleFavorite(cafeId) {
        if (this.isSubmitting) {
            console.log('이미 요청 처리 중...');
            return;
        }
        
        this.isSubmitting = true;

        const csrfToken = this.getCSRFToken();
        if (!csrfToken) {
            console.error('CSRF 토큰을 찾을 수 없습니다.');
            this.isSubmitting = false;
            return;
        }

        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        this.setButtonsLoading(buttons, true);

        try {
            const response = await fetch(`/ddoksang/cafe/${cafeId}/toggle-favorite/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin', // ✅ 쿠키 포함
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                // ✅ 상태 업데이트 - 크기 안정성 확보
                this.updateAllButtons(cafeId, data.is_favorited);
                this.favoriteStates.set(cafeId.toString(), data.is_favorited);
                this.handlePageSpecificUpdates(cafeId, data);
                this.executeCallbacks(cafeId, data.is_favorited);
                this.showToast(data.message || (data.is_favorited ? '찜 목록에 추가했어요!' : '찜 목록에서 제거했어요!'), 'success');
            } else {
                throw new Error(data.error || '찜하기 처리에 실패했습니다.');
            }

        } catch (error) {
            console.error('찜하기 오류:', error);
            this.handleError(error);
        } finally {
            this.setButtonsLoading(buttons, false);
            this.isSubmitting = false;
        }
    }

    // ✅ 버튼 업데이트 - 크기 안정성 강화
    updateAllButtons(cafeId, isFavorited) {
        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        
        buttons.forEach(button => {
            try {
                // ✅ 크기 고정을 위한 스타일 적용
                if (!button.style.width) {
                    const computedStyle = window.getComputedStyle(button);
                    button.style.width = computedStyle.width;
                    button.style.height = computedStyle.height;
                    button.style.minWidth = computedStyle.width;
                    button.style.minHeight = computedStyle.height;
                }

                const icon = button.querySelector('.favorite-icon');
                if (icon) {
                    icon.textContent = isFavorited ? '♥' : '♡';
                    icon.style.color = isFavorited ? '#ef4444' : '#6b7280';
                } else {
                    // ✅ 아이콘이 없는 경우 버튼 내용 직접 변경
                    button.textContent = isFavorited ? '♥' : '♡';
                }
                
                // ✅ 색상 업데이트
                button.style.color = isFavorited ? '#ef4444' : '#6b7280';
                button.title = isFavorited ? '찜 해제' : '찜하기';
                
                // ✅ 애니메이션 - 크기 변화 최소화
                button.style.transform = 'scale(1.1)';
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        button.style.transform = 'scale(1)';
                    }, 150);
                });
                
            } catch (error) {
                console.warn(`버튼 업데이트 오류 (카페 ID: ${cafeId}):`, error);
            }
        });
    }

    handlePageSpecificUpdates(cafeId, data) {
        const swiper = window.favoritesSwiper;
        if (!swiper) return;

        if (!data.is_favorited) {
            // ✅ 찜 해제 시 슬라이드 제거
            const slide = document.querySelector(`.favorites-swiper .swiper-slide[data-cafe-id="${cafeId}"]`);
            if (slide) {
                const index = Array.from(slide.parentNode.children).indexOf(slide);
                if (index !== -1) {
                    swiper.removeSlide(index);
                    swiper.update();
                }
            }

            // ✅ 모든 슬라이드가 제거되면 빈 상태 표시
            const remaining = swiper.wrapperEl.querySelectorAll('.swiper-slide[data-cafe-id]').length;
            if (remaining === 0) {
                this.showEmptyFavoritesState();
            }
        } else if (data.slide_html) {
            // ✅ 찜 추가 시 슬라이드 추가
            try {
                swiper.prependSlide(data.slide_html);
                swiper.update();
            } catch (error) {
                console.error('슬라이드 추가 오류:', error);
            }
        }
    }

    // ✅ 로딩 상태 처리 개선
    setButtonsLoading(buttons, isLoading) {
        buttons.forEach(button => {
            if (isLoading) {
                // ✅ 기존 크기 저장
                const computedStyle = window.getComputedStyle(button);
                button.dataset.originalWidth = computedStyle.width;
                button.dataset.originalHeight = computedStyle.height;
                button.dataset.originalContent = button.textContent;
                
                // ✅ 크기 고정 후 로딩 표시
                button.style.width = computedStyle.width;
                button.style.height = computedStyle.height;
                button.style.minWidth = computedStyle.width;
                button.style.minHeight = computedStyle.height;
                
                button.textContent = '⏳';
                button.style.opacity = '0.7';
                button.disabled = true;
            } else {
                // ✅ 원래 상태 복원
                const original = button.dataset.originalContent;
                if (original && original !== '⏳') {
                    button.textContent = original;
                }
                
                button.style.opacity = '1';
                button.disabled = false;
                
                // ✅ 데이터 정리
                delete button.dataset.originalContent;
                delete button.dataset.originalWidth;
                delete button.dataset.originalHeight;
            }
        });
    }

    executeCallbacks(cafeId, isFavorited) {
        this.callbacks.forEach(callback => {
            try {
                callback(cafeId, isFavorited);
            } catch (error) {
                console.error('찜하기 콜백 오류:', error);
            }
        });
    }

    showEmptyFavoritesState() {
        const section = document.querySelector('#favoritesSection');
        if (!section) return;

        section.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">💕 내가 찜한 덕의 생카</h2>
                    <p class="text-gray-600 text-sm sm:text-base">찜한 아티스트/멤버들의 생일카페를 모아봤어요!</p>
                </div>
                <a href="/ddoksang/" class="text-pink-600 hover:underline text-sm sm:text-base">홈으로 &rarr;</a>
            </div>
            <div class="text-center py-16">
                <div class="text-6xl mb-4">💔</div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">아직 찜한 생일카페가 없어요</h3>
                <p class="text-gray-600 mb-6">마음에 드는 생카를 찜해보세요!</p>
                <a href="/ddoksang/" class="inline-block bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition-colors">
                    생일카페 둘러보기
                </a>
            </div>`;
    }

    // ✅ CSRF 토큰 가져오기 강화
    getCSRFToken() {
        // 1. 폼의 CSRF 토큰
        const formToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        if (formToken) return formToken;
        
        // 2. 메타 태그의 CSRF 토큰
        const metaToken = document.querySelector('meta[name=csrf-token]')?.getAttribute('content');
        if (metaToken) return metaToken;
        
        // 3. 데이터 속성의 CSRF 토큰
        const dataToken = document.querySelector('[data-csrf-token]')?.dataset.csrfToken;
        if (dataToken) return dataToken;
        
        // 4. 쿠키에서 CSRF 토큰 추출
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        
        console.error('CSRF 토큰을 찾을 수 없습니다.');
        return null;
    }

    handleError(error) {
        let message = '오류가 발생했습니다.';

        if (error.message.includes('401') || error.message.includes('403')) {
            message = '로그인이 필요합니다.';
            setTimeout(() => {
                window.location.href = '/accounts/login/';
            }, 2000);
        } else if (error.message.includes('404')) {
            message = '카페를 찾을 수 없습니다.';
        } else if (error.message.includes('500')) {
            message = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('네트워크')) {
            message = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
        }

        this.showToast(message, 'error');
        console.error('찜하기 처리 오류:', error);
    }

    showToast(message, type = 'info') {
        // ✅ 기존 토스트 제거
        const existing = document.querySelector('.toast-message');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-message fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-all duration-300 transform';

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

        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 50);

        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    onFavoriteChange(callback) {
        this.callbacks.push(callback);
    }

    getFavoriteState(cafeId) {
        return this.favoriteStates.get(cafeId.toString()) || false;
    }
    
    setFavoriteState(cafeId, isFavorited) {
        this.favoriteStates.set(cafeId.toString(), isFavorited);

        const btns = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        btns.forEach(btn => {
            try {
                // ✅ 크기 안정성 확보
                if (!btn.style.width) {
                    const computedStyle = window.getComputedStyle(btn);
                    btn.style.width = computedStyle.width;
                    btn.style.height = computedStyle.height;
                    btn.style.minWidth = computedStyle.width;
                    btn.style.minHeight = computedStyle.height;
                }

                const icon = btn.querySelector('.favorite-icon');
                if (icon) {
                    icon.textContent = isFavorited ? '♥' : '♡';
                    icon.style.color = isFavorited ? '#ef4444' : '#6b7280';
                } else {
                    btn.textContent = isFavorited ? '♥' : '♡';
                }

                btn.style.color = isFavorited ? '#ef4444' : '#6b7280';
                btn.title = isFavorited ? '찜 해제' : '찜하기';
            } catch (error) {
                console.warn(`상태 설정 오류 (카페 ID: ${cafeId}):`, error);
            }
        });
    }

    // ✅ 안전한 초기화 메서드
    safeInit() {
        try {
            if (this.initialized) return;
            
            // DOM이 준비될 때까지 대기
            if (document.readyState !== 'complete') {
                window.addEventListener('load', () => this.safeInit());
                return;
            }
            
            this.setupEventListeners();
            this.initialized = true;
            console.log('FavoriteManager 안전 초기화 완료');
        } catch (error) {
            console.error('FavoriteManager 초기화 오류:', error);
        }
    }
}

// ✅ 글로벌 인스턴스 등록 - 안전한 방식
if (!window.favoriteManager) {
    window.favoriteManager = new FavoriteManager();
}

// ✅ 전역 함수 등록
window.updateAllFavoriteButtons = function (cafeId, isFavorited) {
    if (window.favoriteManager) {
        window.favoriteManager.updateAllButtons(cafeId, isFavorited);
    }
};

window.showToast = function (message, type) {
    if (window.favoriteManager) {
        window.favoriteManager.showToast(message, type);
    }
};

// ✅ 디버깅용 전역 함수
window.debugFavoriteManager = function() {
    console.log('FavoriteManager 상태:', {
        initialized: window.favoriteManager?.initialized,
        favoriteStates: window.favoriteManager?.favoriteStates,
        isSubmitting: window.favoriteManager?.isSubmitting,
        callbacksCount: window.favoriteManager?.callbacks?.length
    });
};

console.log('✅ 개선된 찜하기 시스템 로드 완료 - 크기 안정성 및 오류 처리 강화');