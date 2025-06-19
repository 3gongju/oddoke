// ddoksang_toast.js - 개선된 토스트 메시지 시스템

window.ddoksangToast = {
    show(message, type = 'info', duration = 3000) {
        // 기존 토스트 제거
        const existing = document.querySelector('.ddoksang-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'ddoksang-toast';
        
        const colors = {
            success: '#10b981',
            warning: '#f59e0b', 
            error: '#ef4444',
            info: '#3b82f6'
        };

        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: colors[type] || colors.info,
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '9999',
            opacity: '0',
            transition: 'all 0.3s ease',
            maxWidth: '90vw',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        // 아이콘과 메시지 설정
        const icon = document.createElement('span');
        icon.textContent = icons[type] || icons.info;
        icon.style.fontSize = '16px';

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(messageSpan);

        document.body.appendChild(toast);

        // 애니메이션
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
        });

        // 자동 제거
        const timeoutId = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(0px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);

        // 클릭으로 즉시 제거
        toast.addEventListener('click', () => {
            clearTimeout(timeoutId);
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(0px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });

        // 호버 시 자동 제거 일시정지
        let isPaused = false;
        toast.addEventListener('mouseenter', () => {
            isPaused = true;
            clearTimeout(timeoutId);
        });

        toast.addEventListener('mouseleave', () => {
            if (isPaused) {
                isPaused = false;
                setTimeout(() => {
                    if (toast.parentNode && !isPaused) {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translateX(-50%) translateY(0px)';
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.parentNode.removeChild(toast);
                            }
                        }, 300);
                    }
                }, 1000);
            }
        });

        return toast;
    },

    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    },

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    },

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    },

    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
};

// 전역 함수로도 제공 (하위 호환성)
window.showToast = function(message, type = 'info', duration) {
    return window.ddoksangToast.show(message, type, duration);
};

// 단축 함수들
window.showSuccessToast = function(message, duration) {
    return window.ddoksangToast.success(message, duration);
};

window.showWarningToast = function(message, duration) {
    return window.ddoksangToast.warning(message, duration);
};

window.showErrorToast = function(message, duration) {
    return window.ddoksangToast.error(message, duration);
};

window.showInfoToast = function(message, duration) {
    return window.ddoksangToast.info(message, duration);
};