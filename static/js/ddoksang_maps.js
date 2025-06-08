// static/js/ddoksang_maps.js
// 덕생 지도 통합 모듈 - 간소화 및 최적화 버전

(function(window) {
    'use strict';

    // 네임스페이스 생성
    window.DdoksangMap = window.DdoksangMap || {};

    // 설정 상수
    const CONFIG = {
        DEFAULT_CENTER: { lat: 37.5665, lng: 126.9780 }, // 서울 시청
        DEFAULT_LEVEL: 8,
        MOBILE_LEVEL: 9,
        USER_LOCATION_LEVEL: 6,
        KOREA_BOUNDS: {
            lat_min: 33.0, lat_max: 43.0,
            lng_min: 124.0, lng_max: 132.0
        }
    };

    // 전역 상태
    let mapInstance = null;
    let clustererInstance = null;
    let currentMarkers = [];
    let userLocationMarker = null;
    let isClusteringEnabled = true;

    /**
     * 유틸리티 함수들
     */
    const Utils = {
        // 좌표 유효성 검사
        validateCoordinates(lat, lng) {
            try {
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lng);
                
                if (isNaN(latitude) || isNaN(longitude)) return false;
                
                return latitude >= CONFIG.KOREA_BOUNDS.lat_min && 
                       latitude <= CONFIG.KOREA_BOUNDS.lat_max &&
                       longitude >= CONFIG.KOREA_BOUNDS.lng_min && 
                       longitude <= CONFIG.KOREA_BOUNDS.lng_max;
            } catch {
                return false;
            }
        },

        // 모바일 기기 확인
        isMobile() {
            return window.innerWidth < 768;
        },

        // 토스트 메시지
        showToast(message, type = 'info') {
            const existing = document.querySelector('.ddoksang-toast');
            if (existing) existing.remove();

            const colors = {
                success: 'bg-green-500',
                error: 'bg-red-500', 
                warning: 'bg-yellow-500',
                info: 'bg-blue-500'
            };

            const toast = document.createElement('div');
            toast.className = `ddoksang-toast fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-all duration-300 transform ${colors[type] || colors.info}`;
            toast.textContent = message;
            toast.style.transform = 'translateX(100%)';

            document.body.appendChild(toast);

            setTimeout(() => toast.style.transform = 'translateX(0)', 50);
            setTimeout(() => {
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        // 거리 계산
        calculateDistance(lat1, lng1, lat2, lng2) {
            if (typeof kakao !== 'undefined' && kakao.maps?.services) {
                const pos1 = new kakao.maps.LatLng(lat1, lng1);
                const pos2 = new kakao.maps.LatLng(lat2, lng2);
                return kakao.maps.services.Util.getDistance(pos1, pos2);
            }
            
            // 백업용 Haversine 공식
            const R = 6371000;
            const rad = Math.PI / 180;
            const dLat = (lat2 - lat1) * rad;
            const dLng = (lng2 - lng1) * rad;
            
            const a = Math.sin(dLat/2) ** 2 + 
                      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * 
                      Math.sin(dLng/2) ** 2;
            
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        }
    };

    /**
     * 마커 생성 유틸리티
     */
    const MarkerUtils = {
        // 카페 마커 SVG
        createCafeMarkerSvg(color = '#ef4444') {
            return `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'>
                <path d='M16 0C7.163 0 0 7.163 0 16s16 24 16 24 16-15.163 16-24S24.837 0 16 0z' fill='${color}'/>
                <circle cx='16' cy='16' r='8' fill='white'/>
                <text x='16' y='20' text-anchor='middle' font-family='Arial' font-size='12' font-weight='bold' fill='${color}'>🎂</text>
            </svg>`;
        },

        // 사용자 위치 마커 SVG
        createUserMarkerSvg() {
            return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
                <circle cx='12' cy='12' r='10' fill='#3b82f6' stroke='white' stroke-width='2'/>
                <circle cx='12' cy='12' r='4' fill='white'/>
            </svg>`;
        },

        // 카카오 마커 이미지 생성
        createMarkerImage(svgString, width = 32, height = 40, offsetX = 16, offsetY = 40) {
            const imageSrc = 'data:image/svg+xml;base64,' + btoa(svgString);
            const imageSize = new kakao.maps.Size(width, height);
            const imageOption = { offset: new kakao.maps.Point(offsetX, offsetY) };
            return new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
        },

        // 카페 마커들 생성
        createCafeMarkers(cafesData, onMarkerClick) {
            const markers = [];
            let successCount = 0;
            let failCount = 0;
            
            console.log('마커 생성 시작, 총 카페 수:', cafesData.length);
            
            cafesData.forEach((cafe, index) => {
                try {
                    // 좌표 유효성 검사
                    if (!Utils.validateCoordinates(cafe.latitude, cafe.longitude)) {
                        console.warn(`카페 ${index}: 좌표 무효 -`, cafe.name || cafe.cafe_name, cafe.latitude, cafe.longitude);
                        failCount++;
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
                            console.log('마커 클릭됨:', cafe.name || cafe.cafe_name);
                            onMarkerClick(cafe);
                        });
                    }
                    
                    markers.push(marker);
                    successCount++;
                    
                    if (successCount <= 3) {
                        console.log(`마커 ${successCount} 생성 성공:`, cafe.name || cafe.cafe_name, `(${cafe.latitude}, ${cafe.longitude})`);
                    }
                    
                } catch (error) {
                    console.error(`카페 ${index} 마커 생성 실패:`, error, cafe);
                    failCount++;
                }
            });
            
            console.log(`마커 생성 완료 - 성공: ${successCount}개, 실패: ${failCount}개`);
            return markers;
        }
    };

    /**
     * 메인 지도 관리자
     */
    class MapManager {
        constructor(containerId, options = {}) {
            this.containerId = containerId;
            this.options = {
                center: CONFIG.DEFAULT_CENTER,
                level: Utils.isMobile() ? CONFIG.MOBILE_LEVEL : CONFIG.DEFAULT_LEVEL,
                enableClustering: true,
                ...options
            };
        }

        // 지도 초기화
        async init() {
            try {
                await this.waitForKakaoAPI();
                this.createMap();
                this.createClusterer();
                this.hideLoading();
                
                // 전역 변수 설정
                mapInstance = this.map;
                clustererInstance = this.clusterer;
                
                console.log('지도 초기화 완료');
                return true;
            } catch (error) {
                console.error('지도 초기화 실패:', error);
                this.showError('지도를 불러올 수 없습니다.');
                return false;
            }
        }

        // 카카오맵 API 대기
        waitForKakaoAPI() {
            return new Promise((resolve, reject) => {
                if (typeof kakao !== 'undefined' && kakao.maps) {
                    resolve();
                    return;
                }

                let attempts = 0;
                const checkAPI = () => {
                    if (typeof kakao !== 'undefined' && kakao.maps) {
                        resolve();
                    } else if (++attempts >= 50) {
                        reject(new Error('카카오맵 API 로드 실패'));
                    } else {
                        setTimeout(checkAPI, 100);
                    }
                };
                checkAPI();
            });
        }

        // 지도 생성
        createMap() {
            const container = document.getElementById(this.containerId);
            if (!container) throw new Error('지도 컨테이너 없음');

            this.map = new kakao.maps.Map(container, {
                center: new kakao.maps.LatLng(this.options.center.lat, this.options.center.lng),
                level: this.options.level
            });
        }

        // 클러스터러 생성
        createClusterer() {
            if (!kakao.maps.MarkerClusterer) {
                console.warn('클러스터러 사용 불가');
                return;
            }

            this.clusterer = new kakao.maps.MarkerClusterer({
                map: this.map,
                averageCenter: true,
                minLevel: Utils.isMobile() ? 7 : 6,
                disableClickZoom: true,
                styles: [{
                    width: '40px', height: '40px',
                    background: 'rgba(59, 130, 246, 0.8)',
                    borderRadius: '50%', color: '#fff',
                    textAlign: 'center', fontWeight: 'bold',
                    fontSize: '14px', lineHeight: '40px'
                }]
            });

            kakao.maps.event.addListener(this.clusterer, 'clusterclick', cluster => {
                this.map.setLevel(this.map.getLevel() - 2, { anchor: cluster.getCenter() });
            });
        }

        // 카페 마커 로드
        loadCafes(cafesData, onMarkerClick) {
            currentMarkers = MarkerUtils.createCafeMarkers(cafesData, onMarkerClick);
            this.updateMarkersDisplay();
            
            console.log(`마커 ${currentMarkers.length}개 생성`);
            return currentMarkers;
        }

        // 마커 표시 방식 업데이트
        updateMarkersDisplay() {
            if (isClusteringEnabled && this.clusterer) {
                currentMarkers.forEach(marker => marker.setMap(null));
                this.clusterer.addMarkers(currentMarkers);
            } else {
                if (this.clusterer) this.clusterer.clear();
                currentMarkers.forEach(marker => marker.setMap(this.map));
            }
        }

        // 클러스터링 토글
        toggleClustering() {
            isClusteringEnabled = !isClusteringEnabled;
            this.updateMarkersDisplay();
            return isClusteringEnabled;
        }

        // 사용자 위치로 이동
        moveToUserLocation() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('위치 서비스 지원 안함'));
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    position => {
                        const { latitude: lat, longitude: lng } = position.coords;
                        
                        this.setCenter(lat, lng, CONFIG.USER_LOCATION_LEVEL);
                        this.addUserLocationMarker(lat, lng);
                        
                        resolve({ lat, lng });
                    },
                    error => reject(error),
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
                );
            });
        }

        // 사용자 위치 마커 추가
        addUserLocationMarker(lat, lng) {
            if (userLocationMarker) {
                userLocationMarker.setMap(null);
            }

            const position = new kakao.maps.LatLng(lat, lng);
            const markerImage = MarkerUtils.createMarkerImage(
                MarkerUtils.createUserMarkerSvg(), 24, 24, 12, 12
            );

            userLocationMarker = new kakao.maps.Marker({
                position: position,
                image: markerImage,
                title: '내 위치'
            });

            userLocationMarker.setMap(this.map);

            // 정보창 추가
            const infoWindow = new kakao.maps.InfoWindow({
                content: '<div style="padding:5px;font-size:12px;">📍 내 위치</div>'
            });

            kakao.maps.event.addListener(userLocationMarker, 'click', () => {
                infoWindow.open(this.map, userLocationMarker);
            });
        }

        // 지도 중심 설정
        setCenter(lat, lng, level) {
            const position = new kakao.maps.LatLng(lat, lng);
            this.map.setCenter(position);
            if (level) this.map.setLevel(level);
        }

        // 특정 위치로 이동
        moveToLocation(lat, lng, level = 5) {
            this.setCenter(lat, lng, level);
        }

        // 로딩 숨기기
        hideLoading() {
            const loading = document.getElementById('mapLoading');
            if (loading) loading.style.display = 'none';
        }

        // 에러 표시
        showError(message) {
            const loading = document.getElementById('mapLoading');
            if (loading) {
                loading.innerHTML = `
                    <div class="text-center">
                        <p class="text-red-600 mb-2">${message}</p>
                        <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 text-white rounded text-sm">새로고침</button>
                    </div>
                `;
            }
        }
    }

    /**
     * 주변 카페 관리
     */
    const NearbyUtils = {
        findNearbyCafes(userLat, userLng, cafesData, radiusKm = 3) {
            return cafesData
                .filter(cafe => Utils.validateCoordinates(cafe.latitude, cafe.longitude))
                .map(cafe => {
                    const distance = Utils.calculateDistance(userLat, userLng, cafe.latitude, cafe.longitude);
                    return {
                        ...cafe,
                        distance: Math.round(distance),
                        walkTime: Math.round(distance / 80)
                    };
                })
                .filter(cafe => cafe.distance <= radiusKm * 1000)
                .sort((a, b) => a.distance - b.distance);
        },

        displayNearbyCafes(nearbyCafes, containerId, onCafeClick) {
            const container = document.getElementById(containerId);
            if (!container) return;

            if (nearbyCafes.length === 0) {
                container.innerHTML = '<div class="text-center text-gray-500 py-4">주변에 운영중인 생카가 없습니다.</div>';
                return;
            }

            container.innerHTML = nearbyCafes.map(cafe => {
                const cafeName = cafe.name || cafe.cafe_name || '생일카페';
                const artistName = cafe.artist || '';
                const memberName = cafe.member || '';
                
                return `
                    <div class="nearby-cafe-item border border-gray-200 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" 
                         data-cafe-id="${cafe.id}">
                        <div class="flex items-start space-x-3">
                            ${cafe.main_image ? 
                                `<img src="${cafe.main_image}" alt="${cafeName}" class="w-12 h-12 object-cover rounded-lg flex-shrink-0">` :
                                '<div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><span class="text-gray-400 text-sm">🎂</span></div>'
                            }
                            <div class="flex-1 min-w-0">
                                <h4 class="font-medium text-sm text-gray-900 truncate">${cafeName}</h4>
                                <p class="text-xs text-gray-600 truncate">${artistName}${memberName ? ` - ${memberName}` : ''}</p>
                                <div class="flex items-center space-x-2 mt-2">
                                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${cafe.distance}m</span>
                                    <span class="text-xs text-gray-500">도보 ${cafe.walkTime}분</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // 클릭 이벤트 추가
            if (onCafeClick) {
                container.querySelectorAll('.nearby-cafe-item').forEach((item, index) => {
                    item.addEventListener('click', () => onCafeClick(nearbyCafes[index]));
                });
            }
        }
    };

    /**
     * 위치 권한 관리
     */
    const LocationManager = {
        async requestLocationPermission() {
            // 이미 거부했으면 바로 기본 지도 표시
            if (localStorage.getItem('locationDenied') === 'true') {
                return { granted: false, reason: 'previously_denied' };
            }

            // 권한 상태 확인
            if ('permissions' in navigator) {
                try {
                    const result = await navigator.permissions.query({ name: 'geolocation' });
                    
                    if (result.state === 'granted') {
                        return { granted: true, reason: 'already_granted' };
                    } else if (result.state === 'denied') {
                        return { granted: false, reason: 'denied' };
                    }
                } catch (error) {
                    console.warn('권한 확인 실패:', error);
                }
            }

            // 모달 표시
            return this.showLocationModal();
        },

        showLocationModal() {
            return new Promise((resolve) => {
                const modal = document.getElementById('locationModal');
                if (!modal) {
                    resolve({ granted: false, reason: 'no_modal' });
                    return;
                }

                modal.classList.remove('hidden');

                const allowBtn = document.getElementById('allowLocationBtn');
                const denyBtn = document.getElementById('denyLocationBtn');

                const cleanup = () => {
                    modal.classList.add('hidden');
                    allowBtn?.removeEventListener('click', handleAllow);
                    denyBtn?.removeEventListener('click', handleDeny);
                };

                const handleAllow = () => {
                    cleanup();
                    localStorage.removeItem('locationDenied');
                    resolve({ granted: true, reason: 'user_allowed' });
                };

                const handleDeny = () => {
                    cleanup();
                    localStorage.setItem('locationDenied', 'true');
                    resolve({ granted: false, reason: 'user_denied' });
                };

                allowBtn?.addEventListener('click', handleAllow);
                denyBtn?.addEventListener('click', handleDeny);
            });
        }
    };

    // ✅ 자동 초기화 함수 수정 (mapManager 변수 오류 해결)
    function autoInitializeWithLocation() {
        console.log('🚀 자동 위치 기반 초기화 시작');
        
        // mapManager 변수 대신 직접 MapManager 인스턴스 생성
        const mapManager = new MapManager('mapContainer');
        
        // 위치 권한 요청 후 초기화
        LocationManager.requestLocationPermission().then(async result => {
            try {
                // 지도 먼저 초기화
                await mapManager.init();
                
                if (result.granted) {
                    console.log('📍 위치 권한 허용됨, 사용자 위치로 이동');
                    try {
                        const position = await mapManager.moveToUserLocation();
                        
                        // 서버에서 전달된 카페 데이터가 있다면 주변 카페 표시
                        if (typeof cafesDataFromServer !== 'undefined' && Array.isArray(cafesDataFromServer)) {
                            const nearby = NearbyUtils.findNearbyCafes(
                                position.lat,
                                position.lng,
                                cafesDataFromServer
                            );
                            
                            NearbyUtils.displayNearbyCafes(nearby, 'nearbyList', (cafe) => {
                                if (cafe.id) {
                                    window.location.href = `/ddoksang/cafe/${cafe.id}/`;
                                }
                            });
                        }
                    } catch (locationError) {
                        console.warn('위치 정보 가져오기 실패:', locationError);
                        Utils.showToast('위치 정보를 가져올 수 없어 기본 지도를 표시합니다.', 'warning');
                    }
                } else {
                    console.log('📍 위치 권한 거부됨, 기본 지도 표시');
                }
            } catch (error) {
                console.error('지도 초기화 실패:', error);
                Utils.showToast('지도 초기화에 실패했습니다.', 'error');
            }
        });
    }

    // 전역 API 노출
    window.DdoksangMap = {
        // 클래스들
        MapManager,
        
        // 유틸리티들
        Utils,
        MarkerUtils,
        NearbyUtils,
        LocationManager,
        
        // 설정
        CONFIG,
        
        // 상태 접근자
        getMapInstance: () => mapInstance,
        getClustererInstance: () => clustererInstance,
        getCurrentMarkers: () => currentMarkers,
        getUserLocationMarker: () => userLocationMarker,
        isClusteringEnabled: () => isClusteringEnabled,
        
        // 편의 함수들
        showToast: Utils.showToast,
        validateCoordinates: Utils.validateCoordinates,
        calculateDistance: Utils.calculateDistance,
        findNearbyCafes: NearbyUtils.findNearbyCafes,
        displayNearbyCafes: NearbyUtils.displayNearbyCafes,
        
        // 자동 초기화 함수
        autoInitializeWithLocation
    };

    // 하위 호환성을 위한 전역 변수들
    Object.defineProperties(window, {
        map: { get: () => mapInstance, configurable: true },
        clusterer: { get: () => clustererInstance, configurable: true },
        markers: { get: () => currentMarkers, configurable: true },
        userLocationMarker: { get: () => userLocationMarker, configurable: true },
        isClusteringEnabled: { get: () => isClusteringEnabled, configurable: true }
    });

    console.log('✅ DdoksangMap 모듈 로드 완료');

})(window);