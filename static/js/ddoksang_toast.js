// static/js/ddoksang_toast.js
// 개선된 토스트 메시지 시스템

class DdoksangToast {
    constructor() {
        this.toasts = new Map();
        this.maxToasts = 3;
        this.defaultDuration = 3000;
        this.init();
    }

    init() {
        // 토스트 컨테이너 생성
        this.createToastContainer();
        console.log('✅ 토스트 시스템 초기화 완료');
    }

    createToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none';
            container.style.maxWidth = '300px';
            document.body.appendChild(container);
        }
        this.container = container;
    }

    show(message, type = 'info', duration = null) {
        if (!message || typeof message !== 'string') {
            console.warn('⚠️ 토스트 메시지가 유효하지 않습니다:', message);
            return;
        }

        // 중복 메시지 방지
        const messageKey = `${type}-${message}`;
        if (this.toasts.has(messageKey)) {
            console.log('🔄 중복 토스트 메시지 무시:', message);
            return;
        }

        // 최대 토스트 수 제한
        if (this.toasts.size >= this.maxToasts) {
            this.removeOldestToast();
        }

        const toastId = this.generateId();
        const toast = this.createToast(toastId, message, type);
        
        this.toasts.set(messageKey, {
            id: toastId,
            element: toast,
            type: type,
            message: message,
            createdAt: Date.now()
        });

        this.container.appendChild(toast);
        this.animateIn(toast);

        // 자동 제거
        const finalDuration = duration || this.defaultDuration;
        setTimeout(() => {
            this.remove(messageKey);
        }, finalDuration);

        console.log(`📢 토스트 표시: [${type.toUpperCase()}] ${message}`);
        return toastId;
    }

    createToast(id, message, type) {
        const toast = document.createElement('div');
        toast.id = `toast-${id}`;
        toast.className = `toast-item relative transform translate-x-full opacity-0 transition-all duration-300 ease-out pointer-events-auto max-w-sm w-full bg-white shadow-lg rounded-lg overflow-hidden border-l-4`;
        
        // 타입별 색상과 아이콘
        const config = this.getTypeConfig(type);
        toast.classList.add(config.borderColor);
        
        toast.innerHTML = `
            <div class="p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center ${config.iconBg}">
                            ${config.icon}
                        </div>
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900 break-words">
                            ${this.escapeHtml(message)}
                        </p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button onclick="window.ddoksangToast.removeById('${id}')" 
                                class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-600 focus:outline-none transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <!-- 진행 바 -->
                <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                    <div class="h-full ${config.progressBar} toast-progress" 
                         style="width: 100%; animation: toast-progress ${this.defaultDuration}ms linear;"></div>
                </div>
            </div>
        `;

        // 클릭으로 닫기
        toast.addEventListener('click', (e) => {
            if (e.target.closest('button')) return; // 버튼 클릭은 제외
            this.removeById(id);
        });

        return toast;
    }

    getTypeConfig(type) {
        const configs = {
            success: {
                borderColor: 'border-green-500',
                iconBg: 'bg-green-100',
                progressBar: 'bg-green-500',
                icon: '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
            },
            error: {
                borderColor: 'border-red-500',
                iconBg: 'bg-red-100',
                progressBar: 'bg-red-500',
                icon: '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
            },
            warning: {
                borderColor: 'border-yellow-500',
                iconBg: 'bg-yellow-100',
                progressBar: 'bg-yellow-500',
                icon: '<svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>'
            },
            info: {
                borderColor: 'border-blue-500',
                iconBg: 'bg-blue-100',
                progressBar: 'bg-blue-500',
                icon: '<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
            }
        };

        return configs[type] || configs.info;
    }

    animateIn(toast) {
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
            toast.classList.add('translate-x-0', 'opacity-100');
        });
    }

    animateOut(toast) {
        return new Promise((resolve) => {
            toast.classList.remove('translate-x-0', 'opacity-100');
            toast.classList.add('translate-x-full', 'opacity-0');
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                resolve();
            }, 300);
        });
    }

    remove(messageKey) {
        const toastData = this.toasts.get(messageKey);
        if (!toastData) return;

        this.animateOut(toastData.element).then(() => {
            this.toasts.delete(messageKey);
            console.log(`🗑️ 토스트 제거: ${toastData.message}`);
        });
    }

    removeById(id) {
        for (const [key, data] of this.toasts.entries()) {
            if (data.id === id) {
                this.remove(key);
                break;
            }
        }
    }

    removeOldestToast() {
        let oldest = null;
        let oldestTime = Date.now();

        for (const [key, data] of this.toasts.entries()) {
            if (data.createdAt < oldestTime) {
                oldestTime = data.createdAt;
                oldest = key;
            }
        }

        if (oldest) {
            this.remove(oldest);
        }
    }

    clear() {
        const keys = Array.from(this.toasts.keys());
        keys.forEach(key => this.remove(key));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 편의 메서드들
    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// CSS 스타일 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes toast-progress {
        from { width: 100%; }
        to { width: 0%; }
    }
    
    .toast-item {
        backdrop-filter: blur(8px);
    }
    
    .toast-item:hover .toast-progress {
        animation-play-state: paused;
    }
    
    /* 모바일 대응 */
    @media (max-width: 640px) {
        #toast-container {
            bottom: 1rem;
            right: 1rem;
            left: 1rem;
            max-width: none;
        }
        
        .toast-item {
            max-width: none;
            width: 100%;
        }
    }
`;
document.head.appendChild(style);

// 전역 인스턴스 생성
window.ddoksangToast = new DdoksangToast();

// 하위 호환성을 위한 전역 함수들
window.showToast = function(message, type = 'info', duration = null) {
    return window.ddoksangToast.show(message, type, duration);
};

window.showSuccessToast = function(message, duration) {
    return window.ddoksangToast.success(message, duration);
};

window.showErrorToast = function(message, duration) {
    return window.ddoksangToast.error(message, duration);
};

window.showWarningToast = function(message, duration) {
    return window.ddoksangToast.warning(message, duration);
};

window.showInfoToast = function(message, duration) {
    return window.ddoksangToast.info(message, duration);
};

console.log('✅ DdoksangToast 시스템 로드 완료');