class FavoriteManager {
    constructor() {
        this.isSubmitting = false;
        this.favoriteStates = new Map();
        this.callbacks = [];
        this.init();
    }

    init() {
        // DOM이 로드되면 이벤트 리스너 등록
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        // 이벤트 위임을 사용하여 동적으로 추가되는 버튼도 처리
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

        console.log('FavoriteManager 초기화 완료');
    }

    async toggleFavorite(cafeId) {
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        // CSRF 토큰 가져오기
        const csrfToken = this.getCSRFToken();
        if (!csrfToken) {
            console.error('CSRF 토큰을 찾을 수 없습니다.');
            this.isSubmitting = false;
            return;
        }

        // 모든 해당 카페의 버튼들 찾기
        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        
        // 로딩 상태 표시
        this.setButtonsLoading(buttons, true);

        try {
            const response = await fetch(`/ddoksang/cafe/${cafeId}/toggle-favorite/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                // 모든 버튼 상태 업데이트
                this.updateAllButtons(cafeId, data.is_favorited);
                
                // 상태 저장
                this.favoriteStates.set(cafeId.toString(), data.is_favorited);
                
                // 페이지별 특별 처리
                this.handlePageSpecificUpdates(cafeId, data);
                
                // 콜백 실행
                this.executeCallbacks(cafeId, data.is_favorited);
                
                // 성공 메시지
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

    updateAllButtons(cafeId, isFavorited) {
        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        
        buttons.forEach(button => {
            // ✅ 하트 아이콘 통일: 회색 빈하트(♡) → 빨간 채워진하트(♥)
            button.innerHTML = isFavorited ? '♥' : '♡';
            
            // ✅ 색상 통일: 찜하기 전 회색, 찜한 후 빨강
            button.style.color = isFavorited ? '#ef4444' : '#6b7280';
            
            // 툴팁 변경
            button.title = isFavorited ? '찜 해제' : '찜하기';
            
            // 애니메이션 효과
            button.style.transform = 'scale(1.2)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        });
    }

    handlePageSpecificUpdates(cafeId, data) {
        const currentPath = window.location.pathname;
        
        if (currentPath === '/ddoksang/' || currentPath === '/ddoksang/home/') {
            // 홈 페이지: 찜한 카페 섹션 업데이트
            this.updateHomeFavoritesSection(data);
        } else if (currentPath.includes('/favorites/')) {
            // 찜 목록 페이지: 카드 제거/추가
            this.updateFavoritesPage(cafeId, data.is_favorited);
        }
    }

    updateHomeFavoritesSection(data) {
        if (data.favorites_html) {
            const favoritesSection = document.getElementById('favoritesSection');
            
            if (data.favorites_html.trim()) {
                // 찜한 카페가 있으면 섹션 업데이트
                if (favoritesSection) {
                    favoritesSection.outerHTML = data.favorites_html;
                } else {
                    // 섹션이 없으면 생일 아티스트 섹션 다음에 추가
                    const birthdaySection = document.querySelector('.py-8.sm\\:py-12.px-4');
                    if (birthdaySection) {
                        birthdaySection.insertAdjacentHTML('afterend', data.favorites_html);
                    }
                }
            } else {
                // 찜한 카페가 없으면 섹션 제거
                if (favoritesSection) {
                    favoritesSection.remove();
                }
            }
        }
    }

    updateFavoritesPage(cafeId, isFavorited) {
        const container = document.querySelector('#favoriteCarousel');
        const section = document.querySelector('#favoritesSection');
        
        if (!container) return;

        if (!isFavorited) {
            // 찜 해제: 카드 제거
            const cards = container.querySelectorAll(`[data-cafe-id="${cafeId}"]`);
            cards.forEach(card => {
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.8)';
                
                setTimeout(() => {
                    card.remove();
                    
                    // 모든 카드가 제거되면 빈 상태 표시
                    if (container.children.length === 0) {
                        this.showEmptyFavoritesState();
                    }
                }, 300);
            });
        }
        // 찜 추가는 페이지 새로고침으로 처리 (다른 페이지에서 찜한 경우)
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
                <a href="/ddoksang/" class="text-pink-600 hover:underline text-sm sm:text-base">전체보기 &rarr;</a>
            </div>
            <div class="text-center py-16">
                <div class="text-6xl mb-4">💔</div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">아직 찜한 생일카페가 없어요</h3>
                <p class="text-gray-600 mb-6">마음에 드는 생카를 찜해보세요!</p>
                <a href="/ddoksang/" class="inline-block bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition-colors">
                    생일카페 둘러보기
                </a>
            </div>
        `;
    }

    setButtonsLoading(buttons, isLoading) {
        buttons.forEach(button => {
            if (isLoading) {
                button.dataset.originalContent = button.innerHTML;
                button.innerHTML = '⏳';
                button.style.opacity = '0.7';
                button.disabled = true;
            } else {
                // ✅ 로딩 완료 후 올바른 하트 아이콘으로 복원
                const cafeId = button.dataset.cafeId;
                const isFavorited = this.favoriteStates.get(cafeId?.toString()) || false;
                button.innerHTML = isFavorited ? '♥' : '♡';
                button.style.color = isFavorited ? '#ef4444' : '#6b7280';
                button.style.opacity = '1';
                button.disabled = false;
                delete button.dataset.originalContent;
            }
        });
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
               document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ||
               document.querySelector('[data-csrf-token]')?.dataset.csrfToken;
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
        } else if (error.message.includes('네트워크')) {
            message = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
        }
        
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        // 기존 토스트 제거
        const existing = document.querySelector('.toast-message');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-message fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-all duration-300 transform';
        
        // 타입별 색상 설정
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
        }, 50);

        // 자동 제거
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 외부에서 찜하기 상태 변경을 감지할 수 있는 콜백 등록
    onFavoriteChange(callback) {
        this.callbacks.push(callback);
    }

    // 콜백 실행
    executeCallbacks(cafeId, isFavorited) {
        this.callbacks.forEach(callback => {
            try {
                callback(cafeId, isFavorited);
            } catch (error) {
                console.error('찜하기 콜백 오류:', error);
            }
        });
    }

    // 찜하기 상태 조회
    getFavoriteState(cafeId) {
        return this.favoriteStates.get(cafeId.toString()) || false;
    }

    // 찜하기 상태 설정 (초기 로드 시 사용)
    setFavoriteState(cafeId, isFavorited) {
        this.favoriteStates.set(cafeId.toString(), isFavorited);
    }
}

// 전역 인스턴스 생성
window.favoriteManager = new FavoriteManager();

// 레거시 함수들 (기존 코드 호환성을 위해)
window.updateAllFavoriteButtons = function(cafeId, isFavorited) {
    window.favoriteManager.updateAllButtons(cafeId, isFavorited);
};

window.showToast = function(message, type) {
    window.favoriteManager.showToast(message, type);
};
