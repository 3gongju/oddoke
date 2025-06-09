// ✅ static/js/favorite.js (최종 확정본 - 중복 제거 + 크기 유지 + 정확한 제거 + 중복 삽입 방지)

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
            button.textContent = isFavorited ? '♥' : '♡';
            button.style.color = isFavorited ? '#ef4444' : '#6b7280';
        });
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
            button.textContent = isLoading ? '⏳' : (this.favoriteStates.get(button.dataset.cafeId) ? '♥' : '♡');
        });
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    }
}

window.favoriteManager = new UnifiedFavoriteManager();