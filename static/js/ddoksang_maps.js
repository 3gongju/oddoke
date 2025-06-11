(function(window) {
  'use strict';

  const Utils = {
    calculateDistance(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const rad = Math.PI / 180;
      const dLat = (lat2 - lat1) * rad;
      const dLng = (lng2 - lng1) * rad;
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c);
    },

    isValidLatLng(lat, lng) {
      return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    },

    encodeToBase64Unicode(str) {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        return btoa('fallback');
      }
    },

    createDefaultMarker() {
      const svgString = `
        <svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'>
          <path d='M16 0C7.163 0 0 7.163 0 16s16 24 16 24 16-15.163 16-24S24.837 0 16 0z' fill='#ef4444'/>
          <circle cx='16' cy='16' r='8' fill='white'/>
          <text x='16' y='20' text-anchor='middle' font-family='Arial' font-size='12' font-weight='bold' fill='#ef4444'>🎂</text>
        </svg>`;
      const imageSrc = 'data:image/svg+xml;base64,' + Utils.encodeToBase64Unicode(svgString);
      return new kakao.maps.MarkerImage(imageSrc, new kakao.maps.Size(32, 40), { offset: new kakao.maps.Point(16, 40) });
    },

    async createCircleImageMarker(cafe) {
      const imageUrl = cafe.main_image || cafe.image_url;
      if (!imageUrl) return Utils.createDefaultMarker();

      const size = 60; // canvas 크기
      const radius = 24;
      const padding = (size - radius * 2) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;

      return new Promise((resolve) => {
        img.onload = () => {
          ctx.clearRect(0, 0, size, size);

          // 배경 동그라미 (외곽 테두리용)
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fillStyle = '#000'; // 검정 테두리 배경
          ctx.fill();

          // 이미지 클리핑
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, radius - 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          const minLength = Math.min(img.width, img.height);
          const sx = (img.width - minLength) / 2;
          const sy = (img.height - minLength) / 2;

          ctx.drawImage(img, sx, sy, minLength, minLength, padding + 2, padding + 2, (radius - 2) * 2, (radius - 2) * 2);

          const dataUrl = canvas.toDataURL('image/png');
          const markerImage = new kakao.maps.MarkerImage(
            dataUrl,
            new kakao.maps.Size(size, size),
            { offset: new kakao.maps.Point(size / 2, size) }
          );
          resolve(markerImage);
        };

        img.onerror = () => resolve(Utils.createDefaultMarker());
      });
    }
  };

  class MapManager {
    constructor(containerId) {
      this.containerId = containerId;
      this.map = null;
      this.clusterer = null;
      this.markers = [];
      this.userLocationMarker = null;
      this.isClusteringEnabled = true;
    }

    addUserLocationMarker(lat, lng) {
    if (this.userLocationMarker) {
        this.userLocationMarker.setMap(null);
    }

    const position = new kakao.maps.LatLng(lat, lng);

    const imageSrc = '/static/image/ddok_circle_red.png';//  원하는 위치 아이콘으로 교체 가능 (내 위치를 나타내는 마커)
    const imageSize = new kakao.maps.Size(66, 66);
    const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

    this.userLocationMarker = new kakao.maps.Marker({
        position,
        map: this.map,
        image: markerImage,
        title: '내 위치'
    });
}


    async init(center = { lat: 37.5665, lng: 126.9780 }, level = 6) {
      const container = document.getElementById(this.containerId);
      if (!container) return false;
      this.map = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level: level
      });
      this.initClusterer();
      return true;
    }

    initClusterer() {
      this.clusterer = new kakao.maps.MarkerClusterer({
        map: this.map,
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: true
      });

      kakao.maps.event.addListener(this.clusterer, 'clusterclick', (cluster) => {
        const level = this.map.getLevel() - 2;
        this.map.setLevel(level, { anchor: cluster.getCenter() });
      });
    }

    moveToLocation(lat, lng, level = 5) {
      if (!this.map) return;
      const pos = new kakao.maps.LatLng(lat, lng);
      this.map.setCenter(pos);
      if (level) this.map.setLevel(level);
    }

    async loadCafes(cafes, onMarkerClick) {
      if (!this.map || !this.clusterer) return;
      this.clearMarkers();

      const markerPromises = cafes.map(async (cafe) => {
        const lat = parseFloat(cafe.latitude || cafe.lat);
        const lng = parseFloat(cafe.longitude || cafe.lng);
        if (!Utils.isValidLatLng(lat, lng)) return null;

        const markerImage = await Utils.createCircleImageMarker(cafe);
        const position = new kakao.maps.LatLng(lat, lng);
        const marker = new kakao.maps.Marker({
          position,
          image: markerImage,
          title: cafe.name || cafe.cafe_name || '생일카페'
        });

        kakao.maps.event.addListener(marker, 'click', () => {
          if (typeof onMarkerClick === 'function') {
            onMarkerClick({
              ...cafe,
              artist: typeof cafe.artist === 'object' ? cafe.artist?.name || '' : cafe.artist || '',
              member: typeof cafe.member === 'object' ? cafe.member?.name || '' : cafe.member || ''
            });
          }
        });

        return marker;
      });

      const resolvedMarkers = await Promise.all(markerPromises);
      this.markers = resolvedMarkers.filter(Boolean);

      if (this.isClusteringEnabled) {
        this.clusterer.addMarkers(this.markers);
      } else {
        this.markers.forEach(marker => marker.setMap(this.map));
      }

      if (this.markers.length > 0) {
        this.map.setCenter(this.markers[0].getPosition());
        this.map.setLevel(8);
      }
    }

    clearMarkers() {
      if (this.clusterer) this.clusterer.clear();
      if (this.markers) {
        this.markers.forEach(marker => marker.setMap(null));
      }
      this.markers = [];
    }
  }

  window.DdoksangMap = {
    MapManager,
    Utils
  };
})(window);
