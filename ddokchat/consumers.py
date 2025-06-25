import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, TextMessage
from django.db import transaction

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """WebSocket 연결 처리"""
        try:
            self.room_code = self.scope['url_route']['kwargs']['room_code']
            self.room_group_name = f'chat_{self.room_code}'
            self.user = self.scope['user']
            
            # 사용자 인증 확인
            if not self.user.is_authenticated:
                await self.close()
                return
            
            # 채팅방 참여 권한 확인
            if not await self.check_room_permission():
                await self.close()
                return
            
            # 채팅방에 참여
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            await self.accept()
            
        except Exception:
            await self.close()

    async def disconnect(self, close_code):
        """WebSocket 연결 해제 처리"""
        try:
            if hasattr(self, 'room_group_name'):
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    self.channel_name
                )
        except Exception:
            pass

    async def receive(self, text_data):
        """메시지 수신 처리"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'chat')
            
            # 거래 완료 상태 확인
            if await self.is_trade_completed():
                await self.send_error("거래가 완료되어 더 이상 메시지를 보낼 수 없습니다.")
                return
            
            # 메시지 타입별 처리
            await self.handle_message_by_type(message_type, data)
            
        except json.JSONDecodeError:
            await self.send_error("잘못된 메시지 형식입니다.")
        except Exception:
            await self.send_error("메시지 처리 중 오류가 발생했습니다.")

    async def handle_message_by_type(self, message_type, data):
        """메시지 타입별 처리 분기"""
        handlers = {
            'read_all': self.handle_read_all,
            'read_message_sync': self.handle_read_message_sync,
            'enter_chatroom': self.handle_enter_chatroom,
            'chat': self.handle_text_message,
            'chat_image': self.handle_image_message,
            'account_info': self.handle_account_info,
            'address_info': self.handle_address_info,
        }
        
        handler = handlers.get(message_type)
        if handler:
            await handler(data)
        else:
            await self.send_error(f"지원하지 않는 메시지 타입입니다: {message_type}")

    async def handle_read_all(self, data):
        """읽음 처리"""
        await self.mark_all_as_read()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'read_update',
                'reader': self.user.username
            }
        )

    async def handle_read_message_sync(self, data):
        """읽음 메시지 동기화"""
        await self.mark_all_as_read()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'read_message_sync_finish',
                'reader': self.user.username
            }
        )

    async def handle_enter_chatroom(self, data):
        """채팅방 입장 처리"""
        await self.mark_all_as_read()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'enter_chatroom_finish',
                'reader': self.user.username
            }
        )

    async def handle_text_message(self, data):
        """텍스트 메시지 처리"""
        message_content = data.get('message', '').strip()
        if not message_content:
            await self.send_error("메시지 내용이 없습니다.")
            return
        
        if len(message_content) > 1000:
            await self.send_error("메시지가 너무 깁니다. (최대 1000자)")
            return
        
        try:
            message_obj = await self.save_text_message(message_content)
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message_content,
                    'sender_id': self.user.id,
                    'message_id': message_obj.id,
                    'is_read': False,
                }
            )
            
        except Exception:
            await self.send_error("메시지 전송에 실패했습니다.")

    async def handle_image_message(self, data):
        """이미지 메시지 처리"""
        image_url = data.get('image_url')
        sender_id = data.get('sender_id')
        message_id = data.get('message_id')
        taken_datetime = data.get('taken_datetime')
        
        if not all([image_url, sender_id]):
            await self.send_error("이미지 정보가 부족합니다.")
            return
        
        if int(sender_id) != self.user.id:
            await self.send_error("권한이 없습니다.")
            return
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'image_message',
                'image_url': image_url,
                'sender_id': sender_id,
                'message_id': message_id,
                'taken_datetime': taken_datetime,
                'is_read': False,
            }
        )

    async def handle_account_info(self, data):
        """계좌정보 메시지 처리"""
        account_info = data.get('account_info')
        sender_id = data.get('sender_id')
        message_id = data.get('message_id')
        
        if not all([account_info, sender_id]):
            await self.send_error("계좌정보가 부족합니다.")
            return
        
        if int(sender_id) != self.user.id:
            await self.send_error("권한이 없습니다.")
            return
        
        try:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'account_info_message',
                    'account_info': account_info,
                    'sender_id': sender_id,
                    'message_id': message_id,
                    'is_read': False,
                }
            )
        except Exception:
            await self.send_error("계좌정보 전송에 실패했습니다.")

    async def handle_address_info(self, data):
        """주소정보 메시지 처리"""
        address_info = data.get('address_info')
        sender_id = data.get('sender_id')
        message_id = data.get('message_id')
        
        if not all([address_info, sender_id]):
            await self.send_error("주소정보가 부족합니다.")
            return
        
        if int(sender_id) != self.user.id:
            await self.send_error("권한이 없습니다.")
            return
        
        try:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'address_info_message',
                    'address_info': address_info,
                    'sender_id': sender_id,
                    'message_id': message_id,
                    'is_read': False,
                }
            )
        except Exception:
            await self.send_error("주소정보 전송에 실패했습니다.")

    # 메시지 전송 메서드들
    async def chat_message(self, event):
        """텍스트 메시지 전송"""
        try:
            sender = await self.get_username(event['sender_id'])
            await self.send(text_data=json.dumps({
                'type': 'chat_message',
                'message': event['message'],
                'sender': sender,
                'message_id': event.get('message_id'),
                'is_read': event.get('is_read', False),
            }))
        except Exception:
            pass

    async def image_message(self, event):
        """이미지 메시지 전송"""
        try:
            sender = await self.get_username(event['sender_id'])
            await self.send(text_data=json.dumps({
                'type': 'chat_image',
                'image_url': event['image_url'],
                'sender': sender,
                'message_id': event.get('message_id'),
                'taken_datetime': event.get('taken_datetime'),
                'is_read': event.get('is_read', False), 
            }))
        except Exception:
            pass

    async def account_info_message(self, event):
        """계좌정보 메시지 전송"""
        try:
            sender = await self.get_username(event['sender_id'])
            await self.send(text_data=json.dumps({
                'type': 'account_info',
                'account_info': event['account_info'],
                'sender': sender,
                'message_id': event.get('message_id'),
                'is_read': event.get('is_read', False),
            }))
        except Exception:
            pass

    async def address_info_message(self, event):
        """주소정보 메시지 전송"""
        try:
            sender = await self.get_username(event['sender_id'])
            await self.send(text_data=json.dumps({
                'type': 'address_info',
                'address_info': event['address_info'],
                'sender': sender,
                'message_id': event.get('message_id'),
                'is_read': event.get('is_read', False),
            }))
        except Exception:
            pass

    # 읽음 처리 메서드들
    async def read_update(self, event):
        """읽음 결과 전송"""
        await self.send(text_data=json.dumps({
            'type': 'read_update',
            'reader': event['reader'],
        }))

    async def read_message_sync_finish(self, event):
        """읽음 메시지 동기화 완료"""
        await self.send(text_data=json.dumps({
            'type': 'read_message_sync_finish',
            'reader': event['reader'],
        }))

    async def enter_chatroom_finish(self, event):
        """채팅방 입장 완료"""
        await self.send(text_data=json.dumps({
            'type': 'enter_chatroom_finish',
            'reader': event['reader'],
        }))

    async def trade_completed_notification(self, event):
        """거래 완료 알림"""
        await self.send(text_data=json.dumps({
            'type': 'trade_completed',
            'room_code': event['room_code'],
        }))

    # 유틸리티 메서드들
    async def send_error(self, message):
        """에러 메시지 전송"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': message
            }))
        except Exception:
            pass

    @database_sync_to_async
    def check_room_permission(self):
        """채팅방 접근 권한 확인"""
        try:
            room = ChatRoom.objects.select_related('buyer', 'seller').get(room_code=self.room_code)
            return self.user in [room.buyer, room.seller]
        except ChatRoom.DoesNotExist:
            return False
        except Exception:
            return False

    @database_sync_to_async
    def is_trade_completed(self):
        """거래 완료 상태 확인"""
        try:
            room = ChatRoom.objects.get(room_code=self.room_code)
            return room.is_fully_completed
        except ChatRoom.DoesNotExist:
            return True
        except Exception:
            return True

    @database_sync_to_async
    def save_text_message(self, content):
        """텍스트 메시지 DB 저장"""
        try:
            with transaction.atomic():
                room = ChatRoom.objects.select_related('buyer', 'seller').get(room_code=self.room_code)
                receiver = room.seller if self.user == room.buyer else room.buyer
                
                message = Message.objects.create(
                    room=room, 
                    sender=self.user,
                    receiver=receiver,
                    message_type='text'
                )
                
                TextMessage.objects.create(
                    message=message,
                    content=content
                )
                
                return message
        except Exception:
            raise

    @database_sync_to_async
    def get_username(self, user_id):
        """사용자 이름 가져오기"""
        try:
            return User.objects.values_list('username', flat=True).get(id=user_id)
        except User.DoesNotExist:
            return "Unknown User"
        except Exception:
            return "Unknown User"

    @database_sync_to_async
    def mark_all_as_read(self):
        """읽음 처리"""
        try:
            # 채팅 메시지 읽음 처리
            Message.objects.filter(
                room__room_code=self.room_code,
                receiver=self.user,
                is_read=False
            ).update(is_read=True)
            
            # 관련 채팅 알림도 읽음 처리
            room = ChatRoom.objects.select_related('content_type').get(room_code=self.room_code)
            
            try:
                from notifications.models import Notification
                Notification.mark_chat_notifications_read(
                    user=self.user,
                    room_post=room.post
                )
            except ImportError:
                pass
            
        except Exception:
            pass