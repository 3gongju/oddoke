# utils/redis_client.py
import redis
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class RedisClient:
    _instance = None
    _client = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._client is None:
            try:
                # Redis 연결 설정
                redis_url = settings.REDIS_URL
                
                self._client = redis.from_url(
                    redis_url,
                    decode_responses=True,  # 문자열로 자동 변환
                    socket_timeout=5,       # 5초 타임아웃
                    socket_connect_timeout=5,
                    retry_on_timeout=True
                )
                
                # 연결 테스트
                self._client.ping()
                logger.info("Redis 연결 성공")
                
            except Exception as e:
                logger.error(f"Redis 연결 실패: {e}")
                self._client = None
    
    @property
    def client(self):
        """Redis 클라이언트 반환"""
        if self._client is None:
            self.__init__()
        return self._client
    
    def is_connected(self):
        """Redis 연결 상태 확인"""
        try:
            return self.client and self.client.ping()
        except:
            return False
    
    # 채팅방 위치 관련 메서드들
    def set_user_current_chatroom(self, user_id, room_code, ttl=120):
        """사용자의 현재 채팅방 설정 (TTL: 2분)"""
        try:
            if self.is_connected():
                key = f"user:{user_id}:current_chatroom"
                result = self.client.setex(key, ttl, room_code)
                logger.debug(f"사용자 {user_id}의 현재 채팅방을 {room_code}로 설정")
                return result
        except Exception as e:
            logger.error(f"사용자 현재 채팅방 설정 실패: {e}")
        return False
    
    def get_user_current_chatroom(self, user_id):
        """사용자의 현재 채팅방 조회"""
        try:
            if self.is_connected():
                key = f"user:{user_id}:current_chatroom"
                result = self.client.get(key)
                logger.debug(f"사용자 {user_id}의 현재 채팅방: {result}")
                return result
        except Exception as e:
            logger.error(f"사용자 현재 채팅방 조회 실패: {e}")
        return None
    
    def clear_user_current_chatroom(self, user_id):
        """사용자의 현재 채팅방 정보 삭제"""
        try:
            if self.is_connected():
                key = f"user:{user_id}:current_chatroom"
                result = self.client.delete(key)
                logger.debug(f"사용자 {user_id}의 현재 채팅방 정보 삭제")
                return result
        except Exception as e:
            logger.error(f"사용자 현재 채팅방 정보 삭제 실패: {e}")
        return False

# 전역에서 사용할 인스턴스
redis_client = RedisClient()