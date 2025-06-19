window.ddoksangToast = {
    show(message, type = 'info') {
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

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: colors[type] || colors.info,
            color: 'white',
            padding: '12px 20px',
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '9999',
            opacity: '0',
            transition: 'opacity 0.3s ease',
            maxWidth: '90vw',
            textAlign: 'center'
        });

        toast.textContent = message;
        document.body.appendChild(toast);

        // 애니메이션
        requestAnimationFrame(() => (toast.style.opacity = '1'));

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);

        return toast;
    }
};

// 전역 함수로도 제공 (하위 호환성)
window.showToast = function(message, type = 'info') {
    return window.ddoksangToast.show(message, type);
};