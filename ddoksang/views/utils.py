from ddoksang.models import BdayCafe
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q
from datetime import date
import json
import math
from django.conf import settings

DEFAULT_PAGE_SIZE = getattr(settings, 'DEFAULT_PAGE_SIZE', 10)
MAX_NEARBY_CAFES = getattr(settings, 'MAX_NEARBY_CAFES', 20)


