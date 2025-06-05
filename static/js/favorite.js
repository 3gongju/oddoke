// static/js/favorite.js - 통합 찜하기 시스템 (최종 완성 버전)

window.favoriteManager = {
    favorites: new Set(),
    callbacks: [],

    init() {
        this.bindEvents();
        console.log('찜하기 매니저 초기화 완료');
    },

    bindEvents() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-favorite-btn]');
            if (btn) {
                e.preventDefault();
                this.handleClick(btn);
            }
        });
    },

    async handleClick(button) {
        const cafeId = button.dataset.cafeId;
        if (!cafeId) return;

        if (!this.isAuthenticated()) {
            alert('로그인이 필요합니다.');
            window.location.href = '/accounts/login/';
            return;
        }

        const originalContent = button.innerHTML;
        this.setLoadingState(button);

        try {
            const response = await this.toggleFavorite(cafeId);
            if (response.success) {
                this.updateFavoriteState(cafeId, response.is_favorited);
                this.updateAllButtons(cafeId, response.is_favorited);
                this.executeCallbacks(cafeId, response.is_favorited);
                this.showToast(response.message || (response.is_favorited ? '찜 추가됨' : '찜 해제됨'));

                if (response.is_favorited) {
                    this.insertFavoriteCard(cafeId);
                } else {
                    this.removeFavoriteCard(cafeId);
                }

            } else {
                throw new Error(response.error || '처리 중 오류');
            }
        } catch (error) {
            console.error('찜하기 오류:', error);
            this.showToast(error.message || '오류 발생', 'error');
            button.innerHTML = originalContent;
        } finally {
            button.disabled = false;
        }
    },

    async toggleFavorite(cafeId) {
        const csrfToken = this.getCsrfToken();
        const response = await fetch(`/ddoksang/cafe/${cafeId}/toggle-favorite/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    },

    updateFavoriteState(cafeId, isFavorited) {
        if (isFavorited) {
            this.favorites.add(cafeId);
        } else {
            this.favorites.delete(cafeId);
        }
    },

    updateAllButtons(cafeId, isFavorited) {
        const buttons = document.querySelectorAll(`[data-favorite-btn][data-cafe-id="${cafeId}"]`);
        buttons.forEach(btn => this.updateButtonDisplay(btn, isFavorited));
    },

    updateButtonDisplay(button, isFavorited) {
        button.innerHTML = isFavorited ? '♥' : '♡';
        button.style.color = isFavorited ? '#ef4444' : '#6b7280';
        button.title = isFavorited ? '찜 해제' : '찜하기';
        button.classList.add('transition-all', 'duration-200', 'hover:scale-125');
    },

    setLoadingState(button) {
        button.innerHTML = '⏳';
        button.style.color = '#9ca3af';
        button.disabled = true;
    },

    setFavoriteState(cafeId, isFavorited) {
        this.updateFavoriteState(cafeId, isFavorited);
        this.updateAllButtons(cafeId, isFavorited);
    },

    onFavoriteChange(callback) {
        this.callbacks.push(callback);
    },

    executeCallbacks(cafeId, isFavorited) {
        this.callbacks.forEach(cb => {
            try {
                cb(cafeId, isFavorited);
            } catch (e) {
                console.error('콜백 오류:', e);
            }
        });
    },

    isAuthenticated() {
        return document.body.dataset.userAuthenticated === 'true' ||
               document.querySelector('meta[name="user-authenticated"]')?.content === 'true';
    },

    getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
               document.querySelector('meta[name="csrf-token"]')?.content ||
               this.getCookieValue('csrftoken');
    },

    getCookieValue(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    },

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-all transform translate-x-full`;
        const bg = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500',
        }[type] || 'bg-green-500';
        toast.classList.add(bg);
        toast.innerHTML = `<span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.remove('translate-x-full'), 50);
        setTimeout(() => toast.remove(), 3000);
    },

    async insertFavoriteCard(cafeId) {
        const container = document.querySelector('#favoriteCarousel');
        if (!container) return;

        const response = await fetch(`/ddoksang/favorite/${cafeId}/card/`);
        const html = await response.text();

        const wrapper = document.createElement('div');
        wrapper.className = 'flex-shrink-0';
        wrapper.dataset.cafeId = cafeId;
        wrapper.innerHTML = html;

        container.prepend(wrapper);
    },



    removeFavoriteCard(cafeId) {
        const card = document.querySelector(`[data-cafe-id="${cafeId}"]`);

        if (!card) return;

        const isInFavoritesPage = document.querySelector('#favoriteCarousel'); // 이 요소가 있을 경우만

        if (isInFavoritesPage && card.closest('#favoriteCarousel')) {
            // ✅ 찜한 생카 목록(favorites.html)에서만 카드 제거
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.remove();
                const carousel = document.getElementById('favoriteCarousel');
                if (carousel && carousel.children.length === 0) {
                    window.location.reload();  // 카드 없으면 빈 UI 리로드
                }
            }, 300);
        } else {
            // ✅ 홈 등에서는 카드 유지 (하트만 바뀌고 카드 그대로)
            this.updateFavoriteState(cafeId, false);
            this.updateAllButtons(cafeId, false);
        }
    }

};
document.addEventListener('DOMContentLoaded', () => {
    window.favoriteManager.init();
});
