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
            // ✅ SVG fill 속성으로 찜 상태 확인 (fill="currentColor"면 찜됨)
            const heartSvg = btn.querySelector('svg');
            const isFavorited = heartSvg && heartSvg.getAttribute('fill') === 'currentColor';
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
        // ✅ 버튼 직접 수정 (span 제거)
        if (isFavorited) {
            // 채워진 하트
            button.innerHTML = `
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.218l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/>
                </svg>`;
        } else {
            // 빈 하트
            button.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 000-6.364 4.5 4.5 0 00-6.364 0L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>`;
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
                // ✅ 로딩 상태: 회전하는 아이콘으로 변경
                button.innerHTML = `
                    <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>`;
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