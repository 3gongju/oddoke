// ✅ 기존 FavoriteManager가 있다면 제거
if (window.favoriteManager) {
    delete window.favoriteManager;
}

class FavoriteManager {
    constructor() {
        this.isSubmitting = false;
        this.favoriteStates = new Map();
        this.callbacks = [];
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
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
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
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

    updateAllButtons(cafeId, isFavorited) {
        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        buttons.forEach(button => {
            const icon = button.querySelector('.favorite-icon');
            if (icon) {
                icon.textContent = isFavorited ? '♥' : '♡';
            }
            button.style.color = isFavorited ? '#ef4444' : '#6b7280';
            button.title = isFavorited ? '찜 해제' : '찜하기';
            button.style.transform = 'scale(1.2)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        });
    }

    handlePageSpecificUpdates(cafeId, data) {
        const swiper = window.favoritesSwiper;
        if (!swiper) return;

        if (!data.is_favorited) {
            const slide = document.querySelector(`.favorites-swiper .swiper-slide[data-cafe-id="${cafeId}"]`);
            if (slide) {
                const index = Array.from(slide.parentNode.children).indexOf(slide);
                if (index !== -1) {
                    swiper.removeSlide(index);
                    swiper.update();
                }
            }

            const remaining = swiper.wrapperEl.querySelectorAll('.swiper-slide[data-cafe-id]').length;
            if (remaining === 0) {
                this.showEmptyFavoritesState();
            }
        } else {
            fetch(`/ddoksang/cafe/${cafeId}/favorite-card-html/`)
                .then(res => res.json())
                .then(res => {
                    if (res.success && res.html) {
                        const slideHTML = `<div class="swiper-slide" data-cafe-id="${cafeId}">${res.html}</div>`;
                        swiper.appendSlide(slideHTML);
                        swiper.update();
                    }
                })
                .catch(err => console.error('슬라이드 추가 오류:', err));
        }
    }

    removeFavoriteSlideFromSwiper(cafeId) {
        const swiper = window.favoritesSwiper;
        if (!swiper) return;

        const slide = document.querySelector(`.favorites-swiper .swiper-slide[data-cafe-id="${cafeId}"]`);
        if (!slide) return;

        const wrapper = swiper.wrapperEl;
        const slides = wrapper.querySelectorAll('.swiper-slide');
        const index = Array.from(slides).indexOf(slide);

        if (index !== -1) {
            swiper.removeSlide(index);
            swiper.update();
        }

        const remaining = wrapper.querySelectorAll('.swiper-slide[data-cafe-id]').length;
        if (remaining === 0) {
            this.showEmptyFavoritesState();
        }
    }

    showUnifiedEmptyStateHTML() {
        return `
            <div class="flex flex-col items-center justify-center w-full min-h-[240px] text-center">
                <div class="text-6xl mb-4">♡◟( ˘ ³˘)◞ ♡</div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">아직 찜한 생일카페가 없어요</h3>
                <p class="text-gray-600 mb-6">마음에 드는 생카를 찜해보세요!</p>
                <a href="/ddoksang/" class="inline-block bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition-colors">
                    생일카페 둘러보기
                </a>
            </div>`;
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
            ${this.showUnifiedEmptyStateHTML()}`;
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

    setButtonsLoading(buttons, isLoading) {
        buttons.forEach(button => {
            if (isLoading) {
                button.dataset.originalContent = button.textContent;
                button.textContent = '⏳';
                button.style.opacity = '0.7';
                button.disabled = true;
            } else {
                const original = button.dataset.originalContent;
                if (original && original !== '⏳') {
                    button.textContent = original;
                }
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
            const icon = btn.querySelector('.favorite-icon');
            if (icon) {
                icon.textContent = isFavorited ? '♥' : '♡';
                icon.style.color = isFavorited ? '#ef4444' : '#6b7280';  // 빨강 or 회색
            }

            btn.title = isFavorited ? '찜 해제' : '찜하기';
        });

    }
}

// ✅ 글로벌 인스턴스 등록
if (!window.favoriteManager) {
    window.favoriteManager = new FavoriteManager();
}

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

console.log('Swiper 지원 통합 찜하기 시스템 로드 완료');
