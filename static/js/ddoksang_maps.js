// static/js/ddoksang_map.js
// 모든 페이지에서 사용할 수 있는 통합 지도 모듈

(function(window) {
    'use strict';

    // 네임스페이스 생성
    window.DdoksangMap = window.DdoksangMap || {};

    // 상수 및 설정
    const CONFIG = {
        DEFAULT_CENTER: { lat: 37.5665, lng: 126.9780 }, // 서울 시청
        DEFAULT_LEVEL: 8,
        MOBILE_LEVEL: 9,
        KOREA_BOUNDS: {
            lat_min: 33.0,
            lat_max: 43.0,
            lng_min: 124.0,
            lng_max: 132.0
        },
        MARKER_COLORS: {
            CAFE: '#ef4444',
            USER: '#3b82f6',
            SELECTED: '#10b981'
        }
    };

    // 전역 변수
    let map = null;
    let clusterer = null;
    let markers = [];
    let userLocationMarker = null;
    let isClusteringEnabled = true;
    let cafesData = [];

    /**
     * 지도 유틸리티 클래스
     */
    class MapUtils {
        /**
         * 좌표 유효성 검사
         */
        static validateCoordinates(lat, lng) {
            try {
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lng);
                
                if (isNaN(latitude) || isNaN(longitude)) return false;
                if (latitude < CONFIG.KOREA_BOUNDS.lat_min || latitude > CONFIG.KOREA_BOUNDS.lat_max) return false;
                if (longitude < CONFIG.KOREA_BOUNDS.lng_min || longitude > CONFIG.KOREA_BOUNDS.lng_max) return false;
                
                return true;
            } catch (error) {
                return false;
            }
        }

        /**
         * 거리 계산 (Haversine 공식)
         */
        static calculateDistance(lat1, lng1, lat2, lng2) {
            if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.services) {
                const pos1 = new kakao.maps.LatLng(lat1, lng1);
                const pos2 = new kakao.maps.LatLng(lat2, lng2);
                return kakao.maps.services.Util.getDistance(pos1, pos2);
            }
            
            // 백업용 Haversine 공식
            const R = 6371000; // 지구 반지름 (미터)
            const rad1 = lat1 * Math.PI / 180;
            const rad2 = lat2 * Math.PI / 180;
            const deltaLat = (lat2 - lat1) * Math.PI / 180;
            const deltaLng = (lng2 - lng1) * Math.PI / 180;

            const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                      Math.cos(rad1) * Math.cos(rad2) *
                      Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            return R * c;
        }

        /**
         * 모바일 기기 확인
         */
        static isMobile() {
            return window.innerWidth < 768;
        }

        /**
         * 토스트 메시지 표시
         */
        static showToast(message, type = 'info') {
            const existing = document.querySelector('.ddoksang-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'ddoksang-toast fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-all duration-300 transform';

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
    }

    /**
     * 마커 관리 클래스
     */
    class MarkerManager {
        /**
         * 카페 마커용 SVG 생성
         */
        static createCafeMarkerSvg(color = CONFIG.MARKER_COLORS.CAFE) {
            return `
                <svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'>
                    <path d='M16 0C7.163 0 0 7.163 0 16s16 24 16 24 16-15.163 16-24S24.837 0 16 0z' fill='${color}'/>
                    <circle cx='16' cy='16' r='8' fill='white'/>
                    <text x='16' y='20' text-anchor='middle' font-family='Arial' font-size='12' font-weight='bold' fill='${color}'>🎂</text>
                </svg>`;
        }

        /**
         * 사용자 위치 마커용 SVG 생성
         */
        static createUserMarkerSvg() {
            return `
                <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
                    <circle cx='12' cy='12' r='10' fill='${CONFIG.MARKER_COLORS.USER}' stroke='white' stroke-width='2'/>
                    <circle cx='12' cy='12' r='4' fill='white'/>
                </svg>`;
        }

        /**
         * 카카오 마커 이미지 생성
         */
        static createMarkerImage(svgString, width = 32, height = 40, offsetX = 16, offsetY = 40) {
            const imageSrc = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
            const imageSize = new kakao.maps.Size(width, height);
            const imageOption = { offset: new kakao.maps.Point(offsetX, offsetY) };
            return new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
        }

        /**
         * 카페 마커들 생성
         */
        static createCafeMarkers(cafesData, onMarkerClick) {
            const newMarkers = [];
            
            cafesData.forEach((cafe) => {
                try {
                    if (!MapUtils.validateCoordinates(cafe.latitude, cafe.longitude)) {
                        return;
                    }
                    
                    const position = new kakao.maps.LatLng(cafe.latitude, cafe.longitude);
                    const markerImage = this.createMarkerImage(this.createCafeMarkerSvg());
                    
                    const marker = new kakao.maps.Marker({
                        position: position,
                        image: markerImage,
                        title: cafe.name || cafe.cafe_name || '생일카페'
                    });
                    
                    // 마커 클릭 이벤트
                    if (onMarkerClick) {
                        kakao.maps.event.addListener(marker, 'click', function() {
                            onMarkerClick(cafe);
                        });
                    }
                    
                    newMarkers.push(marker);
                    
                } catch (error) {
                    console.error('마커 생성 오류:', error);
                }
            });
            
            return newMarkers;
        }

        /**
         * 사용자 위치 마커 생성
         */
        static createUserLocationMarker(lat, lng) {
            const position = new kakao.maps.LatLng(lat, lng);
            const markerImage = this.createMarkerImage(
                this.createUserMarkerSvg(), 24, 24, 12, 12
            );
            
            return new kakao.maps.Marker({
                position: position,
                image: markerImage,
                title: '내 위치'
            });
        }
    }

    /**
     * 메인 지도 관리 클래스
     */
    class MapManager {
        constructor(containerId, options = {}) {
            this.containerId = containerId;
            this.options = {
                center: options.center || CONFIG.DEFAULT_CENTER,
                level: options.level || (MapUtils.isMobile() ? CONFIG.MOBILE_LEVEL : CONFIG.DEFAULT_LEVEL),
                enableClustering: options.enableClustering !== false,
                ...options
            };
            
            this.map = null;
            this.clusterer = null;
            this.markers = [];
            this.userLocationMarker = null;
            this.isClusteringEnabled = this.options.enableClustering;
        }

        /**
         * 지도 초기화
         */
        async init() {
            try {
                await this.waitForKakaoAPI();
                this.createMap();
                this.createClusterer();
                this.hideLoading();
                console.log('지도 초기화 완료');
                return true;
            } catch (error) {
                console.error('지도 초기화 실패:', error);
                this.showError('지도 초기화에 실패했습니다.');
                return false;
            }
        }

        /**
         * 카카오맵 API 로드 대기
         */
        waitForKakaoAPI() {
            return new Promise((resolve, reject) => {
                if (typeof kakao !== 'undefined' && kakao.maps) {
                    resolve();
                    return;
                }

                let attempts = 0;
                const maxAttempts = 50;
                
                const checkAPI = () => {
                    attempts++;
                    if (typeof kakao !== 'undefined' && kakao.maps) {
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        reject(new Error('카카오맵 API 로드 타임아웃'));
                    } else {
                        setTimeout(checkAPI, 100);
                    }
                };
                
                checkAPI();
            });
        }

        /**
         * 지도 생성
         */
        createMap() {
            const container = document.getElementById(this.containerId);
            if (!container) {
                throw new Error('지도 컨테이너를 찾을 수 없습니다.');
            }

            const mapOption = {
                center: new kakao.maps.LatLng(this.options.center.lat, this.options.center.lng),
                level: this.options.level
            };

            this.map = new kakao.maps.Map(container, mapOption);
            
            // 전역 변수에도 할당 (하위 호환성)
            window.map = this.map;
        }

        /**
         * 클러스터러 생성
         */
        createClusterer() {
            if (typeof kakao.maps.MarkerClusterer === 'undefined') {
                console.warn('MarkerClusterer를 사용할 수 없습니다.');
                return;
            }

            this.clusterer = new kakao.maps.MarkerClusterer({
                map: this.map,
                averageCenter: true,
                minLevel: MapUtils.isMobile() ? 7 : 6,
                disableClickZoom: true,
                styles: this.getClusterStyles()
            });

            // 클러스터 클릭 이벤트
            kakao.maps.event.addListener(this.clusterer, 'clusterclick', (cluster) => {
                const level = this.map.getLevel() - 2;
                this.map.setLevel(level, { anchor: cluster.getCenter() });
            });

            // 전역 변수에도 할당 (하위 호환성)
            window.clusterer = this.clusterer;
        }

        /**
         * 클러스터 스타일 반환
         */
        getClusterStyles() {
            const baseSize = MapUtils.isMobile() ? 32 : 40;
            return [
                {
                    width: `${baseSize}px`,
                    height: `${baseSize}px`,
                    background: 'rgba(59, 130, 246, 0.8)',
                    borderRadius: '50%',
                    color: '#fff',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: MapUtils.isMobile() ? '12px' : '14px',
                    lineHeight: `${baseSize}px`
                },
                {
                    width: `${baseSize + 10}px`,
                    height: `${baseSize + 10}px`,
                    background: 'rgba(147, 51, 234, 0.8)',
                    borderRadius: '50%',
                    color: '#fff',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: MapUtils.isMobile() ? '14px' : '16px',
                    lineHeight: `${baseSize + 10}px`
                },
                {
                    width: `${baseSize + 20}px`,
                    height: `${baseSize + 20}px`,
                    background: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: '50%',
                    color: '#fff',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: MapUtils.isMobile() ? '16px' : '18px',
                    lineHeight: `${baseSize + 20}px`
                }
            ];
        }

        /**
         * 카페 데이터 로드 및 마커 생성
         */
        loadCafes(cafesData, onMarkerClick) {
            this.markers = MarkerManager.createCafeMarkers(cafesData, onMarkerClick);
            this.updateMarkersDisplay();
            
            // 전역 변수에도 할당 (하위 호환성)
            window.markers = this.markers;
            window.cafesData = cafesData;
            
            console.log(`마커 생성 완료: ${this.markers.length}개`);
        }

        /**
         * 마커 표시 방식 업데이트
         */
        updateMarkersDisplay() {
            if (this.isClusteringEnabled && this.clusterer) {
                // 기존 마커들 제거
                this.markers.forEach(marker => marker.setMap(null));
                // 클러스터러에 추가
                this.clusterer.addMarkers(this.markers);
            } else {
                // 클러스터러에서 제거
                if (this.clusterer) {
                    this.clusterer.clear();
                }
                // 개별 마커로 표시
                this.markers.forEach(marker => marker.setMap(this.map));
            }
        }

        /**
         * 클러스터링 토글
         */
        toggleClustering() {
            this.isClusteringEnabled = !this.isClusteringEnabled;
            this.updateMarkersDisplay();
            
            // 전역 변수 동기화
            window.isClusteringEnabled = this.isClusteringEnabled;
            
            return this.isClusteringEnabled;
        }

        /**
         * 사용자 위치로 이동
         */
        moveToUserLocation(successCallback, errorCallback) {
            if (!navigator.geolocation) {
                const error = new Error('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
                if (errorCallback) errorCallback(error);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    this.setCenter(lat, lng, 6);
                    this.addUserLocationMarker(lat, lng);
                    
                    if (successCallback) {
                        successCallback({ lat, lng });
                    }
                },
                (error) => {
                    if (errorCallback) errorCallback(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                }
            );
        }

        /**
         * 사용자 위치 마커 추가
         */
        addUserLocationMarker(lat, lng) {
            // 기존 사용자 위치 마커 제거
            if (this.userLocationMarker) {
                this.userLocationMarker.setMap(null);
            }

            this.userLocationMarker = MarkerManager.createUserLocationMarker(lat, lng);
            this.userLocationMarker.setMap(this.map);

            // 정보창 생성
            const infoWindow = new kakao.maps.InfoWindow({
                content: '<div style="padding:5px;font-size:12px;">📍 내 위치</div>'
            });

            kakao.maps.event.addListener(this.userLocationMarker, 'click', () => {
                infoWindow.open(this.map, this.userLocationMarker);
            });

            // 전역 변수에도 할당
            window.userLocationMarker = this.userLocationMarker;
        }

        /**
         * 지도 중심 이동
         */
        setCenter(lat, lng, level) {
            const position = new kakao.maps.LatLng(lat, lng);
            this.map.setCenter(position);
            if (level) {
                this.map.setLevel(level);
            }
        }

        /**
         * 특정 위치로 이동
         */
        moveToLocation(lat, lng, level = 5) {
            this.setCenter(lat, lng, level);
        }

        /**
         * 로딩 숨기기
         */
        hideLoading() {
            const loadingEl = document.getElementById('mapLoading');
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }

        /**
         * 오류 표시
         */
        showError(message) {
            const loadingEl = document.getElementById('mapLoading');
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="text-center">
                        <p class="text-red-600 text-sm">${message}</p>
                        <button onclick="location.reload()" class="mt-3 px-4 py-2 bg-gray-600 text-white rounded text-sm">새로고침</button>
                    </div>
                `;
            }
        }

        /**
         * 지도 리사이즈
         */
        relayout() {
            if (this.map) {
                this.map.relayout();
            }
        }
    }

    /**
     * 주변 카페 관리 클래스
     */
    class NearbyManager {
        static findNearbyCafes(userLat, userLng, cafesData, radiusKm = 3) {
            return cafesData.filter(cafe => {
                if (!MapUtils.validateCoordinates(cafe.latitude, cafe.longitude)) {
                    return false;
                }

                const distance = MapUtils.calculateDistance(
                    userLat, userLng, cafe.latitude, cafe.longitude
                );

                return distance <= radiusKm * 1000; // km를 m로 변환
            }).map(cafe => {
                const distance = MapUtils.calculateDistance(
                    userLat, userLng, cafe.latitude, cafe.longitude
                );
                
                return {
                    ...cafe,
                    distance: Math.round(distance),
                    walkTime: Math.round(distance / 80) // 도보 시간 (평균 속도 80m/분)
                };
            }).sort((a, b) => a.distance - b.distance);
        }

        static displayNearbyCafes(nearbyCafes, containerId, onCafeClick) {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = '';

            if (nearbyCafes.length === 0) {
                container.innerHTML = '<div class="text-center text-gray-500 py-4"><p class="text-sm">주변에 운영중인 생카가 없습니다.</p></div>';
                return;
            }

            nearbyCafes.forEach(cafe => {
                const item = document.createElement('div');
                item.className = 'border border-gray-200 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';

                const cafeName = cafe.name || cafe.cafe_name || '생일카페';
                const artistName = cafe.artist || '';
                const memberName = cafe.member || '';
                const address = cafe.address || '';
                const mainImage = cafe.main_image || '';

                item.innerHTML = `
                    <div class="flex items-start space-x-3">
                        ${mainImage ? 
                            `<img src="${mainImage}" alt="${cafeName}" class="w-12 h-12 object-cover rounded-lg flex-shrink-0">` :
                            '<div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><span class="text-gray-400 text-sm">🎂</span></div>'
                        }
                        <div class="flex-1 min-w-0">
                            <h4 class="font-medium text-sm text-gray-900 truncate">${cafeName}</h4>
                            <p class="text-xs text-gray-600 truncate">${artistName}${memberName ? ` - ${memberName}` : ''}</p>
                            <p class="text-xs text-gray-500 truncate mt-1">${address}</p>
                            <div class="flex items-center space-x-2 mt-2">
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${cafe.distance}m</span>
                                <span class="text-xs text-gray-500">도보 ${cafe.walkTime}분</span>
                            </div>
                        </div>
                    </div>
                `;

                if (onCafeClick) {
                    item.addEventListener('click', () => onCafeClick(cafe));
                }

                container.appendChild(item);
            });
        }
    }

    // 전역 함수들 (하위 호환성)
    window.DdoksangMap = {
        MapManager,
        MarkerManager,
        MapUtils,
        NearbyManager,
        CONFIG,

        // 편의 함수들
        createMap: (containerId, options) => new MapManager(containerId, options),
        showToast: MapUtils.showToast,
        calculateDistance: MapUtils.calculateDistance,
        validateCoordinates: MapUtils.validateCoordinates,
        findNearbyCafes: NearbyManager.findNearbyCafes,
        displayNearbyCafes: NearbyManager.displayNearbyCafes
    };

    // 전역 변수들 (하위 호환성)
    window.map = null;
    window.clusterer = null;
    window.markers = [];
    window.userLocationMarker = null;
    window.isClusteringEnabled = true;
    window.cafesData = [];

})(window);