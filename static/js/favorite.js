// static/js/favorite.js - 통합 찜하기 시스템
class UnifiedFavoriteManager {
    constructor() {
        this.isSubmitting = false;
        this.favoriteStates = new Map();
        this.callbacks = [];
        this.swiperInstance = null;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
        
        // Swiper 인스턴스 찾기
        this.findSwiperInstance();
        
        // 기존 상태 초기화
        this.initializeExistingStates();
    }

    findSwiperInstance() {
        // 여러 방법으로 Swiper 인스턴스를 찾음
        if (window.favoritesSwiper) {
            this.swiperInstance = window.favoritesSwiper;
        } else if (window.favoriteCarouselSwiper) {
            this.swiperInstance = window.favoriteCarouselSwiper;
        } else {
            // DOM에서 swiper 컨테이너 찾기
            const swiperContainer = document.querySelector('.favorites-swiper, .favorite-carousel, [data-swiper="favorites"]');
            if (swiperContainer && swiperContainer.swiper) {
                this.swiperInstance = swiperContainer.swiper;
            }
        }
        console.log('Swiper 인스턴스:', this.swiperInstance);
    }

    initializeExistingStates() {
        // 페이지에 있는 모든 찜 버튼의 상태를 저장
        document.querySelectorAll('[data-favorite-btn][data-cafe-id]').forEach(btn => {
            const cafeId = btn.dataset.cafeId;
            const isFavorited = this.isButtonFavorited(btn);
            this.favoriteStates.set(cafeId.toString(), isFavorited);
        });
    }

    isButtonFavorited(button) {
        // 버튼의 현재 찜 상태 확인 (여러 방법으로)
        const icon = button.querySelector('.favorite-icon');
        if (icon) {
            return icon.textContent.includes('♥') || icon.textContent.includes('❤');
        }
        
        // 스타일로 확인
        const color = window.getComputedStyle(button).color;
        const isRed = color.includes('244, 68, 68') || color.includes('239, 68, 68') || color.includes('rgb(239, 68, 68)');
        
        // 텍스트로 확인
        const text = button.textContent.trim();
        return text.includes('♥') || text.includes('❤') || isRed;
    }

    setupEventListeners() {
        // 이벤트 위임을 사용하여 모든 찜 버튼 처리
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

        console.log('통합 찜하기 시스템 초기화 완료');
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
                this.handleFavoriteCarouselUpdate(cafeId, data);
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
            // 아이콘 업데이트
            const icon = button.querySelector('.favorite-icon');
            if (icon) {
                icon.textContent = isFavorited ? '♥' : '♡';
            } else {
                // 아이콘이 별도로 없으면 버튼 텍스트 자체 업데이트
                button.textContent = isFavorited ? '♥' : '♡';
            }
            
            // 스타일 업데이트
            button.style.color = isFavorited ? '#ef4444' : '#6b7280';
            button.title = isFavorited ? '찜 해제' : '찜하기';
            
            // 애니메이션
            button.style.transform = 'scale(1.2)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        });
    }

    async handleFavoriteCarouselUpdate(cafeId, data) {
        const favoriteCarousel = document.getElementById('favoriteCarousel');
        if (!favoriteCarousel) return;

        if (data.is_favorited) {
            // 찜 추가 - 카페 정보를 가져와서 카로셀에 추가
            try {
                const cafeResponse = await fetch(`/ddoksang/api/cafe/${cafeId}/quick/`);
                const cafeData = await cafeResponse.json();
                
                if (cafeData.success) {
                    this.addCafeToCarousel(cafeData.cafe);
                }
            } catch (error) {
                console.error('카페 정보 가져오기 오류:', error);
            }
        } else {
            // 찜 해제 - 카로셀에서 제거
            this.removeCafeFromCarousel(cafeId);
        }
    }

    addCafeToCarousel(cafe) {
        const favoriteCarousel = document.getElementById('favoriteCarousel');
        if (!favoriteCarousel) return;

        // 새 카드 생성
        const newCard = this.createFavoriteCard(cafe);
        
        // 빈 상태 메시지 제거 (카드 추가 전에)
        this.hideEmptyFavoritesMessage();
        
        // 카로셀의 맨 첫 번째 위치에 삽입
        const firstCard = favoriteCarousel.querySelector('[data-cafe-id]');
        if (firstCard) {
            favoriteCarousel.insertBefore(newCard, firstCard);
        } else {
            favoriteCarousel.appendChild(newCard);
        }
        
        // 부드러운 등장 애니메이션 (왼쪽에서 나타남, scale 제거)
        newCard.style.opacity = '0';
        newCard.style.transform = 'translateX(-30px)';
        
        // 애니메이션 실행
        requestAnimationFrame(() => {
            newCard.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            newCard.style.opacity = '1';
            newCard.style.transform = 'translateX(0)';
        });

        // 카로셀을 맨 앞으로 스크롤 (부드럽게)
        setTimeout(() => {
            if (favoriteCarousel.scrollTo) {
                favoriteCarousel.scrollTo({
                    left: 0,
                    behavior: 'smooth'
                });
            } else {
                favoriteCarousel.scrollLeft = 0;
            }
        }, 100);

        console.log('카페가 찜 목록 맨 앞에 추가되었습니다:', cafe.name);
    }

    removeCafeFromCarousel(cafeId) {
        const favoriteCarousel = document.getElementById('favoriteCarousel');
        if (!favoriteCarousel) return;

        const cafeCard = favoriteCarousel.querySelector(`[data-cafe-id="${cafeId}"]`);
        if (cafeCard) {
            // 부드러운 사라짐 애니메이션
            cafeCard.style.transition = 'all 0.3s ease';
            cafeCard.style.opacity = '0';
            cafeCard.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                cafeCard.remove();
                
                // 카로셀이 비었으면 빈 상태 메시지 표시
                const remainingCards = favoriteCarousel.querySelectorAll('[data-cafe-id]');
                if (remainingCards.length === 0) {
                    this.showEmptyFavoritesMessage();
                }
            }, 300);
        }

        console.log('카페가 찜 목록에서 제거되었습니다:', cafeId);
    }

    createFavoriteCard(cafe) {
        // 기존 카드의 클래스를 복사해서 동일한 스타일 적용
        const existingCard = document.querySelector('#favoriteCarousel [data-cafe-id]');
        let cardClasses = 'min-w-[280px] sm:min-w-[300px] bg-white rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden flex-shrink-0';
        
        if (existingCard) {
            // 기존 카드의 클래스를 그대로 복사
            cardClasses = existingCard.className;
        }

        const cardHtml = `
            <div class="${cardClasses}" data-cafe-id="${cafe.id}">
                ${cafe.main_image ? `
                    <img src="${cafe.main_image}" alt="${cafe.name}" class="w-full h-32 sm:h-40 object-cover">
                ` : `
                    <div class="w-full h-32 sm:h-40 bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center">
                        <span class="text-white text-2xl sm:text-3xl">🏪</span>
                    </div>
                `}

                <div class="p-3 sm:p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                            <span class="text-red-600 mr-1">♥</span> 찜 덕
                        </span>
                        ${cafe.is_active ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">운영중</span>' : ''}
                    </div>

                    <h3 class="font-bold text-base sm:text-lg text-gray-800 mb-1 line-clamp-1">${cafe.name}</h3>
                    <p class="text-gray-700 font-semibold mb-2 text-sm line-clamp-1">${cafe.artist}${cafe.member ? ' - ' + cafe.member : ''}</p>
                    <p class="text-xs text-gray-600 mb-2">📅 ${cafe.start_date} ~ ${cafe.end_date}</p>
                    <p class="text-xs text-gray-500 mb-3 line-clamp-2">📍 ${cafe.address ? cafe.address.substring(0, 30) + '...' : ''}</p>

                    <a href="/ddoksang/detail/${cafe.id}/" 
                       class="block w-full text-center bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-all duration-200">
                        자세히 보기
                    </a>
                </div>
            </div>
        `;
        
        const cardElement = document.createElement('div');
        cardElement.innerHTML = cardHtml.trim();
        return cardElement.firstElementChild;
    }

    hideEmptyFavoritesMessage() {
        const emptyMessage = document.querySelector('.empty-favorites-message');
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
        }
        
        // favoritesSection 내의 빈 상태 메시지도 숨김
        const favoritesSection = document.querySelector('#favoritesSection');
        if (favoritesSection) {
            const emptyState = favoritesSection.querySelector('.text-center.py-8, .text-center.py-12');
            if (emptyState) {
                emptyState.style.display = 'none';
            }
        }
    }

    showEmptyFavoritesMessage() {
        const favoriteCarousel = document.getElementById('favoriteCarousel');
        if (!favoriteCarousel) return;

        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-favorites-message text-center py-8 sm:py-12 col-span-full';
        emptyMessage.innerHTML = `
            <div class="text-4xl sm:text-6xl mb-4">♡◟( ˘ ³˘)◞ ♡</div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">아직 찜한 생일카페가 없어요</h3>
            <p class="text-gray-600 mb-6">마음에 드는 생카를 찜해보세요!</p>
            <a href="/ddoksang/" class="inline-block bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition-colors">
                생일카페 둘러보기
            </a>
        `;
        
        favoriteCarousel.parentElement.appendChild(emptyMessage);
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
                const icon = button.querySelector('.favorite-icon');
                if (icon) {
                    icon.textContent = '⏳';
                } else {
                    button.textContent = '⏳';
                }
                button.style.opacity = '0.7';
                button.disabled = true;
            } else {
                const original = button.dataset.originalContent;
                if (original && original !== '⏳') {
                    const icon = button.querySelector('.favorite-icon');
                    if (icon) {
                        // 아이콘이 있으면 현재 찜 상태에 따라 복원
                        const cafeId = button.dataset.cafeId;
                        const isFavorited = this.favoriteStates.get(cafeId?.toString()) || false;
                        icon.textContent = isFavorited ? '♥' : '♡';
                    } else {
                        button.textContent = original;
                    }
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
        this.updateAllButtons(cafeId, isFavorited);
    }
}

// 기존 favoriteManager 제거 및 새로운 인스턴스 생성
if (window.favoriteManager) {
    delete window.favoriteManager;
}

// 글로벌 인스턴스 등록
window.favoriteManager = new UnifiedFavoriteManager();

// 전역 함수들 (하위 호환성)
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

console.log('통합 찜하기 시스템 로드 완료');