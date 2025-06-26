(function(window) {
    'use strict';

    const Utils = {
        calculateDistance(lat1, lng1, lat2, lng2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        },

        isCafeOperating(cafe) {
            const today = new Date();
            const startDate = new Date(cafe.start_date);
            const endDate = new Date(cafe.end_date);
            return startDate <= today && today <= endDate;
        },

        findNearbyCafes(userLat, userLng, cafes, radiusKm = 5) {
            return cafes.filter(cafe => {
                if (!cafe.latitude || !cafe.longitude) return false;
                const distance = this.calculateDistance(userLat, userLng, cafe.latitude, cafe.longitude);
                return distance <= radiusKm;
            }).map(cafe => {
                const distance = this.calculateDistance(userLat, userLng, cafe.latitude, cafe.longitude);
                return {
                    ...cafe,
                    distance,
                    walkTime: Math.round(distance * 12)
                };
            }).sort((a, b) => a.distance - b.distance);
        },

        createMarkerImage(cafe) {
            const svgString = `
                <svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'>
                    <path d='M16 0C7.163 0 0 7.163 0 16s16 24 16 24 16-15.163 16-24S24.837 0 16 0z' fill='#ef4444'/>
                    <circle cx='16' cy='16' r='8' fill='white'/>
                    <text x='16' y='20' text-anchor='middle' font-family='Arial' font-size='12' font-weight='bold' fill='#ef4444'>🎂</text>
                </svg>
            `;
            const imageSrc = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
            return new kakao.maps.MarkerImage(
                imageSrc,
                new kakao.maps.Size(32, 40),
                { offset: new kakao.maps.Point(16, 40) }
            );
        }
    };

    class MapManager {
        constructor(containerId, options = {}) {
            this.containerId = containerId;
            this.map = null;
            this.clusterer = null;
            this.markers = [];
            this.userLocationMarker = null;
            this.isClusteringEnabled = true;
            
            this.defaultOptions = {
                center: { lat: 37.5665, lng: 126.9780 },
                zoom: 8,
                ...options
            };
        }

        async init() {
            try {
                const container = document.getElementById(this.containerId);
                if (!container) {
                    throw new Error(`지도 컨테이너를 찾을 수 없습니다: ${this.containerId}`);
                }

                const mapOption = {
                    center: new kakao.maps.LatLng(this.defaultOptions.center.lat, this.defaultOptions.center.lng),
                    level: this.defaultOptions.zoom
                };
                
                this.map = new kakao.maps.Map(container, mapOption);

                this.clusterer = new kakao.maps.MarkerClusterer({
                    map: this.map,
                    averageCenter: true,
                    minLevel: 6,
                    disableClickZoom: false,
                    styles: [
                        {
                            width: '40px',
                            height: '40px',
                            background: 'rgba(59, 130, 246, 0.8)',
                            borderRadius: '50%',
                            color: '#fff',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            lineHeight: '40px'
                        }
                    ]
                });

                return true;
            } catch (error) {
                console.error('지도 초기화 실패:', error);
                return false;
            }
        }

        setCenter(lat, lng, zoom = null) {
            if (!this.map) return;
            
            const center = new kakao.maps.LatLng(lat, lng);
            this.map.setCenter(center);
            
            if (zoom !== null) {
                this.map.setLevel(zoom);
            }
        }

        async loadCafes(cafes, onMarkerClick, moveToCafes = false) {
            try {
                this.clearMarkers();
                
                for (const cafe of cafes) {
                    if (!cafe.latitude || !cafe.longitude) continue;
                    
                    const position = new kakao.maps.LatLng(cafe.latitude, cafe.longitude);
                    const markerImage = Utils.createMarkerImage(cafe);
                    
                    const marker = new kakao.maps.Marker({
                        position: position,
                        image: markerImage,
                        title: cafe.cafe_name || cafe.name
                    });

                    if (onMarkerClick) {
                        kakao.maps.event.addListener(marker, 'click', () => {
                            onMarkerClick(cafe);
                        });
                    }

                    this.markers.push(marker);
                }

                if (this.isClusteringEnabled && this.clusterer) {
                    this.clusterer.addMarkers(this.markers);
                } else {
                    this.markers.forEach(marker => marker.setMap(this.map));
                }

                if (moveToCafes && this.markers.length > 0) {
                    const firstMarker = this.markers[0];
                    this.map.setCenter(firstMarker.getPosition());
                    this.map.setLevel(8);
                }

                return true;
            } catch (error) {
                console.error('카페 마커 로드 실패:', error);
                return false;
            }
        }

        clearMarkers() {
            if (this.clusterer) {
                this.clusterer.clear();
            }
            this.markers.forEach(marker => marker.setMap(null));
            this.markers = [];
        }

        moveToLocation(lat, lng, level = 6) {
            if (!this.map) return;
            
            const moveLatLng = new kakao.maps.LatLng(lat, lng);
            this.map.setCenter(moveLatLng);
            this.map.setLevel(level);
        }

        addUserLocationMarker(lat, lng) {
            if (this.userLocationMarker) {
                this.userLocationMarker.setMap(null);
            }

            const position = new kakao.maps.LatLng(lat, lng);
            
            const imageSrc = 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="2"/>
                    <circle cx="12" cy="12" r="4" fill="white"/>
                </svg>
            `);

            const markerImage = new kakao.maps.MarkerImage(
                imageSrc,
                new kakao.maps.Size(24, 24),
                { offset: new kakao.maps.Point(12, 12) }
            );

            this.userLocationMarker = new kakao.maps.Marker({
                map: this.map,
                position: position,
                image: markerImage
            });
        }

        toggleClustering() {
            this.isClusteringEnabled = !this.isClusteringEnabled;
            
            if (this.isClusteringEnabled) {
                this.markers.forEach(marker => marker.setMap(null));
                this.clusterer.addMarkers(this.markers);
            } else {
                this.clusterer.clear();
                this.markers.forEach(marker => marker.setMap(this.map));
            }

            return this.isClusteringEnabled;
        }

        resetToDefault() {
            this.setCenter(
                this.defaultOptions.center.lat, 
                this.defaultOptions.center.lng, 
                this.defaultOptions.zoom
            );
        }

        getMapInfo() {
            if (!this.map) return null;

            const center = this.map.getCenter();
            const level = this.map.getLevel();

            return {
                center: {
                    lat: center.getLat(),
                    lng: center.getLng()
                },
                zoom: level,
                markerCount: this.markers.length,
                isClusteringEnabled: this.isClusteringEnabled
            };
        }
    }

    function displayNearbyCafes(cafes, containerId, onCafeClick) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (cafes.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <p class="text-sm">주변에 운영중인 카페가 없습니다.</p>
                </div>
            `;
            return;
        }

        cafes.forEach(cafe => {
            const item = document.createElement('div');
            item.className = 'border border-gray-200 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';
            
            item.innerHTML = `
                <div class="flex items-start space-x-3">
                    ${cafe.main_image ? 
                        `<img src="${cafe.main_image}" alt="${cafe.cafe_name || cafe.name}" class="w-12 h-12 object-cover rounded-lg flex-shrink-0">` :
                        '<div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><span class="text-gray-400 text-sm">🎂</span></div>'
                    }
                    <div class="flex-1 min-w-0">
                        <h4 class="font-medium text-sm text-gray-900 truncate">${cafe.cafe_name || cafe.name}</h4>
                        <p class="text-xs text-gray-600 truncate">${cafe.artist || ''}${cafe.member ? ` - ${cafe.member}` : ''}</p>
                        <div class="flex items-center space-x-2 mt-2">
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${cafe.distance.toFixed(1)}km</span>
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

    window.DdoksangMap = {
        MapManager,
        Utils,
        displayNearbyCafes
    };

})(window);