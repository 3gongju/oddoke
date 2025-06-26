# accounts/utils.py
from cryptography.fernet import Fernet
from django.conf import settings

class BankEncryption:    
    @staticmethod
    def encrypt(data):
        if not data:
            return None
        f = Fernet(settings.ACCOUNT_ENCRYPTION_KEY.encode())
        return f.encrypt(data.encode()).decode()
    
    @staticmethod
    def decrypt(encrypted_data):
        if not encrypted_data:
            return None
        try:
            f = Fernet(settings.ACCOUNT_ENCRYPTION_KEY.encode())
            return f.decrypt(encrypted_data.encode()).decode()
        except Exception:
            return None

class AddressEncryption:
    @staticmethod
    def encrypt(data):
        if not data:
            return None
        f = Fernet(settings.ACCOUNT_ENCRYPTION_KEY.encode())
        return f.encrypt(data.encode()).decode()
    
    @staticmethod
    def decrypt(encrypted_data):
        if not encrypted_data:
            return None
        try:
            f = Fernet(settings.ACCOUNT_ENCRYPTION_KEY.encode())
            return f.decrypt(encrypted_data.encode()).decode()
        except Exception:
            return None