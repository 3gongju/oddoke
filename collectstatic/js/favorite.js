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
            // SVG fill 속성으로 찜 상태 확인 (fill="#ef4444"면 찜됨)
            const heartSvg = btn.querySelector('svg');
            const isFavorited = heartSvg && heartSvg.getAttribute('fill') === '#ef4444';
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
                // 즉시 UI 업데이트 (애니메이션 없음)
                this.updateAllButtons(cafeId, data.is_favorited);
                this.favoriteStates.set(cafeId.toString(), data.is_favorited);

                // 캐러셀 업데이트
                if (data.is_favorited && data.card_html) {
                    this.addCardHtmlToCarousel(data.card_html, cafeId);
                } else {
                    this.removeCafeFromCarousel(cafeId);
                }

                // detail 페이지에서만 간단한 메시지 출력
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
            this.showSimpleError('오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            this.setButtonsLoading(buttons, false);
            this.isSubmitting = false;
        }
    }
    
    updateAllButtons(cafeId, isFavorited) {
        document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`).forEach(button => {
            // 하트 아이콘 즉시 업데이트 (애니메이션 없음)
            this.updateButtonIcon(button, isFavorited);
            
            // 데이터 속성 업데이트
            button.dataset.favorited = isFavorited ? 'true' : 'false';
            button.title = isFavorited ? '찜 해제' : '찜하기';
        });
    }

    updateButtonIcon(button, isFavorited) {
        // 카드 템플릿과 일치하는 하트 아이콘 사용 (애니메이션 제거)
        const svg = button.querySelector('svg');
        if (svg) {
            if (isFavorited) {
                // 찜된 상태: 채워진 하트 (빨간색)
                svg.setAttribute('fill', '#ef4444');
                svg.setAttribute('stroke', '#ef4444');
            } else {
                // 찜하지 않은 상태: 빈 하트 (빨간색 테두리)
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', '#ef4444');
            }
        } else {
            // SVG가 없으면 새로 생성
            if (isFavorited) {
                button.innerHTML = `
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M12.001 4.529c2.349-2.342 6.151-2.354 8.502-.022
                                2.357 2.339 2.365 6.133.01 8.482l-7.104 7.066a1.5 1.5 0
                                01-2.116 0l-7.104-7.066c-2.355-2.349-2.348-6.143.01-8.482
                                2.351-2.332 6.153-2.32 8.502.022z"/>
                    </svg>`;
            } else {
                button.innerHTML = `
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M12.001 4.529c2.349-2.342 6.151-2.354 8.502-.022
                                2.357 2.339 2.365 6.133.01 8.482l-7.104 7.066a1.5 1.5 0
                                01-2.116 0l-7.104-7.066c-2.355-2.349-2.348-6.143.01-8.482
                                2.351-2.332 6.153-2.32 8.502.022z"/>
                    </svg>`;
            }
        }
    }

    addCardHtmlToCarousel(html, cafeId) {
        const favoriteCarousel = document.getElementById('favoriteCarousel');
        if (!favoriteCarousel) return;

        // 중복 방지: 이미 존재하는 슬라이드 제거
        const existing = favoriteCarousel.querySelector(`.swiper-slide[data-cafe-id="${cafeId}"]`);
        if (existing) {
            existing.remove();
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        const newCard = wrapper.firstElementChild;

        // 강제 스타일 및 클래스 지정
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

        const remaining = document.querySelectorAll('#favoriteCarousel .swiper-slide').length;

        if (remaining === 0) {
            const section = document.getElementById('favoritesSection');
            if (section) {
                section.innerHTML = `
                    <div class="text-center py-16">
                        <div class="mb-4">
                            <img src="/static/image/ddok_logo_filled.png" alt="찜한 카페 없음" class="w-16 h-16 mx-auto opacity-50">
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">아직 찜한 생카가 없어요</h3>
                        <p class="text-gray-600">마음에 드는 생카를 찜해보세요</p>
                    </div>
                `;
            }
        }
    }

    setButtonsLoading(buttons, isLoading) {
        buttons.forEach(button => {
            button.disabled = isLoading;
            
            // 로딩 상태 시각적 피드백 (심플하게)
            if (isLoading) {
                button.style.opacity = '0.5';
                button.style.pointerEvents = 'none';
            } else {
                button.style.opacity = '';
                button.style.pointerEvents = '';
                
                // 원래 상태로 복원
                const isFavorited = this.favoriteStates.get(button.dataset.cafeId);
                this.updateButtonIcon(button, isFavorited);
            }
        });
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    }

    // 간단한 오류 메시지 표시
    showSimpleError(message) {
        // 기존 메시지가 있다면 제거
        const existingError = document.querySelector('.simple-error-message');
        if (existingError) {
            existingError.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'simple-error-message';
        errorDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(239, 68, 68, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            ">
                ${message}
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    // 외부에서 호출할 수 있는 상태 설정 함수
    setFavoriteState(cafeId, isFavorited) {
        this.favoriteStates.set(cafeId.toString(), isFavorited);
    }
}

// 전역 변수로 등록
window.favoriteManager = new UnifiedFavoriteManager();