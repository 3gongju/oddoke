import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, TextMessage, ImageMessage, AccountInfoMessage, AddressMessage
from django.db import transaction

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'

        # 채팅방에 참여
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # 채팅방 떠남
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # 메시지 받을 때
    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type', 'chat')  # 기본은 'chat'
        current_sender = self.scope['user']
        room_id = data.get('room_id')

        seller = await self.get_chatroom_seller(room_id)

        print(f"WebSocket 메시지 수신: type={message_type}, sender={current_sender}, room_id={room_id}")
        
        is_seller = True if current_sender == seller else False

        if message_type == 'read_all':
            await self.mark_all_as_read()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'read_update',
                    'reader': self.scope['user'].username
                }
            )
        elif message_type == 'chat':
            message = data['message']
            sender_id = self.scope['user'].id

            # 텍스트 메시지 DB 저장
            message_obj = await self.save_text_message(sender_id, self.room_id, message)

            # 메시지 전송
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender_id': sender_id,
                    'message_id': message_obj.id,
                    'is_read': False,
                }
            )
        elif message_type == 'read_message_sync':
            await self.mark_all_as_read()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'read_message_sync_finish',
                    'reader': self.scope['user'].username
                }
            )
        elif message_type == 'enter_chatroom':
            await self.mark_all_as_read()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'enter_chatroom_finish',
                    'reader': self.scope['user'].username
                }
            )

        elif message_type == 'chat_image':
            image_url = data['image_url']
            sender_id = data['sender_id']
            message_id = data.get('message_id')

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'image_message',
                    'image_url': image_url,
                    'sender_id': sender_id,
                    'message_id': message_id,
                    'is_read': False,
                }
            )

        # 계좌정보 메시지 처리
        elif message_type == 'account_info':
            print(f"계좌정보 메시지 처리 시작: {data}")
            try:
                account_info = data['account_info']
                sender_id = data['sender_id']
                message_id = data.get('message_id')
                
                # 그룹의 모든 사용자에게 전송
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
                print("계좌정보 메시지 그룹 전송 완료")
                
            except Exception as e:
                print(f"계좌정보 처리 오류: {str(e)}")

        # 주소정보 메시지 처리 (새로 추가)
        elif message_type == 'address_info':
            print(f"주소정보 메시지 처리 시작: {data}")
            try:
                address_info = data['address_info']
                sender_id = data['sender_id']
                message_id = data.get('message_id')
                
                # 그룹의 모든 사용자에게 전송
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
                print("주소정보 메시지 그룹 전송 완료")
                
            except Exception as e:
                print(f"주소정보 처리 오류: {str(e)}")
        else:
            print(f"알 수 없는 메시지 타입: {message_type}")

    # 텍스트 메시지 전송
    async def chat_message(self, event):
        sender = await self.get_username(event['sender_id'])
        is_read = event.get('is_read', False)

        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender': sender,
            'message_id': event.get('message_id'),
            'is_read': is_read,
        }))

    # 이미지 메시지 전송
    async def image_message(self, event):
        sender = await self.get_username(event['sender_id'])
        await self.send(text_data=json.dumps({
            'type': 'chat_image',
            'image_url': event['image_url'],
            'sender': sender,
            'message_id': event.get('message_id'),
            'is_read': event.get('is_read', False), 
        }))

    # 계좌정보 메시지 전송
    async def account_info_message(self, event):
        try:
            sender = await self.get_username(event['sender_id'])
            print(f"계좌정보 메시지 클라이언트 전송: sender={sender}, account_info={event['account_info']}")
            
            await self.send(text_data=json.dumps({
                'type': 'account_info',
                'account_info': event['account_info'],
                'sender': sender,
                'message_id': event.get('message_id'),
                'is_read': event.get('is_read', False),
            }))
            print("계좌정보 메시지 클라이언트 전송 완료")
            
        except Exception as e:
            print(f"계좌정보 메시지 전송 오류: {str(e)}")

    # 주소정보 메시지 전송 (새로 추가)
    async def address_info_message(self, event):
        try:
            sender = await self.get_username(event['sender_id'])
            print(f"주소정보 메시지 클라이언트 전송: sender={sender}")
            
            await self.send(text_data=json.dumps({
                'type': 'address_info',
                'address_info': event['address_info'],
                'sender': sender,
                'message_id': event.get('message_id'),
                'is_read': event.get('is_read', False),
            }))
            print("주소정보 메시지 클라이언트 전송 완료")
            
        except Exception as e:
            print(f"주소정보 메시지 전송 오류: {str(e)}")

    # 텍스트 메시지 DB에 저장
    @database_sync_to_async
    def save_text_message(self, sender_id, room_id, content):
        try:
            with transaction.atomic():
                sender = User.objects.get(id=sender_id)
                room = ChatRoom.objects.get(id=room_id)
                
                # receiver 계산: sender가 buyer면 seller가 receiver, 반대의 경우도 마찬가지
                receiver = room.seller if sender == room.buyer else room.buyer
                
                # 기본 메시지 생성 (sender와 receiver 모두 설정)
                message = Message.objects.create(
                    room=room, 
                    sender=sender,
                    receiver=receiver,
                    message_type='text'
                )
                
                # 텍스트 메시지 상세 정보 생성
                TextMessage.objects.create(
                    message=message,
                    content=content
                )
                
                return message
        except Exception as e:
            print(f"텍스트 메시지 저장 오류: {str(e)}")
            raise

    # 사용자 이름 가져오기
    @database_sync_to_async
    def get_username(self, user_id):
        return User.objects.get(id=user_id).username

    @database_sync_to_async
    def get_chatroom_seller(self, room_id):
        return ChatRoom.objects.get(id=room_id).seller

    # DB에서 읽음 처리 (receiver 기준으로 변경)
    @database_sync_to_async
    def mark_all_as_read(self):
        # 내가 receiver인 메시지들 중 읽지 않은 것들을 읽음 처리
        Message.objects.filter(
            room_id=self.room_id,
            receiver=self.scope['user'],
            is_read=False
        ).update(is_read=True)
    
    # 읽음 결과 전송하고 JS에서 처리
    async def read_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'read_update',
            'reader': event['reader'],
        }))

    async def read_message_sync_finish(self, event):
        await self.send(text_data=json.dumps({
            'type': 'read_message_sync_finish',
            'reader': event['reader'],
        }))

    async def enter_chatroom_finish(self, event):
        await self.send(text_data=json.dumps({
            'type': 'enter_chatroom_finish',
            'reader': event['reader'],
        }))