class UnifiedFavoriteManager {
    constructor() {
        this.isSubmitting = false;
        this.favoriteStates = new Map();
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
        this.initializeExistingStates();
    }

    initializeExistingStates() {
        document.querySelectorAll('[data-favorite-btn][data-cafe-id]').forEach(btn => {
            const cafeId = btn.dataset.cafeId;
            const isFavorited = btn.textContent.includes('♥');
            this.favoriteStates.set(cafeId.toString(), isFavorited);
        });
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
    }

    async toggleFavorite(cafeId) {
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        const csrfToken = this.getCSRFToken();
        if (!csrfToken) return;

        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        this.setButtonsLoading(buttons, true);

        try {
            const response = await fetch(`/ddoksang/cafe/${cafeId}/toggle-favorite/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
            });

            const data = await response.json();
            if (data.success) {
                this.updateAllButtons(cafeId, data.is_favorited);
                this.favoriteStates.set(cafeId.toString(), data.is_favorited);

                if (data.is_favorited && data.card_html) {
                    this.addCardHtmlToCarousel(data.card_html, cafeId);
                } else {
                    this.removeCafeFromCarousel(cafeId);
                }

                // ✅ detail 페이지에서만 토스트 출력
                const pageId = document.getElementById('page-identifier');
                const isDetailPage = pageId && pageId.dataset.page === 'detail';

                if (isDetailPage && typeof showToast === 'function') {
                    const toastMessage = data.is_favorited ? '찜 완료!' : '찜 해제~';
                    const toastType = data.is_favorited ? 'success' : 'warning';
                    showToast(toastMessage, toastType);
                }
            
                
            }
        } catch (err) {
            console.error('찜 오류:', err);
        } finally {
            this.setButtonsLoading(buttons, false);
            this.isSubmitting = false;
        }
    }

    updateAllButtons(cafeId, isFavorited) {
        document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`).forEach(button => {
            // ✅ 하트 아이콘 업데이트 (크기 유지)
            this.updateButtonIcon(button, isFavorited);
            
            // ✅ 색상 업데이트
            if (button.style) {
                button.style.color = isFavorited ? '#ef4444' : '#6b7280';
            }
            
            // ✅ 클래스 기반 스타일링도 지원
            if (isFavorited) {
                button.classList.add('favorited');
                button.classList.remove('not-favorited');
            } else {
                button.classList.add('not-favorited');
                button.classList.remove('favorited');
            }
        });
    }

    updateButtonIcon(button, isFavorited) {
        // ✅ span 태그 안의 하트만 변경 (크기 유지)
        const heartSpan = button.querySelector('span');
        const heartIcon = button.querySelector('.favorite-icon');
        
        const newIcon = isFavorited ? '♥' : '♡';
        
        if (heartSpan) {
            heartSpan.textContent = newIcon;
        } else if (heartIcon) {
            heartIcon.textContent = newIcon;
        } else {
            // ✅ span이 없으면 버튼 전체 텍스트 변경 (하지만 기존 클래스 유지)
            const originalClasses = button.className;
            button.textContent = newIcon;
            button.className = originalClasses;
        }
    }

    
    addCardHtmlToCarousel(html, cafeId) {
        const favoriteCarousel = document.getElementById('favoriteCarousel');
        if (!favoriteCarousel) return;

        // ✅ 중복 방지: 이미 존재하는 슬라이드 제거
        const existing = favoriteCarousel.querySelector(`.swiper-slide[data-cafe-id="${cafeId}"]`);
        if (existing) {
            existing.remove();
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        const newCard = wrapper.firstElementChild;

        // ✅ 강제 스타일 및 클래스 지정
        newCard.classList.add('swiper-slide');
        newCard.setAttribute('data-cafe-id', cafeId);
        newCard.style.width = '260px';
        newCard.style.flexShrink = '0';

        favoriteCarousel.insertBefore(newCard, favoriteCarousel.firstChild);

        if (window.favoritesSwiper) {
            window.favoritesSwiper.update();
        }
    }

    removeCafeFromCarousel(cafeId) {
        const card = document.querySelector(`#favoriteCarousel .swiper-slide[data-cafe-id="${cafeId}"]`);
        if (card) {
            card.remove();
            if (window.favoritesSwiper) {
                window.favoritesSwiper.update();
            }
        }
    }

    setButtonsLoading(buttons, isLoading) {
        buttons.forEach(button => {
            button.disabled = isLoading;
            
            if (isLoading) {
                // ✅ 로딩 상태: 원래 클래스 유지하면서 아이콘만 변경
                const heartSpan = button.querySelector('span');
                const heartIcon = button.querySelector('.favorite-icon');
                
                if (heartSpan) {
                    heartSpan.textContent = '⏳';
                } else if (heartIcon) {
                    heartIcon.textContent = '⏳';
                } else {
                    const originalClasses = button.className;
                    button.textContent = '⏳';
                    button.className = originalClasses;
                }
            } else {
                // ✅ 로딩 완료: 원래 상태로 복원
                const isFavorited = this.favoriteStates.get(button.dataset.cafeId);
                this.updateButtonIcon(button, isFavorited);
            }
        });
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    }

    // ✅ 외부에서 호출할 수 있는 상태 설정 함수
    setFavoriteState(cafeId, isFavorited) {
        this.favoriteStates.set(cafeId.toString(), isFavorited);
    }
}

window.favoriteManager = new UnifiedFavoriteManager();