
<!-- ✅ 카카오맵 API 로드 -->
<script type="text/javascript" src="https://dapi.kakao.com/v2/maps/sdk.js?appkey={{ kakao_api_key }}"></script>

<!-- ✅ Django 데이터를 JavaScript 변수로 전달 -->
<script id="cafe-data" type="application/json">
{
    "latitude": {{ cafe.latitude|default:"37.5665" }},
    "longitude": {{ cafe.longitude|default:"126.9780" }},
    "name": "{{ cafe.cafe_name|escapejs }}",
    "address": "{{ cafe.address|escapejs }}",
    "id": {{ cafe.id }},
    "isAuthenticated": {% if user.is_authenticated %}true{% else %}false{% endif %},
    "apiKey": "{{ kakao_api_key|escapejs }}"
}
</script>

<!-- ✅ 이미지 갤러리 JavaScript -->
<script>
let currentImageIndex = 0;
let currentModalIndex = 0;
const totalImages = {{ cafe.get_all_images|length }};
const imageData = [
  {% for image in cafe.get_all_images %}
  {
    url: "{{ image.url|escapejs }}",
    type: "{{ image.type_display|escapejs }}",
    caption: "{{ image.caption|escapejs }}",
    alt: "{{ image.caption|default:cafe.cafe_name|escapejs }}"
  }{% if not forloop.last %},{% endif %}
  {% endfor %}
];

function showGalleryImage(index) {
    if (index < 0 || index >= totalImages) return;
    
    const slides = document.querySelectorAll('.gallery-slide');
    const dots = document.querySelectorAll('.gallery-dot');
    const counter = document.getElementById('imageCounter');
    
    // 모든 슬라이드 숨기기
    slides.forEach(slide => slide.classList.remove('opacity-100'));
    slides.forEach(slide => slide.classList.add('opacity-0'));
    
    // 모든 점 비활성화
    dots.forEach(dot => dot.classList.remove('bg-white'));
    dots.forEach(dot => dot.classList.add('bg-white/50'));
    
    // 현재 슬라이드와 점 활성화
    if (slides[index]) {
        slides[index].classList.remove('opacity-0');
        slides[index].classList.add('opacity-100');
    }
    
    if (dots[index]) {
        dots[index].classList.remove('bg-white/50');
        dots[index].classList.add('bg-white');
    }
    
    // 카운터 업데이트
    if (counter) {
        counter.textContent = index + 1;
    }
    
    currentImageIndex = index;
}

function nextGalleryImage() {
    const nextIndex = (currentImageIndex + 1) % totalImages;
    showGalleryImage(nextIndex);
}

function prevGalleryImage() {
    const prevIndex = (currentImageIndex - 1 + totalImages) % totalImages;
    showGalleryImage(prevIndex);
}

// ✅ 이미지 모달 기능
function openImageModal(index = 0) {
    if (totalImages === 0) return;
    
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalImageTitle');
    const modalCaption = document.getElementById('modalImageCaption');
    const modalCounter = document.getElementById('modalImageCounter');
    
    if (!modal || !modalImage) return;
    
    // 모달 표시
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 스크롤 방지
    
    // 이미지 로드
    currentModalIndex = index;
    updateModalImage();
    
    // ESC 키로 닫기
    document.addEventListener('keydown', handleModalKeydown);
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // 스크롤 복원
        document.removeEventListener('keydown', handleModalKeydown);
    }
}

function updateModalImage() {
    if (currentModalIndex < 0 || currentModalIndex >= totalImages) return;
    
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalImageTitle');
    const modalCaption = document.getElementById('modalImageCaption');
    const modalCounter = document.getElementById('modalImageCounter');
    
    const image = imageData[currentModalIndex];
    
    if (modalImage) {
        modalImage.src = image.url;
        modalImage.alt = image.alt;
    }
    
    if (modalTitle) {
        modalTitle.textContent = image.type;
    }
    
    if (modalCaption) {
        modalCaption.textContent = image.caption || '';
        modalCaption.style.display = image.caption ? 'block' : 'none';
    }
    
    if (modalCounter) {
        modalCounter.textContent = currentModalIndex + 1;
    }
}

function nextModalImage() {
    currentModalIndex = (currentModalIndex + 1) % totalImages;
    updateModalImage();
}

function prevModalImage() {
    currentModalIndex = (currentModalIndex - 1 + totalImages) % totalImages;
    updateModalImage();
}

function handleModalKeydown(e) {
    switch(e.key) {
        case 'Escape':
            closeImageModal();
            break;
        case 'ArrowLeft':
            prevModalImage();
            break;
        case 'ArrowRight':
            nextModalImage();
            break;
    }
}

// 모달 배경 클릭으로 닫기
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeImageModal();
            }
        });
    }
});

// 자동 슬라이드 (8초마다, 모달이 열려있지 않을 때만)
if (totalImages > 1) {
    setInterval(() => {
        const modal = document.getElementById('imageModal');
        if (!modal || modal.classList.contains('hidden')) {
            nextGalleryImage();
        }
    }, 8000);
}

// 키보드 네비게이션 (갤러리용)
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('imageModal');
    if (modal && !modal.classList.contains('hidden')) return; // 모달이 열려있으면 무시
    
    if (e.key === 'ArrowLeft') {
        prevGalleryImage();
    } else if (e.key === 'ArrowRight') {
        nextGalleryImage();
    }
});

// ✅ 모바일 스와이프 제스처 지원
let touchStartX = 0;
let touchEndX = 0;

function handleGestureStart(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function handleGestureEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleGesture();
}

function handleGesture() {
    const swipeThreshold = 50; // 최소 스와이프 거리
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // 왼쪽으로 스와이프 -> 다음 이미지
            const modal = document.getElementById('imageModal');
            if (modal && !modal.classList.contains('hidden')) {
                nextModalImage();
            } else {
                nextGalleryImage();
            }
        } else {
            // 오른쪽으로 스와이프 -> 이전 이미지
            const modal = document.getElementById('imageModal');
            if (modal && !modal.classList.contains('hidden')) {
                prevModalImage();
            } else {
                prevGalleryImage();
            }
        }
    }
}

// 갤러리와 모달에 터치 이벤트 추가
document.addEventListener('DOMContentLoaded', function() {
    const gallery = document.getElementById('imageGallery');
    const modal = document.getElementById('imageModal');
    
    if (gallery) {
        gallery.addEventListener('touchstart', handleGestureStart, { passive: true });
        gallery.addEventListener('touchend', handleGestureEnd, { passive: true });
    }
    
    if (modal) {
        modal.addEventListener('touchstart', handleGestureStart, { passive: true });
        modal.addEventListener('touchend', handleGestureEnd, { passive: true });
        
        // 모달 배경 클릭으로 닫기
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeImageModal();
            }
        });
    }
});

// ✅ 이미지 로드 실패 처리
function handleImageError(img, fallbackSrc = null) {
    if (fallbackSrc) {
        img.src = fallbackSrc;
    } else {
        img.style.display = 'none';
        const parent = img.parentElement;
        if (parent) {
            parent.innerHTML = `
                <div class="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span class="text-gray-400 text-2xl">🖼️</span>
                </div>
            `;
        }
    }
}

// 이미지 로드 최적화
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('img[src]');
    images.forEach(img => {
        img.addEventListener('error', function() {
            handleImageError(this);
        });
        
        // 로딩 상태 표시
        img.addEventListener('load', function() {
            this.classList.remove('loading-pulse');
        });
        
        // 초기 로딩 상태
        if (!img.complete) {
            img.classList.add('loading-pulse');
        }
    });
    
    // ✅ 갤러리 썸네일에 타입별 스타일 적용
    applyImageTypeStyles();
});

// ✅ 이미지 타입별 스타일 적용
function applyImageTypeStyles() {
    const thumbnails = document.querySelectorAll('.gallery-thumbnail');
    thumbnails.forEach(thumbnail => {
        const typeLabel = thumbnail.querySelector('[class*="type-label"]');
        if (typeLabel) {
            const typeText = typeLabel.textContent.toLowerCase();
            
            // 타입별 배경 그라데이션 적용
            if (typeText.includes('메인')) {
                typeLabel.className += ' type-label-main';
            } else if (typeText.includes('포스터')) {
                typeLabel.className += ' type-label-poster';
                thumbnail.classList.add('poster-display');
            } else if (typeText.includes('메뉴')) {
                typeLabel.className += ' type-label-menu';
            } else if (typeText.includes('내부')) {
                typeLabel.className += ' type-label-interior';
            } else if (typeText.includes('외부')) {
                typeLabel.className += ' type-label-exterior';
            } else if (typeText.includes('굿즈')) {
                typeLabel.className += ' type-label-goods';
            } else if (typeText.includes('이벤트')) {
                typeLabel.className += ' type-label-event';
            } else {
                typeLabel.className += ' type-label-other';
            }
        }
    });
}

// ✅ 갤러리 반응형 그리드 클래스 적용
function updateGalleryGrid() {
    const galleryGrid = document.querySelector('.grid.grid-cols-2');
    if (!galleryGrid) return;
    
    const width = window.innerWidth;
    
    // 기존 그리드 클래스 제거
    galleryGrid.classList.remove('gallery-grid-mobile', 'gallery-grid-tablet', 'gallery-grid-desktop');
    
    // 화면 크기에 따른 그리드 클래스 추가
    if (width <= 768) {
        galleryGrid.classList.add('gallery-grid-mobile');
    } else if (width <= 1024) {
        galleryGrid.classList.add('gallery-grid-tablet');
    } else {
        galleryGrid.classList.add('gallery-grid-desktop');
    }
}

// 창 크기 변경 시 그리드 업데이트
window.addEventListener('resize', updateGalleryGrid);

// 초기 로드 시 그리드 설정
document.addEventListener('DOMContentLoaded', updateGalleryGrid);

// ✅ 갤러리 썸네일 lazy loading (성능 최적화)
function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.classList.remove('loading-pulse');
                        observer.unobserve(img);
                    }
                }
            });
        });

        // 갤러리 섹션의 이미지들에만 적용
        const galleryImages = document.querySelectorAll('.gallery-thumbnail img[data-src]');
        galleryImages.forEach(img => imageObserver.observe(img));
    }
}

// 페이지 로드 후 lazy loading 초기화
document.addEventListener('DOMContentLoaded', initLazyLoading);
</script>

<script>
// ✅ 수정된 JavaScript 코드
let map;
let marker;

// JSON에서 데이터 가져오기
function getCafeData() {
    try {
        const cafeDataElement = document.getElementById('cafe-data');
        if (!cafeDataElement) {
            console.error('cafe-data 엘리먼트를 찾을 수 없습니다.');
            return null;
        }
        
        const textContent = cafeDataElement.textContent;
        if (!textContent) {
            console.error('cafe-data가 비어있습니다.');
            return null;
        }
        
        return JSON.parse(textContent);
    } catch (error) {
        console.error('카페 데이터 파싱 오류:', error);
        return null;
    }
}

// 지도 초기화 함수
function initMap() {
    const cafeData = getCafeData();
    if (!cafeData) {
        console.error('카페 데이터를 가져올 수 없습니다.');
        showMapError('카페 데이터를 불러올 수 없습니다.');
        return;
    }
    
    // 카카오맵 API 로드 확인
    if (typeof kakao === 'undefined' || !kakao.maps) {
        console.error('카카오맵 API가 로드되지 않았습니다. API 키를 확인하세요.');
        showMapError('카카오맵 API 로드 실패<br>API 키를 확인해주세요.');
        return;
    }
    
    try {
        const container = document.getElementById('map');
        if (!container) {
            console.error('지도 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        const options = {
            center: new kakao.maps.LatLng(cafeData.latitude, cafeData.longitude),
            level: 3
        };
        
        map = new kakao.maps.Map(container, options);
        
        // 마커 생성
        const markerPosition = new kakao.maps.LatLng(cafeData.latitude, cafeData.longitude);
        marker = new kakao.maps.Marker({
            position: markerPosition,
            map: map
        });
        
        // 인포윈도우 생성
        const infowindow = new kakao.maps.InfoWindow({
            content: `
                <div style="padding:10px; font-size:12px; width:200px;">
                    <strong>${cafeData.name}</strong><br>
                    ${cafeData.address}
                </div>
            `
        });
        
        infowindow.open(map, marker);
        
        console.log('지도 초기화 완료');
        
    } catch (error) {
        console.error('지도 초기화 오류:', error);
        showMapError('지도 초기화 중 오류가 발생했습니다.');
    }
}

// 지도 오류 표시 함수
function showMapError(message) {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div class="flex items-center justify-center h-full bg-gray-100 text-gray-600">
                <div class="text-center">
                    <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <p class="text-sm">${message}</p>
                    <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                        새로고침
                    </button>
                </div>
            </div>
        `;
    }
}

// 카카오맵에서 보기
function openKakaoMap() {
    const cafeData = getCafeData();
    if (!cafeData) return;
    
    const url = `https://map.kakao.com/link/map/${cafeData.name},${cafeData.latitude},${cafeData.longitude}`;
    window.open(url, '_blank');
}

// 주소 복사
function copyAddress() {
    const cafeData = getCafeData();
    if (!cafeData) return;
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(cafeData.address).then(() => {
            showToast('주소가 복사되었습니다!', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(cafeData.address);
        });
    } else {
        fallbackCopyToClipboard(cafeData.address);
    }
}

// 클립보드 복사 대체 함수
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('주소가 복사되었습니다!', 'success');
    } catch (err) {
        console.error('복사 실패:', err);
        showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
}

// 링크 복사
function copyLink() {
    const currentUrl = window.location.href;
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(currentUrl).then(() => {
            showToast('링크가 복사되었습니다!', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(currentUrl);
        });
    } else {
        fallbackCopyToClipboard(currentUrl);
    }
}

// 토스트 메시지 표시
function showToast(message, type = 'info') {
    // 기존 토스트 제거
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-all duration-300 transform';

    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-gray-900',
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

// 카카오톡 공유 (추후 구현)
function shareKakao() {
    showToast('카카오톡 공유 기능은 SDK 설정 후 사용 가능합니다.', 'info');
}

// ✅ 페이지 로드 완료 후 지도 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 카카오맵 API 로드 확인 후 지도 초기화
    if (typeof kakao !== 'undefined' && kakao.maps) {
        initMap();
    } else {
        // API가 로드되지 않은 경우 재시도
        console.warn('카카오맵 API 로드 대기 중...');
        let retryCount = 0;
        const maxRetries = 10;
        
        const checkKakaoLoaded = setInterval(() => {
            retryCount++;
            if (typeof kakao !== 'undefined' && kakao.maps) {
                clearInterval(checkKakaoLoaded);
                initMap();
            } else if (retryCount >= maxRetries) {
                clearInterval(checkKakaoLoaded);
                console.error('카카오맵 API 로드 실패');
                showMapError('카카오맵 API 로드 실패<br>새로고침을 시도해주세요.');
            }
        }, 100); // 100ms마다 확인
    }
});

// ✅ 디버깅 정보 출력
console.log('Detail 페이지 JavaScript 로드됨');
console.log('API 키 존재:', '{{ kakao_api_key }}' ? 'Yes' : 'No');
console.log('카페 좌표:', {{ cafe.latitude|default:"null" }}, {{ cafe.longitude|default:"null" }});
</script>

<!-- CSRF 토큰 -->
{% csrf_token %}

<!-- 사용자 데이터 전달 (숨겨진 div 방식) -->
<div id="user-data" 
     data-authenticated="{% if user.is_authenticated %}true{% else %}false{% endif %}"
     data-cafe-id="{{ cafe.id }}"
     data-is-favorited="{% if is_favorited %}true{% else %}false{% endif %}"
     style="display: none;">
</div>

