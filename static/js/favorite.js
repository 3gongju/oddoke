// static/js/favorite.js - Swiper 지원 통합 찜하기 시스템

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
                // ✅ 모든 버튼 상태 업데이트
                this.updateAllButtons(cafeId, data.is_favorited);
                
                // 상태 저장
                this.favoriteStates.set(cafeId.toString(), data.is_favorited);
                
                // ✅ 페이지별 특별 처리
                await this.handlePageSpecificUpdates(cafeId, data);
                
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

    // ✅ 하트 아이콘 업데이트 (중복 방지)
    updateAllButtons(cafeId, isFavorited) {
        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        
        buttons.forEach(button => {
            // ✅ 하트 아이콘과 색상을 직접 설정
            if (isFavorited) {
                button.textContent = '♥';  // 찜됨: 채워진 하트
                button.style.color = '#ef4444';  // 빨간색
            } else {
                button.textContent = '♡';  // 찜안됨: 빈 하트
                button.style.color = '#6b7280';  // 회색
            }
            
            // 툴팁 변경
            button.title = isFavorited ? '찜 해제' : '찜하기';
            
            // 애니메이션 효과
            button.style.transform = 'scale(1.2)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        });
    }

    // ✅ 페이지별 업데이트 로직
    async handlePageSpecificUpdates(cafeId, data) {
        const currentPath = window.location.pathname;
        
        if (currentPath === '/ddoksang/' || currentPath === '/ddoksang/home/' || currentPath.endsWith('/ddoksang/')) {
            // 홈 페이지: 찜한 카페 섹션 업데이트 (Swiper 지원)
            await this.updateHomeFavoritesSection(cafeId, data);
        } else if (currentPath.includes('/favorites/')) {
            // 찜 목록 페이지: 카드 제거만 (추가는 다른 페이지에서)
            if (!data.is_favorited) {
                this.updateFavoritesPage(cafeId, false);
            }
        }
    }

    // ✅🎯 홈페이지 찜한 카페 섹션 업데이트 (Swiper 지원)
    async updateHomeFavoritesSection(cafeId, data) {
        // 기존 Swiper 인스턴스가 있다면 파괴
        if (window.favoritesSwiper) {
            window.favoritesSwiper.destroy(true, true);
            window.favoritesSwiper = null;
        }
        
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
                
                // 새로운 Swiper 초기화는 HTML에 포함된 스크립트가 자동으로 처리
            } else {
                // 찜한 카페가 없으면 섹션 제거
                if (favoritesSection) {
                    favoritesSection.remove();
                }
            }
        } else {
            // 서버에서 HTML을 보내지 않은 경우 직접 처리
            if (data.is_favorited) {
                // ✅ 찜하기 추가: 실시간으로 카드 추가
                try {
                    await this.addCafeCardToFavorites(cafeId);
                } catch (error) {
                    console.error('찜한 카페 추가 오류:', error);
                }
            } else {
                // ✅ 찜 해제: 카드 제거
                this.removeCafeCardFromFavorites(cafeId);
            }
        }
    }

    // ✅ 찜한 카페에 카드 실시간 추가 (Swiper 지원)
    async addCafeCardToFavorites(cafeId) {
        try {
            // 카페 정보 가져오기
            const cafeData = await this.fetchCafeData(cafeId);
            if (!cafeData) {
                throw new Error('카페 정보를 가져올 수 없습니다.');
            }

            let favoritesSection = document.getElementById('favoritesSection');
            
            // 찜한 카페 섹션이 없으면 Swiper 버전으로 생성
            if (!favoritesSection) {
                await this.createFavoritesSwiperSection();
                favoritesSection = document.getElementById('favoritesSection');
            }
            
            // Swiper wrapper 또는 일반 컨테이너 확인
            let container = document.querySelector('.favorites-swiper .swiper-wrapper');
            if (!container) {
                container = document.getElementById('favoriteCarousel');
            }
            
            if (!container) return;
            
            // 빈 상태 메시지가 있으면 제거
            const emptyMessage = container.querySelector('.text-center.py-16, .col-span-full, .swiper-slide');
            if (emptyMessage && emptyMessage.textContent.includes('아직 찜한')) {
                emptyMessage.remove();
            }

            // 새 카드 HTML 생성
            const cardHTML = this.generateCafeCardHTML(cafeData);
            
            // Swiper 슬라이드 또는 일반 카드 요소 생성
            const cardElement = document.createElement('div');
            if (container.classList.contains('swiper-wrapper')) {
                cardElement.className = 'swiper-slide';
                cardElement.innerHTML = `<div class="h-full" data-cafe-id="${cafeId}">${cardHTML}</div>`;
            } else {
                cardElement.className = 'flex-shrink-0';
                cardElement.setAttribute('data-cafe-id', cafeId);
                cardElement.innerHTML = cardHTML;
            }
            
            // 애니메이션과 함께 추가
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'scale(0.8)';
            container.insertBefore(cardElement, container.firstChild);
            
            // 애니메이션 실행
            setTimeout(() => {
                cardElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                cardElement.style.opacity = '1';
                cardElement.style.transform = 'scale(1)';
                
                // Swiper 업데이트
                if (window.favoritesSwiper) {
                    window.favoritesSwiper.update();
                }
            }, 50);
            
        } catch (error) {
            console.error('카드 추가 실패:', error);
            throw error;
        }
    }

    // ✅ 카페 데이터 가져오기 API
    async fetchCafeData(cafeId) {
        try {
            const response = await fetch(`/ddoksang/api/cafe/${cafeId}/quick/`);
            if (!response.ok) throw new Error('카페 정보 조회 실패');
            
            const result = await response.json();
            return result.success ? result.cafe : null;
        } catch (error) {
            console.error('카페 데이터 조회 오류:', error);
            return null;
        }
    }

    // ✅ 카페 카드 HTML 생성
    generateCafeCardHTML(cafe) {
        const daysRemainingText = cafe.days_remaining > 0 && cafe.days_remaining <= 7 
            ? `<span class="ml-2 text-red-600 font-medium text-xs">${cafe.days_remaining}일 남음</span>` 
            : '';

        return `
            <div class="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200 overflow-hidden">
                ${cafe.main_image ? `
                    <div class="relative overflow-hidden">
                        <img src="${cafe.main_image}" alt="${cafe.name}" class="w-full h-48 object-cover">
                    </div>
                ` : `
                    <div class="w-full h-48 bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                        <div class="text-center">
                            <svg class="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <p class="text-sm text-gray-500">이미지 없음</p>
                        </div>
                    </div>
                `}

                <div class="p-4">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center space-x-2">
                            ${cafe.is_active ? `
                                <span class="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✨ 운영중</span>
                            ` : `
                                <span class="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">✅ 종료</span>
                            `}
                        </div>

                        <button 
                            data-favorite-btn 
                            data-cafe-id="${cafe.id}" 
                            class="text-lg hover:scale-125 transition-transform duration-200 focus:outline-none"
                            style="color: #ef4444;"
                            title="찜 해제"
                        >
                            ♥
                        </button>
                    </div>

                    <div class="mb-2">
                        <h3 class="font-semibold text-lg text-gray-900">
                            ${cafe.member ? `
                                ${cafe.member}
                                <span class="text-sm text-gray-500 font-normal">(${cafe.artist})</span>
                            ` : cafe.artist}
                        </h3>
                    </div>

                    <h4 class="text-gray-700 mb-3 font-medium" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${cafe.name}</h4>

                    <div class="flex items-center text-sm text-gray-600 mb-2">
                        <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <span class="truncate">${cafe.address || '주소 정보 없음'}</span>
                    </div>

                    <div class="flex items-center text-sm text-gray-600 mb-3">
                        <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span>${cafe.start_date} - ${cafe.end_date}</span>
                        ${daysRemainingText}
                    </div>

                    <div class="space-y-2">
                        <div class="flex space-x-2">
                            <a href="/ddoksang/cafe/${cafe.id}/" 
                               class="flex-1 bg-gray-900 text-white py-2.5 text-center rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
                                자세히 보기
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ✅ 찜한 카페 Swiper 섹션 생성
    async createFavoritesSwiperSection() {
        const birthdaySection = document.querySelector('section.py-8.sm\\:py-12.px-4, section.py-4.sm\\:py-8.px-4');
        if (!birthdaySection) return;

        const sectionHTML = `
            <section class="mb-12" id="favoritesSection">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-semibold text-gray-800">💖 내가 찜한 생일카페</h2>
                    <a href="/ddoksang/favorites/" class="text-sm text-pink-600 hover:underline">전체 보기 &rarr;</a>
                </div>

                <!-- Swiper CSS -->
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
                
                <!-- Swiper 컨테이너 -->
                <div class="swiper favorites-swiper relative">
                    <div class="swiper-wrapper">
                        <!-- 카드들이 여기에 추가됩니다 -->
                    </div>

                    <!-- 네비게이션 버튼 -->
                    <div class="swiper-button-next favorites-next"></div>
                    <div class="swiper-button-prev favorites-prev"></div>
                    
                    <!-- 페이지네이션 -->
                    <div class="swiper-pagination favorites-pagination"></div>
                </div>

                <!-- Swiper JS -->
                <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
            </section>
        `;

        birthdaySection.insertAdjacentHTML('afterend', sectionHTML);
        
        // Swiper 초기화
        setTimeout(() => {
            this.initializeFavoritesSwiper();
        }, 100);
    }

    // Swiper 초기화 함수
    initializeFavoritesSwiper() {
        if (window.favoritesSwiper) {
            window.favoritesSwiper.destroy(true, true);
        }

        window.favoritesSwiper = new Swiper('.favorites-swiper', {
            slidesPerView: 1,
            spaceBetween: 20,
            loop: false,
            
            breakpoints: {
                640: {
                    slidesPerView: 2,
                    spaceBetween: 20,
                },
                768: {
                    slidesPerView: 2,
                    spaceBetween: 24,
                },
                1024: {
                    slidesPerView: 3,
                    spaceBetween: 24,
                },
                1280: {
                    slidesPerView: 4,
                    spaceBetween: 24,
                },
            },
            
            navigation: {
                nextEl: '.favorites-next',
                prevEl: '.favorites-prev',
            },
            
            pagination: {
                el: '.favorites-pagination',
                clickable: true,
                dynamicBullets: true,
            },
            
            keyboard: {
                enabled: true,
            },
            
            mousewheel: {
                forceToAxis: true,
            },
            
            autoHeight: false,
            resistance: true,
            resistanceRatio: 0.85,
            effect: 'slide',
            speed: 400,
            touchRatio: 1,
            touchAngle: 45,
        });
    }

    // ✅ 찜한 카페에서 카드 제거 (Swiper 지원)
    removeCafeCardFromFavorites(cafeId) {
        const favoritesSection = document.getElementById('favoritesSection');
        if (!favoritesSection) return;

        // Swiper 슬라이드 또는 일반 카드 찾기
        const swiperSlides = document.querySelectorAll(`.favorites-swiper .swiper-slide [data-cafe-id="${cafeId}"]`);
        const regularCards = document.querySelectorAll(`#favoriteCarousel [data-cafe-id="${cafeId}"]`);
        
        // Swiper 슬라이드 제거
        swiperSlides.forEach(slideContent => {
            const slide = slideContent.closest('.swiper-slide');
            if (slide) {
                slide.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                slide.style.opacity = '0';
                slide.style.transform = 'scale(0.8)';
                
                setTimeout(() => {
                    slide.remove();
                    
                    // Swiper 업데이트
                    if (window.favoritesSwiper) {
                        window.favoritesSwiper.update();
                        
                        // 슬라이드가 모두 제거되면 빈 상태 표시
                        if (window.favoritesSwiper.slides.length === 0) {
                            this.showEmptyFavoritesInSwiper();
                        }
                    }
                }, 300);
            }
        });
        
        // 일반 카드 제거
        regularCards.forEach(card => {
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                card.remove();
                
                const carousel = document.getElementById('favoriteCarousel');
                if (carousel && carousel.children.length === 0) {
                    this.showEmptyFavoritesInCarousel(carousel);
                }
            }, 300);
        });
    }

    // ✅ Swiper에서 빈 상태 표시
    showEmptyFavoritesInSwiper() {
        const swiperWrapper = document.querySelector('.favorites-swiper .swiper-wrapper');
        if (!swiperWrapper) return;

        swiperWrapper.innerHTML = `
            <div class="swiper-slide">
                <div class="text-center py-16">
                    <div class="text-6xl mb-4">💔</div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">아직 찜한 생일카페가 없어요</h3>
                    <p class="text-gray-600 mb-6">마음에 드는 생카를 찜해보세요!</p>
                    <a href="/ddoksang/" class="inline-block bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition-colors">
                        생일카페 둘러보기
                    </a>
                </div>
            </div>
        `;

        if (window.favoritesSwiper) {
            window.favoritesSwiper.update();
        }
    }

    // ✅ 일반 컨테이너에서 빈 상태 표시
    showEmptyFavoritesInCarousel(carousel) {
        carousel.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="text-6xl mb-4">💔</div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">아직 찜한 생일카페가 없어요</h3>
                <p class="text-gray-600 mb-6">마음에 드는 생카를 찜해보세요!</p>
                <a href="/ddoksang/" class="inline-block bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition-colors">
                    생일카페 둘러보기
                </a>
            </div>
        `;
    }

    updateFavoritesPage(cafeId, isFavorited) {
        if (!isFavorited) {
            // 찜 해제: 카드 제거
            const container = document.querySelector('#favoriteCarousel');
            const cards = container?.querySelectorAll(`[data-cafe-id="${cafeId}"]`) || [];
            
            cards.forEach(card => {
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.8)';
                
                setTimeout(() => {
                    card.remove();
                    
                    // 모든 카드가 제거되면 빈 상태 표시
                    if (container && container.children.length === 0) {
                        this.showEmptyFavoritesState();
                    }
                }, 300);
            });
        }
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
            </div>
        `;
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

// ✅ 안전한 전역 인스턴스 생성
if (!window.favoriteManager) {
    window.favoriteManager = new FavoriteManager();
}

// 레거시 함수들 (기존 코드 호환성을 위해)
window.updateAllFavoriteButtons = function(cafeId, isFavorited) {
    if (window.favoriteManager) {
        window.favoriteManager.updateAllButtons(cafeId, isFavorited);
    }
};

window.showToast = function(message, type) {
    if (window.favoriteManager) {
        window.favoriteManager.showToast(message, type);
    }
};

// 초기화 완료 로그
console.log('Swiper 지원 통합 찜하기 시스템 로드 완료');