// static/js/favorite.js - 간단하고 정확한 찜하기 시스템 (최종)

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
        
        // 기존 찜 상태 초기화
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
                this.handleFavoriteCarousel(cafeId, data.is_favorited);
                this.showToast(data.is_favorited ? '찜 목록에 추가했어요!' : '찜 목록에서 제거했어요!');
            } else {
                throw new Error(data.error || '찜하기 처리에 실패했습니다.');
            }

        } catch (error) {
            console.error('찜하기 오류:', error);
            this.showToast('오류가 발생했습니다.', 'error');
        } finally {
            this.setButtonsLoading(buttons, false);
            this.isSubmitting = false;
        }
    }

    updateAllButtons(cafeId, isFavorited) {
        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        buttons.forEach(button => {
            button.textContent = isFavorited ? '♥' : '♡';
            button.style.color = isFavorited ? '#ef4444' : '#6b7280';
            
            // 애니메이션
            button.style.transform = 'scale(1.2)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        });
    }

    async handleFavoriteCarousel(cafeId, isFavorited) {
        const favoriteCarousel = document.getElementById('favoriteCarousel');
        if (!favoriteCarousel) return;

        if (isFavorited) {
            // 찜 추가 - 카페 정보 가져와서 카로셀에 추가
            try {
                const response = await fetch(`/ddoksang/api/cafe/${cafeId}/quick/`);
                const data = await response.json();
                
                if (data.success) {
                    this.addCafeToCarousel(data.cafe);
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

        // 🔧 기존 카드가 있으면 그것을 템플릿으로 사용 (완전 복제 방식)
        const existingCard = favoriteCarousel.querySelector('[data-cafe-id]');
        
        if (existingCard) {
            // 기존 카드 완전 복제
            const newCard = existingCard.cloneNode(true);
            
            // 카페 정보로 내용 업데이트
            this.updateCardContent(newCard, cafe);
            
            // 카로셀 맨 앞에 추가
            favoriteCarousel.insertBefore(newCard, existingCard);
            
            // 애니메이션
            this.animateCardEntry(newCard);
            
        } else {
            // 첫 번째 카드면 템플릿으로 생성
            const newCard = this.createCardFromTemplate(cafe);
            favoriteCarousel.appendChild(newCard);
            this.animateCardEntry(newCard);
        }

        // 빈 메시지 숨기기
        this.hideEmptyMessage();

        console.log('카페가 찜 목록에 추가되었습니다:', cafe.name);
    }

    updateCardContent(cardElement, cafe) {
        // 카페 ID 업데이트
        cardElement.setAttribute('data-cafe-id', cafe.id);
        
        // 이미지 업데이트
        const img = cardElement.querySelector('img');
        const imgContainer = cardElement.querySelector('.w-full.h-32, .w-full.h-40');
        
        if (cafe.main_image && img) {
            img.src = cafe.main_image;
            img.alt = cafe.name;
        } else if (!cafe.main_image && imgContainer) {
            imgContainer.innerHTML = `
                <div class="w-full h-32 sm:h-40 bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center">
                    <span class="text-white text-2xl sm:text-3xl">🏪</span>
                </div>
            `;
        }
        
        // 텍스트 내용 업데이트
        const title = cardElement.querySelector('h3');
        const artist = cardElement.querySelector('p.text-gray-700');
        const date = cardElement.querySelector('p.text-xs.text-gray-600');
        const address = cardElement.querySelector('p.text-xs.text-gray-500');
        const link = cardElement.querySelector('a[href*="/ddoksang/detail/"]');
        
        if (title) title.textContent = cafe.name;
        if (artist) artist.textContent = `${cafe.artist}${cafe.member ? ' - ' + cafe.member : ''}`;
        if (date) date.textContent = `📅 ${cafe.start_date} ~ ${cafe.end_date}`;
        if (address) address.textContent = `📍 ${cafe.address ? cafe.address.substring(0, 30) + '...' : ''}`;
        if (link) link.href = `/ddoksang/detail/${cafe.id}/`;
        
        // 운영중 배지 업데이트
        const statusBadge = cardElement.querySelector('.bg-green-100');
        if (cafe.is_active && !statusBadge) {
            const badgeContainer = cardElement.querySelector('.flex.items-center.justify-between');
            if (badgeContainer) {
                badgeContainer.innerHTML += '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">운영중</span>';
            }
        } else if (!cafe.is_active && statusBadge) {
            statusBadge.remove();
        }
    }

    createCardFromTemplate(cafe) {
        // 첫 번째 카드를 위한 기본 템플릿
        const cardHtml = `
            <div class="min-w-[280px] sm:min-w-[300px] bg-white rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden flex-shrink-0" 
                 data-cafe-id="${cafe.id}" 
                 style="scroll-snap-align: start;">
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

    animateCardEntry(card) {
        card.style.opacity = '0';
        card.style.transform = 'translateX(-30px)';
        
        requestAnimationFrame(() => {
            card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateX(0)';
        });

        // 카로셀을 맨 앞으로 스크롤
        setTimeout(() => {
            const favoriteCarousel = document.getElementById('favoriteCarousel');
            if (favoriteCarousel && favoriteCarousel.scrollTo) {
                favoriteCarousel.scrollTo({
                    left: 0,
                    behavior: 'smooth'
                });
            }
        }, 100);
    }

    removeCafeFromCarousel(cafeId) {
        const favoriteCarousel = document.getElementById('favoriteCarousel');
        if (!favoriteCarousel) return;

        const cafeCard = favoriteCarousel.querySelector(`[data-cafe-id="${cafeId}"]`);
        if (cafeCard) {
            cafeCard.style.transition = 'all 0.3s ease';
            cafeCard.style.opacity = '0';
            cafeCard.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                cafeCard.remove();
                
                // 카로셀이 비었으면 빈 메시지 표시
                const remainingCards = favoriteCarousel.querySelectorAll('[data-cafe-id]');
                if (remainingCards.length === 0) {
                    this.showEmptyMessage();
                }
            }, 300);
        }
    }

    hideEmptyMessage() {
        const emptyMessage = document.querySelector('.empty-favorites-message');
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
        }
    }

    showEmptyMessage() {
        // 빈 메시지는 템플릿에서 처리하도록 단순화
        console.log('찜한 카페가 없습니다.');
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
                    const cafeId = button.dataset.cafeId;
                    const isFavorited = this.favoriteStates.get(cafeId?.toString()) || false;
                    button.textContent = isFavorited ? '♥' : '♡';
                }
                button.style.opacity = '1';
                button.disabled = false;
                delete button.dataset.originalContent;
            }
        });
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
               document.querySelector('meta[name=csrf-token]')?.getAttribute('content');
    }

    showToast(message, type = 'success') {
        const existing = document.querySelector('.toast-message');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-message fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-all duration-300';
        toast.classList.add(type === 'error' ? 'bg-red-500' : 'bg-green-500');
        toast.textContent = message;
        toast.style.transform = 'translateX(100%)';

        document.body.appendChild(toast);

        setTimeout(() => toast.style.transform = 'translateX(0)', 50);
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// 글로벌 인스턴스 생성
window.favoriteManager = new UnifiedFavoriteManager();

console.log('찜하기 시스템 로드 완료');