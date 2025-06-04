import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message

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
        current_user = self.scope['user']
        room_id = data.get('room_id')

        seller = await self.get_chatroom_seller(room_id)

        print(message_type, current_user, room_id, seller)
        
        is_seller = True if current_user == seller else False

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

            # 메시지 DB 저장
            await self.save_message(sender_id, self.room_id, message)

            # 메시지 전송
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender_id': sender_id,
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
        


    # 모든 사용자에게 메시지 보내기
    async def chat_message(self, event):
        sender = await self.get_username(event['sender_id'])
        is_read = event.get('is_read', False)


        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender': sender,
            'is_read': is_read,
        }))

    # 메시지 DB에 저장
    @database_sync_to_async
    def save_message(self, sender_id, room_id, message):
        sender = User.objects.get(id=sender_id)
        room = ChatRoom.objects.get(id=room_id)
        Message.objects.create(room=room, sender=sender, content=message)

    # 사용자 이름 가져오기
    @database_sync_to_async
    def get_username(self, user_id):
        return User.objects.get(id=user_id).username

    @database_sync_to_async
    def get_chatroom_seller(self, room_id):
        return ChatRoom.objects.get(id=room_id).seller


    # # DB에서 읽음 처리
    @database_sync_to_async
    def mark_all_as_read(self):
        from .models import Message
        Message.objects.filter(
            room_id=self.room_id,
            is_read=False
        ).exclude(sender=self.scope['user']).update(is_read=True)
    

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